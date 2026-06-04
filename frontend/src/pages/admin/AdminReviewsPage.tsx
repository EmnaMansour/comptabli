import { useEffect, useState } from 'react';
import {
  deleteAdminReview,
  fetchAdminReviews,
  type AdminStatus,
  type ReviewItem,
  updateAdminReviewStatus,
} from '../../lib/api/adminService';

export default function AdminReviewsPage() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchAdminReviews(status as never));
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const moderate = async (item: ReviewItem, next: AdminStatus) => {
    try {
      await updateAdminReviewStatus(item.id, next);
      setToast(`Avis mis à jour: ${next}`);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Action impossible');
    }
  };

  const remove = async (item: ReviewItem) => {
    if (!window.confirm('Supprimer cet avis ?')) return;
    try {
      await deleteAdminReview(item.id);
      setToast('Avis supprimé');
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="ws-top-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="ws-title-block">
          <h1 className="page-title">Modération des avis</h1>
          <p className="page-subtitle">Approbation, rejet et suppression des avis publiés.</p>
        </div>
      </div>

      <div className="dashboard-card" style={{ marginBottom: '1rem' }}>
        <div className="dashboard-card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <button className="ws-btn-primary" onClick={() => void load()}>Actualiser</button>
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
                  <th>Client</th>
                  <th>Comptable</th>
                  <th>Note</th>
                  <th>Commentaire</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.client.firstName} {item.client.lastName}</td>
                    <td>{item.accountant.firstName} {item.accountant.lastName}</td>
                    <td>{item.rating}/5</td>
                    <td>{item.comment || 'Aucun commentaire'}</td>
                    <td>{item.status}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="ws-btn-outline" onClick={() => void moderate(item, 'ACTIVE')}>Approuver</button>
                      <button className="ws-btn-outline" onClick={() => void moderate(item, 'INACTIVE')}>Rejeter</button>
                      <button className="ws-btn-outline" onClick={() => void remove(item)}>Supprimer</button>
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
