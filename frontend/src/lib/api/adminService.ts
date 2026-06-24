import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type AdminStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';
export type AdminRole = 'ADMIN' | 'COMPTABLE' | 'COLLABORATEUR' | 'CLIENT';

export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  status: AdminStatus;
  companyName?: string | null;
  legalType?: string | null;
  activitySector?: string | null;
  headquarters?: string | null;
  rcNumber?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  location?: string | null;
  mapsLink?: string | null;
  createdAt: string;
  updatedAt?: string;
  clientAccountants?: { accountant: { id: string; firstName: string; lastName: string } }[];
  collaboratorAccountants?: { accountant: { id: string; firstName: string; lastName: string } }[];
};

export type AdminCreateUserPayload = {
  email: string;
  firstName: string;
  lastName: string;
  role: Exclude<AdminRole, 'ADMIN'>;
  status?: Exclude<AdminStatus, never>;
  companyName?: string;
  phone?: string;
  birthDate?: string;
  experienceLevel?: string;
  hireDate?: string;
  password?: string;
  accountantId?: string;
};

export type AdminDashboardData = {
  usersByRole: Record<string, number>;
  globalStats: {
    totalUsers: number;
    newUsersToday: number;
    disabledUsers: number;
    storageUsed: number;
    storageLimit: number;
    alerts: number;
  };
  systemAlerts: {
    pendingComptables: number;
    storageOverages: number;
    pendingReviews: number;
    pendingRequests: number;
  };
  growth: { date: string; count: number }[];
  recentAuditLogs: AuditLogItem[];
};

export type AccountantDetails = AdminUser & {
  accountantClients: { client: AdminUser }[];
  accountantCollaborators: { collaborator: AdminUser }[];
  ownedOrganizations: {
    id: string;
    name: string;
    storageUsed: number;
    storageLimit: number;
  }[];
  accountantReviews: {
    id: string;
    rating: number;
    comment?: string | null;
    status: AdminStatus;
    createdAt: string;
  }[];
  stats?: {
    clients: number;
    collaborators: number;
    organizations: number;
  };
};

export type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  status: AdminStatus;
  createdAt: string;
  client: { id: string; firstName: string; lastName: string; email: string };
  accountant: { id: string; firstName: string; lastName: string; email: string };
};

export type StorageItem = {
  id: string;
  name: string;
  storageUsed: number;
  storageLimit: number;
  effectiveStorageLimit: number;
  effectiveStorageUsed: number;
  exceeded: boolean;
  owner: { id: string; firstName: string; lastName: string; email: string };
  members: { id: string }[];
};

export type AnalyticsData = {
  userGrowth: { date: string; count: number }[];
  featureUsage: { feature: string; count: number }[];
  retention: {
    eligibleUsers: number;
    retainedUsers: number;
    retentionRate: number;
  };
};

export type AuditLogItem = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ip?: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type AdminProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: AdminStatus;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function parseJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, fallback));
  }
  return (await response.json()) as T;
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function fetchAdminDashboard() {
  const response = await authFetch('/admin/dashboard');
  return parseJson<AdminDashboardData>(response, 'Impossible de charger le dashboard ADMIN');
}

export async function fetchAdminAccountants(filters: {
  status?: AdminStatus | '';
  search?: string;
}) {
  const response = await authFetch(
    withQuery('/admin/accountants', {
      status: filters.status || undefined,
      search: filters.search?.trim() || undefined,
    }),
  );
  return parseJson<AccountantDetails[]>(response, 'Impossible de charger les comptables');
}

export async function fetchAdminAccountant(id: string) {
  const response = await authFetch(`/admin/accountants/${id}`);
  return parseJson<AccountantDetails>(response, 'Impossible de charger ce comptable');
}

export async function deleteAdminAccountant(id: string) {
  const response = await authFetch(`/admin/accountants/${id}`, { method: 'DELETE' });
  return parseJson<{ success: boolean }>(response, 'Suppression impossible');
}

