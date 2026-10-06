const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");

let serverProcess = null;
let isStarting = false;

function getServerScriptPath() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, "server", "dist", "index.js") : null,
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar.unpacked", "server", "dist", "index.js") : null,
    app.isPackaged ? path.join(app.getAppPath().replace(/app\.asar$/, "app.asar.unpacked"), "server", "dist", "index.js") : null,
    path.join(__dirname, "..", "server", "dist", "index.js"),
    path.join(app.getAppPath(), "server", "dist", "index.js"),
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar", "server", "dist", "index.js") : null
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return candidates[candidates.length - 1] || path.join(__dirname, "../server/dist/index.js");
}

function isServerRunning() {
  return serverProcess !== null && !serverProcess.killed;
}

function startBackendServer(isDev) {
  // If in dev mode and dev server is already running outside Electron, we don't need to double-spawn
  if (isServerRunning() || isStarting) {
    console.log("[ServerManager] Backend server process is already running.");
    return;
  }

  const scriptPath = getServerScriptPath();
  if (!fs.existsSync(scriptPath)) {
    console.warn("[ServerManager] Backend server script not found at:", scriptPath);
    return;
  }

  isStarting = true;
  console.log("[ServerManager] Starting Master PC backend server from:", scriptPath);

  try {
    const serverCwd = path.dirname(path.dirname(scriptPath)); // server root directory
    
    // Ensure child node process can find modules inside app.asar and resources
    const asarNodeModules = path.join(process.resourcesPath || "", "app.asar", "node_modules");
    const unpackedNodeModules = path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules");
    const appNodeModules = path.join(app.getAppPath(), "node_modules");
    const rootNodeModules = path.join(__dirname, "..", "node_modules");

    const nodePathList = [
      asarNodeModules,
      unpackedNodeModules,
      appNodeModules,
      rootNodeModules,
      process.env.NODE_PATH
    ].filter(Boolean).join(path.delimiter);

    serverProcess = fork(scriptPath, [], {
      cwd: fs.existsSync(serverCwd) ? serverCwd : undefined,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_PATH: nodePathList,
        PORT: process.env.PORT || "4000",
        NODE_ENV: isDev ? "development" : "production",
        DATABASE_URL: process.env.DATABASE_URL || "postgres://postgres:admin123@localhost:5432/chms_db",
        JWT_SECRET: process.env.JWT_SECRET || "chms_super_secure_jwt_secret_key_2026"
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.on("data", (data) => {
        console.log(`[Backend Server] ${data.toString().trim()}`);
      });
    }

    if (serverProcess.stderr) {
      serverProcess.stderr.on("data", (data) => {
        console.error(`[Backend Server ERR] ${data.toString().trim()}`);
      });
    }

    serverProcess.on("exit", (code, signal) => {
      console.log(`[ServerManager] Backend process exited. Code: ${code}, Signal: ${signal}`);
      serverProcess = null;
      isStarting = false;
    });

    isStarting = false;
  } catch (err) {
    console.error("[ServerManager] Failed to spawn backend server process:", err);
    isStarting = false;
  }
}

function stopBackendServer() {
  if (!serverProcess) return;
  console.log("[ServerManager] Terminating backend server (Client PC mode / App Exit)...");
  try {
    try {
      serverProcess.send({ type: "SHUTDOWN" });
    } catch (_) {}
    serverProcess.kill("SIGTERM");
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        try {
          serverProcess.kill("SIGKILL");
        } catch (_) {}
        serverProcess = null;
      }
    }, 1000);
  } catch (err) {
    console.error("[ServerManager] Error stopping server process:", err);
    serverProcess = null;
  }
}

function restartBackendServer(isDev) {
  stopBackendServer();
  setTimeout(() => {
    startBackendServer(isDev);
  }, 1000);
}

module.exports = {
  startBackendServer,
  stopBackendServer,
  restartBackendServer,
  isServerRunning
};
