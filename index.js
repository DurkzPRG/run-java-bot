require("dotenv").config();
require("./server");

const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const JUDGE0_BASE = "https://ce.judge0.com";

const LANG = { java: 62 };

const CPU_TIME_LIMIT = Number(process.env.CPU_TIME_LIMIT || 5);
const WALL_TIME_LIMIT = Number(process.env.WALL_TIME_LIMIT || 8);
const MEMORY_LIMIT = Number(process.env.MEMORY_LIMIT || 256000);

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 700);
const POLL_MAX_TRIES = Number(process.env.POLL_MAX_TRIES || 60);

const MAX_EVENTS_PER_GUILD = Number(process.env.MAX_EVENTS_PER_GUILD || 20000);
const MAX_CONTENT_CHARS = Number(process.env.MAX_CONTENT_CHARS || 1000);

const logChannelByGuild = new Map();
const eventsByGuild = new Map();

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripCodeFences(s) {
  if (!s) return s;
  const t = s.trim();
  const m = t.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```$/);
  return m ? m[1] : s;
}

function sanitizeInvisible(s) {
  if (!s) return s;
  return s.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function clampInt(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function isUnknownInteraction(err) {
  return err && (err.code === 10062 || err.rawError?.code === 10062);
}

function isAlreadyAcknowledged(err) {
  return err && (err.code === 40060 || err.rawError?.code === 40060);
}

function ensureGuildEvents(guildId) {
  if (!eventsByGuild.has(guildId)) eventsByGuild.set(guildId, []);
  return eventsByGuild.get(guildId);
}

function pushEvent(guildId, evt) {
  const arr = ensureGuildEvents(guildId);
  arr.push(evt);
  if (arr.length > MAX_EVENTS_PER_GUILD) {
    arr.splice(0, arr.length - MAX_EVENTS_PER_GUILD);
  }
}

function clipContent(s) {
  if (s == null) return null;
  const t = String(s);
  return t.length > MAX_CONTENT_CHARS ? t.slice(0, MAX_CONTENT_CHARS) : t;
}

function extractPayloadLogInfo(payload) {
  // payload pode ser string ou objeto
  if (typeof payload === "string") {
    return {
      content: clipContent(payload),
      ephemeral: null,
      embedsCount: 0,
      filesCount: 0,
      componentsCount: 0,
    };
  }

  const content = clipContent(payload?.content ?? null);
  const ephemeral = typeof payload?.ephemeral === "boolean" ? payload.ephemeral : null;

  const embedsCount = Array.isArray(payload?.embeds) ? payload.embeds.length : 0;
  const filesCount = Array.isArray(payload?.files) ? payload.files.length : 0;
  const componentsCount = Array.isArray(payload?.components) ? payload.components.length : 0;

  return { content, ephemeral, embedsCount, filesCount, componentsCount };
}

function pushBotEvent(interaction, extra = {}) {
  const guildId = interaction?.guildId;
  if (!guildId) return;

  pushEvent(guildId, {
    type: "botAction",
    iso: nowIso(),
    ts: Date.now(),
    guildId,
    channelId: interaction.channelId ?? null,
    userId: interaction.user?.id ?? null,
    userTag: interaction.user?.tag ?? null,
    command: typeof interaction?.commandName === "string" ? interaction.commandName : null,
    ...extra,
  });
}

async function safeReply(interaction, payload) {
  try {
    const info = extractPayloadLogInfo(payload);

    if (interaction.deferred) {
      await interaction.editReply(payload);

      pushBotEvent(interaction, {
        action: "editReply_via_safeReply",
        ...info,
      });

      return true;
    }

    if (interaction.replied) {
      await interaction.followUp(payload);

      pushBotEvent(interaction, {
        action: "followUp",
        ...info,
      });

      return true;
    }

    await interaction.reply(payload);

    pushBotEvent(interaction, {
      action: "reply",
      ...info,
    });

    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    if (isAlreadyAcknowledged(err)) return true;
    throw err;
  }
}

async function safeShowModal(interaction, modal) {
  try {
    const okType =
      typeof interaction?.isChatInputCommand === "function" && interaction.isChatInputCommand();
    const okFn = typeof interaction?.showModal === "function";

    if (!okType || !okFn) {
      try {
        await safeReply(interaction, {
          content: "Não consegui abrir o modal aqui. Tente usar o comando novamente.",
          ephemeral: true,
        });
      } catch {}
      return false;
    }

    await interaction.showModal(modal);
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    throw err;
  }
}

async function safeDeferReply(interaction, ephemeral = true) {
  try {
    if (interaction.deferred || interaction.replied) return true;
    await interaction.deferReply({ ephemeral });

    pushBotEvent(interaction, {
      action: "deferReply",
      ephemeral: Boolean(ephemeral),
      content: null,
      embedsCount: 0,
      filesCount: 0,
      componentsCount: 0,
    });

    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    if (isAlreadyAcknowledged(err)) return true;
    throw err;
  }
}

async function safeEditReply(interaction, payload) {
  try {
    await interaction.editReply(payload);

    const info = extractPayloadLogInfo(payload);

    pushBotEvent(interaction, {
      action: "editReply",
      ...info,
    });

    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    throw err;
  }
}

function baseMsgEvent(type, message) {
  return {
    type,
    iso: nowIso(),
    ts: Date.now(),
    guildId: message.guild?.id ?? null,
    channelId: message.channel?.id ?? null,
    channelName: message.channel?.name ?? null,
    messageId: message.id ?? null,
    authorId: message.author?.id ?? null,
    authorTag: message.author?.tag ?? null,
    authorIsBot: Boolean(message.author?.bot),
    content: clipContent(message.content ?? null),
  };
}

function shouldSkipLogging(message) {
  if (!message?.guild) return true;
  const logCh = logChannelByGuild.get(message.guild.id);
  return Boolean(logCh && message.channel?.id === logCh);
}

client.on("messageCreate", (message) => {
  if (shouldSkipLogging(message)) return;
  pushEvent(message.guild.id, baseMsgEvent("messageCreate", message));
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  try {
    if (oldMsg.partial) oldMsg = await oldMsg.fetch().catch(() => oldMsg);
    if (newMsg.partial) newMsg = await newMsg.fetch().catch(() => newMsg);
    if (!newMsg?.guild) return;

    const logCh = logChannelByGuild.get(newMsg.guild.id);
    if (logCh && newMsg.channel?.id === logCh) return;

    const before = oldMsg?.content ?? null;
    const after = newMsg?.content ?? null;
    if (before === after) return;

    const evt = baseMsgEvent("messageUpdate", newMsg);
    evt.before = clipContent(before);
    evt.after = clipContent(after);
    pushEvent(newMsg.guild.id, evt);
  } catch {}
});

client.on("messageDelete", async (message) => {
  try {
    if (message.partial) message = await message.fetch().catch(() => message);
    if (!message?.guild) return;

    const logCh = logChannelByGuild.get(message.guild.id);
    if (logCh && message.channel?.id === logCh) return;

    pushEvent(message.guild.id, baseMsgEvent("messageDelete", message));
  } catch {}
});

async function runOnJudge0(languageId, sourceCode, stdinText) {
  const payload = {
    language_id: languageId,
    source_code: Buffer.from(sourceCode, "utf8").toString("base64"),
    cpu_time_limit: CPU_TIME_LIMIT,
    wall_time_limit: WALL_TIME_LIMIT,
    memory_limit: MEMORY_LIMIT,
  };

  if (stdinText && stdinText.trim()) {
    payload.stdin = Buffer.from(stdinText, "utf8").toString("base64");
  }

  const createRes = await axios.post(
    `${JUDGE0_BASE}/submissions?base64_encoded=true&wait=false`,
    payload
  );

  const token = createRes.data.token;

  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    await sleep(POLL_INTERVAL_MS);
    const res = await axios.get(`${JUDGE0_BASE}/submissions/${token}?base64_encoded=true`);
    const status = res.data.status?.id;
    if (status !== 1 && status !== 2) return res.data;
  }

  throw new Error("Timeout no polling do Judge0.");
}

function decode(value) {
  if (!value) return "";
  return Buffer.from(value, "base64").toString("utf8");
}

function formatOutput(data) {
  const stdout = decode(data.stdout);
  const stderr = decode(data.stderr);
  const compile = decode(data.compile_output);
  const status = data.status?.description ?? "Unknown";

  if (compile) return `Status: ${status}\n\n[compile]\n${compile}`;
  if (stderr) return `Status: ${status}\n\n[stderr]\n${stderr}`;
  if (stdout) return `Status: ${status}\n\n[stdout]\n${stdout}`;
  return `Status: ${status}\n\n(sem saída)`;
}

async function replyOutput(interaction, text) {
  const wrapped = "```txt\n" + text + "\n```";
  if (wrapped.length <= 1900) {
    await safeEditReply(interaction, wrapped);
    return;
  }

  const file = new AttachmentBuilder(Buffer.from(text, "utf8"), { name: "output.txt" });

  await safeEditReply(interaction, {
    content: "Saída grande. Enviado como arquivo:",
    files: [file],
  });
}

function buildRunModal(lang) {
  const modal = new ModalBuilder()
    .setCustomId(`run_modal:${lang}`)
    .setTitle(`Cole seu código (${lang.toUpperCase()})`);

  const field = (id, label) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(4000)
    );

  modal.addComponents(
    field("code1", "Código/Code (part 1/5)"),
    field("code2", "Código/Code (part 2/5)"),
    field("code3", "Código/Code (part 3/5)"),
    field("code4", "Código/Code (part 4/5)"),
    field("code5", "Código/Code (part 5/5)")
  );

  return modal;
}

process.on("unhandledRejection", (reason) => console.error("unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
client.on("error", (err) => console.error("client error:", err));

client.once("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const name = interaction.commandName;

    if (name === "setlogs") {
      if (!interaction.inGuild()) {
        await safeReply(interaction, { content: "Esse comando só funciona em servidores.", ephemeral: true });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await safeReply(interaction, { content: "Apenas administradores podem usar esse comando.", ephemeral: true });
        return;
      }

      const ch = interaction.options.getChannel("channel", true);
      logChannelByGuild.set(interaction.guildId, ch.id);

      await safeReply(interaction, { content: `✅ Canal de logs definido: ${ch}`, ephemeral: true });
      return;
    }

    if (name === "help") {
      const { EmbedBuilder } = require("discord.js");

      const embed = new EmbedBuilder()
        .setTitle("📖 Bot Commands")
        .setDescription("Here are the available commands:")
        .addFields(
          {
            name: "💻 /run",
            value: "Executes code (currently Java) using Judge0.\nYou can paste the code directly or use the modal.",
          },
          {
            name: "🧹 /clear",
            value: "Deletes up to 100 messages from the current channel.\nRequires Manage Messages permission.",
          },
          {
            name: "📝 /setlogs",
            value: "Defines the channel where the bot will send the file generated by /genlog.\nAdministrators only.",
          },
          {
            name: "📦 /genlog",
            value: "Generates a .json file containing the log collected since the bot was started.\nAdministrators only.",
          },
          {
            name: "ℹ️ /help",
            value: "Displays this help message.",
          }
        )
        .setFooter({ text: "The logging system is temporary and resets when the bot restarts." })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }

    if (name === "genlog") {
      if (!interaction.inGuild()) {
        await safeReply(interaction, { content: "Esse comando só funciona em servidores.", ephemeral: true });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await safeReply(interaction, { content: "Apenas administradores podem usar esse comando.", ephemeral: true });
        return;
      }

      const logChannelId = logChannelByGuild.get(interaction.guildId);
      if (!logChannelId) {
        await safeReply(interaction, { content: "❌ Use /setlogs primeiro.", ephemeral: true });
        return;
      }

      const ok = await safeDeferReply(interaction, true);
      if (!ok) return;

      const logCh = interaction.guild.channels.cache.get(logChannelId);
      if (!logCh || typeof logCh.send !== "function") {
        await safeEditReply(interaction, { content: "❌ Não consegui acessar o canal de logs configurado." });
        return;
      }

      const events = ensureGuildEvents(interaction.guildId);

      const messages = events.filter((e) => typeof e?.type === "string" && e.type.startsWith("message"));
      const botActions = events.filter((e) => e?.type === "botAction");
      const otherEvents = events.filter(
        (e) => e && typeof e.type === "string" && !e.type.startsWith("message") && e.type !== "botAction"
      );

      const payload = {
        guildId: interaction.guildId,
        generatedAt: nowIso(),
        generatedBy: { userId: interaction.user.id, userTag: interaction.user.tag },
        counts: {
          totalEvents: events.length,
          messages: messages.length,
          botActions: botActions.length,
          otherEvents: otherEvents.length,
        },
        sections: {
          messages,
          botActions,
          otherEvents,
        },
      };

      const jsonText = JSON.stringify(payload, null, 2);
      const file = new AttachmentBuilder(Buffer.from(jsonText, "utf8"), {
        name: `log-${interaction.guildId}.json`,
      });

      await logCh.send({
        content:
          `📎 Log gerado por <@${interaction.user.id}> • ` +
          `messages: **${messages.length}** • botActions: **${botActions.length}** • total: **${events.length}**`,
        files: [file],
      });

      await safeEditReply(interaction, { content: "✅ Log gerado e enviado." });
      return;
    }

    if (name === "clear") {
      const rawAmount = interaction.options.getInteger("amount");
      const amount = clampInt(rawAmount ?? 5, 1, 100);

      const ok = await safeDeferReply(interaction, true);
      if (!ok) return;

      try {
        if (!interaction.inGuild()) {
          await safeEditReply(interaction, "This command only works in servers.");
          return;
        }

        const channel = interaction.channel;
        if (!channel || typeof channel.bulkDelete !== "function") {
          await safeEditReply(interaction, "I can't access this channel.");
          return;
        }

        const me = interaction.guild.members.me;
        if (!me) {
          await safeEditReply(interaction, "Couldn't resolve bot permissions.");
          return;
        }

        const perms = channel.permissionsFor(me);
        if (!perms || !perms.has(PermissionFlagsBits.ManageMessages)) {
          await safeEditReply(interaction, "Missing permission: Manage Messages.");
          return;
        }

        const deleted = await channel.bulkDelete(amount, true);

        await safeEditReply(
          interaction,
          `Cleared ${deleted.size} message(s). (Older than 14 days can't be deleted.)`
        );
      } catch (err) {
        await safeEditReply(interaction, "Error while deleting messages:\n" + (err?.message || "unknown"));
      }

      return;
    }

    if (name === "run") {
      const lang = interaction.options.getString("lang", true);
      const languageId = LANG[lang];

      if (!languageId) {
        await safeReply(interaction, { content: "Linguagem não suportada.", ephemeral: true });
        return;
      }

      const codeRaw = interaction.options.getString("code", false);
      const inputRaw = interaction.options.getString("input", false);

      if (!codeRaw || !codeRaw.trim()) {
        await safeShowModal(interaction, buildRunModal(lang));
        return;
      }

      const code = sanitizeInvisible(stripCodeFences(codeRaw));
      const stdin = inputRaw ? sanitizeInvisible(inputRaw) : "";

      const ok = await safeDeferReply(interaction, true);
      if (!ok) return;

      try {
        const result = await runOnJudge0(languageId, code, stdin);
        const out = formatOutput(result);
        await replyOutput(interaction, out);
      } catch (err) {
        const details =
          err?.response?.data ? JSON.stringify(err.response.data, null, 2) : (err?.message || "desconhecido");
        await replyOutput(interaction, "Erro ao executar.\n\n" + details);
      }

      return;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("run_modal:")) {
    const lang = interaction.customId.split(":")[1];
    const languageId = LANG[lang];

    if (!languageId) {
      await safeReply(interaction, { content: "Linguagem não suportada.", ephemeral: true });
      return;
    }

    const parts = [
      interaction.fields.getTextInputValue("code1") || "",
      interaction.fields.getTextInputValue("code2") || "",
      interaction.fields.getTextInputValue("code3") || "",
      interaction.fields.getTextInputValue("code4") || "",
      interaction.fields.getTextInputValue("code5") || "",
    ];

    const code = sanitizeInvisible(stripCodeFences(parts.join("\n").trim()));

    if (!code) {
      await safeReply(interaction, { content: "Você não colou nenhum código.", ephemeral: true });
      return;
    }

    const ok = await safeDeferReply(interaction, true);
    if (!ok) return;

    try {
      const result = await runOnJudge0(languageId, code, "");
      const out = formatOutput(result);
      await replyOutput(interaction, out);
    } catch (err) {
      const details =
        err?.response?.data ? JSON.stringify(err.response.data, null, 2) : (err?.message || "desconhecido");
      await replyOutput(interaction, "Erro ao executar.\n\n" + details);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);