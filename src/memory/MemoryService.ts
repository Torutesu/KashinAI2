import { PrismaClient } from '@prisma/client';
import { ContextEvent } from '../types';

export class MemoryService {
  private prisma = new PrismaClient();

  async storeEvent(event: ContextEvent) {
    if (event.type === 'APP_ACTIVITY') {
      return this.prisma.appActivity.create({
        data: { app: event.app!, window: event.window || '' },
      });
    }
    if (event.type === 'CLIPBOARD') {
      return this.prisma.clipboardHistory.create({
        data: { content: event.content! },
      });
    }
  }

  async getRecentContext(limit: number = 10) {
    const apps = await this.prisma.appActivity.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
    const clips = await this.prisma.clipboardHistory.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
    return { recentApps: apps, recentClipboard: clips };
  }

  async searchMemory(query: string) {
    const apps = await this.prisma.appActivity.findMany({
      where: { window: { contains: query } },
    });
    const clips = await this.prisma.clipboardHistory.findMany({
      where: { content: { contains: query } },
    });
    return { apps, clips };
  }
}