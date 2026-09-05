import crypto from 'crypto';

export type KioskState = 'IDLE' | 'AWAITING_SCAN' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'TIMEOUT';

export interface KioskSession {
  session_id: string;
  device_id: string;
  organization_id: string;
  location_id?: string;
  current_state: KioskState;
  last_scan_at?: number;
  last_person_id?: string;
  cooldown_seconds: number;
  timeout_seconds: number;
}

export interface KioskScanAttemptResult {
  allowed: boolean;
  state: KioskState;
  reason?: string;
  wait_seconds?: number;
}

class KioskProvider {
  private activeKiosks = new Map<string, KioskSession>();

  /**
   * Initializes or refreshes a physical kiosk session
   */
  public initializeKiosk(
    deviceId: string,
    organizationId: string,
    locationId?: string,
    cooldownSeconds = 5,
    timeoutSeconds = 30
  ): KioskSession {
    const sessionId = crypto.randomUUID();
    const kiosk: KioskSession = {
      session_id: sessionId,
      device_id: deviceId,
      organization_id: organizationId,
      location_id: locationId,
      current_state: 'IDLE',
      cooldown_seconds: cooldownSeconds,
      timeout_seconds: timeoutSeconds,
    };

    this.activeKiosks.set(deviceId, kiosk);
    return kiosk;
  }

  /**
   * Validates if a new scan attempt on the kiosk is permitted (guards against rapid double-tapping & queue jamming)
   */
  public attemptScan(deviceId: string, personId: string): KioskScanAttemptResult {
    const kiosk = this.activeKiosks.get(deviceId);
    if (!kiosk) {
      return {
        allowed: false,
        state: 'ERROR',
        reason: 'Kiosk session not initialized or device offline',
      };
    }

    const now = Date.now();

    // Check same-person cooldown
    if (kiosk.last_person_id === personId && kiosk.last_scan_at) {
      const elapsedSeconds = (now - kiosk.last_scan_at) / 1000;
      if (elapsedSeconds < kiosk.cooldown_seconds) {
        const remaining = Math.ceil(kiosk.cooldown_seconds - elapsedSeconds);
        return {
          allowed: false,
          state: 'ERROR',
          reason: `Rapid scan detected: please wait ${remaining}s before rescanning`,
          wait_seconds: remaining,
        };
      }
    }

    // Advance kiosk state to processing
    kiosk.current_state = 'PROCESSING';
    kiosk.last_scan_at = now;
    kiosk.last_person_id = personId;

    return {
      allowed: true,
      state: 'PROCESSING',
    };
  }

  /**
   * Completes a kiosk scan transaction
   */
  public completeScan(deviceId: string, success: boolean): void {
    const kiosk = this.activeKiosks.get(deviceId);
    if (kiosk) {
      kiosk.current_state = success ? 'SUCCESS' : 'ERROR';
      // Reset back to idle after 2 seconds
      setTimeout(() => {
        if (this.activeKiosks.has(deviceId)) {
          this.activeKiosks.get(deviceId)!.current_state = 'IDLE';
        }
      }, 2000).unref();
    }
  }

  /**
   * Gets current kiosk state
   */
  public getKiosk(deviceId: string): KioskSession | undefined {
    return this.activeKiosks.get(deviceId);
  }
}

export const kioskProvider = new KioskProvider();
