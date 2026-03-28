require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} = require("discord.js");
const { fetchAllContent } = require("./notion");
const { askClaude } = require("./claude");
const { getServerConfig, addSource, removeSource, getNotionIdsForRoles } = require("./config");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const answerStore = new Map();
const pendingSetups = new Map();

client.once("ready", () => {
  console.log("Bot is online as " + client.user.tag);
  console.log("Serving " + client.guilds.cache.size + " server(s)");
});

client.on("interactionCreate", async (interaction) => {
  // ─── Role select menu interactions (qna-setup step 2) ───
  if (interaction.isRoleSelectMenu()) {
    const id = interaction.customId;
    if (id.startsWith("qna_roles_")) {
      const setupKey = id.replace("qna_roles_", "");
      const pending = pendingSetups.get(setupKey);

      if (!pending) {
        await interaction.reply({
          content: "This setup has expired. Please run /qna-setup again.",
          ephemeral: true,
        });
        return;
      }

      const roleIds = interaction.values;
      const roleNames = roleIds.map((rid) => {
        if (rid === interaction.guildId) return "@everyone";
        const role = interaction.guild.roles.cache.get(rid);
        return role ? "@" + role.name : rid;
      });
      const roleLabel = roleNames.join(", ");

      addSource(interaction.guildId, pending.notionIds, roleIds, roleLabel, interaction.guild?.name);
      pendingSetups.delete(setupKey);

      await interaction.update({
        content: "QNA Bot configured!\n\nLinked **" + pending.notionIds.length + "** Notion source(s) to roles: " + roleLabel + "\n\nUsers with those roles can now use /ask to query these docs.",
        components: [],
      });
    }
    return;
  }

  // ─── Button interactions (expand/collapse) ────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id.startsWith("expand_") || id.startsWith("collapse_")) {
      const key = id.replace("expand_", "").replace("collapse_", "");
      const data = answerStore.get(key);

      if (!data) {
        await interaction.reply({
          content: "This answer has expired. Please ask the question again.",
          ephemeral: true,
        });
        return;
      }

      const expanding = id.startsWith("expand_");

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: data.question.slice(0, 256) })
        .setTitle("Answer")
        .setFooter({
          text: "Asked by " + data.username,
          iconURL: data.avatarURL,
        })
        .setTimestamp();

      if (expanding) {
        embed.setDescription(
          data.summary.slice(0, 2000) +
          "\n\n---\n\n**Full Answer:**\n" +
          data.detailed.slice(0, 1800)
        );
      } else {
        embed.setDescription(data.summary.slice(0, 4096));
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(expanding ? "collapse_" + key : "expand_" + key)
          .setLabel(expanding ? "Hide Full Answer" : "Show Full Answer")
          .setStyle(expanding ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setEmoji(expanding ? "\uD83D\uDD3C" : "\uD83D\uDCD6")
      );

      await interaction.update({ embeds: [embed], components: [row] });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, guild } = interaction;

  // ─── /ask ────────────────────────────────────────────────
  if (commandName === "ask") {
    const question = interaction.options.getString("question");

    const memberRoleIds = interaction.member.roles.cache.map((r) => r.id);
    const notionIds = getNotionIdsForRoles(guildId, memberRoleIds);

    if (!notionIds.length) {
      await interaction.reply({
        content: "You don't have access to any Notion docs in this server. Ask an admin to set up your role with /qna-setup.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const docsContent = await fetchAllContent(notionIds);

      if (!docsContent.trim()) {
        await interaction.editReply("No content found in the Notion pages you have access to.");
        return;
      }

      const serverConfig = getServerConfig(guildId);
      const { summary, detailed } = await askClaude(
        question,
        docsContent,
        serverConfig?.name || guild?.name || "this server"
      );

      const answerKey = interaction.id;
      answerStore.set(answerKey, {
        summary,
        detailed,
        question,
        username: interaction.user.displayName,
        avatarURL: interaction.user.displayAvatarURL(),
      });
      setTimeout(() => answerStore.delete(answerKey), 30 * 60 * 1000);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: question.slice(0, 256) })
        .setTitle("Answer")
        .setDescription(summary.slice(0, 4096))
        .setFooter({
          text: "Asked by " + interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("expand_" + answerKey)
          .setLabel("Show Full Answer")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("\uD83D\uDCD6")
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error("Error handling /ask:", err);
      await interaction.editReply("Something went wrong while fetching the answer. Please try again later.");
    }
  }

  // ─── /qna-setup (step 1: show role select menu) ──────────
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

    const setupKey = interaction.id;
    pendingSetups.set(setupKey, { notionIds });
    setTimeout(() => pendingSetups.delete(setupKey), 5 * 60 * 1000);

    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId("qna_roles_" + setupKey)
        .setPlaceholder("Select roles that can access these docs")
        .setMinValues(1)
        .setMaxValues(10)
    );

    await interaction.reply({
      content: "**Step 2:** Select the roles that should have access to these Notion docs.\nChoose **@everyone** to make them available to all members.",
      components: [row],
      ephemeral: true,
    });
  }

  // ─── /qna-remove ────────────────────────────────────────
  if (commandName === "qna-remove") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "Only server administrators can run this command.",
        ephemeral: true,
      });
      return;
    }

    const notionId = interaction.options.getString("notion_id").trim().replace(/-/g, "");
    const removed = removeSource(guildId, notionId);

    if (removed) {
      await interaction.reply({
        content: "Removed Notion source `" + notionId + "` from this server.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "No source found with that ID. Use /qna-status to see configured sources.",
        ephemeral: true,
      });
    }
  }

  // ─── /qna-status ────────────────────────────────────────
  if (commandName === "qna-status") {
    const config = getServerConfig(guildId);

    if (!config || !config.sources || !config.sources.length) {
      await interaction.reply({
        content: "This server hasn't been set up yet. An admin needs to run /qna-setup to link Notion pages to roles.",
        ephemeral: true,
      });
      return;
    }

    const sourceList = config.sources.map((s, i) => {
      const ids = s.notionIds.map((id) => "`" + id + "`").join(", ");
      return "**" + (i + 1) + ".** " + ids + "\n   Roles: " + s.label;
    }).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0x00d26a)
      .setTitle("QNA Bot Status")
      .setDescription(sourceList)
      .addFields(
        { name: "Server", value: config.name || guildId, inline: true },
        { name: "Total Sources", value: config.sources.length + "", inline: true }
      )
      .setFooter({ text: "Use /qna-setup to add sources, /qna-remove to delete" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("ERROR: DISCORD_TOKEN is not set.");
  process.exit(1);
}

client.login(token);
