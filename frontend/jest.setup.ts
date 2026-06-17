import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

// ─── Global fetch mock (JSDOM doesn't include fetch) ──────────────────────
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(''),
});

// ─── Suppress known benign console warnings ───────────────────────────────
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args[0]?.toString?.() ?? '';
  if (
    msg.includes('changing a controlled input to be uncontrolled') ||
    msg.includes('ReferenceError: fetch is not defined') ||
    msg.includes('apiUrl) is not a function')
  ) return;
  originalConsoleError(...args);
};


// ─── Global matchMedia mock ────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ─── Global API mocks ─────────────────────────────────────────────────────
jest.mock('./src/lib/api', () => ({
  apiUrl: jest.fn((path: string) => `http://localhost:3000${path}`),
  getAssetUrl: (url: string) => url,
  apiErrorMessage: jest.fn().mockReturnValue('Erreur'),
  forgotPasswordRequest: jest.fn().mockResolvedValue({ ok: true }),
  resetPasswordRequest: jest.fn().mockResolvedValue({ ok: true }),
  loginRequest: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/taskService', () => ({
  fetchTasks: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, lastPage: 1 }),
  createTask: jest.fn().mockResolvedValue({ ok: true }),
  addTaskComment: jest.fn().mockResolvedValue({ ok: true }),
  updateTaskStatus: jest.fn().mockResolvedValue({ ok: true }),
  addTaskAttachment: jest.fn().mockResolvedValue({ ok: true }),
  deleteTaskAttachment: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/documentService', () => ({
  fetchDocuments: jest.fn().mockResolvedValue([]),
  uploadDocument: jest.fn().mockResolvedValue({ ok: true }),
  deleteDocument: jest.fn().mockResolvedValue({ ok: true }),
  patchDocument: jest.fn().mockResolvedValue({ ok: true }),
  addDocumentComment: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/clientService', () => ({
  fetchClientsStats: jest.fn().mockResolvedValue([]),
  fetchClientById: jest.fn().mockResolvedValue(null),
  updateClientStatus: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/collaboratorService', () => ({
  fetchCollaboratorsStats: jest.fn().mockResolvedValue([]),
  fetchCollaboratorById: jest.fn().mockResolvedValue(null),
  updateCollaboratorStatus: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/messagingService', () => ({
  fetchConversations: jest.fn().mockResolvedValue([]),
  fetchMessages: jest.fn().mockResolvedValue([]),
  sendMessage: jest.fn().mockResolvedValue({ ok: true }),
  createConversation: jest.fn().mockResolvedValue({ ok: true }),
  fetchMessagingDirectory: jest.fn().mockResolvedValue({ clients: [], accountants: [], collaborators: [] }),
}));

jest.mock('./src/lib/api/requestService', () => ({
  fetchRequests: jest.fn().mockResolvedValue([]),
  createRequest: jest.fn().mockResolvedValue({ ok: true }),
  updateRequestStatus: jest.fn().mockResolvedValue({ ok: true }),
  deleteRequest: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/meetingService', () => ({
  fetchMeetings: jest.fn().mockResolvedValue([]),
  createMeeting: jest.fn().mockResolvedValue({ ok: true }),
  updateMeeting: jest.fn().mockResolvedValue({ ok: true }),
  deleteMeeting: jest.fn().mockResolvedValue({ ok: true }),
  fetchAvailability: jest.fn().mockResolvedValue([]),
  updateAvailability: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/leaveService', () => ({
  fetchLeaves: jest.fn().mockResolvedValue([]),
  createLeave: jest.fn().mockResolvedValue({ ok: true }),
  deleteLeave: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/statsService', () => ({
  fetchDashboardStats: jest.fn().mockResolvedValue({
    clients: 5, pendingInvoices: 3, pendingRequests: 2, todayMeetings: 1,
    revenueData: [], pieData: [], recentClients: [], upcomingTasks: [],
    documents: 0, invoices: { count: 0 }, messages: 0, pendingTasks: 0, nextMeeting: null,
  }),
  fetchAdminStats: jest.fn().mockResolvedValue({}),
}));

