import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { getApiBase } from '../lib/api';
import { authFetch } from '../lib/authFetch';

export type NotificationType = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  linkedId?: string | null;
  linkedType?: string | null;
  clientName?: string | null;
  clientMessage?: string | null;
  contactFormId?: string | null;
  createdAt: string;
};

interface NotificationState {
  notifications: NotificationType[];
  unreadCount: number;
  socket: Socket | null;
  
  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  loadInitial: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  socket: null,

  connect: (token: string) => {
    // Eviter les connexions multiples
    if (get().socket) return;
    
    // getApiBase retourne '/' ou l'url
    const base = getApiBase() || 'http://localhost:3000';
    
    const socket = io(base || undefined, {
      path: '/socket.io',
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Notifications] WebSocket Connected');
    });

    socket.on('newNotification', (notif: NotificationType) => {
      set((state) => ({
        notifications: [notif, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    });

    socket.on('disconnect', () => {
      console.log('[Notifications] WebSocket Disconnected');
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, notifications: [], unreadCount: 0 });
    }
  },

  loadInitial: async () => {
    try {
      const res = await authFetch('/notifications');
      if (res.ok) {
        const data = await res.json();
        set({
          notifications: data,
          unreadCount: data.filter((n: any) => !n.read).length
        });
      }
    } catch (e) {
      console.error(e);
    }
  },

  markAsRead: async (id: string) => {
    try {
      await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (e) {
      console.error(e);
    }
  },

  markAllAsRead: async () => {
    try {
      await authFetch('/notifications/read-all', { method: 'POST' });
      set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      }));
    } catch (e) {
      console.error(e);
    }
  }
}));
