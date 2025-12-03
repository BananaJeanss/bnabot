import { App } from "@slack/bolt";

const PERSONALCHANNEL_ID = process.env.PERSONALCHANNEL_ID;
const SLACKUSER_ID = process.env.SLACKUSER_ID;

export default function newPCmember(app: App) {
  app.event("member_joined_channel", async ({ event, client }) => {
    try {
      if (!PERSONALCHANNEL_ID) {
        console.error("PERSONALCHANNEL_ID is not set.");
        return;
      }

      if (event.channel !== PERSONALCHANNEL_ID) {
        return;
      }

      if (event.user === (await client.auth.test()).user_id) return;

      const result = await client.conversations.info({
        channel: event.channel,
      });

      const memberCount = result.channel?.num_members;
      const welcomeText = `Welcome to my personal channel, <@${event.user}>! You're the ${memberCount}th member!`;

      await client.chat.postMessage({
        channel: event.channel,
        text: welcomeText,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: welcomeText,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Ping BananaJeans",
                },
                action_id: "ping_bananajeans",
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error("Error handling new personal channel member event:", error);
    }
  });

  // for the button above
  app.action("ping_bananajeans", async ({ ack, body, client }) => {
    await ack();

    const channelId = body.channel?.id;

    if (!channelId || channelId !== PERSONALCHANNEL_ID) {
      return;
    }

    await client.chat.postMessage({
      channel: PERSONALCHANNEL_ID,
      text: `<@${SLACKUSER_ID}>, ping pong!`,
    });

    console.log(`${body.user.id} clicked on ping bananajeans`);

    // @ts-ignore - message exists on block_actions payload
    const message = body.message;

    if (message) {
      try {
        await client.chat.update({
          channel: channelId,
          ts: message.ts,
          text: message.text || "Welcome!",
          blocks: [],
        });
      } catch (error) {
        console.error("Failed to remove button:", error);
      }
    }
  });
}
