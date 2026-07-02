import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { IEmailSender } from '@core/ports/notifications/IEmailSender';

export class SesEmailAdapter implements IEmailSender {
  private readonly client: SESv2Client;

  constructor(
    region: string,
    private readonly fromAddress: string,
  ) {
    this.client = new SESv2Client({ region });
  }

  async sendWaitlistRelease(toAddress: string): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromAddress,
        Destination: { ToAddresses: [toAddress] },
        Content: {
          Simple: {
            Subject: { Data: "You're in — your Wobblio account is now active" },
            Body: {
              Text: {
                Data: [
                  "Great news — your spot on the Wobblio waitlist has been claimed.",
                  "Sign in at https://app.wobblio.nl to get started.",
                  "",
                  "The Wobblio team",
                ].join('\n'),
              },
            },
          },
        },
      }),
    );
  }

  // §14 export-ready notice — deliberately carries no download link (decision: the download
  // endpoint always mints a fresh short-lived URL per click, never a static emailed one).
  async sendExportReady(toAddress: string): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromAddress,
        Destination: { ToAddresses: [toAddress] },
        Content: {
          Simple: {
            Subject: { Data: 'Your Wobblio data export is ready' },
            Body: {
              Text: {
                Data: [
                  'Your requested data export has finished and is ready to download.',
                  'Open the Wobblio app or website and go to Settings to download it.',
                  '',
                  'The Wobblio team',
                ].join('\n'),
              },
            },
          },
        },
      }),
    );
  }
}
