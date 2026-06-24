// ═══════════════════════════════════════════
// Comptabli – ResetPassword Page
// ═══════════════════════════════════════════

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, CircularProgress } from '@mui/material';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

import AuthLeftPanel from '../../components/auth/AuthLeftPanel';
import AppLogo from '../../components/branding/AppLogo';
import PasswordChecksGrid from '../../components/auth/PasswordChecks';
import { resetPasswordRequest } from '../../lib/api';
import { getPasswordChecks } from '../../types/auth.types';
import '../../styles/auth.css';

const primaryBtnSx = {
  fontFamily: 'var(--f-font-display)',
  fontWeight: 600,
  fontSize: '0.95rem',
  textTransform: 'none' as const,
  borderRadius: '12px',
  padding: '12px 16px',
  background: 'var(--f-blue-600)',
  transition: 'transform 0.22s ease, box-shadow 0.22s ease, background 0.2s ease',
  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
  '&:hover': {
    background: 'var(--f-blue-700)',
    transform: 'translateY(-2px)',
    boxShadow: '0 10px 28px rgba(37, 99, 235, 0.38)',
  },
  '&:active': { transform: 'translateY(0)', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)' },
  '&.Mui-disabled': { background: 'var(--f-blue-100)', color: 'white', boxShadow: 'none', transform: 'none' },
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'form' | 'ok' | 'err'>('form');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const checks = getPasswordChecks(password);
  const isValidPw = Object.values(checks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPw || password !== confirm || !token) return;
    setLoading(true);
    try {
      const res = await resetPasswordRequest(token.trim(), password);
      if (res.ok) {
        setStatus('ok');
        setMessage('Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.');
      } else {
        setStatus('err');
        setMessage(res.message);
      }
    } catch {
      setStatus('err');
      setMessage('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  const mismatch = confirm.length > 0 && password !== confirm;

  // No token in URL
  if (!token?.trim()) {
    return (
      <div className="auth-root">
        <div className="auth-card">
          <AuthLeftPanel slideIndex={1} />
          <div className="auth-panel-right">
            <div className="auth-animate-up">
              <div className="auth-logo">
                <Link to="/" aria-label="Comptabli — Accueil">
                  <AppLogo variant="auth" />
                </Link>
              </div>
              <h1 className="auth-form-title">Lien invalide</h1>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <XCircle size={28} color="#dc2626" style={{ flexShrink: 0 }} />
                <p className="auth-form-subtitle" style={{ margin: 0, color: '#b91c1c' }}>
                  Ce lien est incomplet ou invalide. Veuillez refaire une demande de réinitialisation depuis la page de connexion.
                </p>
              </div>
              <Button
                variant="contained"
                fullWidth
                disableElevation
                sx={{ ...primaryBtnSx, mt: 1.5 }}
                onClick={() => navigate('/forgot-password')}
              >
                Refaire une demande
              </Button>
              <p className="auth-form-footer">
                <Link to="/login" className="auth-link">← Retour à la connexion</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <AuthLeftPanel slideIndex={1} />

        <div className="auth-panel-right">
          <div className="auth-animate-up">
            <div className="auth-logo">
              <Link to="/" aria-label="Comptabli — Accueil">
                <AppLogo variant="auth" />
              </Link>
            </div>

            {status === 'ok' ? (
              <>
                <h1 className="auth-form-title">Mot de passe modifié !</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <CheckCircle size={28} color="#16a34a" />
                  <p className="auth-form-subtitle" style={{ margin: 0 }}>
                    {message}
                  </p>
                </div>
                <Button
                  variant="contained"
                  fullWidth
                  disableElevation
                  sx={{ ...primaryBtnSx, mt: 1 }}
                  onClick={() => navigate('/login')}
                >
                  Se connecter
                </Button>
              </>
            ) : status === 'err' ? (
              <>
                <h1 className="auth-form-title">Erreur</h1>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <XCircle size={28} color="#dc2626" style={{ flexShrink: 0 }} />
                  <p className="auth-form-subtitle" style={{ margin: 0, color: '#b91c1c' }}>
                    {message}
                  </p>
                </div>
                <Button
                  variant="contained"
                  fullWidth
                  disableElevation
                  sx={{ ...primaryBtnSx, mt: 1 }}
                  onClick={() => navigate('/forgot-password')}
                >
                  Refaire une demande
                </Button>
              </>
            ) : (
              <>
                <h1 className="auth-form-title">Nouveau mot de passe</h1>
                <p className="auth-form-subtitle">
                  Choisissez un mot de passe fort pour sécuriser votre compte.
                </p>

                <form onSubmit={handleSubmit} noValidate className="auth-form auth-form-login">
                  <div className="auth-field">
                    <label className="auth-label">Mot de passe *</label>
                    <div className="auth-input-password-wrap">
                      <input
                        className={`auth-input auth-input--with-toggle${password.length > 0 && password.length < 8 ? ' error' : ''}`}
                        type={show1 ? 'text' : 'password'}
                        placeholder="Min. 8 caractères"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="auth-input-toggle"
                        onClick={() => setShow1((v) => !v)}
                        aria-label={show1 ? 'Masquer' : 'Afficher'}
                      >
                        {show1 ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <PasswordChecksGrid checks={checks} />

                  <div className="auth-field">
                    <label className="auth-label">Confirmer le mot de passe *</label>
                    <div className="auth-input-password-wrap">
                      <input
                        className={`auth-input auth-input--with-toggle${mismatch ? ' error' : ''}`}
                        type={show2 ? 'text' : 'password'}
                        placeholder="Retaper le mot de passe"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-input-toggle"
                        onClick={() => setShow2((v) => !v)}
                        aria-label={show2 ? 'Masquer' : 'Afficher'}
                      >
                        {show2 ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {mismatch && (
                      <span className="auth-error-text">Les mots de passe ne correspondent pas.</span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={loading || !isValidPw || mismatch}
                    sx={primaryBtnSx}
                  >
                    {loading ? (
                      <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} />
                    ) : null}
                    {loading ? 'Enregistrement...' : 'Réinitialiser le mot de passe'}
                  </Button>
                </form>
              </>
            )}

            <p className="auth-form-footer">
              <Link to="/login" className="auth-link">
                ← Retour à la connexion
              </Link>
            </p>
            <p className="auth-form-footer">
              <Link to="/" className="auth-link">
                ← Retour à l&apos;accueil
              </Link>
            </p>
            <p className="auth-form-footer auth-form-footer--muted">
              © 2026 · Comptabli
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
