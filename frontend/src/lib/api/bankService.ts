import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export type BankAccount = {
  id: string;
  bankName: string;
  agency?: string;
  rib?: string;
  accountType?: string;
  pack?: string;
  login?: string;
  password?: string;
  balance: number;
  currency: string;
  transactions?: BankTransaction[];
  statements?: BankStatement[];
  createdAt: string;
};

export type BankTransaction = {
  id: string;
  date: string;
  operation: string;
  details?: string;
  reference?: string;
  amount: number;
  currency: string;
  bankAccountId: string;
};

export type BankStatement = {
  id: string;
  name: string;
  url?: string;
  date: string;
  bankAccountId: string;
};

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const response = await authFetch('/banks');

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Erreur lors de la récupération des comptes'));
  }

  return response.json();
}

export async function fetchBankAccount(id: string): Promise<BankAccount> {
  const response = await authFetch(`/banks/${id}`);

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Erreur lors de la récupération du compte'));
  }

  return response.json();
}

export async function createBankAccount(data: Partial<BankAccount>): Promise<BankAccount> {
  const response = await authFetch('/banks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Erreur lors de la création du compte'));
  }

  return response.json();
}

export async function updateBankAccount(id: string, data: Partial<BankAccount>): Promise<BankAccount> {
  const response = await authFetch(`/banks/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Erreur lors de la mise à jour du compte'));
  }

  return response.json();
}

export async function deleteBankAccount(id: string): Promise<void> {
  const response = await authFetch(`/banks/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Erreur lors de la suppression du compte'));
  }
}

export async function addBankTransaction(
  accountId: string,
  data: Partial<BankTransaction>,
): Promise<BankTransaction> {
  const response = await authFetch(`/banks/${accountId}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Erreur lors de l'ajout de la transaction"));
  }

  return response.json();
}
