/**
 * Resilient WebSocket client for live block streaming and interactive refinement.
 */

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: any = null;
  private isIntentionallyClosed = false;
  private activeQueryId: string | null = null;
  public isConnected = false;

  public setActiveQueryId(queryId: string | null) {
    this.activeQueryId = queryId;
  }

  public getActiveQueryId(): string | null {
    return this.activeQueryId;
  }

  public connect(url?: string) {
    const defaultProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultHost = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
    const targetUrl = url || `${defaultProto}//${defaultHost}/ws/query`;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connection_status', { connected: true });
        // Send heartbeat ping
        this.send({ action: 'ping' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const type = message.type || 'message';

          // P1-17: Ignore stale inbound execution/stream frames from previous queries
          if (
            this.activeQueryId &&
            message.query_id &&
            message.query_id !== this.activeQueryId &&
            ['compile_plan', 'block_stream', 'execution_complete'].includes(type)
          ) {
            return;
          }

          this.emit(type, message.data !== undefined ? message.data : message);
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('connection_status', { connected: false });
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect(targetUrl);
        }
      };

      this.ws.onerror = (error) => {
        console.warn('WebSocket error encountered:', error);
      };
    } catch (err) {
      console.warn('Failed to establish WebSocket:', err);
      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect(targetUrl);
      }
    }
  }

  private scheduleReconnect(url: string) {
    if (this.isIntentionallyClosed) return;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (!this.isIntentionallyClosed) {
          this.connect(url);
        }
      }, delay);
    }
  }

  public send(payload: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const outbound = { ...payload };
      if (!outbound.query_id && this.activeQueryId) {
        outbound.query_id = this.activeQueryId;
      }
      this.ws.send(JSON.stringify(outbound));
    } else {
      console.warn('WebSocket not connected. Unable to send:', payload);
    }
  }

  public on(type: string, handler: MessageHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  public off(type: string, handler: MessageHandler) {
    this.listeners.get(type)?.delete(handler);
  }

  private emit(type: string, data: any) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (e) {
          console.error(`Error in WS handler for ${type}:`, e);
        }
      });
    }
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      const socket = this.ws;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.emit('connection_status', { connected: false });
  }
}

export const wsService = new WebSocketService();
