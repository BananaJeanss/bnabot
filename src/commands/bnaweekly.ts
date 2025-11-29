import { App } from "@slack/bolt";

const HACKATIME_API_KEY = process.env.HACKATIME_API_KEY;
const SLACK_USERID = process.env.SLACK_USERID;
const GITHUB_TOKEN = process.env.GITHUB_WEEKLYTOKEN
const GITHUB_USERNAME = process.env.GITHUB_WEEKLYUSERNAME;
const STEAM_WEEKLYKEY = process.env.STEAM_WEEKLYKEY;
const STEAM_STEAMID = process.env.STEAM_STEAMID;

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

interface GitHubContributionResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: {
            contributionDays: {
              contributionCount: number;
              date: string;
            }[];
          }[];
        };
      };
    };
  };
}

async function getGitHubWeeklyContributions(): Promise<number> {
  if (!GITHUB_TOKEN || !GITHUB_USERNAME) return 0;

  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const query = `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
          }
        }
      }
    }
  `;

  const variables = {
    username: GITHUB_USERNAME,
    from: sevenDaysAgo.toISOString(),
    to: now.toISOString(),
  };

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) return 0;

    const data = (await res.json()) as GitHubContributionResponse;
    return (
      data.data?.user?.contributionsCollection?.contributionCalendar
        ?.totalContributions || 0
    );
  } catch (error) {
    console.error("Error fetching GitHub contributions:", error);
    return 0;
  }
}

interface SteamResponse {
  response?: {
    games?: {
      playtime_2weeks?: number;
    }[];
  };
}

async function get2WeeklySteamPlaytime(): Promise<string> {
  if (!STEAM_WEEKLYKEY || !STEAM_STEAMID) {
    console.error("Steam API key or Steam ID is missing.");
    return "0h 0m";
  }

  const steam2WeeklyUrl = `http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_WEEKLYKEY}&steamid=${STEAM_STEAMID}&format=json`
  
  try {
    const steamresponse = await fetch(steam2WeeklyUrl);
    
    if (!steamresponse.ok) {
      console.error(`Steam API returned error: ${steamresponse.status} ${steamresponse.statusText}`);

      try {
        const text = await steamresponse.text();
        console.error(`Steam API response body: ${text}`);
      } catch (e) {
        console.error("Could not read Steam API error response body.");
      }
      return "0h 0m";
    }

    const steamdata = await steamresponse.json() as SteamResponse;
    let totalMinutes = 0;

    if (steamdata && steamdata.response && steamdata.response.games) {
      const games = steamdata.response.games;
      for (const game of games) {
        if (game.playtime_2weeks) {
          totalMinutes += game.playtime_2weeks;
        }
      }
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  } catch (error) {
    console.error("Error fetching Steam playtime:", error);
    return "0h 0m";
  }
}

export default function bnaweekly(app: App) {
  app.command("/bnaweekly", async ({ ack, respond, command, client }) => {
    await ack();

    const weeklyHackTime = await getWeeklyTime();
    const weeklyGitHub = await getGitHubWeeklyContributions();
    const userInfo = await client.users.info({ user: SLACK_USERID! });
    const SlackPFPUrl = userInfo.user?.profile?.image_192 || userInfo.user?.profile?.image_original || "";
    const steamPlaytime = await get2WeeklySteamPlaytime();

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
            text: `*Hackatime:* ${weeklyHackTime}\n*GitHub Contributions:* ${weeklyGitHub}\n*Steam Playtime (2 weeks):* ${steamPlaytime}`,
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
                    text: `<@${command.user_id}>`
                }
            ]
        }
      ],
    });
  });
}
