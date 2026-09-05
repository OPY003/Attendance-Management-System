import { getDatabase } from '../core/database/db.js';
import { evaluatePolicyRules, RuleEvaluationContext, RuleEvaluationResult } from '@uapms/rule-engine-core';

export interface PolicyCheckResult {
  is_compliant: boolean;
  policy_id?: string;
  policy_name?: string;
  missing_required_methods: string[];
  rule_results: RuleEvaluationResult[];
  min_confidence_score: number;
  reason?: string;
}

export class PolicyEngine {
  /**
   * Evaluates organization and session policy constraints
   */
  public evaluatePolicy(
    organizationId: string,
    policyId: string | undefined | null,
    providedMethods: string[],
    context: RuleEvaluationContext
  ): PolicyCheckResult {
    const db = getDatabase();

    let policy: any = null;

    // 1. Fetch policy if policyId provided
    if (policyId) {
      policy = db
        .prepare(`SELECT * FROM attendance_policies WHERE id = ? AND organization_id = ?`)
        .get(policyId, organizationId);
    }

    // 2. Fall back to tenant default policy if not found
    if (!policy) {
      policy = db
        .prepare(`SELECT * FROM attendance_policies WHERE organization_id = ? AND is_default = 1`)
        .get(organizationId);
    }

    // If still no policy, create standard compliant baseline
    if (!policy) {
      return {
        is_compliant: true,
        missing_required_methods: [],
        rule_results: [],
        min_confidence_score: 50.0,
      };
    }

    // Parse policy JSON configs
    let requiredMethods: string[] = [];
    let allowedLocationIds: string[] = [];

    try {
      requiredMethods = JSON.parse(policy.required_methods || '[]');
    } catch {
      requiredMethods = [];
    }

    try {
      allowedLocationIds = JSON.parse(policy.allowed_location_ids || '[]');
    } catch {
      allowedLocationIds = [];
    }

    // 3. Verify mandatory detection methods
    const missingMethods = requiredMethods.filter((m) => !providedMethods.includes(m));

    // 4. Verify location constraints if specified in policy
    let locationCompliant = true;
    if (allowedLocationIds.length > 0 && context.location?.location_id) {
      if (!allowedLocationIds.includes(context.location.location_id)) {
        locationCompliant = false;
      }
    }

    // 5. Evaluate AST Policy Rules from policy_rules table
    const rulesRows = db
      .prepare(`SELECT * FROM policy_rules WHERE policy_id = ? AND is_active = 1 ORDER BY priority ASC`)
      .all(policy.id) as any[];

    const formattedRules = rulesRows.map((r) => {
      let condition: any = {};
      let action: any = {};
      try {
        condition = JSON.parse(r.condition_json);
      } catch {}
      try {
        action = JSON.parse(r.action_json);
      } catch {}

      return {
        id: r.id,
        policy_id: r.policy_id,
        name: r.name,
        priority: r.priority,
        condition,
        action,
        is_active: Boolean(r.is_active),
      };
    });

    const ruleResults = evaluatePolicyRules(formattedRules, context);

    // Check if any rule forced a failure or suspicious status
    const triggeredBlock = ruleResults.some((r) => r.passed && r.flag_suspicious);

    const isCompliant = missingMethods.length === 0 && locationCompliant && !triggeredBlock;

    let reason: string | undefined;
    if (missingMethods.length > 0) {
      reason = `Missing mandatory detection method(s): ${missingMethods.join(', ')}`;
    } else if (!locationCompliant) {
      reason = `Location is not in allowed policy locations list`;
    } else if (triggeredBlock) {
      reason = `Triggered security policy rule flagged attendance as suspicious`;
    }

    return {
      is_compliant: isCompliant,
      policy_id: policy.id,
      policy_name: policy.name,
      missing_required_methods: missingMethods,
      rule_results: ruleResults,
      min_confidence_score: policy.min_confidence_score ?? 70.0,
      reason,
    };
  }
}

export const policyEngine = new PolicyEngine();
