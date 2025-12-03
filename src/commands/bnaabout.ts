import { App } from "@slack/bolt";
import { readdirSync } from "fs";
import { join } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commandsList = readdirSync(join(__dirname))
  .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
  .map(file => file.replace(/\.(ts|js)$/, ''));

export default function bnaabout(app: App) {
  app.command("/bnaabout", async ({ ack, respond, command }) => {
    await ack();
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeString = `${days}d ${hours}h ${minutes}m`;

    const randomCommands = commandsList
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .map(cmd => `\`/${cmd}\``)
      .join(", ");

    await respond({
      response_type: "in_channel",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "BnaBot",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "BnaBot is a bot with experimental/random stuff & features developed by BananaJeans.\n\n*Repository:* https://github.com/BananaJeanss/bnabot\n\n*COMMANDS.md:* https://github.com/BananaJeanss/bnabot/blob/main/COMMANDS.md",
          },
          accessory: {
            type: "image",
            image_url:
              "https://github.com/BananaJeanss/bnabot/blob/main/assets/coolerlogo.png?raw=true",
            alt_text: "BnaBot logo",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Random commands:* ${randomCommands || "No commands available"}`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `<@${command.user_id}> | Up since ${uptimeString}` }],
        },
      ],
    });
  });
}
