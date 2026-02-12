require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("run")
    .setDescription("Executa um código e retorna o resultado (ex: Java).")
    .addStringOption((opt) =>
      opt
        .setName("lang")
        .setDescription("Linguagem")
        .setRequired(true)
        .addChoices({ name: "Java", value: "java" })
    )
    .addStringOption((opt) =>
      opt
        .setName("code")
        .setDescription("Cole o código (curto). Se vazio, abre o editor (Modal).")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("input")
        .setDescription("Entrada (stdin) opcional para o programa.")
        .setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Apaga as últimas N mensagens do canal (até 100).")
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Quantas mensagens apagar (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!clientId) throw new Error("CLIENT_ID não definido no .env");

    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);

    console.log(guildId ? "Registrando comandos (guild)..." : "Registrando comandos (global)...");
    await rest.put(route, { body: commands });
    console.log("Comandos registrados!");
  } catch (err) {
    console.error("Erro registrando comandos:", err);
  }
})();
