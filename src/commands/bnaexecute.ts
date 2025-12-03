import { App } from "@slack/bolt";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const AllowedUser = process.env.SLACK_USERID;

const exec = promisify(execCallback);

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
      if (responseText) {
        await respond({
          response_type: "ephemeral",
          text: responseText,
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
}
