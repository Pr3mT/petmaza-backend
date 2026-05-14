/**
 * paymentSecurityLogger.ts
 *
 * Centralised utility for recording suspicious payment/cart activity.
 * Writes to both the SecurityAuditLog collection and the application logger
 * so incidents appear in both the DB (queryable by admin) and log files.
 */

import SecurityAuditLog, { ISecurityAuditLog } from '../models/SecurityAuditLog';
import logger from '../config/logger';

export interface SecurityEventPayload {
  event: ISecurityAuditLog['event']; // use values from SecurityAuditLog enum
  severity?: ISecurityAuditLog['severity'];
  userId?: any;
  orderId?: any;
  ipAddress?: string;
  userAgent?: string;
  expected?: any;
  received?: any;
  details: string;
}

/**
 * Logs a suspicious security event to the DB and the application log.
 * Never throws — a logging failure must not block the request error response.
 */
export async function logSecurityEvent(payload: SecurityEventPayload): Promise<void> {
  const severity = payload.severity ?? 'HIGH';

  // Always write to application log immediately (synchronous path)
  const logMessage =
    `[SECURITY:${severity}] 🚨 ${payload.event} | ` +
    `User: ${payload.userId ?? 'unknown'} | ` +
    `IP: ${payload.ipAddress ?? 'unknown'} | ` +
    `Details: ${payload.details}`;

  if (severity === 'CRITICAL' || severity === 'HIGH') {
    logger.error(logMessage);
  } else {
    logger.warn(logMessage);
  }

  // Persist to DB asynchronously — do not await so it never blocks
  SecurityAuditLog.create({
    event: payload.event,
    severity,
    userId: payload.userId ?? undefined,
    orderId: payload.orderId ?? undefined,
    ipAddress: payload.ipAddress,
    userAgent: payload.userAgent,
    expected: payload.expected,
    received: payload.received,
    details: payload.details,
  }).catch((err: any) => {
    logger.error(`[SECURITY] Failed to persist SecurityAuditLog: ${err.message}`);
  });
}
