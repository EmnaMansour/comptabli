// ═══════════════════════════════════════════
// Comptabli – Auth Store (Zustand)
// ═══════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiUrl } from '../lib/api';

/** Rôles alignés sur le backend Prisma */
export type UserRole = 'ADMIN' | 'COMPTABLE' | 'COLLABORATEUR' | 'CLIENT' | null;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  mustChangePassword?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setUser: (
    id: string,
    email: string,
    role: UserRole,
    accessToken: string,
    profile?: { firstName?: string; lastName?: string; mustChangePassword?: boolean },
    refreshToken?: string | null,
  ) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setDemoUser: (role: UserRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      setUser: (id, email, role, accessToken, profile, rt) =>
        set({
          user: {
            id,
            email,
            role,
            firstName: profile?.firstName,
            lastName: profile?.lastName,
            mustChangePassword: profile?.mustChangePassword,
          },
          token: accessToken,
          refreshToken: rt ?? null,
          isAuthenticated: true,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({
          token: accessToken,
          refreshToken,
          isAuthenticated: get().user !== null,
        }),

      setDemoUser: (role) =>
        set({
          user: {
            id: 'demo-id',
            email: 'demo@finora.io',
            role,
            firstName: 'Démo',
            lastName: 'Utilisateur',
          },
          token: 'demo-token',
          refreshToken: null,
          isAuthenticated: true,
        }),

      logout: () => {
        const { refreshToken, token } = get();
        if (refreshToken && token && token !== 'demo-token') {
          void fetch(apiUrl('/auth/logout'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
        }
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'finora-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
