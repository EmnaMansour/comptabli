import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    user: { role: 'ADMIN', firstName: 'Admin', id: 'admin-1' },
    token: 'tok',
  }),
}));

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Admin Pages', () => {
  it('AdminDashboardPage renders without crashing', async () => {
    const { default: P } = await import('./AdminDashboardPage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });

  it('AdminUsersPage renders without crashing', async () => {
    const { default: P } = await import('./AdminUsersPage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });

  it('AdminAccountantsPage renders without crashing', async () => {
    const { default: P } = await import('./AdminAccountantsPage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });

  it('AdminReviewsPage renders without crashing', async () => {
    const { default: P } = await import('./AdminReviewsPage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });

  it('AdminAuditLogsPage renders without crashing', async () => {
    const { default: P } = await import('./AdminAuditLogsPage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });

  it('AdminAnalyticsPage renders without crashing', async () => {
    const { default: P } = await import('./AdminAnalyticsPage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });

  it('AdminStoragePage renders without crashing', async () => {
    const { default: P } = await import('./AdminStoragePage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });

  it('AdminProfilePage renders without crashing', async () => {
    const { default: P } = await import('./AdminProfilePage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });
});
