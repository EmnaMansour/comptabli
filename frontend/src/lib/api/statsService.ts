import { authFetch } from '../authFetch';

export type DashboardStats = {
  // Client stats
  documents?: number;
  folders?: number;
  invoices?: {
    count: number;
    totalAmount: number;
  };
  pendingRequests?: number;
  pendingTasks?: number;
  messages?: number;
  nextMeeting?: {
    id: string;
    scheduledAt: string;
    title: string;
  };
  // Accountant stats
  clients?: number;
  pendingInvoices?: number;
  syncedInvoices?: number;
  todayMeetings?: number;
  recentClients?: { name: string; sector: string; status: string; date: string }[];
  upcomingTasks?: { title: string; assignee: string; due: string; priority: string }[];
  revenueData?: { name: string; value: number }[];
  pieData?: { name: string; value: number }[];
  // Admin stats
  usersByRole?: Record<string, number>;
  globalStats?: {
    totalUsers: number;
    newUsersToday: number;
    disabledUsers: number;
    storageUsed: number;
    storageLimit: number;
    alerts: number;
  };
};

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  const response = await authFetch('/stats/dashboard');
  if (!response.ok) return null;
  return response.json();
}
