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
        .setDescription("Cole o código (curto). Se vazio, abre o editor (Modal) pra código grande.")
        .setRequired(false)
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registrando comandos (global)...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("Comandos registrados!");
  } catch (err) {
    console.error("Erro registrando comandos:", err);
  }
})();
