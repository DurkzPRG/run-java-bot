#Run Java — Discord Code Execution Bot

![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![Discord.js](https://img.shields.io/badge/discord.js-v14-blue)
![Judge0](https://img.shields.io/badge/Execution-Judge0-orange)
![Deploy](https://img.shields.io/badge/Deploy-Render-purple)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Status](https://img.shields.io/badge/status-active-success)
![Maintenance](https://img.shields.io/badge/maintained-yes-brightgreen)
![PRs](https://img.shields.io/badge/PRs-welcome-blue)
![Open Source](https://img.shields.io/badge/Open%20Source-Yes-ff69b4)
![Made With](https://img.shields.io/badge/Made%20with-Node.js-339933?logo=node.js&logoColor=white)

> A production-ready Discord bot that executes Java code in real time using the Judge0 sandbox API.

---

##Overview

**Run Java** is a scalable Discord bot designed to execute Java code directly inside Discord using slash commands.

It supports both short inline execution and large multi-part submissions through a modal editor, ensuring reliability even for extended code blocks.

Built with:

- Node.js
- Discord.js v14
- Judge0 CE API
- Render deployment compatibility

---

##Features

- `/run` slash command
- Java (OpenJDK — Judge0 ID 62)
- 5-part modal editor (supports long code)
- Automatic base64 encoding for safe transport
- Execution polling system with timeout control
- Automatic large output export as `.txt`
- Graceful handling of expired Discord interactions (Error 10062
- HTTP health-check server for Render

---

##Architecture

###Execution Flow

1. User triggers `/run`
2. Code is collected (inline or via modal)
3. Source is base64 encoded
4. Sent to Judge0 CE
5. Bot polls for completion
6. Output is formatted and returned
7. Large output is automatically sent as file

---

##Security Model

-Code execution occurs inside Judge0 sandbox
-Strict CPU, memory, and wall-time limit
-Base64 encoding for integrity
-Safe handling of expired Discord interactions
-Output length protection

---

#License

MIT License

---

#Contribution

-Pull requests are welcome.

-Feel free to fork, improve, and build on top of this project.
