import { exec } from 'child_process';
import { promisify } from 'util';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';
import { setCurrentApp, isCaptureExcluded } from './activeAppState';

const execAsync = promisify(exec);

export class ActiveWindowCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastWindow = '';

  constructor(private memoryService: MemoryService) {}

  private async getActiveWindow(): Promise<{ app: string, window: string } | null> {
    const platform = process.platform;
    const sessionType = process.env.XDG_SESSION_TYPE || '';

    try {
      let windowName = '';

      if (platform === 'darwin') {
        // macOS - Fixed escaping issue by using a heredoc approach
        const script = `tell application "System Events" to tell (first application process whose frontmost is true) to get {name, title of front window}`;
        const { stdout } = await execAsync(`osascript -e '${script}'`);
        const parts = stdout.trim().split(', ');
        return { app: parts[0] || 'Unknown', window: parts[1] || parts[0] || 'Unknown' };
      } else if (platform === 'win32') {
        const psScript = `(Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object -First 1).MainWindowTitle`;
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`);
        windowName = stdout.trim();
      } else if (platform === 'linux') {
        if (sessionType === 'wayland') {
          const { stdout } = await execAsync(`gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "global.display.get_focus_window().get_title()"`);
          const match = stdout.match(/'(.*)'/);
          windowName = match && match[1] ? match[1] : '';
        } else {
          const { stdout } = await execAsync(`xdotool getactivewindow getwindowname`);
          windowName = stdout.trim();
        }
      }

      if (windowName) {
        let app = "Unknown";
        let window = windowName;
        if (windowName.includes(" - ")) {
          const parts = windowName.split(" - ");
          app = parts[parts.length - 1].trim();
          window = parts[0].trim();
        }
        return { app, window };
      }
    } catch (error) {
      // Logged silently to avoid terminal spam, but could be upgraded to debug logs
      // console.error('[ActiveWindowCollector] Error:', error instanceof Error ? error.message : error);
    }
    return null;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.interval = setInterval(async () => {
      try {
        const windowInfo = await this.getActiveWindow();
        if (windowInfo && windowInfo.app) {
          // Track the focused app so other collectors can pause on sensitive apps.
          setCurrentApp(windowInfo.app);
        }
        // Don't record activity for excluded (sensitive) apps.
        if (windowInfo && windowInfo.app && isCaptureExcluded(windowInfo.app)) return;
        if (windowInfo && windowInfo.window && windowInfo.window !== this.lastWindow) {
          this.lastWindow = windowInfo.window;
          await this.memoryService.storeEvent({
            type: 'APP_ACTIVITY',
            app: windowInfo.app,
            window: windowInfo.window,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error('[ActiveWindowCollector] Interval crashed:', error);
      }
    }, 5000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}