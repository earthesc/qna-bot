require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask a question — answered from the server's Notion docs")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Your question")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("qna-setup")
    .setDescription("Link Notion docs to specific roles (admin only)")
    .addStringOption((option) =>
      option
        .setName("notion_ids")
        .setDescription("Comma-separated Notion page or database IDs")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("roles")
        .setDescription("Mention the roles that can access these docs (e.g. @Staff @Admin)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("qna-remove")
    .setDescription("Remove a Notion source by ID (admin only)")
    .addStringOption((option) =>
      option
        .setName("notion_id")
        .setDescription("The Notion page or database ID to remove")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("qna-status")
    .setDescription("Check the bot's configuration for this server"),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: commands,
    });
    console.log("Slash commands registered globally!");
    console.log("Note: Global commands can take up to 1 hour to appear in all servers.");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
})();
