require("dotenv").config();
const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Judge0 CE
const JUDGE0_BASE = "https://ce.judge0.com";

// nomes language_id do Judge0
const LANG = {
    java: 62,        // Java (OpenJDK)
};

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function runOnJudge0(languageId, sourceCode) {
    // cria submissão
    const createRes = await axios.post(
        `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`,
        {
            language_id: languageId,
            source_code: sourceCode,
        },
        { timeout: 15000 }
    );

    const token = createRes.data.token;

    // fazendo polling até finalizar
    for (let i = 0; i < 12; i++) {
        await sleep(700);

        const res = await axios.get(
            `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false`,
            { timeout: 15000 }
        );

        const s = res.data.status?.id; // 1/2 = em fila/processando herhe
        if (s !== 1 && s !== 2) return res.data;
    }

    throw new Error("Timeout: demorou muito para executar.");
}

function formatOutput(data) {
    const stdout = (data.stdout ?? "").trim();
    const stderr = (data.stderr ?? "").trim();
    const compile = (data.compile_output ?? "").trim();
    const status = data.status?.description ?? "Unknown";

    if (compile) return `Status: ${status}\n\n[compile]\n${compile}`;
    if (stderr) return `Status: ${status}\n\n[stderr]\n${stderr}`;
    if (stdout) return `Status: ${status}\n\n[stdout]\n${stdout}`;
    return `Status: ${status}\n\n(sem saída)`;
}

client.once("clientReady", () => {
    console.log(`Bot online: ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "run") return;

    const lang = interaction.options.getString("lang", true);
    const code = interaction.options.getString("code", true);

    const languageId = LANG[lang];
    if (!languageId) {
        return interaction.reply({ content: "Linguagem não suportada.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const result = await runOnJudge0(languageId, code);
        const out = formatOutput(result);

        // dc have lenght limits hahahahahhaah
        const safe = out.length > 1800 ? out.slice(0, 1800) + "\n...(cortado)" : out;

        await interaction.editReply("```txt\n" + safe + "\n```");
    } catch (err) {
        const details =
            err?.response?.data ? JSON.stringify(err.response.data, null, 2) : (err.message || "desconhecido");

        console.error("Judge0 error:", details);

        await interaction.editReply(
            "Erro ao executar.\n```json\n" +
            (details.length > 1800 ? details.slice(0, 1800) + "\n...(cortado)" : details) +
            "\n```"
        );
    }
});

client.login(process.env.DISCORD_TOKEN);
