// Raw read/write of SSM parameter values. The allowlist + validation live in the
// domain (adminTunables) / AdminConfigService — this port only moves strings.
export interface ITunableParameterStore {
  // Returns a map of ssmPath → current value (null when the parameter is unset).
  getValues(ssmPaths: string[]): Promise<Record<string, string | null>>;
  setValue(ssmPath: string, value: string): Promise<void>;
}
