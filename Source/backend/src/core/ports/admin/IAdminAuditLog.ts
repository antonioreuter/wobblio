// Append-only operator audit trail. Every admin mutation records one entry;
// reads never audit. `before`/`after` hold the changed value where one exists
// (null for pure create/delete actions like dlq.delete).
export type AdminAuditAction =
  | 'ssm.update'
  | 'model.swap'
  | 'dlq.replay'
  | 'dlq.delete'
  | 'curation.approve'
  | 'curation.merge'
  | 'curation.reject'
  | 'curation.alias_deactivate'
  | 'waitlist.release'
  | 'loglevel.change'
  | 'quota.adjust'
  | 'quota.config'
  | 'role.change'
  | 'fault.reprocess'
  | 'fault.wont_process'
  | 'fault.debug_sample';

export interface AdminAuditEntry {
  actorUserId: string;
  actorEmail: string;
  action: AdminAuditAction;
  target: string; // param name / message id / entity id / count released
  before?: unknown;
  after?: unknown;
}

// One persisted audit row, newest-first, for operator history views (e.g. the
// model-swap history filtered to action='model.swap').
export interface AdminAuditRow {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface IAdminAuditLog {
  record(entry: AdminAuditEntry): Promise<void>;
  // Reads (never audited). Filters by action when provided; newest first.
  list(action: AdminAuditAction | undefined, limit: number): Promise<AdminAuditRow[]>;
}

// The authenticated ADMIN performing a mutation; carried into every audit entry.
export interface AdminActor {
  id: string;
  email: string;
}
