const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

let mainWindow = null;

// Remove the default Electron menu bar completely (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Frameless window to allow custom control panel
    autoHideMenuBar: true,
    title: "Daet Presbyterian Church — ChMS",
    icon: path.join(__dirname, "../client/public/favicon.ico"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Handle maximize / unmaximize events to notify renderer
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window:maximize-change", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window:maximize-change", false);
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
      console.error("Failed to load dev server URL:", err);
    });
  } else {
    const distPath = path.join(__dirname, "../client/dist/index.html");
    mainWindow.loadFile(distPath).catch((err) => {
      console.error("Failed to load production HTML:", err);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

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
