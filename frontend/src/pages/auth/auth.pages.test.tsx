import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import Signup from './Signup';
import VerifyEmail from './VerifyEmail';
import VerifyEmailPrompt from './VerifyEmailPrompt';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Auth Pages', () => {
  it('ForgotPassword renders and shows title', () => {
    wrap(<ForgotPassword />);
    expect(screen.getByText(/mot de passe oublié/i)).toBeInTheDocument();
  });

  it('ResetPassword renders without crashing', () => {
    wrap(<ResetPassword />);
    expect(document.body).toBeTruthy();
  });

  it('Signup renders without crashing', () => {
    wrap(<Signup />);
    expect(document.body).toBeTruthy();
  });

  it('VerifyEmailPrompt renders without crashing', () => {
    wrap(<VerifyEmailPrompt />);
    expect(document.body).toBeTruthy();
  });

  it('VerifyEmail renders without crashing', () => {
    wrap(<VerifyEmail />);
    expect(document.body).toBeTruthy();
  });
});
