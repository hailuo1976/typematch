import type { WsMessage } from '@typematch/shared';
import { useGameStore } from '../stores/gameStore';

type MessageHandler = (message: WsMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] 已连接:', this.url);
          this.reconnectAttempts = 0;
          useGameStore.getState().setWsConnected(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WsMessage;
            this.dispatch(message);
          } catch (err) {
            console.error('[WS] 消息解析失败:', err);
          }
        };

        this.ws.onclose = () => {
          console.log('[WS] 连接关闭');
          useGameStore.getState().setWsConnected(false);
          this.tryReconnect();
        };

        this.ws.onerror = (err) => {
          console.error('[WS] 连接错误:', this.url, err);
          reject(new Error(`WebSocket 连接失败: ${this.url}`));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] 达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WS] ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => { /* 重连失败，等待下次 */ });
    }, delay);
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    }
  }

  private dispatch(message: WsMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach(h => h(message));
    }
    const allHandlers = this.handlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(h => h(message));
    }
  }

  send<T>(type: string, payload: T): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] 未连接，无法发送消息');
      return;
    }

    const message: WsMessage<T> = {
      type: type as WsMessage['type'],
      payload,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useGameStore.getState().setWsConnected(false);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

let wsClientInstance: WsClient | null = null;

export function getWsClient(): WsClient | null {
  return wsClientInstance;
}

export function createWsClient(url: string): WsClient {
  if (wsClientInstance) {
    wsClientInstance.disconnect();
  }
  wsClientInstance = new WsClient(url);
  return wsClientInstance;
}

export function buildWsUrl(host: string, port?: number): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (port) {
    return `${protocol}//${host}:${port}/ws`;
  }
  return `${protocol}//${window.location.host}/ws`;
}
