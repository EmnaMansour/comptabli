import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Check, X, MessageCircle } from 'lucide-react';
import { useNotificationStore, type NotificationType } from '../../store/notificationStore';
import './notification-dropdown.css'; // Reuse the same CSS

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

export default function MessageDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Filter ONLY message notifications
  const messageNotifications = notifications.filter(n => n.type.includes('MESSAGE'));
  const unreadCount = messageNotifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onRowClick = async (n: NotificationType) => {
    if (!n.read) {
      await markAsRead(n.id);
    }
    setIsOpen(false);
    
    // Navigate to conversation
    const linkSuffix = n.linkedId ? `?id=${n.linkedId}` : '';
    navigate(`/messaging${linkSuffix}`);
  };

  const displayList = messageNotifications.slice(0, 5);

  return (
    <div className="notif-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Messages"
      >
        <Mail size={20} />
        {unreadCount > 0 && (
            <span className="badge" style={{ 
              position: 'absolute', top: '-4px', right: '-4px', 
              background: '#ef4444', color: '#fff', fontSize: '10px', 
              padding: '2px 5px', borderRadius: '10px', minWidth: '16px', 
              textAlign: 'center', fontWeight: 700, border: '2px solid #fff' 
            }}>
              {unreadCount}
            </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown-panel animate-scale-in" style={{ right: -80 }}>
          <div className="notif-dropdown-header">
            <h3>Nouveaux messages</h3>
            <button type="button" className="notif-close-mobile" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="notif-dropdown-body thin-scrollbar">
            {displayList.length === 0 ? (
              <div className="notif-empty-state">
                <MessageCircle size={32} strokeWidth={1} />
                <p>Aucun message</p>
              </div>
            ) : (
              displayList.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => onRowClick(n)}
                >
                  <div className="notif-avatar">
                    <div className="avatar-circle type-message">
                      <Mail size={14} />
                    </div>
                  </div>
                  <div className="notif-content">
                    <p className="notif-text">
                      <span className="notif-subject">{n.title}</span> {n.message}
                    </p>
                    <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
                  </div>
                  {!n.read && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }} />}
                </div>
              ))
            )}
          </div>

          <div className="notif-dropdown-footer">
             <button type="button" className="btn-mark-read" onClick={() => markAllAsRead()}>
              <Check size={14} /> Tout lire
            </button>
            <Link to="/messaging" className="btn-view-all" onClick={() => setIsOpen(false)}>
              Aller à la messagerie
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
