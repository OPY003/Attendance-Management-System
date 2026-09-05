import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluatePolicyRules, RuleEvaluationContext } from '@uapms/rule-engine-core';
import { ASTCondition, PolicyRule } from '@uapms/shared-types';

describe('Safe Rule Engine AST Unit Test Suite', () => {
  const sampleContext: RuleEvaluationContext = {
    person: {
      id: 'person-123',
      person_code: 'EMP-001',
      roles: ['EMPLOYEE'],
      status: 'ACTIVE',
    },
    shift: {
      id: 'shift-1',
      start_time: '09:00:00',
      end_time: '17:00:00',
      grace_period_minutes: 10,
      late_threshold_minutes: 30,
      early_leave_threshold_minutes: 15,
    },
    location: {
      location_id: 'loc-1',
      is_within_geofence: true,
      distance_meters: 12.5,
      is_allowed_location: true,
    },
    detection: {
      method: 'DYNAMIC_QR',
      identity_confidence: 95,
      device_confidence: 90,
      timestamp: new Date().toISOString(),
    },
    confidence_score: 92,
    metrics: {
      check_in_delay_minutes: 5,
      is_on_approved_leave: false,
    },
  };

  it('1. Evaluates simple EQUALS condition correctly', () => {
    const condition: ASTCondition = {
      field: 'detection.method',
      operator: 'EQUALS',
      value: 'DYNAMIC_QR',
    };
    expect(evaluateCondition(condition, sampleContext)).toBe(true);
  });

  it('2. Evaluates LESS_THAN_OR_EQUAL condition for grace period', () => {
    const condition: ASTCondition = {
      field: 'metrics.check_in_delay_minutes',
      operator: 'LESS_THAN_OR_EQUAL',
      value: 10,
    };
    expect(evaluateCondition(condition, sampleContext)).toBe(true);
  });

  it('3. Evaluates compound AND conditions', () => {
    const condition: ASTCondition = {
      operator: 'AND',
      conditions: [
        { field: 'location.is_within_geofence', operator: 'EQUALS', value: true },
        { field: 'confidence_score', operator: 'GREATER_THAN_OR_EQUAL', value: 90 },
      ],
    };
    expect(evaluateCondition(condition, sampleContext)).toBe(true);
  });

  it('4. Evaluates compound OR conditions with failure fallback', () => {
    const condition: ASTCondition = {
      operator: 'OR',
      conditions: [
        { field: 'detection.method', operator: 'EQUALS', value: 'RFID' },
        { field: 'detection.method', operator: 'EQUALS', value: 'DYNAMIC_QR' },
      ],
    };
    expect(evaluateCondition(condition, sampleContext)).toBe(true);
  });

  it('5. Evaluates full policy rules and applies actions without eval()', () => {
    const rules: PolicyRule[] = [
      {
        id: 'rule-on-time',
        policy_id: 'pol-1',
        priority: 1,
        name: 'Mark Present within Grace Period',
        condition: {
          operator: 'AND',
          conditions: [
            { field: 'metrics.check_in_delay_minutes', operator: 'LESS_THAN_OR_EQUAL', value: 10 },
            { field: 'location.is_within_geofence', operator: 'EQUALS', value: true },
          ],
        },
        action: {
          set_status: 'PRESENT',
        },
        is_active: true,
      },
    ];

    const results = evaluatePolicyRules(rules, sampleContext);
    expect(results.length).toBe(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].new_status).toBe('PRESENT');
  });
});
