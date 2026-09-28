const { app, Tray, Menu, nativeImage, clipboard } = require("electron");
const os = require("os");

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
      label: `💻 Device Name: ${hostname}:4000 (Click to Copy)`,
      toolTip: `Click to copy ${hostname}:4000 (Permanent address — won't change when Wi-Fi restarts)`,
      click: () => {
        const text = `${hostname}:4000`;
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
        label: `🌐 LAN IP: ${ip}:${serverPort} (Click to Copy)`,
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
          label: `🌐 Local: 127.0.0.1:${serverPort}`,
          enabled: false
        }
      ];

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "👑 DPC Master PC (Server Active)",
      enabled: false
    },
    {
      label: `● Database Server: Running on Port ${serverPort}`,
      enabled: false
    },
    { type: "separator" },
    ...deviceMenuItems,
    ...ipMenuItems,
    { type: "separator" },
    {
      label: "🖥️ Open DPC Application",
      click: () => {
        if (onOpenApp) onOpenApp();
      }
    },
    {
      label: "🔄 Restart Backend Server",
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
      label: "⚙️ Network & Server Configuration",
      click: () => {
        if (onOpenSettings) onOpenSettings();
      }
    },
    { type: "separator" },
    {
      label: "❌ Exit & Stop Master Server",
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
