import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronRight, Clock, Loader2 } from "lucide-react";
import { api } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useSocketEvent } from "../../socket";
import { AppNotification } from "../../types";

interface NotificationBellProps {
  onNavigate: (tab: string, refId?: number | null) => void;
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notifications, count] = await Promise.all([
        api.getNotifications({ page: 1, page_size: 10 }),
        api.getUnreadNotificationCount()
      ]);
      setItems(notifications.items);
      setUnreadCount(count.count);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useSocketEvent<AppNotification>("notification:new", notification => {
    setItems(previous => [notification, ...previous.filter(item => item.id !== notification.id)].slice(0, 10));
    setUnreadCount(previous => previous + 1);
    showToast(notification.title, "info", 6000);
  }, [showToast]);

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await api.markNotificationRead(notification.id).catch(() => undefined);
      setUnreadCount(previous => Math.max(0, previous - 1));
      setItems(previous => previous.map(item => item.id === notification.id ? { ...item, is_read: true } : item));
    }
    setOpen(false);
    if (notification.link_tab) onNavigate(notification.link_tab, notification.link_ref_id);
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setUnreadCount(0);
    setItems(previous => previous.map(item => ({ ...item, is_read: true })));
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen(value => !value); if (!open) void load(); }}
        className="relative p-2 rounded-full hover:bg-indigo-700/60 text-indigo-200 hover:text-white cursor-pointer transition-colors"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-indigo-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-11 w-[calc(100vw-1.5rem)] sm:w-96 max-h-[75vh] overflow-hidden rounded-2xl bg-white border border-indigo-100 shadow-2xl text-charcoal z-50">
          <div className="px-4 py-3 bg-indigo-950 text-white flex items-center justify-between">
            <div>
              <p className="font-black text-sm">Notifications</p>
              <p className="text-[10px] text-indigo-200">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-[10px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[55vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No notifications yet.</div>
            ) : items.map(notification => (
              <button
                type="button"
                key={notification.id}
                onClick={() => void openNotification(notification)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-indigo-50 transition-colors flex gap-3 ${notification.is_read ? "bg-white" : "bg-amber-50/60"}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notification.is_read ? "bg-slate-300" : "bg-amber-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black text-indigo-950 truncate">{notification.title}</span>
                  <span className="block text-[11px] text-slate-600 line-clamp-2 mt-0.5 whitespace-pre-line">{notification.message}</span>
                  <span className="mt-1 text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{relativeTime(notification.created_at)}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 self-center" />
              </button>
            ))}
          </div>

          <button type="button" onClick={() => { setOpen(false); onNavigate("notifications"); }} className="w-full py-3 text-xs font-black text-indigo-700 hover:bg-indigo-50 border-t border-indigo-100">
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};
