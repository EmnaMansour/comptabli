import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { loginRequest } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

// Mock react-router
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock API
jest.mock('../../lib/api', () => ({
  loginRequest: jest.fn(),
}));

// Mock Zustand store
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

describe('Login Component', () => {
  const mockSetUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      setUser: mockSetUser,
    });
  });

  it('renders the login form correctly', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('Se connecter')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Foulen@gmail.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument();
  });

  it('shows error message on invalid credentials', async () => {
    const user = userEvent.setup();
    (loginRequest as jest.Mock).mockResolvedValueOnce({
      ok: false,
      message: 'Identifiants incorrects',
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Foulen@gmail.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.click(screen.getByRole('checkbox')); // captcha
    await user.click(screen.getByRole('button', { name: /Se connecter/i }));

    await waitFor(() => {
      expect(screen.getByText('Identifiants incorrects')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it('calls API, updates store and navigates on successful login', async () => {
    const user = userEvent.setup();
    (loginRequest as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        user: {
          id: '1',
          email: 'admin@comptabli.com',
          role: 'ADMIN',
          firstName: 'Admin',
          lastName: 'System',
        },
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Foulen@gmail.com'), 'admin@comptabli.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('checkbox')); // captcha
    await user.click(screen.getByRole('button', { name: /Se connecter/i }));

    await waitFor(() => {
      expect(loginRequest).toHaveBeenCalledWith('admin@comptabli.com', 'password123');
    });

    expect(mockSetUser).toHaveBeenCalledWith(
      '1',
      'admin@comptabli.com',
      'ADMIN',
      'fake-token',
      { firstName: 'Admin', lastName: 'System' },
      'fake-refresh'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
