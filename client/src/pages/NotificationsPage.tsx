import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/common/Button";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, MailOpen, Trash2 } from "lucide-react";
import { ListSkeleton } from "../components/common/SkeletonLoader";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { useToast } from "../context/ToastContext";
import { useSocketEvent } from "../socket";
import { AppNotification, NotificationEventType } from "../types";
import { NotificationMessage } from "../components/notifications/NotificationMessage";

interface NotificationsPageProps {
  onNavigate: (tab: string, refId?: number | null) => void;
}

const TYPE_LABELS: Record<NotificationEventType, string> = {
  bible_study_update: "Bible study update",
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
  const [pageSize, setPageSize] = useState(20);
  const sequence = useRef(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const guideData = useGuideDataState("notifications", { loading, count: items.length, filtered: unreadOnly || Boolean(type), retry: () => load() });

  const load = useCallback(async () => {
    const current = ++sequence.current;
    guideData.clearError();
    setLoading(true);
    try {
      const response = await api.getNotifications({ unread: unreadOnly, type, page, page_size: pageSize });
      if (current !== sequence.current) return;
      setItems(response.items);
      if (page > Math.max(1, response.totalPages)) setPage(Math.max(1, response.totalPages));
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      if (current !== sequence.current) return;
      guideData.reportError(error);
      showToast(error instanceof Error ? error.message : "Failed to load notifications", "error");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [page, pageSize, showToast, type, unreadOnly]);

  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
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
      <PageHeader icon={<Bell />} title={<>Notifications</>}
        description={<>Updates addressed to your account and ministry responsibilities.</>}
        actions={<><Button data-guide="notifications-mark-all" type="button" onClick={() => void markAll()} variant="primary">
          <CheckCheck className="w-4 h-4" /> Mark all as read
        </Button></>} />

      <FilterPanel title="Notification filters" summary={[unreadOnly ? "Unread" : "All notifications", type && TYPE_LABELS[type]].filter(Boolean).join(" · ")}>
        <div className="filter-panel-layout bg-white rounded-2xl border border-indigo-100 shadow-sm p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
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
      </FilterPanel>

      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
        {loading ? <ListSkeleton label="Loading notifications..." /> : items.length === 0 ? (
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
                <NotificationMessage notification={notification} />
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

      <Pagination label="notifications" page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} loading={loading} />
    </div>
  );
};
