// src/integrations/JiraIntegration.ts
//
// Jira Cloud (REST v3). Auth: Basic base64(email:api_token) via
// JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN.

import axios from 'axios';
import { IntegrationError } from '../types/result';

export class JiraIntegration {
  private baseUrl = process.env.JIRA_BASE_URL || '';
  private email = process.env.JIRA_EMAIL || '';
  private token = process.env.JIRA_API_TOKEN || '';

  private requireConfig() {
    if (!this.baseUrl || !this.email || !this.token) {
      throw new IntegrationError('JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN not set in .env');
    }
  }

  private headers() {
    const basic = Buffer.from(`${this.email}:${this.token}`).toString('base64');
    return { Authorization: `Basic ${basic}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async searchIssues(query: string): Promise<string> {
    this.requireConfig();
    try {
      // Treat the query as free text unless it looks like JQL.
      const jql = /[=~]|ORDER BY|project\s*=/i.test(query) ? query : `text ~ "${query}" ORDER BY updated DESC`;
      const res = await axios.get(this.url('/rest/api/3/search'), {
        headers: this.headers(),
        params: { jql, maxResults: 5, fields: 'summary,status,assignee' },
      });
      const issues = res.data.issues || [];
      if (issues.length === 0) return `No Jira issues found for: ${query}`;
      let out = `Found ${issues.length} Jira issue(s):\n`;
      for (const i of issues) {
        const f = i.fields || {};
        out += `- ${i.key}: ${f.summary} [${f.status?.name || '?'}] (${f.assignee?.displayName || 'Unassigned'})\n`;
      }
      return out;
    } catch (error) {
      throw new IntegrationError('Failed to search Jira issues', error);
    }
  }

  async readIssue(issueKey: string): Promise<string> {
    this.requireConfig();
    try {
      const res = await axios.get(this.url(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`), {
        headers: this.headers(),
        params: { fields: 'summary,status,assignee,description' },
      });
      const f = res.data.fields || {};
      return `${res.data.key}: ${f.summary}\nStatus: ${f.status?.name || '?'} | Assignee: ${f.assignee?.displayName || 'Unassigned'}`;
    } catch (error) {
      throw new IntegrationError('Failed to read Jira issue', error);
    }
  }

  async createIssue(projectKey: string, summary: string, description: string): Promise<string> {
    this.requireConfig();
    try {
      const body = {
        fields: {
          project: { key: projectKey },
          summary,
          issuetype: { name: 'Task' },
          description: {
            type: 'doc', version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: description || '' }] }],
          },
        },
      };
      const res = await axios.post(this.url('/rest/api/3/issue'), body, { headers: this.headers() });
      return `Successfully created Jira issue ${res.data.key}.`;
    } catch (error) {
      throw new IntegrationError('Failed to create Jira issue', error);
    }
  }

  async commentIssue(issueKey: string, comment: string): Promise<string> {
    this.requireConfig();
    try {
      const body = {
        body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] },
      };
      await axios.post(this.url(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`), body, { headers: this.headers() });
      return `Successfully commented on Jira issue ${issueKey}.`;
    } catch (error) {
      throw new IntegrationError('Failed to comment on Jira issue', error);
    }
  }
}
