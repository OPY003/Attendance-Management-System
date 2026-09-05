import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'uapms_super_secure_jwt_secret_key_change_in_production_min_32_chars_long',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'uapms_super_secure_refresh_secret_key_change_in_production_min_32',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  auth: {
    passwordHashRounds: parseInt(process.env.PASSWORD_HASH_ROUNDS || '10', 10),
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    mfaIssuer: process.env.MFA_ISSUER || 'UAPMS',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
  },
  geolocation: {
    toleranceMeters: parseFloat(process.env.GEOLOCATION_TOLERANCE_METERS || '15'),
  },
};
