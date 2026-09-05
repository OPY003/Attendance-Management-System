import { AttendanceStatus, Shift } from '@uapms/shared-types';

export interface AttendanceCalculationResult {
  status: AttendanceStatus;
  late_minutes: number;
  early_leave_minutes: number;
  working_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
  is_within_grace_period: boolean;
  is_late: boolean;
  is_early_leave: boolean;
  explanation: string;
}

export const attendanceEngine = {
  /**
   * Backward-compatibility wrapper used by older detection flows.
   * Calculates punctuality for a single check-in event against a shift schedule.
   */
  evaluateCheckIn(timestamp: string, shift: Shift): AttendanceCalculationResult {
    const checkInDate = new Date(timestamp);
    const date = checkInDate.toISOString().split('T')[0];

    const startDate = new Date(`${date}T${shift.start_time}Z`);
    let scheduledStart = startDate;

    if (shift.crosses_midnight && checkInDate.getTime() < startDate.getTime()) {
      scheduledStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    }

    const delayMs = checkInDate.getTime() - scheduledStart.getTime();
    const delayMinutes = Math.max(0, Math.floor(delayMs / (60 * 1000)));

    const gracePeriodMinutes = shift.grace_period_minutes ?? 10;
    const isWithinGrace = delayMinutes <= gracePeriodMinutes;
    const isLate = delayMinutes > gracePeriodMinutes;

    return {
      status: isLate ? 'LATE' : 'PRESENT',
      late_minutes: delayMinutes,
      early_leave_minutes: 0,
      working_minutes: 0,
      overtime_minutes: 0,
      break_minutes: 0,
      is_within_grace_period: isWithinGrace,
      is_late: isLate,
      is_early_leave: false,
      explanation: isLate
        ? `Check-in delayed by ${delayMinutes} minutes (exceeds ${gracePeriodMinutes}m grace period)`
        : 'Check-in recorded within grace period',
    };
  },

  /**
   * Calculates attendance status and durations given check-in, check-out, and shift rules
   */
  evaluateAttendance(params: {
    check_in_time?: string; // ISO 8601 UTC
    check_out_time?: string; // ISO 8601 UTC
    date: string; // YYYY-MM-DD local date
    shift?: Shift;
    session_start_time?: string; // ISO 8601 UTC
    session_end_time?: string;   // ISO 8601 UTC
    is_on_approved_leave?: boolean;
    is_holiday?: boolean;
  }): AttendanceCalculationResult {
    // 1. If on approved leave, return LEAVE
    if (params.is_on_approved_leave) {
      return {
        status: 'LEAVE',
        late_minutes: 0,
        early_leave_minutes: 0,
        working_minutes: 0,
        overtime_minutes: 0,
        break_minutes: 0,
        is_within_grace_period: false,
        is_late: false,
        is_early_leave: false,
        explanation: 'Person is on approved leave for this date',
      };
    }

    // 2. If no check-in event, evaluate ABSENT
    if (!params.check_in_time) {
      return {
        status: 'ABSENT',
        late_minutes: 0,
        early_leave_minutes: 0,
        working_minutes: 0,
        overtime_minutes: 0,
        break_minutes: 0,
        is_within_grace_period: false,
        is_late: false,
        is_early_leave: false,
        explanation: 'No check-in detection recorded for the scheduled shift/session',
      };
    }

    const checkInDate = new Date(params.check_in_time);
    let scheduledStart: Date | null = null;
    let scheduledEnd: Date | null = null;
    let gracePeriodMinutes = 10;
    let lateThresholdMinutes = 30;
    let earlyLeaveThresholdMinutes = 15;
    let minWorkingMinutes = 480;

    if (params.session_start_time) {
      scheduledStart = new Date(params.session_start_time);
      if (params.session_end_time) scheduledEnd = new Date(params.session_end_time);
    } else if (params.shift) {
      gracePeriodMinutes = params.shift.grace_period_minutes;
      lateThresholdMinutes = params.shift.late_threshold_minutes;
      earlyLeaveThresholdMinutes = params.shift.early_leave_threshold_minutes;
      minWorkingMinutes = params.shift.min_working_minutes;

      // Construct scheduled start Date from date + start_time (HH:mm:ss)
      scheduledStart = new Date(`${params.date}T${params.shift.start_time}Z`);
      if (params.shift.crosses_midnight) {
        // Shift ends next day
        const nextDay = new Date(new Date(params.date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        scheduledEnd = new Date(`${nextDay}T${params.shift.end_time}Z`);
      } else {
        scheduledEnd = new Date(`${params.date}T${params.shift.end_time}Z`);
      }
    }

    let lateMinutes = 0;
    let isWithinGrace = true;
    let isLate = false;

    if (scheduledStart) {
      const delayMs = checkInDate.getTime() - scheduledStart.getTime();
      const delayMinutes = Math.floor(delayMs / (60 * 1000));

      if (delayMinutes > 0) {
        lateMinutes = delayMinutes;
        if (delayMinutes > gracePeriodMinutes) {
          isWithinGrace = false;
          isLate = true;
        }
      }
    }

    let workingMinutes = 0;
    let earlyLeaveMinutes = 0;
    let isEarlyLeave = false;
    let overtimeMinutes = 0;

    if (params.check_out_time) {
      const checkOutDate = new Date(params.check_out_time);
      const totalDurationMs = checkOutDate.getTime() - checkInDate.getTime();
      workingMinutes = Math.max(0, Math.floor(totalDurationMs / (60 * 1000)));

      if (scheduledEnd) {
        const leaveEarlyMs = scheduledEnd.getTime() - checkOutDate.getTime();
        const leaveEarlyMins = Math.floor(leaveEarlyMs / (60 * 1000));
        if (leaveEarlyMins > earlyLeaveThresholdMinutes) {
          earlyLeaveMinutes = leaveEarlyMins;
          isEarlyLeave = true;
        }

        // Overtime check
        const overtimeMs = checkOutDate.getTime() - scheduledEnd.getTime();
        if (overtimeMs > 0) {
          overtimeMinutes = Math.floor(overtimeMs / (60 * 1000));
        }
      }
    }

    // Determine final primary status
    let status: AttendanceStatus = 'PRESENT';
    let explanation = 'Check-in recorded within grace period';

    if (isLate) {
      status = 'LATE';
      explanation = `Check-in delayed by ${lateMinutes} minutes (exceeds ${gracePeriodMinutes}m grace period)`;
    } else if (isEarlyLeave) {
      status = 'EARLY_LEAVE';
      explanation = `Departed ${earlyLeaveMinutes} minutes prior to scheduled shift end`;
    }

    return {
      status,
      late_minutes: lateMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      working_minutes: workingMinutes,
      overtime_minutes: overtimeMinutes,
      break_minutes: 0,
      is_within_grace_period: isWithinGrace,
      is_late: isLate,
      is_early_leave: isEarlyLeave,
      explanation,
    };
  },
};
