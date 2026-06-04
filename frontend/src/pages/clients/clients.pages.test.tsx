import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientsPage from './ClientsPage';
import CollaboratorsPage from '../collaborators/CollaboratorsPage';
import CollaboratorDetailsPage from '../collaborators/CollaboratorDetailsPage';

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    user: { role: 'COMPTABLE', firstName: 'Alice', id: 'comp-1' },
    token: 'tok',
  }),
}));

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Clients & Collaborators Pages', () => {
  it('ClientsPage renders without crashing', async () => {
    await act(async () => {
      wrap(<ClientsPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('CollaboratorsPage renders without crashing', async () => {
    await act(async () => {
      wrap(<CollaboratorsPage />);
    });
    expect(document.body).toBeTruthy();
  });

  it('CollaboratorDetailsPage renders without crashing', async () => {
    await act(async () => {
      wrap(<CollaboratorDetailsPage />);
    });
    expect(document.body).toBeTruthy();
  });
});
