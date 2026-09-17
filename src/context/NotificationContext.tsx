/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  push: (notification: { type: NotificationType; title: string; body?: string }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const STORAGE_KEY = 'north-notifications';
const CHANNEL_NAME = 'north-notifications';
const MAX_STORED = 50;

function readStored(): AppNotification[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(raw) ? raw.slice(0, MAX_STORED) : [];
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(readStored);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === 'sync') setNotifications(readStored());
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setNotifications(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persist = useCallback((next: AppNotification[]) => {
    setNotifications(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_STORED)));
    } catch {
      /* storage no disponible */
    }
    channelRef.current?.postMessage({ type: 'sync' });
  }, []);

  const push = useCallback(
    (notification: { type: NotificationType; title: string; body?: string }) => {
      const item: AppNotification = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        read: false,
        ...notification,
      };
      persist([item, ...readStored()].slice(0, MAX_STORED));
    },
    [persist]
  );

  const markRead = useCallback(
    (id: string) => persist(readStored().map((n) => (n.id === id ? { ...n, read: true } : n))),
    [persist]
  );

  const markAllRead = useCallback(
    () => persist(readStored().map((n) => ({ ...n, read: true }))),
    [persist]
  );

  const remove = useCallback(
    (id: string) => persist(readStored().filter((n) => n.id !== id)),
    [persist]
  );

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, push, markRead, markAllRead, remove }),
    [notifications, unreadCount, push, markRead, markAllRead, remove]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}