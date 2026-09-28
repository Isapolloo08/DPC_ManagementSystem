const { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

// Set canonical app name across development and production
app.name = "DPC Management System";

// Disable GPU sandbox to prevent transparent DWM compositing glitches on Windows
app.commandLine.appendSwitch("disable-gpu-sandbox");

// Register privileged custom scheme 'app://' before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const { loadServerConfig, saveServerConfig, isMasterMode } = require("./configManager");
const { startBackendServer, stopBackendServer, restartBackendServer, isServerRunning } = require("./serverManager");
const { createOrUpdateTray, destroyTray, getLanIps, isTrayActive } = require("./trayManager");

// In production packaged apps (app.isPackaged = true), isDev is ALWAYS false regardless of environment variables
const isDev = !app.isPackaged && process.env.NODE_ENV === "development";

// Single-instance lock to prevent multiple conflicting processes in production
if (!isDev) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log("[Electron] Another instance of DPC Management System is already running. Quitting duplicate instance.");
    app.quit();
    process.exit(0);
  }
}

let mainWindow = null;
let isQuitting = false;
let currentServerIp = loadServerConfig().serverIp || "";

// Remove the default Electron menu bar completely (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

function getAppIcon() {
  const possibleIcons = [
    path.join(__dirname, "../client/src/assets/icon.ico"),
    path.join(__dirname, "../client/public/favicon.ico"),
    path.join(__dirname, "../client/src/assets/DPC-management-icon.png"),
    path.join(__dirname, "../client/public/DPC-management-icon.png"),
    path.join(__dirname, "../client/dist/DPC-management-icon.png"),
    path.join(app.getAppPath(), "client/src/assets/icon.ico"),
    path.join(app.getAppPath(), "client/src/assets/DPC-management-icon.png"),
    path.join(app.getAppPath(), "client/dist/DPC-management-icon.png"),
    path.join(app.getAppPath(), "client/public/DPC-management-icon.png"),
    path.join(__dirname, "../client/dist/favicon.ico"),
    path.join(app.getAppPath(), "client/dist/favicon.ico")
  ];
  for (const iconPath of possibleIcons) {
    try {
      if (fs.existsSync(iconPath)) return iconPath;
    } catch (_) {}
  }
  return undefined;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js":
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    case ".ico": return "image/x-icon";
    case ".ttf": return "font/ttf";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}

function getClientDistPath() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, "client", "dist") : null,
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar", "client", "dist") : null,
    path.join(app.getAppPath(), "client", "dist"),
    path.join(__dirname, "..", "client", "dist"),
    path.join(__dirname, "client", "dist")
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) {}
  }
  return path.join(app.getAppPath(), "client", "dist");
}

function getIndexPath() {
  const distDir = getClientDistPath();
  return path.join(distDir, "index.html");
}

function focusOrOpenWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

/**
 * Applies the Server Mode (Master PC with Tray & Local Server vs Client PC without Tray)
 */
function applyServerMode(serverIp) {
  currentServerIp = serverIp || "";
  const isMaster = isMasterMode(currentServerIp);
  const appIcon = getAppIcon();

  if (isMaster) {
    console.log("[Electron] Configuring as Master PC: Starting local backend & creating system tray...");
    
    // In production packaged builds, start the embedded backend server
    if (!isDev) {
      startBackendServer(isDev);
    }

    // Configure Windows auto-start on boot / restart for Master PC server
    if (!isDev && app.isPackaged) {
      try {
        app.setLoginItemSettings({
          openAtLogin: true,
          openAsHidden: true,
          path: process.execPath,
          args: ["--hidden"]
        });
        console.log("[Electron] Configured Windows Auto-Start on Boot (Master Server Mode).");
      } catch (e) {
        console.warn("[Electron] Failed to set auto-start settings:", e);
      }
    }

    // Create or update the persistent system tray icon for Master PC
    createOrUpdateTray({
      iconPath: appIcon,
      onOpenApp: focusOrOpenWindow,
      onRestartServer: () => restartBackendServer(isDev),
      onOpenSettings: () => {
        focusOrOpenWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("server:open-settings");
        }
      },
      onQuitApp: () => {
        console.log("[Electron] Explicit Quit from Master PC System Tray.");
        isQuitting = true;
        app.quit();
      },
      isDev
    });
  } else {
    console.log(`[Electron] Configuring as Client PC (Connecting to remote ${serverIp}): Stopping local backend & removing tray...`);
    
    // In Client PC mode, stop local backend server to save memory
    if (!isDev) {
      stopBackendServer();
    }

    // Remove Windows auto-start on Client PC
    if (!isDev && app.isPackaged) {
      try {
        app.setLoginItemSettings({
          openAtLogin: false
        });
        console.log("[Electron] Disabled Windows Auto-Start (Client Mode).");
      } catch (e) {
        console.warn("[Electron] Failed to clear auto-start settings:", e);
      }
    }

    // Destroy the system tray icon in Client mode
    destroyTray();
  }

  // Notify renderer window if available
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("server:status-change", {
      isMaster,
      serverIp: currentServerIp,
      isTrayActive: isTrayActive(),
      isServerRunning: isServerRunning(),
      lanIps: getLanIps()
    });
  }
}

