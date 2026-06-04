import { apiErrorMessage } from '../api';
import { authFetch } from '../authFetch';

export async function createInvoice(data: {
  documentId: string;
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: Date | null;
  totalAmount?: number | null;
  taxAmount?: number | null;
  currency?: string;
  extractedData?: string;
}) {
  const response = await authFetch('/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    return { ok: false, message: await apiErrorMessage(response, 'Erreur de synchronisation') };
  }

  const result = await response.json();
  return { ok: true, data: result };
}
