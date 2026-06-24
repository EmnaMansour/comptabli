// ═══════════════════════════════════════════
// Comptabli – Signup Page (Multi-Step)
//
// FLOWS:
//  Entreprise : Step1 (type+email+phone+pw) → modal succès
//  Comptable  : Step1 (type+email+phone)
//             → Step2 (cabinet+secteur+patente+RNE)
//             → Step3 (mot de passe + confirm + termes)
//             → modal succès
//
// Stack: React + TS + React Hook Form + Zod
//        + MUI + Zustand + React Router
// ═══════════════════════════════════════════

import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, CircularProgress } from '@mui/material';
import { Eye, EyeOff, Upload, X } from 'lucide-react';

import AuthLeftPanel from '../../components/auth/AuthLeftPanel';
import AppLogo from '../../components/branding/AppLogo';
import PasswordChecksGrid from '../../components/auth/PasswordChecks';
import { apiUrl, apiErrorMessage } from '../../lib/api';
import { getPasswordChecks } from '../../types/auth.types';
import type { AccountType } from '../../types/auth.types';
import '../../styles/auth.css';

// ══════════════════════════════════════════
//  ZOD SCHEMAS
// ══════════════════════════════════════════
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const step1Schema = z
  .object({
    accountType: z.enum(['entreprise', 'comptable']),
    email: z.string().trim().refine((value) => emailPattern.test(value), 'Email invalide'),
    phoneCode: z.string(),
    phone: z.string().min(8, 'Numéro invalide'),
    password: z.string().optional(),
    acceptTerms: z.boolean().optional(),
    notRobot: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === 'entreprise') {
      const pw = data.password || '';
      if (!pw.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Mot de passe requis',
          path: ['password'],
        });
      } else {
        if (pw.length < 8) ctx.addIssue({ code: 'custom', message: '8 caractères minimum', path: ['password'] });
        if (!/[a-z]/.test(pw)) ctx.addIssue({ code: 'custom', message: 'Une minuscule', path: ['password'] });
        if (!/[A-Z]/.test(pw)) ctx.addIssue({ code: 'custom', message: 'Une majuscule', path: ['password'] });
        if (!/\d/.test(pw)) ctx.addIssue({ code: 'custom', message: 'Un chiffre', path: ['password'] });
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) ctx.addIssue({ code: 'custom', message: 'Un caractère spécial', path: ['password'] });
      }
      
      if (!data.notRobot) {
        ctx.addIssue({
          code: 'custom',
          message: 'Veuillez confirmer que vous n\'\u00eates pas un robot',
          path: ['notRobot'],
        });
      }
    }
  });

const step2ComptableSchema = z.object({
  cabinetName: z.string().min(2, 'Nom du cabinet requis'),
  sector:      z.string(),
});

