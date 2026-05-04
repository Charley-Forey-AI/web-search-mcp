import PQueue from "p-queue";

const queues = new Map<string, PQueue>();

export function getProviderQueue(provider: string): PQueue {
  if (!queues.has(provider)) {
    queues.set(
      provider,
      new PQueue({
        concurrency: 2,
        intervalCap: 5,
        interval: 1000,
      }),
    );
  }
  return queues.get(provider)!;
}

const hostQueues = new Map<string, PQueue>();

export function withHostConcurrency<T>(host: string, task: () => Promise<T>) {
  if (!hostQueues.has(host)) {
    hostQueues.set(host, new PQueue({ concurrency: 2 }));
  }
  return hostQueues.get(host)!.add(task) as Promise<T>;
}
