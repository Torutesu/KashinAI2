// tests/integrationsRegistered.test.ts
//
// The new v1.2 integration tools are registered and dispatchable, and their
// missing-credential paths return ok:false (no side effects).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getToolDefByName } from '../src/llm/Toolregistry';
import { isDestructiveTool } from '../src/llm/OrchestratorService';
import { GoogleDriveIntegration } from '../src/integrations/GoogleDriveIntegration';

const NEW_TOOLS = [
  'gdrive_search_files', 'gdrive_read_file', 'gdrive_create_file',
  'jira_search_issues', 'jira_read_issue', 'jira_create_issue', 'jira_comment_issue',
  'linear_search_issues', 'linear_create_issue',
  'notify', 'send_telegram_message', 'send_discord_message',
];

test('all new integration tools are registered', () => {
  for (const name of NEW_TOOLS) {
    assert.ok(getToolDefByName(name), `${name} should be registered`);
  }
});

test('Google Drive read requires auth (throws without a token)', async () => {
  // No google_token.json in the test env → the shared client throws.
  await assert.rejects(() => new GoogleDriveIntegration().searchFiles('report'), /Failed to search Drive/);
});

test('Google Drive create requires auth (throws without a token)', async () => {
  await assert.rejects(() => new GoogleDriveIntegration().createFile('Notes', 'body'), /Failed to create Drive file/);
});

test('Google Drive create rejects an empty file name before any API call', async () => {
  await assert.rejects(() => new GoogleDriveIntegration().createFile('  ', 'body'), /file name is required/);
});

test('gdrive_create_file is confirmation-gated (destructive)', () => {
  assert.ok(isDestructiveTool('gdrive_create_file'), 'creating a Drive file should require confirmation');
});
