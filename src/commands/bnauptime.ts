import { App } from "@slack/bolt";

const UPTIMEKUMA_METRICSURL = process.env.UPTIMEKUMA_METRICSURL || "";
const UPTIMEKUMA_USERNAME = process.env.UPTIMEKUMA_USERNAME || "";
const UPTIMEKUMA_PASSWORD = process.env.UPTIMEKUMA_PASSWORD || "";

interface MetricData {
  id: string;
  name: string;
  status?: number;
  responseTime?: number;
  certValid?: number;
  certDays?: number;
}

export default function bnauptime(app: App) {
  app.command("/bnauptime", async ({ ack, respond, command }) => {
    await ack();

    try {
      let kumaresponse = await fetch(UPTIMEKUMA_METRICSURL, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              UPTIMEKUMA_USERNAME + ":" + UPTIMEKUMA_PASSWORD
            ).toString("base64"),
        },
      });

      if (!kumaresponse.ok) {
        await respond({
          response_type: "ephemeral",
          text: `Failed to fetch Uptime Kuma metrics`,
        });
        return;
      }

      const kumatext = await kumaresponse.text();
      const monitors: Record<string, MetricData> = {};

      const lines = kumatext.split("\n");
      for (const line of lines) {
        if (line.startsWith("#") || !line.trim()) continue;

        // Match metric lines: metric_name{labels} value
        const match = line.match(/^(\w+)\{(.+)\} (.+)$/);
        if (match) {
          const [, metricName, labelsStr, valueStr] = match;
          const value = parseFloat(valueStr || "0");

          // Extract monitor_id and monitor_name
          if (!labelsStr) continue;
          const idMatch = labelsStr.match(/monitor_id="([^"]+)"/);
          const nameMatch = labelsStr.match(/monitor_name="([^"]+)"/);

          if (idMatch && nameMatch) {
            const id = idMatch[1];
            const name = nameMatch[1];

            if (!id || !name) continue;

            if (!monitors[id]) {
              monitors[id] = { id, name };
            }

            if (metricName === "monitor_status" && monitors[id])
              monitors[id].status = value;
            if (metricName === "monitor_response_time" && monitors[id])
              monitors[id].responseTime = value;
            if (metricName === "monitor_cert_is_valid" && monitors[id])
              monitors[id].certValid = value;
            if (metricName === "monitor_cert_days_remaining" && monitors[id])
              monitors[id].certDays = value;
          }
        }
      }

      const blocks: any[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Uptime Kuma Metrics",
          },
        },
        {
          type: "divider",
        },
      ];

      let sectionText = "";

      for (const id in monitors) {
        const m = monitors[id];
        if (!m) continue;

        let statusIcon = "❓";
        if (m.status === 1) statusIcon = "🟢";
        else if (m.status === 0) statusIcon = "🔴";
        else if (m.status === 2) statusIcon = "🟡";
        else if (m.status === 3) statusIcon = "🔧";

        let detailsParts: string[] = [];

        if (m.responseTime !== undefined)
          detailsParts.push(`${m.responseTime}ms`);

        if (m.certDays !== undefined) {
          detailsParts.push(`Cert: ${m.certDays}d`);
        } else if (m.certValid !== undefined) {
          detailsParts.push(`Cert: ${m.certValid === 1 ? "Valid" : "Invalid"}`);
        }

        sectionText += `${statusIcon} *${m.name}* ${detailsParts.join(
          " | "
        )}\n`;
      }

      if (sectionText) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: sectionText,
          },
          accessory: {
            type: "image",
            image_url:
              "https://github.com/louislam/uptime-kuma/blob/master/public/icon.png?raw=true",
            alt_text: "Uptime Kuma Logo",
          },
        });
      }

      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<@${command.user_id}>`,
          },
        ],
      });

      await respond({
        response_type: "in_channel",
        blocks: blocks,
      });
    } catch (err) {
      console.error("Failed to fetch Uptime Kuma metrics:", err);
      await respond({
        response_type: "ephemeral",
        text: `Failed to fetch Uptime Kuma metrics: ${err}`,
      });
    }
  });
}
