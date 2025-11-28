const HACKCLUB_API_KEY = process.env.HACKCLUB_API_KEY;
const HACKCLUB_API_MODEL = process.env.HACKCLUB_API_MODEL;

export default async function SendHCAIPrompt(prompt: string, model?: string) {
    try {
        const response = await fetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
            method: "POST",
            signal: AbortSignal.timeout(30000), // 30 sec should be enough
            headers: {
                "Authorization": `Bearer ${HACKCLUB_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model || HACKCLUB_API_MODEL,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        })
        if (!response.ok) {
            console.error("HackClub AI returned an error:", response.status, await response.text());
            return null;
        }
        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        return data.choices[0]?.message.content ?? null;
    } catch (error) {
        console.error("Error sending prompt to HackClub AI:", error);
        return null;
    }
}