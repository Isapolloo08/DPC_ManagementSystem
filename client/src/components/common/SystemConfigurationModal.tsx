import React, { useState, useEffect } from "react";
import { withOperation } from "../../services/operationActivity";
import { createPortal } from "react-dom";
import {
  X,
  AlertCircle,
  Monitor,
  Save,
  ChevronDown,
  ChevronUp,
  Link2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Wifi,
  Globe,
  Activity,
  Cpu,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Cloud,
  Laptop,
  Network,
  Sparkles,
  Info,
  Radio,
  RadioTower,
  Crown
} from "lucide-react";
import { getApiBase, normalizeServerUrl } from "../../api";
import { CloudSyncModal } from "../cloud/CloudSyncModal";

interface SystemConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SystemConfigurationModal: React.FC<SystemConfigurationModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  if (!isOpen) return null;

  const [ipAddress, setIpAddress] = useState("");
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    success: boolean;
    message: string;
    details?: string;
    latency?: number;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [copiedIp, setCopiedIp] = useState(false);
  const [deviceHostname, setDeviceHostname] = useState<string>("");
  const [copiedDevice, setCopiedDevice] = useState(false);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [discoveredServer, setDiscoveredServer] = useState<{ name: string; url: string; latency: number } | null>(null);

  useEffect(() => {
    const savedIp = localStorage.getItem("dpc_server_ip") || "";
    setIpAddress(savedIp);
    setTestStatus(null);
    setSavedSuccess(false);

    // Query Electron for current configuration, computer hostname & LAN IP addresses
    if (typeof window !== "undefined" && (window as any).electronAPI?.getServerConfig) {
      (window as any).electronAPI.getServerConfig().then((cfg: any) => {
        if (cfg?.lanIps && Array.isArray(cfg.lanIps)) {
          setLocalIps(cfg.lanIps);
        }
        if (cfg?.hostname) {
          setDeviceHostname(cfg.hostname);
        }
      }).catch((err: any) => console.warn("Failed to query electron server config:", err));
    }
  }, [isOpen]);

  const handleScanWifi = async () => withOperation("Finding local server…", async () => {
    setScanningWifi(true);
    setDiscoveredServer(null);
    setTestStatus(null);

    const candidates: string[] = [];
    if (deviceHostname) {
      candidates.push(deviceHostname);
      candidates.push(`${deviceHostname}.local`);
    }
    for (const ip of localIps) {
      candidates.push(ip);
    }
    candidates.push("localhost", "127.0.0.1");

    let found: { name: string; url: string; latency: number } | null = null;

    for (const target of candidates) {
      const baseUrl = normalizeServerUrl(target);
      const testUrl = `${baseUrl}/api/health`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const startTime = performance.now();
        const res = await fetch(testUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const latency = Math.round(performance.now() - startTime);
          found = { name: target, url: baseUrl, latency };
          break;
        }
      } catch (_) {}
    }

    setScanningWifi(false);
    if (found) {
      setDiscoveredServer(found);
    } else {
      setTestStatus({
        success: false,
        message: "No Master Server found on local Wi-Fi scan.",
        details: "Ensure the Master PC is running and connected to the same Wi-Fi network."
      });
    }
  });

  const handleTestConnection = async (targetOverride?: string) => withOperation("Testing server connection…", async () => {
    setTesting(true);
    setTestStatus(null);
    setSavedSuccess(false);

    const rawTarget = typeof targetOverride === "string" ? targetOverride : ipAddress;
    const cleanInput = rawTarget.trim();
    const baseUrl = cleanInput ? normalizeServerUrl(cleanInput) : "http://127.0.0.1:4000";
    const testUrl = `${baseUrl}/api/health`;
    const isCloud = baseUrl.includes("onrender.com") || baseUrl.startsWith("https://");

    try {
      const controller = new AbortController();
      const timeoutMs = isCloud ? 18000 : 5000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const startTime = performance.now();
      const res = await fetch(testUrl, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestStatus({
          success: true,
          message: `Connected to Database Server! (${latency}ms)`,
          details: `Endpoint verified at ${baseUrl}. ${data.service ? `• ${data.service}` : ""}`,
          latency
        });
      } else {
        setTestStatus({
          success: false,
          message: `Server responded with HTTP ${res.status}`,
          details: `Reached ${baseUrl}, but health check returned an unexpected status code ${res.status}.`,
          latency
        });
      }
    } catch (err: any) {
      const isTimeout = err.name === "AbortError";
      setTestStatus({
        success: false,
        message: isTimeout ? (isCloud ? "Cloud Server Starting Up / Timed Out" : "Connection Timed Out (5s)") : "Could Not Reach Database Server",
        details: isCloud
          ? `Unable to connect to ${testUrl}. If your Render backend is on the Free tier and sleeping, it may take 30-50s to wake up. Please verify your Render service is 'Live' and try again.`
          : `Unable to connect to ${testUrl}. Ensure the server is running, connected to the same Wi-Fi/LAN, and port 4000 is allowed through Windows Firewall.`
      });
    } finally {
      setTesting(false);
    }
  });

  const handleSave = (customIp?: string) => {
    const rawTarget = typeof customIp === "string" ? customIp : ipAddress;
    const cleanIp = rawTarget.trim();
    if (!cleanIp) {
      localStorage.removeItem("dpc_server_ip");
      setIpAddress("");
    } else {
      localStorage.setItem("dpc_server_ip", cleanIp);
      setIpAddress(cleanIp);
    }

    // Inform Electron Main Process to update Server & Tray Mode immediately
    if (typeof window !== "undefined" && (window as any).electronAPI?.setServerConfig) {
      withOperation("Applying server settings…", () => (window as any).electronAPI.setServerConfig({ serverIp: cleanIp }), 1).catch((e: any) => {
        console.warn("Electron server config sync:", e);
      });
    }

    const resolved = cleanIp ? normalizeServerUrl(cleanIp) : "localhost:4000";

    setSavedSuccess(true);
    setTestStatus({
      success: true,
      message: "Server configuration saved successfully!",
      details: cleanIp
        ? `This terminal will now connect to Database Server at ${resolved} (Client PC mode — System Tray hidden).`
        : "Operating as Master PC (Port 4000 active — System Tray visible)."
    });

    if (onConfigSaved) {
      onConfigSaved();
    }
  };

  const handleCopyApiUrl = () => {
    const url = getApiBase();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentApiBase = getApiBase();
  const isClientNode = Boolean(ipAddress.trim());

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div data-modal-panel className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col relative max-h-[92vh]">

        {/* Modal Header */}
        <div data-modal-header className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-700 text-white shadow-sm shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-slate-900 tracking-tight truncate">
                  System Configuration
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium tracking-wide border ${
                    isClientNode
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isClientNode ? "bg-blue-500" : "bg-emerald-500 animate-pulse"
                    }`}
                  />
                  {isClientNode ? "Client Node" : "Master Host"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                Configure database server connection, hostname & network link
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4.5 flex-1 overflow-y-auto relative z-10">

          {/* Setup Tip Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 flex items-start gap-3 text-xs leading-relaxed">
            <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="font-medium text-slate-900">Multi-Computer Wi-Fi & Laptop Setup</div>
              <p className="text-[12px] text-slate-600 leading-relaxed">
                Maaaring gamitin ang <strong className="font-medium text-slate-800">Computer Name</strong> (hal. <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-mono font-medium text-slate-900 text-[12px]">{deviceHostname || "LEAVESERVER"}</code>) sa halip na IP address para hindi magbago kahit mag-restart ang Wi-Fi router.
              </p>
            </div>
          </div>

          {/* Database Server IP Address Section */}
          <div className="space-y-3 bg-slate-50/50 border border-slate-200 rounded-xl p-4.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                <span>Database Server Address / Hostname / Cloud URL</span>
              </label>
              {ipAddress.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setIpAddress("");
                    setTestStatus(null);
                    setSavedSuccess(false);
                  }}
                  className="text-[12px] font-medium text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Reset to Master PC
                </button>
              )}
            </div>

            {/* Input Row */}
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder={deviceHostname ? `e.g. ${deviceHostname} or 192.168.1.10` : "e.g. LAPTOP-NAME or 192.168.1.10"}
                value={ipAddress}
                onChange={(e) => {
                  setIpAddress(e.target.value);
                  setSavedSuccess(false);
                  setTestStatus(null);
                }}
                className="w-full pl-10 pr-3.5 py-2.5 bg-white rounded-lg border border-slate-300 text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
              />
            </div>

            {/* Actions Row: Auto-Scan, Test Connection, Save */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleScanWifi}
                disabled={scanningWifi}
                title="Auto-discover Master Server on local Wi-Fi"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 active:scale-98 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${scanningWifi ? "animate-spin" : ""}`} />
                <span>{scanningWifi ? "Scanning..." : "Auto-Scan Wi-Fi"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestConnection()}
                disabled={testing}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 active:scale-98 shadow-2xs"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>{testing ? "Testing..." : "Test Connection"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSave()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-medium transition-all shadow-sm cursor-pointer active:scale-98"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Config</span>
              </button>
            </div>

            {/* Wi-Fi Discovered Server Notification Banner */}
            {discoveredServer && (
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span>Found Master Server:</span>
                      <code className="bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded font-mono font-medium text-[12px]">
                        {discoveredServer.name}
                      </code>
                    </div>
                    <p className="text-[12px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>{discoveredServer.latency}ms latency • Ready to connect</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSave(discoveredServer.name);
                    handleTestConnection(discoveredServer.name);
                  }}
                  className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-medium shrink-0 transition-colors shadow-2xs cursor-pointer active:scale-98"
                >
                  Connect & Save
                </button>
              </div>
            )}

            {/* Master PC Sharing Box: Computer Name & LAN IP */}
            {!ipAddress.trim() && (
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 text-xs flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-600" />
                    <span>This PC is the Master Database Server</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    System Tray Active
                  </span>
                </div>

                {/* Option 1: Permanent Laptop Device Name */}
                {deviceHostname && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                        <Laptop className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Computer Name:</span>
                        <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono font-medium text-[12px] border border-slate-200">
                          {deviceHostname}:4000
                        </code>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-[12px] uppercase tracking-wider">
                          <Sparkles className="w-2.5 h-2.5" />
                          Recommended
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-500 truncate">
                        Stable host identifier — does not change when Wi-Fi restarts.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${deviceHostname}:4000`);
                        setCopiedDevice(true);
                        setTimeout(() => setCopiedDevice(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer border border-slate-200 active:scale-98"
                    >
                      {copiedDevice ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Host</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Option 2: LAN IP Address */}
                {localIps.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                        <Network className="w-4 h-4 text-slate-600 shrink-0" />
                        <span>Local Network IP (LAN):</span>
                        <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono font-medium text-[12px] border border-slate-200">
                          {localIps[0]}:4000
                        </code>
                      </div>
                      <p className="text-[12px] text-slate-500 truncate">
                        Standard IP address assigned by local Wi-Fi router.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${localIps[0]}:4000`);
                        setCopiedIp(true);
                        setTimeout(() => setCopiedIp(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer border border-slate-200 active:scale-98"
                    >
                      {copiedIp ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy IP</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Mode Guide Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-[12px] text-slate-600">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-[12px] shrink-0 mt-0.5">
                  Master Host
                </span>
                <span>Leave blank on the main PC running the local server.</span>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-[12px] text-slate-600">
                <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-medium text-[12px] shrink-0 mt-0.5">
                  Client Node
                </span>
                <span>Enter Master Computer Name or LAN IP on other PCs.</span>
              </div>
            </div>
          </div>

          {/* Test or Save Result Alert */}
          {testStatus && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 shadow-2xs animate-in fade-in duration-200 ${
                testStatus.success
                  ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
                  : "bg-rose-50/90 border-rose-200 text-rose-950"
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  testStatus.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {testStatus.success ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-xs">{testStatus.message}</div>
                  {testStatus.latency !== undefined && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[12px] font-mono font-medium border border-emerald-200 text-emerald-800">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {testStatus.latency}ms
                    </span>
                  )}
                </div>
                {testStatus.details && (
                  <div className="text-[12px] opacity-85 leading-relaxed font-normal">
                    {testStatus.details}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Advanced Settings */}
          <div className="space-y-2 pt-0.5">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-slate-100/70 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>Advanced Connection Diagnostics</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3 shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Connection Info & Endpoints</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyApiUrl}
                    className="flex items-center gap-1 text-[12px] font-medium text-indigo-700 hover:text-indigo-900 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy URL"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                  {/* Local Node Engine Card */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Local Node Engine:</span>
                    <span className="font-medium text-emerald-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>

                  {/* Terminal Mode Card */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Terminal Mode:</span>
                    <span className="font-medium text-slate-800">
                      {isClientNode ? "Client Node" : "Master Host"}
                    </span>
                  </div>

                  {/* Active Protocol */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Protocol / Port:</span>
                    <span className="font-mono font-medium text-slate-800">HTTP :4000</span>
                  </div>

                  {/* Realtime Socket Sync */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Realtime Sync:</span>
                    <span className="font-medium text-emerald-700">Socket.IO</span>
                  </div>
                </div>

                {/* Target Database API Base URL */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <span className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">
                    Target Database Endpoint:
                  </span>
                  <div className="font-mono text-[12px] font-medium text-indigo-900 bg-indigo-50/50 px-2.5 py-1.5 rounded-md border border-indigo-100 truncate select-text">
                    {currentApiBase}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer with Close & Quick Actions */}
        <div data-modal-footer className="p-4 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between gap-3 relative z-10">
          <button
            type="button"
            onClick={() => setIsCloudSyncOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all cursor-pointer shadow-2xs active:scale-98"
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-600" />
            <span>Supabase Cloud Sync</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300/80 text-slate-700 text-xs font-medium transition-all cursor-pointer text-center active:scale-98"
          >
            Close
          </button>
        </div>

      </div>

      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
      />
    </div>,
    document.body
  );
};
