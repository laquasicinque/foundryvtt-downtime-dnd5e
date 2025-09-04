import type { DeepPartial, Mixin } from "fvtt-types/utils";
import { mount, unmount } from "svelte";
import type { ExtendedButton } from "../components/FormButtons.svelte";

const { ApplicationV2 } = foundry.applications.api;

type ConstructorOf<T> = new (...args: any[]) => T;

function SvelteApplicationMixin<
    BaseClass extends ConstructorOf<foundry.applications.api.ApplicationV2<any, Configuration, any>>,
>(BaseApplication: BaseClass) {
    // @ts-expect-error
    class SvelteApplication<
        // BaseClass is the class being mixed. This is given by `HandlebarsApplicationMixin`.
        BaseClassI extends ConstructorOf<foundry.applications.api.ApplicationV2<any, any, any>> = BaseClass,
        // These type parameters should _never_ be explicitly assigned to. They're
        // simply a way to make types more readable so that their names show up in
        // intellisense instead of a transformation of `BaseClass`.
        out RenderOptions extends foundry.applications.api.ApplicationV2.RenderOptions = BaseClassI extends ConstructorOf<
            foundry.applications.api.ApplicationV2<any, any, infer _RenderOptions>
        >
        ? _RenderOptions
        : never,
        out RenderContext extends object = BaseClassI extends ConstructorOf<
            foundry.applications.api.ApplicationV2<any, any, infer _RenderContext>
        >
        ? _RenderContext
        : never,
    > extends BaseApplication {
        declare props: Record<string, any>;

        #componentInstance: Record<string, any> | null = null;

        protected override async close(options: DeepPartial<SvelteApplicationMixin.ClosingOptions> = {}): Promise<this> {
            // Destroy Component instance
            if (this.#componentInstance) {
                unmount(this.#componentInstance);
                this.#componentInstance = null;
            }

            options.animate = false;
            return super.close(options);
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        override async _prepareContext(options: SvelteApplicationMixin.RenderOptions) {
            const context: Record<string, any> = {};
            return context;
        }

        override async _renderHTML(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            context: RenderContext,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            options: DeepPartial<RenderOptions>,
        ): Promise<any> {
            // Update context for props

            return "";
        }

        override _replaceHTML() { }

        override async _renderFrame(options: SvelteApplicationMixin.RenderOptions) {
            const context = await this._prepareContext(options);
            const frame = await super._renderFrame(options);

            const target = this.hasFrame ? frame.querySelector(".window-content") : frame;
            if (!target) return frame;

            const { component } = this.options.svelte ?? {};
            if (!component) return frame;

            // @ts-expect-error
            target.innerContent = "";

            const obj = {
                ...(this.options.buttons ? { buttons: this.options.buttons } : {}),
                sheet: this,
                actor: "actor" in this ? this.actor : undefined
            };

            this.#componentInstance = mount(component, {
                target,
                props: { ...this.props, ...context, ...obj },
                context: new Map<string, unknown>([
                    ["options", this.options],
                    ["application", this],
                    ["onSubmit", this.#onSubmitForm.bind(this)],
                ]),
            });

            return frame;
        }

        async #onSubmitForm(event: SubmitEvent) {
            event.preventDefault();
            const formConfig = this.options.form;

            if (!formConfig) return;

            const { handler, closeOnSubmit } = formConfig;
            const form = event.currentTarget as HTMLFormElement;
            const formData = new foundry.applications.ux.FormDataExtended(form);

            if (handler instanceof Function) await handler.call(this, event, form, formData);
            if (closeOnSubmit) await this.close();
        }
    }

    return SvelteApplication as Mixin<typeof SvelteApplication<BaseClass>, BaseClass>;
}

export type SvelteApplicationSvelteOptions = {
    component: any;
} & Record<string, unknown>;

export type Configuration<T = {}> = (
    | foundry.applications.api.ApplicationV2.Configuration
    | foundry.applications.api.DialogV2.Configuration
) & {
    buttons: ExtendedButton[];
    svelte: SvelteApplicationSvelteOptions;
} & T;

declare namespace SvelteApplicationMixin {
    type RenderOptions = foundry.applications.api.ApplicationV2.RenderOptions;
    type ClosingOptions = foundry.applications.api.ApplicationV2.ClosingOptions;
}

export { SvelteApplicationMixin };
