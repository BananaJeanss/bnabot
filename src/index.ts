import { App } from "@slack/bolt";
import { configDotenv } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

configDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET || !SLACK_APP_TOKEN) {
  throw new Error(
    "SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET and SLACK_APP_TOKEN must be set in environment variables"
  );
}

const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  appToken: SLACK_APP_TOKEN,
  socketMode: true
});

const commandsPath = path.join(__dirname, "commands");
const commandsFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));
let commandCount = 0;

for (const file of commandsFiles) {
  const module = await import(`./commands/${file}`);
  const register = module.default;
  if (typeof register === "function") {
    try {
      register(app);
      commandCount++;
    } catch (error) {
      console.error(`Error registering command from file ${file}:`, error);
    }
  }
}
console.log(`Loaded ${commandCount} commands!`);

(async () => {
  await app.start(process.env.PORT || 3000);
  const date = (new Date()).toLocaleString();
  console.log(`💤 bnabot is running, it is ${date}`);
})();

