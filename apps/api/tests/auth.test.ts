import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { authenticator } from 'otplib';

const app = createApp();

describe('Auth & Account Lifecycle Test Suite', () => {
  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'Password123!',
    first_name: 'John',
    last_name: 'Doe',
    organization_name: 'Acme Test Corp',
    organization_category: 'CORPORATE',
  };

  let verificationToken: string;
  let resetToken: string;
  let accessToken: string;
  let mfaSecret: string;

  it('1. Should successfully register a new user and organization', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user_id).toBeDefined();
    expect(res.body.data.email_verification_token).toBeDefined();

    verificationToken = res.body.data.email_verification_token;
  });

  it('2. Should reject duplicate email registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('3. Should verify email with valid token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: verificationToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('4. Should successfully login and return tokens and memberships', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.access_token).toBeDefined();
    expect(res.body.data.tokens.refresh_token).toBeDefined();
    expect(res.body.data.memberships.length).toBeGreaterThan(0);

    accessToken = res.body.data.tokens.access_token;
  });

  it('5. Should get current user details via /auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it('6. Should lock account after 5 consecutive failed login attempts', async () => {
    const lockoutEmail = `lockout_${Date.now()}@example.com`;
    // Register user
    await request(app).post('/api/v1/auth/register').send({
      email: lockoutEmail,
      password: 'Password123!',
      first_name: 'Lock',
      last_name: 'Out',
    });

    // Attempt 1 to 4 failed logins
    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: lockoutEmail,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    // Attempt 5 should trigger account lockout
    const res5 = await request(app).post('/api/v1/auth/login').send({
      email: lockoutEmail,
      password: 'WrongPassword!',
    });
    expect(res5.status).toBe(403);
    expect(res5.body.error.code).toBe('ACCOUNT_LOCKED');

    // Attempt 6 with CORRECT password should still be locked
    const res6 = await request(app).post('/api/v1/auth/login').send({
      email: lockoutEmail,
      password: 'Password123!',
    });
    expect(res6.status).toBe(403);
    expect(res6.body.error.code).toBe('ACCOUNT_LOCKED');

    // Unlock via unlock token
    const unlockToken = res5.body.error.details.unlock_token;
    expect(unlockToken).toBeDefined();

    const unlockRes = await request(app).post('/api/v1/auth/unlock').send({
      unlock_token: unlockToken,
    });
    expect(unlockRes.status).toBe(200);

    // Now login with correct password should succeed
    const successRes = await request(app).post('/api/v1/auth/login').send({
      email: lockoutEmail,
      password: 'Password123!',
    });
    expect(successRes.status).toBe(200);
  });

  it('7. Should handle forgot password and reset password flow', async () => {
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: testUser.email });

    expect(forgotRes.status).toBe(200);
    resetToken = forgotRes.body.data.reset_token;
    expect(resetToken).toBeDefined();

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        new_password: 'NewPassword123!',
      });

    expect(resetRes.status).toBe(200);

    // Login with new password
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: 'NewPassword123!',
    });
    expect(loginRes.status).toBe(200);
    accessToken = loginRes.body.data.tokens.access_token;
  });

  it('8. Should set up and verify Multi-Factor Authentication (MFA)', async () => {
    const setupRes = await request(app)
      .post('/api/v1/auth/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data.secret).toBeDefined();
    expect(setupRes.body.data.qr_code).toBeDefined();

    mfaSecret = setupRes.body.data.secret;

    // Generate valid TOTP code
    const validTotp = authenticator.generate(mfaSecret);

    const verifyRes = await request(app)
      .post('/api/v1/auth/mfa/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ totp_code: validTotp });

    expect(verifyRes.status).toBe(200);

    // Next login should require MFA code
    const loginPromptRes = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: 'NewPassword123!',
    });
    expect(loginPromptRes.status).toBe(200);
    expect(loginPromptRes.body.data.mfa_required).toBe(true);

    // Login with TOTP code
    const loginWithMfaRes = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: 'NewPassword123!',
      mfa_code: authenticator.generate(mfaSecret),
    });
    expect(loginWithMfaRes.status).toBe(200);
    expect(loginWithMfaRes.body.data.tokens.access_token).toBeDefined();
  });
});
