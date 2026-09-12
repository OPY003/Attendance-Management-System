import { CustomFieldValue, Person } from '@uapms/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { execute, query, queryOne, transaction } from '../../core/database/db.js';
import { AppError } from '../../middleware/errorHandler.js';
import { auditService } from '../audit/auditService.js';

export interface ListPersonsFilter {
  organization_id: string;
  search?: string;
  department_id?: string;
  location_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const personService = {
  /**
   * Lists persons in an organization with filtering, search and pagination
   */
  listPersons(filter: ListPersonsFilter) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const offset = (page - 1) * limit;

    let sql = `SELECT p.*, d.name as department_name, l.name as location_name
               FROM persons p
               LEFT JOIN departments d ON d.id = p.primary_department_id
               LEFT JOIN locations l ON l.id = p.primary_location_id
               WHERE p.organization_id = ?`;
    const params: any[] = [filter.organization_id];

    if (filter.status) {
      sql += ' AND p.status = ?';
      params.push(filter.status);
    }

    if (filter.department_id) {
      sql += ' AND p.primary_department_id = ?';
      params.push(filter.department_id);
    }

    if (filter.location_id) {
      sql += ' AND p.primary_location_id = ?';
      params.push(filter.location_id);
    }

    if (filter.search) {
      sql += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.person_code LIKE ? OR p.email LIKE ?)`;
      const s = `%${filter.search}%`;
      params.push(s, s, s, s);
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const countRes = queryOne<{ total: number }>(countSql, params);
    const total = countRes ? countRes.total : 0;

    sql += ' ORDER BY p.last_name ASC, p.first_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = query<any>(sql, params);

    const persons = rows.map((r) => {
      // Get person roles
      const roles = query<any>(
        `SELECT r.id, r.code, r.name FROM roles r
         JOIN person_roles pr ON pr.role_id = r.id
         WHERE pr.person_id = ?`,
        [r.id]
      );

      return {
        id: r.id,
        organization_id: r.organization_id,
        user_id: r.user_id,
        person_code: r.person_code,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        national_id: r.national_id,
        status: r.status,
        avatar_url: r.avatar_url,
        primary_department_id: r.primary_department_id,
        department_name: r.department_name,
        primary_location_id: r.primary_location_id,
        location_name: r.location_name,
        roles,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    return {
      items: persons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Retrieves single person by ID with roles, groups and custom fields
   */
  getPersonById(organization_id: string, personId: string) {
    const person = queryOne<any>(
      `SELECT p.*, d.name as department_name, l.name as location_name
       FROM persons p
       LEFT JOIN departments d ON d.id = p.primary_department_id
       LEFT JOIN locations l ON l.id = p.primary_location_id
       WHERE p.id = ? AND p.organization_id = ?`,
      [personId, organization_id]
    );

    if (!person) return undefined;

    const roles = query<any>(
      `SELECT r.id, r.code, r.name FROM roles r
       JOIN person_roles pr ON pr.role_id = r.id
       WHERE pr.person_id = ?`,
      [person.id]
    );

    const groups = query<any>(
      `SELECT g.id, g.name, g.code, g.group_type, gm.role_in_group
       FROM groups g
       JOIN group_memberships gm ON gm.group_id = g.id
       WHERE gm.person_id = ?`,
      [person.id]
    );

    const customFields = query<CustomFieldValue>(
      `SELECT cfv.field_key, cfv.value, cfd.field_label, cfd.field_type
       FROM custom_field_values cfv
       JOIN custom_field_definitions cfd ON cfd.organization_id = cfv.organization_id AND cfd.field_key = cfv.field_key
       WHERE cfv.organization_id = ? AND cfv.entity_type = 'PERSON' AND cfv.entity_id = ?`,
      [organization_id, person.id]
    );

    return {
      ...person,
      roles,
      groups,
      custom_fields: customFields,
      metadata: person.metadata ? JSON.parse(person.metadata) : undefined,
    };
  },

  /**
   * Creates a new Person in the organization
   */
  createPerson(params: {
    organization_id: string;
    person_code: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    national_id?: string;
    status?: string;
    primary_department_id?: string;
    primary_location_id?: string;
    metadata?: Record<string, any>;
    roles?: string[];
    actor_id: string;
  }) {
    const existing = queryOne(
      'SELECT id FROM persons WHERE organization_id = ? AND person_code = ?',
      [params.organization_id, params.person_code]
    );

    if (existing) {
      throw new AppError(`Person with code "${params.person_code}" already exists in this organization`, 409, 'PERSON_CODE_EXISTS');
    }

    const personId = uuidv4();
    const now = new Date().toISOString();

    return transaction((_db) => {
      execute(
        `INSERT INTO persons (
          id, organization_id, person_code, first_name, last_name, email, phone,
          national_id, status, primary_department_id, primary_location_id, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          personId,
          params.organization_id,
          params.person_code,
          params.first_name,
          params.last_name,
          params.email || null,
          params.phone || null,
          params.national_id || null,
          params.status || 'ACTIVE',
          params.primary_department_id || null,
          params.primary_location_id || null,
          params.metadata ? JSON.stringify(params.metadata) : null,
          now,
          now,
        ]
      );

      if (params.roles && params.roles.length > 0) {
        for (const roleId of params.roles) {
          execute(
            'INSERT OR IGNORE INTO person_roles (person_id, role_id, organization_id) VALUES (?, ?, ?)',
            [personId, roleId, params.organization_id]
          );
        }
      }

      auditService.log({
        organization_id: params.organization_id,
        actor_id: params.actor_id,
        action: 'PERSON_CREATED',
        entity_type: 'PERSON',
        entity_id: personId,
        new_state: { person_code: params.person_code, name: `${params.first_name} ${params.last_name}` },
      });

