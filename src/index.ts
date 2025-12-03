import startHealthServer from "#utilities/healthserver.js";
import verifyManifest from "#utilities/verifyManifest.js";
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
  socketMode: true,
});

async function loadModules(folderName: string) {
  const folderPath = path.join(__dirname, folderName);
  if (!fs.existsSync(folderPath)) return;

  const files = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  let count = 0;
  for (const file of files) {
    const module = await import(`./${folderName}/${file}`);
    const register = module.default;
    if (typeof register === "function") {
      try {
        register(app);
        count++;
      } catch (error) {
        console.error(
          `Error registering ${folderName} from file ${file}:`,
          error
        );
      }
    }
  }
  console.log(`Loaded ${count} ${folderName}!`);
}

// load the stuff
await loadModules("commands");
await loadModules("events");
await loadModules("jobs");

(async () => {
  await app.start(process.env.PORT || 3000);

  // verify/update manifest optionally if app config token is set
  // was gonna do this but tokens reset every 12 hours and i cba to do rotating
  // this probably does not work because i kept getting invalid token errors
  if (process.env.SLACK_APP_CONFIG_TOKEN) {
    if (process.env.SLACK_APP_CONFIG_TOKEN.startsWith("xoxe.xoxp-1")) {
      try {
        await verifyManifest(app);
      } catch (error) {
        console.error("Failed to verify manifest:", error);
      }
    } else {
      console.warn(
        "SLACK_APP_CONFIG_TOKEN does not appear to be a valid app config token, skipping manifest verification."
      );
    }
  }

  if (process.env.ENABLE_HEALTHSERVER === "true") {
    try {
      startHealthServer();
    } catch (err) {
      console.error("Failed to start health server:", err);
    }
  }

  console.log(`💤 bnabot is running, it is ${new Date().toLocaleString()}`);
})();
