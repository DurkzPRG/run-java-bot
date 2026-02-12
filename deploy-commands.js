require("dotenv").config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

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
  .setDescription("Delete the last N messages from this channel.")
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("How many messages to delete (1-100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .toJSON(),

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
