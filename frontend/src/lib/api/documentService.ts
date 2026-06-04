import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type AppDocument = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  status: string;
  archived?: boolean;
  clientId: string;
  folderId?: string;
  category?: string;
  extractedData?: string;
  createdAt: string;
  folder?: {
    id: string;
    name: string;
    parentId?: string | null;
  };
};

export type DocumentComment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; companyName?: string | null };
};

export type DocumentDetail = AppDocument & {
  versions?: { id: string; versionNumber: number; url: string; createdAt: string }[];
  annotations?: { id: string; content: string; createdAt: string }[];
  comments?: DocumentComment[];
};

export async function fetchDocuments(options?: {
  folderId?: string;
  archived?: boolean;
  clientId?: string;
}): Promise<AppDocument[]> {
  const params = new URLSearchParams();
  if (options?.folderId !== undefined) params.set('folderId', options.folderId);
  if (options?.archived) params.set('archived', 'true');
  if (options?.clientId) params.set('clientId', options.clientId);
  const q = params.toString();
  const response = await authFetch(`/documents${q ? `?${q}` : ''}`);
  if (!response.ok) return [];
  return response.json();
}

export async function fetchDocumentById(id: string): Promise<DocumentDetail | null> {
  const response = await authFetch(`/documents/${id}`);
  if (!response.ok) return null;
  return response.json();
}

export async function patchDocument(
  id: string,
  body: { archived?: boolean; name?: string; folderId?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await authFetch(`/documents/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Mise à jour impossible') };
  }
  return { ok: true };
}

export async function setDocumentArchived(
  id: string,
  archived: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return patchDocument(id, { archived });
}

export async function renameDocument(
  id: string,
  name: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return patchDocument(id, { name });
}

export async function deleteDocument(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await authFetch(`/documents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Suppression impossible') };
  }
  return { ok: true };
}

export async function uploadDocument(
  file: File,
  clientId: string,
  folderId?: string,
  customName?: string,
  category?: string,
): Promise<{ ok: boolean; data?: AppDocument; message?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('clientId', clientId);
  if (folderId) formData.append('folderId', folderId);
  if (customName) formData.append('name', customName);
  if (category) formData.append('category', category);

  const response = await authFetch('/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de l’upload') };
  }

  const data = (await response.json()) as AppDocument;
  return { ok: true, data };
}

export async function moveDocument(
  id: string,
  folderId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return patchDocument(id, { folderId: folderId as any });
}

export async function addDocumentComment(
  documentId: string,
  content: string,
): Promise<{ ok: true; data: DocumentComment } | { ok: false; message: string }> {
  const response = await authFetch(`/documents/${documentId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Commentaire impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}
