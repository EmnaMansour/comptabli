import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type TaskComment = {
  id: string | number;
  content: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
};

export type TaskAttachment = {
  id: string;
  url: string;
  name: string;
  type?: string;
};

export type TaskData = {
  id: string;
  taskNumber: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  deadline?: string;
  clientDeadline?: string;
  createdBy: string;
  assignees?: { id: string; firstName: string; lastName: string }[];
  clientId?: string;
  folderId?: string;
  requestId?: string;
  rejectionReason?: string;
  organizationId: string;
  createdAt: string;

  creator?: { id: string; firstName: string; lastName: string };
  client?: { id: string; firstName: string; lastName: string; companyName: string };
  folder?: { id: string; name: string };
  request?: { id: string; type: string; subject: string };
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
};

export type PaginatedTasks = {
  data: TaskData[];
  total: number;
  page: number;
  lastPage: number;
};

export async function fetchTasks(page: number = 1, limit: number = 10, archived: boolean = false): Promise<PaginatedTasks> {
  const response = await authFetch(`/tasks?page=${page}&limit=${limit}&archived=${archived}`);
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Erreur lors de la récupération des tâches'));
  }
  return response.json();
}

export async function createTask(data: Partial<TaskData> & { assignedTo?: string[] }): Promise<{ ok: boolean; data?: TaskData; message?: string }> {
  const response = await authFetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la création de la tâche') };
  }

  return { ok: true, data: await response.json() };
}

export async function updateTaskStatus(id: string, status: string, rejectionReason?: string): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/tasks/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, rejectionReason }),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur de mise à jour') };
  }
  return { ok: true };
}

export async function addTaskComment(id: string, content: string): Promise<{ ok: boolean; data?: TaskComment; message?: string }> {
  const response = await authFetch(`/tasks/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de l\'ajout du commentaire') };
  }
  return { ok: true, data: await response.json() };
}

export async function addTaskAttachment(taskId: string, file: File): Promise<{ ok: boolean; data?: TaskAttachment; message?: string }> {
  // Mock logic since we might not have multipart/form-data multer ready, 
  // we'll send a dummy URL for now just to make the UI work correctly with the database.
  // Ideally, you would push this via FormData to AWS S3 / Multer and get a URL first.
  const payload = {
    name: file.name,
    url: 'https://via.placeholder.com/150', // Mock URL
    size: file.size,
    type: file.type,
  };

  const response = await authFetch(`/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) return { ok: false, message: 'Erreur upload' };
  return { ok: true, data: await response.json() };
}

export async function deleteTaskAttachment(attId: string): Promise<{ ok: boolean; message?: string }> {
  const response = await authFetch(`/tasks/attachments/${attId}`, {
    method: 'DELETE',
  });
  if (!response.ok) return { ok: false, message: 'Erreur suppression' };
  return { ok: true };
}
