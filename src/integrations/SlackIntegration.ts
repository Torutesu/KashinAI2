import axios from 'axios';

export class SlackIntegration {
  private token: string;

  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN || '';
  }

  async sendMessage(channel: string, message: string): Promise<string> {
    if (!this.token) return 'Error: SLACK_BOT_TOKEN not set in .env';
    try {
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        text: message,
      }, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return `Successfully sent Slack message to ${channel}.`;
    } catch (error) {
      return `Error sending Slack message: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}