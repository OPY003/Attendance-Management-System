import { Request, Response, NextFunction } from 'express';
import { authService } from './authService.js';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register({
        ...req.body,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.status(201).json({
        success: true,
        data: result,
        metadata: { message: 'Registration successful. Please verify your email.' },
      });
    } catch (err) {
      next(err);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = authService.verifyEmail(req.body.token, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const result = authService.resendVerification(req.body.email);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login({
        email: req.body.email,
        password: req.body.password,
        mfa_code: req.body.mfa_code,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = authService.forgotPassword(req.body.email);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPassword(req.body.token, req.body.new_password, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async setupMFA(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.setupMFA(req.user!.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async verifyMFA(req: Request, res: Response, next: NextFunction) {
    try {
      const result = authService.verifyAndEnableMFA(req.user!.id, req.body.totp_code, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async unlockAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const result = authService.unlockAccount(req.body.unlock_token, req.ip);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const result = authService.refreshToken(req.body.refresh_token);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
          tenantId: req.tenantId,
          userRole: req.userRole,
          userPermissions: req.userPermissions,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(_req: Request, res: Response) {
    res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
  },
};
