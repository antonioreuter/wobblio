export interface IEmailSender {
  sendWaitlistRelease(toAddress: string): Promise<void>;
}
