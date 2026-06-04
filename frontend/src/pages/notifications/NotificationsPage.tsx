import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, BellOff, ArrowRight, User as UserIcon, UserPlus, Mail, Settings, CheckSquare, Calendar, FileText } from 'lucide-react';
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
        <div className="ws-modal-overlay" style={{ zIndex: 10000, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedContact(null)}>
          <div className="ws-modal contact-details-modal" style={{ maxWidth: '580px', padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            
            {/* Header Pro avec Gradient */}
            <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', padding: '32px 24px', position: 'relative' }}>
              <button type="button" onClick={() => setSelectedContact(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: 8, borderRadius: '50%', cursor: 'pointer', display: 'flex' }}>
                <X size={18} />
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: '18px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(10px)' }}>
                  <Mail size={32} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Détails du contact</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Nouveau message reçu</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="ws-modal-body" style={{ padding: '24px', background: '#fff' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    
                    {/* Infos Expéditeur Card */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Informations de l'expéditeur</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 4 }}>NOM COMPLET</div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{senderName}</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 4 }}>ENTREPRISE</div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{company || '-'}</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 4 }}>TÉLÉPHONE</div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#334155' }}>{phone || '-'}</div>
                        </div>
                        <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '16px', border: '1px solid #dbeafe' }}>
                          <div style={{ fontSize: '0.7rem', color: '#1d4ed8', marginBottom: 4, fontWeight: 700 }}>E-MAIL</div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2563eb' }}>{email}</div>
                        </div>
                      </div>
                    </div>

                    {/* Sujet & Message */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Objet & Contenu</div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ background: '#f8fafc', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{subject || 'Sans sujet'}</span>
                        </div>
                        <div style={{ 
                          padding: '24px', 
                          fontSize: '1.05rem', 
                          lineHeight: '1.6', 
                          color: '#334155',
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

            <div className="ws-modal-footer" style={{ padding: '24px', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
              <button 
                type="button" 
                className="ws-btn-primary" 
                style={{ 
                  width: '100%', 
                  height: '54px', 
                  borderRadius: '16px', 
                  fontSize: '1.05rem', 
                  fontWeight: 800, 
                  background: '#2563eb',
                  boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  border: 'none',
                  color: '#fff'
                }}
                onClick={() => {
                  setSelectedContact(null);
                  navigate('/messaging');
                }}
              >
                Répondre via la messagerie
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
