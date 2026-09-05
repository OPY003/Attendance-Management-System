export type ConfidenceVerdict = 'VERIFIED' | 'VALID' | 'REVIEW' | 'SUSPICIOUS' | 'REJECTED';

export interface DetectionFactor {
  factor_name: string;
  weight: number;
  earned_score: number;
  max_score: number;
  passed: boolean;
  details?: string;
}

export interface ConfidenceEvaluationResult {
  total_score: number; // 0 to 100
  verdict: ConfidenceVerdict;
  factors: DetectionFactor[];
  is_acceptable: boolean;
  explanation: string;
}

export class ConfidenceEngine {
  /**
   * Default baseline weights for detection modalities
   */
  public static readonly DEFAULT_WEIGHTS = {
    DYNAMIC_QR: 40,
    GPS_GEOFENCE: 30,
    REGISTERED_DEVICE: 20,
    BIOMETRIC_FACE: 30,
    KIOSK_TERMINAL: 20,
    MANUAL_PIN: 10,
  };

  /**
   * Evaluates overall attendance confidence across all verification factors
   */
  public evaluateConfidence(
    factors: DetectionFactor[],
    minConfidenceThreshold = 70.0,
    autoRejectThreshold = 30.0
  ): ConfidenceEvaluationResult {
    let earnedSum = 0;
    let maxPossibleSum = 0;

    for (const factor of factors) {
      earnedSum += factor.earned_score;
      maxPossibleSum += factor.max_score;
    }

    // Normalize to 0 - 100 percentage
    const normalizedScore =
      maxPossibleSum > 0 ? Math.min(100, Math.round((earnedSum / maxPossibleSum) * 100 * 10) / 10) : 0;

    // Classify verdict according to standard thresholds
    let verdict: ConfidenceVerdict;
    if (normalizedScore >= 85) {
      verdict = 'VERIFIED';
    } else if (normalizedScore >= 70) {
      verdict = 'VALID';
    } else if (normalizedScore >= 50) {
      verdict = 'REVIEW';
    } else if (normalizedScore >= autoRejectThreshold) {
      verdict = 'SUSPICIOUS';
    } else {
      verdict = 'REJECTED';
    }

    const isAcceptable = normalizedScore >= minConfidenceThreshold && verdict !== 'REJECTED';

    const passedFactorsCount = factors.filter((f) => f.passed).length;
    const explanation = `Confidence score ${normalizedScore.toFixed(1)}/100 (${verdict}): ${passedFactorsCount}/${factors.length} verification factors satisfied.`;

    return {
      total_score: normalizedScore,
      verdict,
      factors,
      is_acceptable: isAcceptable,
      explanation,
    };
  }
}

export const confidenceEngine = new ConfidenceEngine();
