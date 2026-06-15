import { authFetch } from '../authFetch';
import { apiErrorMessage, getAssetUrl } from '../api';

export interface AccountantProfileUpdate {
  companyName?: string;
  specialties?: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  location?: string;
  mapsLink?: string;
  bio?: string;
  yearsExperience?: number;
  isListed?: boolean;
  profileImageUrl?: string;
  coverImageUrl?: string;
  activitySector?: string;
  legalType?: string;
  headquarters?: string;
  rcNumber?: string;
  patenteUrl?: string;
  rneUrl?: string;
  website?: string;
  firstName?: string;
  lastName?: string;
}

async function parseJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, fallback));
  }
  return (await response.json()) as T;
}

export const fetchMyAccountantProfile = async () => {
  const response = await authFetch('/accountant-profile/me');
  return parseJson<any>(response, 'Impossible de charger votre profil');
};

export const updateMyAccountantProfile = async (data: AccountantProfileUpdate) => {
  const response = await authFetch('/accountant-profile/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseJson<any>(response, 'Impossible de mettre à jour votre profil');
};

export const uploadAccountantFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await authFetch('/accountant-profile/me/upload', {
    method: 'POST',
    body: formData,
  });
  
  const data = await parseJson<{ url: string }>(response, 'Impossible de télécharger le fichier');
  
  return getAssetUrl(data.url);
};
