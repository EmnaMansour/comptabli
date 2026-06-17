import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./lib/api/reviewContactService', () => ({
  fetchNetworkingProfiles: jest.fn().mockResolvedValue([]),
  fetchMyAccountants: jest.fn().mockResolvedValue([]),
}));

// Mock matchMedia which is not present in JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('App', () => {
  it('renders without crashing', async () => {
    // The App component renders NetworkingPage by default on the root route
    render(<App />);
    expect(await screen.findByText('Networking')).toBeInTheDocument();
  });
});
