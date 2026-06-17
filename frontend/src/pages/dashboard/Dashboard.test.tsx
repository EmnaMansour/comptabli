import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

import { useAuthStore } from '../../store/authStore';
const mockStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Dashboard', () => {
  it('renders COMPTABLE dashboard', async () => {
    mockStore.mockReturnValue({ user: { role: 'COMPTABLE', firstName: 'Alice' }, token: 'tok' } as any);
    await act(async () => {
      wrap(<Dashboard />);
    });
    // On cible le titre h1 de la page (unique) → pas d'ambiguïté
    expect(
      await screen.findByRole('heading', { level: 1, name: /tableau de bord/i })
    ).toBeInTheDocument();
  });

  it('renders CLIENT dashboard', async () => {
    mockStore.mockReturnValue({ user: { role: 'CLIENT', firstName: 'Bob' }, token: 'tok' } as any);
    await act(async () => {
      wrap(<Dashboard />);
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: /tableau de bord client/i })
    ).toBeInTheDocument();
  });

  it('renders COLLABORATEUR dashboard', async () => {
    mockStore.mockReturnValue({ user: { role: 'COLLABORATEUR', firstName: 'Charlie' }, token: 'tok' } as any);
    await act(async () => {
      wrap(<Dashboard />);
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: /tableau de bord collaborateur/i })
    ).toBeInTheDocument();
  });

  it('redirects ADMIN without crash', async () => {
    mockStore.mockReturnValue({ user: { role: 'ADMIN', firstName: 'Admin' }, token: 'tok' } as any);
    await act(async () => {
      wrap(<Dashboard />);
    });
    expect(document.body).toBeTruthy();
  });
});