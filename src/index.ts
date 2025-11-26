import { App } from "@slack/bolt";
import { configDotenv } from "dotenv";

configDotenv();

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  throw new Error("SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET must be set in environment variables");
}

const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
});

(async () => {
  await app.start(process.env.PORT || 3000);
  const date = new Date().toLocaleDateString();
  console.log(`💤 bnabot is running, it is {${date}}`)
});
