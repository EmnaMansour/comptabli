import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import VerifyEmailPrompt from './pages/auth/VerifyEmailPrompt';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/dashboard/Dashboard';
import ProfilePage from './pages/profile/ProfilePage';
import MonEspaceClient from './pages/mon-espace/MonEspaceClient';
import ClientsPage from './pages/clients/ClientsPage';
import CollaboratorsPage from './pages/collaborators/CollaboratorsPage';
import CollaboratorDetailsPage from './pages/collaborators/CollaboratorDetailsPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import TasksPage from './pages/tasks/TasksPage';
import MessagingPage from './pages/messaging/MessagingPage';
import DemandesPage from './pages/demandes/DemandesPage';
import MesDemandesPage from './pages/demandes/MesDemandesPage';
import DemandesClientsPage from './pages/demandes/DemandesClientsPage';
import MesRendezVousPage from './pages/meetings/MesRendezVousPage';
import SearchComptables from './pages/search/SearchComptables';
import SettingsPage from './pages/settings/SettingsPage';
import ArchivesPage from './pages/archives/ArchivesPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import NetworkingPage from './pages/networking/NetworkingPage';
import NetworkingProfilePage from './pages/networking/NetworkingProfilePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminAccountantsPage from './pages/admin/AdminAccountantsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
// import AdminProfilePage from './pages/admin/AdminProfilePage';
// import AdminReviewsPage from './pages/admin/AdminReviewsPage';
// import AdminStoragePage from './pages/admin/AdminStoragePage';
// import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
// import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';

import ForcePasswordChangeModal from './components/auth/ForcePasswordChangeModal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ForcePasswordChangeModal />
      <Routes>
        {/* Accueil public officiel : annuaire networking */}
        <Route path="/" element={<NetworkingPage />} />
        <Route path="/networking" element={<Navigate to="/" replace />} />
        <Route path="/networking/:id" element={<NetworkingProfilePage />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email-prompt" element={<VerifyEmailPrompt />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Espace connecté (routes absolues, layout sans path) */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/mon-espace" element={<MonEspaceClient />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:clientId/espace" element={<MonEspaceClient />} />
          <Route path="/clients/:clientId/archives" element={<ArchivesPage />} />
          <Route path="/collaborators" element={<CollaboratorsPage />} />
          <Route path="/collaborators/:id" element={<CollaboratorDetailsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/messaging" element={<MessagingPage />} />
          <Route path="/demandes" element={<DemandesPage />} />
          <Route path="/mes-demandes" element={<MesDemandesPage />} />
          <Route path="/demandes-clients" element={<DemandesClientsPage />} />
          <Route path="/meetings" element={<MesRendezVousPage />} />
          <Route path="/search" element={<SearchComptables />} />
          <Route path="/archives" element={<ArchivesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="/admin/accountants" element={<AdminRoute><AdminAccountantsPage /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          {/* <Route path="/admin/reviews" element={<AdminRoute><AdminReviewsPage /></AdminRoute>} />
          <Route path="/admin/storage" element={<AdminRoute><AdminStoragePage /></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><AdminAnalyticsPage /></AdminRoute>} />
          <Route path="/admin/audit-logs" element={<AdminRoute><AdminAuditLogsPage /></AdminRoute>} /> */}
          <Route path="/admin/profile" element={<AdminRoute><ProfilePage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
