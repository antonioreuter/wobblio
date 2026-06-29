// Per-upload size/page limits (§06), admin-configurable in SSM. Kept separate from the
// weekly-credit IUploadQuotaProvider (ISP): the presign size check and the worker-start
// page check don't need the cap methods, and vice-versa. The SsmUploadQuotaAdapter
// implements both off one cached SSM batch.
export interface IUploadLimitsProvider {
  getMaxImageBytes(): Promise<number>;
  getMaxPdfBytes(): Promise<number>;
  getMaxPdfPages(): Promise<number>;
}