function createWindow() {
  const appIcon = getAppIcon();
  const isHiddenLaunch = process.argv.includes("--hidden");

  mainWindow = new BrowserWindow({
    width: 1466,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Frameless window to allow custom control panel
    transparent: false,
    hasShadow: true,
    autoHideMenuBar: true,
    title: "Daet Presbyterian Church — ChMS",
    ...(appIcon ? { icon: appIcon } : {}),
    show: false,
    backgroundColor: "#FDFBF7",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Intercept window close: In Master PC mode, hide window to system tray instead of quitting!
  mainWindow.on("close", (event) => {
    const isMaster = isMasterMode(currentServerIp);
    if (!isQuitting && isMaster) {
      event.preventDefault();
      mainWindow.hide();
      const { displayTrayNotification } = require("./trayManager");
      displayTrayNotification(
        "DPC Master Server Running",
        "The database server remains running in the background for all church client PCs. Click the system tray icon to re-open."
      );
      return false;
    }
  });

  if (!isHiddenLaunch) {
    // Show window smoothly when ready
    mainWindow.once("ready-to-show", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    // Also ensure window shows on dom-ready
    mainWindow.webContents.once("dom-ready", () => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    // Safety fallback: Ensure window is visible even if ready-to-show event is missed/delayed
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        console.log("[Electron] Displaying window via fallback timer.");
        mainWindow.show();
        mainWindow.focus();
      }
    }, 1000);
  } else {
    console.log("[Electron] Launched with --hidden flag (Windows Startup). Running silently in System Tray.");
  }

  // Handle load failure gracefully
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Page failed to load (${errorCode}): ${errorDescription} at ${validatedURL}`);
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // Handle maximize / unmaximize events to notify renderer
  mainWindow.on("maximize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window:maximize-change", true);
    }
  });
  mainWindow.on("unmaximize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window:maximize-change", false);
    }
  });

  // Handle keyboard shortcuts (Ctrl+R, F5, Ctrl+Shift+R, Ctrl+Shift+I, F12, Zoom)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    const isMac = process.platform === "darwin";
    const controlKey = isMac ? input.meta : input.control;

    // Reload: Ctrl+R or F5
    if ((controlKey && input.key.toLowerCase() === "r" && !input.shift) || input.key === "F5") {
      event.preventDefault();
      mainWindow.webContents.reload();
      return;
    }

    // Force Reload: Ctrl+Shift+R or Ctrl+F5
    if ((controlKey && input.key.toLowerCase() === "r" && input.shift) || (controlKey && input.key === "F5")) {
      event.preventDefault();
      mainWindow.webContents.reloadIgnoringCache();
      return;
    }

    // Toggle DevTools: Ctrl+Shift+I or F12
    if ((controlKey && input.key.toLowerCase() === "i" && input.shift) || input.key === "F12") {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
      return;
    }
  });

  // Handle external links safely in system default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Forward renderer console logs to Electron process stdout for clean debugging
  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    const levelName = level === 3 ? "ERROR" : level === 2 ? "WARN" : "LOG";
    console.log(`[Renderer ${levelName}] ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
    console.log("[Electron] Connecting to dev server URL:", devUrl);
    const tryLoadDevUrl = (retries = 15) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.loadURL(devUrl).catch((err) => {
        console.warn(`[Electron] Dev server at ${devUrl} not ready yet (${err.message}). Retrying in 1s... (${retries} left)`);
        if (retries > 0) {
          setTimeout(() => tryLoadDevUrl(retries - 1), 1000);
        }
      });
    };
    tryLoadDevUrl();
  } else {
    console.log("[Electron] Loading app via app://localhost/index.html...");
    mainWindow.loadURL("app://localhost/index.html").catch((err) => {
      console.error("[Electron] Failed to load app:// URL, fallback to file URL:", err);
      const distPath = getIndexPath();
      try {
        mainWindow.loadURL(pathToFileURL(distPath).href).catch((e) => {
          mainWindow.loadFile(distPath).catch((e2) => console.error("loadFile failed:", e2));
        });
      } catch (_) {
        mainWindow.loadFile(distPath).catch((e2) => console.error("loadFile failed:", e2));
      }
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Focus existing window if a second instance is launched
app.on("second-instance", () => {
  focusOrOpenWindow();
});

// Global unhandled error logging
process.on("uncaughtException", (err) => {
  console.error("[Electron] Uncaught Exception:", err);
});

// IPC Handlers for desktop control panel
ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("app:get-platform", () => process.platform);

ipcMain.handle("window:minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle("window:maximize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle("window:is-maximized", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.handle("window:close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isMaster = isMasterMode(currentServerIp);
    if (!isQuitting && isMaster) {
      mainWindow.hide();
      const { displayTrayNotification } = require("./trayManager");
      displayTrayNotification(
        "DPC Master Server Running",
        "The database server remains running in the background for all church client PCs. Click the system tray icon to re-open."
      );
    } else {
      mainWindow.close();
    }
  }
});

ipcMain.handle("window:reload", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reload();
  }
});

ipcMain.handle("window:force-reload", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reloadIgnoringCache();
  }
});

