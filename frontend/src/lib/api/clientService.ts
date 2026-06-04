import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type ClientStats = {
  processed: number;
  pending: number;
};

export type ClientData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  companyName?: string;
  birthDate?: string;
  experienceLevel?: string;
  hireDate?: string;
  cinUrl?: string;
  diplomaUrl?: string;
  stats: ClientStats;
};

export async function fetchClientsStats(): Promise<ClientData[]> {
  const response = await authFetch('/users/clients/stats');
  if (!response.ok) return [];
  return response.json();
}

export async function fetchClientById(id: string): Promise<ClientData | null> {
  const response = await authFetch(`/users/${id}`);
  if (!response.ok) return null;
  return response.json();
}

export async function createClient(
  data: Partial<ClientData> & { password?: string }
): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch('/users/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la création du client') };
  }

  return { ok: true };
}

export async function updateClient(
  id: string,
  data: Partial<ClientData>
): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/users/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la mise à jour du client') };
  }

  return { ok: true };
}

export async function deleteClient(id: string): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/users/clients/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la suppression du client') };
  }

  return { ok: true };
}
