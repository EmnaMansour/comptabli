import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getDashboardNav } from '../../config/dashboardNav';
import { Search, LogOut, Moon, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import AppLogo from '../branding/AppLogo';
import { fetchClientById } from '../../lib/api/clientService';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { darkMode, toggleDarkMode, sidebarCollapsed } = useThemeStore();
  const [clientName, setClientName] = useState<string>('');

  const baseNavItems = useMemo(() => getDashboardNav(user?.role ?? null), [user?.role]);
  
  const matchClient = location.pathname.match(/^\/clients\/([^/]+)\/(espace|archives)/);
  const activeClientId = matchClient ? matchClient[1] : null;

  useEffect(() => {
    if (activeClientId) {
      void fetchClientById(activeClientId).then(c => {
        if (c) setClientName(`${c.firstName} ${c.lastName}`);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClientName('');
    }
  }, [activeClientId]);

  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (activeClientId) {
      const clientsIdx = items.findIndex(i => i.key === 'clients');
      const insertIdx = clientsIdx >= 0 ? clientsIdx + 1 : 1;
      items.splice(insertIdx, 0, {
        key: 'client-espace',
        label: clientName ? `Espace du client (${clientName})` : 'Espace du client',
        icon: FolderOpen,
        children: [
          { label: 'Mon espace', path: `/clients/${activeClientId}/espace` },
          { label: 'Archives', path: `/clients/${activeClientId}/archives` }
        ]
      });
    }
    return items;
  }, [baseNavItems, activeClientId, clientName]);

  const clientLabel = clientName ? `Espace du client (${clientName})` : 'Espace du client';
  const [openMenus, setOpenMenus] = useState<string[]>(['Mon espace', clientLabel]);

  useEffect(() => {
    const labelsToOpen = navItems
      .filter((item) =>
        item.children?.some(
          (c) => location.pathname === c.path || location.pathname.startsWith(`${c.path}/`),
        ),
      )
      .map((item) => item.label);
    if (labelsToOpen.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenMenus((prev) => [...new Set([...prev, ...labelsToOpen, 'Mon espace', clientLabel])]);
    }
  }, [location.pathname, navItems, clientLabel]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  const isChildActive = (paths: { path: string }[]) =>
    paths.some((c) => location.pathname === c.path || location.pathname.startsWith(`${c.path}/`));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className={`sidebar sidebar--app ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <Link
        to="/dashboard"
        className="sidebar-header sidebar-brand-link"
        aria-label="Comptabli — Tableau de bord"
      >
        <AppLogo variant="sidebar" />
      </Link>

      <div className="sidebar-search">
        <Search size={16} className="search-icon" />
        <input type="text" placeholder="Rechercher ..." aria-label="Rechercher" />
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.children) {
            const parentActive = isChildActive(item.children);
            return (
              <div key={item.key}>
                <button
                  type="button"
                  className={`nav-item nav-item--parent${parentActive ? ' active' : ''}`}
                  onClick={() => toggleMenu(item.label)}
                >
                  <span className="nav-icon">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span className="nav-label" title={item.label}>{item.label}</span>
                  {!sidebarCollapsed && (
                    <span className="nav-chevron" aria-hidden>
                      {openMenus.includes(item.label) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </span>
                  )}
                </button>
                {openMenus.includes(item.label) && !sidebarCollapsed && (
                  <div className="nav-submenu">
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        to={child.path}
                        className={`nav-item nav-item--sub${
                          location.pathname === child.path ? ' active' : ''
                        }`}
                      >
                        <span className="nav-label" title={child.label}>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.key}
              to={item.path!}
              className={`nav-item${location.pathname === item.path ? ' active' : ''}`}
            >
              <span className="nav-icon">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <span className="nav-label" title={item.label}>{item.label}</span>
              {item.badge != null && (
                <span
                  className={`nav-badge${item.badgeOrange ? ' nav-badge--orange' : ''}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          {!sidebarCollapsed && <span>Se déconnecter</span>}
        </button>
        <button type="button" className="dark-mode-toggle" onClick={toggleDarkMode}>
          <Moon size={20} />
          {!sidebarCollapsed && <span>Mode sombre</span>}
          <span
            className={`toggle-switch${darkMode ? ' active' : ''}`}
            aria-hidden
          />
        </button>
      </div>
    </aside>
  );
}
