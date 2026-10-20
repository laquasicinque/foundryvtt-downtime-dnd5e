/**
 * Base class of the module's windows: an ApplicationV2 that mounts
 * `options.svelte.component` into its content, with what `_prepareContext`
 * returns plus `sheet` (the window) as props.
 */
import { type Component, mount, unmount } from "svelte";
import { ApplicationV2 } from "./applications";

type RenderOptions = Foundry.latest.ApplicationRenderOptions;

/** A window's options: Foundry's, the Svelte component, and the window's own (`T`). */
export type Configuration<T = {}> = Foundry.latest.ApplicationConfiguration & {
    svelte: { component: Component<any> };
} & T;

export class SvelteApplication<T = {}> extends ApplicationV2<Configuration<T>> {
    #component: Record<string, unknown> | null = null;

    override async close(
        options: Foundry.latest.ApplicationClosingOptions = {},
    ): Promise<this> {
        if (this.#component) {
            void unmount(this.#component);
            this.#component = null;
        }
        return super.close({ ...options, animate: false });
    }

    override async _prepareContext(_options: RenderOptions): Promise<object> {
        return {};
    }

    // The component renders the content, not Foundry's HTML rendering.
    override async _renderHTML(): Promise<string> {
        return "";
    }

    override _replaceHTML(): void {}

    override async _renderFrame(options: RenderOptions): Promise<HTMLElement> {
        const context = await this._prepareContext(options);
        const frame = await super._renderFrame(options);
        const target = this.hasFrame
            ? frame.querySelector(".window-content")
            : frame;
        if (!target) return frame;
        this.#component = mount(this.options.svelte.component, {
            target,
            props: { ...context, sheet: this },
        });
        return frame;
    }
}
