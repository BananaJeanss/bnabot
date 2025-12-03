import { App } from "@slack/bolt";
import { exec as execCallback } from "child_process";
import { uptime } from "os";
import { promisify } from "util";

const exec = promisify(execCallback);

let lastSSHHit = 0;
let SSHHitCache = {
  status: "Online", // if this exists, the server is online
  uptime: 0,
  usercount: 0,
  local: {
    memory: {
      used: 0,
      limit: 0,
    },
    disk: {
      used: 0,
      limit: 0,
    },
    systemdservicesrunning: 0,
  },
  global: {
    memory: {
      used: 0,
      max: 0,
    },
    disk: {
      used: 0,
      max: 0,
    },
    cpu: {
      oneminload: 0,
      fiveminload: 0,
      fifteenminload: 0,
    },
    systemdservicesrunning: 0,
  },
};

async function getNestUserCount(): Promise<number> {
  try {
    const { stdout } = await exec(
      `getent passwd | awk -F: '$3 >= 2000 && $3 < 30000 {count++} END {print count}'`
    );
    const num = parseInt(stdout.trim(), 10);
    return isNaN(num) ? 0 : num;
  } catch (err) {
    console.error("Failed to get user count:", err);
    return 0;
  }
}

async function updateLocalStats() {
  // nest resources
  try {
    const { stdout } = await exec("nest resources");
    const lines = stdout.trim().split("\n");

    for (const line of lines) {
      if (line.startsWith("Disk usage:")) {
        const match = line.match(/Disk usage:\s+([\d.]+)\s+GB.*?([\d.]+)\s+GB/);
        if (match) {
          SSHHitCache.local.disk.used = parseFloat(match[1] || "Unknown");
          SSHHitCache.local.disk.limit = parseFloat(match[2] || "Unknown");
        }
      }

      if (line.startsWith("Memory usage:")) {
        const match = line.match(
          /Memory usage:\s+([\d.]+)\s+GB.*?([\d.]+)\s+GB/
        );
        if (match) {
          SSHHitCache.local.memory.used = parseFloat(match[1] || "Unknown");
          SSHHitCache.local.memory.limit = parseFloat(match[2] || "Unknown");
        }
      }
    }
  } catch (err) {
    console.error("nest resources failed:", err);
    SSHHitCache.local.disk.used = 0;
    SSHHitCache.local.disk.limit = 0;
    SSHHitCache.local.memory.used = 0;
    SSHHitCache.local.memory.limit = 0;
  }

  // systemd --user count
  try {
    const { stdout } = await exec(
      "systemctl --user list-units --type=service --state=running --no-pager --no-legend | wc -l"
    );
    const num = parseInt(stdout.trim(), 10);
    SSHHitCache.local.systemdservicesrunning = isNaN(num) ? 0 : num;
  } catch (err) {
    console.error("systemd user services count failed:", err);
    SSHHitCache.local.systemdservicesrunning = 0;
  }
}

async function updateGlobalStats() {
  // memory usage
  try {
    const { stdout } = await exec("free -m");
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      if (line.startsWith("Mem:")) {
        const parts = line.split(/\s+/);
        SSHHitCache.global.memory.used =
          parseInt(parts[2] || "Unknown", 10) / 1024; // in GB
        SSHHitCache.global.memory.max =
          parseInt(parts[1] || "Unknown", 10) / 1024;
      }
    }
  } catch (err) {
    console.error("Global memory usage fetch failed:", err);
    SSHHitCache.global.memory.used = 0;
    SSHHitCache.global.memory.max = 0;
  }

  // disk usage
  try {
    const { stdout } = await exec("df -h /");
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      if (line.startsWith("/")) {
        const parts = line.split(/\s+/);
        SSHHitCache.global.disk.used = parseFloat(parts[2] || "Unknown");
        SSHHitCache.global.disk.max = parseFloat(parts[1] || "Unknown");
      }
    }
  } catch (err) {
    console.error("Global disk usage fetch failed:", err);
    SSHHitCache.global.disk.used = 0;
    SSHHitCache.global.disk.max = 0;
  }

  // cpu time
  try {
    const { stdout } = await exec("uptime");
    const match = stdout.match(/load average: ([\d.]+), ([\d.]+), ([\d.]+)/);
    if (match) {
      SSHHitCache.global.cpu.oneminload = parseFloat(match[1] || "0");
      SSHHitCache.global.cpu.fiveminload = parseFloat(match[2] || "0");
      SSHHitCache.global.cpu.fifteenminload = parseFloat(match[3] || "0");
    }
  } catch (err) {
    console.error("Global CPU load fetch failed:", err);
    SSHHitCache.global.cpu.oneminload = 0;
    SSHHitCache.global.cpu.fiveminload = 0;
    SSHHitCache.global.cpu.fifteenminload = 0;
  }

  // systemd time woah
  try {
    const { stdout } = await exec(
      "systemctl list-units --type=service --state=running --no-pager --no-legend | wc -l"
    );
    const num = parseInt(stdout.trim(), 10);
    SSHHitCache.global.systemdservicesrunning = isNaN(num) ? 0 : num;
  } catch (err) {
    console.error("Global systemd services count fetch failed:", err);
    SSHHitCache.global.systemdservicesrunning = 0;
  }

  return;
}

