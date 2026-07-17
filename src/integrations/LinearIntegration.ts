// src/integrations/LinearIntegration.ts
//
// Linear (GraphQL). Auth: LINEAR_API_KEY in the Authorization header.

import axios from 'axios';
import { IntegrationError } from '../types/result';

const ENDPOINT = 'https://api.linear.app/graphql';

export class LinearIntegration {
  private key = process.env.LINEAR_API_KEY || '';

  private requireConfig() {
    if (!this.key) throw new IntegrationError('LINEAR_API_KEY not set in .env');
  }

  private async gql(query: string, variables?: Record<string, unknown>): Promise<any> {
    const res = await axios.post(
      ENDPOINT,
      { query, variables },
      { headers: { Authorization: this.key, 'Content-Type': 'application/json' } }
    );
    if (res.data.errors) {
      throw new Error(res.data.errors.map((e: any) => e.message).join('; '));
    }
    return res.data.data;
  }

  async searchIssues(query: string): Promise<string> {
    this.requireConfig();
    try {
      const data = await this.gql(
        `query($q: String!) { issues(filter: { title: { containsIgnoreCase: $q } }, first: 5) {
          nodes { identifier title state { name } assignee { name } } } }`,
        { q: query }
      );
      const nodes = data?.issues?.nodes || [];
      if (nodes.length === 0) return `No Linear issues found for: ${query}`;
      let out = `Found ${nodes.length} Linear issue(s):\n`;
      for (const n of nodes) {
        out += `- ${n.identifier}: ${n.title} [${n.state?.name || '?'}] (${n.assignee?.name || 'Unassigned'})\n`;
      }
      return out;
    } catch (error) {
      throw new IntegrationError('Failed to search Linear issues', error);
    }
  }

  async createIssue(teamId: string, title: string, description: string): Promise<string> {
    this.requireConfig();
    try {
      const data = await this.gql(
        `mutation($teamId: String!, $title: String!, $description: String) {
          issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
            success issue { identifier } } }`,
        { teamId, title, description: description || '' }
      );
      const created = data?.issueCreate;
      if (!created?.success) throw new Error('issueCreate returned success=false');
      return `Successfully created Linear issue ${created.issue?.identifier}.`;
    } catch (error) {
      throw new IntegrationError('Failed to create Linear issue', error);
    }
  }
}
