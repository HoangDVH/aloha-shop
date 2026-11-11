export interface SharedSseEventMeta {
  fromLeader: boolean;
  type: string;
}

export interface SharedSseConnectionState {
  connected: boolean;
  isLeader: boolean;
}

export interface SharedSseLeaderHelpers {
  isLeader: () => boolean;
  emitLocalAndBroadcast: (type: string, data: string) => void;
}

export interface SharedSseEnv {
  EventSourceCtor?: typeof EventSource;
  BroadcastChannelCtor?: typeof BroadcastChannel;
  locks?: Pick<LockManager, "request">;
  documentObj?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
}

export interface SharedSseOptions {
  lockName: string;
  channelName: string;
  url: string;
  withCredentials?: boolean;
  events: string[];
  onEvent: (type: string, rawData: string, meta: SharedSseEventMeta) => void;
  onConnectionChange?: (state: SharedSseConnectionState, helpers: SharedSseLeaderHelpers) => void;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  hiddenGraceMs?: number;
  env?: SharedSseEnv;
}

interface BroadcastPacket {
  kind: "sse" | "status" | "sync_hello" | "hello_reply";
  senderId?: string;
  to?: string;
  type?: string;
  data?: string;
  connected?: boolean;
}

export function isPageVisible(
  doc: Pick<Document, "visibilityState"> | undefined = typeof document !== "undefined" ? document : undefined,
): boolean {
  return !doc || doc.visibilityState === "visible";
}

export function onPageVisible(
  cb: () => void,
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> | undefined =
    typeof document !== "undefined" ? document : undefined,
): () => void {
  if (!doc) return () => {};
  const onVis = () => {
    if (doc.visibilityState === "visible") cb();
  };
  doc.addEventListener("visibilitychange", onVis);
  return () => doc.removeEventListener("visibilitychange", onVis);
}

/**
 * Shares a single EventSource SSE connection across all same-origin tabs via
 * Web Locks leader election + BroadcastChannel fan-out, with visibility pause
 * fallback when cross-tab APIs are unavailable.
 */
