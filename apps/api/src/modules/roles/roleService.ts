import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, transaction } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';
import { Role, Permission } from '@uapms/shared-types';

export const roleService = {
  /**
   * Lists all available permissions grouped by module
   */
  listPermissions(): Permission[] {
    return query<Permission>('SELECT id, code, name, description, module FROM permissions ORDER BY module, code');
  },

  /**
   * Lists roles available to the organization (system roles + tenant-specific custom roles)
   */
  listRoles(organizationId?: string): Role[] {
    let sql = 'SELECT * FROM roles WHERE is_system_role = 1';
    const params: any[] = [];

    if (organizationId) {
      sql += ' OR organization_id = ?';
      params.push(organizationId);
    }
    sql += ' ORDER BY is_system_role DESC, name ASC';

    const roles = query<any>(sql, params);
    return roles.map((r) => {
      const perms = query<{ code: string }>(
        `SELECT p.code FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ?`,
        [r.id]
      ).map((p) => p.code);

      return {
        id: r.id,
        organization_id: r.organization_id,
        code: r.code,
        name: r.name,
        description: r.description,
        is_system_role: Boolean(r.is_system_role),
        permissions: perms,
        created_at: r.created_at,
      };
    });
  },

  /**
   * Creates a custom role for an organization
   */
  createRole(params: {
    organization_id: string;
    code: string;
    name: string;
    description?: string;
    permission_ids: string[];
    actor_id: string;
  }): Role {
    const existing = queryOne('SELECT id FROM roles WHERE organization_id = ? AND code = ?', [
      params.organization_id,
      params.code.toUpperCase(),
    ]);

    if (existing) {
      throw new AppError(`Role code "${params.code}" already exists in this organization`, 409, 'ROLE_CODE_EXISTS');
    }

    const roleId = uuidv4();
    const now = new Date().toISOString();

    return transaction((_db) => {
      execute(
        `INSERT INTO roles (id, organization_id, code, name, description, is_system_role, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [roleId, params.organization_id, params.code.toUpperCase(), params.name, params.description || null, now]
      );

      for (const permId of params.permission_ids) {
        execute('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId]);
      }

      auditService.log({
        organization_id: params.organization_id,
        actor_id: params.actor_id,
        action: 'ROLE_CREATED',
        entity_type: 'ROLE',
        entity_id: roleId,
        new_state: { code: params.code, name: params.name, permissions: params.permission_ids },
      });

      return {
        id: roleId,
        organization_id: params.organization_id,
        code: params.code.toUpperCase(),
        name: params.name,
        description: params.description,
        is_system_role: false,
        permissions: params.permission_ids,
        created_at: now,
      };
    });
  },
};
