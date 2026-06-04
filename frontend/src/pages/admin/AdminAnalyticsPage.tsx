import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchAdminAnalytics, type AnalyticsData } from '../../lib/api/adminService';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminAnalytics()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="ws-top-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="ws-title-block">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Croissance, usage produit et rétention sur 30 jours.</p>
        </div>
      </div>

      {error ? <div className="dashboard-card">{error}</div> : null}
      {!data ? <div className="dashboard-card">Chargement...</div> : null}

      {data ? (
        <>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card blue">
              <div className="stat-card-value">{data.retention.eligibleUsers}</div>
              <div className="stat-card-label">Base de rétention</div>
            </div>
            <div className="stat-card green">
              <div className="stat-card-value">{data.retention.retainedUsers}</div>
              <div className="stat-card-label">Utilisateurs retenus</div>
            </div>
            <div className="stat-card orange">
              <div className="stat-card-value">{data.retention.retentionRate}%</div>
              <div className="stat-card-label">Taux de rétention</div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">Croissance utilisateurs</span>
              </div>
              <div className="dashboard-card-body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">Fonctionnalités utilisées</span>
              </div>
              <div className="dashboard-card-body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.featureUsage} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="feature" width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