const step3ComptableSchema = z
  .object({
    password: z
      .string()
      .min(8, '8 caractères minimum')
      .regex(/[a-z]/, 'Une minuscule')
      .regex(/[A-Z]/, 'Une majuscule')
      .regex(/\d/, 'Un chiffre')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Un caractère spécial'),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().optional(),
    notRobot: z.boolean().refine((v) => v, 'Veuillez confirmer que vous n\'\u00eates pas un robot'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type Step1Data = z.infer<typeof step1Schema>;
type Step2CData = z.infer<typeof step2ComptableSchema>;
type Step3CData = z.infer<typeof step3ComptableSchema>;

// ══════════════════════════════════════════
//  SHARED STYLES
// ══════════════════════════════════════════
const inp = (err?: boolean): React.CSSProperties => ({
  width: '100%', padding: '11px 14px',
  border: `1.5px solid ${err ? 'var(--f-danger)' : 'var(--f-border)'}`,
  borderRadius: '10px',
  fontFamily: 'var(--f-font-body)', fontSize: '0.88rem',
  color: 'var(--f-text-primary)', background: 'white', outline: 'none',
  transition: 'border-color 0.2s ease, box-shadow 0.22s ease, transform 0.15s ease',
  appearance: 'none' as const,
});

const MuiPrimary = {
  fontFamily: 'var(--f-font-display)', fontWeight: 600,
  fontSize: '0.93rem', textTransform: 'none' as const,
  borderRadius: '12px', padding: '12px 16px',
  background: 'var(--f-blue-600)',
  transition: 'transform 0.22s ease, box-shadow 0.22s ease, background 0.2s ease',
  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
  '&:hover': {
    background: 'var(--f-blue-700)',
    transform: 'translateY(-2px)',
    boxShadow: '0 10px 28px rgba(37, 99, 235, 0.38)',
  },
  '&:active:not(:disabled)': { transform: 'translateY(0)', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)' },
  '&.Mui-disabled': { background: 'var(--f-blue-200)', color: 'white', boxShadow: 'none', transform: 'none' },
};

// ══════════════════════════════════════════
//  SUCCESS MODAL
// ══════════════════════════════════════════
interface SuccessModalProps {
  onClose: () => void;
  mailSent?: boolean;
  devVerificationUrl?: string | null;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ onClose, mailSent, devVerificationUrl }) => (
  <div className="auth-modal-overlay">
    <button
      type="button"
      aria-label="Fermer la fenêtre"
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
    />
    <div className="auth-modal-card" style={{ position: 'relative', zIndex: 1 }}>
      <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Fermer"><X size={18} /></button>

      <div className="auth-modal-icon">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="17" stroke="#2563eb" strokeWidth="2" fill="none" />
          <polyline
            className="auth-modal-checkmark"
            points="10,19 15,24 26,13"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="40"
            strokeDashoffset="40"
            style={{ animation: 'checkDraw 0.4s 0.55s ease forwards' }}
          />
        </svg>
      </div>

      <h2 className="auth-modal-title">Compte créé avec succès</h2>
      <p className="auth-modal-desc">
        {mailSent
          ? 'Un e-mail de confirmation vous a été envoyé. Cliquez sur le lien pour valider votre adresse (48 h).'
          : 'Aucun e-mail n’a pu être envoyé : configurez SMTP dans backend/.env (voir .env.example). Le lien de vérification est affiché dans la console du serveur NestJS en développement.'}
      </p>
      {devVerificationUrl && (
        <p
          className="auth-modal-desc"
          style={{ fontSize: '0.75rem', wordBreak: 'break-all', background: '#f1f5f9', padding: 10, borderRadius: 8 }}
        >
          <strong>Dev — lien de vérification :</strong>
          <br />
          {devVerificationUrl}
        </p>
      )}

      <Button
        fullWidth
        variant="contained"
        disableElevation
        onClick={onClose}
        sx={MuiPrimary}
      >
        Continuer
      </Button>
    </div>
  </div>
);

// ══════════════════════════════════════════
//  PW INPUT
// ══════════════════════════════════════════
interface PwInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  show: boolean;
  onToggle: () => void;
  error?: boolean;
  inputId?: string;
  toggleLabel?: string;
}
const PwInput: React.FC<PwInputProps> = ({
  show,
  onToggle,
  error,
  inputId,
  toggleLabel,
  ...rest
}) => (
  <div style={{ position: 'relative' }}>
    <input
      id={inputId}
      type={show ? 'text' : 'password'}
      style={{ ...inp(error), paddingRight: 40 }}
      {...rest}
    />
    <button
      type="button"
      aria-label={toggleLabel ?? (show ? 'Masquer le mot de passe' : 'Afficher le mot de passe')}
      onClick={onToggle}
      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--f-text-muted)', display: 'flex' }}
    >
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  </div>
);

