import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  MessageCircle,
  Paperclip,
  ArrowLeft,
  X,
  Send,
  Calendar,
  MoreHorizontal as _MoreHorizontal,
  Trash2,
  Flag,
  FileText,
  Users,
  FolderOpen,
  Clock,
  UploadCloud,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import '../../styles/workspace-ui.css';
import { fetchTasks, createTask, addTaskComment, updateTaskStatus, addTaskAttachment, deleteTaskAttachment, type TaskData, type TaskAttachment } from '../../lib/api/taskService';
import { fetchClientsStats, type ClientData } from '../../lib/api/clientService';
import { fetchCollaboratorsStats, type CollaboratorData } from '../../lib/api/collaboratorService';
import { fetchFolders, type Folder } from '../../lib/api/folderService';
import { fetchRequests, type AppRequest } from '../../lib/api/requestService';
import { fetchDocuments, type AppDocument } from '../../lib/api/documentService';
import { getAssetUrl } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

// ─── HELPERS ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899'];
function getAvatarBg(name?: string) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
interface TasksPageProps {
  hideHeader?: boolean;
  filterByAssigneeId?: string;
}

export default function TasksPage({ hideHeader, filterByAssigneeId }: TasksPageProps = {}) {
  const { token, user: me } = useAuthStore();
  const isAccountant = me?.role === 'COMPTABLE' || me?.role === 'ADMIN';
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  
  // Views
  const [ticketModal, setTicketModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'docs'>('details');

  const [search, setSearch] = useState('');
  const [commentText, setCommentText] = useState('');
  const [localComments, setLocalComments] = useState<any[]>([]);
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>([]);
  
  const [showArchived, setShowArchived] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(10);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [ticketForm, setTicketForm] = useState({
    title: '', description: '', priority: 'MEDIUM', status: 'PENDING',
    clientId: '', folderId: '', requestId: '', collabDeadline: '', clientDeadline: '',
    assignedTo: [] as string[],
  });

  // Metadata Lists
  const [clients, setClients] = useState<ClientData[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorData[]>([]);
  const [clientFolders, setClientFolders] = useState<Folder[]>([]);
  const [clientRequests, setClientRequests] = useState<AppRequest[]>([]);
  const [clientDocuments, setClientDocuments] = useState<AppDocument[]>([]);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [confirmModal, setConfirmModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    confirmText: 'Confirmer',
    confirmColor: '#10b981',
    action: () => {} 
  });

  const loadTasks = async (page: number = currentPage) => {
    if (!token || token === 'demo-token') {
      setTasks([]);
      setTaskError('Veuillez vous connecter pour afficher les tâches.');
      return;
    }

    try {
      setTaskError(null);
      const res = await fetchTasks(page, itemsPerPage, showArchived);
      const lastPage = Math.max(1, res.lastPage || 1);
      const current = res.page || 1;
      setTasks(res.data || []);
      setTotalPages(lastPage);
      setCurrentPage(current > lastPage ? lastPage : current);
      if (!res.data || res.data.length === 0) {
        setTaskError(res.total === 0 ? 'Aucune tâche trouvée pour cette page.' : null);
      }
    } catch (err: any) {
      setTasks([]);
      setTotalPages(1);
      setTaskError(err?.message || 'Erreur lors du chargement des tâches.');
    }
  };

  const loadMetadata = async () => {
    if (!token || token === 'demo-token') return;
    const [c, colls] = await Promise.all([
      fetchClientsStats(),
      fetchCollaboratorsStats()
    ]);
    setClients(c);
    setCollaborators(colls);
  };

  useEffect(() => { 
    if (!token || token === 'demo-token') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks(1);
    void loadMetadata();
  }, [token, showArchived]);

  useEffect(() => {
    if (!token || token === 'demo-token') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks(currentPage);
  }, [currentPage, token]);

  useEffect(() => {
    if (ticketForm.clientId) {
      void fetchFolders({ clientId: ticketForm.clientId }).then(setClientFolders);
      void fetchRequests(ticketForm.clientId).then(setClientRequests);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClientFolders([]);
      setClientRequests([]);
    }
  }, [ticketForm.clientId]);

  useEffect(() => {
    if (selectedTask) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalComments(selectedTask.comments ?? []);
      setLocalAttachments(selectedTask.attachments ?? []);
    }
    if (selectedTask?.clientId) {
      void fetchDocuments({ clientId: selectedTask.clientId }).then(setClientDocuments);
    } else {
      setClientDocuments([]);
    }
  }, [selectedTask]);

  // ─── HANDLERS ───
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.title) return;
    
    const res = await createTask({
      title: ticketForm.title,
      description: ticketForm.description,
      priority: ticketForm.priority,
      status: ticketForm.status as any,
      clientId: ticketForm.clientId || undefined,
      folderId: ticketForm.folderId || undefined,
      requestId: ticketForm.requestId || undefined,
      clientDeadline: ticketForm.clientDeadline || undefined,
      deadline: ticketForm.collabDeadline || undefined,
      assignedTo: ticketForm.assignedTo,
      organizationId: 'placeholder',
    });

    if (res.ok) {
      setTicketModal(false);
      setTicketForm({ 
        title: '', description: '', priority: 'MEDIUM', status: 'PENDING', 
        clientId: '', folderId: '', requestId: '', collabDeadline: '', 
        clientDeadline: '', assignedTo: [] 
      });
      setCurrentPage(1);
      await loadTasks(1);
    } else {
      alert("Erreur de création: " + res.message);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !selectedTask) return;
    const localComment = {
      id: Date.now(),
      author: { id: 'me', firstName: 'Moi', lastName: '' },
      content: commentText,
      createdAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    };
    setLocalComments(prev => [...prev, localComment]);
    setCommentText('');
    
    if (token && token !== 'demo-token') {
      await addTaskComment(selectedTask.id, commentText);
      await loadTasks();
    }
  };

  const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'jfif'];
  const [fileTypeError, setFileTypeError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask || !e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = ''; // reset input

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileTypeError(`Type de fichier non autorisé (.${ext}). Formats acceptés : PDF, PNG, JPG, JPEG, JFIF.`);
      return;
    }
    setFileTypeError(null);

    const res = await addTaskAttachment(selectedTask.id, file);
    if (res.ok && res.data) {
       setLocalAttachments(prev => [...prev, res.data!]);
       await loadTasks(); // refresh to get real state
    }
  };

  const handleDeleteFile = async (attId: string) => {
    const res = await deleteTaskAttachment(attId);
    if (res.ok) {
       setLocalAttachments(prev => prev.filter(a => a.id !== attId));
       await loadTasks();
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string, reason?: string) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: newStatus });
    }
    
    if (token && token !== 'demo-token') {
      const res = await updateTaskStatus(taskId, newStatus, reason);
      if (res.ok) {
        await loadTasks();
        if (selectedTask?.id === taskId) {
          // ensure detail view refresh
          const updated = tasks.find(t => t.id === taskId);
          if (updated) setSelectedTask({...updated, status: newStatus});
        }
      }
    }
  };

  // ─── DRAG AND DROP ───
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('taskId', id);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent, status: string) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (status === 'VALIDATED' && !isAccountant) {
      alert('Seul le comptable peut valider une tâche.');
      return;
    }
    if (taskId) handleStatusChange(taskId, status);
  };

  let filtered = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.taskNumber?.toString().includes(search));

  if (filterByAssigneeId) {
    filtered = filtered.filter(t => t.assignees?.some(a => a.id === filterByAssigneeId));
  }

  
  const COLUMNS = showArchived 
    ? [
        { id: 'VALIDATED', label: 'Validée', color: '#10b981' },
      ]
    : [
        { id: 'PENDING', label: 'À faire', color: '#ef4444' },
        { id: 'NEEDS_REVIEW', label: 'À revoir', color: '#f59e0b' },
        { id: 'ACTIVE', label: 'En cours', color: '#3b82f6' },
        { id: 'DONE', label: 'Terminé', color: '#8b5cf6' },
      ];

  // ─── RENDER ──────────────────────────────────────────────────────────────
  if (selectedTask) {

    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', margin: '-1.5rem', background: '#f8fafc' }}>
        {/* Detail View Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="ws-icon-btn" onClick={() => setSelectedTask(null)}><ArrowLeft size={20} /></button>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Task #{selectedTask.taskNumber || '---'}</h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Statut actuel : <strong style={{color: '#2563eb'}}>{selectedTask.status}</strong></p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            {/* General Actions */}
            {me?.role !== 'CLIENT' && selectedTask.status === 'PENDING' && (
              <button className="ws-btn-primary" onClick={() => handleStatusChange(selectedTask.id, 'ACTIVE')}>Démarrer la tâche</button>
            )}
            {me?.role !== 'CLIENT' && selectedTask.status === 'NEEDS_REVIEW' && (
              <button className="ws-btn-primary" onClick={() => handleStatusChange(selectedTask.id, 'ACTIVE')}>Reprendre la tâche</button>
            )}
            {me?.role !== 'CLIENT' && selectedTask.status === 'ACTIVE' && (
              <button 
                className="ws-btn-primary" 
                style={{ background: '#10b981' }} 
                onClick={() => setConfirmModal({
                  show: true,
                  title: 'Terminer la tâche',
                  message: 'Êtes-vous sûr de vouloir marquer cette tâche comme terminée ?',
                  confirmText: 'Terminer',
                  confirmColor: '#10b981',
                  action: () => handleStatusChange(selectedTask.id, 'DONE')
                })}
              >
                Marquer comme terminée
              </button>
            )}

            {/* Accountant Actions (F-031) */}
            {isAccountant && selectedTask.status === 'DONE' && (
              <>
                <button 
                  className="ws-btn-primary" 
                  style={{ background: '#10b981' }} 
                  onClick={() => setConfirmModal({
                    show: true,
                    title: 'Valider la tâche',
                    message: 'Voulez-vous valider définitivement cette tâche ? Elle sera archivée.',
                    confirmText: 'Valider',
                    confirmColor: '#10b981',
                    action: () => handleStatusChange(selectedTask.id, 'VALIDATED')
                  })}
                >
                  Valider
                </button>
                <button 
                  className="ws-btn-secondary" 
                  style={{ 
                    background: '#fff', 
                    color: '#dc2626', 
                    border: '1.5px solid #fecaca', 
                    padding: '9px 20px', 
                    borderRadius: '12px', 
                    fontWeight: 700, 
                    fontSize: '0.85rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.05)'
                  }} 
                  onClick={() => setIsRejectionModalOpen(true)}
                >
                  À revoir
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Main Content Area */}
          <div style={{ flex: 2, padding: '32px', overflowY: 'auto' }}>
            
            {/* TABS */}
            <div style={{ display: 'flex', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 24, maxWidth: 400 }}>
              <button 
                onClick={() => setActiveTab('details')}
                style={{ flex: 1, padding: '12px', border: 'none', background: activeTab === 'details' ? '#fff' : '#f8fafc', fontWeight: 700, color: activeTab === 'details' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'details' ? '2px solid #2563eb' : '2px solid transparent', cursor: 'pointer' }}
              >
                Détails du task
              </button>
              <button 
                onClick={() => setActiveTab('docs')}
                style={{ flex: 1, padding: '12px', border: 'none', background: activeTab === 'docs' ? '#fff' : '#f8fafc', fontWeight: 700, color: activeTab === 'docs' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'docs' ? '2px solid #2563eb' : '2px solid transparent', cursor: 'pointer' }}
              >
                Documents
              </button>
            </div>

            {activeTab === 'details' && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{selectedTask.title}</h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                     <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800, background: '#f5d0fe', color: '#86198f' }}>Pending</span>
                     <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800, background: '#fee2e2', color: '#ef4444' }}>{selectedTask.priority}</span>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Description</p>
                  <div style={{ padding: 16, border: '1px solid #f1f5f9', borderRadius: 12, fontSize: '0.9rem', color: '#475569', minHeight: 80 }}>
                    {selectedTask.description || 'Aucune description fournie.'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <label className="ws-input-label">Client</label>
                    <input className="ws-input w-full" value={selectedTask.client ? `${selectedTask.client.firstName} ${selectedTask.client.lastName}` : 'Aucun'} readOnly />
                  </div>
                  <div>
                    <label className="ws-input-label">Date souhaitée du client</label>
                    <input className="ws-input w-full" value={selectedTask.clientDeadline ? new Date(selectedTask.clientDeadline).toLocaleDateString() : 'Non définie'} readOnly />
                  </div>
                  <div>
                    <label className="ws-input-label">Date réponse collaborateur</label>
                    <input className="ws-input w-full" value={selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : 'Non définie'} readOnly />
                  </div>
                  <div>
                    <label className="ws-input-label">Assigné à</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                       {selectedTask.assignees?.map(a => (
                         <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#e2e8f0', borderRadius: 16 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarBg(a.firstName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.65rem' }}>
                              {a.firstName.substring(0,2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{a.firstName}</span>
                         </div>
                       ))}
                       {!selectedTask.assignees?.length && <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>Non assigné</span>}
                    </div>
                  </div>
                  {selectedTask.rejectionReason && (
                    <div style={{ gridColumn: 'span 2', background: '#fef3c7', padding: 16, borderRadius: 12, border: '1px solid #fde68a' }}>
                       <label className="ws-input-label" style={{ color: '#b45309' }}>Motif pour "À revoir"</label>
                       <p style={{ color: '#92400e', margin: 0, fontSize: '0.9rem' }}>{selectedTask.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'docs' && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={18} color="#64748b" /> Document partagés par le client
                </h3>
                <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap', maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                  {clientDocuments.length > 0 ? clientDocuments.map(doc => (
                    <div key={doc.id} style={{ width: 140, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }} onClick={() => window.open(getAssetUrl(doc.url), '_blank')}>
                      <div style={{ height: 100, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <FileText size={32} color="#cbd5e1" />
                      </div>
                      <div style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0' }}>
                         <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={doc.name}>
                           <FileText size={12} color="#10b981" style={{ flexShrink: 0 }} /> {doc.name}
                         </span>
                      </div>
                    </div>
                  )) : (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucun document partagé par ce client.</p>
                  )}
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderOpen size={18} color="#64748b" /> Mes documents ({localAttachments.length})
                </h3>
                <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                  {localAttachments.map(att => (
                    <div key={att.id} style={{ width: 140, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ height: 100, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <FileText size={32} color="#cbd5e1" />
                        </div>
                        <div style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0' }}>
                           <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={att.name}>
                             <FileText size={12} color="#10b981" /> {att.name}
                           </span>
                           <Trash2 size={14} color="#ef4444" cursor="pointer" onClick={() => handleDeleteFile(att.id)} />
                        </div>
                      </div>
                  ))}
                </div>

                {/* Dropzone */}
                <div style={{ position: 'relative', border: '2px dashed #cbd5e1', borderRadius: 16, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', cursor: 'pointer' }}>
                   <input type="file" accept=".pdf,.png,.jpg,.jpeg,.jfif" onChange={handleFileUpload} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                   <div style={{ width: 48, height: 48, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16, pointerEvents: 'none' }}>
                     <UploadCloud size={24} color="#64748b" />
                   </div>
                   <p style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 4px', pointerEvents: 'none' }}>Glissez-déposez vos documents</p>
                   <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 24px', pointerEvents: 'none' }}>JPEG, PNG, JPG, JFIF, PDF, jusqu'à 50 Mo</p>
                   <button className="ws-btn-secondary" style={{ background: '#fff', padding: '8px 24px', pointerEvents: 'none' }}>Sélectionner un fichier</button>
                   {fileTypeError && (
                     <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}>
                       <X size={14} style={{ flexShrink: 0 }} />
                       {fileTypeError}
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>

          {/* Right Chat Panel */}
          <div style={{ flex: 1, minWidth: 320, maxWidth: 400, background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Echanges</h3>
            </div>
            
            <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, background: '#f8fafc' }}>
              {localComments.map((c, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: getAvatarBg(c.author?.firstName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.8rem' }}>
                      {c.author?.firstName?.substring(0,2).toUpperCase() || 'U'}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{c.author?.firstName} {c.author?.lastName}</span>
                  </div>
                  <div style={{ background: '#fff', padding: 16, borderRadius: 12, borderTopLeftRadius: 0, border: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#475569', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    {c.content}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '8px 0 0 40px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {c.createdAt}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ padding: 24, borderTop: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: 8, borderRadius: 24, border: '1px solid #e2e8f0' }}>
                <input 
                  type="text" 
                  value={commentText} 
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                  placeholder="Écrivez votre commentaire..." 
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', paddingLeft: 12, fontSize: '0.9rem' }} 
                />
                <button 
                  onClick={handleSendComment} 
                  style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Rejection Modal ─────────────────────────────────────── */}
        {isRejectionModalOpen && selectedTask && (
          <div className="ws-modal-overlay" onClick={() => setIsRejectionModalOpen(false)} style={{ zIndex: 9999 }}>
            <div className="ws-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, borderRadius: 20, padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Tâche à revoir</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>Précisez les points à corriger pour le collaborateur.</p>
                </div>
                <button className="ws-icon-btn" onClick={() => setIsRejectionModalOpen(false)} style={{ margin: 0 }}><X size={20} /></button>
              </div>
              
              <div style={{ marginBottom: 24 }}>
                <label className="ws-input-label">Motif du renvoi</label>
                <textarea 
                   className="ws-input w-full" 
                   rows={4} 
                   style={{ borderRadius: 12, padding: 16, fontSize: '0.95rem' }}
                   placeholder="Saisissez vos retours ici..." 
                   value={rejectionReason} 
                   onChange={e => setRejectionReason(e.target.value)}
                   autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                 <button 
                  className="ws-btn-secondary" 
                  style={{ borderRadius: 12, padding: '10px 24px', fontWeight: 700, border: '1px solid #e2e8f0' }}
                  onClick={() => setIsRejectionModalOpen(false)}
                 >
                   Annuler
                 </button>
                 <button 
                    className="ws-btn-primary" 
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 700, boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }}
                    onClick={() => {
                      void handleStatusChange(selectedTask.id, 'NEEDS_REVIEW', rejectionReason);
                      setIsRejectionModalOpen(false);
                      setRejectionReason('');
                    }}
                 >
                    Renvoyer la tâche
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirmation Modal (Universal) ───────────────────────── */}
        {confirmModal.show && (
          <div className="ws-modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, show: false })} style={{ zIndex: 10000 }}>
            <div className="ws-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, borderRadius: 24, padding: '32px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: `${confirmModal.confirmColor}15`, color: confirmModal.confirmColor, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Flag size={32} />
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
                  style={{ background: confirmModal.confirmColor, color: '#fff', border: 'none', borderRadius: 14, padding: '12px', fontWeight: 700, boxShadow: `0 4px 14px ${confirmModal.confirmColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
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

  // BOARD VIEW
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 100px)', overflow: 'auto' }}>
      {/* Header */}
      {!hideHeader && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>Gestion des tâches</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: 200 }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input className="ws-input" style={{ paddingLeft: 36, width: '100%', fontSize: '0.85rem', padding: '9px 12px 9px 36px' }} placeholder="Rechercher une tâche..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', padding: '9px 14px', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}>
                <Calendar size={15} /> Aujourd'hui
              </button>
              {isAccountant && (
                <button className="ws-btn-primary" onClick={() => setTicketModal(true)} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: '0.85rem', borderRadius: 10 }}>
                  <Plus size={16} /> Nouvelle tâche
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0' }}>
            <button onClick={() => setShowArchived(false)} style={{ padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: !showArchived ? '2.5px solid #2563eb' : '2.5px solid transparent', marginBottom: -2, fontWeight: 600, fontSize: '0.88rem', color: !showArchived ? '#2563eb' : '#64748b', cursor: 'pointer', transition: 'color 0.2s', fontFamily: 'var(--font-sans)' }}>Tâches actives</button>
            <button onClick={() => setShowArchived(true)} style={{ padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: showArchived ? '2.5px solid #2563eb' : '2.5px solid transparent', marginBottom: -2, fontWeight: 600, fontSize: '0.88rem', color: showArchived ? '#2563eb' : '#64748b', cursor: 'pointer', transition: 'color 0.2s', fontFamily: 'var(--font-sans)' }}>Archives</button>
          </div>
        </div>
      )}

      {taskError && (
        <div style={{ padding: '12px 16px', marginBottom: '1rem', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span> {taskError}
        </div>
      )}

      {/* Kanban Columns */}
      <div style={{ flex: 1, overflowX: 'auto', paddingBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(260px, 1fr))`, gap: '1rem', minWidth: COLUMNS.length > 2 ? `${COLUMNS.length * 280}px` : 'auto' }}>
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter(t => t.status === col.id);
            const isRed = col.color === '#ef4444' || col.color === '#dc2626';
            const isYellow = col.color === '#f59e0b';
            const isPurple = col.color === '#8b5cf6';
            const isGreen = col.color === '#10b981';
            const isBlue = col.color === '#3b82f6';
            const colBg = isRed ? '#fef8f8' : isYellow ? '#fffdf5' : isBlue ? '#f8faff' : isPurple ? '#faf8ff' : isGreen ? '#f6fef9' : '#fafbfc';
            const btnBg = isRed ? '#fee2e2' : isYellow ? '#fef3c7' : isPurple ? '#ede9fe' : isGreen ? '#dcfce7' : isBlue ? '#dbeafe' : '#f1f5f9';

          return (
             <div 
               key={col.id} 
               style={{ 
                 display: 'flex', flexDirection: 'column',
                 background: colBg, borderRadius: 14,
                 border: '1px solid #f1f5f9',
                 transition: 'box-shadow 0.2s ease',
               }}
               onDragOver={onDragOver}
               onDrop={(e) => onDrop(e, col.id)}
             >
              {/* Column Header */}
              <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, boxShadow: `0 0 0 3px ${btnBg}` }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{col.label}</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 700, border: '1px solid #f1f5f9' }}>{colTasks.length}</span>
                </div>

              </div>
              
              {/* Column Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', padding: '4px 12px 14px', minHeight: 120 }}>
                {colTasks.map(t => {
                  const prioLower = t.priority.toLowerCase();
                  const isUrgent = prioLower.includes('urgent') || prioLower.includes('haute') || prioLower.includes('high');
                  const isLow = prioLower.includes('low') || prioLower.includes('basse');
                  const badgeBg = isUrgent ? '#fee2e2' : isLow ? '#dcfce7' : '#fef3c7';
                  const badgeColor = isUrgent ? '#ef4444' : isLow ? '#10b981' : '#f59e0b';

                  return (
                    <div 
                      key={t.id} 
                      draggable
                      onDragStart={(e) => onDragStart(e, t.id)}
                      onClick={() => setSelectedTask(t)}
                      style={{ 
                        background: '#fff', borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                        border: '1px solid #e8ecf1', 
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
                        display: 'flex', flexDirection: 'column', gap: 10,
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)'; }}
                    >
                      {/* Top Row: Priority + Task Number */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ 
                          padding: '3px 10px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                          background: badgeBg, color: badgeColor, letterSpacing: '0.04em'
                        }}>
                          {t.priority}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>#{t.taskNumber || '—'}</span>
                      </div>

                      {/* Title + Description */}
                      <div>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: '#0f172a', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</h3>
                        {t.description && (
                          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', lineHeight: 1.5, color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {t.description}
                          </p>
                        )}
                      </div>

                      {/* Footer: Meta + Assignees */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 4, borderTop: '1px solid #f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: '0.75rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Flag size={12} />{new Date(t.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageCircle size={12} />{t.comments?.length || 0}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Paperclip size={12} />{t.attachments?.length || 0}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {t.assignees?.slice(0, 3).map((a, idx) => (
                            <div key={a.id} style={{ width: 26, height: 26, borderRadius: '50%', background: getAvatarBg(a.firstName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 700, border: '2px solid #fff', marginLeft: idx === 0 ? 0 : -8, zIndex: 10 - idx }} title={`${a.firstName} ${a.lastName}`}>
                              {a.firstName.substring(0, 2).toUpperCase()}
                            </div>
                          ))}
                          {t.assignees && t.assignees.length > 3 && (
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.65rem', fontWeight: 700, border: '2px solid #fff', marginLeft: -8 }}>
                              +{t.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                   <div style={{ border: '2px dashed #e2e8f0', borderRadius: 10, padding: '28px 16px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.5)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={16} color="#cbd5e1" />
                      </div>
                      <span>Glissez une tâche ici</span>
                   </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {hideHeader && isAccountant && (
        <button
          onClick={() => setTicketModal(true)}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 18px 32px rgba(37, 99, 235, 0.2)',
            cursor: 'pointer',
            zIndex: 50,
          }}
          title="Ajouter une tâche"
        >
          +
        </button>
      )}

      {/* Pagination Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: '8px', 
        padding: '24px 0',
        marginTop: '1rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        paddingLeft: 16,
        paddingRight: 16,
      }}>
        <button 
          onClick={() => setCurrentPage(1)} 
          disabled={currentPage === 1}
          style={{ 
            width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0', 
            background: '#fff', color: '#64748b', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === 1 ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <ChevronsLeft size={18} />
        </button>
        <button 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
          disabled={currentPage === 1}
          style={{ 
            width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0', 
            background: '#fff', color: '#64748b', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === 1 ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} />
        </button>

        {/* Dynamic Page Numbers */}
        {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1))
          .map((p, i, arr) => {
            const showEllipsis = i > 0 && p !== arr[i - 1] + 1;
            return (
              <React.Fragment key={p}>
                {showEllipsis && <span style={{ color: '#94a3b8', margin: '0 4px' }}>...</span>}
                <button
                  onClick={() => setCurrentPage(p)}
                  style={{
                    width: '40px', height: '40px', borderRadius: '10px', 
                    border: p === currentPage ? 'none' : '1px solid #e2e8f0',
                    background: p === currentPage ? '#f97316' : '#fff',
                    color: p === currentPage ? '#fff' : '#64748b',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {p}
                </button>
              </React.Fragment>
            );
          })}

        <button 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
          disabled={currentPage === totalPages}
          style={{ 
            width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0', 
            background: '#fff', color: '#64748b', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === totalPages ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <ChevronRight size={18} />
        </button>
        <button 
          onClick={() => setCurrentPage(totalPages)} 
          disabled={currentPage === totalPages}
          style={{ 
            width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0', 
            background: '#fff', color: '#64748b', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === totalPages ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <ChevronsRight size={18} />
        </button>
      </div>

      {/* ── Ticket Creation Modal ─────────────────────────────────────── */}
      {ticketModal && (
        <div className="ws-modal-overlay" onClick={() => setTicketModal(false)} style={{ zIndex: 9000 }}>
          <div className="ws-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, borderRadius: 16, padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '32px 32px 24px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>Nouveau Ticket</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Créez une tâche pour vos collaborateurs ou pour vous-même.</p>
              </div>
              <button className="ws-icon-btn" onClick={() => setTicketModal(false)} style={{ margin: 0 }}><X size={20} /></button>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '24px 32px' }}>
              <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                 <label className="ws-input-label">Titre de la tâche</label>
                 <input className="ws-input w-full" placeholder="Ex: Revue de TVA - Mars 2024" value={ticketForm.title} onChange={e => setTicketForm({...ticketForm, title: e.target.value})} required />
              </div>
              
              <div>
                 <label className="ws-input-label">Instructions / Description</label>
                 <textarea className="ws-input w-full" placeholder="Détails de la tâche à accomplir..." rows={3} value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                 <div>
                    <label className="ws-input-label">Priorité</label>
                    <div style={{ position: 'relative' }}>
                       <select className="ws-input w-full" style={{ appearance: 'none' }} value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}>
                          <option value="LOW">Basse</option>
                          <option value="MEDIUM">Normale</option>
                          <option value="HIGH">Haute</option>
                          <option value="Urgent !">Urgent !</option>
                       </select>
                       <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: 12, top: 14, pointerEvents: 'none' }} />
                    </div>
                 </div>
                 <div>
                    <label className="ws-input-label">Statut initial</label>
                    <div style={{ position: 'relative' }}>
                       <input className="ws-input w-full" value="À faire (En attente)" readOnly style={{ background: '#f8fafc', color: '#64748b', cursor: 'default' }} />
                    </div>
                 </div>

                 <div>
                    <label className="ws-input-label">Client associé</label>
                    <div style={{ position: 'relative' }}>
                       <select className="ws-input w-full" style={{ appearance: 'none' }} value={ticketForm.clientId} onChange={e => setTicketForm({...ticketForm, clientId: e.target.value, folderId: '', requestId: ''})}>
                          <option value="">-- Sélectionner un client --</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.firstName} {c.lastName} {c.companyName ? `(${c.companyName})` : ''}</option>
                          ))}
                       </select>
                       <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: 12, top: 14, pointerEvents: 'none' }} />
                    </div>
                 </div>
                 
                 <div>
                    <label className="ws-input-label">Dossier / Folder</label>
                    <div style={{ position: 'relative' }}>
                       <select className="ws-input w-full" style={{ appearance: 'none' }} value={ticketForm.folderId} onChange={e => setTicketForm({...ticketForm, folderId: e.target.value})}>
                          <option value="">-- Sans dossier --</option>
                          {clientFolders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                       </select>
                       <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: 12, top: 14, pointerEvents: 'none' }} />
                    </div>
                 </div>

                 <div style={{ gridColumn: 'span 2' }}>
                    <label className="ws-input-label">Assigner à (Collaborateurs)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
                       {collaborators.map(c => (
                         <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: ticketForm.assignedTo.includes(c.id) ? '#eff6ff' : '#fff', border: ticketForm.assignedTo.includes(c.id) ? '1px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                           <input 
                              type="radio" 
                              name="assignee"
                              checked={ticketForm.assignedTo.includes(c.id)}
                              onChange={() => {
                                setTicketForm({...ticketForm, assignedTo: [c.id]});
                              }}
                           />
                           <span style={{ fontWeight: ticketForm.assignedTo.includes(c.id) ? 700 : 500, color: ticketForm.assignedTo.includes(c.id) ? '#1e40af' : '#475569' }}>
                             {c.firstName} {c.lastName}
                           </span>
                         </label>
                       ))}
                       {collaborators.length === 0 && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aucun collaborateur trouvé</span>}
                    </div>
                 </div>

                 <div>
                    <label className="ws-input-label">Lier une demande client</label>
                    <div style={{ position: 'relative' }}>
                       <select className="ws-input w-full" style={{ appearance: 'none' }} value={ticketForm.requestId} onChange={e => setTicketForm({...ticketForm, requestId: e.target.value})}>
                          <option value="">-- Aucune demande --</option>
                          {clientRequests.map(r => (
                            <option key={r.id} value={r.id}>{r.type}: {r.subject || r.description.substring(0, 20)}...</option>
                          ))}
                       </select>
                       <ChevronDown size={14} color="#94a3b8" style={{ position: 'absolute', right: 12, top: 14, pointerEvents: 'none' }} />
                    </div>
                 </div>
                 <div>
                    <label className="ws-input-label">Date d'échéance client</label>
                    <input className="ws-input w-full" type="date" value={ticketForm.clientDeadline} onChange={e => setTicketForm({...ticketForm, clientDeadline: e.target.value})} />
                 </div>
                 {fileTypeError && (
                   <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
                     <X size={16} style={{ flexShrink: 0 }} />
                     {fileTypeError}
                   </div>
                 )}
              </div>

              <div>
                 <label className="ws-input-label">Date d'échéance collaborateur (Obligatoire)</label>
                 <input className="ws-input w-full" type="date" value={ticketForm.collabDeadline} onChange={e => setTicketForm({...ticketForm, collabDeadline: e.target.value})} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="ws-btn-secondary" style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a' }} onClick={() => setTicketModal(false)}>Annuler</button>
                <button type="submit" className="ws-btn-primary" style={{ background: '#2563eb' }}>Créer et Assigner</button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
