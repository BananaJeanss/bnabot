import { App } from "@slack/bolt";

const PERSONALCHANNEL_ID = process.env.PERSONALCHANNEL_ID;

export default function bnajoinpersonal(app: App) {
  app.command("/bnajoinpersonal", async ({ ack, respond, command }) => {
    await ack();

    const userId = command.user_id;
    try {
      await app.client.conversations.invite({
        channel: PERSONALCHANNEL_ID || "",
        users: userId,
      });
      respond({
        response_type: "ephemeral",
        text: `Added successfully to <#${PERSONALCHANNEL_ID}>.`,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "data" in error &&
        error.data &&
        typeof error.data === "object" &&
        "error" in error.data
      ) {
        if (error.data.error === "already_in_channel") {
          await respond({
            response_type: "ephemeral",
            text: `You are already in <#${PERSONALCHANNEL_ID}>. (already_in_channel)`,
          });
        } else if (error.data.error === "not_in_channel") {
          await respond({
            response_type: "ephemeral",
            text: `I need to be in <#${PERSONALCHANNEL_ID}> to add you. (not_in_channel)`,
          });
        } else {
          await respond(
            `Failed to add you to the personal channel: ${error.data.error}`
          );
        }
      } else {
        await respond(`Failed to add you to the personal channel: ${error}`);
        return;
      }
    }
  });
}
