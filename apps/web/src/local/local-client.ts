import type { WorkerMessage, WorkerRequest, WorkerResponseMap } from "./protocol.ts";

/** メインスレッドから db-worker を呼び出すクライアント。 */
export class LocalClient {
  private readonly worker: Worker;
  private readonly waiting = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private nextId = 1;

  constructor() {
    this.worker = new Worker(new URL("./db-worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const message = e.data;
      const pending = this.waiting.get(message.id);
      if (pending === undefined) return;
      this.waiting.delete(message.id);
      if (message.ok) {
        pending.resolve(message.value);
      } else {
        pending.reject(new Error(message.error));
      }
    };
  }

  request<R extends WorkerRequest>(request: R): Promise<WorkerResponseMap[R["type"]]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ id, request });
    });
  }
}
