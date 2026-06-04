// ═══════════════════════════════════════════
// FINORA – Auth Types
// ═══════════════════════════════════════════

export type AccountType = 'entreprise' | 'comptable';

export interface AuthSlide {
  title: string;
  desc: string;
  icon: string;
  label: string;
}

// ── Login ──
export interface LoginFormData {
  email: string;
  password: string;
  remember: boolean;
}

// ── Signup Step 1 ──
export interface SignupStep1Data {
  accountType: AccountType;
  email: string;
  phone: string;
  phoneCode: string;
  password: string;
  acceptTerms: boolean;
}

// ── Signup Step 2 – Comptable ──
export interface SignupStep2ComptableData {
  cabinetName: string;
  sector: string;
  patente: File | null;
  rne: File | null;
}

// ── Signup Step 2 – Entreprise ──
export interface SignupStep2EntrepriseData {
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface PasswordChecks {
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
  length: boolean;
}

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    length: password.length >= 8,
  };
}
