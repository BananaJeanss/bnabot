<h1>
bnabot

<img align="right" width="128px" height="128px" src="https://raw.githubusercontent.com/BananaJeanss/bnabot/main/assets/coolerlogo.png" />

</h1>

My personal bot for Slack with some random & experimental features

## Features

- A lot of commands (from bnaping to bnaexecute)
- Personal Channel Greeter
- Cron Jobs
- Manifest Verifiction/Updating (untested)

## Commands

| Command           | Description                                                                           |
| :---------------- | :------------------------------------------------------------------------------------ |
| `/bnaabout`       | Displays information about the bot                                                    |
| `/bnanurburgring` | Scrapes and displays the current weather and opening hours for the Nürburgring track. |
| `/bnaping`        | Pong! (also checks ping for a few services)                                           |
| `/bnarateuser`    | Generates a AI compliment or roast based on your Slack profile data.                  |

More commands can be found in the full list at [COMMANDS.md](COMMANDS.md).

## Quick Start

Feel free to fork the repo to turn it into your own bot, or to contribute for whatever reason.

> [!NOTE]
> Some commands run Linux specific stuff, if you're on windows some commands may require WSL.

1. Clone the repo

   ```bash
   git clone https://github.com/BananaJeanss/bnabot.git
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Copy `.env.example` and fill out the fields

   ```bash
   cp .env.example .env
   nano .env
   ```

4. Build build build

   ```bash
   npm run build
   ```

5. Start up the bot

   ```bash
   npm run start
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
