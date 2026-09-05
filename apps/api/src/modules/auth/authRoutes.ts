import { Router } from 'express';
import { authController } from './authController.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validator.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';
import {
  RegisterUserSchema,
  LoginSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SetupMFASchema,
  UnlockAccountSchema,
} from '@uapms/validation';

export const authRouter = Router();

// Public routes with rate limiting
authRouter.post('/register', rateLimiter(60000, 10), validateBody(RegisterUserSchema), authController.register);
authRouter.post('/login', rateLimiter(60000, 20), validateBody(LoginSchema), authController.login);
authRouter.post('/verify-email', validateBody(VerifyEmailSchema), authController.verifyEmail);
authRouter.post('/resend-verification', rateLimiter(60000, 5), validateBody(ResendVerificationSchema), authController.resendVerification);
authRouter.post('/forgot-password', rateLimiter(60000, 5), validateBody(ForgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', rateLimiter(60000, 5), validateBody(ResetPasswordSchema), authController.resetPassword);
authRouter.post('/unlock', rateLimiter(60000, 5), validateBody(UnlockAccountSchema), authController.unlockAccount);
authRouter.post('/refresh', authController.refreshToken);

// Protected routes
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/mfa/setup', authenticate, authController.setupMFA);
authRouter.post('/mfa/verify', authenticate, validateBody(SetupMFASchema), authController.verifyMFA);
authRouter.post('/logout', authenticate, authController.logout);