ipcMain.handle("window:toggle-devtools", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.toggleDevTools();
  }
});

ipcMain.handle("dialog:show-message", async (event, options) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  return await dialog.showMessageBox(mainWindow, options);
});

// Server & Tray Mode IPC Handlers
ipcMain.handle("server:get-config", () => {
  const config = loadServerConfig();
  const isMaster = isMasterMode(config.serverIp);
  const hostname = require("os").hostname();
  return {
    serverIp: config.serverIp || "",
    isMaster,
    mode: isMaster ? "master" : "client",
    isTrayActive: isTrayActive(),
    isServerRunning: isServerRunning(),
    lanIps: getLanIps(),
    hostname,
    deviceUrl: `${hostname}:4000`,
    mDnsUrl: `${hostname}.local:4000`
  };
});

ipcMain.handle("server:set-config", async (event, newConfig) => {
  const serverIp = (newConfig?.serverIp || "").trim();
  saveServerConfig({ serverIp });
  applyServerMode(serverIp);
  const isMaster = isMasterMode(serverIp);
  const hostname = require("os").hostname();
  return {
    success: true,
    serverIp,
    isMaster,
    mode: isMaster ? "master" : "client",
    isTrayActive: isTrayActive(),
    isServerRunning: isServerRunning(),
    lanIps: getLanIps(),
    hostname,
    deviceUrl: `${hostname}:4000`,
    mDnsUrl: `${hostname}.local:4000`
  };
});

ipcMain.handle("server:get-local-ips", () => {
  const hostname = require("os").hostname();
  return {
    lanIps: getLanIps(),
    hostname,
    deviceUrl: `${hostname}:4000`,
    mDnsUrl: `${hostname}.local:4000`
  };
});

ipcMain.handle("server:restart", () => {
  restartBackendServer(isDev);
  return { success: true };
});

// App Lifecycle
app.whenReady().then(() => {
  // Register custom 'app://' protocol to serve production assets smoothly without file:// CORS or module issues
  protocol.handle("app", (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let pathname = decodeURIComponent(parsedUrl.pathname);
      if (!pathname || pathname === "/" || pathname === "\\") {
        pathname = "/index.html";
      }
      const relativePath = pathname.replace(/^\/+/, "");
      const clientDist = getClientDistPath();
      let filePath = path.join(clientDist, relativePath);

      // If requested path does not exist and is NOT a static asset, fallback to index.html for SPA
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        const isAsset = /\.(js|mjs|css|json|png|jpg|jpeg|webp|svg|ico|ttf|woff|woff2|map)$/i.test(pathname);
        if (!isAsset) {
          filePath = path.join(clientDist, "index.html");
        }
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const fileData = fs.readFileSync(filePath);
        const mime = getMimeType(filePath);
        return new Response(fileData, {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Cache-Control": "no-cache"
          }
        });
      }
      console.warn(`[Electron app://] 404 Not Found: ${filePath} (requested: ${request.url})`);
    } catch (e) {
      console.error("[Electron Protocol Error]", e);
    }
    return new Response("Not Found", { status: 404 });
  });

  createWindow();

  // Load initial server configuration and apply mode (Master PC + Tray vs Client PC)
  const config = loadServerConfig();
  applyServerMode(config.serverIp);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  const isMaster = isMasterMode(currentServerIp);
  // If in Master PC mode and not quitting, keep running in tray and server active
  if (!isMaster || isQuitting) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBackendServer();
  destroyTray();
});

app.on("will-quit", () => {
  isQuitting = true;
  stopBackendServer();
  destroyTray();
});
