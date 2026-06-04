/**
 * En dev, les requêtes passent par le proxy Vite (même origine → pas de CORS).
 * En prod, définir VITE_API_URL (ex. https://api.mondomaine.com).
 */
export function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return String(envUrl).replace(/\/$/, '');
  if (import.meta.env.DEV) return '';
  return 'http://localhost:3000';
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Retourne l'URL complète pour un asset (image, document, etc.)
 */
export function getAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  
  // If base is empty (Dev mode proxy), return relative path
  if (!base) return p;
  
  return `${base}${p}`;
}

export async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    const m = body?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
    if (m && typeof m === 'object') {
      const parts = Object.entries(m as Record<string, unknown>).flatMap(([k, v]) => {
        if (Array.isArray(v)) return v.map((x) => `${k}: ${String(x)}`);
        return [`${k}: ${String(v)}`];
      });
      if (parts.length) return parts.join(' ');
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (${response.status})`;
}

export type LoginSuccess = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
  user: {
    email: string;
    role: string;
    id?: string;
    firstName?: string;
    lastName?: string;
    emailVerified?: boolean;
  };
};

export async function loginRequest(
  email: string,
  password: string,
): Promise<{ ok: true; data: LoginSuccess; message?: string } | { ok: false; message: string }> {
  const response = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Connexion refusée') };
  }
  const data = (await response.json()) as LoginSuccess;
  return { ok: true, data };
}

export async function verifyEmailRequest(
  token: string,
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await fetch(apiUrl('/auth/verify-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Vérification impossible') };
  }
  return { ok: true };
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(apiUrl('/'));
    if (response.ok) {
      return { ok: true, message: 'Connexion réussie au backend!' };
    } else {
      return { ok: false, message: `Erreur HTTP: ${response.status}` };
    }
  } catch (error) {
    return { ok: false, message: `Erreur de connexion: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function forgotPasswordRequest(
  email: string,
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await fetch(apiUrl('/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur lors de la demande') };
  }
  return { ok: true, message: 'Si cette adresse existe, un lien de réinitialisation a été envoyé.' };
}

export async function resetPasswordRequest(
  token: string,
  password: string,
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const response = await fetch(apiUrl('/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Réinitialisation impossible') };
  }
  return { ok: true, message: 'Mot de passe réinitialisé avec succès.' };
}
