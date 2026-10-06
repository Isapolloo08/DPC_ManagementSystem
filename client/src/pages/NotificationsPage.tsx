import React, { useCallback, useEffect, useState } from "react";
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, Loader2, MailOpen, Trash2 } from "lucide-react";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { useToast } from "../context/ToastContext";
import { useSocketEvent } from "../socket";
import { AppNotification, NotificationEventType } from "../types";

interface NotificationsPageProps {
  onNavigate: (tab: string, refId?: number | null) => void;
}

const TYPE_LABELS: Record<NotificationEventType, string> = {
  absence_alert: "Absence alert",
  session_rescheduled: "Session rescheduled",
  at_risk_member: "At-risk member",
  sunday_absence_streak: "Sunday absence streak",
  duty_incomplete: "Duty incomplete",
  dishwashing_unresolved: "Dishwashing unresolved"
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [type, setType] = useState<NotificationEventType | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const guideData = useGuideDataState("notifications", { loading, count: items.length, filtered: unreadOnly || Boolean(type), retry: () => load() });

  const load = useCallback(async () => {
    guideData.clearError();
    setLoading(true);
    try {
      const response = await api.getNotifications({ unread: unreadOnly, type, page, page_size: 20 });
      setItems(response.items);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      guideData.reportError(error);
      showToast(error instanceof Error ? error.message : "Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  }, [page, showToast, type, unreadOnly]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => setPage(1), [type, unreadOnly]);
  useSocketEvent<AppNotification>("notification:new", () => void load(), [load]);

  const toggleRead = async (notification: AppNotification) => {
    if (notification.is_read) await api.markNotificationUnread(notification.id);
    else await api.markNotificationRead(notification.id);
    await load();
  };

  const openItem = async (notification: AppNotification) => {
    if (!notification.is_read) await api.markNotificationRead(notification.id);
    if (notification.link_tab) onNavigate(notification.link_tab, notification.link_ref_id);
    else await load();
  };

  const deleteItem = async (notification: AppNotification) => {
    await api.deleteNotification(notification.id);
    showToast("Notification deleted", "success");
    await load();
  };

  const markAll = async () => {
    await api.markAllNotificationsRead();
    showToast("All notifications marked as read", "success");
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-indigo-950 text-white p-5 sm:p-7 shadow-xl border border-indigo-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber-400/15 border border-amber-300/30"><Bell className="w-7 h-7 text-amber-300" /></div>
          <div><h1 className="text-xl sm:text-2xl font-semibold">Notifications</h1><p className="text-xs text-indigo-200 mt-1">Updates addressed to your account and ministry responsibilities.</p></div>
        </div>
        <button data-guide="notifications-mark-all" type="button" onClick={() => void markAll()} className="px-4 py-2.5 rounded-xl bg-amber-400 text-indigo-950 text-xs font-medium flex items-center justify-center gap-2 hover:bg-amber-300">
          <CheckCheck className="w-4 h-4" /> Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          <button data-guide="notifications-all" type="button" onClick={() => setUnreadOnly(false)} className={`px-4 py-2 rounded-lg text-xs font-medium ${!unreadOnly ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>All</button>
          <button data-guide="notifications-unread" type="button" onClick={() => setUnreadOnly(true)} className={`px-4 py-2 rounded-lg text-xs font-medium ${unreadOnly ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Unread</button>
        </div>
        <select value={type} onChange={event => setType(event.target.value as NotificationEventType | "")} className="sm:ml-auto px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white text-slate-700">
          <option value="">All notification types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span className="text-[12px] text-slate-500 font-medium">{total} result{total === 1 ? "" : "s"}</span>
      </div>

      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
        {loading ? <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div> : items.length === 0 ? (
          <div className="py-16 text-center"><Bell className="w-10 h-10 mx-auto text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-500">No notifications match this filter.</p></div>
        ) : items.map(notification => (
          <div key={notification.id} className={`p-4 sm:p-5 border-b border-slate-100 last:border-0 flex gap-3 ${notification.is_read ? "bg-white" : "bg-amber-50/40"}`}>
            <button data-guide="notifications-open" type="button" onClick={() => void openItem(notification)} className="flex-1 min-w-0 text-left flex gap-3">
              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${notification.is_read ? "bg-slate-300" : "bg-amber-500"}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-indigo-950">{notification.title}</strong>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[12px] font-medium uppercase">{TYPE_LABELS[notification.type] || notification.type}</span>
                  {notification.recipient_name && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[12px] font-medium">To: {notification.recipient_name}</span>
                  )}
                </span>
                <span className="block mt-1 text-xs text-slate-600 whitespace-pre-line leading-relaxed">{notification.message}</span>
                <span className="block mt-2 text-[12px] text-slate-400">{new Date(notification.created_at).toLocaleString()}</span>
              </span>
            </button>
            <div className="flex items-start gap-1 shrink-0">
              <button data-guide="notifications-read" type="button" onClick={() => void toggleRead(notification)} title={notification.is_read ? "Mark unread" : "Mark read"} className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50">{notification.is_read ? <MailOpen className="w-4 h-4" /> : <Check className="w-4 h-4" />}</button>
              <button type="button" onClick={() => void deleteItem(notification)} title="Delete" className="p-2 rounded-xl text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium disabled:opacity-40 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Previous</button>
        <span className="text-xs font-medium text-slate-500">Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium disabled:opacity-40 flex items-center gap-1">Next <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
};
