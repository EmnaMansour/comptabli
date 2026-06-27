import React, { useEffect, useState } from 'react';
import { Plus, Search, Power, MessageCircle, X, FileText } from 'lucide-react';
import { fetchCollaboratorsStats, createCollaborator, deleteCollaborator, type CollaboratorData } from '../../lib/api/collaboratorService';
import { useNavigate } from 'react-router-dom';
import '../../styles/workspace-ui.css';

export default function CollaboratorsPage() {
  const navigate = useNavigate();

  const [collaborators, setCollaborators] = useState<CollaboratorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCollab, setNewCollab] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
    experienceLevel: 'Junior',
    hireDate: '',
    email: '',
    password: '',
    // Fake upload state for cinematic effect
    cinFile: null as File | null,
    diplomaFile: null as File | null,
  });

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmText: 'Confirmer',
    confirmColor: '#10b981',
    action: () => {}
  });

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4500);
  };

  const loadCollaborators = async () => {
    setLoading(true);
    const data = await fetchCollaboratorsStats();
    setCollaborators(data);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCollaborators();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollab.firstName || !newCollab.email) return;
    
    // Default pwd matching backend
    const payload = {
      firstName: newCollab.firstName,
      lastName: newCollab.lastName,
      email: newCollab.email,
      password: newCollab.password,
      phone: newCollab.phone,
      birthDate: newCollab.birthDate,
      experienceLevel: newCollab.experienceLevel,
      hireDate: newCollab.hireDate,
      // Pass fake URLs for the mock up
      cinUrl: newCollab.cinFile ? newCollab.cinFile.name : undefined,
      diplomaUrl: newCollab.diplomaFile ? newCollab.diplomaFile.name : undefined,
    };

    const res = await createCollaborator(payload);
    if (res.ok) {
      setIsModalOpen(false);
      setNewCollab({ firstName: '', lastName: '', phone: '', birthDate: '', experienceLevel: 'Junior', hireDate: '', email: '', password: '', cinFile: null, diplomaFile: null });
      loadCollaborators();
    } else {
      alert(res.message);
    }
  };

  const handleDelete = async (collab: CollaboratorData) => {
    const hasRemainingTasks = collab.stats.total > collab.stats.done;
    
    if (hasRemainingTasks) {
      showToast('err', "Désactivation impossible : ce collaborateur a encore des tâches actives.");
      return;
    }

    setConfirmModal({
      show: true,
      title: 'Supprimer le compte',
      message: `Êtes-vous sûr de vouloir Supprimer le compte de ${collab.firstName} ${collab.lastName} ?`,
      confirmText: 'Supprimer',
      confirmColor: '#ef4444',
      action: async () => {
        const res = await deleteCollaborator(collab.id);
        if (res.ok) {
          showToast('ok', 'Le collaborateur a été désactivé.');
          loadCollaborators();
        } else {
          showToast('err', res.message || 'Erreur lors de la désactivation');
        }
      }
    });
  };

  const filteredCollabs = collaborators.filter(c => 
    (c.firstName + ' ' + c.lastName).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '0 0 2rem 0', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {toast && (
        <div className={`ws-toast ws-toast--${toast.kind === 'ok' ? 'success' : 'error'}`} style={{ zIndex: 10001 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toast.kind === 'ok' ? <Plus size={18} style={{ transform: 'rotate(45deg)' }} /> : <X size={18} />}
            {toast.text}
          </span>
          <button type="button" onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>Mes Collaborateurs</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gérez votre équipe et suivez leurs performances.</p>
        </div>
        <button className="ws-btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Ajouter un collaborateur
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{filteredCollabs.length} collaborateurs</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="ws-input-row" style={{ width: 240, margin: 0 }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input 
              className="ws-input" 
              placeholder="Rechercher..." 
              style={{ paddingLeft: 38 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {filteredCollabs.map(collab => (
            <div key={collab.id} style={{
              background: 'white',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              border: '1px solid var(--border-color)',
              position: 'relative'
            }}>
              {/* Banner */}
              <div style={{ height: 100, background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/collaborators/${collab.id}`); }} style={{ width: 28, height: 28, borderRadius: 6, background: '#fff', border: 'none', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Détails du profil">
                    <MessageCircle size={14} style={{ fill: '#3b82f6' }} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(collab); }} style={{ width: 28, height: 28, borderRadius: 6, background: '#fff', border: 'none', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="Supprimer">
                    <Power size={14} style={{ fill: '#3b82f6' }} />
                  </button>
                </div>
              </div>
              
              <div style={{ padding: '0 1.25rem 1.25rem', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div onClick={() => navigate(`/collaborators/${collab.id}`)} style={{ 
                  width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9', cursor: 'pointer',
                  marginTop: -36, border: '4px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a', marginBottom: 12, zIndex: 10,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {collab.firstName[0]}{collab.lastName[0]}
                </div>
                
                <div onClick={() => navigate(`/collaborators/${collab.id}`)} style={{ textAlign: 'center', marginBottom: '1.5rem', width: '100%', cursor: 'pointer' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{collab.firstName} {collab.lastName}</h3>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{collab.experienceLevel || 'Comptable junior'}</p>
                </div>

                <div style={{ width: '100%', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: collab.performance > 50 ? '#10b981' : '#f59e0b' }}>
                        {collab.performance}% 
                      </span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${collab.performance}%`, height: '100%', background: collab.performance > 50 ? '#10b981' : '#f59e0b', borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'lowercase', marginBottom: 4 }}>completed</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{collab.stats.done}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'lowercase', marginBottom: 4 }}>in progress</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{collab.stats.inProgress}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'lowercase', marginBottom: 4 }}>En retard</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{collab.stats.rejects}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="ws-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="ws-modal ws-modal--lg" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Nouveau collaborateur</h2>
                <p>Importez un nouveau profil dans votre espace de travail.</p>
              </div>
              <button className="ws-icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="ws-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="ws-input-label">Nom</label>
                    <input className="ws-input" placeholder="Saisir le nom" value={newCollab.lastName} onChange={e => setNewCollab({...newCollab, lastName: e.target.value})} required />
                  </div>
                  <div>
                    <label className="ws-input-label">Prénom</label>
                    <input className="ws-input" placeholder="Saisir le prénom" value={newCollab.firstName} onChange={e => setNewCollab({...newCollab, firstName: e.target.value})} required />
                  </div>
                  <div>
                    <label className="ws-input-label">Email</label>
                    <input className="ws-input" type="email" placeholder="Saisir l'email" value={newCollab.email} onChange={e => setNewCollab({...newCollab, email: e.target.value})} required />
                  </div>
                  <div>
                    <label className="ws-input-label">Téléphone</label>
                    <input className="ws-input" placeholder="+216 00 000 000" value={newCollab.phone} onChange={e => setNewCollab({...newCollab, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="ws-input-label">Mot de passe</label>
                    <input className="ws-input" type="password" placeholder="Saisir le mot de passe" value={newCollab.password} onChange={e => setNewCollab({...newCollab, password: e.target.value})} required />
                  </div>
                  <div>
                    <label className="ws-input-label">Date de naissance</label>
                    <input className="ws-input" type="date" value={newCollab.birthDate} onChange={e => setNewCollab({...newCollab, birthDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="ws-input-label">Niveau</label>
                    <select className="ws-input" value={newCollab.experienceLevel} onChange={e => setNewCollab({...newCollab, experienceLevel: e.target.value})}>
                      <option value="Junior">Junior</option>
                      <option value="Intermédiaire">Intermédiaire</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="ws-input-label">Date début d'embauche</label>
                    <input className="ws-input" type="date" value={newCollab.hireDate} onChange={e => setNewCollab({...newCollab, hireDate: e.target.value})} />
                  </div>
                  
                  <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                     <div>
                        <label className="ws-input-label">CIN</label>
                        <div className="ws-dropzone" onClick={() => document.getElementById('cin-upload')?.click()} style={{ padding: '1rem', height: '100px' }}>
                          <input 
                            id="cin-upload" 
                            type="file" 
                            accept=".pdf,.png,.jpg,.jpeg,.jfif"
                            style={{display: 'none'}} 
                            onChange={e => {
                               const file = e.target.files?.[0] || null;
                               if (file) {
                                  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
                                  if (!['pdf', 'png', 'jpg', 'jpeg', 'jfif'].includes(ext)) {
                                     showToast('err', `Le type de fichier .${ext} n'est pas autorisé pour la CIN.`);
                                     e.target.value = '';
                                     return;
                                  }
                               }
                               setNewCollab({...newCollab, cinFile: file});
                            }} 
                          />
                          <FileText size={20} color="var(--text-muted)" style={{ marginBottom: 4 }} />
                          <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>Glissez-déposez ou cliquez</p>
                          {newCollab.cinFile && <p style={{ fontSize: '0.7rem', color: '#2563eb' }}>{newCollab.cinFile.name}</p>}
                        </div>
                     </div>
                     <div>
                        <label className="ws-input-label">Diplôme</label>
                        <div className="ws-dropzone" onClick={() => document.getElementById('dip-upload')?.click()} style={{ padding: '1rem', height: '100px' }}>
                          <input 
                            id="dip-upload" 
                            type="file" 
                            accept=".pdf,.png,.jpg,.jpeg,.jfif"
                            style={{display: 'none'}} 
                            onChange={e => {
                               const file = e.target.files?.[0] || null;
                               if (file) {
                                  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
                                  if (!['pdf', 'png', 'jpg', 'jpeg', 'jfif'].includes(ext)) {
                                     showToast('err', `Le type de fichier .${ext} n'est pas autorisé pour le diplôme.`);
                                     e.target.value = '';
                                     return;
                                  }
                               }
                               setNewCollab({...newCollab, diplomaFile: file});
                            }} 
                          />
                          <FileText size={20} color="var(--text-muted)" style={{ marginBottom: 4 }} />
                          <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>Glissez-déposez ou cliquez</p>
                          {newCollab.diplomaFile && <p style={{ fontSize: '0.7rem', color: '#2563eb' }}>{newCollab.diplomaFile.name}</p>}
                        </div>
                     </div>
                  </div>
                </div>
              </div>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn-outline" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="ws-btn-primary">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="ws-modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, show: false })} style={{ zIndex: 10000 }}>
          <div className="ws-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, borderRadius: 24, padding: '32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: `${confirmModal.confirmColor}15`, color: confirmModal.confirmColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Power size={32} />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>{confirmModal.title}</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 32 }}>{confirmModal.message}</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button 
                className="ws-btn-secondary" 
                style={{ borderRadius: 14, padding: '12px', fontWeight: 700, border: '1px solid #e2e8f0', background: '#fff' }}
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
              >
                Annuler
              </button>
              <button 
                className="ws-btn-primary" 
                style={{ background: confirmModal.confirmColor, color: '#fff', border: 'none', borderRadius: 14, padding: '12px', fontWeight: 700, boxShadow: `0 4px 14px ${confirmModal.confirmColor}30` }}
                onClick={() => {
                  confirmModal.action();
                  setConfirmModal({ ...confirmModal, show: false });
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
