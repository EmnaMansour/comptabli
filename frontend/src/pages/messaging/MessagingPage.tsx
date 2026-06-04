import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Send, Paperclip, Search, MessageCircle, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  fetchMessagingDirectory,
  fetchConversations,
  fetchConversation,
  createConversation,
  sendChatMessage,
  updateChatMessage,
  deleteChatMessage,
  type ChatMessage,
  type MessagingUser,
} from '../../lib/api/messagingService';
import { fetchRequests, type AppRequest } from '../../lib/api/requestService';
import { fetchDocuments, uploadDocument, type AppDocument } from '../../lib/api/documentService';
import { X, FileText, CheckCircle, Clock, ClipboardList } from 'lucide-react';
import '../../styles/messaging-page.css';

function peerLabel(u: MessagingUser) {
  return u.companyName?.trim() || `${u.firstName} ${u.lastName}`;
}

function initials(u: MessagingUser) {
  return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function MessagingPage() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get('id');
  const role = user?.role ?? '';

  const [tab, setTab] = useState<'clients' | 'collabs'>('clients');
  const [listSearch, setListSearch] = useState('');
  const [directory, setDirectory] = useState<{
    accountants: MessagingUser[];
    clients: MessagingUser[];
    collaborators: MessagingUser[];
  } | null>(null);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ConversationDetail | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AppRequest[]>([]);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string | null>(null);
  const didAutoOpen = useRef(false);

  const loadConvos = useCallback(async () => {
    if (!token || token === 'demo-token') {
      setConversations([]);
      return;
    }
    const list = await fetchConversations();
    setConversations(list);
  }, [token]);

  const loadDirectory = useCallback(async () => {
    if (!token || token === 'demo-token') return;
    const d = await fetchMessagingDirectory();
    setDirectory(d);
  }, [token]);

  const loadRequests = useCallback(async () => {
    if (!token || token === 'demo-token') return;
    const list = await fetchRequests();
    setRequests(list);
  }, [token]);

  useEffect(() => {
    if (!token || token === 'demo-token') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all([loadConvos(), loadDirectory(), loadRequests()]).finally(() => setLoading(false));
  }, [token, loadConvos, loadDirectory, loadRequests]);

  useEffect(() => {
    didAutoOpen.current = false;
  }, [token]);

  const openOrCreateWith = useCallback(
    async (peer: MessagingUser) => {
      if (!token || token === 'demo-token') return;
      const existing = conversations.find((c) => {
        const ids = new Set(c.participants.map((p) => p.userId));
        return ids.has(peer.id) && ids.has(user?.id ?? '');
      });
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const res = await createConversation([peer.id]);
      if (!res.ok) return;
      await loadConvos();
      setActiveId(res.data.id);
    },
    [token, conversations, user?.id, loadConvos],
  );

  useEffect(() => {
    if (loading || !token || token === 'demo-token' || activeId || didAutoOpen.current) return;

    if (linkedId) {
      didAutoOpen.current = true;
      setActiveId(linkedId);
      return;
    }

    if (conversations.length > 0) {
      didAutoOpen.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(conversations[0].id);
      return;
    }
    if (role === 'CLIENT' && directory?.accountants?.[0]) {
      didAutoOpen.current = true;
      void openOrCreateWith(directory.accountants[0]);
    }
  }, [loading, token, activeId, linkedId, conversations, directory, role, openOrCreateWith]);

  useEffect(() => {
    if (!activeId || !token || token === 'demo-token') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveDetail(null);
      return;
    }
    let cancelled = false;
    void fetchConversation(activeId).then((d) => {
      if (!cancelled) setActiveDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, token]);

  const tabPeers = useMemo(() => {
    if (!directory) return [];
    if (role === 'CLIENT') return directory.accountants;
    if (role === 'COMPTABLE') {
      return tab === 'clients' ? directory.clients : directory.collaborators;
    }
    if (role === 'COLLABORATEUR') {
      return tab === 'clients' ? directory.clients : [...directory.collaborators, ...directory.accountants];
    }
    if (role === 'ADMIN') {
      return tab === 'clients' ? directory.clients : directory.collaborators;
    }
    return [];
  }, [directory, tab, role]);

  const filteredPeers = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return tabPeers;
    return tabPeers.filter((p) => peerLabel(p).toLowerCase().includes(q));
  }, [tabPeers, listSearch]);

  const convoTitle = (c: ConversationPreview): string => {
    const p = c.participants.find((x) => x.userId !== user?.id);
    if (p?.user) return peerLabel(p.user as MessagingUser);
    return c.name || 'Conversation';
  };

  const filteredConversations = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return conversations.filter((c) => {
      const matchesSearch = convoTitle(c).toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (role === 'CLIENT') return true;

      const other = c.participants.find((p) => p.userId !== user?.id)?.user as MessagingUser | undefined;
      if (!other) return true;

      if (tab === 'clients') {
        return other.role === 'CLIENT';
      } else {
        return other.role !== 'CLIENT';
      }
    });
  }, [conversations, listSearch, tab, role, user?.id, convoTitle]);

  const lastPreview = (c: ConversationPreview) => {
    const m = c.messages?.[0];
    if (!m) return 'Nouvelle conversation';
    if (m.content.includes('A partagé une demande')) return 'Demande partagée';
    if (m.content.includes('A partagé un document')) return 'Document partagé';
    return m.content;
  };

  const send = async (linkedId?: string, linkedType?: 'Document' | 'Request') => {
    const text = msg.trim() || (linkedType ? `A partagé ${linkedType === 'Document' ? 'un document' : 'une demande'}` : '');
    if (!text || !activeId || !token || token === 'demo-token') return;
    const res = await sendChatMessage(activeId, text, linkedId, linkedType);
    if (!res.ok) return;
    setMsg('');
    setIsAttachMenuOpen(false);
    setIsRequestModalOpen(false);
    const d = await fetchConversation(activeId);
    setActiveDetail(d);
    void loadConvos();
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeId || !token || token === 'demo-token' || !activeDetail) return;
    
    // Find client in conversation
    const targetClient = activeDetail.participants.find(p => p.user.role === 'CLIENT')?.userId;
    const actualClientId = role === 'CLIENT' ? user?.id : targetClient;

    if (!actualClientId) {
      alert("Impossible de partager un fichier dans cette conversation (aucun client associé).");
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadDocument(file, actualClientId); 
      if (res.ok) {
        await send(res.data.id, 'Document');
      } else {
        alert("Erreur lors de l'envoi du fichier.");
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Erreur réseau lors de l'envoi du fichier.");
    } finally {
      setIsUploading(false);
      setIsAttachMenuOpen(false);
    }
  };

  const startEdit = (m: ChatMessage) => {
    setEditingMsgId(m.id);
    setEditingContent(m.content);
    setOpenMenuMsgId(null);
  };

  const saveEdit = async () => {
    if (!editingMsgId || !editingContent.trim() || !activeId) return;
    const res = await updateChatMessage(editingMsgId, editingContent.trim());
    if (res.ok) {
      setEditingMsgId(null);
      setEditingContent('');
      const d = await fetchConversation(activeId);
      setActiveDetail(d);
    }
  };

  const deleteMsg = async (id: string) => {
    if (!activeId || !window.confirm("Supprimer ce message ?")) return;
    const res = await deleteChatMessage(id);
    if (res.ok) {
      const d = await fetchConversation(activeId);
      setActiveDetail(d);
      void loadConvos();
    }
    setOpenMenuMsgId(null);
  };

  const totalUnreadApprox = conversations.length;

  const headerPeer = activeDetail?.participants.find((p) => p.userId !== user?.id)?.user as MessagingUser | undefined;

  if (!token || token === 'demo-token') {
    return (
      <div className="msg-page animate-fade-in">
        <h1 className="page-title">Messagerie</h1>
        <p className="page-subtitle">Connectez-vous pour accéder à vos conversations.</p>
      </div>
    );
  }

  return (
    <div className="msg-page animate-fade-in">
      <div className="msg-page-head">
        <div>
          <div className="msg-page-title">
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Messagerie
            </h1>
            <span className="msg-badge">{totalUnreadApprox || '0'}</span>
          </div>
          <p className="msg-subtitle">
            Un espace simple et sécurisé pour vos échanges.
          </p>
        </div>
      </div>

      <div className="msg-layout">
        <div className="msg-list-panel">
          {role !== 'CLIENT' && (
            <div className="msg-tabs">
              <button type="button" className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>
                Clients
              </button>
              <button type="button" className={tab === 'collabs' ? 'active' : ''} onClick={() => setTab('collabs')}>
                {role === 'COLLABORATEUR' ? 'Comptable' : 'Collaborateurs'}
              </button>
            </div>
          )}
          <div className="msg-list-search">
            <div style={{ position: 'relative' }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                placeholder="Rechercher..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="msg-list-scroll">
            {loading ? (
              <p className="msg-loading-text">Chargement…</p>
            ) : (
              <>
                <p style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Conversations
                </p>
                {filteredConversations
                  .map((c) => (
                    <div
                      key={c.id}
                      className={`msg-thread-item ${activeId === c.id ? 'active' : ''}`}
                      onClick={() => setActiveId(c.id)}
                      role="presentation"
                    >
                        <div
                          className="msg-thread-avatar"
                          style={{
                            background: `linear-gradient(135deg, ${COLORS[Math.abs(c.id.charCodeAt(2) || 0) % COLORS.length]}, ${COLORS[Math.abs(c.id.charCodeAt(2) || 0) % COLORS.length]}dd)`,
                          }}
                        >
                          {convoTitle(c).slice(0, 2).toUpperCase()}
                        </div>
                      <div className="msg-thread-body">
                        <div className="msg-thread-name">{convoTitle(c)}</div>
                        <div className="msg-thread-preview">{lastPreview(c)}</div>
                      </div>
                    </div>
                  ))}
                <p style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {role === 'CLIENT' ? 'Mon comptable' : tab === 'clients' ? 'Clients' : (role === 'COLLABORATEUR' ? 'Mon comptable' : 'Équipe')}
                </p>
                {filteredPeers.map((p) => (
                  <div
                    key={p.id}
                    className="msg-thread-item"
                    onClick={() => void openOrCreateWith(p)}
                    role="presentation"
                  >
                    <div
                      className="msg-thread-avatar"
                      style={{ 
                        background: `linear-gradient(135deg, ${COLORS[Math.abs(p.id.charCodeAt(2) || 0) % COLORS.length]}, ${COLORS[Math.abs(p.id.charCodeAt(2) || 0) % COLORS.length]}dd)`,
                        borderRadius: p.role === 'COMPTABLE' ? '14px' : '50%'
                      }}
                    >
                      {initials(p)}
                    </div>
                    <div className="msg-thread-body">
                      <div className="msg-thread-name">{peerLabel(p)}</div>
                      <div className="msg-thread-preview">Démarrer une conversation</div>
                    </div>
                  </div>
                ))}
                {filteredPeers.length === 0 && conversations.length === 0 && (
                  <div className="msg-empty-state" style={{ minHeight: 120 }}>
                    <MessageCircle size={36} color="var(--text-muted)" />
                    <p style={{ marginTop: 10, color: 'var(--text-secondary)' }}>Aucun contact dans cette vue.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="msg-chat-panel">
          {!activeId || !activeDetail ? (
            <div className="msg-empty-state">
              <MessageCircle size={48} color="var(--text-muted)" />
              <p style={{ marginTop: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Sélectionnez une conversation</p>
              <p style={{ fontSize: '0.88rem', maxWidth: 320, color: 'var(--text-secondary)' }}>
                Choisissez un fil à gauche ou un contact pour commencer à échanger.
              </p>
            </div>
          ) : (
            <>
              <div className="msg-chat-header">
                <div
                  className="msg-thread-avatar"
                  style={{
                    width: 44,
                    height: 44,
                    background: COLORS[2],
                  }}
                >
                  {headerPeer ? initials(headerPeer) : '?'}
                </div>
                <div className="msg-chat-header-info">
                  <div className="msg-chat-header-name">{headerPeer ? peerLabel(headerPeer) : 'Conversation'}</div>
                  <div className="msg-chat-header-role">
                    {headerPeer?.role === 'COMPTABLE'
                      ? 'Comptable'
                      : headerPeer?.role === 'CLIENT'
                        ? 'Client'
                        : headerPeer?.role === 'COLLABORATEUR'
                          ? 'Collaborateur'
                          : 'Contact'}
                  </div>
                </div>
                <div className="msg-chat-actions">
                  {role === 'COMPTABLE' && (
                    <button 
                      type="button" 
                      className="msg-profile-link" 
                      onClick={() => {
                        if (!headerPeer) return;
                        if (headerPeer.role === 'CLIENT') {
                          navigate(`/clients/${headerPeer.id}/espace`);
                        } else {
                          navigate(`/collaborators/${headerPeer.id}`);
                        }
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', 
                        fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      Voir le profil
                    </button>
                  )}
                </div>
              </div>
              <div className="msg-chat-messages">
                {activeDetail.messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  const isMenuOpen = openMenuMsgId === m.id;
                  const isEditing = editingMsgId === m.id;

                  return (
                    <div key={m.id} className={mine ? 'msg-bubble-wrapper' : ''}>
                      <div className={`msg-bubble ${mine ? 'me' : 'them'}`}>
                        {mine && !isEditing && (
                          <div className={`msg-options-container ${isMenuOpen ? 'active' : ''}`}>
                            <button 
                              type="button" 
                              className={`msg-options-btn ${isMenuOpen ? 'active' : ''}`}
                              onClick={() => setOpenMenuMsgId(isMenuOpen ? null : m.id)}
                            >
                              <MoreVertical size={16} />
                            </button>
                            
                            {isMenuOpen && (
                              <div className="msg-attach-menu animate-fade-in" style={{ bottom: 'auto', top: '100%', left: 0, width: 140, marginTop: 4, zIndex: 10 }}>
                                <button type="button" onClick={() => startEdit(m)} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                                  <Edit2 size={14} /> Modifier
                                </button>
                                <button type="button" onClick={() => deleteMsg(m.id)} style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#ef4444' }}>
                                  <Trash2 size={14} /> Supprimer
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      {m.linkedDocument && (
                        <div className="msg-linked-item document">
                          <FileText size={16} />
                          <div className="msg-linked-info">
                            <div className="msg-linked-name">{m.linkedDocument.name}</div>
                            <a href={m.linkedDocument.url} target="_blank" rel="noreferrer" className="msg-linked-action">Ouvrir le document</a>
                          </div>
                        </div>
                      )}
                      {m.linkedRequest && (
                        <div 
                          className="msg-linked-item request" 
                          onClick={() => {
                            const path = role === 'CLIENT' ? '/demandes' : '/demandes-clients';
                            navigate(`${path}?id=${m.linkedRequest!.id}`);
                          }}
                          role="link"
                          tabIndex={0}
                        >
                          <ClipboardList size={16} />
                          <div className="msg-linked-info">
                            <div className="msg-linked-name">{m.linkedRequest.subject || m.linkedRequest.type}</div>
                            <div className="msg-linked-meta">Demande #{m.linkedRequest.id.slice(-4).toUpperCase()}</div>
                          </div>
                        </div>
                      )}
                      
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                          <textarea 
                            className="ws-input" 
                            value={editingContent} 
                            onChange={e => setEditingContent(e.target.value)}
                            style={{ fontSize: '0.85rem', padding: '8px', minHeight: 60, background: '#fff', color: '#000' }}
                          />
                          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                            <button 
                              type="button" 
                              onClick={() => setEditingMsgId(null)} 
                              style={{ 
                                padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)', 
                                background: 'transparent', fontSize: '0.8rem', fontWeight: 600, color: '#fff', 
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              Annuler
                            </button>
                            <button 
                              type="button" 
                              onClick={saveEdit} 
                              style={{ 
                                padding: '6px 14px', borderRadius: '8px', border: 'none', 
                                background: '#fff', fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', 
                                cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                              }}
                            >
                              Enregistrer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>{m.content}</div>
                      )}

                      <div className="msg-bubble-time" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          {new Date(m.createdAt).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {m.updatedAt && new Date(m.updatedAt) > new Date(m.createdAt) && (
                          <span style={{ fontStyle: 'italic', marginLeft: 8 }}>(modifié)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              <div className="msg-chat-input-bar">
                <div className="msg-input-pill">
                  <input
                    placeholder="Saisir votre message ici…"
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void send()}
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem', color: '#1e293b', padding: '10px 0' }}
                  />

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button 
                      type="button" 
                      className={`msg-input-attach ${isAttachMenuOpen ? 'active' : ''}`} 
                      onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                      style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: isAttachMenuOpen ? '#e2e8f0' : 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                      <Paperclip size={20} />
                    </button>
                    
                    {isAttachMenuOpen && (
                      <div className="msg-attach-menu animate-fade-in-up" style={{ bottom: '100%', right: 0, left: 'auto', marginBottom: 15 }}>
                        <button type="button" onClick={() => setIsRequestModalOpen(true)}>
                          <FileText size={16} /> Joindre une demande
                        </button>
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: '0.88rem' }}>
                          <Paperclip size={16} /> {isUploading ? 'Chargement...' : 'Joindre un fichier'}
                          <input type="file" style={{ display: 'none' }} onChange={onFileUpload} disabled={isUploading} />
                        </label>
                      </div>
                    )}

                    <button 
                      type="button" 
                      onClick={() => void send()}
                      disabled={!msg.trim()}
                      style={{ 
                        width: 42, height: 42, borderRadius: '50%', border: 'none', 
                        background: msg.trim() ? '#2563eb' : '#cbd5e1', 
                        color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s',
                        boxShadow: msg.trim() ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none',
                        transform: msg.trim() ? 'scale(1)' : 'scale(0.95)'
                      }}
                    >
                      <Send size={18} style={{ marginLeft: 2 }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Request Selection Modal */}
              {isRequestModalOpen && (
                <div className="ws-modal-overlay" onClick={() => setIsRequestModalOpen(false)} style={{ zIndex: 10000 }}>
                  <div className="ws-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 16 }}>
                    <div className="ws-modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '20px 24px' }}>
                      <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Sélectionner une demande</h2>
                        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Choisissez une demande à joindre dans la conversation</p>
                      </div>
                      <button type="button" className="ws-icon-btn" onClick={() => setIsRequestModalOpen(false)}><X size={20} /></button>
                    </div>
                    <div className="ws-modal-body" style={{ padding: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
                      {requests.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Aucune demande trouvée.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {requests.map(r => (
                            <div 
                              key={r.id} 
                              className="msg-request-item" 
                              onClick={() => void send(r.id, 'Request')}
                            >
                              <div className="msg-request-icon">
                                <FileText size={20} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.subject || r.type}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.type} • {new Date(r.createdAt).toLocaleDateString()}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span className={`status-badge ${r.status === 'ACTIVE' ? 'info' : 'warning'}`} style={{ fontSize: '0.7rem' }}>{r.status}</span>
                                {r.urgency === 'HIGH' && <span className="status-badge danger" style={{ fontSize: '0.7rem' }}>Urgent !</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
