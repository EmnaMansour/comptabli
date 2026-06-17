// ═══════════════════════════════════════════
// Comptabli – Vérification e-mail (lien depuis le mail d'inscription)
// ═══════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircularProgress, Button } from '@mui/material';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

import AuthLeftPanel from '../../components/auth/AuthLeftPanel';
import AppLogo from '../../components/branding/AppLogo';
import { verifyEmailRequest } from '../../lib/api';
import '../../styles/auth.css';

const MuiPrimary = {
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

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  const callPromise = React.useRef<Promise<any> | null>(null);

  useEffect(() => {
    if (!token?.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('err');
      setMessage("Lien incomplet. Ouvrez le lien reçu par e-mail ou demandez un nouvel envoi depuis l'inscription.");
      return;
    }

    if (!callPromise.current) {
      callPromise.current = verifyEmailRequest(token.trim());
    }

    let cancelled = false;
    setStatus('loading');

    callPromise.current
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatus('ok');
          setMessage(res.message || 'Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter.');
        } else {
          setStatus('err');
          const isUsed = res.message?.includes('invalide') || res.message?.includes('expiré');
          setMessage(isUsed 
            ? "Ce lien a déjà été utilisé ou a expiré. Si votre compte est déjà vérifié, connectez-vous directement." 
            : (res.message ?? 'Vérification impossible')
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('err');
        setMessage("Erreur de connexion au serveur. Vérifiez que le backend est démarré.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="auth-root">
      <div className="auth-card">
        <AuthLeftPanel slideIndex={0} />

        <div className="auth-panel-right">
          <div className="auth-animate-up">
            <div className="auth-logo">
              <Link to="/" aria-label="Comptabli — Accueil">
                <AppLogo variant="auth" />
              </Link>
            </div>
            <h1 className="auth-form-title">Vérification de l'e-mail</h1>

            <div style={{ marginBottom: 32 }}>
              {status === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CircularProgress size={20} sx={{ color: 'var(--f-blue-600)' }} />
                  <p className="auth-form-subtitle" style={{ margin: 0 }}>Validation du lien en cours…</p>
                </div>
              )}

              {status === 'ok' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#f0fdf4', padding: 16, borderRadius: 12, border: '1px solid #bbf7d0' }}>
                  <CheckCircle size={24} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534', lineHeight: 1.5 }}>
                    {message}
                  </p>
                </div>
              )}

              {status === 'err' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fef2f2', padding: 16, borderRadius: 12, border: '1px solid #fecaca' }}>
                  <XCircle size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#991b1b', lineHeight: 1.5 }}>
                    {message}
                  </p>
                </div>
              )}
            </div>

            {(status === 'ok' || status === 'err') && (
              <Button
                fullWidth
                variant="contained"
                disableElevation
                sx={{ ...MuiPrimary, mb: 2 }}
                onClick={() => navigate('/login')}
              >
                Se connecter
              </Button>
            )}

            <button
              type="button"
              className="auth-btn-ghost"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft size={16} />
              Retour à la connexion
            </button>

            <p className="auth-form-footer">
              <Link to="/" className="auth-link">
                ← Retour à l&apos;accueil
              </Link>
            </p>
            <p className="auth-form-footer auth-form-footer--muted">© 2026 · Comptabli</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
