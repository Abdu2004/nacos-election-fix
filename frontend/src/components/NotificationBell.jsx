import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Megaphone,
  UserCheck,
  BellRing,
  Check,
  Clock,
  ExternalLink
} from 'lucide-react';

export default function NotificationBell({ onNavigate }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifs = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await getNotifications();
      setNotifications(res?.data?.notifications || []);
      setUnreadCount(res?.data?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }

    if (notif.link && onNavigate) {
      onNavigate(notif.link.replace('/', ''));
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'VERIFICATION_REQUEST':
        return <UserCheck className="w-4 h-4 text-blue-400" />;
      case 'VERIFICATION_STATUS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-4 h-4 text-purple-400" />;
      case 'PING':
        return <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-slate-950 shadow-md shadow-emerald-500/50 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Notifications</h4>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-500 space-y-1">
                <Bell className="w-8 h-8 mx-auto text-slate-700 mb-2" />
                <p className="text-xs font-semibold text-slate-400">No Notifications</p>
                <p className="text-[11px] text-slate-500">You're all caught up with announcements and updates.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 hover:bg-slate-850/80 cursor-pointer transition flex items-start gap-3 ${
                    !n.is_read ? 'bg-slate-950/70 border-l-2 border-l-emerald-500' : 'bg-transparent opacity-80'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/80 shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h5 className="text-xs font-bold text-white truncate">{n.title}</h5>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">{n.message}</p>
                    {n.link && (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
                        View details <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
