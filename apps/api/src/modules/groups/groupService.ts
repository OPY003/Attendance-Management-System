import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, transaction } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';
import { Department, Group } from '@uapms/shared-types';

export const groupService = {
  // ==========================================
  // DEPARTMENTS
  // ==========================================

  listDepartments(organizationId: string): Department[] {
    return query<Department>(
      `SELECT d.*, p.first_name as manager_first_name, p.last_name as manager_last_name
       FROM departments d
       LEFT JOIN persons p ON p.id = d.manager_person_id
       WHERE d.organization_id = ?
       ORDER BY d.name ASC`,
      [organizationId]
    );
  },

  createDepartment(params: {
    organization_id: string;
    parent_id?: string | null;
    name: string;
    code: string;
    manager_person_id?: string | null;
    actor_id: string;
  }): Department {
    const existing = queryOne('SELECT id FROM departments WHERE organization_id = ? AND code = ?', [
      params.organization_id,
      params.code,
    ]);
    if (existing) {
      throw new AppError(`Department code "${params.code}" already exists in this organization`, 409, 'DEPARTMENT_CODE_EXISTS');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO departments (id, organization_id, parent_id, name, code, manager_person_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, params.organization_id, params.parent_id || null, params.name, params.code, params.manager_person_id || null, now]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'DEPARTMENT_CREATED',
      entity_type: 'DEPARTMENT',
      entity_id: id,
    });

    return queryOne<Department>('SELECT * FROM departments WHERE id = ?', [id])!;
  },

  // ==========================================
  // GROUPS / CLASSES / TEAMS
  // ==========================================

  listGroups(organizationId: string, departmentId?: string): Group[] {
    let sql = `SELECT g.*, d.name as department_name, p.first_name as leader_first_name, p.last_name as leader_last_name,
                      (SELECT COUNT(*) FROM group_memberships gm WHERE gm.group_id = g.id) as member_count
               FROM groups g
               LEFT JOIN departments d ON d.id = g.department_id
               LEFT JOIN persons p ON p.id = g.leader_person_id
               WHERE g.organization_id = ?`;
    const params: any[] = [organizationId];

    if (departmentId) {
      sql += ' AND g.department_id = ?';
      params.push(departmentId);
    }
    sql += ' ORDER BY g.name ASC';

    return query<Group>(sql, params);
  },

  createGroup(params: {
    organization_id: string;
    department_id?: string | null;
    name: string;
    code: string;
    group_type: 'CLASS' | 'TEAM' | 'PROJECT' | 'BATCH' | 'CUSTOM';
    leader_person_id?: string | null;
    actor_id: string;
  }): Group {
    const existing = queryOne('SELECT id FROM groups WHERE organization_id = ? AND code = ?', [
      params.organization_id,
      params.code,
    ]);
    if (existing) {
      throw new AppError(`Group code "${params.code}" already exists in this organization`, 409, 'GROUP_CODE_EXISTS');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    execute(
      `INSERT INTO groups (id, organization_id, department_id, name, code, group_type, leader_person_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, params.organization_id, params.department_id || null, params.name, params.code, params.group_type, params.leader_person_id || null, now]
    );

    auditService.log({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      action: 'GROUP_CREATED',
      entity_type: 'GROUP',
      entity_id: id,
    });

    return queryOne<Group>('SELECT * FROM groups WHERE id = ?', [id])!;
  },

  enrollMembers(params: {
    organization_id: string;
    group_id: string;
    person_ids: string[];
    role_in_group?: string;
    actor_id: string;
  }) {
    const group = queryOne<any>('SELECT id FROM groups WHERE id = ? AND organization_id = ?', [
      params.group_id,
      params.organization_id,
    ]);
    if (!group) throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');

    const now = new Date().toISOString();

    return transaction((_db) => {
      let enrolledCount = 0;
      for (const personId of params.person_ids) {
        const id = uuidv4();
        const res = execute(
          `INSERT INTO group_memberships (id, group_id, person_id, role_in_group, joined_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(group_id, person_id) DO UPDATE SET
            role_in_group = excluded.role_in_group`,
          [id, params.group_id, personId, params.role_in_group || 'MEMBER', now]
        );
        if (res.changes > 0) enrolledCount++;
      }

      auditService.log({
        organization_id: params.organization_id,
        actor_id: params.actor_id,
        action: 'GROUP_MEMBERS_ENROLLED',
        entity_type: 'GROUP',
        entity_id: params.group_id,
        new_state: { enrolled_count: enrolledCount },
      });

      return {
        message: `Successfully enrolled ${enrolledCount} members into group`,
        group_id: params.group_id,
      };
    });
  },

  listGroupMembers(organization_id: string, groupId: string) {
    const group = queryOne<any>('SELECT id FROM groups WHERE id = ? AND organization_id = ?', [
      groupId,
      organization_id,
    ]);
    if (!group) throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');

    return query<any>(
      `SELECT p.id, p.person_code, p.first_name, p.last_name, p.email, p.status, gm.role_in_group, gm.joined_at
       FROM group_memberships gm
       JOIN persons p ON p.id = gm.person_id
       WHERE gm.group_id = ?
       ORDER BY p.last_name ASC, p.first_name ASC`,
      [groupId]
    );
  },
};
