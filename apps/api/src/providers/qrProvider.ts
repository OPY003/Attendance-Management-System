import crypto from 'crypto';

export interface DynamicQrPayload {
  organization_id: string;
  session_id: string;
  nonce: string;
  issued_at: number; // Unix epoch ms
  expires_at: number; // Unix epoch ms
}

export interface QrVerificationResult {
  is_valid: boolean;
  reason?: string;
  payload?: DynamicQrPayload;
}

// In-memory nonce replay cache with timestamp cleanup
const usedNonces = new Map<string, { used_at: number; person_id: string; session_id: string }>();

// Clean up expired nonces every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of usedNonces.entries()) {
    if (now - data.used_at > 10 * 60 * 1000) {
      usedNonces.delete(nonce);
    }
  }
}, 5 * 60 * 1000).unref();

export class QrProvider {
  private secretKey: string;

  constructor(secretKey = process.env.QR_SIGNING_SECRET || 'uapms-secure-qr-default-secret-key-2026') {
    this.secretKey = secretKey;
  }

  /**
   * Generates a signed, time-bound Dynamic QR token
   * @param organizationId Organization Tenant ID
   * @param sessionId Active Attendance Session ID
   * @param validitySeconds Lifetime of the dynamic token (default 30 seconds)
   */
  public generateDynamicToken(
    organizationId: string,
    sessionId: string,
    validitySeconds = 30
  ): { token: string; qrPayload: DynamicQrPayload } {
    const now = Date.now();
    const expiresAt = now + validitySeconds * 1000;
    const nonce = crypto.randomBytes(16).toString('hex');

    const qrPayload: DynamicQrPayload = {
      organization_id: organizationId,
      session_id: sessionId,
      nonce,
      issued_at: now,
      expires_at: expiresAt,
    };

    const payloadString = JSON.stringify(qrPayload);
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payloadString)
      .digest('hex');

    // Token format: base64(payload).signature
    const base64Payload = Buffer.from(payloadString, 'utf-8').toString('base64url');
    const token = `${base64Payload}.${signature}`;

    return { token, qrPayload };
  }

  /**
   * Validates a dynamic QR token, checks signature, expiration, and ensures anti-replay protection
   */
  public verifyDynamicToken(
    token: string,
    expectedOrgId: string,
    expectedSessionId?: string,
    personId?: string
  ): QrVerificationResult {
    if (!token || typeof token !== 'string') {
      return { is_valid: false, reason: 'Invalid or missing QR token format' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { is_valid: false, reason: 'Malformed QR token structure' };
    }

    const [base64Payload, signature] = parts;

    try {
      const payloadString = Buffer.from(base64Payload, 'base64url').toString('utf-8');
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(payloadString)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        return { is_valid: false, reason: 'Cryptographic signature mismatch: QR code is invalid or tampered' };
      }

      const payload: DynamicQrPayload = JSON.parse(payloadString);

      // Check organization binding
      if (payload.organization_id !== expectedOrgId) {
        return { is_valid: false, reason: 'QR code belongs to a different organization' };
      }

      // Check session binding if provided
      if (expectedSessionId && payload.session_id !== expectedSessionId) {
        return { is_valid: false, reason: 'QR code was issued for a different session' };
      }

      // Check expiration
      const now = Date.now();
      if (now > payload.expires_at) {
        return { is_valid: false, reason: 'QR code has expired. Please refresh the QR screen' };
      }

      // Check replay / single-use anti-screenshot protection
      if (usedNonces.has(payload.nonce)) {
        return { is_valid: false, reason: 'Replay detected: QR code has already been redeemed' };
      }

      // Mark nonce as used if personId provided
      if (personId) {
        usedNonces.set(payload.nonce, {
          used_at: now,
          person_id: personId,
          session_id: payload.session_id,
        });
      }

      return { is_valid: true, payload };
    } catch (err: any) {
      return { is_valid: false, reason: `Failed to decode QR token: ${err.message}` };
    }
  }

  /**
   * Clears nonce cache (useful for testing)
   */
  public clearNonceCache(): void {
    usedNonces.clear();
  }
}

export const qrProvider = new QrProvider();