// ══════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════
const Signup: React.FC = () => {
  const [step, setStep]               = useState(1);
  const [dir, setDir]                 = useState<'enter' | 'back'>('enter');
  const [accountType, setAccountType] = useState<AccountType>('entreprise');
  const [showPw, setShowPw]           = useState(false);
  const [showPw3, setShowPw3]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [patenteFile, setPatenteFile] = useState<File | null>(null);
  const [rneFile, setRneFile]         = useState<File | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [regMailSent, setRegMailSent] = useState<boolean | undefined>(undefined);
  const [regDevVerifyUrl, setRegDevVerifyUrl] = useState<string | null>(null);
  const patenteRef                    = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const rneRef                        = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  const navigate = useNavigate();

  // ── Total steps per type ──
  const totalSteps = accountType === 'comptable' ? 3 : 1;

  // ── Navigate steps ──
  const goNext = () => { setDir('enter'); setStep((s) => s + 1); };
  const goBack = () => { setDir('back');  setStep((s) => s - 1); };

  // ── FORMS ──
  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { accountType: 'entreprise', email: '', phoneCode: '+216', phone: '', password: '', acceptTerms: false },
  });
  const pw1  = form1.watch('password') ?? '';
  const pw1c = getPasswordChecks(pw1);

  const form2c = useForm<Step2CData>({
    resolver: zodResolver(step2ComptableSchema),
    defaultValues: { cabinetName: '', sector: 'Finance' },
  });

  const form3c = useForm<Step3CData>({
    resolver: zodResolver(step3ComptableSchema),
    defaultValues: { password: '', confirmPassword: '', acceptTerms: false },
  });
  const pw3  = form3c.watch('password');
  const pw3c = getPasswordChecks(pw3);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof TypeError) {
      return fallback;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Erreur inconnue.';
  };

  // ── Submit handlers ──
  const handleStep1 = form1.handleSubmit(async (data) => {
    const emailNorm = data.email.trim().toLowerCase();

    // Check email availability (Step 1 Validation)
    try {
      const checkRes = await fetch(apiUrl('/auth/check-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNorm }),
      });
      if (checkRes.ok) {
        const checkBody = await checkRes.json();
        if (!checkBody.available) {
          form1.setError('email', { type: 'manual', message: 'Cet e-mail est déjà utilisé.' });
          return;
        }
      }
    } catch (e) {
      console.error('Email check failed', e);
    }

    if (accountType === 'entreprise') {
      try {
        const passwordUsed = (data.password ?? '').trim();
        if (!passwordUsed) {
          form1.setError('password', { type: 'manual', message: 'Mot de passe requis' });
          return;
        }
        const response = await fetch(apiUrl('/auth/register/client'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailNorm,
            password: passwordUsed,
            firstName: 'Client',
            lastName: 'Entreprise',
            phone: data.phone,
          }),
        });
        if (!response.ok) {
          alert(await apiErrorMessage(response, 'Inscription refusée'));
          return;
        }
        const regBody = (await response.json()) as {
          mailSent?: boolean;
          devVerificationUrl?: string;
        };
        setRegMailSent(regBody.mailSent !== false);
        setRegDevVerifyUrl(regBody.devVerificationUrl ?? null);
        if (regBody.mailSent) {
          navigate('/verify-email-prompt', { state: { email: emailNorm } });
        } else {
          setRegMailSent(false);
          setRegDevVerifyUrl(regBody.devVerificationUrl ?? null);
          setShowModal(true);
        }
      } catch (e) {
        console.error(e);
        alert(getErrorMessage(e, 'Erreur de connexion au backend.'));
      }
    } else {
      goNext();
    }
  });

  const handleStep2 = form2c.handleSubmit(() => {
    if (!patenteFile || !rneFile) {
      alert('Veuillez télécharger les deux documents (Patente et RNE) pour continuer.');
      return;
    }
    goNext();
  });

  const handleStep3 = form3c.handleSubmit(async (data3) => {
    try {
      const data1 = form1.getValues();
      const data2 = form2c.getValues();
      const emailNorm = data1.email.trim().toLowerCase();
      const response = await fetch(apiUrl('/auth/register/comptable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailNorm,
          password: data3.password,
          firstName: 'Comptable',
          lastName: data2.cabinetName.trim() || 'Cabinet',
          companyName: data2.cabinetName.trim() || 'Cabinet',
          phone: data1.phone,
          activitySector: data2.sector,
          patenteUrl: patenteFile?.name, // Simulating file URLs for demo
          rneUrl: rneFile?.name,
        }),
      });
      if (!response.ok) {
        alert(await apiErrorMessage(response, 'Inscription refusée'));
        return;
      }
      const regBody = (await response.json()) as {
        mailSent?: boolean;
        devVerificationUrl?: string;
      };
      setRegMailSent(regBody.mailSent !== false);
      setRegDevVerifyUrl(regBody.devVerificationUrl ?? null);
      if (regBody.mailSent) {
        navigate('/verify-email-prompt', { state: { email: emailNorm } });
      } else {
        setRegMailSent(false);
        setRegDevVerifyUrl(regBody.devVerificationUrl ?? null);
        setShowModal(true);
      }
    } catch (e) {
      console.error(e);
      alert(getErrorMessage(e, 'Impossible de joindre le serveur. Vérifiez que le backend NestJS tourne sur le port 3000 et que PostgreSQL est accessible (DATABASE_URL dans backend/.env).'));
    }
  });

  const handleModalClose = () => {
    setShowModal(false);
    navigate('/login');
  };

  // ── Helpers ──
  const stepClass = dir === 'enter' ? 'auth-step-enter' : 'auth-step-back';

  const formatBytes = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} Ko`;

  // ── Progress Bar ──
  const getProgressSegClass = (index: number) => {
    if (index < step - 1) return 'auth-progress-seg done';
    if (index === step - 1) return 'auth-progress-seg active';
    return 'auth-progress-seg';
  };

  const renderProgressBar = () => (
    <div
      className="auth-progress"
      aria-label={`Étape ${step} sur ${totalSteps}`}
    >
      <progress value={step} max={totalSteps} aria-label={`Étape ${step} sur ${totalSteps}`} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={getProgressSegClass(i)}
        />
      ))}
    </div>
  );

  // ── Type Toggle ──
  const renderTypeToggle = () => (
    <div className="auth-field">
      <p className="auth-label">S'inscrire en tant que</p>
      <div className="auth-type-toggle">
        {(['entreprise', 'comptable'] as AccountType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={`auth-type-btn${accountType === type ? ' selected' : ''}`}
            onClick={() => {
              setAccountType(type);
              form1.setValue('accountType', type);
            }}
          >
            <div className="auth-radio-circle">
              <div className="auth-radio-dot" />
            </div>
            {type === 'entreprise' ? 'Une entreprise' : 'Cabinet de comptabilité'}
          </button>
        ))}
      </div>
    </div>
  );

  // ── File upload zone ──
  const renderFileZone = ({
    file, onFile, inputRef, label,
  }: {
    file: File | null;
    onFile: (f: File) => void;
    inputRef: React.RefObject<HTMLInputElement>;
    label: string;
  }) => (
    <div className="auth-field">
      <p className="auth-label">{label}</p>
      {file ? (
        <div className="auth-file-preview">
          <div className="auth-file-badge">
            {file.name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'FILE'}
          </div>
          <div className="auth-file-info">
            <span className="auth-file-name">{file.name}</span>
            <span className="auth-file-size">{formatBytes(file.size)}</span>
          </div>
        </div>
      ) : (
        <button type="button" className="auth-upload-zone" onClick={() => inputRef.current?.click()}>
          <Upload size={22} color="var(--f-text-muted)" />
          <p>Glissez-déposez vos documents</p>
          <span className="auth-upload-zone-btn">
            Sélectionner un Fichier
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        aria-label={label}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );

  // ════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════
  return (
    <>
      {showModal && (
        <SuccessModal
          onClose={handleModalClose}
          mailSent={regMailSent}
          devVerificationUrl={regDevVerifyUrl}
        />
      )}

      <div className="auth-root">
        <div className="auth-card auth-card--signup">
          {/* Left */}
          <AuthLeftPanel />

          {/* Right */}
          <div className="auth-panel-right">
            <div className="auth-animate-up">
              <div className="auth-logo">
                <Link to="/" aria-label="Comptabli — Accueil">
                  <AppLogo variant="auth" />
                </Link>
              </div>
              <h1 className="auth-form-title">S'inscrire</h1>
              <p className="auth-form-subtitle">
                Inscrivez-vous pour profiter des fonctionnalités de Comptabli
              </p>

              {renderProgressBar()}

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  STEP 1 – Email + phone (+ pw si entreprise)
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              {step === 1 && (
                <form onSubmit={handleStep1} noValidate className={`auth-form ${stepClass}`}>
                  {renderTypeToggle()}

                  {accountType === 'comptable' ? (
                    <>
                      <div className="auth-field">
                        <label htmlFor="signup-email" className="auth-label">Adresse e-mail professionnelle</label>
                        <input
                          id="signup-email"
                          {...form1.register('email')}
                          type="email"
                          placeholder="ex john@domain.com"
                          style={inp(!!form1.formState.errors.email)}
                        />
                        {form1.formState.errors.email && (
                          <span className="auth-error-text">{form1.formState.errors.email.message}</span>
                        )}
                      </div>

                      <div className="auth-field">
                        <p className="auth-label">Numéro de téléphone</p>
                        <div className="auth-phone-wrap">
                          <select {...form1.register('phoneCode')} style={{ ...inp(), width: 86, flexShrink: 0 }}>
                            <option>+216</option>
                          </select>
                          <input
                            {...form1.register('phone')}
                            type="tel"
                            placeholder="Entrer votre numéro de téléphone"
                            style={{ ...inp(!!form1.formState.errors.phone), flex: 1 }}
                          />
                        </div>
                        {form1.formState.errors.phone && (
                          <span className="auth-error-text">{form1.formState.errors.phone.message}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* ENTREPRISE: Ultra compact layout to prevent scrolling */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        <div className="auth-field" style={{ marginBottom: 0 }}>
                          <label htmlFor="signup-email" className="auth-label">Adresse e-mail professionnelle</label>
                          <input
                            id="signup-email"
                            {...form1.register('email')}
                            type="email"
                            placeholder="ex john@domain.com"
                            style={inp(!!form1.formState.errors.email)}
                          />
                          {form1.formState.errors.email && (
                            <span className="auth-error-text">{form1.formState.errors.email.message}</span>
                          )}
                        </div>

                        <div className="auth-field" style={{ marginBottom: 0 }}>
                          <p className="auth-label">Numéro de téléphone</p>
                          <div className="auth-phone-wrap">
                            <select {...form1.register('phoneCode')} style={{ ...inp(), width: 80, flexShrink: 0, paddingRight: 4 }}>
                              <option>+216</option>
                            </select>
                            <input
                              {...form1.register('phone')}
                              type="tel"
                              placeholder="Entrer votre numéro"
                              style={{ ...inp(!!form1.formState.errors.phone), flex: 1 }}
                            />
                          </div>
                          {form1.formState.errors.phone && (
                            <span className="auth-error-text">{form1.formState.errors.phone.message}</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'start' }}>
                        <div>
                          <div className="auth-field" style={{ marginBottom: '8px' }}>
                            <label htmlFor="signup-password-entreprise" className="auth-label">Mot de passe</label>
                            <PwInput
                              {...form1.register('password')}
                              inputId="signup-password-entreprise"
                              show={showPw}
                              onToggle={() => setShowPw((p) => !p)}
                              placeholder="Entrer votre mot de passe"
                              error={!!form1.formState.errors.password}
                            />
                            {form1.formState.errors.password && (
                              <span className="auth-error-text">{form1.formState.errors.password.message}</span>
                            )}
                          </div>
                          <PasswordChecksGrid checks={pw1c} />
                        </div>
                        
                        <div>
                          <p className="auth-label">Vérification</p>
                          <div className="auth-captcha-box" style={{ marginBottom: 0, padding: '8px 12px', height: '42px' }}>
                            <label className="auth-captcha-label" style={{ fontSize: '0.8rem' }}>
                              <input
                                {...form1.register('notRobot')}
                                type="checkbox"
                                className="auth-captcha-checkbox"
                              />
                              <span className="auth-captcha-check-visual" style={{ width: 22, height: 22 }}>
                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                  <polyline points="2,7 6,11 12,3" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                              </span>
                              <span>Je ne suis pas un robot</span>
                            </label>
                            <div className="auth-captcha-badge">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#4285f4"/>
                              </svg>
                            </div>
                          </div>
                          {form1.formState.errors.notRobot && (
                            <span className="auth-error-text" style={{ display: 'block', marginTop: 4 }}>
                              {form1.formState.errors.notRobot.message}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={form1.formState.isSubmitting}
                    sx={MuiPrimary}
                  >
                    {form1.formState.isSubmitting
                      ? <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                      : null}
                    {accountType === 'comptable' ? 'Suivant  →' : "S'inscrire  →"}
                  </Button>
                </form>
              )}

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  STEP 2 – Cabinet + secteur + docs
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              {step === 2 && accountType === 'comptable' && (
                <form onSubmit={handleStep2} noValidate className={`auth-form ${stepClass}`}>
                  <div className="auth-field">
                    <label htmlFor="signup-cabinet-name" className="auth-label">Nom du cabinet</label>
                    <input
                      id="signup-cabinet-name"
                      {...form2c.register('cabinetName')}
                      type="text"
                      placeholder="ex john@domain.com"
                      style={inp(!!form2c.formState.errors.cabinetName)}
                    />
                    {form2c.formState.errors.cabinetName && (
                      <span className="auth-error-text">{form2c.formState.errors.cabinetName.message}</span>
                    )}
                  </div>

                  <div className="auth-field">
                    <label htmlFor="signup-sector" className="auth-label">Secteur d'activité</label>
                    <div style={{ position: 'relative' }}>
                      <select id="signup-sector" {...form2c.register('sector')} style={{ ...inp(), paddingRight: 36 }}>
                        {['Finance', 'Immobilier', 'Commerce', 'Technologie', 'Santé', 'Autre'].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--f-text-muted)' }}>▾</span>
                    </div>
                  </div>

                  {/* Patente */}
                  {renderFileZone({
                    file: patenteFile,
                    onFile: setPatenteFile,
                    inputRef: patenteRef,
                    label: 'Patente',
                  })}

                  {/* RNE */}
                  {renderFileZone({
                    file: rneFile,
                    onFile: setRneFile,
                    inputRef: rneRef,
                    label: 'RNE',
                  })}

                  <div className="auth-btn-row">
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={goBack}
                      sx={{
                        flex: 1, fontFamily: 'var(--f-font-display)', fontWeight: 600,
                        fontSize: '0.9rem', textTransform: 'none',
                        borderRadius: '12px', padding: '12px 16px',
                        borderColor: 'var(--f-border)', color: 'var(--f-text-primary)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                        '&:hover': {
                          borderColor: 'var(--f-blue-600)', color: 'var(--f-blue-600)', background: 'rgba(37,99,235,0.04)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
                        },
                      }}
                    >
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disableElevation
                      disabled={form2c.formState.isSubmitting}
                      sx={{ ...MuiPrimary, flex: 1 }}
                    >
                      Suivant &nbsp;→
                    </Button>
                  </div>
                </form>
              )}

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  STEP 3 – Mot de passe (comptable)
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              {step === 3 && accountType === 'comptable' && (
                <form onSubmit={handleStep3} noValidate className={`auth-form ${stepClass}`}>
                  <div className="auth-field">
                    <label htmlFor="signup-password-comptable" className="auth-label">
                      Mot de passe <span style={{ color: 'var(--f-danger)' }}>*</span>
                    </label>
                    <PwInput
                      {...form3c.register('password')}
                      inputId="signup-password-comptable"
                      show={showPw3}
                      onToggle={() => setShowPw3((p) => !p)}
                      placeholder="Entrer votre mot de passe"
                      error={!!form3c.formState.errors.password}
                    />
                    {form3c.formState.errors.password && (
                      <span className="auth-error-text">{form3c.formState.errors.password.message}</span>
                    )}
                  </div>

                  <PasswordChecksGrid checks={pw3c} />

                  <div className="auth-field">
                    <label htmlFor="signup-password-confirm-comptable" className="auth-label">
                      Confirmer Mot de passe <span style={{ color: 'var(--f-danger)' }}>*</span>
                    </label>
                    <PwInput
                      {...form3c.register('confirmPassword')}
                      inputId="signup-password-confirm-comptable"
                      show={showConfirm}
                      onToggle={() => setShowConfirm((p) => !p)}
                      placeholder="Entrer votre mot de passe"
                      error={!!form3c.formState.errors.confirmPassword}
                    />
                    {form3c.formState.errors.confirmPassword && (
                      <span className="auth-error-text">{form3c.formState.errors.confirmPassword.message}</span>
                    )}
                  </div>

                  {/* <div className="auth-check-row" style={{ marginTop: 8 }}>
                    <input
                      id="signup-terms-comptable"
                      {...form3c.register('acceptTerms')}
                      type="checkbox"
                      style={{ width: 15, height: 15, accentColor: 'var(--f-blue-600)' }}
                    />
                    <label htmlFor="signup-terms-comptable">J'accepte les termes et conditions</label>
                    {form3c.formState.errors.acceptTerms && (
                      <span className="auth-error-text">{form3c.formState.errors.acceptTerms.message}</span>
                    )}
                  </div> */}

                  {/* CAPTCHA */}
                  <div className="auth-captcha-box">
                    <label className="auth-captcha-label">
                      <input
                        {...form3c.register('notRobot')}
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
                  {form3c.formState.errors.notRobot && (
                    <span className="auth-error-text" style={{ display: 'block', marginTop: 4 }}>
                      {form3c.formState.errors.notRobot.message}
                    </span>
                  )}

                  <div className="auth-btn-row">
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={goBack}
                      sx={{
                        flex: 1, fontFamily: 'var(--f-font-display)', fontWeight: 600,
                        fontSize: '0.9rem', textTransform: 'none',
                        borderRadius: '12px', padding: '12px 16px',
                        borderColor: 'var(--f-border)', color: 'var(--f-text-primary)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                        '&:hover': {
                          borderColor: 'var(--f-blue-600)', color: 'var(--f-blue-600)', background: 'rgba(37,99,235,0.04)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
                        },
                      }}
                    >
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disableElevation
                      disabled={form3c.formState.isSubmitting}
                      sx={{ ...MuiPrimary, flex: 1 }}
                    >
                      {form3c.formState.isSubmitting
                        ? <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                        : null}
                      S'inscrire &nbsp;→
                    </Button>
                  </div>
                </form>
              )}

              <p className="auth-form-footer">
                <Link to="/" className="auth-link">
                  ← Retour à l&apos;accueil
                </Link>
              </p>
              <p className="auth-form-footer">
                Vous avez déjà un compte ?{' '}
                <Link to="/login" className="auth-link">Se connecter</Link>
              </p>

              <p style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--f-text-muted)', marginTop: 10 }}>
                © 2026 Comptabli · Tous droits réservés
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
