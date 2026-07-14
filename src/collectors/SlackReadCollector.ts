import axios from 'axios';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';

export class SlackReadCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastTimestamp: string = '';

  constructor(private memoryService: MemoryService) {}

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Check every 60 seconds
    this.interval = setInterval(async () => {
      const token = process.env.SLACK_BOT_TOKEN;
      const channel = process.env.SLACK_CHANNEL_ID; // Add a channel ID to your .env
      if (!token || !channel) return;

      try {
        const response = await axios.get('https://slack.com/api/conversations.history', {
          headers: { Authorization: `Bearer ${token}` },
          params: { channel, limit: 5 }
        });

        if (response.data.ok && response.data.messages.length > 0) {
          const latestMessage = response.data.messages[0];
          if (latestMessage.ts !== this.lastTimestamp) {
            this.lastTimestamp = latestMessage.ts;
            await this.memoryService.storeEvent({
              type: 'SLACK_MESSAGE',
              app: channel,
              window: latestMessage.user,
              content: latestMessage.text,
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        // Silent fail
      }
    }, 60000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}