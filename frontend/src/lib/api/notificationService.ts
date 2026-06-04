import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  linkedId?: string | null;
  linkedType?: string | null;
  createdAt: string;
};

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await authFetch('/notifications');
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationRead(
  id: string,
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const res = await authFetch(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
  if (!res.ok) return { ok: false, message: await apiErrorMessage(res, 'Erreur') };
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<
  { ok: true; message?: string } | { ok: false; message: string }
> {
  const res = await authFetch('/notifications/read-all', {
    method: 'POST',
  });
  if (!res.ok) return { ok: false, message: await apiErrorMessage(res, 'Erreur') };
  return { ok: true };
}
