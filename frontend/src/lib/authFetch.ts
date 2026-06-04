import { apiUrl } from './api';
import { useAuthStore } from '../store/authStore';

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const { refreshToken, token, setTokens } = useAuthStore.getState();
  if (!refreshToken || token === 'demo-token') return false;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        access_token: string;
        refresh_token: string;
      };
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Fetch API authentifiée : ajoute le Bearer, renouvelle access/refresh si 401.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers);
  if (token && token !== 'demo-token') {
    headers.set('Authorization', `Bearer ${token}`);
  }
  let res = await fetch(apiUrl(path), { ...init, headers });
  if (res.status === 401 && useAuthStore.getState().refreshToken && token !== 'demo-token') {
    const ok = await refreshSession();
    if (ok) {
      const t = useAuthStore.getState().token!;
      headers.set('Authorization', `Bearer ${t}`);
      res = await fetch(apiUrl(path), { ...init, headers });
    }
  }
  return res;
}
