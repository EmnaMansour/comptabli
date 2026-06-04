import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DocumentsPage from '../documents/DocumentsPage';
import MessagingPage from '../messaging/MessagingPage';
import ArchivesPage from '../archives/ArchivesPage';

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    user: { role: 'COMPTABLE', firstName: 'Alice', id: 'comp-1' },
    token: 'tok',
  }),
}));

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Documents / Messaging / Archives Pages', () => {
  it('DocumentsPage renders without crashing', async () => {
    await act(async () => {
      wrap(<DocumentsPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('MessagingPage renders without crashing', async () => {
    await act(async () => {
      wrap(<MessagingPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('ArchivesPage renders without crashing', async () => {
    await act(async () => {
      wrap(<ArchivesPage />);
    });
    expect(document.body).toBeTruthy();
  });
});
