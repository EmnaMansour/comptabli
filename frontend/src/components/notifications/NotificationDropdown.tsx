import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, Check, Maximize2, User as UserIcon, FileText, Calendar, CheckSquare, X, Mail, Briefcase } from 'lucide-react';
import { useNotificationStore, type NotificationType } from '../../store/notificationStore';
import './notification-dropdown.css';

function getNotifIcon(type: string) {
  if (type.includes('TASK')) return <CheckSquare size={14} />;
  if (type.includes('MEETING')) return <Calendar size={14} />;
  if (type.includes('DOCUMENT') || type === 'CONTACT_RECEIVED') return <FileText size={14} />;
  return <Bell size={14} />;
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<NotificationType | null>(null);
  const [clientDetails, setClientDetails] = useState<{ email?: string; phone?: string; companyName?: string } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  
  // Exclude MESSAGE notifications from the generic Bell dropdown
  const filteredNotifications = notifications.filter(n => !n.type.includes('MESSAGE'));
  const filteredUnreadCount = filteredNotifications.filter(n => !n.read).length;

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchClientDetails = async (clientId: string) => {
    try {
      setLoadingDetails(true);
      const { authFetch } = await import('../../lib/authFetch');
      const response = await authFetch(`/users/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setClientDetails(data);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des détails du client", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const onRowClick = async (n: NotificationType) => {
    if (!n.read) {
      await markAsRead(n.id);
    }
    setIsOpen(false);
    
    // Navigation logic
    if (n.type === 'CONTACT_RECEIVED') {
      setSelectedContact(n);
      setClientDetails(null);
      if (n.linkedId) {
        fetchClientDetails(n.linkedId);
      }
      return;
    }

    const linkSuffix = n.linkedId ? `?id=${n.linkedId}` : '';
    if (n.type.includes('TASK')) navigate(`/tasks${linkSuffix}`);
    else if (n.type.includes('MEETING')) navigate(`/meetings${linkSuffix}`);
    else if (n.type.includes('DOCUMENT')) navigate(`/documents${linkSuffix}`);
    else if (n.type.includes('MESSAGE')) navigate(`/messaging${linkSuffix}`);
    else if (n.type.includes('REQUEST')) navigate(`/demandes${linkSuffix}`);
  };

  const onMarkAll = async () => {
    await markAllAsRead();
  };

  const displayList = filteredNotifications.slice(0, 5); // Show top 5 in dropdown

  return (
    <div className="notif-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-trigger ${filteredUnreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        < Bell size={20} />
        {filteredUnreadCount > 0 && <span className="notif-badge">{filteredUnreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notif-dropdown-panel animate-scale-in">
          <div className="notif-dropdown-header">
            <h3>Notifications</h3>
            <button type="button" className="notif-close-mobile" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="notif-dropdown-body thin-scrollbar">
            {displayList.length === 0 ? (
              <div className="notif-empty-state">
                <Bell size={32} strokeWidth={1} />
                <p>Aucune notification</p>
              </div>
            ) : (
              displayList.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => onRowClick(n)}
                >
                  <div className="notif-avatar">
                    <div className={`avatar-circle type-${n.type.split('_')[0].toLowerCase()}`}>
                      {getNotifIcon(n.type)}
                    </div>
                  </div>
                  <div className="notif-content">
                    <p className="notif-text">
                      <span className="notif-subject">{n.title}</span> {n.message}
                    </p>
                    <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
                  </div>
                  {!n.read && <span className="status-dot-active" style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }} />}
                </div>
              ))
            )}
          </div>

          <div className="notif-dropdown-footer">
            <button type="button" className="btn-mark-read" onClick={onMarkAll}>
              <Check size={14} /> Tout marquer comme lu
            </button>
            <Link to="/notifications" className="btn-view-all" onClick={() => setIsOpen(false)}>
              Voir tout
            </Link>
          </div>
        </div>
      )}

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
                  <UserIcon size={32} color="#fff" />
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
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Briefcase size={14} color="#f97316" /> {company || '-'}
                          </div>
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


