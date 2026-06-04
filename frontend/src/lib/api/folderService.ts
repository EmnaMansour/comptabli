import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type Folder = {
  id: string;
  name: string;
  clientId: string;
  parentId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    documents: number;
    subFolders: number;
  };
};

export async function fetchFolders(options?: { parentId?: string; clientId?: string; archived?: boolean }): Promise<Folder[]> {
  const params = new URLSearchParams();
  if (options?.parentId) params.set('parentId', options.parentId);
  if (options?.clientId) params.set('clientId', options.clientId);
  if (options?.archived) params.set('archived', 'true');
  
  const q = params.toString();
  const path = `/folders${q ? `?${q}` : ''}`;
  
  const response = await authFetch(path);
  if (!response.ok) return [];
  return response.json();
}

export async function createFolder(
  name: string,
  parentId?: string,
  clientId?: string,
): Promise<{ ok: boolean; data?: Folder; message?: string }> {
  const response = await authFetch('/folders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, parentId, clientId }),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la création du dossier') };
  }

  const data = await response.json();
  return { ok: true, data };
}

export async function deleteFolder(id: string): Promise<boolean> {
  const response = await authFetch(`/folders/${id}`, {
    method: 'DELETE',
  });
  return response.ok;
}

export async function updateFolder(
  id: string,
  name: string,
): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/folders/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Renommage impossible') };
  }
  return { ok: true };
}

export async function setFolderArchived(
  id: string,
  archived: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/folders/${id}/archive-status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Action impossible') };
  }
  return { ok: true };
}

export async function archiveFolderDocuments(
  folderId: string,
): Promise<{ ok: boolean; archivedCount?: number; message?: string }> {
  const response = await authFetch(`/folders/${folderId}/archive-documents`, {
    method: 'POST',
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Archivage impossible') };
  }
  const data = (await response.json()) as { archivedCount?: number };
  return { ok: true, archivedCount: data.archivedCount };
}
