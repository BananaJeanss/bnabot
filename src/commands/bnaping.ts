import type { App } from "@slack/bolt";

async function getUrlPing(url: string) {
  const start = performance.now();
  try {
    await fetch(url, { signal: AbortSignal.timeout(5000) });
    const end = performance.now();
    return `${(end - start).toFixed(0)}`;
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      return "❌ Timeout (5000ms)";
    }
    return "❌ Error";
  }
}

export default function pingCommand(app: App) {
  app.command("/bnaping", async ({ ack, respond, command }) => {
    await ack();
    const googlePing = await getUrlPing("https://google.com");
    const iRacingPing = await getUrlPing("https://status.iracing.com/");
    const bnajnsUptimeKuma = await getUrlPing(
      "https://uptime.bnajns.hackclub.app/"
    );

    await respond({
      response_type: "in_channel",
      text: `Pong! <@${command.user_id}>\nGoogle: ${googlePing}ms\niRacing: ${iRacingPing}ms\nBnaJns Uptime Kuma: ${bnajnsUptimeKuma}ms`,
    });
  });
}
