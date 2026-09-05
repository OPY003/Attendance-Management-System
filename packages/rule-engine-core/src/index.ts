import { ASTCondition, PolicyRule, AttendanceStatus } from '@uapms/shared-types';

export interface RuleEvaluationContext {
  person?: {
    id: string;
    person_code: string;
    roles: string[];
    department_id?: string;
    status: string;
    custom_fields?: Record<string, any>;
  };
  session?: {
    id: string;
    session_type: string;
    start_time: string;
    end_time: string;
  };
  shift?: {
    id: string;
    start_time: string;
    end_time: string;
    grace_period_minutes: number;
    late_threshold_minutes: number;
    early_leave_threshold_minutes: number;
  };
  location?: {
    location_id: string;
    is_within_geofence: boolean;
    distance_meters?: number;
    is_allowed_location: boolean;
    wifi_ssid_matched?: boolean;
    ble_matched?: boolean;
    ip_matched?: boolean;
  };
  detection?: {
    method: string;
    identity_confidence?: number;
    device_confidence?: number;
    is_registered_device?: boolean;
    is_replay?: boolean;
    is_duplicate?: boolean;
    timestamp: string;
  };
  confidence_score?: number;
  metrics?: {
    check_in_delay_minutes?: number;
    early_leave_minutes?: number;
    is_holiday?: boolean;
    is_on_approved_leave?: boolean;
    previous_attendance_rate?: number;
    total_scans_today?: number;
  };
}

export interface RuleEvaluationResult {
  rule_id: string;
  name: string;
  passed: boolean;
  action_taken?: string;
  new_status?: AttendanceStatus;
  confidence_modifier?: number;
  flag_suspicious?: boolean;
  require_review?: boolean;
  notification_message?: string;
}

/**
 * Extracts a deeply nested value from context using dot notation e.g. "metrics.check_in_delay_minutes"
 */
export function getContextValue(context: RuleEvaluationContext, fieldPath: string): any {
  if (!fieldPath) return undefined;
  const parts = fieldPath.split('.');
  let current: any = context;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Safely evaluates an AST condition against context without eval()
 */
export function evaluateCondition(condition: ASTCondition, context: RuleEvaluationContext): boolean {
  if (!condition) return true;

  switch (condition.operator) {
    case 'AND': {
      if (!condition.conditions || condition.conditions.length === 0) return true;
      return condition.conditions.every((child: ASTCondition) => evaluateCondition(child, context));
    }

    case 'OR': {
      if (!condition.conditions || condition.conditions.length === 0) return false;
      return condition.conditions.some((child: ASTCondition) => evaluateCondition(child, context));
    }

    case 'NOT': {
      if (!condition.conditions || condition.conditions.length === 0) return false;
      return !evaluateCondition(condition.conditions[0], context);
    }

    case 'EQUALS': {
      const val = getContextValue(context, condition.field || '');
      return val === condition.value;
    }

    case 'NOT_EQUALS': {
      const val = getContextValue(context, condition.field || '');
      return val !== condition.value;
    }

    case 'GREATER_THAN': {
      const val = getContextValue(context, condition.field || '');
      return typeof val === 'number' && val > Number(condition.value);
    }

    case 'GREATER_THAN_OR_EQUAL': {
      const val = getContextValue(context, condition.field || '');
      return typeof val === 'number' && val >= Number(condition.value);
    }

    case 'LESS_THAN': {
      const val = getContextValue(context, condition.field || '');
      return typeof val === 'number' && val < Number(condition.value);
    }

    case 'LESS_THAN_OR_EQUAL': {
      const val = getContextValue(context, condition.field || '');
      return typeof val === 'number' && val <= Number(condition.value);
    }

    case 'IN': {
      const val = getContextValue(context, condition.field || '');
      return Array.isArray(condition.value) && condition.value.includes(val);
    }

    case 'NOT_IN': {
      const val = getContextValue(context, condition.field || '');
      return Array.isArray(condition.value) && !condition.value.includes(val);
    }

    case 'CONTAINS': {
      const val = getContextValue(context, condition.field || '');
      if (Array.isArray(val)) {
        return val.includes(condition.value);
      }
      if (typeof val === 'string') {
        return val.includes(String(condition.value));
      }
      return false;
    }

    default:
      return false;
  }
}

/**
 * Evaluates an ordered list of policy rules against a context
 */
export function evaluatePolicyRules(
  rules: PolicyRule[],
  context: RuleEvaluationContext
): RuleEvaluationResult[] {
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  const results: RuleEvaluationResult[] = [];

  for (const rule of sortedRules) {
    if (!rule.is_active) continue;

    const passed = evaluateCondition(rule.condition, context);
    const result: RuleEvaluationResult = {
      rule_id: rule.id,
      name: rule.name,
      passed,
    };

    if (passed && rule.action) {
      result.action_taken = 'RULE_TRIGGERED';
      if (rule.action.set_status) result.new_status = rule.action.set_status;
      if (rule.action.modify_confidence) result.confidence_modifier = rule.action.modify_confidence;
      if (rule.action.flag_suspicious) result.flag_suspicious = true;
      if (rule.action.require_review) result.require_review = true;
      if (rule.action.create_notification) result.notification_message = rule.action.notification_message;
    }

    results.push(result);
  }

  return results;
}
