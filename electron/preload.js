const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  close: () => ipcRenderer.invoke("window:close"),
  reload: () => ipcRenderer.invoke("window:reload"),
  forceReload: () => ipcRenderer.invoke("window:force-reload"),
  toggleDevTools: () => ipcRenderer.invoke("window:toggle-devtools"),
  onMaximizeChange: (callback) => {
    const listener = (_event, isMax) => callback(isMax);
    ipcRenderer.on("window:maximize-change", listener);
    return () => ipcRenderer.removeListener("window:maximize-change", listener);
  },
  showMessage: (options) => ipcRenderer.invoke("dialog:show-message", options)
});
