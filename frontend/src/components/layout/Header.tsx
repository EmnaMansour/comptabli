import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Bell, Mail, Menu, X } from 'lucide-react';
import NotificationDropdown from '../notifications/NotificationDropdown';
import MessageDropdown from '../notifications/MessageDropdown';
import { useThemeStore } from '../../store/themeStore';
import { useNotificationStore } from '../../store/notificationStore';

export default function Header() {
  const { user, token } = useAuthStore();
  const { toggleSidebar } = useThemeStore();
  const { connect, disconnect, loadInitial } = useNotificationStore();

  useEffect(() => {
    if (token) {
      connect(token);
      loadInitial();
    }
    return () => {
      disconnect();
    };
  }, [token, connect, loadInitial, disconnect]);

  const getInitials = (first: string, last: string) =>
    `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
    : 'Utilisateur';

  const roleLabel =
    user?.role === 'COMPTABLE'
      ? 'Expert comptable'
      : user?.role === 'CLIENT'
        ? 'Client'
        : user?.role === 'COLLABORATEUR'
          ? 'Collaborateur'
          : user?.role === 'ADMIN'
            ? 'Administrateur'
            : '';



  return (
    <header className="header header--app">
      <div className="header-left">
        <button
          type="button"
          className="header-icon-btn header-menu-btn"
          onClick={toggleSidebar}
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="header-right">
        {user?.role !== 'ADMIN' && <MessageDropdown />}
        {user?.role !== 'ADMIN' && <NotificationDropdown />}

        <Link to="/profile" className="header-user">
          <div className="header-user-avatar">
            {user ? getInitials(user.firstName ?? '', user.lastName ?? '') : 'U'}
          </div>
          <div className="header-user-info">
            <div className="header-user-name">{displayName}</div>
            <div className="header-user-role">{roleLabel}</div>
          </div>
        </Link>
      </div>
    </header>
  );
}
