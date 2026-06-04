import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

// ─── TYPES ──────────────────────────────────────────────────────

export type AccountantProfileData = {
  id: string;
  accountantId: string;
  companyName?: string;
  specialties: string[];
  phone?: string;
  email?: string;
  location?: string;
  mapsLink?: string;
  bio?: string;
  yearsExperience?: number;
  averageRating: number;
  totalReviews: number;
  isListed: boolean;
  profileImageUrl?: string;
  coverImageUrl?: string;
  website?: string;
  createdAt: string;
  accountant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    whatsapp?: string;
    website?: string;
  };
  reviews?: ReviewData[];
};

export type ReviewData = {
  id: string;
  rating: number;
  comment?: string;
  status: string;
  createdAt: string;
  accountantId?: string;
  clientId?: string;
  accountant?: {
    id: string;
    firstName: string;
    lastName: string;
    companyName?: string;
  };
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    companyName?: string;
  };
};

export type ContactData = {
  id: string;
  accountantId: string;
  clientId: string;
  message: string;
  status: string;
  createdAt: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

// ─── NETWORKING / PROFILES ──────────────────────────────────────

/**
 * Liste tous les profils comptables (fiches networking publiques)
 */
export async function fetchNetworkingProfiles(filters?: {
  specialty?: string;
  location?: string;
}): Promise<AccountantProfileData[]> {
  let url = '/accountant-profile';
  const params = new URLSearchParams();
  if (filters?.specialty) params.set('specialty', filters.specialty);
  if (filters?.location) params.set('location', filters.location);
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const response = await authFetch(url);
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Impossible de charger les profils'));
  }
  return response.json();
}

/**
 * Récupère le profil public d'un comptable par son ID
 */
export async function fetchAccountantPublicProfile(accountantId: string): Promise<AccountantProfileData> {
  const response = await authFetch(`/accountant-profile/public/${accountantId}`);
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Profil introuvable'));
  }
  return response.json();
}

/**
 * Récupère le profil du comptable connecté (crée le profil si nécessaire)
 */
export async function fetchMyAccountantProfile(): Promise<AccountantProfileData> {
  const response = await authFetch('/accountant-profile/me');
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Impossible de charger votre profil'));
  }
  return response.json();
}

/**
 * Récupère les comptables liés au client connecté
 */
export async function fetchMyAccountants(): Promise<AccountantProfileData[]> {
  const response = await authFetch('/accountant-profile/me/my-accountants');
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Impossible de charger vos comptables'));
  }
  return response.json();
}

/**
 * Met à jour le profil networking du comptable connecté
 */
export async function updateMyAccountantProfile(data: Partial<AccountantProfileData>): Promise<AccountantProfileData> {
  const response = await authFetch('/accountant-profile/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Impossible de mettre à jour le profil'));
  }
  return response.json();
}

// ─── RELATIONSHIP CHECK ─────────────────────────────────────────

/**
 * Vérifie si le client connecté a une relation avec un comptable donné
 */
export async function checkRelationship(accountantId: string): Promise<{
  hasRelationship: boolean;
  hasExistingReview: boolean;
}> {
  const response = await authFetch(`/accountant-profile/${accountantId}/has-relationship`);
  if (!response.ok) {
    return { hasRelationship: false, hasExistingReview: false };
  }
  return response.json();
}

// ─── REVIEWS ────────────────────────────────────────────────────

/**
 * Soumettre un avis de la part du client
 */
export async function submitReview(payload: { accountantId: string; rating: number; comment?: string }) {
  const response = await authFetch('/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Erreur lors de la soumission de l'avis"));
  }

  return response.json();
}

/**
 * Récupérer les avis postés par le client connecté
 */
export async function fetchMyClientReviews(): Promise<ReviewData[]> {
  const response = await authFetch('/reviews/my-reviews');
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Impossible de charger vos avis'));
  return response.json();
}

/**
 * Récupérer les avis reçus par le comptable connecté
 */
export async function fetchAccountantReviews(): Promise<ReviewData[]> {
  const response = await authFetch('/reviews/my-accountant-reviews');
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Impossible de charger vos avis'));
  return response.json();
}

/**
 * Récupérer les avis publics d'un comptable
 */
export async function fetchAccountantPublicReviews(accountantId: string): Promise<ReviewData[]> {
  const response = await authFetch(`/accountant-profile/${accountantId}/reviews`);
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Impossible de charger les avis'));
  return response.json();
}

// ─── CONTACT ────────────────────────────────────────────────────

/**
 * Envoyer un message de contact à un comptable (crée notification)
 */
export async function sendContactToAccountant(accountantId: string, message: string) {
  const response = await authFetch(`/accountant-profile/${accountantId}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Erreur lors de l'envoi du message"));
  }

  return response.json();
}

/**
 * Envoyer un message de contact en tant que VISITEUR (public)
 */
export async function sendVisitorContactToAccountant(
  accountantId: string,
  payload: {
    name: string;
    email: string;
    phone: string;
    company: string;
    subject: string;
    message: string;
  },
) {
  const response = await authFetch(`/accountant-profile/public/${accountantId}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Erreur lors de l'envoi de votre demande"));
  }

  return response.json();
}

/**
 * Récupérer les contacts reçus par le comptable connecté
 */
export async function fetchMyContacts(): Promise<ContactData[]> {
  const response = await authFetch('/accountant-profile/me/contacts');
  if (!response.ok) throw new Error(await apiErrorMessage(response, 'Impossible de charger les contacts'));
  return response.json();
}
