import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type AppMeeting = {
  id: string;
  title: string;
  subject?: string | null;
  description?: string | null;
  color?: string | null;
  type: string;
  status: string;
  rejectionReason?: string | null;
  scheduledAt: string;
  duration: number;
  locationDetail?: string | null;
  meetingLink?: string | null;
  guests?: string | null;
  pvUrl?: string | null;
  clientId: string;
  accountantId?: string | null;
  createdAt?: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    companyName?: string | null;
    email?: string;
  };
  accountant?: {
    id: string;
    firstName: string;
    lastName: string;
    companyName?: string | null;
    email?: string;
  } | null;
};

export type MeetingSlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

export async function fetchMeetings(): Promise<AppMeeting[]> {
  const response = await authFetch('/meetings');
  if (!response.ok) return [];
  return response.json();
}

export async function createMeeting(body: {
  title: string;
  subject?: string;
  description?: string;
  color?: string;
  type?: string;
  scheduledAt: string;
  duration?: number;
  locationDetail?: string;
  meetingLink?: string | null;
  guests?: string;
  clientId?: string;
  accountantId?: string | null;
}): Promise<{ ok: true; data: AppMeeting; message?: string } | { ok: false; message: string }> {
  const response = await authFetch('/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Création impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}

export async function updateMeeting(id: string, body: {
  title?: string;
  subject?: string;
  description?: string;
  color?: string;
  type?: string;
  scheduledAt?: string;
  duration?: number;
  locationDetail?: string;
  meetingLink?: string | null;
  guests?: string;
  clientId?: string;
  accountantId?: string | null;
}): Promise<{ ok: true; data: AppMeeting; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/meetings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Mise à jour impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}

export async function updateMeetingStatus(
  id: string,
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE',
  reason?: string
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/meetings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Mise à jour impossible') };
  }
  return { ok: true };
}

export async function fetchAvailability(): Promise<MeetingSlot[]> {
  const response = await authFetch('/meetings/availability');
  if (!response.ok) return [];
  return response.json();
}

export async function updateAvailability(slots: MeetingSlot[]): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch('/meetings/availability', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Mise à jour impossible') };
  }
  return { ok: true };
}

export async function setMeetingPV(id: string, pvUrl: string): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/meetings/${id}/pv`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pvUrl }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Échec de l\'ajout du PV') };
  }
  return { ok: true };
}

/**
 * Fetch available time slots for a specific accountant for a given month.
 * Returns a map: { "2026-04-17": ["09:00","09:30","10:00"], ... }
 */
export async function fetchAvailableSlots(
  accountantId: string,
  year: number,
  month: number,
): Promise<Record<string, string[]>> {
  const response = await authFetch(
    `/meetings/available-slots/${accountantId}?year=${year}&month=${month}`,
  );
  if (!response.ok) return {};
  return response.json();
}
