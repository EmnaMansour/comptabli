import { useEffect, useState } from 'react';
import { AlertTriangle, Database, LifeBuoy, UserPlus, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchAdminDashboard, type AdminDashboardData } from '../../lib/api/adminService';

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let current = value;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(current >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchAdminDashboard()
      .then((result) => {
        if (mounted) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const cards = data
    ? [
        { label: 'Utilisateurs', value: data.globalStats.totalUsers, icon: Users, tone: 'blue' },
        { label: 'Nouveaux inscrits', value: data.globalStats.newUsersToday, icon: UserPlus, tone: 'green' },
        { label: 'Stockage utilisé', value: formatBytes(data.globalStats.storageUsed), icon: Database, tone: 'orange' },
        // { label: 'Alertes système', value: data.globalStats.alerts, icon: AlertTriangle, tone: 'purple' },
      ]
    : [];

  return (
    <div className="animate-fade-in ws-page">
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #3b82f6 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '28px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        boxShadow: '0 8px 32px -8px rgba(59, 130, 246, 0.45)',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Tableau de bord
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>
            Bienvenue sur l'espace administrateur
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.9rem', maxWidth: 460, lineHeight: 1.6 }}>
            Aperçu global de la performance, gestion des utilisateurs et surveillance des indicateurs clés de la plateforme.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => window.location.reload()} style={{
            background: '#fff', color: '#1e40af', border: 'none',
            borderRadius: '10px', padding: '10px 20px', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Rafraîchir les données
          </button>
        </div>
      </div>

      {loading ? <div className="dashboard-card">Chargement du dashboard...</div> : null}
      {error ? <div className="dashboard-card">{error}</div> : null}

      {!loading && !error && data ? (
        <>
          <div className="stats-grid" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
            {cards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div 
                  key={card.label} 
                  className={`stat-card ${card.tone} animate-fade-in-up stagger-${index + 1}`}
                  style={{ 
                    padding: '1.75rem', 
                    borderRadius: 24, 
                    border: '1px solid #f1f5f9',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    boxShadow: '0 4px 20px -1px rgba(0,0,0,0.04)',
                    overflow: 'visible'
                  }}
                >
                  <div className="stat-card-header" style={{ marginBottom: '1.25rem' }}>
                    <div className={`stat-card-icon ${card.tone}`} style={{ width: 52, height: 52, borderRadius: 16, boxShadow: '0 8px 16px -4px rgba(0,0,0,0.1)' }}>
                      <Icon size={24} />
                    </div>
                    {/* Placeholder for trend indicator if needed */}
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                       Live
                       <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'pulse 2s infinite' }}></div>
                    </div>
                  </div>
                  <div className="stat-card-value" style={{ fontSize: '2.25rem', letterSpacing: '-0.03em', fontWeight: 900, marginBottom: '0.25rem' }}>
                    {card.value}
                  </div>
                  <div className="stat-card-label" style={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                    {card.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
            <div className="dashboard-card" style={{ borderRadius: 24, padding: '1.25rem' }}>
              <div className="dashboard-card-header" style={{ border: 'none', padding: '0.5rem 0.5rem 1.5rem' }}>
                <span className="dashboard-card-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Croissance de la plateforme</span>
              </div>
              <div className="dashboard-card-body" style={{ padding: 0 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data.growth}>
                    <defs>
                      <linearGradient id="adminGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#94a3b8' }} 
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fontSize: 11, fill: '#94a3b8' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      fill="url(#adminGrowth)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-card" style={{ borderRadius: 24, padding: '1.25rem' }}>
              <div className="dashboard-card-header" style={{ border: 'none', padding: '0.5rem 0.5rem 1.5rem' }}>
                <span className="dashboard-card-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Répartition par Rôle</span>
              </div>
              <div className="dashboard-card-body" style={{ padding: 0, display: 'grid', gap: 10 }}>
                {Object.entries(data.usersByRole).map(([role, count]) => (
                  <div 
                    key={role} 
                    style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '1rem 1.25rem', borderRadius: 16, background: '#f8fafc',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: role === 'ADMIN' ? '#ef4444' : role === 'COMPTABLE' ? '#3b82f6' : '#10b981' }}></div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>{role}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dashboard-grid equal" style={{ marginBottom: '2.5rem' }}>
            <div className="dashboard-card" style={{ borderRadius: 24, padding: '1.25rem' }}>
              <div className="dashboard-card-header" style={{ border: 'none', padding: '0.5rem 0.5rem 1.5rem' }}>
                <span className="dashboard-card-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Signalements & Support</span>
              </div>
              <div className="dashboard-card-body" style={{ padding: 0, display: 'grid', gap: 12 }}>
                <AlertRow label="Comptables à valider" value={data.systemAlerts.pendingComptables} icon={<Users size={18} />} />
                <AlertRow label="Saturations stockage" value={data.systemAlerts.storageOverages} icon={<Database size={18} />} />
                <AlertRow label="Avis en attente" value={data.systemAlerts.pendingReviews} icon={<AlertTriangle size={18} />} />
                <AlertRow label="Demandes support" value={data.systemAlerts.pendingRequests} icon={<LifeBuoy size={18} />} />
              </div>
            </div>

            <div className="dashboard-card" style={{ borderRadius: 24, padding: '1.25rem' }}>
              <div className="dashboard-card-header" style={{ border: 'none', padding: '0.5rem 0.5rem 1.5rem' }}>
                <span className="dashboard-card-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Journal d'audit récent</span>
              </div>
              <div className="dashboard-card-body" style={{ padding: data.recentAuditLogs.length === 0 ? '2rem 1rem' : 0 }}>
                {data.recentAuditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <AlertTriangle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>Aucun événement récent</div>
                    <div style={{ fontSize: '0.85rem' }}>Les actions systémiques apparaîtront ici.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 1 }}>
                    {data.recentAuditLogs.map((log) => (
                      <div 
                        key={log.id} 
                        style={{ 
                          padding: '1rem 0.5rem', 
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>{log.action}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.entity} • {log.user?.email ?? 'Système'}</div>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textAlign: 'right' }}>
                          {new Date(log.createdAt).toLocaleDateString()}
                          <div style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.7 }}>{new Date(log.createdAt).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AlertRow({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const isCritical = value > 0;
  return (
    <div 
      style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '1.15rem 1.25rem', borderRadius: 18, 
        background: isCritical ? '#fff1f2' : '#f8fafc',
        border: `1px solid ${isCritical ? '#ffe4e6' : '#f1f5f9'}`,
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 38, height: 38, borderRadius: 12, 
          background: isCritical ? '#ef4444' : '#94a3b8', 
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isCritical ? '0 4px 12px rgba(239, 68, 68, 0.2)' : 'none'
        }}>
          {icon}
        </div>
        <span style={{ fontWeight: 700, color: isCritical ? '#991b1b' : '#64748b' }}>{label}</span>
      </div>
      <div 
        style={{ 
          background: isCritical ? '#ef4444' : '#f1f5f9',
          color: isCritical ? 'white' : '#64748b',
          padding: '4px 12px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 800
        }}
      >
        {value}
      </div>
    </div>
  );
}
