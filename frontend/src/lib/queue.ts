export type QueueTask<T> = (signal: AbortSignal) => Promise<T>;

interface PendingTask<T> {
    task: QueueTask<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
    controller: AbortController;
}

export class RequestQueue {
    private limit: number;
    private active = 0;
    private queue: Array<PendingTask<unknown>> = [];

    constructor(limit = 1) {
        this.limit = Math.max(1, limit);
    }

    enqueue<T>(task: QueueTask<T>) {
        const controller = new AbortController();
        const promise = new Promise<T>((resolve, reject) => {
            const pending: PendingTask<T> = {
                task,
                resolve,
                reject,
                controller,
            };
            this.queue.push(pending as PendingTask<unknown>);
            this.dequeue();
        });

        return {
            promise,
            cancel: () => controller.abort(),
            signal: controller.signal,
        };
    }

    private dequeue() {
        if (this.active >= this.limit) return;
        const pending = this.queue.shift();
        if (!pending) return;
        if ((pending.controller as AbortController).signal.aborted) {
            pending.reject(new DOMException("Cancelled", "AbortError"));
            this.dequeue();
            return;
        }
        this.active += 1;
        pending
            .task((pending.controller as AbortController).signal)
            .then((result) => pending.resolve(result))
            .catch((error) => pending.reject(error))
            .finally(() => {
                this.active -= 1;
                this.dequeue();
            });
    }
}
