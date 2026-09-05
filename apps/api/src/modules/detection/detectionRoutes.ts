import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { detectionService } from './detectionService.js';
import { evidenceEngine } from '../../engines/evidenceEngine.js';

const router = Router();

// 1. Generate Dynamic QR Code for a Session
router.post(
  '/qr/generate',
  authenticate,
  requireTenant,
  requirePermission('sessions:manage'),
  (req, res, next) => {
    try {
      const { session_id, validity_seconds } = req.body;
      const orgId = (req.tenantId || req.headers['x-organization-id']) as string;

      const result = detectionService.generateSessionQr(orgId, session_id, validity_seconds || 30);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Submit Multi-Modal Detection Telemetry (QR, GPS, Device)
router.post('/verify', authenticate, requireTenant, (req, res, next) => {
  try {
    const orgId = (req.tenantId || req.headers['x-organization-id']) as string;
    const { person_id, session_id, qr_token, gps, device, detection_method, timestamp } = req.body;

    const result = detectionService.verifyAndProcessDetection({
      organization_id: orgId,
      person_id,
      session_id,
      qr_token,
      gps,
      device,
      detection_method,
      timestamp,
    });

    res.status(200).json({
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Fetch Audit Evidence for an Attendance Record
router.get('/evidence/:recordId', authenticate, requireTenant, (req, res, next) => {
  try {
    const orgId = (req.tenantId || req.headers['x-organization-id']) as string;
    const { recordId } = req.params;

    const evidence = evidenceEngine.getEvidenceByRecordId(recordId, orgId);
    if (!evidence) {
      res.status(404).json({
        error: {
          code: 'EVIDENCE_NOT_FOUND',
          message: 'Evidence trail not found for this attendance record',
        },
      });
      return;
    }

    res.status(200).json({
      data: evidence,
    });
  } catch (err) {
    next(err);
  }
});

export const detectionRouter = router;
