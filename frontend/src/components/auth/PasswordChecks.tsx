// ═══════════════════════════════════════════
// Comptabli – PasswordChecks Component
// ═══════════════════════════════════════════

import React from 'react';
import type { PasswordChecks } from '../../types/auth.types';

interface CheckItemProps {
  ok: boolean;
  label: string;
}

const CheckItem: React.FC<CheckItemProps> = ({ ok, label }) => (
  <div className={`auth-pw-check${ok ? ' ok' : ''}`}>
    <div className="auth-check-dot" />
    {label}
  </div>
);

interface PasswordChecksProps {
  checks: PasswordChecks;
}

const PasswordChecksGrid: React.FC<PasswordChecksProps> = ({ checks }) => (
  <div className="auth-pw-checks">
    <CheckItem ok={checks.lowercase} label="One lowercase character" />
    <CheckItem ok={checks.number}    label="One number" />
    <CheckItem ok={checks.uppercase} label="One uppercase character" />
    <CheckItem ok={checks.special}   label="One special character" />
  </div>
);

export default PasswordChecksGrid;