export async function fetchAdminUsers(filters: {
  role?: AdminRole | '';
  status?: AdminStatus | '';
  search?: string;
}) {
  const response = await authFetch(
    withQuery('/admin/users', {
      role: filters.role || undefined,
      status: filters.status || undefined,
      search: filters.search?.trim() || undefined,
    }),
  );
  return parseJson<AdminUser[]>(response, 'Impossible de charger les utilisateurs');
}

export async function fetchAdminUser(id: string) {
  const response = await authFetch(`/admin/users/${id}`);
  return parseJson<AdminUser & Record<string, unknown>>(response, 'Impossible de charger cet utilisateur');
}

export async function createAdminUser(payload: AdminCreateUserPayload) {
  const response = await authFetch('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<
    AdminUser & { mailSent?: boolean; temporaryPassword?: string }
  >(response, 'Impossible de creer cet utilisateur');
}

export async function updateAdminUserStatus(id: string, status: AdminStatus) {
  const response = await authFetch(`/admin/users/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson<{ id: string; status: AdminStatus }>(response, 'Mise à jour du statut impossible');
}

export async function updateAdminUser(
  id: string,
  payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    accountantId?: string;
  },
) {
  const response = await authFetch(`/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<AdminUser>(response, 'Mise a jour utilisateur impossible');
}

export async function updateAdminUserRole(id: string, role: AdminRole) {
  const response = await authFetch(`/admin/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  return parseJson<{ id: string; role: AdminRole }>(response, 'Mise à jour du rôle impossible');
}

export async function resetAdminUserPassword(id: string, password?: string) {
  const response = await authFetch(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJson<{ success: boolean; temporaryPassword: string }>(
    response,
    'Réinitialisation du mot de passe impossible',
  );
}

export async function deleteAdminUser(id: string) {
  const response = await authFetch(`/admin/users/${id}`, {
    method: 'DELETE',
  });
  return parseJson<{ success: boolean }>(response, 'Suppression utilisateur impossible');
}

export async function fetchAdminReviews(status?: AdminStatus | '') {
  const response = await authFetch(
    withQuery('/admin/reviews', { status: status || undefined }),
  );
  return parseJson<ReviewItem[]>(response, 'Impossible de charger les avis');
}

export async function updateAdminReviewStatus(id: string, status: AdminStatus) {
  const response = await authFetch(`/admin/reviews/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson<ReviewItem>(response, 'Modération impossible');
}

export async function deleteAdminReview(id: string) {
  const response = await authFetch(`/admin/reviews/${id}`, { method: 'DELETE' });
  return parseJson<{ success: boolean }>(response, 'Suppression impossible');
}

export async function fetchAdminStorage() {
  const response = await authFetch('/admin/storage');
  return parseJson<StorageItem[]>(response, 'Impossible de charger le stockage');
}

export async function updateAdminStorageQuota(organizationId: string, limit: number) {
  const response = await authFetch(`/admin/storage/${organizationId}/quota`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
  return parseJson<StorageItem>(response, 'Mise à jour du quota impossible');
}

export async function fetchAdminAnalytics() {
  const response = await authFetch('/admin/analytics');
  return parseJson<AnalyticsData>(response, 'Impossible de charger les analytics');
}

export async function fetchAdminAuditLogs(filters: {
  userId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
}) {
  const response = await authFetch(withQuery('/admin/audit-logs', filters));
  return parseJson<AuditLogItem[]>(response, 'Impossible de charger les logs d’audit');
}

export async function exportAdminAuditLogs(filters: {
  userId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
}) {
  const response = await authFetch(withQuery('/admin/audit-logs/export', filters));
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Export des logs impossible'));
  }
  return response.text();
}

export async function fetchAdminProfile() {
  const response = await authFetch('/admin/profile');
  return parseJson<AdminProfile>(response, 'Impossible de charger le profil ADMIN');
}

export async function updateAdminProfile(payload: {
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
}) {
  const response = await authFetch('/admin/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<AdminProfile>(response, 'Impossible de mettre à jour le profil ADMIN');
}

export async function changeAdminPassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  const response = await authFetch('/admin/profile/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean }>(response, 'Impossible de changer le mot de passe');
}
