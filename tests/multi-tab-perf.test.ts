import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSharedSseLeader } from "../frontend/lib/sharedSseLeader.js";
import { syncBus } from "../backend/syncBus.js";
import { getCoalescedShopCtvStatus } from "../backend/shopAuth/accountStatusCache.js";

function createMockBus() {
  const rooms = new Map<string, Set<MockBC>>();
  class MockBC {
    name: string;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    closed = false;
    constructor(name: string) {
      this.name = name;
      if (!rooms.has(name)) rooms.set(name, new Set());
      rooms.get(name)!.add(this);
    }
    postMessage(data: unknown) {
      if (this.closed) return;
      const set = rooms.get(this.name);
      if (!set) return;
      for (const peer of set) {
        if (peer === this || peer.closed || !peer.onmessage) continue;
        peer.onmessage({ data } as MessageEvent);
      }
    }
    close() {
      this.closed = true;
      rooms.get(this.name)?.delete(this);
    }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  }
  return MockBC as unknown as typeof BroadcastChannel;
}

function createMockLocks() {
  type QueueEntry = {
    cb: (lock: unknown) => Promise<void>;
    aborted: boolean;
    reject: (err: Error) => void;
  };
  const held = new Map<string, boolean>();
  const queues = new Map<string, QueueEntry[]>();

  const pump = (name: string) => {
    if (held.get(name)) return;
    const q = queues.get(name);
    if (!q?.length) return;
    while (q.length) {
      const next = q.shift()!;
      if (next.aborted) continue;
      held.set(name, true);
      Promise.resolve(next.cb({ name, mode: "exclusive" })).finally(() => {
        held.set(name, false);
        pump(name);
      });
      return;
    }
  };

  return {
    request(name: string, opts: LockOptions, cb: (lock: unknown) => Promise<void>) {
      return new Promise<void>((resolve, reject) => {
        const entry: QueueEntry = {
          aborted: Boolean(opts.signal?.aborted),
          reject,
          cb: async (lock) => {
            try {
              await cb(lock);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        };
        if (entry.aborted) {
          reject(new Error("AbortError"));
          return;
        }
        opts.signal?.addEventListener?.(
          "abort",
          () => {
            entry.aborted = true;
            reject(new Error("AbortError"));
          },
          { once: true },
        );
        if (!queues.has(name)) queues.set(name, []);
        queues.get(name)!.push(entry);
        pump(name);
      });
    },
  };
}

function createMockEventSourceClass() {
  const instances: MockES[] = [];
  class MockES {
    url: string;
    closed = false;
    onopen: ((ev: Event) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    private listeners = new Map<string, Array<(ev: MessageEvent) => void>>();

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }
    addEventListener(type: string, fn: (ev: MessageEvent) => void) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type)!.push(fn);
    }
    emitOpen() {
      this.onopen?.({} as Event);
    }
    emitServerEvent(type: string, data: unknown) {
      const raw = typeof data === "string" ? data : JSON.stringify(data);
      for (const fn of this.listeners.get(type) || []) {
        fn({ data: raw } as MessageEvent);
      }
    }
    close() {
      this.closed = true;
    }
  }
  return { MockES: MockES as unknown as typeof EventSource, instances };
}

