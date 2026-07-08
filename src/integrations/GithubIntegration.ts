// src/integrations/GithubIntegration.ts
import axios from 'axios';

export class GithubIntegration {
  private token: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
  }

  private getHeaders() {
    return {
      Authorization: `token ${this.token}`,
      Accept: 'application/vnd.github.v3+json'
    };
  }

  // 1. Create Issue
  async createIssue(repo: string, title: string, body: string): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      await axios.post(`https://api.github.com/repos/${repo}/issues`, {
        title, body
      }, { headers: this.getHeaders() });
      return `Successfully created GitHub issue in ${repo}.`;
    } catch (error) {
      return `Error creating issue: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 2. Read Issues
  async readIssues(repo: string): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      const res = await axios.get(`https://api.github.com/repos/${repo}/issues?state=open&per_page=5`, {
        headers: this.getHeaders()
      });
      
      if (res.data.length === 0) return `No open issues found in ${repo}.`;

      let result = `Recent open issues in ${repo}:\n`;
      for (const issue of res.data) {
        // GitHub API returns PRs in the issues endpoint, so we filter them out
        if (!issue.pull_request) {
          result += `- #${issue.number}: ${issue.title} (Assigned to: ${issue.assignee ? issue.assignee.login : 'No one'})\n`;
        }
      }
      return result;
    } catch (error) {
      return `Error reading issues: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 3. Read Pull Requests
  async readPullRequests(repo: string): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      const res = await axios.get(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=5`, {
        headers: this.getHeaders()
      });
      
      if (res.data.length === 0) return `No open pull requests found in ${repo}.`;

      let result = `Recent open PRs in ${repo}:\n`;
      for (const pr of res.data) {
        result += `- PR #${pr.number}: ${pr.title} (By: ${pr.user.login})\n`;
      }
      return result;
    } catch (error) {
      return `Error reading PRs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 4. Create PR Comment
  async createPRComment(repo: string, prNumber: number, body: string): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      await axios.post(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
        body
      }, { headers: this.getHeaders() });
      return `Successfully commented on PR #${prNumber} in ${repo}.`;
    } catch (error) {
      return `Error commenting on PR: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 5. Assign Issue
  async assignIssue(repo: string, issueNumber: number, assignee: string): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      await axios.post(`https://api.github.com/repos/${repo}/issues/${issueNumber}/assignees`, {
        assignees: [assignee]
      }, { headers: this.getHeaders() });
      return `Successfully assigned issue #${issueNumber} to ${assignee}.`;
    } catch (error) {
      return `Error assigning issue: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 6. Close Issue
  async closeIssue(repo: string, issueNumber: number): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      await axios.patch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
        state: 'closed'
      }, { headers: this.getHeaders() });
      return `Successfully closed issue #${issueNumber} in ${repo}.`;
    } catch (error) {
      return `Error closing issue: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 7. Reopen Issue
  async reopenIssue(repo: string, issueNumber: number): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      await axios.patch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
        state: 'open'
      }, { headers: this.getHeaders() });
      return `Successfully reopened issue #${issueNumber} in ${repo}.`;
    } catch (error) {
      return `Error reopening issue: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}