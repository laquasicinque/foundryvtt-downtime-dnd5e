/**
 * Activity roll adapter registry. Generic over the activity and
 * actor types so the registry logic is testable; the Foundry adapters live in
 * the runtime layer.
 */
import type {
    ActivityRollAdapter,
    ActivityRollOption,
} from "../types/activities";

export class ActivityAdapterRegistry<Activity = unknown, Actor = unknown> {
    readonly #adapters = new Map<
        string,
        ActivityRollAdapter<Activity, Actor>
    >();

    private readonly warn: (message: string) => void;

    constructor(warn: (message: string) => void = () => {}) {
        this.warn = warn;
    }

    /** Last registration for a type wins, with a warning naming both sources. */
    register(adapter: ActivityRollAdapter<Activity, Actor>): void {
        const existing = this.#adapters.get(adapter.type);
        if (existing && existing.source !== adapter.source) {
            this.warn(
                `Activity adapter for "${adapter.type}" from ${adapter.source} replaces the one from ${existing.source}`,
            );
        }
        this.#adapters.set(adapter.type, adapter);
    }

    unregister(type: string): boolean {
        return this.#adapters.delete(type);
    }

    get(type: string): ActivityRollAdapter<Activity, Actor> | undefined {
        return this.#adapters.get(type);
    }

    types(): string[] {
        return [...this.#adapters.keys()];
    }

    /**
     * Roll options for an activity. Unknown types and adapters that throw
     * produce no options (the throw is reported, never propagated).
     */
    optionsFor(
        activity: Activity & { type: string },
        actor: Actor,
    ): ActivityRollOption[] {
        const adapter = this.#adapters.get(activity.type);
        if (!adapter) return [];
        try {
            return adapter.options(activity, actor);
        } catch (error) {
            this.warn(
                `Activity adapter for "${activity.type}" (${adapter.source}) failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return [];
        }
    }
}
