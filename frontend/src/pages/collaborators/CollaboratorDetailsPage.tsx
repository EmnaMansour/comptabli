import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Power, Phone, Mail, X, LogOut } from 'lucide-react';
import { fetchCollaboratorsStats, updateCollaborator, deleteCollaborator, type CollaboratorData } from '../../lib/api/collaboratorService';
import { useAuthStore } from '../../store/authStore';
import TasksPage from '../tasks/TasksPage';

import '../../styles/workspace-ui.css';

export default function CollaboratorDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isMe = user?.id === id;
  
  const [collab, setCollab] = useState<CollaboratorData | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'sec' | 'tasks'>('info');
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CollaboratorData>>({});
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadData = async () => {
    const list = await fetchCollaboratorsStats();
    const c = list.find(x => x.id === id);
    if(c) setCollab(c);
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeactivate = async () => {
    if(!collab?.id) return;
    const res = await deleteCollaborator(collab.id);
    if(res.ok) {
      setDeactivateModal(false);
      navigate('/collaborators');
    } else {
      alert(res.message);
    }
  };

  const handleSaveInfo = async (passwordUpdate?: string) => {
    if(!collab?.id) return;
    const updateData = passwordUpdate ? { password: passwordUpdate } : editForm;
    const res = await updateCollaborator(collab.id, updateData);
    if(res.ok) {
      if (!passwordUpdate) setIsEditing(false);
      else {
         setNewPassword('');
         setConfirmPassword('');
         alert('Mot de passe mis à jour avec succès !');
      }
      loadData();
    } else {
      alert(res.message);
    }
  };

  const handleUpdatePassword = () => {
    if (newPassword.length < 8) return alert('Le mot de passe doit faire au moins 8 caractères.');
    if (newPassword !== confirmPassword) return alert('Les mots de passe ne correspondent pas.');
    handleSaveInfo(newPassword);
  };


  if (!collab) return <div style={{ padding: '2rem' }}>Chargement...</div>;

  return (
    <>
      <div style={{ padding: '0 0 2rem 0', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="ws-icon-btn" onClick={() => navigate('/collaborators')}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Détails profil</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Tout sur votre profil en un seul endroit.</p>
        </div>
      </div>

      {/* Banner & Avatar */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <div style={{ height: 160, background: 'linear-gradient(135deg, #818cf8 0%, #3b82f6 100%)' }} />
        <div style={{ padding: '0 2rem 2rem', position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end' }}>
            <div style={{ 
              width: 100, height: 100, borderRadius: '50%', background: '#2563eb', 
              marginTop: -50, border: '6px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', fontWeight: 800, color: 'white', zIndex: 1
            }}>
              {collab.firstName[0]}{collab.lastName[0]}
            </div>
            <div style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{collab.firstName} {collab.lastName}</h2>
              <p style={{ color: 'var(--text-muted)' }}>{collab.experienceLevel || 'Comptable'} {collab.role && `(${collab.role})`}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {isEditing ? (
               <button onClick={() => handleSaveInfo()} className="ws-btn-primary" style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                 Sauvegarder
               </button>
            ) : (
               <button onClick={() => { setEditForm(collab); setIsEditing(true); }} className="ws-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <Edit size={16} /> Modifier
               </button>
            )}
            
            {isMe ? (
              <button 
                onClick={handleLogout}
                title="Se déconnecter"
                style={{ 
                   width: 36, height: 36, borderRadius: 8, background: '#fee2e2', border: 'none', 
                   color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                }}
              >
                <LogOut size={18} />
              </button>
            ) : (
              <button 
                onClick={() => setDeactivateModal(true)}
                title="Désactiver ce collaborateur"
                style={{ 
                   width: 36, height: 36, borderRadius: 8, background: '#fee2e2', border: 'none', 
                   color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                }}
              >
                <Power size={18} />
              </button>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2rem', padding: '0 2rem', borderTop: '1px solid var(--border-color)' }}>
           {([{id:'info', label:'Informations'} as const, {id:'sec', label:'Sécurité'} as const, {id:'tasks', label:'Tasks'} as const]).map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id as 'info' | 'sec' | 'tasks')} style={{
               background: 'none', border: 'none', padding: '1rem 0', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
               color: activeTab === t.id ? '#2563eb' : 'var(--text-muted)',
               borderBottom: activeTab === t.id ? '2px solid #2563eb' : '2px solid transparent'
             }}>
               {t.label}
             </button>
           ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'tasks' ? '1fr' : '1fr 340px', gap: '2rem' }}>
         <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '2rem' }}>
            {activeTab === 'info' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                 <div><label className="ws-input-label">Nom</label><input className="ws-input" value={isEditing ? editForm.lastName : collab.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} readOnly={!isEditing} /></div>
                 <div><label className="ws-input-label">Prénom</label><input className="ws-input" value={isEditing ? editForm.firstName : collab.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} readOnly={!isEditing} /></div>
                 <div><label className="ws-input-label">Email</label><input className="ws-input" value={isEditing ? editForm.email : collab.email} onChange={e => setEditForm({...editForm, email: e.target.value})} readOnly={!isEditing} /></div>
                 <div><label className="ws-input-label">Téléphone</label><input className="ws-input" value={isEditing ? (editForm.phone || '') : (collab.phone || '')} onChange={e => setEditForm({...editForm, phone: e.target.value})} readOnly={!isEditing} /></div>
                 <div><label className="ws-input-label">Date de naissance</label><input className="ws-input" type="date" value={isEditing ? (editForm.birthDate?.split('T')[0] || '') : (collab.birthDate?.split('T')[0] || '')} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} readOnly={!isEditing} /></div>
                 <div>
                   <label className="ws-input-label">CIN / Pièce d'identité</label>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                     <div style={{ background: '#3b82f6', color: 'white', borderRadius: 4, padding: '4px 6px', fontSize: '0.7rem' }}>PDF</div>
                     <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{collab.cinUrl || 'cin_document.pdf'}</div>
                   </div>
                 </div>
                 <div><label className="ws-input-label">Niveau d'expérience</label><input className="ws-input" value={isEditing ? (editForm.experienceLevel || '') : (collab.experienceLevel || '')} onChange={e => setEditForm({...editForm, experienceLevel: e.target.value})} readOnly={!isEditing} /></div>
                 <div>
                   <label className="ws-input-label">Diplôme / Certificat</label>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                     <div style={{ background: '#3b82f6', color: 'white', borderRadius: 4, padding: '4px 6px', fontSize: '0.7rem' }}>PDF</div>
                     <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{collab.diplomaUrl || 'diploma_cert.pdf'}</div>
                   </div>
                 </div>
              </div>
            )}
            
            {activeTab === 'sec' && (
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Modification du mot de passe</h3>
                <div style={{ marginBottom: '1.5rem' }}>
                   <label className="ws-input-label">Nouveau mot de passe *</label>
                   <input className="ws-input" type="password" placeholder="Entrer un mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                   <label className="ws-input-label">Confirmer le mot de passe *</label>
                   <input className="ws-input" type="password" placeholder="Retaper le mot de passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <button onClick={handleUpdatePassword} className="ws-btn-primary">Enregistrer le mot de passe</button>
              </div>
            )}


            {activeTab === 'tasks' && (
              <div style={{ minHeight: 600, display: 'flex', flexDirection: 'column', margin: '-1rem' }}>
                <TasksPage hideHeader={true} filterByAssigneeId={collab.id} />
              </div>
            )}
         </div>

         {/* Sidebar widgets */}
         {activeTab !== 'tasks' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem' }}>Overall Performance</h3>
                <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: '1.5rem' }}>
                   {/* Fake donut chart ring */}
                   <div style={{ width: 140, height: 140, borderRadius: '50%', border: '24px solid #f8fafc', borderTopColor: '#3b82f6', borderRightColor: '#f59e0b', borderLeftColor: '#ef4444', transform: 'rotate(45deg)' }} />
                   <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 800, fontSize: '1.2rem' }}>
                     {collab.performance}%
                   </div>
                </div>
                <div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }}/> Task in progress</span><b>{collab.stats?.inProgress}</b></div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}/> Task terminées</span><b>{collab.stats?.done}</b></div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}/> Task rejects</span><b>{collab.stats?.rejects}</b></div>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem' }}>Contact info</h3>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
                    <div style={{ background: '#f8fafc', padding: 8, borderRadius: 8, color: 'var(--text-secondary)' }}><Phone size={18} /></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{collab.phone || '+216 00 000 000'}</div>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: '#f8fafc', padding: 8, borderRadius: 8, color: 'var(--text-secondary)' }}><Mail size={18} /></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{collab.email}</div>
                 </div>
              </div>
           </div>
         )}
      </div>

      {deactivateModal && (
        <div className="ws-modal-overlay" onClick={() => setDeactivateModal(false)}>
           <div className="ws-modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, cursor: 'pointer' }} onClick={() => setDeactivateModal(false)}><X size={20} color="var(--text-muted)" /></div>
               <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Désactiver ce collaborateur ?</h2>
               <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Cette action empêchera l'accès du collaborateur à la plateforme.</p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                 <button className="ws-btn-outline" onClick={() => setDeactivateModal(false)}>Annuler</button>
                 <button className="ws-btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={handleDeactivate}>Désactiver</button>
              </div>
           </div>
        </div>
      )}
      </div>
    </>
  );
}
