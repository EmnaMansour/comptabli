import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DemandesPage from './DemandesPage';
import DemandesClientsPage from './DemandesClientsPage';
import MesDemandesPage from './MesDemandesPage';

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
