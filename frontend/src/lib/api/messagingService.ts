import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type MessagingUser = {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string | null;
  email: string;
  role: string;
};

export type MessagingDirectory = {
  accountants: MessagingUser[];
  clients: MessagingUser[];
  collaborators: MessagingUser[];
};

export type ConversationPreview = {
  id: string;
  type: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  participants: { userId: string; user: MessagingUser }[];
  messages: { id: string; content: string; createdAt: string; senderId: string }[];
};

export type ChatMessage = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  updatedAt?: string;
  senderId: string;
  sender: MessagingUser;
  linkedDocument?: { id: string; name: string; url: string };
  linkedRequest?: { id: string; type: string; subject?: string };
};

export type ConversationDetail = {
  id: string;
  type: string;
  name: string | null;
  participants: { userId: string; user: MessagingUser }[];
  messages: ChatMessage[];
};

export async function fetchMessagingDirectory(): Promise<MessagingDirectory | null> {
  const response = await authFetch('/users/messaging-directory');
  if (!response.ok) return null;
  return response.json();
}

export async function fetchConversations(): Promise<ConversationPreview[]> {
  const response = await authFetch('/messaging/conversations');
  if (!response.ok) return [];
  return response.json();
}

export async function fetchConversation(id: string): Promise<ConversationDetail | null> {
  const response = await authFetch(`/messaging/conversations/${id}`);
  if (!response.ok) return null;
  return response.json();
}

export async function createConversation(
  otherUserIds: string[],
): Promise<{ ok: true; data: { id: string } } | { ok: false; message: string }> {
  const response = await authFetch('/messaging/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userIds: otherUserIds }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Création impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}

export async function sendChatMessage(
  conversationId: string,
  content: string,
  linkedId?: string,
  linkedType?: 'Document' | 'Request'
): Promise<{ ok: true; data?: ChatMessage } | { ok: false; message: string }> {
  const response = await authFetch(`/messaging/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, linkedId, linkedType }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Envoi impossible') };
  }
  const data = await response.json();
  return { ok: true, data };
}
export async function updateChatMessage(
  messageId: string,
  content: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await authFetch(`/messaging/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Modification impossible') };
  }
  return { ok: true };
}

export async function deleteChatMessage(
  messageId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await authFetch(`/messaging/messages/${messageId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Suppression impossible') };
  }
  return { ok: true };
}
