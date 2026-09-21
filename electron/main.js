const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

// Single-instance lock to prevent multiple conflicting processes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// In production packaged apps (app.isPackaged = true), isDev is ALWAYS false regardless of environment variables
const isDev = !app.isPackaged && process.env.NODE_ENV === "development";

let mainWindow = null;

// Remove the default Electron menu bar completely (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

function getAppIcon() {
  const possibleIcons = [
    path.join(__dirname, "../client/dist/favicon.ico"),
    path.join(__dirname, "../client/public/favicon.ico"),
    path.join(app.getAppPath(), "client/dist/favicon.ico")
  ];
  for (const iconPath of possibleIcons) {
    if (fs.existsSync(iconPath)) return iconPath;
  }
  return undefined;
}

function getIndexPath() {
  const candidates = [
    path.join(app.getAppPath(), "client", "dist", "index.html"),
    path.join(__dirname, "..", "client", "dist", "index.html"),
    path.join(__dirname, "client", "dist", "index.html"),
    path.join(process.resourcesPath, "client", "dist", "index.html"),
    path.join(process.resourcesPath, "app.asar", "client", "dist", "index.html")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(app.getAppPath(), "client", "dist", "index.html");
}

function createWindow() {
  const appIcon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Frameless window to allow custom control panel
    autoHideMenuBar: true,
    title: "Daet Presbyterian Church — ChMS",
    ...(appIcon ? { icon: appIcon } : {}),
    show: false,
    backgroundColor: "#1e293b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Show window smoothly when ready
  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
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
  }, 1500);

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

  // Handle keyboard shortcuts (Ctrl+R, F5, Ctrl+Shift+R, Ctrl+Shift+I, F12, Zoom) even with custom frameless window and hidden menu
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

  if (isDev) {
    const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
    mainWindow.loadURL(devUrl).catch((err) => {
      console.error("[Electron] Failed to load dev server URL:", err);
    });
  } else {
    const distPath = getIndexPath();
    console.log("[Electron] Loading production HTML from:", distPath);
    mainWindow.loadFile(distPath).catch((err) => {
      console.error("[Electron] Failed to load production HTML:", err);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Focus existing window if a second instance is launched
app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
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
    mainWindow.close();
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

// App Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
