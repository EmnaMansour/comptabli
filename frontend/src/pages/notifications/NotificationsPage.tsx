import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, BellOff, ArrowRight, User as  UserPlus, Mail, CheckSquare, Calendar, FileText } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore, type NotificationType } from '../../store/notificationStore';
import '../../styles/notifications-page.css';

export default function NotificationsPage() {
  const { token } = useAuthStore();
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [selectedContact, setSelectedContact] = useState<NotificationType | null>(null);
  
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => !n.read);
  }, [notifications, activeTab]);

  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nouveau: NotificationType[] = [];
    const earlier: NotificationType[] = [];

    filtered.forEach(n => {
      const d = new Date(n.createdAt);
      if (d >= today) nouveau.push(n);
      else earlier.push(n);
    });

    return { nouveau, earlier };
  }, [filtered]);

  const counts = useMemo(
    () => ({
      all: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
    }),
    [notifications],
  );

  const onMarkRead = async (id: string) => {
    await markAsRead(id);
  };

  const onMarkAll = async () => {
    await markAllAsRead();
    setToast({ kind: 'ok', text: 'Toutes les notifications sont marquées comme lues.' });
    window.setTimeout(() => setToast(null), 3000);
  };

  if (!token || token === 'demo-token') {
    return (
      <div className="notif-full-page animate-fade-in">
        <div className="notif-empty-state">
          <Bell size={64} strokeWidth={1} />
          <h2>Non connecté</h2>
          <p>Veuillez vous connecter pour voir vos alertes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notif-full-page animate-fade-in">
      {toast && (
        <div className={`notif-global-toast ${toast.kind}`}>
          {toast.kind === 'ok' ? <Check size={18} /> : <X size={18} />}
          {toast.text}
        </div>
      )}

      <header className="notif-page-header">
        <div className="header-titles">
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Gérez vos alertes et activités récentes</p>
        </div>
        <div className="header-actions">
           {/* <button type="button" className="btn-notif-settings" title="Paramètres">
              <Settings size={20} />
           </button> */}
           {counts.unread > 0 && (
            <button type="button" className="btn-mark-all-read" onClick={onMarkAll}>
              <Check size={16} /> Tout marquer comme lu
            </button>
           )}
        </div>
      </header>

      <div className="notif-page-content">
        <div className="notif-tabs-bar">
          <button 
            className={activeTab === 'all' ? 'active' : ''} 
            onClick={() => setActiveTab('all')}
          >
            Toutes les notifications <span className="tab-count">{counts.all}</span>
          </button>
          <button 
            className={activeTab === 'unread' ? 'active' : ''} 
            onClick={() => setActiveTab('unread')}
          >
            Non lues <span className="tab-count">{counts.unread}</span>
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="notif-empty-state">
            <BellOff size={64} strokeWidth={1} />
            <h2>Rien à signaler</h2>
            <p>Vous êtes à jour ! Aucune notification à afficher ici.</p>
          </div>
        ) : (
          <div className="notif-list-container">
            {grouped.nouveau.length > 0 && (
              <section className="notif-list-section">
                <h2 className="section-label">Nouveau</h2>
                <div className="notif-cards-grid">
                  {grouped.nouveau.map((n) => (
                    <NotificationCard 
                      key={n.id} 
                      n={n} 
                      onMarkRead={() => onMarkRead(n.id)} 
                      onSelectContact={(notif) => setSelectedContact(notif)}
                    />
                  ))}
                </div>
              </section>
            )}

            {grouped.earlier.length > 0 && (
              <section className="notif-list-section">
                <h2 className="section-label">Plus tôt</h2>
                <div className="notif-cards-grid">
                  {grouped.earlier.map((n) => (
                    <NotificationCard 
                      key={n.id} 
                      n={n} 
                      onMarkRead={() => onMarkRead(n.id)} 
                      onSelectContact={(notif) => setSelectedContact(notif)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {selectedContact && (
        <div className="ws-modal-overlay" style={{ zIndex: 10000, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedContact(null)}>
          <div className="ws-modal animate-fade-in-up" style={{ maxWidth: '560px', padding: 0, borderRadius: '24px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', border: '1px solid rgba(0,0,0,0.05)' }} onClick={e => e.stopPropagation()}>
            
            {/* Header épuré moderne */}
            <div style={{ padding: '32px 32px 24px', position: 'relative', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}></div>
              
              <button 
                type="button" 
                onClick={() => setSelectedContact(null)} 
                style={{ position: 'absolute', top: 24, right: 24, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', transition: 'all 0.2s' }} 
              >
                <X size={18} />
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <Mail size={26} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Détails du contact</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px #d1fae5' }}></span>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Nouveau message reçu</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="ws-modal-body" style={{ padding: '32px' }}>
              {(() => {
                const msg = selectedContact.message || '';
                const parseField = (label: string) => {
                  const regex = new RegExp(`${label}:\\s*(.*)`, 'i');
                  const match = msg.match(regex);
                  return match ? match[1].trim() : '';
                };

                const company = parseField('Entreprise');
                const phone = parseField('Tel');
                const email = parseField('Email');
                const subject = parseField('Sujet');
                const actualMessage = msg.split('Message:')[1]?.trim() || msg;
                const senderName = selectedContact.title.replace(/Nouveau contact de |Nouvelle demande de /g, '');

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    {/* Infos Expéditeur */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserPlus size={14} /> Infos expéditeur
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '20px',
                        background: '#f8fafc',
                        padding: '20px',
                        borderRadius: '16px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Nom complet</span>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{senderName}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Entreprise</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>{company || 'Non spécifié'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Téléphone</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>{phone || 'Non spécifié'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>Adresse e-mail</span>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1d4ed8' }}>{email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contenu du message */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={14} /> Objet & Message
                      </div>
                      <div style={{ 
                        background: '#fff', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '16px', 
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ background: '#f8fafc', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{subject || 'Sans sujet'}</span>
                        </div>
                        <div style={{ 
                          padding: '24px 20px', 
                          fontSize: '0.95rem', 
                          lineHeight: '1.7', 
                          color: '#475569',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {actualMessage}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="ws-modal-footer" style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 16 }}>
              <button 
                type="button" 
                style={{ 
                  flex: 1, 
                  height: '48px', 
                  borderRadius: '12px', 
                  fontSize: '0.95rem', 
                  fontWeight: 700, 
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedContact(null)}
              >
                Fermer
              </button>
              <button 
                type="button" 
                style={{ 
                  flex: 2, 
                  height: '48px', 
                  borderRadius: '12px', 
                  fontSize: '0.95rem', 
                  fontWeight: 800, 
                  background: '#2563eb',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  cursor: 'pointer',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
                onClick={() => {
                  setSelectedContact(null);
                  navigate('/messaging');
                }}
              >
                Répondre via messagerie <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getNotifIcon(type: string, size = 20) {
  if (type.includes('TASK')) return <CheckSquare size={size} />;
  if (type.includes('MEETING')) return <Calendar size={size} />;
  if (type === 'CONTACT_RECEIVED') return <UserPlus size={size} />;
  if (type.includes('DOCUMENT')) return <FileText size={size} />;
  return <Bell size={size} />;
}

function NotificationCard({ 
  n, 
  onMarkRead, 
  onSelectContact 
}: { 
  n: NotificationType; 
  onMarkRead: () => void;
  onSelectContact: (n: NotificationType) => void;
}) {
  const navigate = useNavigate();

  const handleAction = () => {
    onMarkRead();
    const linkSuffix = n.linkedId ? `?id=${n.linkedId}` : '';
    
    if (n.type === 'CONTACT_RECEIVED') {
      onSelectContact(n);
      return;
    }

    if (n.type.includes('TASK')) navigate(`/tasks${linkSuffix}`);
    else if (n.type.includes('MEETING')) navigate(`/meetings${linkSuffix}`);
    else if (n.type.includes('DOCUMENT')) navigate(`/documents${linkSuffix}`);
    else if (n.type.includes('MESSAGE')) navigate(`/messaging${linkSuffix}`);
    else if (n.type.includes('REQUEST')) navigate(`/demandes${linkSuffix}`);
  };

  return (
    <div className={`notification-card ${!n.read ? 'unread' : ''}`} onClick={handleAction}>
      <div className="notif-card-avatar">
        <div className={`avatar-square type-${n.type.split('_')[0].toLowerCase()}`}>
          {getNotifIcon(n.type)}
        </div>
        {!n.read && <span className="unread-pulse" />}
      </div>
      
      <div className="notif-card-body">
        <div className="notif-card-main">
          <h4 className="notif-card-title">
            {n.title.replace(/Nouvelle demande de |Nouveau contact de /g, (m) => m.includes('demande') ? 'Nouvelle demande ' : 'Nouveau contact ')}
          </h4>
          <p className="notif-card-msg">{n.message}</p>
        </div>
        <div className="notif-card-meta">
          <span className="notif-card-time">{formatDate(n.createdAt)}</span>
          <ArrowRight size={16} className="notif-card-arrow" />
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffHours < 24) {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
