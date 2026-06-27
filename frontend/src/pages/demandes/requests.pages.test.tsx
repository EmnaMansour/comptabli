import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DemandesPage from './DemandesPage';
import DemandesClientsPage from './DemandesClientsPage';
import MesDemandesPage from './MesDemandesPage';

// Mock all API services to prevent real network calls that kill the Jest worker
jest.mock('../../lib/api/requestService', () => ({
  fetchRequests: jest.fn().mockResolvedValue([]),
  fetchRequestById: jest.fn().mockResolvedValue(null),
  createRequest: jest.fn().mockResolvedValue({ ok: true, data: { id: 'test-id' } }),
  updateRequest: jest.fn().mockResolvedValue({ ok: true }),
  updateRequestManagement: jest.fn().mockResolvedValue({ ok: true }),
  deleteRequest: jest.fn().mockResolvedValue({ ok: true }),
  updateRequestStatus: jest.fn().mockResolvedValue({ ok: true }),
  postRequestComment: jest.fn().mockResolvedValue({ ok: true }),
  uploadRequestAttachment: jest.fn().mockResolvedValue({ ok: true }),
  attachRequestDocumentFromLibrary: jest.fn().mockResolvedValue({ ok: true }),
  deleteRequestAttachment: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../../lib/api/documentService', () => ({
  fetchDocuments: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../lib/api/folderService', () => ({
  fetchFolders: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../lib/api/messagingService', () => ({
  fetchMessagingDirectory: jest.fn().mockResolvedValue({
    accountants: [],
    collaborators: [],
    clients: [],
  }),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    user: { role: 'COMPTABLE', firstName: 'Alice', id: 'comp-1' },
    token: 'tok',
  }),
}));

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Demandes Pages', () => {
  it('DemandesPage renders without crashing', async () => {
    await act(async () => {
      wrap(<DemandesPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('DemandesClientsPage renders without crashing', async () => {
    await act(async () => {
      wrap(<DemandesClientsPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('MesDemandesPage renders without crashing', async () => {
    await act(async () => {
      wrap(<MesDemandesPage />);
    });
    expect(document.body).toBeTruthy();
  });
});
