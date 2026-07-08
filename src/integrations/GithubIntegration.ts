import axios from 'axios';

export class GithubIntegration {
  private token: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
  }

  async createIssue(repo: string, title: string, body: string): Promise<string> {
    if (!this.token) return 'Error: GITHUB_TOKEN not set in .env';
    try {
      await axios.post(`https://api.github.com/repos/${repo}/issues`, {
        title,
        body,
      }, {
        headers: { Authorization: `token ${this.token}` }
      });
      return `Successfully created GitHub issue in ${repo}.`;
    } catch (error) {
      return `Error creating issue: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}