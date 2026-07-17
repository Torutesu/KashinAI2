// src/integrations/GmailIntegration.ts
import { google } from 'googleapis';
import { assertSafeHeaderValue } from '../security/inputValidation';
import { getGoogleAuthClient } from '../auth/googleClient';
import { IntegrationError } from '../types/result';

export class GmailIntegration {
  private async getAuth() {
    // Shared, refresh-capable client (auto-refreshes + persists the token).
    return getGoogleAuthClient();
  }

  // 1. Create Draft
  async createDraft(to: string, subject: string, body: string): Promise<string> {
    try {
      assertSafeHeaderValue('recipient', to);
      assertSafeHeaderValue('subject', subject);
      const auth = await this.getAuth();
      const gmail = google.gmail({ version: 'v1', auth });
      const email = [`To: ${to}`, `Subject: ${subject}`, '', body].join('\n');
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw: encodedEmail } } });
      return `Successfully created Gmail draft to ${to}.`;
    } catch (error) {
      throw new IntegrationError('Failed to create Gmail draft', error);
    }
  }

  // 2. Send Email
  async sendEmail(to: string, subject: string, body: string): Promise<string> {
    try {
      assertSafeHeaderValue('recipient', to);
      assertSafeHeaderValue('subject', subject);
      const auth = await this.getAuth();
      const gmail = google.gmail({ version: 'v1', auth });
      const email = [`To: ${to}`, `Subject: ${subject}`, '', body].join('\n');
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedEmail } });
      return `Successfully sent email to ${to}.`;
    } catch (error) {
      throw new IntegrationError('Failed to send email', error);
    }
  }

  // Helper: Get message details
  private async getMessageDetails(gmail: any, messageId: string) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date', 'Message-ID']
    });
    const headers = detail.data.payload?.headers || [];
    return {
      id: messageId,
      threadId: detail.data.threadId,
      subject: headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject',
      from: headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender',
      date: headers.find((h: any) => h.name === 'Date')?.value || '',
      messageIdHeader: headers.find((h: any) => h.name === 'Message-ID')?.value || ''
    };
  }

  // 3. Search Emails
  async searchEmails(query: string): Promise<string> {
    try {
      const auth = await this.getAuth();
      const gmail = google.gmail({ version: 'v1', auth });
      const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 3 });

      const messages = res.data.messages;
      if (!messages || messages.length === 0) return `No emails found matching: ${query}`;

      let emailSummaries = `Found ${messages.length} emails:\n`;
      for (const msg of messages) {
        const details = await this.getMessageDetails(gmail, msg.id!);
        emailSummaries += `- ID: ${details.id} | From: ${details.from} | Subject: ${details.subject}\n`;
      }
      return emailSummaries;
    } catch (error) {
      throw new IntegrationError('Failed to search emails', error);
    }
  }

  // 4. Read Recent Emails
  async readRecentEmails(): Promise<string> {
    try {
      const auth = await this.getAuth();
      const gmail = google.gmail({ version: 'v1', auth });
      const res = await gmail.users.messages.list({ userId: 'me', maxResults: 5 });

      const messages = res.data.messages;
      if (!messages || messages.length === 0) return `Your inbox is empty.`;

      let emailSummaries = `Here are your 5 most recent emails:\n`;
      for (const msg of messages) {
        const details = await this.getMessageDetails(gmail, msg.id!);
        emailSummaries += `- ID: ${details.id} | From: ${details.from} | Subject: ${details.subject} (${details.date})\n`;
      }
      return emailSummaries;
    } catch (error) {
      throw new IntegrationError('Failed to read emails', error);
    }
  }

  // 5. Reply to Email
  async replyToEmail(messageId: string, body: string): Promise<string> {
    try {
      const auth = await this.getAuth();
      const gmail = google.gmail({ version: 'v1', auth });

      // Get original email details to extract headers for valid reply
      const originalDetails = await this.getMessageDetails(gmail, messageId);

      // Gmail requires 'In-Reply-To' and 'References' headers to link emails in a thread
      const replyHeaders = [
        `To: ${originalDetails.from}`,
        `Subject: Re: ${originalDetails.subject.replace(/^Re:\s*/, '')}`,
        `In-Reply-To: ${originalDetails.messageIdHeader}`,
        `References: ${originalDetails.messageIdHeader}`,
        '',
        body
      ].join('\n');

      const encodedReply = Buffer.from(replyHeaders).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Send reply using the threadId so it stays in the same conversation in Gmail UI
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedReply, threadId: originalDetails.threadId }
      });

      return `Successfully replied to email (Subject: ${originalDetails.subject}).`;
    } catch (error) {
      throw new IntegrationError('Failed to reply to email', error);
    }
  }
}
