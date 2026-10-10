import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Cloud, Copy, Laptop, Monitor, Network, PlugZap, Radar, Server, X } from "lucide-react";
import { getApiBase, normalizeServerUrl } from "../../api";
import { withOperation } from "../../services/operationActivity";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { Button } from "./Button";
import { ViewportOverlay } from "./ViewportOverlay";
import { CloudSyncModal } from "../cloud/CloudSyncModal";

interface Props { isOpen: boolean; onClose: () => void; onConfigSaved?: () => void }
interface ServerConfig { hostname?: string; lanIps?: string[]; isMaster?: boolean; isServerRunning?: boolean }
interface ServerBridge {
  getServerConfig?: () => Promise<ServerConfig>;
  setServerConfig?: (config: { serverIp: string }) => Promise<{ success?: boolean }>;
}
interface Feedback { success: boolean; message: string; details?: string }

function ConfigurationSurface({ onClose, busy, children }: { onClose: () => void; busy: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose, busy);
  return <ViewportOverlay className="z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="system-configuration-title" aria-describedby="system-configuration-description"
      tabIndex={-1} data-modal-panel className="bg-white border border-indigo-100 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden text-charcoal">
      {children}
    </div>
  </ViewportOverlay>;
}

// Mount a fresh draft each time; hooks and focus cleanup run even when closed.
export function SystemConfigurationModal(props: Props) {
  return props.isOpen ? <SystemConfigurationDialog {...props} /> : null;
}

