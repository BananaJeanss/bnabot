import { App } from "@slack/bolt";
import { createRequire } from "node:module";

// so that the prettier extension stops whining about "with { type: "json" };"
const require = createRequire(import.meta.url);
const expectedManifest = require("../../manifest.json");

const SLACK_APP_ID = process.env.SLACK_APP_ID;
const SLACK_APP_CONFIG_TOKEN = process.env.SLACK_APP_CONFIG_TOKEN;


export default async function verifyManifest(app: App) {
    const result = await app.client.apps.manifest.export({
        app_id: SLACK_APP_ID || "",
        token: SLACK_APP_CONFIG_TOKEN || "",
    })

    const currentManifest = result.manifest;

    if (JSON.stringify(currentManifest) !== JSON.stringify(expectedManifest)) {
        console.error("Manifest verification failed, updating app manifest to repo one.")
        await app.client.apps.manifest.update({
            app_id: SLACK_APP_ID || "",
            token: SLACK_APP_CONFIG_TOKEN || "",
            manifest: expectedManifest as any,
        });
    }
}