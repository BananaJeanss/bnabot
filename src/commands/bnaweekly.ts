import { App } from "@slack/bolt";

const HACKATIME_API_KEY = process.env.HACKATIME_API_KEY;
const SLACK_USERID = process.env.SLACK_USERID;

interface Heartbeat {
  time: number;
  [key: string]: any;
}

interface HeartbeatResponse {
  heartbeats: Heartbeat[];
}

async function getWeeklyTime(): Promise<string> {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  const start = formatDate(sevenDaysAgo);
  const end = formatDate(now);

  let allBeats: Heartbeat[] = [];
  let page = 1;
  const seenIds = new Set<string>();

  while (true) {
    const res = await fetch(
      `https://hackatime.hackclub.com/api/v1/my/heartbeats?start=${start}&end=${end}&limit=1000&page=${page}`,
      {
        headers: { Authorization: `Bearer ${HACKATIME_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) break;

    const data = (await res.json()) as HeartbeatResponse;
    const beats = data.heartbeats || [];

    if (beats.length === 0) break;

    let newBeats = 0;
    for (const beat of beats) {
      const id = beat.id ? String(beat.id) : String(beat.time);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allBeats.push(beat);
        newBeats++;
      }
    }

    if (newBeats === 0) break;
    page++;
    if (page > 100) break;
  }

  const beats = allBeats;

  if (beats.length < 2) {
    return "00h 00m";
  }

  beats.sort((a: Heartbeat, b: Heartbeat) => a.time - b.time);

  let total = 0;

  for (let i = 0; i < beats.length - 1; i++) {
    const current = beats[i];
    const next = beats[i + 1];

    if (!current || !next) continue;

    const dt = next.time - current.time;

    if (dt > 0 && dt <= 120) total += dt;
  }

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  return `${hours.toString().padStart(2, "0")}h ${minutes
    .toString()
    .padStart(2, "0")}m`;
}



export default function bnaweekly(app: App) {
  app.command("/bnaweekly", async ({ ack, respond, command, client }) => {
    await ack();

    const weeklyHackTime = await getWeeklyTime();
    const userInfo = await client.users.info({ user: SLACK_USERID! });
    const SlackPFPUrl = userInfo.user?.profile?.image_192 || userInfo.user?.profile?.image_original || "";

    await respond({
      response_type: "in_channel",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "BananaJeans's Weekly Stats",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Hackatime:* ${weeklyHackTime}`,
          },
          accessory: {
            type: "image",
            alt_text: "Profile Pic",
            image_url: SlackPFPUrl
          }
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `<@${command.user_id}`
                }
            ]
        }
      ],
    });
  });
}