describe("multi-tab performance & leader SSE sharing", () => {
  it("opens only 1 SSE connection across tabs, fans out events, and fails over cleanly", async () => {
    const BroadcastChannelCtor = createMockBus();
    const locks = createMockLocks();
    const { MockES, instances } = createMockEventSourceClass();
    const env = { EventSourceCtor: MockES, BroadcastChannelCtor, locks };

    const received: Array<{ tab: number; type: string; data: string; fromLeader: boolean }> = [];
    const states: Array<{ tab: number; connected: boolean; isLeader: boolean }> = [];

    const startTab = (tab: number) =>
      createSharedSseLeader({
        lockName: "aloha_sse_test",
        channelName: "aloha_sse_test",
        url: "/api/shop/test/stream",
        events: ["hello", "change"],
        env,
        onEvent: (type, data, meta) => {
          received.push({ tab, type, data, fromLeader: meta.fromLeader });
        },
        onConnectionChange: (s) => {
          states.push({ tab, ...s });
        },
      });

    const stop1 = startTab(1);
    const stop2 = startTab(2);
    const stop3 = startTab(3);
    await new Promise((r) => setTimeout(r, 15));

    assert.equal(instances.length, 1, "3 tabs must share strictly 1 EventSource");
    const firstEs = instances[0] as unknown as {
      emitOpen: () => void;
      emitServerEvent: (t: string, d: unknown) => void;
      closed: boolean;
    };
    firstEs.emitOpen();
    firstEs.emitServerEvent("hello", { rev: 10 });
    firstEs.emitServerEvent("change", { ids: ["CH01"] });

    // Latecomer tab 4 should inherit hello + connected status without opening EventSource
    const stop4 = startTab(4);
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(instances.length, 1, "Latecomer tab must not open a second EventSource");

    const changes = received.filter((r) => r.type === "change");
    assert.equal(changes.length, 3, "Tabs 1..3 must all receive the change event");
    assert.equal(changes.find((c) => c.tab === 1)?.fromLeader, true);
    assert.equal(changes.find((c) => c.tab === 2)?.fromLeader, false);
    assert.equal(changes.find((c) => c.tab === 3)?.fromLeader, false);

    assert.ok(
      received.some((r) => r.tab === 4 && r.type === "hello" && r.data === '{"rev":10}'),
      "Tab 4 must receive cached hello baseline via BroadcastChannel",
    );
    assert.ok(
      states.some((s) => s.tab === 4 && s.connected === true && s.isLeader === false),
      "Tab 4 must learn connected status without HTTP request",
    );

    // Close Leader (tab 1) -> Tab 2 must take over cleanly
    stop1();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(firstEs.closed, true);
    assert.equal(instances.length, 2, "Tab 2 must open a single failover EventSource");

    const secondEs = instances[1] as unknown as typeof firstEs;
    secondEs.emitOpen();
    secondEs.emitServerEvent("change", { ids: ["CH02"] });

    const secondWave = received.filter((r) => r.type === "change" && r.data.includes("CH02"));
    assert.equal(secondWave.length, 3, "Remaining tabs 2, 3, 4 must all receive failover event");
    assert.equal(secondWave.find((c) => c.tab === 2)?.fromLeader, true);
    assert.equal(secondWave.find((c) => c.tab === 3)?.fromLeader, false);
    assert.equal(secondWave.find((c) => c.tab === 4)?.fromLeader, false);

    stop2();
    stop3();
    stop4();
  });

  it("pauses EventSource in hidden tabs and resumes when visible when Web Locks unavailable", async () => {
    const { MockES, instances } = createMockEventSourceClass();
    const visListeners = new Set<() => void>();
    const doc = {
      visibilityState: "visible" as DocumentVisibilityState,
      addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
        if (type === "visibilitychange" && typeof fn === "function") {
          visListeners.add(fn as () => void);
        }
      },
      removeEventListener(type: string, fn: EventListenerOrEventListenerObject) {
        if (type === "visibilitychange" && typeof fn === "function") {
          visListeners.delete(fn as () => void);
        }
      },
    };

    const stop = createSharedSseLeader({
      lockName: "aloha_sse_fallback",
      channelName: "aloha_sse_fallback",
      url: "/api/shop/fallback/stream",
      events: ["hello"],
      hiddenGraceMs: 25,
      env: { EventSourceCtor: MockES, documentObj: doc },
      onEvent: () => {},
    });

    try {
      assert.equal(instances.length, 1);
      doc.visibilityState = "hidden";
      for (const fn of visListeners) fn();

      await new Promise((r) => setTimeout(r, 45));
      assert.equal((instances[0] as unknown as { closed: boolean }).closed, true);

      doc.visibilityState = "visible";
      for (const fn of visListeners) fn();
      assert.equal(instances.length, 2, "Must reconnect immediately when tab becomes visible again");
    } finally {
      stop();
    }
  });

  it("configures syncBus max listeners for concurrent streams and coalesces ctvStatus reads", async () => {
    assert.ok(syncBus.getMaxListeners() >= 200);

    let findOneCount = 0;
    const projections: unknown[] = [];
    const fakeDb = async () =>
      ({
        collection: () => ({
          findOne: async (_q: unknown, opts: { projection?: unknown }) => {
            findOneCount += 1;
            projections.push(opts?.projection);
            await new Promise((r) => setTimeout(r, 15));
            return { ctvStatus: "active" };
          },
        }),
      }) as never;

    const batch = await Promise.all(
      Array.from({ length: 10 }, () => getCoalescedShopCtvStatus(fakeDb, "u-42", "evt-1")),
    );
    assert.deepEqual(batch, Array(10).fill("active"));
    assert.equal(findOneCount, 1, "10 concurrent listeners on same eventId must coalesce into 1 query");
    assert.deepEqual(projections[0], { _id: 0, ctvStatus: 1 });

    await getCoalescedShopCtvStatus(fakeDb, "u-42", "evt-2");
    assert.equal(findOneCount, 2, "Distinct eventId must query fresh status");
  });
});
