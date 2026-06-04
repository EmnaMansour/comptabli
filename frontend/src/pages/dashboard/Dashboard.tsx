import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../../store/authStore';
import { fetchDashboardStats, type DashboardStats } from '../../lib/api/statsService';
import {
  Users,
  FileText,
  CheckSquare,
  MessageCircle,
  ArrowUpRight,
  ClipboardList,
  Building2,
  Search,
  Calendar,
  ListTodo,
  Archive,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#2563eb', '#4f46e5', '#7c3aed', '#a78bfa'];

function QuickCard({
  to,
  title,
  desc,
  icon: Icon,
}: {
  to: string;
  title: string;
  desc: string;
  icon: typeof Users;
}) {
  return (
    <Link
      to={to}
      className="dashboard-card"
      style={{ textDecoration: 'none', color: 'inherit', transition: 'var(--transition)' }}
    >
      <div className="dashboard-card-body" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          className="stat-card-icon blue"
          style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon size={22} />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{desc}</div>
        </div>
        <ArrowUpRight size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
      </div>
    </Link>
  );
}

function DashboardComptableLike({ stats }: { stats: DashboardStats | null }) {
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card blue animate-fade-in-up stagger-1">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">
              <Users size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.clients ?? 0}</div>
          <div className="stat-card-label">Total clients</div>
        </div>
        <div className="stat-card green animate-fade-in-up stagger-2">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <FileText size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.pendingInvoices ?? 0}</div>
          <div className="stat-card-label">Factures à traiter</div>
        </div>
        <div className="stat-card orange animate-fade-in-up stagger-3">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">
              <CheckSquare size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
          <div className="stat-card-label">Demandes en attente</div>
        </div>
        <div className="stat-card purple animate-fade-in-up stagger-4">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">
              <Calendar size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.todayMeetings ?? 0}</div>
          <div className="stat-card-label">Rendez-vous aujourd'hui</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Revenus mensuels</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            >
              <option>Cette année</option>
              <option>2023</option>
            </select>
          </div>
          <div className="dashboard-card-body">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats?.revenueData || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Répartition clients</span>
          </div>
          <div className="dashboard-card-body" style={{ display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats?.pieData || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(stats?.pieData || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dashboard-grid equal">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Clients récents</span>
            <Link
              to="/clients"
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Voir tout <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="dashboard-card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Secteur</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentClients || []).length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>Aucun client récent.</td></tr>
                ) : (
                  (stats?.recentClients || []).map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.sector}</td>
                      <td>
                        <span className={`status-badge ${c.status === 'Actif' ? 'success' : c.status === 'En attente' ? 'warning' : 'default'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Tâches à venir</span>
            <Link
              to="/tasks"
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Voir tout <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="dashboard-card-body">
            {(stats?.upcomingTasks || []).length === 0 ? (
               <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>Aucune tâche à venir.</div>
            ) : (
              (stats?.upcomingTasks || []).map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem 0',
                    borderBottom: i < (stats?.upcomingTasks?.length || 0) - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background:
                        t.priority === 'high'
                          ? 'var(--danger)'
                          : t.priority === 'medium'
                            ? 'var(--warning)'
                            : 'var(--success)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.assignee}</div>
                  </div>
                  <span className="status-badge info" style={{ fontSize: '0.75rem' }}>
                    {t.due}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardClient({ stats }: { stats: DashboardStats | null }) {
  return (
    <>
      <div
        className="dashboard-card"
        style={{ marginBottom: 24, background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)' }}
      >
        <div className="dashboard-card-body" style={{ padding: '1.25rem 1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 6 }}>Bienvenue sur votre espace</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 560 }}>
            Gérez vos demandes, vos rendez-vous et vos banques depuis ce tableau de bord. Accédez au networking
            pour trouver un expert comptable.
          </p>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card blue animate-fade-in-up stagger-1">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">
              <FileText size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.documents ?? 0}</div>
          <div className="stat-card-label">Mes documents</div>
        </div>
        <div className="stat-card green animate-fade-in-up stagger-2">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <CheckSquare size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.invoices?.count ?? 0}</div>
          <div className="stat-card-label">Factures payées</div>
        </div>
        <div className="stat-card orange animate-fade-in-up stagger-3">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">
              <ClipboardList size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
          <div className="stat-card-label">Demandes en attente</div>
        </div>
        <div className="stat-card purple animate-fade-in-up stagger-4">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">
              <Calendar size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.nextMeeting ? 1 : 0}</div>
          <div className="stat-card-label">Rendez-vous à venir</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <QuickCard to="/demandes" title="Mes demandes" desc="Suivre et créer des demandes" icon={ClipboardList} />
        <QuickCard to="/banques" title="Mes banques" desc="Comptes, cartes et transactions" icon={Building2} />
        <QuickCard to="/meetings" title="Mes rendez-vous" desc="Planification et suivi" icon={Calendar} />
        <QuickCard to="/messaging" title="Messagerie" desc="Échanger avec votre cabinet" icon={MessageCircle} />
        <QuickCard to="/" title="Trouver un comptable" desc="Annuaire et profils" icon={Search} />
        <QuickCard to="/archives" title="Archives" desc="Documents archivés" icon={Archive} />
      </div>

      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <span className="dashboard-card-title">Activité récente</span>
          <Link to="/demandes" style={{ fontSize: '0.85rem' }}>
            Tout voir
          </Link>
        </div>
        <div className="dashboard-card-body">
          {stats?.nextMeeting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '10px', borderRadius: '12px' }}>
                <Calendar size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stats.nextMeeting.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Prévu pour le {new Date(stats.nextMeeting.scheduledAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
               Aucune activité récente à afficher. Créez une demande pour démarrer.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function DashboardCollaborateur({ stats }: { stats: DashboardStats | null }) {
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card blue animate-fade-in-up stagger-1">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">
              <ClipboardList size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
          <div className="stat-card-label">Demandes assignées</div>
        </div>
        <div className="stat-card orange animate-fade-in-up stagger-2">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">
              <ListTodo size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.pendingTasks ?? 0}</div>
          <div className="stat-card-label">Tâches en cours</div>
        </div>
        <div className="stat-card purple animate-fade-in-up stagger-3">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">
              <MessageCircle size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.messages ?? 0}</div>
          <div className="stat-card-label">Messages</div>
        </div>
        <div className="stat-card green animate-fade-in-up stagger-4">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <FileText size={22} />
            </div>
          </div>
          <div className="stat-card-value">{stats?.documents ?? 0}</div>
          <div className="stat-card-label">Documents</div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
          marginTop: 8,
        }}
      >
        <QuickCard to="/tasks" title="Task management" desc="Kanban et suivi des tâches" icon={ListTodo} />
        <QuickCard to="/demandes" title="Mes demandes" desc="Demandes qui vous sont assignées" icon={ClipboardList} />
        <QuickCard to="/documents" title="Documents" desc="Fichiers partagés" icon={FileText} />
      </div>
    </>
  );
}

function titleForRole(role: UserRole | null): string {
  switch (role) {
    case 'CLIENT':
      return 'Tableau de bord client';
    case 'COLLABORATEUR':
      return 'Tableau de bord collaborateur';
    case 'ADMIN':
      return 'Tableau de bord administrateur';
    default:
      return 'Tableau de bord';
  }
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const role = user?.role ?? null;
  const first = user?.firstName;
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    // Only fetch if logged in
    if (user) {
      void fetchDashboardStats().then(setStats);
    }
  }, [user]);

  if (role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="animate-fade-in">
      <header className="dashboard-page-header animate-fade-in-up">
        {/* <Link to="/dashboard" className="dashboard-page-logo" aria-label="Comptabli">
          <AppLogo variant="header" />
        </Link> */}
        <div className="dashboard-page-heading">
          <h1 className="page-title dashboard-page-title">{titleForRole(role)}</h1>
          <p className="page-subtitle dashboard-page-subtitle">
            Bienvenue{first ? `, ${first}` : ''} — voici votre activité sur Comptabli.
          </p>
        </div>
      </header>

      {role === 'CLIENT' && <DashboardClient stats={stats} />}
      {role === 'COLLABORATEUR' && <DashboardCollaborateur stats={stats} />}
      {(role === 'COMPTABLE' || role === null) && <DashboardComptableLike stats={stats} />}
    </div>
  );
}

