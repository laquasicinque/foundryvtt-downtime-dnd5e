import { AnyFunction, DeepPartial } from 'fvtt-types/utils';
import { App, createApp, h, reactive, ref } from 'vue';
import FormButtons from '../components/FormButtons.vue';
import { SheetKey } from '../composables/useSheet';

export const VueApplicationMixinVersion = '0.0.6';

const { ApplicationV2, DialogV2 } = foundry.applications.api

/**
 * Taken from https://github.com/mouse0270/fvtt-vue then modified for typescript
 */
export function VueApplicationMixin(BaseApplication: typeof ApplicationV2<any, any>) {
    type App2 = typeof VueApplication

    class VueApplication extends BaseApplication {
        /**
         * Indicates whether the application is in debug mode.
         * @type {boolean}
         */
        static DEBUG = false;

        /**
         * Indicates whether the application should be attached to the shadow dom.
         * @type {boolean}
         */
        static SHADOWROOT = false;


        /**
         * The parts of the Vue application.
         * @type {Object<string, *>}
         */
        static PARTS: Record<string, {
            app: unknown, component: unknown, template: unknown, props: Record<string, unknown>, use?: unknown, forms?: Record<string, {
                handler: (this: VueApplication, e: SubmitEvent, form: HTMLFormElement, formData: FormDataExtended) => void,
                closeOnSubmit?: boolean
                submitOnChange?: boolean
            }>
        }> = {};

        /**
         * Get the parts of the Vue application.
         * @returns {Object<string, *>} - The parts of the Vue application.
         */
        get parts() {
            return this.#parts;
        }

        /**
         * The private parts of the Vue application.
         * @type {Object<string, *>}
         */
        #parts: Record<string, { app: unknown, component: unknown, template: unknown, props: Record<string, unknown> }> = {};

        /**
         * The private containers for Vue instances.
         * @type {Object<string, Vue>}
         */
        #instance: App<Element> | null = null;

        /**
         * The private containers for Vue instances.
         * @type {Object<string, Object>}
         */
        #props: Record<string, Record<string, unknown>> = {};

        get #con() {
            return this.constructor as App2
        }

        /**
         * Configure the render options for the Vue application.
         * @param {Object} options - The render options.
         */
        _configureRenderOptions(options: foundry.applications.api.ApplicationV2.RenderOptions) {
            super._configureRenderOptions(options);
            options.parts ??= Object.keys(this.#con.PARTS);
        }

        /**
         * Perform pre-render operations before the first render of the Vue application.
         * @param {Object} context - The render context.
         * @param {Object} options - The render options.
         * @returns {Promise<void>}
         */
        // TODO: This function used to load vue files using SFC, but since that has been removed, this function appears to do nothing.
        // ?? Maybe this function should be removed or updated to do something else?
        async _preFirstRender(context: foundry.applications.api.ApplicationV2.RenderContext, options: foundry.applications.api.ApplicationV2.RenderOptions) {
            await super._preFirstRender(context, options);
        }

        /**
         * Render the HTML content of the Vue application.
         * @param {Object} context - The render context.
         * @param {Object} options - The render options.
         * @returns {Promise<Object<string, string>>} - The rendered HTML content.
         */
        async _renderHTML(context: foundry.applications.api.ApplicationV2.RenderContext, options: foundry.applications.api.ApplicationV2.RenderOptions & { props: Record<string, unknown>, parts: string[] }) {
            const rendered: Record<string, unknown> = {};
            if (this.#con.DEBUG) console.log(`VueApplicationMixin | _renderHTML |`, context, options);
            // Loop through the parts and render them
            for (const partId of options.parts) {
                // Get the part from the PARTS object
                const part = this.#con.PARTS[partId];

                // If part is not in the PARTS object, skip it
                if (!part) {
                    ui.notifications?.warn(`Part "${partId}" is not a supported template part for ${this.constructor.name}`);
                    continue;
                }

                // If props for the part don't exist, create them
                if (!this.#props?.[partId]) this.#props[partId] = reactive({ ...context, ...(options?.props ?? part?.props ?? {}) });
                // If props for the part exist, merge the options into the existing props
                else foundry.utils.mergeObject(this.#props[partId], options?.props ?? {}, { inplace: true, insertKeys: true });

                // Get the Part and add it to the rendered object
                rendered[partId] = await (part?.app ?? part?.component ?? part?.template);
            }

            if (this.#con.DEBUG) console.log(`VueApplicationMixin | _renderHTML | Vue Instances |`, this.#instance);
            return rendered;
        }

        /**
         * Replace the HTML content of the Vue application.
         * @param {Object<string, string>} result - The rendered HTML content.
         * @param {HTMLElement} content - The content element.
         * @param {Object} options - The render options.
         */
        _replaceHTML(result: Record<string, string>, content: HTMLElement, options: foundry.applications.api.ApplicationV2.RenderOptions) {
            if (this.#con.DEBUG) console.log(`VueApplicationMixin | _replaceHTML |`, result, content, options);
            // Check if the Vue Instance exists, if not create it
            if (!this.#instance) {
                const Instance = this;

                this.#instance = createApp({
                    render: () => Object.entries(result).map(([key, value]) =>
                        h(this.options.wrapper?.tag ?? 'div', {
                            // Add a data attribute dynamically
                            'data-application-part': key,
                            'class': this.options.wrapper?.class,
                            ...(this.options?.wrapper?.tag === 'form' ? {
                                onChange: (e: InputEvent) => {
                                    this.#onChangeForm(e.currentTarget as HTMLElement, e)
                                },
                                onSubmit: (e) => {
                                    this.#onSubmitForm(e.currentTarget as HTMLElement, e)
                                }
                            } : {})
                        }, [
                            // Insert the component inside this div along with the props for that component
                            h(value, { ...this.#props[key] }),
                            Object.entries(this.options?.buttons ?? {}).length ? h('footer', {
                                class: 'form-footer'
                            }, [
                                h(FormButtons, {
                                    buttons: this.options.buttons
                                })
                            ]) : undefined
                        ])
                    )
                }).mixin({
                    updated() {
                        if (Instance.#con.DEBUG) console.log(`VueApplicationMixin | _replaceHTML | Vue Instance Updated |`, this, Instance?.options);

                        // Resize the application window after the Vue Instance is updated
                        if (Instance?.options?.position?.height === "auto") Instance.setPosition({ height: "auto" });

                        // Call the render method when the Vue Instance is updated
                        // -- This will call FoundryVTTs Hooks related to rendering when Vue is updated
                        // -- Useful for when other modules listen for rendering events to inject HTML
                        Instance.render();
                    }
                }).provide(SheetKey, { isEditMode: ref(false) });

                // Attach .use() plugins to the Vue Instance
                for (const partId of options.parts) {
                    const part = this.#con.PARTS[partId];
                    if (part?.use) {
                        for (const [key, plugin] of Object.entries(part.use)) {
                            if (this.#con.DEBUG) console.log(`VueApplicationMixin | _replaceHTML | Mount Vue Instance | Use Plugin |`, key, plugin);
                            this.#instance.use(plugin.plugin, plugin?.options ?? {});
                        }
                    }
                }

                // Attach Part Listeners
                this._attachPartListeners(content, options);

                if (this.#con.DEBUG) console.log(`VueApplicationMixin | _replaceHTML | Mount Vue Instance |`, this.#instance);

                // Attach Shadow Root if Enabled
                if (this.#con.SHADOWROOT) content.attachShadow({ mode: 'open' });
                let root = this.#con.SHADOWROOT ? content.shadowRoot : content;

                // If Shadow Root is enabled, attach Styles to the Shadow Root
                if (this.#con.SHADOWROOT) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = '/modules/fvtt-vue-vite/dist/style.css';
                    content.shadowRoot?.appendChild(link);

                    const mountPoint = document.createElement('div');
                    root?.appendChild(mountPoint);
                    root = mountPoint;
                }

                // Mount the Vue Instance
                if (this.#con.DEBUG) console.log(`VueApplicationMixin | _replaceHTML | Root |`, root);
                if (!root) throw new Error("Root missing")
                this.#instance.mount(root as HTMLElement);
            }
        }



        /**
         * Attaches event listeners to the Vue Instance.
         *
         * @param {HTMLElement} content - The content element.
         * @param {Object} options - The options object.
         */
        _attachPartListeners(content: HTMLElement, options: foundry.applications.api.ApplicationV2.RenderOptions) {

            // Attach this.constructor.DEFAULT_OPTIONS.actions to the Vue Instance
            if (this.#con.DEFAULT_OPTIONS?.actions) {
                // Loop through the actions and bind them to the Vue Instance
                for (const [key, action] of Object.entries(this.#con.DEFAULT_OPTIONS.actions) as [string, AnyFunction][]) {
                    this.#instance?.provide(key, action.bind(this));
                }
            }
        }

        /**
         * Closes the application and unmounts all instances.
         *
         * @param {ApplicationClosingOptions} [options] - Optional parameters for closing the application.
         * @returns {Promise<BaseApplication>} - A Promise which resolves to the rendered Application instance.
         */
        async close(options: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions> = {}) {
            // Unmount the Vue Instance
            if (this.#instance) {
                this.#instance.unmount();
                this.#instance = null
            }

            // Call the close method of the base application
            return await super.close(options);
        }



        /**
         * Handles the form submission event.
         *
         * @private
         * @param {HTMLElement} htmlElement - The HTML element that triggered the event.
         * @param {Event} event - The form submission event.
         * @returns {Promise<void>} - A promise that resolves when the form submission is handled.
         */
        async #onSubmitForm(htmlElement: HTMLElement, event: SubmitEvent) {
            event.preventDefault();
            // Get the part ID from the data attribute
            const partId = htmlElement?.dataset?.applicationPart as string;
            // Get the part from the PARTS object
            const part = this.#con.PARTS[partId];

            // Skip if part is not found
            if (!part?.forms) return (console.warn("VueApplicationMixin | onSubmitForm | No forms found for part", partId));

            // Loop through the forms and check if the form is found
            for (const [selector, formConfig] of Object.entries(part.forms)) {
                const form = (htmlElement.matches(selector) ? htmlElement : htmlElement.querySelector(selector)) as HTMLFormElement;

                // Skip if form is not found
                if (!form) return;

                // Get the form data and call the handler function
                const { handler, closeOnSubmit } = formConfig;
                const formData = new foundry.applications.ux.FormDataExtended(form);
                if (handler instanceof Function) await handler.call(this, event, form, formData);
                // Close the form if closeOnSubmit is true
                if (closeOnSubmit) await this.close();
            }
        }

        /**
         * Handles the change event for a form element.
         *
         * @private
         * @param {HTMLElement} htmlElement - The HTML element that triggered the change event.
         * @param {Event} event - The change event object.
         * @returns {void}
         */
        #onChangeForm(htmlElement: HTMLElement, event: InputEvent) {
            // Get the part ID from the data attribute
            const partId = htmlElement?.dataset?.applicationPart as string;
            // Get the part from the PARTS object
            const part = this.#con.PARTS[partId];

            // Skip if part is not found
            if (!part?.forms) return (console.warn("VueApplicationMixin | onChangeForm | No forms found for part", partId));

            // Loop through the forms and check if the form is found
            for (const [selector, formConfig] of Object.entries(part.forms)) {
                const form = htmlElement.matches(selector) ? htmlElement : htmlElement.querySelector(selector);

                // Skip if form is not found
                if (!form) return;

                // Call the handler function if it exists
                if (formConfig?.submitOnChange) this.#onSubmitForm(htmlElement, event);
            }
        }
    }

    return VueApplication;
}
