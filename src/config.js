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

function setServerConfig(guildId, notionIds, serverName) {
  const config = loadConfig();
  config[guildId] = {
    notionIds,
    name: serverName || guildId,
  };
  saveConfig(config);
}

function removeServerConfig(guildId) {
  const config = loadConfig();
  delete config[guildId];
  saveConfig(config);
}

module.exports = {
  getServerConfig,
  setServerConfig,
  removeServerConfig,
  loadConfig,
};
