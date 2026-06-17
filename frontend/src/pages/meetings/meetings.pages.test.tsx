import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DisponibilitesPage from './DisponibilitesPage';
import MesRendezVousPage from './MesRendezVousPage';

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    user: { role: 'COMPTABLE', firstName: 'Alice', id: 'comp-1' },
    token: 'tok',
  }),
}));

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Meetings Pages', () => {
  it('DisponibilitesPage renders without crashing', async () => {
    await act(async () => {
      wrap(<DisponibilitesPage onBack={() => {}} />);
    });
    expect(document.body).toBeTruthy();
  });

  it('MesRendezVousPage renders without crashing', async () => {
    await act(async () => {
      wrap(<MesRendezVousPage />);
    });
    expect(document.body).toBeTruthy();
  });
});