      return this.getPersonById(params.organization_id, personId);
    });
  },

  bulkCreatePersons(params: {
    organization_id: string;
    persons: Array<{
      person_code: string;
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      national_id?: string;
      status?: string;
      primary_department_id?: string;
      primary_location_id?: string;
      metadata?: Record<string, any>;
      roles?: string[];
    }>;
    actor_id: string;
  }) {
    const codes = new Set<string>();
    for (const person of params.persons) {
      if (codes.has(person.person_code)) {
        throw new AppError(`Person code "${person.person_code}" is duplicated in the import`, 409, 'PERSON_CODE_DUPLICATE_IMPORT');
      }
      codes.add(person.person_code);
    }

    const existing = query<any>(
      `SELECT person_code FROM persons WHERE organization_id = ? AND person_code IN (${params.persons.map(() => '?').join(',')})`,
      [params.organization_id, ...codes]
    );
    if (existing.length > 0) {
      throw new AppError(`Person code "${existing[0].person_code}" already exists in this organization`, 409, 'PERSON_CODE_EXISTS');
    }

    const now = new Date().toISOString();
    const createdIds: string[] = [];

    transaction(() => {
      for (const person of params.persons) {
        const personId = uuidv4();
        createdIds.push(personId);
        execute(
          `INSERT INTO persons (
            id, organization_id, person_code, first_name, last_name, email, phone,
            national_id, status, primary_department_id, primary_location_id, metadata, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            personId,
            params.organization_id,
            person.person_code,
            person.first_name,
            person.last_name,
            person.email || null,
            person.phone || null,
            person.national_id || null,
            person.status || 'ACTIVE',
            person.primary_department_id || null,
            person.primary_location_id || null,
            person.metadata ? JSON.stringify(person.metadata) : null,
            now,
            now,
          ]
        );

        for (const roleId of person.roles || []) {
          execute('INSERT OR IGNORE INTO person_roles (person_id, role_id, organization_id) VALUES (?, ?, ?)', [
            personId,
            roleId,
            params.organization_id,
          ]);
        }

        auditService.log({
          organization_id: params.organization_id,
          actor_id: params.actor_id,
          action: 'PERSON_CREATED',
          entity_type: 'PERSON',
          entity_id: personId,
          new_state: { person_code: person.person_code, name: `${person.first_name} ${person.last_name}` },
        });
      }
    });

    return { imported: createdIds.length, person_ids: createdIds };
  },

  /**
   * Updates an existing person
   */
  updatePerson(organization_id: string, personId: string, updates: Partial<Person>, actorId: string) {
    const current = this.getPersonById(organization_id, personId);
    if (!current) {
      throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');
    }

    const now = new Date().toISOString();

    execute(
      `UPDATE persons SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        national_id = COALESCE(?, national_id),
        status = COALESCE(?, status),
        primary_department_id = COALESCE(?, primary_department_id),
        primary_location_id = COALESCE(?, primary_location_id),
        metadata = COALESCE(?, metadata),
        updated_at = ?
      WHERE id = ? AND organization_id = ?`,
      [
        updates.first_name || null,
        updates.last_name || null,
        updates.email || null,
        updates.phone || null,
        updates.national_id || null,
        updates.status || null,
        updates.primary_department_id || null,
        updates.primary_location_id || null,
        updates.metadata ? JSON.stringify(updates.metadata) : null,
        now,
        personId,
        organization_id,
      ]
    );

    auditService.log({
      organization_id,
      actor_id: actorId,
      action: 'PERSON_UPDATED',
      entity_type: 'PERSON',
      entity_id: personId,
      previous_state: current,
      new_state: updates,
    });

    return this.getPersonById(organization_id, personId);
  },

  /**
   * Assigns role to person
   */
  assignRole(organization_id: string, personId: string, roleId: string, actorId: string) {
    const person = this.getPersonById(organization_id, personId);
    if (!person) throw new AppError('Person not found', 404, 'PERSON_NOT_FOUND');

    const role = queryOne('SELECT id FROM roles WHERE id = ?', [roleId]);
    if (!role) throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');

    execute('INSERT OR IGNORE INTO person_roles (person_id, role_id, organization_id) VALUES (?, ?, ?)', [
      personId,
      roleId,
      organization_id,
    ]);

    auditService.log({
      organization_id,
      actor_id: actorId,
      action: 'PERSON_ROLE_ASSIGNED',
      entity_type: 'PERSON',
      entity_id: personId,
      new_state: { role_id: roleId },
    });

    return this.getPersonById(organization_id, personId);
  },

  /**
   * Sets custom field value for person
   */
  setCustomFieldValue(organization_id: string, personId: string, fieldKey: string, value: any, actorId: string) {
    const def = queryOne<any>(
      `SELECT * FROM custom_field_definitions 
       WHERE organization_id = ? AND entity_type = 'PERSON' AND field_key = ?`,
      [organization_id, fieldKey]
    );

    if (!def) {
      throw new AppError(`Custom field definition for "${fieldKey}" not found`, 404, 'FIELD_DEFINITION_NOT_FOUND');
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    execute(
      `INSERT INTO custom_field_values (id, organization_id, entity_type, entity_id, field_key, value, created_at, updated_at)
       VALUES (?, ?, 'PERSON', ?, ?, ?, ?, ?)
       ON CONFLICT(organization_id, entity_type, entity_id, field_key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at`,
      [id, organization_id, personId, fieldKey, String(value), now, now]
    );

    auditService.log({
      organization_id,
      actor_id: actorId,
      action: 'CUSTOM_FIELD_VALUE_SET',
      entity_type: 'PERSON',
      entity_id: personId,
      new_state: { field_key: fieldKey, value },
    });

    return { success: true, field_key: fieldKey, value };
  },
};