export function createSharedSseLeader(options: SharedSseOptions): () => void {
  const {
    lockName,
    channelName,
    url,
    withCredentials = false,
    events,
    onEvent,
    onConnectionChange,
    baseBackoffMs = 1500,
    maxBackoffMs = 30_000,
    hiddenGraceMs = 15_000,
    env,
  } = options;

  const hasEnv = Boolean(env);
  const ES = hasEnv ? env?.EventSourceCtor : (typeof EventSource !== "undefined" ? EventSource : undefined);
  const BC = hasEnv ? env?.BroadcastChannelCtor : (typeof BroadcastChannel !== "undefined" ? BroadcastChannel : undefined);
  const locks = hasEnv ? env?.locks : (typeof navigator !== "undefined" && navigator.locks ? navigator.locks : undefined);
  const doc = env?.documentObj ?? (typeof document !== "undefined" ? document : undefined);

  if (!ES) return () => {};

  const tabId = `${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  let stopped = false;
  let isLeader = false;
  let connected = false;
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let lastHelloData: string | null = null;
  let releaseLock: (() => void) | null = null;
  let bc: BroadcastChannel | null = null;
  const lockAbort = typeof AbortController !== "undefined" ? new AbortController() : null;

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const clearHiddenTimer = () => {
    if (hiddenTimer) {
      clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
  };

  const closeEs = () => {
    if (!es) return;
    try {
      es.close();
    } catch {
      /* */
    }
    es = null;
  };

  const postBc = (packet: BroadcastPacket) => {
    try {
      bc?.postMessage(packet);
    } catch {
      /* */
    }
  };

  const helpers: SharedSseLeaderHelpers = {
    isLeader: () => isLeader,
    emitLocalAndBroadcast: (type, data) => {
      if (stopped) return;
      if (type === "hello") lastHelloData = data;
      onEvent(type, data, { fromLeader: isLeader, type });
      postBc({ kind: "sse", senderId: tabId, type, data });
    },
  };

  const setLeaderConnected = (next: boolean) => {
    if (!isLeader || connected === next) return;
    connected = next;
    postBc({ kind: "status", senderId: tabId, connected: next });
    onConnectionChange?.({ connected: next, isLeader: true }, helpers);
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    const base = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, attempt));
    const jitter = Math.floor(Math.random() * 600);
    attempt = Math.min(attempt + 1, 6);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectEs();
    }, base + jitter);
  };

  function connectEs() {
    if (stopped || es) return;
    try {
      const conn = withCredentials ? new ES!(url, { withCredentials: true }) : new ES!(url);
      es = conn;
      conn.onopen = () => {
        if (stopped || es !== conn) return;
        attempt = 0;
        setLeaderConnected(true);
      };
      for (const evName of events) {
        conn.addEventListener(evName, (ev) => {
          if (stopped || es !== conn) return;
          attempt = 0;
          setLeaderConnected(true);
          const raw = String((ev as MessageEvent).data ?? "");
          helpers.emitLocalAndBroadcast(evName, raw);
        });
      }
      conn.onerror = () => {
        if (stopped || es !== conn) return;
        closeEs();
        setLeaderConnected(false);
        scheduleReconnect();
      };
    } catch {
      setLeaderConnected(false);
      scheduleReconnect();
    }
  }

  const onVisibility = () => {
    if (stopped || !doc) return;
    if (doc.visibilityState === "visible") {
      clearHiddenTimer();
      if (((!locks || !BC) || isLeader) && !es) {
        attempt = 0;
        clearReconnect();
        connectEs();
      }
      return;
    }
    if (!locks || !BC) {
      clearHiddenTimer();
      hiddenTimer = setTimeout(() => {
        hiddenTimer = null;
        clearReconnect();
        closeEs();
        setLeaderConnected(false);
      }, hiddenGraceMs);
    }
  };

  doc?.addEventListener("visibilitychange", onVisibility);

  if (locks && BC) {
    try {
      bc = new BC(channelName);
      bc.onmessage = (ev: MessageEvent<BroadcastPacket>) => {
        if (stopped) return;
        const msg = ev.data;
        if (!msg || typeof msg !== "object") return;
        if (msg.kind === "sse" && msg.senderId !== tabId && typeof msg.type === "string") {
          onEvent(msg.type, String(msg.data ?? ""), { fromLeader: false, type: msg.type });
        } else if (msg.kind === "status" && !isLeader && typeof msg.connected === "boolean") {
          onConnectionChange?.({ connected: msg.connected, isLeader: false }, helpers);
        } else if (msg.kind === "hello_reply" && msg.to === tabId && !isLeader) {
          if (typeof msg.connected === "boolean") {
            onConnectionChange?.({ connected: msg.connected, isLeader: false }, helpers);
          }
          if (typeof msg.data === "string") {
            onEvent("hello", msg.data, { fromLeader: false, type: "hello" });
          }
        } else if (msg.kind === "sync_hello" && isLeader && msg.senderId) {
          postBc({
            kind: "hello_reply",
            to: msg.senderId,
            data: lastHelloData ?? undefined,
            connected,
          });
        }
      };
      postBc({ kind: "sync_hello", senderId: tabId });
    } catch {
      bc = null;
    }
  }

  if (locks && bc) {
    const reqOpts: LockOptions = lockAbort
      ? { mode: "exclusive", signal: lockAbort.signal }
      : { mode: "exclusive" };
    Promise.resolve(
      locks.request(lockName, reqOpts, () => {
        return new Promise<void>((resolve) => {
          if (stopped) {
            resolve();
            return;
          }
          releaseLock = resolve;
          isLeader = true;
          connectEs();
        });
      }),
    ).catch(() => {
      // Aborted pending lock requests reject cleanly on tab unmount
    });
  } else {
    isLeader = true;
    if (isPageVisible(doc)) connectEs();
  }

  return () => {
    if (stopped) return;
    stopped = true;
    doc?.removeEventListener("visibilitychange", onVisibility);
    clearReconnect();
    clearHiddenTimer();
    const wasLeader = isLeader;
    closeEs();
    if (wasLeader && connected) {
      connected = false;
      onConnectionChange?.({ connected: false, isLeader: true }, helpers);
    }
    isLeader = false;
    try {
      lockAbort?.abort();
    } catch {
      /* */
    }
    if (releaseLock) {
      const done = releaseLock;
      releaseLock = null;
      done();
    }
    try {
      bc?.close();
    } catch {
      /* */
    }
    bc = null;
  };
}
