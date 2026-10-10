import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BookOpen, CheckCheck, ChevronRight, Clock, Loader2 } from "lucide-react";
import { NotificationMessage } from "./NotificationMessage";
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
        className="relative p-2 rounded-full hover:bg-gray-100 text-muted hover:text-charcoal cursor-pointer transition-colors"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[12px] font-medium rounded-full flex items-center justify-center ring-2 ring-indigo-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div aria-label="Notification panel" className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-11 w-[calc(100vw-1.5rem)] sm:w-[420px] max-h-[75vh] overflow-hidden rounded-2xl bg-white border border-indigo-100 shadow-2xl text-charcoal z-50">
          <div className="px-4 py-3 bg-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-white/10"><Bell className="w-4 h-4 text-amber-300" /></span>
              <div>
              <p className="font-medium text-sm">Notifications</p>
              <p className="text-[12px] text-indigo-200">{unreadCount ? `${unreadCount} unread updates` : "You're all caught up"}</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-[12px] font-medium text-amber-300 hover:text-amber-200 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[55vh] overflow-y-auto p-2 space-y-2 bg-ivory-light">
            {loading && items.length === 0 ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No notifications yet.</div>
            ) : items.map(notification => (
              <button
                type="button"
                key={notification.id}
                onClick={() => void openNotification(notification)}
                className={`w-full text-left p-3 rounded-xl border hover:border-indigo-200 hover:bg-indigo-50 transition-colors flex gap-2.5 ${notification.is_read ? "bg-white border-gray-200" : "bg-white border-amber-200 shadow-sm"}`}
              >
                <span className="relative self-start rounded-lg bg-indigo-50 text-indigo p-2 shrink-0">
                  {notification.type === "bible_study_update" ? <BookOpen className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  {!notification.is_read && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-indigo-950 break-words" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>{notification.title}</span>
                  <NotificationMessage notification={notification} compact />
                  <span className="mt-2 text-[11px] text-muted flex items-center gap-1"><Clock className="w-3 h-3" />{relativeTime(notification.created_at)}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 self-center" />
              </button>
            ))}
          </div>

          <button type="button" onClick={() => { setOpen(false); onNavigate("notifications"); }} className="w-full py-3 text-xs font-medium text-indigo-700 hover:bg-indigo-50 border-t border-indigo-100">
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};
