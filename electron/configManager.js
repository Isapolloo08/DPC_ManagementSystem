const { app } = require("electron");
const path = require("path");
const fs = require("fs");

/**
 * Manages the persistence of Server Mode & IP configuration.
 * Stores configuration in the user's application data directory.
 */
function getConfigFilePath() {
  return path.join(app.getPath("userData"), "server-mode-config.json");
}

function loadServerConfig() {
  try {
    const configPath = getConfigFilePath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[ConfigManager] Error reading config file:", err);
  }
  return { serverIp: "" };
}

function saveServerConfig(config) {
  try {
    const configPath = getConfigFilePath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[ConfigManager] Error saving config file:", err);
    return false;
  }
}

/**
 * Checks if a configured server IP represents Master PC mode (blank or localhost).
 */
function isMasterMode(serverIp) {
  if (!serverIp || typeof serverIp !== "string" || !serverIp.trim()) {
    return true; // Blank means Master PC
  }
  const clean = serverIp.trim().toLowerCase();
  return (
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean.startsWith("localhost:") ||
    clean.startsWith("127.0.0.1:") ||
    clean === "http://localhost" ||
    clean === "http://127.0.0.1"
  );
}

module.exports = {
  loadServerConfig,
  saveServerConfig,
  isMasterMode
};
