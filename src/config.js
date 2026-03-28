const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "server-config.json");

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
  config[guildId].sources.push({ notionIds, roleIds, label: roleLabel });

  if (config[guildId].notionIds) {
    delete config[guildId].notionIds;
  }

  saveConfig(config);
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
  removeServerConfig,
  loadConfig,
};