jest.mock('./src/lib/api/adminService', () => ({
  fetchAdminDashboard: jest.fn().mockResolvedValue({
    usersByRole: {},
    globalStats: { totalUsers: 0, newUsersToday: 0, disabledUsers: 0, storageUsed: 0, storageLimit: 0, alerts: 0 },
    systemAlerts: { pendingComptables: 0, storageOverages: 0, pendingReviews: 0, pendingRequests: 0 },
    growth: [],
    recentAuditLogs: []
  }),
  fetchAdminUsers: jest.fn().mockResolvedValue([]),
  fetchAdminAccountants: jest.fn().mockResolvedValue([]),
  fetchAdminAccountant: jest.fn().mockResolvedValue(null),
  deleteAdminAccountant: jest.fn().mockResolvedValue({ ok: true }),
  fetchAdminUser: jest.fn().mockResolvedValue(null),
  createAdminUser: jest.fn().mockResolvedValue({ ok: true }),
  updateAdminUserStatus: jest.fn().mockResolvedValue({ ok: true }),
  updateAdminUser: jest.fn().mockResolvedValue({ ok: true }),
  updateAdminUserRole: jest.fn().mockResolvedValue({ ok: true }),
  resetAdminUserPassword: jest.fn().mockResolvedValue({ ok: true }),
  deleteAdminUser: jest.fn().mockResolvedValue({ ok: true }),
  fetchAdminReviews: jest.fn().mockResolvedValue([]),
  updateAdminReviewStatus: jest.fn().mockResolvedValue({ ok: true }),
  deleteAdminReview: jest.fn().mockResolvedValue({ ok: true }),
  fetchAdminStorage: jest.fn().mockResolvedValue([]),
  updateAdminStorageQuota: jest.fn().mockResolvedValue({ ok: true }),
  fetchAdminAnalytics: jest.fn().mockResolvedValue({
    userGrowth: [],
    featureUsage: [],
    retention: { eligibleUsers: 0, retainedUsers: 0, retentionRate: 0 }
  }),
  fetchAdminAuditLogs: jest.fn().mockResolvedValue([]),
  exportAdminAuditLogs: jest.fn().mockResolvedValue({}),
  fetchAdminProfile: jest.fn().mockResolvedValue({}),
  updateAdminProfile: jest.fn().mockResolvedValue({ ok: true }),
  changeAdminPassword: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/reviewContactService', () => ({
  fetchNetworkingProfiles: jest.fn().mockResolvedValue([]),
  fetchMyAccountants: jest.fn().mockResolvedValue([]),
  submitReview: jest.fn().mockResolvedValue({ ok: true }),
  fetchProfileById: jest.fn().mockResolvedValue(null),
  getPendingReviews: jest.fn().mockResolvedValue([]),
  approveReview: jest.fn().mockResolvedValue({ ok: true }),
  rejectReview: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/notificationService', () => ({
  fetchNotifications: jest.fn().mockResolvedValue([]),
  markAllRead: jest.fn().mockResolvedValue({ ok: true }),
  deleteNotification: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('./src/lib/api/folderService', () => ({
  fetchFolders: jest.fn().mockResolvedValue([]),
}));

jest.mock('./src/lib/api/accountantProfileService', () => ({
  fetchMyAccountantProfile: jest.fn().mockResolvedValue({ accountant: { firstName: 'Alice', lastName: 'Comptable', companyName: 'Cabinet', email: 'alice@test.com' } }),
  updateMyAccountantProfile: jest.fn().mockResolvedValue({ ok: true }),
  uploadAccountantFile: jest.fn().mockResolvedValue(''),
}));

jest.mock('./src/lib/api/invoiceService', () => ({
  fetchInvoices: jest.fn().mockResolvedValue([]),
  createInvoice: jest.fn().mockResolvedValue({ ok: true }),
}));
