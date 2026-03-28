const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "server-config.json");

/**
 * Per-server configuration with role-based Notion sources.
 *
 * Format:
 * {
 *   "guild_id": {
 *     "name": "Server Name",
 *     "sources": [
 *       { "notionIds": ["id1"], "roleIds": ["role1", "role2"], "label": "@Role1, @Role2" }
 *     ]
 *   }
 * }
 */

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (err) {
    console.error("Error loading server config:", err.message);
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getServerConfig(guildId) {
  const config = loadConfig();
  return config[guildId] || null;
}

function addSource(guildId, notionIds, roleIds, roleLabel, serverName) {
  const config = loadConfig();
  if (!config[guildId]) {
    config[guildId] = { name: serverName || guildId, sources: [] };
  }
  config[guildId].name = serverName || config[guildId].name;

  // Migrate old format if needed
  if (config[guildId].notionIds) {
    delete config[guildId].notionIds;
  }

  // Check if a source with the same Notion IDs already exists
  const sortedNew = [...notionIds].sort().join(",");
  const existing = config[guildId].sources.find((s) => {
    return [...s.notionIds].sort().join(",") === sortedNew;
  });

  if (existing) {
    // Merge new roles into existing source
    for (const rid of roleIds) {
      if (!existing.roleIds.includes(rid)) {
        existing.roleIds.push(rid);
      }
    }
    // Label will be rebuilt by caller via updateSourceLabel
  } else {
    config[guildId].sources.push({ notionIds, roleIds, label: roleLabel });
  }

  saveConfig(config);
  return existing || null;
}

function updateSourceLabel(guildId, notionIds, newLabel) {
  const config = loadConfig();
  const server = config[guildId];
  if (!server || !server.sources) return;
  const sortedNew = [...notionIds].sort().join(",");
  const source = server.sources.find((s) => [...s.notionIds].sort().join(",") === sortedNew);
  if (source) {
    source.label = newLabel;
    saveConfig(config);
  }
}

function getSourceByNotionIds(guildId, notionIds) {
  const config = loadConfig();
  const server = config[guildId];
  if (!server || !server.sources) return null;
  const sortedNew = [...notionIds].sort().join(",");
  return server.sources.find((s) => [...s.notionIds].sort().join(",") === sortedNew) || null;
}

function removeSource(guildId, notionId) {
  const config = loadConfig();
  if (!config[guildId] || !config[guildId].sources) return false;

  const before = config[guildId].sources.length;
  config[guildId].sources = config[guildId].sources.filter(
    (s) => !s.notionIds.includes(notionId)
  );
  const removed = config[guildId].sources.length < before;
  saveConfig(config);
  return removed;
}

function getNotionIdsForRoles(guildId, memberRoleIds) {
  const config = loadConfig();
  const server = config[guildId];
  if (!server || !server.sources) return [];

  const ids = new Set();
  for (const source of server.sources) {
    const hasRole = source.roleIds.some((r) => memberRoleIds.includes(r));
    if (hasRole) {
      for (const id of source.notionIds) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}

function removeServerConfig(guildId) {
  const config = loadConfig();
  delete config[guildId];
  saveConfig(config);
}

module.exports = {
  getServerConfig,
  addSource,
  removeSource,
  getNotionIdsForRoles,
  getSourceByNotionIds,
  updateSourceLabel,
  removeServerConfig,
  loadConfig,
};
