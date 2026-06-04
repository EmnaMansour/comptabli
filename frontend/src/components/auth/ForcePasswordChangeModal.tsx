import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import '../../styles/workspace-ui.css';

export default function ForcePasswordChangeModal() {
  const { user, token, setUser } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si on n'a pas besoin de forcer, on ne rend rien.
  if (!user || !user.mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!token) {
        setError('Session invalide.');
        return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/users/me/password'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Erreur lors du changement de mot de passe.');
      }

      // Succès : Mettre à jour le store pour enlever l'obligation (la modale va disparaître)
      setUser(user.id, user.email, user.role, token, {
         firstName: user.firstName,
         lastName: user.lastName,
         mustChangePassword: false,
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ws-modal-overlay" style={{ zIndex: 99999, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="ws-modal animate-fade-in" style={{ maxWidth: 500, width: '100%', padding: '3rem', borderRadius: 24, textAlign: 'left', background: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.25rem', letterSpacing: '-0.5px' }}>
          Sécurisez votre compte
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1.5rem' }}>
          Personnalisez votre mot de passe pour continuer.
        </p>

        {/* Decorative divider matching the screenshot style */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '2.5rem' }}>
          <div style={{ height: '4px', flex: 1, background: '#2563eb', borderRadius: '4px' }} />
          <div style={{ height: '4px', flex: 1, background: '#e2e8f0', borderRadius: '4px' }} />
          <div style={{ height: '4px', flex: 1, background: '#e2e8f0', borderRadius: '4px' }} />
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1.5rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>Nouveau mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="ws-input w-full"
                placeholder="Minimum 8 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ padding: '0.85rem 1rem', paddingRight: '2.5rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              />
              <button
                type="button"
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>Confirmer le mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="ws-input w-full"
                placeholder="Ressaisissez le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ padding: '0.85rem 1rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="ws-btn-primary w-full"
            style={{ 
              padding: '1rem', 
              fontSize: '1rem', 
              fontWeight: 700, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              gap: 8,
              background: '#ea580c', // Orange from the screenshot reference
              borderColor: '#ea580c',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)'
            }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Valider'}
          </button>
        </form>
      </div>
    </div>
  );
}
