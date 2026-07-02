export interface IEmailSender {
  sendWaitlistRelease(toAddress: string): Promise<void>;
  // §14 export-ready notice. Deliberately carries no download link — the recipient opens
  // the app/website, which mints a fresh short-lived presigned URL per download click.
  sendExportReady(toAddress: string): Promise<void>;
}
