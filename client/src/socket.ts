import { io, Socket } from "socket.io-client";
import { useEffect, useState, useRef } from "react";

export const getSocketUrl = () => {
  if (typeof window !== "undefined") {
    const configuredIp = localStorage.getItem("dpc_server_ip");
    if (configuredIp && configuredIp.trim()) {
      return `http://${configuredIp.trim()}:4000`;
    }
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl;
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  const { hostname, protocol } = window.location;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1" || protocol === "file:") {
    return "http://127.0.0.1:4000";
  }
  return `${protocol}//${hostname}:4000`;
};

const SOCKET_URL = getSocketUrl();

export const socket: Socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

socket.on("connect", () => {
  console.log("⚡ [Socket.IO Client] Connected to real-time server:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 [Socket.IO Client] Disconnected from real-time server:", reason);
});

/**
 * Custom React hook to subscribe to Socket.IO events and automatically cleanup on unmount
 */
export function useSocketEvent<T = any>(
  eventName: string,
  handler: (data: T) => void,
  deps: any[] = []
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (data: T) => {
      if (handlerRef.current) {
        handlerRef.current(data);
      }
    };
    socket.on(eventName, listener);
    return () => {
      socket.off(eventName, listener);
    };
  }, [eventName, ...deps]);
}

/**
 * React hook to get live connection status
 */
export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return isConnected;
}
