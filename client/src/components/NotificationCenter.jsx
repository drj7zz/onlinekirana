import { useEffect, useRef, useState } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';

const decodeVapidKey = (key) => {
  const padding = '='.repeat((4 - key.length % 4) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
};

const timeLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [push, setPush] = useState({ enabled: false, publicKey: '' });
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => {
    if (!user) return;
    API.get('/notifications').then(({ data }) => {
      setItems(data.items || []);
      setUnreadCount(data.unreadCount || 0);
      setPush(data.push || { enabled: false, publicKey: '' });
    }).catch(() => {});
  };
  useLive(load, 20000, [user?._id]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (root.current && !root.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return undefined;
    let active = true;
    navigator.serviceWorker.getRegistration('/').then(async (registration) => {
      const current = await registration?.pushManager.getSubscription();
      if (active) setSubscribed(Boolean(current));
    }).catch(() => {});
    return () => { active = false; };
  }, [user?._id]);

  if (!user) return null;

  const enablePush = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (!push.enabled || !push.publicKey) throw new Error('Browser push is not configured on this server.');
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('This browser does not support push notifications.');
      }
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Allow notifications in your browser to turn push on.');
      const registration = await navigator.serviceWorker.register('/push-sw.js');
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(push.publicKey),
      });
      await API.post('/notifications/subscriptions', subscription.toJSON());
      setSubscribed(true);
      setMessage('Browser notifications are on.');
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || 'Could not enable browser notifications.');
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await API.delete('/notifications/subscriptions', { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage('Browser notifications are off.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not disable browser notifications.');
    } finally {
      setBusy(false);
    }
  };

  const openNotice = async (notice) => {
    setOpen(false);
    if (!notice.readAt) {
      await API.patch(`/notifications/${notice._id}/read`).catch(() => {});
      setItems((current) => current.map((item) => item._id === notice._id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    navigate(notice.link || '/');
  };

  const markAllRead = async () => {
    await API.patch('/notifications/read-all').catch(() => {});
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  };

  return (
    <div className="notification-center" ref={root}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); setMessage(''); }}
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label="Notifications">
          <header className="notification-panel-head">
            <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
            {unreadCount > 0 && <button type="button" className="notification-read-all" onClick={markAllRead}><Check size={14} /> Mark all read</button>}
          </header>
          <div className="notification-push-setting">
            <div>
              <strong>Browser push</strong>
              <span>{subscribed ? 'Enabled on this device' : 'Get updates when the portal is closed'}</span>
            </div>
            {subscribed
              ? <button type="button" disabled={busy} onClick={disablePush}>Turn off</button>
              : <button type="button" disabled={busy || !push.enabled} onClick={enablePush}>{busy ? 'Enabling…' : 'Enable'}</button>}
          </div>
          {message && <p className="notification-message" role="status">{message}</p>}
          <div className="notification-list">
            {items.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : items.map((notice) => (
              <button key={notice._id} type="button" className={`notification-item${notice.readAt ? '' : ' unread'}`} onClick={() => openNotice(notice)}>
                <span className="notification-item-title">{notice.title}</span>
                {notice.body && <span className="notification-item-body">{notice.body}</span>}
                <span className="notification-item-meta">{timeLabel(notice.createdAt)} <ExternalLink size={12} aria-hidden="true" /></span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
