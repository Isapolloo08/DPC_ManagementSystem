import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, AlertCircle, Monitor, Save, ChevronDown, ChevronUp,
  Link2, CheckCircle2, XCircle, RefreshCw, Server, Wifi, Globe,
  Activity, Cpu, Copy, Check, Zap, ShieldCheck, HelpCircle, Cloud
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

  const handleScanWifi = async () => {
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
  };

  const handleTestConnection = async (targetOverride?: string) => {
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
  };

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
      (window as any).electronAPI.setServerConfig({ serverIp: cleanIp }).catch((e: any) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/70 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-indigo-100/80 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col relative max-h-[92vh]">

        {/* Top Decorative Ambient Gradient Glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-indigo-50/40 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-indigo-100/70 bg-indigo-50/50 flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-3 rounded-2xl bg-indigo-800 text-white shadow-md shadow-indigo-950/20 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-indigo tracking-tight truncate">
                  System Configuration
                </h2>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${isClientNode
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isClientNode ? "bg-blue-500" : "bg-emerald-500 animate-pulse"}`} />
                  {isClientNode ? "Client Node" : "Master Host"}
                </span>
              </div>
              <p className="text-xs text-charcoal/60 font-medium truncate mt-0.5">
                Configure database server IP, device hostname & multi-computer network link
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-indigo-100/70 text-charcoal/50 hover:text-charcoal transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto relative z-10">

          {/* Information Card */}
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed shadow-2xs">
            <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="font-bold text-amber-900">Multi-Computer Wi-Fi & Laptop Setup</div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed font-medium">
                Pwedeng gamitin ang <strong className="font-black text-amber-950">Laptop/Computer Name</strong> (hal. <code className="bg-amber-200/70 px-1 py-0.2 rounded font-mono font-bold">{deviceHostname || "LAPTOP-NAME"}</code>) sa halip na IP address para <strong>hindi magbago</strong> kahit mag-restart ang Wi-Fi router.
              </p>
            </div>
          </div>

          {/* Database Server IP Address Section */}
          <div className="space-y-3 bg-slate-50/70 border border-indigo-100/70 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black tracking-wide text-indigo flex items-center gap-2 uppercase">
                <Wifi className="w-3.5 h-3.5 text-indigo" />
                <span>DATABASE SERVER IP / LAPTOP NAME / CLOUD URL</span>
              </label>
              {ipAddress.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setIpAddress("");
                    setTestStatus(null);
                    setSavedSuccess(false);
                  }}
                  className="text-[10px] font-bold text-charcoal/50 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Reset to Master PC
                </button>
              )}
            </div>

            {/* Input and Action Buttons Row */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[200px]">
                <Globe className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder={deviceHostname ? `e.g. ${deviceHostname} or 192.168.1.10` : "e.g. LAPTOP-NAME or 192.168.1.10"}
                  value={ipAddress}
                  onChange={(e) => {
                    setIpAddress(e.target.value);
                    setSavedSuccess(false);
                    setTestStatus(null);
                  }}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-3 focus:ring-indigo/15 focus:border-indigo shadow-2xs transition-all"
                />
              </div>

              {/* Scan Wi-Fi Button */}
              <button
                type="button"
                onClick={handleScanWifi}
                disabled={scanningWifi}
                title="Auto-discover Master Server on local Wi-Fi"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 text-xs font-black transition-all shrink-0 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-700 ${scanningWifi ? "animate-spin" : ""}`} />
                <span>{scanningWifi ? "Scanning..." : "Auto-Scan"}</span>
              </button>

              {/* Test Connection Button */}
              <button
                type="button"
                onClick={() => handleTestConnection()}
                disabled={testing}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-indigo hover:bg-indigo-50 text-indigo text-xs font-black transition-all shrink-0 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo" />
                ) : (
                  <Monitor className="w-3.5 h-3.5 text-indigo" />
                )}
                <span>{testing ? "Testing..." : "Test Connection"}</span>
              </button>

              {/* Save Button */}
              <button
                type="button"
                onClick={() => handleSave()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-900 text-white text-xs font-black transition-all shrink-0 shadow-md shadow-indigo-950/20 cursor-pointer active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>

            {/* Wi-Fi Discovered Server Notification Banner */}
            {discoveredServer && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                <div className="min-w-0">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Found Master Server on Wi-Fi:</span>
                    <code className="bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded font-mono font-black text-[11px]">
                      {discoveredServer.name}
                    </code>
                  </div>
                  <p className="text-[10px] text-indigo-800/80 truncate mt-0.5">
                    Latency: {discoveredServer.latency}ms • Ready to connect!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSave(discoveredServer.name);
                    handleTestConnection(discoveredServer.name);
                  }}
                  className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs cursor-pointer active:scale-95"
                >
                  Connect Now
                </button>
              </div>
            )}

            {/* Master PC Sharing Box: Laptop Name & LAN IP */}
            {!ipAddress.trim() && (
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <span>👑 This PC is Master Database Server</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    System Tray Active
                  </span>
                </div>

                {/* Option 1: Permanent Laptop Device Name */}
                {deviceHostname && (
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <span>💻 Laptop Name (Permanent):</span>
                        <code className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-black text-[11px]">
                          {deviceHostname}:4000
                        </code>
                      </div>
                      <p className="text-[10px] text-emerald-700/80 truncate mt-0.5">
                        ⭐ Rekomendado: Hindi nagbabago kahit mag-restart ang Wi-Fi router.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${deviceHostname}:4000`);
                        setCopiedDevice(true);
                        setTimeout(() => setCopiedDevice(false), 2000);
                      }}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs cursor-pointer"
                    >
                      {copiedDevice ? "Copied!" : "Copy Laptop Name"}
                    </button>
                  </div>
                )}

                {/* Option 2: LAN IP Address */}
                {localIps.length > 0 && (
                  <div className="bg-white/70 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-emerald-900 flex items-center gap-1.5 text-[11px]">
                        <span>🌐 LAN IP:</span>
                        <code className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">
                          {localIps[0]}:4000
                        </code>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${localIps[0]}:4000`);
                        setCopiedIp(true);
                        setTimeout(() => setCopiedIp(false), 2000);
                      }}
                      className="px-2.5 py-0.8 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      {copiedIp ? "Copied!" : "Copy IP"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Explanatory Bullet Points */}
            <div className="text-[11px] text-charcoal/60 space-y-1 pt-1 border-t border-indigo-100/50">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Leave <strong className="font-bold text-charcoal">blank</strong> for <strong className="font-bold text-emerald-900">Master PC</strong> (runs local server & creates System Tray icon).</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span>Enter <strong className="font-bold text-charcoal">Laptop Name</strong> or <strong className="font-bold text-charcoal">LAN IP</strong> for <strong className="font-bold text-indigo-900">Client PC</strong>.</span>
              </div>
            </div>
          </div>

          {/* Test or Save Result Alert */}
          {testStatus && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-start gap-3 shadow-2xs animate-in fade-in duration-200 ${testStatus.success
                  ? "bg-emerald-50/90 border-emerald-300 text-emerald-950"
                  : "bg-rose-50/90 border-rose-300 text-rose-950"
                }`}
            >
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${testStatus.success ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                {testStatus.success ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-sm">{testStatus.message}</div>
                  {testStatus.latency !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-white text-[10px] font-mono font-bold border border-emerald-200 text-emerald-800">
                      ⚡ {testStatus.latency}ms
                    </span>
                  )}
                </div>
                {testStatus.details && (
                  <div className="text-[11px] opacity-90 leading-relaxed font-medium">
                    {testStatus.details}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Advanced Settings */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-xl hover:bg-indigo-50/60 text-xs font-bold text-charcoal/80 hover:text-indigo transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo" />
                <span>Advanced Connection Diagnostics</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-charcoal/50" />
              ) : (
                <ChevronDown className="w-4 h-4 text-charcoal/50" />
              )}
            </button>

            {showAdvanced && (
              <div className="bg-slate-50/90 border border-indigo-100/80 rounded-2xl p-4 text-xs space-y-3 shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-charcoal">
                    <Link2 className="w-3.5 h-3.5 text-indigo" />
                    <span>Connection Info & Endpoints</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyApiUrl}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo hover:text-indigo-900 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy URL"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {/* Local Node Engine Card */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-charcoal/60 font-medium">Local Node Engine:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>

                  {/* Terminal Mode Card */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-charcoal/60 font-medium">Terminal Mode:</span>
                    <span className="font-bold text-indigo">
                      {isClientNode ? "Client Node" : "Master Host"}
                    </span>
                  </div>

                  {/* Active Protocol */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-charcoal/60 font-medium">Protocol / Port:</span>
                    <span className="font-mono font-bold text-charcoal">HTTP :4000</span>
                  </div>

                  {/* Realtime Socket Sync */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-charcoal/60 font-medium">Realtime Sync:</span>
                    <span className="font-bold text-emerald-600">Socket.IO</span>
                  </div>
                </div>

                {/* Target Database API Base URL */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider">
                    Target Database Endpoint:
                  </span>
                  <div className="font-mono text-[11px] font-bold text-indigo bg-indigo-50/50 px-2.5 py-1 rounded-lg border border-indigo-100 truncate">
                    {currentApiBase}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer with Close & Quick Actions */}
        <div className="p-4 border-t border-indigo-100/80 bg-slate-50/70 flex items-center justify-between gap-3 relative z-10">
          <button
            type="button"
            onClick={() => setIsCloudSyncOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/70 text-indigo-900 border border-indigo-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-600" />
            <span>Supabase Cloud Sync</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-300 bg-white hover:bg-indigo-50/40 text-charcoal/80 hover:text-indigo text-xs font-bold transition-all cursor-pointer text-center shadow-2xs active:scale-95"
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
