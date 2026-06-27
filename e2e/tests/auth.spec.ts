import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('Route protection: Redirects to login when unauthenticated', async ({ page }) => {
    // Attempt to navigate to a protected route directly
    await page.goto('/dashboard');
    
    // We expect the app to immediately redirect to /login (or /) 
    // In this app, unauthenticated users go to login or home. 
    // Wait for the URL to change to the login page or the home page
    await expect(page).toHaveURL(/.*\/login|.*\//);
    
    // Ensure the login form or the landing page is visible
    const loginTitle = page.getByRole('heading', { name: 'Se connecter', exact: true });
    const accueilTitle = page.getByText('Se connecter', { exact: true });
    
    await expect(loginTitle.or(accueilTitle)).toBeVisible();
  });

  test('Complete login flow with mocked API', async ({ page }) => {
    // Mock the backend API response for login
    await page.route('**/auth/login', async route => {
      const json = {
        access_token: 'fake-jwt-token',
        refresh_token: 'fake-refresh-token',
        user: {
          id: '123',
          email: 'admin@comptabli.com',
          role: 'ADMIN',
          firstName: 'Admin',
          lastName: 'System'
        }
      };
      await route.fulfill({ json });
    });

    // Go to the login page
    await page.goto('/login');

    // Fill the email and password fields
    await page.getByPlaceholder('Foulen@gmail.com').fill('admin@comptabli.com');
    await page.getByPlaceholder('••••••••').fill('password123');

    // Check the "Je ne suis pas un robot" checkbox
    // In the UI, it's a checkbox hidden visually but clickable via label
    await page.locator('.auth-captcha-label').click();

    // Click the submit button
    await page.getByRole('button', { name: /Se connecter/i }).click();

    // After successful login, the app should redirect to the dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify that the Dashboard rendered by checking for a known dashboard element
    await expect(page.getByRole('heading', { name: /Tableau de bord/i })).toBeVisible({ timeout: 10000 });
  });

  test('Login error handling (invalid credentials)', async ({ page }) => {
    // Mock the backend API response to return a 401 Unauthorized
    await page.route('**/auth/login', async route => {
      const json = {
        message: 'Identifiants incorrects ou compte non validé',
        error: 'Unauthorized',
        statusCode: 401
      };
      await route.fulfill({ status: 401, json });
    });

    await page.goto('/login');

    await page.getByPlaceholder('Foulen@gmail.com').fill('wrong@comptabli.com');
    await page.getByPlaceholder('••••••••').fill('badpassword');
    await page.locator('.auth-captcha-label').click();

    await page.getByRole('button', { name: /Se connecter/i }).click();

    // Verify the error message is displayed in the UI
    await expect(page.getByText('Identifiants incorrects ou compte non validé')).toBeVisible();

    // Ensure we are still on the login page
    await expect(page).toHaveURL(/.*\/login/);
  });
});
