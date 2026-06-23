// Canonical reader/writer for the four Bedrock model IDs (opaque SSM values at
// /wobblio/config/models/{role}). The ingestion worker and every Bedrock caller
// resolve IDs through this port — never hardcode — so an admin swap (admin-console
// 03) takes effect fleet-wide on the next cold start / cache expiry.
export const MODEL_ROLES = ['vision_parser', 'auxiliary', 'insight', 'embedder'] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export function isModelRole(value: string): value is ModelRole {
  return (MODEL_ROLES as readonly string[]).includes(value);
}

export interface IModelRegistry {
  getModelId(role: ModelRole): Promise<string>;
  // All four, for the admin matrix — value is null when the param is unset.
  getAll(): Promise<Record<ModelRole, string | null>>;
  setModelId(role: ModelRole, id: string): Promise<void>;
}
