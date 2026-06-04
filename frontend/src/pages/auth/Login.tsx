// ═══════════════════════════════════════════
// Comptabli – Login Page
// Stack: React + TypeScript + React Hook Form
//        + Zod + MUI + Zustand + React Router
// ═══════════════════════════════════════════

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, CircularProgress } from '@mui/material';
import { Eye, EyeOff } from 'lucide-react';

import AuthLeftPanel from '../../components/auth/AuthLeftPanel';
import AppLogo from '../../components/branding/AppLogo';
import { useAuthStore, type UserRole } from '../../store/authStore';
import { loginRequest } from '../../lib/api';
import '../../styles/auth.css';

// ── Zod Schema ─────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  remember: z.boolean().optional(),
  notRobot: z.boolean().refine((v) => v, 'Veuillez confirmer que vous n\'êtes pas un robot'),
});

type LoginSchema = z.infer<typeof loginSchema>;

// ── Component ──────────────────────────────
const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false, notRobot: false },
  });

  const onSubmit = async (data: LoginSchema) => {
    setError(null);
    const result = await loginRequest(data.email.trim(), data.password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setUser(
      result.data.user.id ?? '',
      result.data.user.email,
      result.data.user.role as UserRole,
      result.data.access_token,
      {
        firstName: result.data.user.firstName,
        lastName: result.data.user.lastName,
      },
      result.data.refresh_token,
    );
    navigate('/dashboard');
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        {/* ── Left ── */}
        <AuthLeftPanel />

        {/* ── Right ── */}
        <div className="auth-panel-right">
          <div className="auth-animate-up">
            <div className="auth-logo">
              <Link to="/" aria-label="Comptabli — Accueil">
                <AppLogo variant="auth" />
              </Link>
            </div>
            <h1 className="auth-form-title">Se connecter</h1>
            <p className="auth-form-subtitle">
              Entrer vos informations pour se connecter .
            </p>

            {error && (
              <div style={{ 
                background: '#fef2f2', 
                border: '1px solid #fecaca', 
                color: '#991b1b', 
                borderRadius: '10px', 
                padding: '12px 14px', 
                fontSize: '0.85rem', 
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-form auth-form-login">
              {/* Email */}
              <div className="auth-field">
                <label className="auth-label">Adresse email *</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="Foulen@gmail.com"
                  className={`auth-input${errors.email ? ' error' : ''}`}
                />
                {errors.email && (
                  <p style={{ color: 'var(--f-danger)', fontSize: '0.75rem', marginTop: 4 }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="auth-field">
                <label className="auth-label">Mot de passe *</label>
                <div className="auth-input-password-wrap">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`auth-input auth-input--with-toggle${errors.password ? ' error' : ''}`}
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ color: 'var(--f-danger)', fontSize: '0.75rem', marginTop: 4 }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember / Forgot */}
              <div className="auth-row-between">
                <Link to="/forgot-password" className="auth-link">
                  Mot de passe oublié ?
                </Link>
              </div>

              {/* CAPTCHA */}
              <div className="auth-captcha-box">
                <label className="auth-captcha-label">
                  <input
                    {...register('notRobot')}
                    type="checkbox"
                    className="auth-captcha-checkbox"
                  />
                  <span className="auth-captcha-check-visual">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <polyline points="2,7 6,11 12,3" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </span>
                  <span>Je ne suis pas un robot</span>
                </label>
                <div className="auth-captcha-badge">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#4285f4"/>
                  </svg>
                  <div style={{ fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.2, textAlign: 'center' }}>reCAPTCHA<br/>Privacy - Terms</div>
                </div>
              </div>
              {errors.notRobot && (
                <p style={{ color: 'var(--f-danger)', fontSize: '0.75rem', marginTop: -4 }}>
                  {errors.notRobot.message}
                </p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                fullWidth
                disabled={isSubmitting}
                variant="contained"
                disableElevation
                sx={{
                  fontFamily: 'var(--f-font-display)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textTransform: 'none',
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
                }}
              >
                {isSubmitting ? (
                  <CircularProgress size={18} sx={{ color: 'white', mr: 1 }} />
                ) : null}
                {isSubmitting ? 'Connexion...' : 'Se connecter  →'}
              </Button>
            </form>

            <p className="auth-form-footer">
              <Link to="/" className="auth-link">
                ← Retour à l&apos;accueil
              </Link>
            </p>
            <p className="auth-form-footer">
              Vous n'avez pas de compte ?{' '}
              <Link to="/signup" className="auth-link">
                Inscrivez-vous
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
