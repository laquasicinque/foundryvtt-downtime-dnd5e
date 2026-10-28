/**
 * Serialises async jobs: each job starts after the previous one settles.
 *
 * The GM runs every command through one queue rather than one per store.
 * Commands can touch several stores (ADJUST_PROGRESS into another item,
 * transfers), and a single queue rules out lock-ordering deadlocks.
 * Downtime write volume is far too low for this to be a bottleneck.
 */
export class SerialQueue {
    #tail: Promise<void> = Promise.resolve();

    run<T>(job: () => Promise<T>): Promise<T> {
        const previous = this.#tail;
        const result = (async () => {
            await previous;
            return job();
        })();
        this.#tail = settled(result);
        return result;
    }
}

/** Resolves once `promise` settles, whether it succeeds or fails (keeps the queue going). */
async function settled(promise: Promise<unknown>): Promise<void> {
    try {
        await promise;
    } catch {
        // The job's caller handles its error.
    }
}
