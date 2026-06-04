import { useEffect, useState } from 'react';
import {
  changeAdminPassword,
  fetchAdminProfile,
  type AdminProfile,
  updateAdminProfile,
} from '../../lib/api/adminService';

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminProfile()
      .then((result) => {
        setProfile(result);
        setForm({
          firstName: result.firstName,
          lastName: result.lastName,
          email: result.email,
        });
      })
      .catch((err: Error) => setToast(err.message));
  }, []);

  const saveProfile = async () => {
    try {
      const updated = await updateAdminProfile(form);
      setProfile(updated);
      setToast('Profil ADMIN mis à jour');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  };

  const savePassword = async () => {
    try {
      await changeAdminPassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      setToast('Mot de passe changé');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Changement impossible');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="ws-top-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="ws-title-block">
          <h1 className="page-title">Profil ADMIN</h1>
          <p className="page-subtitle">Mise à jour des informations et du mot de passe du compte unique ADMIN.</p>
        </div>
      </div>

      {toast ? <div className="dashboard-card" style={{ marginBottom: '1rem' }}>{toast}</div> : null}

      <div className="dashboard-grid equal">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Informations générales</span>
          </div>
          <div className="dashboard-card-body" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="ws-input-label">Prénom</label>
                <input className="ws-input" placeholder="Prénom" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="ws-input-label">Nom</label>
                <input className="ws-input" placeholder="Nom" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="ws-input-label">Email</label>
              <input className="ws-input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="ws-btn-primary" onClick={() => void saveProfile()}>Enregistrer les modifications</button>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Mot de passe</span>
          </div>
          <div className="dashboard-card-body" style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="ws-input-label">Mot de passe actuel</label>
              <input className="ws-input" type="password" placeholder="Saisir le mot de passe actuel" value={passwords.currentPassword} onChange={(e) => setPasswords((prev) => ({ ...prev, currentPassword: e.target.value }))} />
            </div>
            <div>
              <label className="ws-input-label">Nouveau mot de passe</label>
              <input className="ws-input" type="password" placeholder="Saisir le nouveau mot de passe" value={passwords.newPassword} onChange={(e) => setPasswords((prev) => ({ ...prev, newPassword: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="ws-btn-primary" onClick={() => void savePassword()}>Mettre à jour la sécurité</button>
            </div>
            {profile ? <span style={{ color: 'var(--text-muted)' }}>Compte: {profile.email}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
