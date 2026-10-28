/**
 * The parts of the Tidy5e Sheets API this module uses. Declared here rather
 * than imported from `tidy5e-sheet`'s source, which isn't built for consumers
 * (importing it pulls its whole source tree into our type check).
 */
declare namespace Tidy5e {
    interface TabRenderParams {
        app: import("../dnd5e/sheets").ActorSheet;
        element: HTMLElement;
        data: { actor: import("../foundry/actors").Actor };
        isFullRender: boolean;
        tabContentsElement: HTMLElement;
    }

    interface HtmlTabConfig {
        html: string;
        title: string;
        iconClass: string;
        tabId: string;
        renderScheme: "handlebars" | "force";
        onRender(params: TabRenderParams): void;
        enabled(data?: unknown): boolean;
    }

    interface Api {
        models: {
            HtmlTab: new (config: HtmlTabConfig) => unknown;
        };
        registerCharacterTab(
            tab: unknown,
            options?: { overrideExisting?: boolean },
        ): void;
        registerNpcTab(
            tab: unknown,
            options?: { overrideExisting?: boolean },
        ): void;
    }
}
