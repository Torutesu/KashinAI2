// src/integrations/SlackIntegration.ts
import axios from 'axios';

export class SlackIntegration {
  private token: string;

  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN || '';
  }

  // 1. Send Message (Existing)
  async sendMessage(channel: string, message: string): Promise<string> {
    if (!this.token) return 'Error: SLACK_BOT_TOKEN not set in .env';
    try {
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        text: message,
      }, { headers: { Authorization: `Bearer ${this.token}` } });
      return `Successfully sent Slack message to ${channel}.`;
    } catch (error) {
      return `Error sending Slack message: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 2. Reply to a Thread
  async replyToThread(channel: string, threadTs: string, message: string): Promise<string> {
    if (!this.token) return 'Error: SLACK_BOT_TOKEN not set in .env';
    try {
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel,
        text: message,
        thread_ts: threadTs // This links it to the original message
      }, { headers: { Authorization: `Bearer ${this.token}` } });
      return `Successfully replied to thread ${threadTs} in ${channel}.`;
    } catch (error) {
      return `Error replying to thread: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 3. Read Recent Messages
  async readRecentMessages(channel: string): Promise<string> {
    if (!this.token) return 'Error: SLACK_BOT_TOKEN not set in .env';
    try {
      const res = await axios.get('https://slack.com/api/conversations.history', {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { channel, limit: 5 }
      });
      
      if (!res.data.ok) return `Slack API Error: ${res.data.error}`;
      
      let messages = `Recent messages in ${channel}:\n`;
      for (const msg of res.data.messages) {
        messages += `- [${msg.ts}] ${msg.text}\n`;
      }
      return messages;
    } catch (error) {
      return `Error reading messages: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 4. Search Channels
  async searchChannels(query: string): Promise<string> {
    if (!this.token) return 'Error: SLACK_BOT_TOKEN not set in .env';
    try {
      const res = await axios.get('https://slack.com/api/conversations.list', {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { types: 'public_channel,private_channel', limit: 200 }
      });
      
      if (!res.data.ok) return `Slack API Error: ${res.data.error}`;

      const matching = res.data.channels.filter((c: any) => 
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      
      if (matching.length === 0) return `No channels found matching: ${query}`;

      let result = `Found channels:\n`;
      matching.forEach((c: any) => result += `- Name: ${c.name} | ID: ${c.id}\n`);
      return result;
    } catch (error) {
      return `Error searching channels: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 5. Search Conversations (Messages)
  async searchConversations(query: string): Promise<string> {
    if (!this.token) return 'Error: SLACK_BOT_TOKEN not set in .env';
    try {
      const res = await axios.get('https://slack.com/api/search.messages', {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { query, count: 5 }
      });
      
      if (!res.data.ok) return `Slack API Error: ${res.data.error}`;
      if (!res.data.messages.matches || res.data.messages.matches.length === 0) {
        return `No messages found matching: ${query}`;
      }

      let result = `Found messages:\n`;
      for (const match of res.data.messages.matches) {
        result += `- [Channel: ${match.channel.name}] User: ${match.username} | Text: ${match.text}\n`;
      }
      return result;
    } catch (error) {
      return `Error searching conversations: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}