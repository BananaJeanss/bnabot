import { App } from "@slack/bolt";
import SendHCAIPrompt from "#utilities/hackclubai.js";

const COMPLIMENTPROMPT = `
You are a chaotic-good but positive Hack Club bot with high-energy, playful, internet-brain humor.
You are given a Slack user's profile data.
Your job: write a fun, lively, specific compliment for them based ONLY on the info in their profile.

Tone:
- Punchy, upbeat, and entertaining.
- Goofy but wholesome.
- Feel free to be dramatic, overly impressed, or mildly unhinged in a *friendly* way.
- Think "hype friend who drank one too many energy drinks."

Style guidelines:
- Focus on profile details (status, text, custom fields, favorite things, vibes).
- Be specific; avoid generic positivity.
- Short but full of flavor: 4-6 sentences max.
- Use friendly exaggeration and fun imagery.
- Speak directly to the user as “you.”
- Absolutely NO serious themes.

Do NOT:
- Do not flirt, sexualize, or comment on appearance.
- Do not reference age, race, religion, nationality, politics, or sensitive traits.
- Do not include slurs, insults, or negativity.

Slack user profile:
{{USER_PROFILE}}

Now write the compliment in this style.

`;

const ROASTPROMPT = `
You are a chaotic-good roast bot in the Hack Club Slack.
Your job: create a playful, lighthearted roast of a Slack user based ONLY on their profile info.

Tone:
- Fun, silly, slightly unhinged.
- Harmless teasing, never mean.
- "Okay buddy…" energy.
- Dramatic exaggeration, meme-style humor, friendly clowning.

Style guidelines:
- Make jokes about low-stakes things (status text, emojis, titles, custom fields, weird answers, or overall vibe).
- Keep it breezy, punchy, and entertaining: 4-6 sentences max.
- Add a subtle “we love you tho” flavor baked into the tone.
- No existential crisis vibes unless it's clearly comedic.

Do NOT:
- No slurs or anything involving race, religion, politics, sexuality, gender, or sensitive topics.
- No bullying, personal attacks, or anything that could legit hurt feelings.
- No sexual jokes or flirting.
- No references to physical appearance or body.
- No threats or harmful suggestions.
- Keep everything low-stakes and just goofy.

Slack user profile:
{{USER_PROFILE}}

Now write the roast in this tone.
`;

export default function rateuser(app: App) {
  app.command("/bnarateuser", async ({ ack, respond, command, client }) => {
    await ack();

    const argument = command.text.trim().toLowerCase();

    if (argument !== "compliment" && argument !== "roast") {
      await respond({
        text: "Please specify either 'compliment' or 'roast' (e.g., `/bnarateuser roast`)",
        response_type: "ephemeral",
      });
      return;
    }

    await respond({
      text: "Thinking... :thinking_face:",
      response_type: "in_channel",
    });

    // gather user's slack profile info
    let userData: string = "";
    try {
      const result = await client.users.profile.get({
        user: command.user_id,
      });

      const profile = result.profile;

      if (!profile) {
        await respond("Could not fetch user profile.");
        return;
      }

      userData += `Name: ${profile.real_name || "N/A"}\n`;
      userData += `Name Pronounciation: ${
        profile.real_name_normalized || "N/A"
      }\n`;
      userData += `Display Name: ${profile.display_name || "N/A"}\n`;
      userData += `Pronouns: ${profile.pronouns || "N/A"}\n`;
      userData += `Title: ${profile.title || "N/A"}\n`;

      // Fetch team profile definitions to resolve field IDs to names
      let customFieldsOutput = "N/A";
      if (profile.fields) {
        try {
          // We need team.profile:read scope for this
          const teamProfile = await client.team.profile.get({});
          const fieldMap = new Map<string, string>();

          if (teamProfile.profile?.fields) {
            for (const field of teamProfile.profile.fields) {
              if (field.id && field.label) {
                fieldMap.set(field.id, field.label);
              }
            }
          }

          const fieldsArray = [];
          for (const [id, data] of Object.entries(profile.fields)) {
            const label = fieldMap.get(id) || id; // Fallback to ID if label not found
            fieldsArray.push(`${label}: ${data.value}`);
          }

          if (fieldsArray.length > 0) {
            customFieldsOutput = fieldsArray.join("\n");
          }
        } catch (err) {
          console.error("Failed to fetch team profile fields:", err);
          // Fallback to raw JSON if we can't get definitions
          customFieldsOutput = JSON.stringify(profile.fields);
        }
      }

      userData += `Custom Fields:\n${customFieldsOutput}\n`;

      userData += `Status Text: ${profile.status_emoji || "N/A Emoji"} ${
        profile.status_text || "N/A Text"
      }\n`;
    } catch (error) {
      console.error(error);
      await respond("An error occurred while fetching the profile.");
      return;
    }

    // Select the correct prompt based on the argument
    const promptTemplate =
      argument === "compliment" ? COMPLIMENTPROMPT : ROASTPROMPT;

    const finalizedPrompt = promptTemplate.replace(
      "{{USER_PROFILE}}",
      userData
    );
    console.log("Finalized Prompt:", finalizedPrompt);

    const AIAnswer = await SendHCAIPrompt(finalizedPrompt);

    if (!AIAnswer) {
      await respond({
        text: `Sorry, I couldn't generate a ${argument} at this time.`,
        response_type: "in_channel",
      });
    } else {
      await respond({
        text: `<@${command.user_id}>\n${AIAnswer}`,
        response_type: "in_channel",
      });
    }
  });
}
