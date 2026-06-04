import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AppLogo from '../branding/AppLogo';

export default function NetworkingHeader() {
  const { isAuthenticated } = useAuthStore();

  return (
    <header className="nw-header nw-header--glass">
      <div className="nw-header-inner">
        <Link to="/" className="nw-brand" aria-label="Comptabli — Accueil">
          <AppLogo variant="networking" />
        </Link>

        <nav className="nw-nav-actions">
          {isAuthenticated ? (
            <Link to="/dashboard" className="nw-btn nw-btn-primary">
              Tableau de bord
            </Link>
          ) : (
            <>
              <Link to="/signup" className="nw-btn nw-btn-outline">
                S&apos;inscrire
              </Link>
              <Link to="/login" className="nw-btn nw-btn-primary">
                Se connecter
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
