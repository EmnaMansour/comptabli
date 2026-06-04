import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  Power,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUser,
  fetchAdminUsers,
  type AdminRole,
  type AdminStatus,
  type AdminUser,
  updateAdminUser,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../../lib/api/adminService';

const allRoles: AdminRole[] = ['CLIENT', 'COLLABORATEUR', 'COMPTABLE', 'ADMIN'];
const creatableRoles: Exclude<AdminRole, 'ADMIN'>[] = ['CLIENT', 'COLLABORATEUR', 'COMPTABLE'];

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  role: Exclude<AdminRole, 'ADMIN'>;
  status: AdminStatus;
  password: string;
  confirmPassword: string;
  accountantId?: string;
};

const emptyForm: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyName: '',
  role: 'CLIENT',
  status: 'ACTIVE',
  password: '',
  confirmPassword: '',
  accountantId: '',
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  
  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 5000);
  };
  const [selected, setSelected] = useState<(AdminUser & Record<string, unknown>) | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    accountantId: '',
  });
  const [itemToDelete, setItemToDelete] = useState<AdminUser | null>(null);

  const [accountants, setAccountants] = useState<AdminUser[]>([]);

  useEffect(() => {
    fetchAdminUsers({ role: 'COMPTABLE' })
      .then(setAccountants)
      .catch(console.error);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers({ role: role as never, status: status as never, search });
      setItems(data);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role, status]);

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.firstName} ${item.lastName} ${item.email} ${item.companyName ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [items, search],
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status === 'ACTIVE').length,
      pending: items.filter((item) => item.status === 'PENDING').length,
      disabled: items.filter((item) => item.status === 'INACTIVE').length,
    }),
    [items],
  );

  const viewUser = async (id: string) => {
    try {
      const data = await fetchAdminUser(id);
      setSelected(data);
      
      let assignedAcc = '';
      if (data.role === 'CLIENT' && data.clientAccountants?.[0]) {
        assignedAcc = data.clientAccountants[0].accountant.id;
      } else if (data.role === 'COLLABORATEUR' && data.collaboratorAccountants?.[0]) {
        assignedAcc = data.collaboratorAccountants[0].accountant.id;
      }

      setEditForm({
        firstName: String(data.firstName ?? ''),
        lastName: String(data.lastName ?? ''),
        email: String(data.email ?? ''),
        phone: String(data.phone ?? ''),
        companyName: String(data.companyName ?? ''),
        accountantId: assignedAcc,
      });
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Impossible de charger ce profil');
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      showToast('err', 'Les mots de passe ne correspondent pas');
      return;
    }
    try {
      const created = await createAdminUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        companyName: form.companyName || undefined,
        role: form.role,
        status: form.status,
        password: form.password,
        accountantId: form.accountantId || undefined,
      });
      setCreateOpen(false);
      setForm(emptyForm);
      showToast('ok', 
        created.mailSent
          ? `Utilisateur cree et e-mail envoye. Mot de passe temporaire: ${created.temporaryPassword ?? form.password}`
          : `Utilisateur cree. E-mail non envoye. Mot de passe temporaire: ${created.temporaryPassword ?? form.password}`,
      );
      await load();
      await viewUser(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Creation impossible';
      let errorText = message;
      if (message.includes('Email already in use') || message.includes('(409)')) {
        errorText = "Cette adresse e-mail est déjà utilisée par un autre compte.";
      } else if (message.includes('(404)')) {
        errorText = `${message}. Redémarrez le backend NestJS.`;
      }
      showToast('err', errorText);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected?.id) return;
    try {
      await updateAdminUser(selected.id, editForm);
      setEditOpen(false);
      showToast('ok', 'Utilisateur mis a jour');
      await load();
      await viewUser(selected.id);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Mise a jour impossible');
    }
  };

  const changeStatus = async (item: AdminUser, next: AdminStatus) => {
    try {
      await updateAdminUserStatus(item.id, next);
      showToast('ok', `Statut mis a jour: ${next}`);
      await load();
      if (selected?.id === item.id) await viewUser(item.id);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Action impossible');
    }
  };

  const changeRole = async (item: AdminUser, next: AdminRole) => {
    try {
      await updateAdminUserRole(item.id, next);
      showToast('ok', `Role mis a jour: ${next}`);
      await load();
      if (selected?.id === item.id) await viewUser(item.id);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Changement de role impossible');
    }
  };

  // const resetPassword = async (item: AdminUser) => {
  //   if (!window.confirm(`Reinitialiser le mot de passe de ${item.email} ?`)) return;
  //   try {
  //     const result = await resetAdminUserPassword(item.id);
  //     setToast(`Mot de passe temporaire: ${result.temporaryPassword}`);
  //   } catch (err) {
  //     setToast(err instanceof Error ? err.message : 'Reinitialisation impossible');
  //   }
  // };

  const removeUser = async (user: AdminUser) => {
    try {
      await deleteAdminUser(user.id);
      if (selected?.id === user.id) setSelected(null);
      showToast('ok', 'Utilisateur supprimé avec succès');
      await load();
      setItemToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Suppression impossible';
      showToast('err', msg);
      setItemToDelete(null);
    }
  };

  return (
    <div className="animate-fade-in ws-page" style={{ padding: '0 0.5rem' }}>
      <div className="ws-top-bar" style={{ marginBottom: '2rem' }}>
        <div className="ws-title-block">
          <h1 className="page-title">Administration</h1>
          <p className="page-subtitle">Gestion globale des utilisateurs, rôles et accès sécurité.</p>
        </div>
        <button className="ws-btn-primary" onClick={() => setCreateOpen(true)}>
          <UserPlus size={18} /> Nouvel Utilisateur
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <StatCard label="Total utilisateurs" value={stats.total} icon={Users} tone="blue" />
        <StatCard label="Comptes actifs" value={stats.active} icon={CheckCircle2} tone="green" />
        <StatCard label="En attente" value={stats.pending} icon={Shield} tone="orange" />
        <StatCard label="Desactives" value={stats.disabled} icon={KeyRound} tone="purple" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginRight: '1rem' }}>
            {stats.total} Utilisateurs
          </div>
          <select className="ws-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Tous les rôles</option>
            {allRoles.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select className="ws-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING">PENDING</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
        <div className="ws-search" style={{ minWidth: '320px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {toast && (
        <div className={`ws-toast ws-toast--${toast.kind === 'ok' ? 'success' : 'error'}`} style={{ 
          marginBottom: '1.5rem',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {toast.kind === 'ok' ? (
              <div style={{ background: '#10b981', color: 'white', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✓</div>
            ) : (
              <div style={{ background: '#ef4444', color: 'white', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 'bold' }}>!</div>
            )}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} style={{ opacity: 0.6 }}>
            <X size={18} />
          </button>
        </div>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement des utilisateurs...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', background: '#fff', borderRadius: 24, border: '1.5px dashed #e2e8f0', textAlign: 'center' }}>
             <Users size={48} color="#94a3b8" style={{ marginBottom: '1.25rem', opacity: 0.5 }} />
             <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Aucun utilisateur trouvé</h3>
             <p style={{ color: '#64748b' }}>Ajustez vos filtres ou effectuez une nouvelle recherche.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {filtered.map((item) => (
              <div 
                key={item.id} 
                className="dashboard-card" 
                style={{ 
                  padding: '1.5rem', 
                  borderRadius: 20, 
                  position: 'relative',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'default',
                  border: '1px solid #f1f5f9'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 25px -5px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ 
                      width: 48, height: 48, borderRadius: 14, 
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)', 
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontWeight: 800, fontSize: '1rem', boxShadow: '0 4px 10px rgba(30, 58, 138, 0.2)' 
                    }}>
                      {item.firstName[0]}{item.lastName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {item.firstName} {item.lastName}
                        {item.role === 'ADMIN' && <Shield size={14} color="#ef4444" />}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.email}</div>
                    </div>
                  </div>
                  
                  <div 
                    style={{ 
                      padding: '4px 10px', borderRadius: 8, fontSize: '0.65rem', fontWeight: 800,
                      background: item.status === 'ACTIVE' ? '#f0fdf4' : item.status === 'PENDING' ? '#fffbeb' : '#fef2f2',
                      color: item.status === 'ACTIVE' ? '#166534' : item.status === 'PENDING' ? '#92400e' : '#991b1b',
                      border: `1px solid ${item.status === 'ACTIVE' ? '#dcfce7' : item.status === 'PENDING' ? '#fde68a' : '#fee2e2'}`
                    }}
                  >
                    {item.status}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 12, marginBottom: '1.25rem' }}>
                   <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6, letterSpacing: '0.05em' }}>Rôle & Attribution</div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <select 
                        className="ws-select" 
                        style={{ padding: '4px 8px', fontSize: '0.85rem', height: 'auto', background: 'white' }}
                        value={item.role} 
                        onChange={(e) => void changeRole(item, e.target.value as AdminRole)}
                      >
                        {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      
                      {item.role === 'CLIENT' && item.clientAccountants?.[0]?.accountant ? (
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>
                          Dir. {item.clientAccountants[0].accountant.lastName}
                        </div>
                      ) : null}
                   </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="ws-icon-btn"
                      style={{ width: 34, height: 34 }}
                      onClick={() => { void viewUser(item.id); setEditOpen(true); }}
                      title="Modifier les informations"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="ws-icon-btn"
                      style={{ width: 34, height: 34, color: item.status === 'ACTIVE' ? '#d97706' : '#10b981' }}
                      onClick={() => void changeStatus(item, item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                      title={item.status === 'ACTIVE' ? "Suspendre l'accès" : "Réactiver l'accès"}
                    >
                      <Power size={15} />
                    </button>
                  </div>
                  
                  {item.role !== 'ADMIN' && (
                    <button
                      onClick={() => setItemToDelete(item)}
                      style={{ 
                        background: '#fef2f2', color: '#ef4444', border: 'none', 
                        padding: '8px 12px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Trash2 size={14} /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen ? (
        <UserModal
          title="Ajouter un utilisateur"
          subtitle="Creation d'un compte avec envoi d'identifiants par e-mail."
          form={form}
          setForm={setForm}
          onClose={() => setCreateOpen(false)}
          onSubmit={submitCreate}
          creatableRoles={creatableRoles}
          showPassword
          accountants={accountants}
          error={toast?.kind === 'err' ? toast.text : null}
        />
      ) : null}

      {editOpen && selected ? (
        <EditModal
          values={editForm}
          onChange={setEditForm}
          onClose={() => setEditOpen(false)}
          onSubmit={submitEdit}
          role={selected.role}
          accountants={accountants}
          error={toast?.kind === 'err' ? toast.text : null}
        />
      ) : null}

      {itemToDelete && (
        <DeleteConfirmModal 
          user={itemToDelete} 
          onClose={() => setItemToDelete(null)} 
          onConfirm={() => removeUser(itemToDelete)} 
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: 'blue' | 'green' | 'orange' | 'purple';
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-card-header">
        <div className={`stat-card-icon ${tone}`}>
          <Icon size={22} />
        </div>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

// function DetailLine({ label, value }: { label: string; value: string }) {
//   return (
//     <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
//       <strong>{label}</strong>
//       <span style={{ textAlign: 'right' }}>{value}</span>
//     </div>
//   );
// }

function UserModal({
  title,
  subtitle,
  form,
  setForm,
  onClose,
  onSubmit,
  creatableRoles,
  showPassword,
  accountants,
  error,
}: {
  title: string;
  subtitle: string;
  form: UserFormState;
  setForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  creatableRoles: Exclude<AdminRole, 'ADMIN'>[];
  showPassword: boolean;
  accountants: AdminUser[];
  error?: string | null;
}) {
  return (
    <div className="ws-modal-overlay" onClick={onClose}>
      <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="ws-modal-header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </div>
        {error ? (
          <div style={{ padding: '12px 20px', background: '#fee2e2', color: '#b91c1c', borderBottom: '1px solid #fecaca', fontSize: '0.9rem' }}>
            {error}
          </div>
        ) : null}
        <form onSubmit={onSubmit}>
          <div className="ws-modal-body" style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="ws-input" placeholder="Prenom" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} required />
              <input className="ws-input" placeholder="Nom" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="ws-input" type="email" placeholder="Adresse e-mail" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
              <input className="ws-input" placeholder="Telephone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <input className="ws-input" placeholder="Societe / Cabinet" value={form.companyName} onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <select className="ws-select" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Exclude<AdminRole, 'ADMIN'> }))}>
                {creatableRoles.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <select className="ws-select" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as AdminStatus }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            
            {['CLIENT', 'COLLABORATEUR'].includes(form.role) ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <select className="ws-select" value={form.accountantId || ''} onChange={(e) => setForm((prev) => ({ ...prev, accountantId: e.target.value }))}>
                  <option value="">-- Aucun comptable assigné --</option>
                  {accountants.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.firstName} {acc.lastName}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {showPassword ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input className="ws-input" type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} required />
                <input className="ws-input" type="password" placeholder="Confirmer mot de passe" value={form.confirmPassword} onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} required />
              </div>
            ) : null}
          </div>
          <div className="ws-modal-footer">
            <button type="button" className="ws-btn-outline" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="ws-btn-primary">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditModal({
  values,
  onChange,
  onClose,
  onSubmit,
  role,
  accountants,
  error,
}: {
  values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    companyName: string;
    accountantId: string;
  };
  onChange: React.Dispatch<
    React.SetStateAction<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      companyName: string;
      accountantId: string;
    }>
  >;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  role: AdminRole;
  accountants: AdminUser[];
  error?: string | null;
}) {
  return (
    <div className="ws-modal-overlay" onClick={onClose}>
      <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="ws-modal-header">
          <div>
            <h2>Modifier l'utilisateur</h2>
            <p>Mettez a jour les informations principales du compte.</p>
          </div>
        </div>
        {error ? (
          <div style={{ padding: '12px 20px', background: '#fee2e2', color: '#b91c1c', borderBottom: '1px solid #fecaca', fontSize: '0.9rem' }}>
            {error}
          </div>
        ) : null}
        <form onSubmit={onSubmit}>
          <div className="ws-modal-body" style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="ws-input" placeholder="Prenom" value={values.firstName} onChange={(e) => onChange((prev) => ({ ...prev, firstName: e.target.value }))} required />
              <input className="ws-input" placeholder="Nom" value={values.lastName} onChange={(e) => onChange((prev) => ({ ...prev, lastName: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="ws-input" type="email" placeholder="Adresse e-mail" value={values.email} onChange={(e) => onChange((prev) => ({ ...prev, email: e.target.value }))} required />
              <input className="ws-input" placeholder="Telephone" value={values.phone} onChange={(e) => onChange((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <input className="ws-input" placeholder="Societe / Cabinet" value={values.companyName} onChange={(e) => onChange((prev) => ({ ...prev, companyName: e.target.value }))} />
            
            {['CLIENT', 'COLLABORATEUR'].includes(role) ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <select className="ws-select" value={values.accountantId || ''} onChange={(e) => onChange((prev) => ({ ...prev, accountantId: e.target.value }))}>
                  <option value="">-- Aucun comptable assigné --</option>
                  {accountants.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.firstName} {acc.lastName}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="ws-modal-footer">
            <button type="button" className="ws-btn-outline" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="ws-btn-primary">
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="ws-modal-overlay" onClick={onClose}>
      <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="ws-modal-body" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div className="ws-delete-modal-icon">
            <Trash2 size={24} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem' }}>Confirmer la suppression</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
            Voulez-vous vraiment supprimer l'utilisateur <strong>{user.email}</strong> ? Cette action est irréversible.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="ws-btn-outline" onClick={onClose} style={{ justifyContent: 'center' }}>
              Annuler
            </button>
            <button 
              className="ws-btn-primary" 
              onClick={onConfirm} 
              style={{ background: '#ef4444', boxShadow: '0 6px 16px rgba(239, 68, 68, 0.25)', justifyContent: 'center' }}
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
