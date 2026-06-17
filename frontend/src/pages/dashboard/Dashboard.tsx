import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../../store/authStore';
import { fetchDashboardStats, type DashboardStats } from '../../lib/api/statsService';
import {
  Users,
  FileText,
  CheckSquare,
  RefreshCw,
  MessageCircle,
  ArrowUpRight,
  ClipboardList,
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
  const hasChartData = (stats?.revenueData ?? []).some(d => d.value > 0);
  const hasPieData = (stats?.pieData ?? []).length > 0;
  const hasClients = (stats?.recentClients ?? []).length > 0;
  const hasTasks = (stats?.upcomingTasks ?? []).length > 0;

  return (
    <>
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #2563eb 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '28px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        boxShadow: '0 8px 32px -8px rgba(37, 99, 235, 0.45)',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Espace comptable
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>
            Tableau de bord comptable
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.9rem', maxWidth: 460, lineHeight: 1.6 }}>
            Suivez vos clients, gérez les factures et tâches, et consultez vos rendez-vous du jour en un coup d'œil.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/clients" style={{
            background: '#fff', color: '#1e40af',
            borderRadius: '10px', padding: '10px 20px',
            fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
          }}>Mes clients</Link>
          <Link to="/tasks" style={{
            background: 'rgba(255,255,255,0.2)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: '10px', padding: '10px 20px',
            fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
          }}>Mes tâches</Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card blue animate-fade-in-up stagger-1">
          <div className="stat-card-header">
            <div className="stat-card-icon blue"><Users size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.clients ?? 0}</div>
          <div className="stat-card-label">Total clients</div>
        </div>
        <div className="stat-card green animate-fade-in-up stagger-2">
          <div className="stat-card-header">
            <div className="stat-card-icon green"><RefreshCw size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.syncedInvoices ?? 0}</div>
          <div className="stat-card-label">Factures synchronisées</div>
        </div>
        <div className="stat-card orange animate-fade-in-up stagger-3">
          <div className="stat-card-header">
            <div className="stat-card-icon orange"><CheckSquare size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
          <div className="stat-card-label">Demandes en attente</div>
        </div>
        <div className="stat-card purple animate-fade-in-up stagger-4">
          <div className="stat-card-header">
            <div className="stat-card-icon purple"><Calendar size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.todayMeetings ?? 0}</div>
          <div className="stat-card-label">Rendez-vous aujourd'hui</div>
        </div>
      </div>

      {/* Charts — conditional */}
      {(hasChartData || hasPieData) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          {hasChartData && (
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">Revenus mensuels (TND)</span>
              </div>
              <div className="dashboard-card-body">
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.revenueData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                      <Tooltip wrapperStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          {hasPieData && (
            <div className="dashboard-card">
              <div className="dashboard-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <span className="dashboard-card-title">Répartition des clients</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>Par secteur d'activité</span>
              </div>
              <div className="dashboard-card-body" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats?.pieData || []} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                        {(stats?.pieData || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip wrapperStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', paddingTop: 12 }}>
                  {(stats?.pieData || []).map((entry, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ fontWeight: 500 }}>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clients récents + Tâches */}
      <div className="dashboard-grid equal" style={{ marginBottom: 24 }}>
        {/* Clients récents */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Clients récents</span>
            <Link to="/clients" style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 500, textDecoration: 'none' }}>
              Voir tous →
            </Link>
          </div>
          <div className="dashboard-card-body" style={{ padding: hasClients ? '0.5rem 0' : undefined }}>
            {hasClients ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(stats?.recentClients ?? []).map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 20px',
                    borderBottom: i < (stats?.recentClients?.length ?? 0) - 1 ? '1px solid var(--border-color)' : 'none',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: '#eff6ff', color: '#2563eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Users size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.sector} · {c.date}</div>
                    </div>
                    <span style={{
                      flexShrink: 0, padding: '3px 10px', borderRadius: '20px', fontSize: '0.76rem', fontWeight: 600,
                      background: c.status === 'Actif' ? '#dcfce7' : c.status === 'En attente' ? '#fef9c3' : '#f1f5f9',
                      color: c.status === 'Actif' ? '#16a34a' : c.status === 'En attente' ? '#b45309' : '#64748b',
                    }}>{c.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <div style={{ color: '#94a3b8', marginBottom: 8 }}><Users size={36} /></div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucun client récent</div>
                <Link to="/clients" style={{ color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: 500, textDecoration: 'none' }}>Ajouter un client →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Tâches à venir */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Tâches à venir</span>
            <Link to="/tasks" style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 500, textDecoration: 'none' }}>
              Voir toutes →
            </Link>
          </div>
          <div className="dashboard-card-body" style={{ padding: hasTasks ? '0.5rem 0' : undefined }}>
            {hasTasks ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(stats?.upcomingTasks ?? []).map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 20px',
                    borderBottom: i < (stats?.upcomingTasks?.length ?? 0) - 1 ? '1px solid var(--border-color)' : 'none',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#22c55e',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.assignee}</div>
                    </div>
                    <span style={{
                      flexShrink: 0, padding: '3px 10px', borderRadius: '20px', fontSize: '0.76rem', fontWeight: 600,
                      background: '#eff6ff', color: '#1d4ed8',
                    }}>{t.due}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <div style={{ color: '#94a3b8', marginBottom: 8 }}><CheckSquare size={36} /></div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Aucune tâche à venir</div>
                <Link to="/tasks" style={{ color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: 500, textDecoration: 'none' }}>Créer une tâche →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardClient({ stats }: { stats: DashboardStats | null }) {
  const hasChartData = (stats?.revenueData ?? []).some(d => d.value > 0);
  const hasPieData = (stats?.pieData ?? []).length > 0 && (stats?.pieData ?? []).some(d => d.value > 0);
  const hasActivity = (stats?.recentActivity ?? []).length > 0;

  return (
    <>
      {/* Hero welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '28px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        boxShadow: '0 8px 32px -8px rgba(37, 99, 235, 0.45)',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Tableau de bord
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>
            Bienvenue sur votre espace client
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.9rem', maxWidth: 450, lineHeight: 1.6 }}>
            Gérez vos documents, suivez vos demandes et communiquez avec votre cabinet comptable en toute simplicité.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/demandes" style={{
            background: '#fff',
            color: '#1e40af',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}>+ Nouvelle demande</Link>
          <Link to="/mon-espace" style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: '10px',
            padding: '10px 20px',
            fontWeight: 600,
            fontSize: '0.9rem',
            textDecoration: 'none',
          }}>Mes documents</Link>
        </div>
      </div>

      {/* Next meeting banner */}
      {stats?.nextMeeting && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ background: '#22c55e', color: '#fff', borderRadius: '10px', padding: '10px', display: 'flex' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.95rem' }}>
              Prochain rendez-vous : {stats.nextMeeting.title}
            </div>
            <div style={{ color: '#166534', fontSize: '0.85rem', marginTop: 2 }}>
              Prévu le {new Date(stats.nextMeeting.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <Link to="/meetings" style={{ marginLeft: 'auto', color: '#15803d', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
            Voir →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card blue animate-fade-in-up stagger-1">
          <div className="stat-card-header">
            <div className="stat-card-icon blue"><FileText size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.documents ?? 0}</div>
          <div className="stat-card-label">Mes documents</div>
        </div>
        <div className="stat-card green animate-fade-in-up stagger-2">
          <div className="stat-card-header">
            <div className="stat-card-icon green"><RefreshCw size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.invoices?.count ?? 0}</div>
          <div className="stat-card-label">Factures synchronisées</div>
        </div>
        <div className="stat-card orange animate-fade-in-up stagger-3">
          <div className="stat-card-header">
            <div className="stat-card-icon orange"><ClipboardList size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
          <div className="stat-card-label">Demandes en attente</div>
        </div>
        <div className="stat-card purple animate-fade-in-up stagger-4">
          <div className="stat-card-header">
            <div className="stat-card-icon purple"><Calendar size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.nextMeeting ? 1 : 0}</div>
          <div className="stat-card-label">Rendez-vous à venir</div>
        </div>
      </div>

      {/* Charts — only shown when there is real data */}
      {(hasChartData || hasPieData) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          {hasChartData && (
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">Évolution des dépenses (TND)</span>
              </div>
              <div className="dashboard-card-body">
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.revenueData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValueClient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                      <Tooltip wrapperStyle={{ borderRadius: '8px', overflow: 'hidden', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorValueClient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          {hasPieData && (
            <div className="dashboard-card">
              <div className="dashboard-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <span className="dashboard-card-title">Répartition des documents</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>Types de fichiers dans votre espace documentaire</span>
              </div>
              <div className="dashboard-card-body" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats?.pieData || []} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                        {(stats?.pieData || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip wrapperStyle={{ borderRadius: '8px', overflow: 'hidden', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', paddingTop: 12 }}>
                  {(stats?.pieData || []).map((entry, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ fontWeight: 500 }}>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick access */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
        <QuickCard to="/demandes" title="Mes demandes" desc="Suivre et créer des demandes" icon={ClipboardList} />
        <QuickCard to="/meetings" title="Mes rendez-vous" desc="Planification et suivi" icon={Calendar} />
        <QuickCard to="/messaging" title="Messagerie" desc="Échanger avec votre cabinet" icon={MessageCircle} />
        <QuickCard to="/" title="Trouver un comptable" desc="Annuaire et profils" icon={Search} />
        <QuickCard to="/archives" title="Archives" desc="Documents archivés" icon={Archive} />
      </div>

      {/* Recent activity */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <span className="dashboard-card-title">Activité récente</span>
          {hasActivity && (
            <Link to="/mon-espace" style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 500, textDecoration: 'none' }}>
              Voir tous les documents →
            </Link>
          )}
        </div>
        <div className="dashboard-card-body" style={{ padding: hasActivity ? '0.5rem 0' : undefined }}>
          {hasActivity ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(stats?.recentActivity ?? []).map((activity, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 20px',
                  borderBottom: i < (stats?.recentActivity?.length ?? 0) - 1 ? '1px solid var(--border-color)' : 'none',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg, #f8fafc)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: activity.type === 'Validé' ? '#f0fdf4' : activity.type === 'En cours' ? '#fffbeb' : '#eff6ff',
                    color: activity.type === 'Validé' ? '#16a34a' : activity.type === 'En cours' ? '#d97706' : '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FileText size={18} />
                  </div>
                  {/* Name + type */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activity.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(activity.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  {/* Badge */}
                  <span style={{
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: activity.type === 'Validé' ? '#dcfce7' : activity.type === 'En cours' ? '#fef9c3' : '#dbeafe',
                    color: activity.type === 'Validé' ? '#16a34a' : activity.type === 'En cours' ? '#b45309' : '#1d4ed8',
                  }}>
                    {activity.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '50%', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={28} />
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 8 }}>
                Aucune activité pour le moment
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 340, margin: '0 auto 18px' }}>
                Commencez par déposer un document ou envoyer une demande à votre comptable.
              </p>
              <Link to="/demandes" style={{
                display: 'inline-block',
                background: '#2563eb',
                color: '#fff',
                borderRadius: '10px',
                padding: '10px 24px',
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}>
                Créer une demande
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DashboardCollaborateur({ stats }: { stats: DashboardStats | null }) {
  const hasPendingReqs = (stats?.pendingRequests ?? 0) > 0;
  const hasPendingTasks = (stats?.pendingTasks ?? 0) > 0;

  return (
    <>
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 60%, #7c3aed 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '28px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        boxShadow: '0 8px 32px -8px rgba(79, 70, 229, 0.45)',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Espace collaborateur
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>
            Tableau de bord collaborateur
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.9rem', maxWidth: 460, lineHeight: 1.6 }}>
            Gérez les tâches assignées, suivez les demandes et accédez aux documents partagés par votre cabinet.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/tasks" style={{
            background: '#fff', color: '#4f46e5',
            borderRadius: '10px', padding: '10px 20px',
            fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
          }}>Mes tâches</Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card blue animate-fade-in-up stagger-1">
          <div className="stat-card-header">
            <div className="stat-card-icon blue"><ClipboardList size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
          <div className="stat-card-label">Demandes assignées</div>
        </div>
        <div className="stat-card orange animate-fade-in-up stagger-2">
          <div className="stat-card-header">
            <div className="stat-card-icon orange"><ListTodo size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.pendingTasks ?? 0}</div>
          <div className="stat-card-label">Tâches en cours</div>
        </div>
        <div className="stat-card purple animate-fade-in-up stagger-3">
          <div className="stat-card-header">
            <div className="stat-card-icon purple"><MessageCircle size={22} /></div>
          </div>
          <div className="stat-card-value">{stats?.messages ?? 0}</div>
          <div className="stat-card-label">Messages</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
        <QuickCard to="/tasks" title="Task management" desc="Kanban et suivi des tâches" icon={ListTodo} />
        <QuickCard to="/demandes" title="Mes demandes" desc="Demandes qui vous sont assignées" icon={ClipboardList} />
        <QuickCard to="/messaging" title="Messagerie" desc="Échanger avec votre équipe" icon={MessageCircle} />
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Demandes */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Demandes assignées</span>
            <Link to="/demandes" style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 500, textDecoration: 'none' }}>Voir toutes →</Link>
          </div>
          <div className="dashboard-card-body">
            {hasPendingReqs ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ClipboardList size={26} />
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {stats?.pendingRequests}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    demande{(stats?.pendingRequests ?? 0) > 1 ? 's' : ''} en attente de traitement
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)' }}>
                <CheckSquare size={20} style={{ color: '#22c55e' }} />
                <span>Aucune demande en attente — tout est à jour ✓</span>
              </div>
            )}
          </div>
        </div>

        {/* Tâches */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Tâches en cours</span>
            <Link to="/tasks" style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 500, textDecoration: 'none' }}>Voir toutes →</Link>
          </div>
          <div className="dashboard-card-body">
            {hasPendingTasks ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fff7ed, #fed7aa)',
                  color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ListTodo size={26} />
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {stats?.pendingTasks}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    tâche{(stats?.pendingTasks ?? 0) > 1 ? 's' : ''} à compléter
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)' }}>
                <CheckSquare size={20} style={{ color: '#22c55e' }} />
                <span>Aucune tâche en cours — bien joué ✓</span>
              </div>
            )}
          </div>
        </div>
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

