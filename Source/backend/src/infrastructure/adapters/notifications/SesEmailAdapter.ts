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
}
