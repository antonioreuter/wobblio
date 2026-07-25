// Canonical reader/writer for the Bedrock model IDs (opaque SSM values at
// /wobblio/config/models/{role}). The ingestion worker and every Bedrock caller
// resolve IDs through this port — never hardcode — so an admin swap (admin-console
// 03) takes effect fleet-wide on the next cold start / cache expiry.
// `pdf_parser` parses PDF invoices (the vision model rejects document blocks); it is
// its own swappable role so PDF routing is independent of the `insight` model.
// `vision_fallback` is the mid-tier model a low-quality primary parse escalates to; `vision_fallback_deep`
// is the deepest tier for the lowest-quality parses (fix 11 adaptive escalation ladder). Both swappable via SSM.
export const MODEL_ROLES = ['vision_parser', 'vision_fallback', 'vision_fallback_deep', 'pdf_parser', 'auxiliary', 'insight', 'embedder'] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export function isModelRole(value: string): value is ModelRole {
  return (MODEL_ROLES as readonly string[]).includes(value);
}

export interface IModelRegistry {
  getModelId(role: ModelRole): Promise<string>;
  // Like getModelId but returns null instead of throwing when the param is unset — lets an
  // optional role (e.g. vision_fallback) wire fail-open: unprovisioned means feature-off.
  getModelIdOptional(role: ModelRole): Promise<string | null>;
  // All roles, for the admin matrix — value is null when the param is unset.
  getAll(): Promise<Record<ModelRole, string | null>>;
  setModelId(role: ModelRole, id: string): Promise<void>;
}
