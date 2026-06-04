import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    user: { role: 'COMPTABLE', firstName: 'Alice', id: 'comp-1' },
    token: 'tok',
  }),
}));

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Workspace Pages', () => {
  it('TasksPage renders without crashing', async () => {
    const { default: P } = await import('./TasksPage');
    await act(async () => {
      wrap(<P />);
    });
    expect(document.body).toBeTruthy();
  });
});
