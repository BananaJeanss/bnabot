import { App } from "@slack/bolt";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const AllowedUser = process.env.SLACK_USERID;

const exec = promisify(execCallback);

const outputCache = new Map<string, string>();

// Helper to truncate long outputs to avoid Slack API errors
function truncate(str: string, maxLength: number = 2000): string {
  str = str.replace(/`/g, "'");
  if (str.length <= maxLength) return str;
  return (
    str.slice(0, maxLength) +
    `\n... (truncated ${str.length - maxLength} chars)`
  );
}

export default function bnaexecute(app: App) {
  app.command("/bnaexecute", async ({ ack, respond, command, client }) => {
    await ack();

    if (!AllowedUser) {
      await respond({
        response_type: "ephemeral",
        text: ".env SLACK_USERID not set properly.",
      });
      return;
    }

    if (command.user_id !== AllowedUser) {
      await respond({
        response_type: "ephemeral",
        text: "Not Authorized. This action has been logged.", // scare the person lmao
      });
      console.log(
        `[bnaexec] Unauthorized /bnaexecute attempt by user ${command.user_name} (${command.user_id})`
      );
      return;
    }

    const codeToExecute = command.text;
    if (!codeToExecute || codeToExecute.trim() === "") {
      await respond({
        response_type: "ephemeral",
        text: "No command to execute supplied.",
      });
    }

    try {
      const { stdout, stderr } = await exec(codeToExecute, {
        timeout: 10000,
        maxBuffer: 1024 * 1024 * 5,
      });

      let responseText = "";
      console.log(
        `[bnaexec] Executed command (${command.user_name} | ${command.user_id}): ${codeToExecute}`
      );

      if (stdout) {
        responseText += `*Output:*\n\`\`\`${truncate(stdout)}\`\`\`\n`;
      }
      if (stderr) {
        responseText += `*Error:*\n\`\`\`${truncate(stderr)}\`\`\``;
      }
      if (!responseText && !stdout && !stderr) {
        responseText = "Command executed successfully with no output.";
      }

      const blocks: any[] = [];
      if (stdout) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Output:*\n\`\`\`${truncate(stdout)}\`\`\``,
          },
        });
      }
      if (stderr) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Error:*\n\`\`\`${truncate(stderr)}\`\`\``,
          },
        });
      }
      if (blocks.length === 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Command executed successfully with no output.",
          },
        });
      }

      const cacheId =
        Date.now().toString() + Math.random().toString(36).substring(7);
      outputCache.set(cacheId, responseText);
      setTimeout(() => outputCache.delete(cacheId), 10 * 60 * 1000);

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Share to Channel",
            },
            value: cacheId,
            action_id: "share_exec_output",
          },
        ],
      });

      if (responseText) {
        await respond({
          response_type: "ephemeral",
          text: responseText,
          blocks: blocks,
        });
      }
    } catch (error: any) {
      let errorText = `*Execution Failed:*\n\`\`\`${
        error.message || error
      }\`\`\``;

      if (error.stdout) {
        errorText += `\n*Partial Output:*\n\`\`\`${truncate(
          error.stdout
        )}\`\`\``;
      }
      if (error.stderr) {
        errorText += `\n*Partial Error:*\n\`\`\`${truncate(
          error.stderr
        )}\`\`\``;
      }

      await respond({
        response_type: "ephemeral",
        text: errorText,
      });
    }
  });

  app.action("share_exec_output", async ({ ack, body, client, respond }) => {
    await ack();

    // @ts-ignore
    const action = body.actions[0];
    const cacheId = action.value;
    const text = outputCache.get(cacheId);

    if (body.user?.id !== AllowedUser) {
      await respond({
        text: "Not Authorized to share this output.",
        response_type: "ephemeral",
      });
    }

    if (text && body.channel?.id && body.user?.id) {
      await client.chat.postMessage({
        channel: body.channel.id,
        text: `exec Output shared by <@${body.user.id}>:\n${text}`,
      });

      await respond({
        text: "Output shared to channel!",
        replace_original: true,
        response_type: "ephemeral",
      });
    } else {
      await respond({
        text: "Output expired or not found.",
        response_type: "ephemeral",
      });
    }
  });
}
