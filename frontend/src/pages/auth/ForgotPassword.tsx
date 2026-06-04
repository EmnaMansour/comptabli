// ═══════════════════════════════════════════
// Comptabli – ForgotPassword Page
// ═══════════════════════════════════════════

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, CircularProgress } from '@mui/material';
import { ArrowLeft, CheckCircle } from 'lucide-react';

import AuthLeftPanel from '../../components/auth/AuthLeftPanel';
import AppLogo from '../../components/branding/AppLogo';
import { forgotPasswordRequest } from '../../lib/api';
import '../../styles/auth.css';

const forgotSchema = z.object({
  email: z.string().email('Adresse email invalide'),
});
type ForgotSchema = z.infer<typeof forgotSchema>;

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

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotSchema>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotSchema) => {
    setError(null);
    try {
      const res = await forgotPasswordRequest(data.email.trim().toLowerCase());
      if (res.ok) {
        setSentEmail(data.email);
        setSent(true);
      } else {
        setError(res.message);
      }
    } catch {
      setError('Erreur de connexion au serveur.');
    }
  };

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

            {sent ? (
              <>
                <h1 className="auth-form-title">E-mail envoyé !</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <CheckCircle size={28} color="#16a34a" />
                  <p className="auth-form-subtitle" style={{ margin: 0 }}>
                    Si un compte existe pour <strong>{sentEmail}</strong>, vous recevrez un lien de réinitialisation dans quelques instants.
                  </p>
                </div>
                <p className="auth-form-subtitle" style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Vérifiez votre boîte de réception et vos spams.
                </p>
              </>
            ) : (
              <>
                <h1 className="auth-form-title">Mot de passe oublié ?</h1>
                <p className="auth-form-subtitle">
                  Indiquez votre e-mail : nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>

                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', marginBottom: 12 }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-form auth-form-login">
                  <div className="auth-field">
                    <label className="auth-label">Adresse e-mail *</label>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="vous@exemple.com"
                      className={`auth-input${errors.email ? ' error' : ''}`}
                    />
                    {errors.email && (
                      <span className="auth-error-text">{errors.email.message}</span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={isSubmitting}
                    sx={{ ...primaryBtnSx, mb: 1.25 }}
                  >
                    {isSubmitting ? (
                      <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} />
                    ) : null}
                    {isSubmitting ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                  </Button>
                </form>
              </>
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
            <p className="auth-form-footer auth-form-footer--muted">
              © 2026 · Comptabli
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
