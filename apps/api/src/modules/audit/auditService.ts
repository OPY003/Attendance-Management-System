import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne } from '../../core/database/db.js';
import { logger } from '../../core/logger.js';

export interface RecordAuditParams {
  organization_id?: string;
  actor_id?: string;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state?: Record<string, any>;
  new_state?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  reason?: string;
}

export const auditService = {
  log(params: RecordAuditParams): string {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    let validUserId: string | null = null;
    let actorRole = params.actor_role || null;

    if (params.actor_id && params.actor_id !== 'system') {
      const user = queryOne('SELECT id FROM users WHERE id = ?', [params.actor_id]);
      if (user) {
        validUserId = params.actor_id;
      } else if (!actorRole) {
        actorRole = `DEVICE:${params.actor_id}`;
      }
    }

    try {
      execute(
        `INSERT INTO audit_logs (
          id, organization_id, actor_id, actor_role, action, entity_type, entity_id,
          previous_state, new_state, ip_address, user_agent, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          params.organization_id || null,
          validUserId,
          actorRole,
          params.action,
          params.entity_type,
          params.entity_id,
          params.previous_state ? JSON.stringify(params.previous_state) : null,
          params.new_state ? JSON.stringify(params.new_state) : null,
          params.ip_address || null,
          params.user_agent || null,
          params.reason || null,
          createdAt,
        ]
      );
      logger.info(`[AUDIT] ${params.action} on ${params.entity_type}:${params.entity_id} by ${params.actor_id || 'SYSTEM'}`);
      return id;
    } catch (err: any) {
      logger.error('Failed to write audit log', err, { params });
      return id;
    }
  },
};
