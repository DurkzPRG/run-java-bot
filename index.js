require("dotenv").config();
require("./server");

const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
} = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const JUDGE0_BASE = "https://ce.judge0.com";

const LANG = {
  java: 62,
};

const CPU_TIME_LIMIT = Number(process.env.CPU_TIME_LIMIT || 5);
const WALL_TIME_LIMIT = Number(process.env.WALL_TIME_LIMIT || 8);
const MEMORY_LIMIT = Number(process.env.MEMORY_LIMIT || 256000);

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 700);
const POLL_MAX_TRIES = Number(process.env.POLL_MAX_TRIES || 60);

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

function isUnknownInteraction(err) {
  return err && (err.code === 10062 || err.rawError?.code === 10062);
}

async function safeReply(interaction, payload) {
  try {
    await interaction.reply(payload);
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    throw err;
  }
}

async function safeShowModal(interaction, modal) {
  try {
    const okType = typeof interaction?.isChatInputCommand === "function" && interaction.isChatInputCommand();
    const okFn = typeof interaction?.showModal === "function";

    if (!okType || !okFn) {
      try {
        await safeReply(interaction, {
          content: "Não consegui abrir o modal aqui. Tente usar o comando novamente.",
          ephemeral: true,
        });
      } catch (_) {}
      return false;
    }

    await interaction.showModal(modal);
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    throw err;
  }
}

async function safeDeferReply(interaction) {
  try {
    await interaction.deferReply();
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    throw err;
  }
}

async function safeEditReply(interaction, payload) {
  try {
    await interaction.editReply(payload);
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    throw err;
  }
}

async function runOnJudge0(languageId, sourceCode) {
  const createRes = await axios.post(
    `${JUDGE0_BASE}/submissions?base64_encoded=true&wait=false`,
    {
      language_id: languageId,
      source_code: Buffer.from(sourceCode, "utf8").toString("base64"),
      cpu_time_limit: CPU_TIME_LIMIT,
      wall_time_limit: WALL_TIME_LIMIT,
      memory_limit: MEMORY_LIMIT,
    }
  );

  const token = createRes.data.token;

  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    await sleep(POLL_INTERVAL_MS);

    const res = await axios.get(
      `${JUDGE0_BASE}/submissions/${token}?base64_encoded=true`
    );

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

  const file = new AttachmentBuilder(Buffer.from(text, "utf8"), {
    name: "output.txt",
  });

  await safeEditReply(interaction, {
    content: "Saída grande — enviei como arquivo:",
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
    field("code1", "Código (parte 1/5)"),
    field("code2", "Código (parte 2/5)"),
    field("code3", "Código (parte 3/5)"),
    field("code4", "Código (parte 4/5)"),
    field("code5", "Código (parte 5/5)")
  );

  return modal;
}

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});

client.on("error", (err) => {
  console.error("client error:", err);
});

client.once("clientReady", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "run") {
    const lang = interaction.options.getString("lang", true);
    const languageId = LANG[lang];

    if (!languageId) {
      await safeReply(interaction, { content: "Linguagem não suportada.", ephemeral: true });
      return;
    }

    const codeRaw = interaction.options.getString("code", false);

    if (!codeRaw || !codeRaw.trim()) {
      await safeShowModal(interaction, buildRunModal(lang));
      return;
    }

    let code = stripCodeFences(codeRaw);
    code = sanitizeInvisible(code);

    const ok = await safeDeferReply(interaction);
    if (!ok) return;

    try {
      const result = await runOnJudge0(languageId, code);
      const out = formatOutput(result);
      await replyOutput(interaction, out);
    } catch (err) {
      const details =
        err?.response?.data
          ? JSON.stringify(err.response.data, null, 2)
          : (err?.message || "desconhecido");
      await replyOutput(interaction, "Erro ao executar.\n\n" + details);
    }

    return;
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

    let code = stripCodeFences(parts.join("\n").trim());
    code = sanitizeInvisible(code);

    if (!code) {
      await safeReply(interaction, { content: "Você não colou nenhum código.", ephemeral: true });
      return;
    }

    const ok = await safeDeferReply(interaction);
    if (!ok) return;

    try {
      const result = await runOnJudge0(languageId, code);
      const out = formatOutput(result);
      await replyOutput(interaction, out);
    } catch (err) {
      const details =
        err?.response?.data
          ? JSON.stringify(err.response.data, null, 2)
          : (err?.message || "desconhecido");
      await replyOutput(interaction, "Erro ao executar.\n\n" + details);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