function SystemConfigurationDialog({ onClose, onConfigSaved }: Props) {
  const [address, setAddress] = useState(() => localStorage.getItem("dpc_server_ip") || "");
  const [mode, setMode] = useState<"local" | "remote">(() => localStorage.getItem("dpc_server_ip")?.trim() ? "remote" : "local");
  const [config, setConfig] = useState<ServerConfig>({});
  const [testing, setTesting] = useState(false);
  const [finding, setFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [found, setFound] = useState<{ name: string; url: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [cloudOpen, setCloudOpen] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = testing || finding || saving;
  const bridge = (window as Window & { electronAPI?: ServerBridge }).electronAPI;

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    bridge?.getServerConfig?.().then(value => { if (active) setConfig(value || {}); }).catch(() => {});
    return () => {
      active = false;
      mountedRef.current = false;
      controllerRef.current?.abort();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const clearFeedback = () => { setFeedback(null); setFound(null); };
  const targetAddress = mode === "local" ? "" : address.trim();
  const resolveTarget = (raw: string) => {
    if (!raw) return "http://127.0.0.1:4000";
    const normalized = normalizeServerUrl(raw);
    const url = new URL(normalized);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || /\s/.test(raw) || url.search || url.hash) {
      throw new Error("Enter a computer name, IP address, or an HTTP/HTTPS server URL without credentials, spaces, or query parameters.");
    }
    return normalized;
  };

  const checkHealth = async (base: string, timeout: number) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(`${base}/api/health`, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const testConnection = async () => withOperation("Testing server connection…", async () => {
    setTesting(true);
    setFeedback(null);
    try {
      if (mode === "remote" && !targetAddress) throw new Error("Enter the main computer’s server address first.");
      const base = resolveTarget(targetAddress);
      const start = performance.now();
      const response = await checkHealth(base, base.startsWith("https://") ? 18000 : 5000);
      setFeedback(response.ok
        ? { success: true, message: "Connected to Database Server!", details: `Connection verified in ${Math.round(performance.now() - start)} ms. You can save this connection.` }
        : { success: false, message: "The server responded, but is not ready.", details: `Health check returned HTTP ${response.status}. Try again or check the main computer.` });
    } catch (error) {
      setFeedback({ success: false, message: "Could not connect to the server.", details: error instanceof Error && error.name !== "TypeError" && error.name !== "AbortError"
        ? error.message : "Check the address and make sure the main computer is running DPC. Local computers must be on the same network. A sleeping online server may need another attempt." });
    } finally { setTesting(false); }
  });

  const findServer = async () => withOperation("Finding local server…", async () => {
    setFinding(true);
    clearFeedback();
    try {
      const candidates = [...new Set([...(config.hostname ? [config.hostname, `${config.hostname}.local`] : []), ...(config.lanIps || []), "localhost", "127.0.0.1"])];
      for (const name of candidates) {
        if (!mountedRef.current) return;
        const url = normalizeServerUrl(name);
        try {
          if ((await checkHealth(url, 1200)).ok) { setFound({ name, url }); return; }
        } catch { /* Continue through known local addresses. */ }
      }
      setFeedback({ success: false, message: "No local server found.", details: "This checks known addresses on this computer. You can enter the main computer’s name or IP address manually." });
    } finally { setFinding(false); }
  });

  const saveConnection = async () => withOperation("Applying server settings…", async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (mode === "remote" && !targetAddress) throw new Error("Enter the main computer’s server address first.");
      resolveTarget(targetAddress);
      if (bridge?.setServerConfig) {
        const result = await bridge.setServerConfig({ serverIp: targetAddress });
        if (result?.success === false) throw new Error("The desktop app could not apply this connection. Try saving again.");
      }
      if (targetAddress) localStorage.setItem("dpc_server_ip", targetAddress);
      else localStorage.removeItem("dpc_server_ip");
      setFeedback({ success: true, message: "Connection saved.", details: onConfigSaved ? "The app will reload using this connection." : "This connection will be used when the app reloads." });
      onConfigSaved?.();
    } catch (error) {
      setFeedback({ success: false, message: "Connection was not saved.", details: error instanceof Error ? error.message : "Please try again." });
    } finally { setSaving(false); }
  }, 1);

  const copyAddress = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(""), 2000);
    } catch { setFeedback({ success: false, message: "Could not copy the address.", details: "You can select the address and copy it manually." }); }
  };

  const copyButton = (text: string, label: string) => <Button size="sm" onClick={() => void copyAddress(text, label)} aria-label={`Copy ${label}`}>
    {copied === label ? <Check aria-hidden="true" className="w-4 h-4" /> : <Copy aria-hidden="true" className="w-4 h-4" />}{copied === label ? "Copied" : "Copy"}
  </Button>;

  if (cloudOpen) return <CloudSyncModal isOpen onClose={() => setCloudOpen(false)} />;

  return <ConfigurationSurface onClose={onClose} busy={busy}>
    <header data-modal-header className="px-5 sm:px-6 py-5 border-b border-indigo-100 flex items-start gap-3">
      <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo shrink-0"><Network aria-hidden="true" className="w-6 h-6" /></div>
      <div className="flex-1 min-w-0">
        <h2 id="system-configuration-title" className="text-lg font-semibold text-indigo-950">System Configuration</h2>
        <p id="system-configuration-description" className="ui-help mt-1">Choose where this computer connects to DPC.</p>
      </div>
      <Button variant="ghost" size="icon" disabled={busy} aria-label="Close system configuration" onClick={onClose}><X aria-hidden="true" className="w-5 h-5" /></Button>
    </header>

    <div data-modal-body className="px-5 sm:px-6 py-5 space-y-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      <fieldset disabled={busy} className="space-y-3">
        <legend className="text-sm font-semibold text-indigo-950 mb-3">Where is your DPC server?</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: "local", title: "This computer", description: "The main PC that runs DPC.", Icon: Monitor },
            { value: "remote", title: "Another computer", description: "Connect to the main PC or an online server.", Icon: Laptop },
          ] as const).map(({ value, title, description, Icon }) => <label key={value} className={`relative flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${mode === value ? "bg-indigo-50 border-indigo-400" : "bg-white border-gray-200 hover:border-indigo-300"}`}>
            <input type="radio" name="server-location" value={value} checked={mode === value} onChange={() => { setMode(value); clearFeedback(); }} className="mt-1 accent-indigo-600 shrink-0" />
            <div className="min-w-0"><div className="flex items-center gap-2 font-medium text-sm text-indigo-950"><Icon aria-hidden="true" className="w-4 h-4 shrink-0" />{title}</div><p className="ui-help mt-1">{description}</p></div>
          </label>)}
        </div>
      </fieldset>

      {mode === "remote" ? <section className="space-y-3" aria-label="Remote server connection">
        <label className="ui-field" htmlFor="dpc-server-address">Server address</label>
        <input id="dpc-server-address" className="ui-input" disabled={busy} autoComplete="off" spellCheck={false}
          placeholder="e.g. CHURCH-PC or 192.168.1.10" aria-describedby="server-address-help" value={address}
          onChange={event => { setAddress(event.target.value); clearFeedback(); }} />
        <p id="server-address-help" className="ui-help">Use the main computer’s name or network IP. An online server URL such as https://your-server.example is also supported.</p>
        <Button disabled={busy} pending={finding} onClick={() => void findServer()}>{!finding && <Radar aria-hidden="true" className="w-4 h-4" />}{finding ? "Looking for server…" : "Find local server"}</Button>
        <p className="text-xs text-muted">Checks this computer and its known local addresses.</p>
        {found && <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2" role="status">
          <p className="text-sm text-indigo-950 font-medium">Server found: <span className="break-all">{found.name}</span></p>
          <Button size="sm" disabled={busy} onClick={() => { setAddress(found.url); setFound(null); setFeedback(null); }}><Check aria-hidden="true" className="w-4 h-4" />Use this address</Button>
        </div>}
      </section> : <section aria-label="Main computer connection" className="space-y-3">
        <p className="ui-help">DPC will use the local server on this computer. No server address is needed.</p>
        {config.isServerRunning !== undefined && <p className={`text-sm flex items-center gap-2 ${config.isServerRunning ? "text-emerald-700" : "text-amber-800"}`}><Server aria-hidden="true" className="w-4 h-4" />{config.isServerRunning ? "Local server is running" : "Local server is not running"}</p>}
        {(config.hostname || config.lanIps?.length) && <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50"><h3 className="font-medium text-sm text-indigo-950">Connect your other computers</h3><p className="ui-help mt-1">Enter one of these addresses on computers using the same network.</p></div>
          {config.hostname && <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-gray-200">
            <div className="min-w-0"><p className="text-xs text-muted mb-1">Computer name · recommended</p><code className="text-sm text-charcoal break-all select-text">{config.hostname}:4000</code></div>{copyButton(`${config.hostname}:4000`, "computer name")}
          </div>}
          {config.lanIps?.[0] && <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-gray-200">
            <div className="min-w-0"><p className="text-xs text-muted mb-1">Network IP · may change after router restart</p><code className="text-sm text-charcoal break-all select-text">{config.lanIps[0]}:4000</code></div>{copyButton(`${config.lanIps[0]}:4000`, "network IP")}
          </div>}
        </div>}
      </section>}

      <div className="space-y-3">
        <Button pending={testing} disabled={busy || (mode === "remote" && !targetAddress)} onClick={() => void testConnection()}>{!testing && <PlugZap aria-hidden="true" className="w-4 h-4" />}{testing ? "Checking connection…" : "Test Connection"}</Button>
        {feedback && <div role={feedback.success ? "status" : "alert"} className={`rounded-xl border p-3 flex items-start gap-2.5 ${feedback.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>
          {feedback.success ? <CheckCircle2 aria-hidden="true" className="w-5 h-5 shrink-0" /> : <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />}
          <div className="min-w-0"><p className="font-medium text-sm">{feedback.message}</p>{feedback.details && <p className="text-xs leading-relaxed mt-1 break-words">{feedback.details}</p>}</div>
        </div>}
      </div>

      <details className="border-t border-gray-200 pt-4 group">
        <summary tabIndex={0} className="cursor-pointer flex items-center justify-between text-sm font-medium text-indigo-950 list-none rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">Connection details<ChevronDown aria-hidden="true" className="w-4 h-4 group-open:rotate-180 transition-transform" /></summary>
        <div className="pt-4 space-y-3">
          <p className="ui-help">Currently saved connection. Changes above take effect after saving.</p>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted mb-1">Current API address</p><code className="text-xs break-all select-text">{getApiBase()}</code></div>{copyButton(getApiBase(), "current API address")}</div>
          <p className="ui-help">Supabase sync creates an offsite copy of your data. It is managed separately from this server connection.</p>
          <Button size="sm" disabled={busy} onClick={() => setCloudOpen(true)}><Cloud aria-hidden="true" className="w-4 h-4" />Open cloud sync</Button>
        </div>
      </details>
    </div>

    <footer data-modal-footer className="px-5 sm:px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 shrink-0">
      <Button disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="primary" pending={saving} disabled={busy || (mode === "remote" && !targetAddress)} onClick={() => void saveConnection()}>{!saving && <Check aria-hidden="true" className="w-4 h-4" />}{saving ? "Saving…" : "Save connection"}</Button>
    </footer>
  </ConfigurationSurface>;
}
