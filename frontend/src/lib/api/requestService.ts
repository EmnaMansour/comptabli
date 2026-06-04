import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type RequestComment = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    companyName?: string | null;
  };
};

export type RequestAttachment = {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: string;
  uploader?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
};

export type AppRequest = {
  id: string;
  clientId: string;
  type: string;
  subject?: string | null;
  description: string;
  urgency: string;
  status: string;
  dueDate?: string | null;
  desiredResponseAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  accountantId?: string | null;
  creatorId?: string | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    companyName?: string | null;
  };
  accountant?: {
    id: string;
    firstName: string;
    lastName: string;
    companyName?: string | null;
  } | null;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  attachments?: RequestAttachment[];
  comments?: RequestComment[];
  _count?: { attachments: number; comments: number };
};

export async function fetchRequests(clientId?: string): Promise<AppRequest[]> {
  const path = clientId ? `/requests?clientId=${clientId}` : '/requests';
  const response = await authFetch(path);
  if (!response.ok) return [];
  return response.json();
}

export async function fetchRequestById(id: string): Promise<AppRequest | null> {
  const response = await authFetch(`/requests/${id}`);
  if (!response.ok) return null;
  return response.json();
}

export async function createRequest(body: {
  clientId?: string;
  type: string;
  subject?: string | null;
  description: string;
  urgency?: string;
  dueDate?: string | null;
  desiredResponseAt?: string | null;
  accountantId?: string | null;
  status?: string;
}): Promise<{ ok: true; data: AppRequest } | { ok: false; message: string }> {
  const response = await authFetch('/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Création impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}

export async function updateRequest(
  id: string,
  body: {
    type?: string;
    subject?: string | null;
    description?: string;
    urgency?: string;
    dueDate?: string | null;
    desiredResponseAt?: string | null;
    accountantId?: string | null;
  },
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/requests/${id}`, {
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

export async function updateRequestManagement(
  id: string,
  body: {
    accountantId?: string | null;
    respondedAt?: string | null;
    subject?: string | null;
    type?: string;
    description?: string;
    dueDate?: string | null;
  },
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/requests/${id}/management`, {
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

export async function deleteRequest(id: string): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/requests/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Suppression impossible') };
  }
  return { ok: true };
}

export async function updateRequestStatus(
  id: string,
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE',
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/requests/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Statut impossible') };
  }
  return { ok: true };
}

export async function postRequestComment(
  requestId: string,
  content: string,
): Promise<{ ok: true; data?: RequestComment; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/requests/${requestId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Envoi impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}

export async function uploadRequestAttachment(
  requestId: string,
  file: File,
): Promise<{ ok: true; data?: RequestAttachment; message?: string } | { ok: false; message: string }> {
  const form = new FormData();
  form.append('file', file);
  const response = await authFetch(`/requests/${requestId}/attachments`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Upload impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}

export async function attachRequestDocumentFromLibrary(
  requestId: string,
  documentId: string,
): Promise<{ ok: true; data?: RequestAttachment; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/requests/${requestId}/attachments/from-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documentId }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Liaison document impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}

export async function deleteRequestAttachment(
  requestId: string,
  attachmentId: string,
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await authFetch(`/requests/${requestId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Suppression impossible') };
  }
  return { ok: true };
}
