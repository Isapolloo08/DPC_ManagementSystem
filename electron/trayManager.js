const { app, Tray, Menu, nativeImage, clipboard } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");

let tray = null;

function getLanIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function getTrayMenuItemIcon(iconName) {
  try {
    const candidates = [
      path.join(__dirname, "assets", "tray-icons", `${iconName}.png`),
      path.join(app.getAppPath(), "electron", "assets", "tray-icons", `${iconName}.png`),
      process.resourcesPath ? path.join(process.resourcesPath, "electron", "assets", "tray-icons", `${iconName}.png`) : null,
      process.resourcesPath ? path.join(process.resourcesPath, "app.asar.unpacked", "electron", "assets", "tray-icons", `${iconName}.png`) : null
    ].filter(Boolean);

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          return img.resize({ width: 16, height: 16 });
        }
      }
    }
  } catch (e) {
    console.warn(`[TrayManager] Error loading icon for ${iconName}:`, e);
  }
  return undefined;
}

function createOrUpdateTray({ iconPath, onOpenApp, onRestartServer, onOpenSettings, onQuitApp, isDev }) {
  if (!iconPath) {
    console.warn("[TrayManager] Cannot create tray: Missing icon path.");
    return;
  }

  const lanIps = getLanIps();
  const primaryIp = lanIps[0] || "127.0.0.1";
  const serverPort = process.env.PORT || "4000";

  let trayImage;
  try {
    trayImage = nativeImage.createFromPath(iconPath);
    if (process.platform === "win32") {
      trayImage = trayImage.resize({ width: 16, height: 16 });
    }
  } catch (e) {
    console.error("[TrayManager] Error loading tray icon:", e);
    return;
  }

  if (!tray) {
    console.log("[TrayManager] Creating Master PC System Tray Icon...");
    tray = new Tray(trayImage);
    tray.setToolTip("Daet Presbyterian Church — Master Database Server (Port 4000)");

    // Single click / Double click restores window
    tray.on("click", () => {
      if (onOpenApp) onOpenApp();
    });

    tray.on("double-click", () => {
      if (onOpenApp) onOpenApp();
    });
  } else {
    tray.setImage(trayImage);
  }

  const hostname = os.hostname();
  const deviceMenuItems = [
    {
      label: `Device Name: ${hostname}:${serverPort} (Click to Copy)`,
      icon: getTrayMenuItemIcon("device"),
      toolTip: `Click to copy ${hostname}:${serverPort} (Permanent address — won't change when Wi-Fi restarts)`,
      click: () => {
        const text = `${hostname}:${serverPort}`;
        clipboard.writeText(text);
        if (tray && process.platform === "win32") {
          try {
            tray.displayBalloon({
              title: "Permanent Device Name Copied!",
              content: `Copied "${text}" to clipboard. Enter this on Client PCs to connect.`
            });
          } catch (_) {}
        }
      }
    }
  ];

  const ipMenuItems = lanIps.length > 0
    ? lanIps.map((ip) => ({
        label: `LAN IP: ${ip}:${serverPort} (Click to Copy)`,
        icon: getTrayMenuItemIcon("network"),
        toolTip: `Click to copy ${ip}:${serverPort} for other Client PCs`,
        click: () => {
          const text = `${ip}:${serverPort}`;
          clipboard.writeText(text);
          if (tray && process.platform === "win32") {
            try {
              tray.displayBalloon({
                title: "DPC Master Server IP Copied!",
                content: `Copied "${text}" to clipboard. Enter this address in Client PCs to connect.`
              });
            } catch (_) {}
          }
        }
      }))
    : [
        {
          label: `Local: 127.0.0.1:${serverPort}`,
          icon: getTrayMenuItemIcon("network"),
          enabled: false
        }
      ];

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "DPC Master PC (Server Active)",
      icon: getTrayMenuItemIcon("crown"),
      enabled: false
    },
    {
      label: `Database Server: Running on Port ${serverPort}`,
      icon: getTrayMenuItemIcon("database"),
      enabled: false
    },
    { type: "separator" },
    ...deviceMenuItems,
    ...ipMenuItems,
    { type: "separator" },
    {
      label: "Open DPC Application",
      icon: getTrayMenuItemIcon("app-open"),
      click: () => {
        if (onOpenApp) onOpenApp();
      }
    },
    {
      label: "Restart Backend Server",
      icon: getTrayMenuItemIcon("restart"),
      click: () => {
        if (onRestartServer) onRestartServer();
        if (tray && process.platform === "win32") {
          try {
            tray.displayBalloon({
              title: "DPC Backend Server",
              content: "Restarting local backend database server..."
            });
          } catch (_) {}
        }
      }
    },
    {
      label: "Network & Server Configuration",
      icon: getTrayMenuItemIcon("settings"),
      click: () => {
        if (onOpenSettings) onOpenSettings();
      }
    },
    { type: "separator" },
    {
      label: "Exit & Stop Master Server",
      icon: getTrayMenuItemIcon("exit"),
      click: () => {
        if (onQuitApp) {
          onQuitApp();
        } else {
          app.quit();
        }
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function displayTrayNotification(title, content) {
  if (tray && process.platform === "win32") {
    try {
      tray.displayBalloon({
        title: title || "DPC Management System",
        content: content || ""
      });
    } catch (_) {}
  }
}

function destroyTray() {
  if (tray) {
    console.log("[TrayManager] Destroying Tray Icon (Switched to Client PC Mode).");
    try {
      tray.destroy();
    } catch (e) {
      console.error("[TrayManager] Error destroying tray:", e);
    }
    tray = null;
  }
}

function isTrayActive() {
  return tray !== null;
}

module.exports = {
  createOrUpdateTray,
  destroyTray,
  isTrayActive,
  displayTrayNotification,
  getLanIps
};
