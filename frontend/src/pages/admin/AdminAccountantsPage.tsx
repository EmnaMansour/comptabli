import { useEffect, useMemo, useState } from 'react';
import { Pencil, Power, Trash2 } from 'lucide-react';
import {
  deleteAdminAccountant,
  fetchAdminAccountant,
  fetchAdminAccountants,
  type AccountantDetails,
  updateAdminUserStatus,
} from '../../lib/api/adminService';

export default function AdminAccountantsPage() {
  const [items, setItems] = useState<AccountantDetails[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AccountantDetails | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminAccountants({ status: status as never, search });
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.firstName} ${item.lastName} ${item.email} ${item.companyName ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [items, search],
  );

  const viewDetails = async (id: string) => {
    try {
      setSelected(await fetchAdminAccountant(id));
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Impossible de charger le détail');
    }
  };

  const toggleStatus = async (item: AccountantDetails) => {
    const next = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateAdminUserStatus(item.id, next);
      setToast(`Statut mis à jour: ${next}`);
      await load();
      if (selected?.id === item.id) {
        setSelected(await fetchAdminAccountant(item.id));
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Action impossible');
    }
  };

  const remove = async (item: AccountantDetails) => {
    if (!window.confirm(`Supprimer le comptable ${item.email} ?`)) return;
    try {
      await deleteAdminAccountant(item.id);
      setSelected(null);
      setToast('Comptable supprimé');
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="ws-top-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="ws-title-block">
          <h1 className="page-title">Gestion des comptables</h1>
          <p className="page-subtitle">Activation, suspension et suivi détaillé des cabinets.</p>
        </div>
      </div>

      <div className="dashboard-card" style={{ marginBottom: '1.25rem' }}>
        <div className="dashboard-card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ minWidth: 260 }} placeholder="Rechercher un comptable" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Désactivé</option>
          </select>
          <button className="ws-btn-primary" onClick={() => void load()}>Actualiser</button>
        </div>
      </div>

      {toast ? <div className="dashboard-card" style={{ marginBottom: '1rem' }}>{toast}</div> : null}
      {loading ? <div className="dashboard-card">Chargement...</div> : null}
      {error ? <div className="dashboard-card">{error}</div> : null}

      {!loading && !error ? (
        <div className="dashboard-grid equal">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-title">Liste des comptables</span>
            </div>
            <div className="dashboard-card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Statut</th>
                    <th>Clients</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: 16, border: '1px dashed #cbd5e1' }}>
                          <span style={{ fontSize: '40px', display: 'block', marginBottom: '1rem', opacity: 0.5 }}>📊</span>
                          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>Aucun comptable trouvé.</div>
                          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Ajustez vos filtres de recherche.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                              {item.firstName[0]}{item.lastName[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.firstName} {item.lastName}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.companyName || 'Indépendant'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{item.email}</td>
                        <td><span className={`status-badge ${badgeTone(item.status)}`}>{item.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>{item.stats?.clients ?? 0}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>clients</span>
                          </div>
                        </td>
                        <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            title="Voir le Profil Détaillé"
                            style={{ padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: '#64748b', transition: 'color 0.2s', borderRadius: '8px' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                            onClick={() => void viewDetails(item.id)}
                          >
                            <Pencil size={18} />
                          </button>
                          
                          <button
                            title={item.status === 'ACTIVE' ? "Désactiver le cabinet" : "Activer le cabinet"}
                            style={{ padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: item.status === 'ACTIVE' ? '#64748b' : '#ef4444', transition: 'color 0.2s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = item.status === 'ACTIVE' ? '#d97706' : '#16a34a')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = item.status === 'ACTIVE' ? '#64748b' : '#ef4444')}
                            onClick={() => void toggleStatus(item)}
                          >
                            <Power size={18} />
                          </button>
                          
                          <button
                            title="Supprimer le cabinet définitivement"
                            style={{ padding: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: '#ef4444', opacity: 0.8, transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1)'; }}
                            onClick={() => void remove(item)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-title">Profil détaillé</span>
            </div>
            <div className="dashboard-card-body" style={{ display: 'grid', gap: 12 }}>
              {selected ? (
                <>
                  <InfoLine label="Nom" value={`${selected.firstName} ${selected.lastName}`} />
                  <InfoLine label="Email" value={selected.email} />
                  <InfoLine label="Statut" value={selected.status} />
                  <InfoLine label="Clients" value={String(selected.accountantClients.length)} />
                  <InfoLine label="Collaborateurs" value={String(selected.accountantCollaborators.length)} />
                  <InfoLine label="Organisations" value={String(selected.ownedOrganizations.length)} />
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Sélectionnez un comptable pour afficher son détail.</span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function badgeTone(status: string) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING') return 'warning';
  return 'danger';
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}
