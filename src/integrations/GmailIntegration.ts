// src/integrations/GmailIntegration.ts
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.join(process.cwd(), 'google_token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'google_credentials.json');

export class GmailIntegration {
  private async getAuth() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
  }

  async createDraft(to: string, subject: string, body: string): Promise<string> {
    try {
      const auth = await this.getAuth();
      const gmail = google.gmail({ version: 'v1', auth });

      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');

      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

      await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedEmail,
          },
        },
      });

      return `Successfully created Gmail draft to ${to}.`;
    } catch (error) {
      return `Error creating Gmail draft: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}