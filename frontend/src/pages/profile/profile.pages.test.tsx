import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import SettingsPage from '../settings/SettingsPage';
import NotificationsPage from '../notifications/NotificationsPage';
import NetworkingPage from '../networking/NetworkingPage';
import NetworkingProfilePage from '../networking/NetworkingProfilePage';
import SearchComptables from '../search/SearchComptables';
import MonEspaceClient from '../mon-espace/MonEspaceClient';

jest.mock('../../store/authStore', () => ({
  useAuthStore: Object.assign(
    jest.fn().mockReturnValue({
      user: { role: 'COMPTABLE', firstName: 'Alice', id: 'comp-1' },
      token: 'tok',
    }),
    {
      getState: jest.fn().mockReturnValue({
        user: { role: 'COMPTABLE', firstName: 'Alice', id: 'comp-1' },
        token: 'tok',
      }),
    }
  ),
}));

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Profile & Misc Pages', () => {
  it('ProfilePage renders without crashing', async () => {
    await act(async () => {
      wrap(<ProfilePage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('SettingsPage renders without crashing', async () => {
    await act(async () => {
      wrap(<SettingsPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('NotificationsPage renders without crashing', async () => {
    await act(async () => {
      wrap(<NotificationsPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('NetworkingPage renders without crashing', async () => {
    await act(async () => {
      wrap(<NetworkingPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('NetworkingProfilePage renders without crashing', async () => {
    await act(async () => {
      wrap(<NetworkingProfilePage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('SearchComptables renders without crashing', async () => {
    await act(async () => {
      wrap(<SearchComptables />);
    });
    expect(document.body).toBeTruthy();
  });

  it('MonEspaceClient renders without crashing', async () => {
    await act(async () => {
      wrap(<MonEspaceClient />);
    });
    expect(document.body).toBeTruthy();
  });
});
