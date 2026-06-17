import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  X,
  Pencil,
  Trash2,
  Check
} from 'lucide-react';
import { 
  fetchClientsStats, 
  createClient, 
  deleteClient,
  updateClient,
  type ClientData 
} from '../../lib/api/clientService';
import '../../styles/workspace-ui.css';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
// (Removed fake cover images and logo placeholders as per user request to match the collaborator card design)

// ──────────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  };

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
    role: 'CLIENT',
    experienceLevel: 'Junior',
    hireDate: '',
    email: '',
    companyName: '',
    password: '',
  });

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await fetchClientsStats();
      setClients(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sanitize data: remove empty strings for optional fields to avoid validation errors (e.g. IsDateString)
    const sanitizedData: any = { ...formData };
    if (!sanitizedData.birthDate) delete sanitizedData.birthDate;
    if (!sanitizedData.hireDate) delete sanitizedData.hireDate;
    if (!sanitizedData.phone) delete sanitizedData.phone;
    if (!sanitizedData.companyName) delete sanitizedData.companyName;
    if (!sanitizedData.password) delete sanitizedData.password;

    if (editingClient) {
      const res = await updateClient(editingClient.id, sanitizedData);
      if (res.ok) {
        showToast('ok', 'Client mis à jour avec succès');
        setEditingClient(null);
        setIsModalOpen(false);
        loadClients();
      } else {
        showToast('err', res.message || 'Erreur lors de la mise à jour');
      }
    } else {
      const res = await createClient(sanitizedData);
      if (res.ok) {
        showToast('ok', 'Client ajouté avec succès');
        setIsModalOpen(false);
        loadClients();
        setFormData({
          firstName: '',
          lastName: '',
          phone: '',
          birthDate: '',
          role: 'CLIENT',
          experienceLevel: 'Junior',
          hireDate: '',
          email: '',
          companyName: '',
          password: '',
        });
      } else {
        showToast('err', res.message || 'Erreur lors de la création');
      }
    }
  };

  const openEditModal = (client: ClientData) => {
    setEditingClient(client);
    setFormData({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      phone: client.phone || '',
      birthDate: client.birthDate ? new Date(client.birthDate).toISOString().split('T')[0] : '',
      role: client.role || 'CLIENT',
      experienceLevel: client.experienceLevel || 'Junior',
      hireDate: client.hireDate ? new Date(client.hireDate).toISOString().split('T')[0] : '',
      email: client.email || '',
      companyName: client.companyName || '',
      password: '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Voulez-vous vraiment supprimer le client "${name}" ?`)) {
      const res = await deleteClient(id);
      if (res.ok) {
        showToast('ok', 'Client supprimé');
        loadClients();
      } else {
        showToast('err', res.message || 'Erreur lors de la suppression');
      }
    }
  };

  const filtered = clients.filter(c => 
    (c.companyName || `${c.firstName} ${c.lastName}`).toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ padding: '1rem 2rem' }}>
      {/* Toast */}
      {toast && (
        <div className={`ws-toast ws-toast--${toast.kind === 'ok' ? 'success' : 'error'}`} style={{ 
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000,
          background: toast.kind === 'ok' ? '#10b981' : '#ef4444', color: '#fff',
          padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
        }}>
          {toast.kind === 'ok' ? <Check size={18} /> : <X size={18} />}
          {toast.text}
        </div>
      )}

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>Mes clients</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Gérez votre portefeuille de clients et leurs documents.</p>
        </div>
        <button 
          className="ws-btn-primary" 
          style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', gap: '0.75rem', fontWeight: 600 }}
          onClick={() => {
            setEditingClient(null);
            setFormData({
              firstName: '', lastName: '', phone: '', birthDate: '', role: 'CLIENT',
              experienceLevel: 'Junior', hireDate: '', email: '', companyName: '', password: ''
            });
            setIsModalOpen(true);
          }}
        >
          <Plus size={20} /> Nouveau client
        </button>
      </div>

      {/* Stats & Search Toolbar */}
      <div style={{ 
        background: '#fff', 
        padding: '1.25rem', 
        borderRadius: '16px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        border: '1px solid #f1f5f9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{clients.length} clients</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', width: '400px' }}>
          <div className="ws-search" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', height: '48px' }}>
            <Search size={20} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Rechercher par nom ou email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '0.95rem' }}
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
          <div className="ws-spinner" />
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '2rem',
          paddingBottom: '4rem'
        }}>
          {filtered.map((client, idx) => (
            <ClientCard 
              key={client.id} 
              client={client} 
              idx={idx}
              onEdit={() => openEditModal(client)}
              onDelete={() => handleDelete(client.id, client.companyName || client.firstName)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="ws-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="ws-modal" style={{ maxWidth: '640px', borderRadius: '24px' }} onClick={e => e.stopPropagation()}>
            <div className="ws-modal-header" style={{ padding: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{editingClient ? 'Modifier le client' : 'Nouveau client'}</h2>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Remplissez les informations pour {editingClient ? 'mettre à jour' : 'créer'} le profil.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrUpdate}>
              <div className="ws-modal-body" style={{ padding: '0 2rem 2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="ws-input-label">Nom de l'entreprise</label>
                    <input className="ws-input" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} placeholder="Ex: Ma Boutique SARL" />
                  </div>
                  <div>
                    <label className="ws-input-label">Prénom</label>
                    <input className="ws-input" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                  </div>
                  <div>
                    <label className="ws-input-label">Nom</label>
                    <input className="ws-input" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="ws-input-label">E-mail</label>
                    <input type="email" className="ws-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div>
                    <label className="ws-input-label">Téléphone</label>
                    <input className="ws-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="ws-input-label">Date de naissance</label>
                    <input type="date" className="ws-input" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="ws-input-label">{editingClient ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}</label>
                    <input type="password" title="password" className="ws-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingClient} />
                  </div>
                </div>
              </div>

              <div className="ws-modal-footer" style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderRadius: '0 0 24px 24px' }}>
                <button type="button" className="ws-btn-outline" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="ws-btn-primary" style={{ padding: '0.75rem 2.5rem' }}>
                   {editingClient ? 'Enregistrer les modifications' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientCard({ 
  client, 
  idx: _idx,
  onEdit,
  onDelete
}: { 
  client: ClientData, 
  idx: number,
  onEdit: () => void,
  onDelete: () => void
}) {
  const navigate = useNavigate();
  const displayName = client.companyName || `${client.firstName} ${client.lastName}`;
  
  const getInitials = () => {
    if (client.companyName) {
      return client.companyName.substring(0, 2).toUpperCase();
    }
    return `${(client.firstName || '')[0] || ''}${(client.lastName || '')[0] || ''}`.toUpperCase();
  };

  return (
    <div 
      className="ws-client-card-premium"
      onClick={() => navigate(`/clients/${client.id}/espace`)}
      style={{
        background: '#fff',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        position: 'relative',
        border: '1px solid #f1f5f9'
      }}
    >
      {/* Banner */}
      <div style={{ height: 110, background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: 'none', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Modifier">
            <Pencil size={16} style={{ stroke: '#3b82f6', strokeWidth: 2.5 }} />
          </button>
          <button onClick={onDelete} style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Supprimer">
            <Trash2 size={16} style={{ stroke: '#ef4444', strokeWidth: 2.5 }} />
          </button>
        </div>
      </div>

      <div style={{ padding: '0 1.25rem 1.25rem', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ 
          width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9',
          marginTop: -36, border: '4px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a', marginBottom: 12, zIndex: 10,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {getInitials()}
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', width: '100%' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{displayName}</h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>{client.email}</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#f1f5f9', margin: '0 20px' }} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '16px 20px' }}>
        <div style={{ textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>Doc traités</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{client.stats?.processed ?? 0}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>Doc en attente</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{client.stats?.pending ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

