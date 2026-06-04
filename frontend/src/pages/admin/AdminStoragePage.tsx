import { useEffect, useState } from 'react';
import {
  fetchAdminStorage,
  type StorageItem,
  updateAdminStorageQuota,
} from '../../lib/api/adminService';

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = value;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current.toFixed(current >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function AdminStoragePage() {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminStorage();
      setItems(data);
      setLimits(
        data.reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = String(item.effectiveStorageLimit);
          return acc;
        }, {}),
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (item: StorageItem) => {
    try {
      await updateAdminStorageQuota(item.id, Number(limits[item.id]));
      setToast('Quota mis à jour');
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="ws-top-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="ws-title-block">
          <h1 className="page-title">Stockage</h1>
          <p className="page-subtitle">Suivi des usages par organisation et gestion des quotas.</p>
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
                  <th>Organisation</th>
                  <th>Propriétaire</th>
                  <th>Utilisé</th>
                  <th>Quota</th>
                  <th>Dépassement</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.owner.email}</td>
                    <td>{formatBytes(item.effectiveStorageUsed)}</td>
                    <td>
                      <input className="form-input" value={limits[item.id] ?? ''} onChange={(e) => setLimits((prev) => ({ ...prev, [item.id]: e.target.value }))} />
                    </td>
                    <td><span className={`status-badge ${item.exceeded ? 'danger' : 'success'}`}>{item.exceeded ? 'Oui' : 'Non'}</span></td>
                    <td>
                      <button className="ws-btn-outline" onClick={() => void save(item)}>Enregistrer</button>
                    </td>
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
