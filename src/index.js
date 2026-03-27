require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { fetchAllContent } = require("./notion");
const { askClaude } = require("./claude");
const { getServerConfig, setServerConfig } = require("./config");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log("Bot is online as " + client.user.tag);
  console.log("Serving " + client.guilds.cache.size + " server(s)");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, guild } = interaction;

  if (commandName === "ask") {
    const question = interaction.options.getString("question");
    const config = getServerConfig(guildId);

    if (!config || !config.notionIds.length) {
      await interaction.reply({
        content: "This server hasn't been set up yet. An admin needs to run /qna-setup first.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const docsContent = await fetchAllContent(config.notionIds);

      if (!docsContent.trim()) {
        await interaction.editReply("No content found in the configured Notion pages.");
        return;
      }

      const answer = await askClaude(
        question,
        docsContent,
        config.name || guild?.name || "this server"
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Answer")
        .addFields({ name: "Question", value: question.slice(0, 1024) })
        .setDescription(answer.slice(0, 4096))
        .setFooter({
          text: "Asked by " + interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Error handling /ask:", err);
      await interaction.editReply("Something went wrong while fetching the answer. Please try again later.");
    }
  }

  if (commandName === "qna-setup") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "Only server administrators can run this command.",
        ephemeral: true,
      });
      return;
    }

    const rawIds = interaction.options.getString("notion_ids");
    const notionIds = rawIds
      .split(",")
      .map((id) => id.trim().replace(/-/g, ""))
      .filter(Boolean);

    if (!notionIds.length) {
      await interaction.reply({
        content: "Please provide at least one Notion page or database ID.",
        ephemeral: true,
      });
      return;
    }

    setServerConfig(guildId, notionIds, guild?.name);

    await interaction.reply({
      content: "QNA Bot configured! Linked " + notionIds.length + " Notion page(s)/database(s). Members can now use /ask.",
      ephemeral: true,
    });
  }

  if (commandName === "qna-status") {
    const config = getServerConfig(guildId);

    if (!config) {
      await interaction.reply({
        content: "This server hasn't been set up yet. Run /qna-setup to link Notion pages.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle("QNA Bot Status")
      .addFields(
        { name: "Server", value: config.name || guildId, inline: true },
        {
          name: "Notion Sources",
          value: config.notionIds.length + " page(s)/database(s)",
          inline: true,
        },
        { name: "Notion IDs", value: config.notionIds.join(", ") }
      )
      .setFooter({ text: "Use /qna-setup to update configuration" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("ERROR: DISCORD_TOKEN is not set.");
  process.exit(1);
}

client.login(token);
