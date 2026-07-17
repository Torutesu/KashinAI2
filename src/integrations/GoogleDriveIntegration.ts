// src/integrations/GoogleDriveIntegration.ts
//
// Google Drive access: search + read (drive.readonly) and creating new files
// (drive.file — least privilege, only touches files this app creates). Reuses
// the shared refresh-capable OAuth client. Re-run src/auth/googleAuth.ts after
// a scope change so the new consent is granted.

import { google } from 'googleapis';
import { getGoogleAuthClient } from '../auth/googleClient';
import { IntegrationError } from '../types/result';

export class GoogleDriveIntegration {
  private drive() {
    return google.drive({ version: 'v3', auth: getGoogleAuthClient() });
  }

  async searchFiles(query: string): Promise<string> {
    try {
      const drive = this.drive();
      const res = await drive.files.list({
        q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
        fields: 'files(id, name, mimeType, modifiedTime)',
        pageSize: 5,
        orderBy: 'modifiedTime desc',
      });
      const files = res.data.files || [];
      if (files.length === 0) return `No Drive files found matching: ${query}`;
      let out = `Found ${files.length} Drive file(s):\n`;
      for (const f of files) out += `- ${f.name} | ID: ${f.id} | ${f.mimeType}\n`;
      return out;
    } catch (error) {
      throw new IntegrationError('Failed to search Drive', error);
    }
  }

  async readFile(fileId: string): Promise<string> {
    try {
      const drive = this.drive();
      const meta = await drive.files.get({ fileId, fields: 'name, mimeType' });
      const mimeType = meta.data.mimeType || '';

      let content: string;
      if (mimeType.startsWith('application/vnd.google-apps')) {
        // Google Docs/Sheets/Slides → export as plain text.
        const exp = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
        content = String(exp.data);
      } else {
        const media = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
        content = String(media.data);
      }
      return `File: ${meta.data.name}\n${content.slice(0, 4000)}`;
    } catch (error) {
      throw new IntegrationError('Failed to read Drive file', error);
    }
  }

  /**
   * Create a new Google Doc from plain text and return its id + shareable link.
   * Uses the drive.file scope, so it can only ever touch app-created files.
   */
  async createFile(name: string, content: string): Promise<string> {
    if (!name || !name.trim()) throw new IntegrationError('A file name is required');
    try {
      const drive = this.drive();
      const res = await drive.files.create({
        requestBody: { name: name.trim(), mimeType: 'application/vnd.google-apps.document' },
        media: { mimeType: 'text/plain', body: content || '' },
        fields: 'id, name, webViewLink',
      });
      const f = res.data;
      return `Created Google Doc "${f.name}" (ID: ${f.id})${f.webViewLink ? ` — ${f.webViewLink}` : ''}`;
    } catch (error) {
      throw new IntegrationError('Failed to create Drive file', error);
    }
  }

  /**
   * Replace the full text content of an existing (app-created) Google Doc.
   * Uploaded text/plain is re-imported into Doc format.
   */
  async updateFile(fileId: string, content: string): Promise<string> {
    if (!fileId || !fileId.trim()) throw new IntegrationError('A file ID is required');
    try {
      const drive = this.drive();
      const res = await drive.files.update({
        fileId: fileId.trim(),
        media: { mimeType: 'text/plain', body: content || '' },
        fields: 'id, name, webViewLink',
      });
      const f = res.data;
      return `Updated Google Doc "${f.name}" (ID: ${f.id})${f.webViewLink ? ` — ${f.webViewLink}` : ''}`;
    } catch (error) {
      throw new IntegrationError('Failed to update Drive file', error);
    }
  }

  /**
   * Append text to an existing (app-created) Google Doc: reads the current text,
   * concatenates, and re-writes. Formatting is not preserved (plain text).
   */
  async appendFile(fileId: string, content: string): Promise<string> {
    if (!fileId || !fileId.trim()) throw new IntegrationError('A file ID is required');
    if (!content) throw new IntegrationError('Nothing to append');
    try {
      const drive = this.drive();
      const id = fileId.trim();
      const exp = await drive.files.export({ fileId: id, mimeType: 'text/plain' }, { responseType: 'text' });
      const existing = String(exp.data ?? '');
      const separator = existing.length && !existing.endsWith('\n') ? '\n' : '';
      const res = await drive.files.update({
        fileId: id,
        media: { mimeType: 'text/plain', body: existing + separator + content },
        fields: 'id, name, webViewLink',
      });
      const f = res.data;
      return `Appended to Google Doc "${f.name}" (ID: ${f.id})${f.webViewLink ? ` — ${f.webViewLink}` : ''}`;
    } catch (error) {
      throw new IntegrationError('Failed to append to Drive file', error);
    }
  }
}
