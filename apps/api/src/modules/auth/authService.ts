import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../../config/index.js';
import { queryOne, execute, transaction, query } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';
import { AuthTokens, AuthUserPayload } from '@uapms/shared-types';

export const authService = {
  /**
   * Generates Access and Refresh tokens for a user
   */
  generateTokens(user: { id: string; email: string }): AuthTokens {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, email: user.email, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any }
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900, // 15 minutes in seconds
    };
  },

  /**
   * Registers a new user and optionally creates an initial organization
   */
  async register(params: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    organization_name?: string;
    organization_category?: string;
    ip_address?: string;
    user_agent?: string;
  }) {
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [params.email.toLowerCase().trim()]);
    if (existing) {
      throw new AppError('Email address is already registered', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(params.password, config.auth.passwordHashRounds);
    const emailVerificationToken = uuidv4();
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    const now = new Date().toISOString();

    return transaction((_db) => {
      execute(
        `INSERT INTO users (
          id, email, password_hash, first_name, last_name, is_email_verified,
          email_verification_token, email_verification_expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [
          userId,
          params.email.toLowerCase().trim(),
          passwordHash,
          params.first_name,
          params.last_name,
          emailVerificationToken,
          verificationExpiresAt,
          now,
          now,
        ]
      );

      let orgId: string | undefined;

      // If organization name provided, create organization and set user as OrganizationOwner
      if (params.organization_name) {
        orgId = uuidv4();
        const slug = params.organization_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + orgId.substring(0, 4);
        
        execute(
          `INSERT INTO organizations (id, slug, name, category, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          [orgId, slug, params.organization_name, params.organization_category || 'CORPORATE', now, now]
        );

        execute(
          `INSERT INTO organization_settings (organization_id, default_timezone, default_language)
           VALUES (?, 'UTC', 'en')`,
          [orgId]
        );

        // Find or create OrganizationOwner role
        let ownerRole = queryOne<any>('SELECT id FROM roles WHERE code = ? AND organization_id IS NULL', ['ORGANIZATION_OWNER']);
        if (!ownerRole) {
          const roleId = uuidv4();
          execute(
            `INSERT INTO roles (id, code, name, description, is_system_role, created_at)
             VALUES (?, 'ORGANIZATION_OWNER', 'Organization Owner', 'Full control over the organization', 1, ?)`,
            [roleId, now]
          );
          ownerRole = { id: roleId };
        }

        // Create Person entity for user in this organization
        const personId = uuidv4();
        execute(
          `INSERT INTO persons (id, organization_id, user_id, person_code, first_name, last_name, email, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          [personId, orgId, userId, 'OWNER-001', params.first_name, params.last_name, params.email.toLowerCase().trim(), now, now]
        );

        // Create membership
        execute(
          `INSERT INTO organization_memberships (id, organization_id, user_id, person_id, role_id, status, joined_at)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
          [uuidv4(), orgId, userId, personId, ownerRole.id, now]
        );
      }

      auditService.log({
        organization_id: orgId,
        actor_id: userId,
        action: 'USER_REGISTERED',
        entity_type: 'USER',
        entity_id: userId,
        ip_address: params.ip_address,
        user_agent: params.user_agent,
      });

      return {
        user_id: userId,
        email: params.email,
        email_verification_token: emailVerificationToken,
        organization_id: orgId,
      };
    });
  },

  /**
   * Verifies an email token
   */
  verifyEmail(token: string, ipAddress?: string) {
    const user = queryOne<any>(
      `SELECT id, email, is_email_verified, email_verification_expires_at 
       FROM users WHERE email_verification_token = ?`,
      [token]
    );

    if (!user) {
      throw new AppError('Invalid email verification token', 400, 'INVALID_VERIFICATION_TOKEN');
    }

    if (user.is_email_verified) {
      return { message: 'Email already verified' };
    }

    if (user.email_verification_expires_at && new Date(user.email_verification_expires_at) < new Date()) {
      throw new AppError('Verification token has expired. Please request a new one.', 400, 'VERIFICATION_TOKEN_EXPIRED');
    }

    execute(
      `UPDATE users 
       SET is_email_verified = 1, email_verification_token = NULL, email_verification_expires_at = NULL, updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), user.id]
    );

    auditService.log({
      actor_id: user.id,
      action: 'EMAIL_VERIFIED',
      entity_type: 'USER',
      entity_id: user.id,
      ip_address: ipAddress,
    });

    return { message: 'Email verified successfully' };
  },

  /**
   * Resends verification email
   */
  resendVerification(email: string) {
    const user = queryOne<any>('SELECT id, is_email_verified FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      // Return success to avoid email enumeration
      return { message: 'If the email exists, a verification link has been sent' };
    }

    if (user.is_email_verified) {
      return { message: 'Email is already verified' };
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    execute(
      `UPDATE users SET email_verification_token = ?, email_verification_expires_at = ?, updated_at = ? WHERE id = ?`,
      [token, expiresAt, new Date().toISOString(), user.id]
    );

    return {
      message: 'Verification link sent',
      verification_token: token, // Returned for dev/testing simulator
    };
  },

  /**
   * Authenticates user with email and password, handling lockouts and MFA
   */
  async login(params: {
    email: string;
    password: string;
    mfa_code?: string;
    ip_address?: string;
    user_agent?: string;
  }) {
    const user = queryOne<any>(
      `SELECT id, email, password_hash, first_name, last_name, is_email_verified,
              mfa_enabled, mfa_secret, failed_login_attempts, locked_until, is_active
       FROM users WHERE email = ?`,
      [params.email.toLowerCase().trim()]
    );

    if (!user || !user.is_active) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
      throw new AppError(
        `Account is locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minutes or unlock via email.`,
        403,
        'ACCOUNT_LOCKED',
        { minutes_remaining: minutesRemaining }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(params.password, user.password_hash);
    if (!isPasswordValid) {
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil: string | null = null;
      let unlockToken: string | null = null;

      if (newFailedAttempts >= config.auth.maxFailedLoginAttempts) {
        lockedUntil = new Date(Date.now() + config.auth.lockoutDurationMinutes * 60 * 1000).toISOString();
        unlockToken = uuidv4();

        auditService.log({
          actor_id: user.id,
          action: 'ACCOUNT_LOCKED',
          entity_type: 'USER',
          entity_id: user.id,
          ip_address: params.ip_address,
          user_agent: params.user_agent,
          reason: `Locked after ${newFailedAttempts} failed password attempts`,
        });
      }

      execute(
        `UPDATE users SET failed_login_attempts = ?, locked_until = ?, unlock_token = ?, updated_at = ? WHERE id = ?`,
        [newFailedAttempts, lockedUntil, unlockToken, new Date().toISOString(), user.id]
      );

      if (lockedUntil) {
        throw new AppError(
          `Account locked for ${config.auth.lockoutDurationMinutes} minutes due to ${newFailedAttempts} failed login attempts.`,
          403,
          'ACCOUNT_LOCKED',
          { unlock_token: unlockToken }
        );
      }

      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check Multi-Factor Authentication if enabled
    if (user.mfa_enabled) {
      if (!params.mfa_code) {
        return {
          mfa_required: true,
          message: 'Multi-factor authentication code required',
        };
      }

      const isMfaValid = authenticator.check(params.mfa_code, user.mfa_secret || '');
      if (!isMfaValid) {
        throw new AppError('Invalid MFA verification code', 401, 'INVALID_MFA_CODE');
      }
    }

    // Reset failed login attempts on successful authentication
    execute(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, unlock_token = NULL, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), user.id]
    );

    // Fetch user memberships and roles
    const memberships = query<any>(
      `SELECT om.id, om.organization_id, om.role_id, om.status, om.joined_at,
              o.name as organization_name, o.slug as organization_slug,
              r.code as role_code, r.name as role_name
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.organization_id
       JOIN roles r ON r.id = om.role_id
       WHERE om.user_id = ? AND om.status = 'ACTIVE'`,
      [user.id]
    );

    const tokens = this.generateTokens(user);

    auditService.log({
      actor_id: user.id,
      action: 'USER_LOGIN',
      entity_type: 'USER',
      entity_id: user.id,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_email_verified: Boolean(user.is_email_verified),
        mfa_enabled: Boolean(user.mfa_enabled),
      },
      memberships,
      tokens,
    };
  },

  /**
   * Generates a password reset token
   */
  forgotPassword(email: string) {
    const user = queryOne<any>('SELECT id, email FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return { message: 'If the email exists, a password reset link has been sent' };
    }

    const resetToken = uuidv4();
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    execute(
      `UPDATE users SET reset_password_token = ?, reset_password_expires_at = ?, updated_at = ? WHERE id = ?`,
      [resetToken, resetExpiresAt, new Date().toISOString(), user.id]
    );

    auditService.log({
      actor_id: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity_type: 'USER',
      entity_id: user.id,
    });

    return {
      message: 'Password reset link sent',
      reset_token: resetToken, // Returned for dev/testing simulator
    };
  },

  /**
   * Resets password using valid reset token
   */
  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    const user = queryOne<any>(
      `SELECT id, reset_password_expires_at FROM users WHERE reset_password_token = ?`,
      [token]
    );

    if (!user) {
      throw new AppError('Invalid password reset token', 400, 'INVALID_RESET_TOKEN');
    }

    if (user.reset_password_expires_at && new Date(user.reset_password_expires_at) < new Date()) {
      throw new AppError('Password reset token has expired', 400, 'RESET_TOKEN_EXPIRED');
    }

    const passwordHash = await bcrypt.hash(newPassword, config.auth.passwordHashRounds);

    execute(
      `UPDATE users 
       SET password_hash = ?, reset_password_token = NULL, reset_password_expires_at = NULL,
           failed_login_attempts = 0, locked_until = NULL, updated_at = ?
       WHERE id = ?`,
      [passwordHash, new Date().toISOString(), user.id]
    );

    auditService.log({
      actor_id: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entity_type: 'USER',
      entity_id: user.id,
      ip_address: ipAddress,
    });

    return { message: 'Password has been reset successfully' };
  },

  /**
   * Sets up Multi-Factor Authentication (generates secret and QR code)
   */
  async setupMFA(userId: string) {
    const secret = authenticator.generateSecret();
    const user = queryOne<any>('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const otpauth = authenticator.keyuri(user.email, config.auth.mfaIssuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    execute('UPDATE users SET mfa_secret = ?, updated_at = ? WHERE id = ?', [secret, new Date().toISOString(), userId]);

    return {
      secret,
      qr_code: qrCodeDataUrl,
      otpauth_url: otpauth,
    };
  },

  /**
   * Verifies and enables MFA
   */
  verifyAndEnableMFA(userId: string, code: string, ipAddress?: string) {
    const user = queryOne<any>('SELECT id, mfa_secret FROM users WHERE id = ?', [userId]);
    if (!user || !user.mfa_secret) {
      throw new AppError('MFA setup not initialized', 400, 'MFA_NOT_INITIALIZED');
    }

    const isValid = authenticator.check(code, user.mfa_secret);
    if (!isValid) {
      throw new AppError('Invalid MFA verification code', 400, 'INVALID_MFA_CODE');
    }

    execute('UPDATE users SET mfa_enabled = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), userId]);

    auditService.log({
      actor_id: userId,
      action: 'MFA_ENABLED',
      entity_type: 'USER',
      entity_id: userId,
      ip_address: ipAddress,
    });

    return { message: 'MFA has been successfully verified and enabled' };
  },

  /**
   * Unlocks account with token
   */
  unlockAccount(unlockToken: string, ipAddress?: string) {
    const user = queryOne<any>('SELECT id FROM users WHERE unlock_token = ?', [unlockToken]);
    if (!user) {
      throw new AppError('Invalid unlock token', 400, 'INVALID_UNLOCK_TOKEN');
    }

    execute(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, unlock_token = NULL, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), user.id]
    );

    auditService.log({
      actor_id: user.id,
      action: 'ACCOUNT_UNLOCKED',
      entity_type: 'USER',
      entity_id: user.id,
      ip_address: ipAddress,
    });

    return { message: 'Account has been unlocked successfully' };
  },

  /**
   * Refreshes access token
   */
  refreshToken(token: string) {
    try {
      const payload = jwt.verify(token, config.jwt.refreshSecret) as any;
      if (payload.type !== 'refresh') {
        throw new AppError('Invalid token type', 401, 'INVALID_TOKEN');
      }

      const user = queryOne<any>('SELECT id, email, is_active FROM users WHERE id = ?', [payload.sub]);
      if (!user || !user.is_active) {
        throw new AppError('User not found or inactive', 401, 'ACCOUNT_INACTIVE');
      }

      return this.generateTokens(user);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
  },
};
