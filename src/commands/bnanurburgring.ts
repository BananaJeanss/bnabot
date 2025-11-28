import { fetchCurrentWeatherApi } from "#utilities/weatherapi.js";
import { App } from "@slack/bolt";
import * as cheerio from "cheerio";

export default function bnanurburgring(app: App) {
  app.command("/bnanurburgring", async ({ ack, respond, command }) => {
    await ack();

    const html = await fetch(
      "https://nuerburgring.de/open-hours?locale=en"
    ).then((r) => r.text());

    const $ = cheerio.load(html);

    const weather = await fetchCurrentWeatherApi("Nürburg, Rhineland-Palatinate, Germany").then((data) => {
        return `${data.current.temp_c}°C, ${data.current.condition.text}, Humidity: ${data.current.humidity}%, Wind: ${data.current.wind_kph} kph`;
    });

    const sections: { title: string; items: string[] }[] = [];

    // Each category is: <h3>Category name</h3><section class="events__date">...</section>
    $("h3 + section.events__date").each((_, sectionEl) => {
      const $section = $(sectionEl);
      const title = $section.prev("h3").text().trim();

      const skip = ["Shops & Showrooms", "Hotel & Gastronomie"];
      if (skip.includes(title)) return; // ignore these sections

      const items: string[] = [];

      $section.find("article.events-inline").each((_, article) => {
        const name = $(article).find(".events-inline__title").text().trim();

        let hours = $(article)
          .find(".events-inline__time")
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\u00A0/g, " ")
          .replace(/\s*–\s*/g, " – ")
          .replace(/\s+/g, " ");

        if (!name) return; // skip junk rows
        if (!hours) hours = "No info";

        items.push(`• *${name}*: ${hours}`);
      });

      sections.push({ title, items });
    });

    const formatted = sections
      .map((s) => {
        const body = s.items.length > 0 ? s.items.join("\n") : "_No entries_";
        return `*${s.title}*\n${body}`;
      })
      .join("\n\n");

    if (!formatted || formatted.trim().length === 0) {
      await respond("Could not fetch opening hours at this time.");
      return;
    }

    await respond({
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "Nürburgring Data & Opening Hours",
                }
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: `${weather}`,
                    }
                ]
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `${formatted}`,
                },
                accessory: {
                    type: "image",
                    "image_url": `https://bunny.cdn-cft.com/docs/img/gross/17567/nuerburgring-sticker-nuerburgring-logo-12cm-black.jpg`,
                    "alt_text": "Nürburgring Logo"
                }
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: `<@${command.user_id}> | Scraped from https://nuerburgring.de/open-hours?locale=en`
                    }
                ]
            }
        ],
        response_type: "in_channel"
    });
  });
}
