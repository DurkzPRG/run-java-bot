# Run Java --- Advanced Discord Code Execution Bot

![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![Discord.js](https://img.shields.io/badge/discord.js-v14-blue)
![Judge0](https://img.shields.io/badge/Execution-Judge0-orange)
![Deploy](https://img.shields.io/badge/Deploy-Render-purple)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Status](https://img.shields.io/badge/status-active-success)

Designed for educational servers, programming communities, and
moderation-aware environments.

A production-grade Discord bot that executes Java code securely using
Judge0 and includes an advanced in-memory logging system.
------------------------------------------------------------------------

# Invite Bot link and Support Server
Here is the link to add the bot to your server:
[BotLink](https://discord.com/oauth2/authorize?client_id=1471306586088800381).

Join the bot’s support server if you have any questions:
[BotDiscordServer](https://discord.gg/fqfrxsS5WN).
------------------------------------------------------------------------

# Overview

Run Java is a scalable and production-ready Discord bot that executes
Java code directly inside Discord using slash commands.

Core Capabilities:

-   Inline code execution
-   5-part modal editor for long code
-   stdin (input) support
-   Advanced logging system
-   Admin-level log export
-   Robust interaction error handling
-   Large output auto-file export

Built with:

-   Node.js
-   Discord.js v14
-   Judge0 CE API
-   Render-compatible HTTP health server

------------------------------------------------------------------------

# Commands

## /run

Executes Java code via Judge0.

Options: - lang (required) - code (optional) - input (optional stdin)

If no code is provided, a 5-part modal editor opens automatically.

------------------------------------------------------------------------

## /clear

Deletes 1--100 messages from the current channel.

Requirements: - Bot must have Manage Messages - Messages older than 14
days cannot be deleted

------------------------------------------------------------------------

## /help

Displays an embed with all available commands.

------------------------------------------------------------------------

## /setlogs

Sets the channel where /genlog will send the JSON log file.

Requirements: - Administrator permission

------------------------------------------------------------------------

## /genlog

Generates a .json file containing:

-   Message creations
-   Message edits
-   Message deletions
-   Command usage
-   Modal submissions

Requirements: - Administrator permission - /setlogs must be configured
first

Logs are stored in memory and reset when the bot restarts.

------------------------------------------------------------------------

# Execution Flow

1.  User runs /run
2.  Code collected (inline or modal)
3.  Invisible characters sanitized
4.  Code + stdin encoded to base64
5.  Submission sent to Judge0
6.  Polling system checks status
7.  Output decoded
8.  Response returned (or sent as .txt if too large)

------------------------------------------------------------------------

# Security Model

-   Code execution happens in Judge0 sandbox
-   CPU time limit configurable
-   Wall time limit configurable
-   Memory limit configurable
-   Output size protection
-   Base64 encoding for transport safety
-   Expired interaction handling (Error 10062 safe)
-   Graceful error recovery
-   Logging channel auto-skip to avoid recursion

------------------------------------------------------------------------

# Environment Variables

``` env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID= (optional for guild-only commands)

CPU_TIME_LIMIT=5
WALL_TIME_LIMIT=8
MEMORY_LIMIT=256000

POLL_INTERVAL_MS=700
POLL_MAX_TRIES=60

MAX_EVENTS_PER_GUILD=20000
MAX_CONTENT_CHARS=1000
```

------------------------------------------------------------------------

# Deployment

Compatible with:

-   Render
-   Railway
-   VPS
-   Docker
-   Any Node 18+ environment

Includes health-check server support.

------------------------------------------------------------------------

# Known Limitation

Since the bot uses the public Judge0 service:

-   /run may timeout during congestion
-   Other commands will continue working normally

If /run times out, wait a few minutes and try again.

------------------------------------------------------------------------

# Why This Bot Is Different

Unlike simple Judge0 wrappers, this bot includes:

-   Advanced interaction safety layer
-   Full message lifecycle logging
-   Admin-exportable audit logs
-   Large output auto-file system
-   Modal multi-part editor
-   Configurable runtime limits
-   Production-grade error handling

------------------------------------------------------------------------

# License

MIT License

------------------------------------------------------------------------

# Contribution

Pull requests are welcome.

Feel free to fork, improve, and build on top of this project.
