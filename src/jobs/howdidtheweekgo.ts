import { App } from "@slack/bolt";
import nodeCron from "node-cron";

const PERSONALCHANNEL_ID = process.env.PERSONALCHANNEL_ID;
const SLACK_USERID = process.env.SLACK_USERID;

export default function howdidtheweekgo(app: App) {
  if (!PERSONALCHANNEL_ID || !SLACK_USERID) {
    console.error(
      "Missing PERSONALCHANNEL_ID or SLACK_USERID environment variables."
    );
    return;
  }

  nodeCron.schedule(
    "0 20 * * 0",
    async () => {
      try {
        await app.client.chat.postMessage({
          channel: PERSONALCHANNEL_ID,
          text: `<@${SLACK_USERID}>, how did the week go?`,
        });
      } catch (err) {
        console.error("Error posting weekly message: ", err);
      }
    },
    {
      timezone: "Europe/Tallinn",
    }
  );
}
