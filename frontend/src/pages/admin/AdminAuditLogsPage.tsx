import { useEffect, useState } from 'react';
import { exportAdminAuditLogs, fetchAdminAuditLogs, type AuditLogItem } from '../../lib/api/adminService';

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    entity: '',
    from: '',
    to: '',
  });
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchAdminAuditLogs(filters));
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const exportCsv = async () => {
    try {
      const csv = await exportAdminAuditLogs(filters);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-logs.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Export impossible');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="ws-top-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="ws-title-block">
          <h1 className="page-title">Journal d’audit</h1>
          <p className="page-subtitle">Historique complet des actions ADMIN avec filtres et export.</p>
        </div>
      </div>

      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <div className="dashboard-card-body" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <input className="form-input" placeholder="User ID" value={filters.userId} onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))} />
          <input className="form-input" placeholder="Action" value={filters.action} onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))} />
          <input className="form-input" placeholder="Entité" value={filters.entity} onChange={(e) => setFilters((prev) => ({ ...prev, entity: e.target.value }))} />
          <input className="form-input" type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          <input className="form-input" type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ws-btn-primary" onClick={() => void load()}>Filtrer</button>
            <button className="ws-btn-outline" onClick={() => void exportCsv()}>Exporter</button>
          </div>
        </div>
      </div>

      {toast ? <div className="dashboard-card" style={{ marginBottom: '1rem' }}>{toast}</div> : null}

      <div className="dashboard-card">
        <div className="dashboard-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '1rem' }}>Chargement...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Entité</th>
                  <th>Admin</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.action}</td>
                    <td>{item.entity}</td>
                    <td>{item.user?.email ?? 'Système'}</td>
                    <td>{item.ip ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
