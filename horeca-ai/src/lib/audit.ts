import { prisma } from "@/lib/db";

export interface AuditEvent {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId,
        meta: (event.meta as object) ?? undefined,
        ip: event.ip,
      },
    });
  } catch (err) {
    console.error("audit_log_failed", err);
  }
}

export async function withAudit<T>(
  event: Omit<AuditEvent, "meta"> & { meta?: Record<string, unknown> },
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await logAudit({
      ...event,
      meta: { ...event.meta, durationMs: Date.now() - start, ok: true },
    });
    return result;
  } catch (err) {
    await logAudit({
      ...event,
      meta: {
        ...event.meta,
        durationMs: Date.now() - start,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
