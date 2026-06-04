import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import AuthLeftPanel from '../../components/auth/AuthLeftPanel';
import AppLogo from '../../components/branding/AppLogo';
import '../../styles/auth.css';

const VerifyEmailPrompt: React.FC = () => {
  const location = useLocation();
  const email = location.state?.email || "votre adresse e-mail";

  return (
    <div className="auth-root">
      <div className="auth-card">
        <AuthLeftPanel slideIndex={0} />

        <div className="auth-panel-right" style={{ justifyContent: 'center' }}>
          <div className="auth-animate-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div className="auth-logo" style={{ alignSelf: 'flex-start', position: 'absolute', top: 40, left: 40 }}>
              <Link to="/" aria-label="Comptabli — Accueil">
                <AppLogo variant="auth" />
              </Link>
            </div>
            
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>Vérifiez votre e-mail</h1>
            
            <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '3rem', maxWidth: 400 }}>
              Nous venons de vous envoyer un email de confirmation à <strong style={{ color: '#0f172a' }}>{email}</strong>. 
              Merci de cliquer sur le lien dans l'email pour activer votre compte.
            </p>

            <div style={{ background: '#e0f2fe', width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '3rem' }}>
               <Mail size={48} color="#0ea5e9" strokeWidth={1.5} />
            </div>

            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '2rem' }}>
              Vous n'avez pas reçu l'e-mail ? <a href="#" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Renvoyer</a>
            </p>

            <Link to="/login" style={{ width: '100%', maxWidth: 400, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', transition: 'all 0.2s' }} className="ws-btn-secondary">
               <ArrowLeft size={18} /> Retour à la connexion
            </Link>

            <p style={{ position: 'absolute', bottom: 40, fontSize: '0.75rem', color: '#94a3b8' }}>
              {new Date().getFullYear()} , COMPTABLI tous les droits réservés
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPrompt;
