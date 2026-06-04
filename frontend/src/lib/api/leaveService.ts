import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type AccountantLeave = {
  id: string;
  accountantId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  createdAt: string;
};

export async function fetchLeaves(): Promise<AccountantLeave[]> {
  const response = await authFetch('/leaves');
  if (!response.ok) return [];
  return response.json();
}

export async function createLeave(body: {
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<{ ok: true; data: AccountantLeave } | { ok: false; message: string }> {
  const response = await authFetch('/leaves', {
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

export async function deleteLeave(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await authFetch(`/leaves/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Suppression impossible') };
  }
  return { ok: true };
}
