import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type UserStats = {
  total: number;
  inProgress: number;
  done: number;
  rejects: number;
};

export type CollaboratorData = {
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
  performance: number;
  stats: UserStats;
};

export async function fetchCollaboratorsStats(): Promise<CollaboratorData[]> {
  const response = await authFetch('/users/collaborators/stats');
  if (!response.ok) return [];
  return response.json();
}

export async function createCollaborator(
  data: Partial<CollaboratorData> & { password?: string }
): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch('/users/collaborators', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la création') };
  }

  return { ok: true };
}
export async function updateCollaborator(
  id: string,
  data: Partial<CollaboratorData> & { password?: string }
): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/users/collaborators/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la modification') };
  }

  return { ok: true };
}

export async function deleteCollaborator(id: string): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/users/collaborators/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la suppression') };
  }

  return { ok: true };
}