// was going to use node-ssh until i remembered i will be hosting ts on nest anyways
async function localUpdateStats() {
  SSHHitCache.uptime = uptime();
  SSHHitCache.usercount = await getNestUserCount();

  await updateLocalStats();
  await updateGlobalStats();

  return;
}

export default function bnaneststatus(app: App) {
  app.command("/bnaneststatus", async ({ ack, respond, command }) => {
    await ack();

    if (Date.now() - lastSSHHit > 5 * 60 * 1000) {
      // 5 minutes
      try {
        await localUpdateStats();
        lastSSHHit = Date.now();
      } catch (err) {
        console.error("Failed to update stats:", err);
        await respond({
          response_type: "ephemeral",
          text: `Failed to fetch Nest status: ${err}`,
        });
      }
    } // else just use cached

    const days = Math.floor(SSHHitCache.uptime / 86400);
    const hours = Math.floor((SSHHitCache.uptime % 86400) / 3600);
    const minutes = Math.floor((SSHHitCache.uptime % 3600) / 60);
    const seconds = Math.floor(SSHHitCache.uptime % 60);
    const uptimeHumanReadableDate = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    await respond({
      response_type: "in_channel",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Nest Status",
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          accessory: {
            type: "image",
            image_url:
              "https://github.com/hackclub/nest/blob/main/brand/logo.png?raw=true",
            alt_text: "Nest Logo",
          },
          fields: [
            {
              type: "mrkdwn",
              text: `*Status:* ${SSHHitCache.status}\n*Uptime:* ${uptimeHumanReadableDate}\n*User Count:* ${SSHHitCache.usercount}\n`,
            },
          ],
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Account Statistics*:\n*Memory:* ${SSHHitCache.local.memory.used.toFixed(
              2
            )}GB / ${SSHHitCache.local.memory.limit.toFixed(
              2
            )}GB\n*Disk:* ${SSHHitCache.local.disk.used.toFixed(
              2
            )}GB / ${SSHHitCache.local.disk.limit.toFixed(
              2
            )}GB\n*Running services:* ${
              SSHHitCache.local.systemdservicesrunning
            }\n`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Nest Statistics*:\n*Memory:* ${SSHHitCache.global.memory.used.toFixed(
              2
            )}GB / ${SSHHitCache.global.memory.max.toFixed(
              2
            )}GB\n*Disk:* ${SSHHitCache.global.disk.used.toFixed(
              2
            )}TB / ${SSHHitCache.global.disk.max.toFixed(
              2
            )}TB\n*CPU Load (1m, 5m, 15m):* ${SSHHitCache.global.cpu.oneminload.toFixed(
              2
            )}, ${SSHHitCache.global.cpu.fiveminload.toFixed(
              2
            )}, ${SSHHitCache.global.cpu.fifteenminload.toFixed(
              2
            )}\n*Running services:* ${
              SSHHitCache.global.systemdservicesrunning
            }\n`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `<@${command.user_id}>`,
            },
          ],
        },
      ],
    });
  });
}
