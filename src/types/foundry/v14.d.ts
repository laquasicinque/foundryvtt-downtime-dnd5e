/**
 * Foundry VTT v14: the parts this module uses, checked against 14.369.
 * Only the compat layer (src/foundry, src/dnd5e) uses these; everything else
 * uses the layer's neutral types (`Actor`, `User`, `ChatMessage`, …).
 * Write against `Foundry.latest`; name `Foundry.v14` only in code that
 * handles v14 specifically.
 */
declare namespace Foundry.v14 {
    // ── Documents ────────────────────────────────────────────────────────────

    interface Collection<T> extends Iterable<T> {
        readonly size: number;
        readonly contents: T[];
        get(id: string): T | undefined;
        getName(name: string): T | undefined;
        find(test: (value: T) => boolean): T | undefined;
    }

    /** `CONST.DOCUMENT_OWNERSHIP_LEVELS`. */
    interface OwnershipLevels {
        INHERIT: -1;
        NONE: 0;
        LIMITED: 1;
        OBSERVER: 2;
        OWNER: 3;
    }

    interface DocumentStats {
        modifiedTime: number | null;
        compendiumSource: string | null;
    }

    interface Document {
        readonly id: string;
        readonly uuid: string;
        readonly name: string;
        /** "Actor", "Item", … */
        readonly documentName: string;
        /** The compendium it's in, if any. */
        readonly pack: string | null;
        readonly parent: Document | null;
        readonly flags: Record<string, Record<string, unknown> | undefined>;
        readonly _stats: DocumentStats;
        /** The current user has OWNER permission. */
        readonly isOwner: boolean;
        getFlag(scope: string, key: string): unknown;
        setFlag(scope: string, key: string, value: unknown): Promise<this>;
        /** Update data may use dotted keys. */
        update(data: Record<string, unknown>): Promise<this | undefined>;
        delete(): Promise<this | undefined>;
        toObject(): Record<string, unknown>;
        testUserPermission(
            user: User,
            permission: keyof OwnershipLevels,
        ): boolean;
        createEmbeddedDocuments(
            embeddedName: string,
            data: object[],
        ): Promise<Document[]>;
        updateEmbeddedDocuments(
            embeddedName: string,
            updates: object[],
        ): Promise<Document[]>;
        deleteEmbeddedDocuments(
            embeddedName: string,
            ids: string[],
        ): Promise<Document[]>;
    }

    /** A document class, as `instanceof` and `create` need it. */
    interface DocumentClass<T extends Document> {
        new (data?: object): T;
        readonly prototype: T;
        create(data: object): Promise<T | undefined>;
    }

    /** A compendium index entry (what `fromUuidSync` gives for unloaded compendium documents). */
    interface IndexEntry {
        _id: string;
        uuid: string;
        name?: string;
        type?: string;
    }

    interface Actor extends Document {
        readonly type: string;
        readonly system: unknown;
        readonly items: Collection<Item>;
        /** An unlinked token's synthetic actor. */
        readonly isToken: boolean;
        readonly token: TokenDocument | null;
        readonly hasPlayerOwner: boolean;
        getRollData(): Record<string, unknown>;
    }

    interface TokenDocument extends Document {
        /** The token's own changes to its actor (unlinked tokens). */
        readonly delta: ActorDelta | null;
    }

    interface ActorDelta extends Document {}

    interface Item extends Document {
        readonly type: string;
        readonly system: unknown;
        readonly effects: Collection<ActiveEffect>;
    }

    interface ActiveEffect extends Document {}

    interface User extends Document {
        readonly isGM: boolean;
        /** The GM that runs GM-only work (queries, migrations). */
        readonly isActiveGM: boolean;
        /** Run a registered `CONFIG.queries` handler on this user's client. */
        query(
            name: string,
            data: unknown,
            options?: { timeout?: number },
        ): Promise<unknown>;
    }

    interface ChatMessage extends Document {}

    interface ChatMessageClass extends DocumentClass<ChatMessage> {
        getSpeaker(options?: { actor?: Actor }): object;
        getWhisperRecipients(name: string): User[];
        /** Apply a message mode's whisper and blind settings to message data (new in v14). */
        applyMode(data: object, mode: string): void;
    }

    interface JournalEntry extends Document {
        readonly pages: Collection<JournalEntryPage>;
    }

    interface JournalEntryPage extends Document {
        readonly type: string;
        readonly sort: number;
    }

    interface Macro extends Document {
        /** Resolves to what the macro's script returns. */
        execute(scope?: Record<string, unknown>): Promise<unknown>;
    }

    // ── Dice ─────────────────────────────────────────────────────────────────

    interface DiceTerm {
        readonly faces?: number;
        readonly number?: number;
        readonly total?: number;
    }

    interface Roll {
        readonly formula: string;
        /** Undefined until evaluated. */
        readonly total: number | undefined;
        readonly dice: readonly DiceTerm[];
        readonly options: { rollMode?: string } & Record<string, unknown>;
        evaluate(): Promise<this>;
        /** The roll as chat HTML. */
        render(): Promise<string>;
    }

    interface RollClass {
        new (formula: string, data?: Record<string, unknown>): Roll;
        fromJSON(json: string): Roll;
        fromData(data: object): Roll;
    }

    // ── Applications ─────────────────────────────────────────────────────────

    interface ApplicationConfiguration {
        id: string;
        classes: string[];
        tag: string;
        window: {
            frame?: boolean;
            title?: string;
            icon?: string | false;
            resizable?: boolean;
            minimizable?: boolean;
        };
        position: {
            top?: number;
            left?: number;
            width?: number | "auto";
            height?: number | "auto";
        };
        actions: Record<string, unknown>;
    }

    interface ApplicationRenderOptions {
        force?: boolean;
        isFirstRender?: boolean;
    }

    interface ApplicationClosingOptions {
        animate?: boolean;
    }

    /** Declared as a class so the module's windows can extend it. */
    interface ApplicationV2<
        Config extends ApplicationConfiguration = ApplicationConfiguration,
    > {
        readonly options: Config;
        readonly id: string;
        readonly title: string;
        /** The outer element, once rendered. */
        readonly element: HTMLElement;
        readonly rendered: boolean;
        readonly hasFrame: boolean;
        render(options?: ApplicationRenderOptions): Promise<this>;
        close(options?: ApplicationClosingOptions): Promise<this>;
        bringToFront(): void;
        _prepareContext(options: ApplicationRenderOptions): Promise<object>;
        _renderHTML(
            context: object,
            options: ApplicationRenderOptions,
        ): Promise<unknown>;
        _replaceHTML(
            result: unknown,
            content: HTMLElement,
            options: ApplicationRenderOptions,
        ): void;
        _renderFrame(options: ApplicationRenderOptions): Promise<HTMLElement>;
    }

    interface ApplicationV2Class {
        new <
            Config extends ApplicationConfiguration = ApplicationConfiguration,
        >(
            options?: object,
        ): ApplicationV2<Config>;
        readonly prototype: ApplicationV2;
    }

    /** What a dialog button's callback gets as its second argument. */
    interface DialogButton {
        form?: HTMLFormElement | null;
    }

    interface DialogV2Options {
        window?: { title?: string };
        /** HTML. */
        content?: string;
        /** Resolve with null instead of rejecting when the dialog is closed. */
        rejectClose?: boolean;
    }

    interface DialogV2Class {
        prompt<T>(
            options: DialogV2Options & {
                ok?: {
                    label?: string;
                    callback?: (event: Event, button: DialogButton) => T;
                };
            },
        ): Promise<T | null>;
        confirm(options: DialogV2Options): Promise<boolean | null>;
    }

    interface ContextMenuEntry {
        label: string;
        /** HTML. */
        icon: string;
        onClick: () => void;
        visible?: () => boolean;
    }

    interface ContextMenu {
        /** Undefined until the menu is first opened. */
        readonly element: HTMLElement | undefined;
        close(options?: { animate?: boolean }): Promise<void>;
    }

    interface FilePicker {
        render(options: ApplicationRenderOptions): Promise<this>;
    }

    // ── Game, UI and configuration ───────────────────────────────────────────

    interface Module {
        readonly id: string;
        readonly active: boolean;
        readonly version: string;
        /** Set by the module itself. */
        api?: unknown;
    }

    interface CompendiumCollection {
        /** "scope.name". */
        readonly collection: string;
        readonly locked: boolean;
        getIndex(): Promise<Iterable<IndexEntry>>;
    }

    interface ClientSettings {
        get(namespace: string, key: string): unknown;
        set(namespace: string, key: string, value: unknown): Promise<unknown>;
        register(namespace: string, key: string, data: object): void;
    }

    interface Game {
        readonly ready: boolean;
        readonly release: { generation: number; version: string };
        readonly system: { id: string; version: string };
        readonly i18n: {
            /** The client's language code, e.g. "en" or "pt-BR". */
            readonly lang: string;
            localize(key: string): string;
            format(key: string, data: Record<string, string>): string;
            /** Whether `key` has a translation (with `fallback`, also in the English fallback). */
            has(key: string, fallback?: boolean): boolean;
        };
        readonly modules: Collection<Module>;
        readonly settings: ClientSettings;
        readonly clipboard: { copyPlainText(text: string): Promise<void> };
        readonly user: User;
        readonly users: Collection<User> & { readonly activeGM: User | null };
        readonly actors: Collection<Actor>;
        readonly items: Collection<Item>;
        readonly macros: Collection<Macro>;
        readonly journal: Collection<JournalEntry>;
        readonly messages: Collection<ChatMessage>;
        readonly packs: Collection<CompendiumCollection>;
    }

    interface Notifications {
        info(message: string): unknown;
        warn(message: string): unknown;
        error(message: string): unknown;
    }

    interface UI {
        /** Missing before the UI is set up. */
        readonly notifications?: Notifications;
    }

    /** Returns the reply, or a promise of it. */
    type QueryHandler = (data: unknown, options: { user: User }) => unknown;

    interface Config {
        readonly queries: Record<string, QueryHandler>;
        readonly sounds: { readonly dice: string };
    }

    interface Const {
        readonly DOCUMENT_OWNERSHIP_LEVELS: OwnershipLevels;
    }

    interface Hooks {
        on(hook: string, fn: (...args: never[]) => unknown): number;
        once(hook: string, fn: (...args: never[]) => unknown): number;
        off(hook: string, id: number): void;
        callAll(hook: string, ...args: unknown[]): boolean;
    }

    /** The `foundry` global. */
    interface Namespace {
        readonly utils: {
            randomID(length?: number): string;
            escapeHTML(value: string): string;
            getProperty(object: object, path: string): unknown;
            setProperty(object: object, path: string, value: unknown): boolean;
            saveDataToFile(data: string, type: string, filename: string): void;
            readTextFromFile(file: File): Promise<string>;
            isNewerVersion(v1: string | number, v0: string | number): boolean;
        };
        readonly dice: { readonly Roll: RollClass };
        readonly documents: {
            readonly Actor: DocumentClass<Actor>;
            readonly Item: DocumentClass<Item>;
            readonly Macro: DocumentClass<Macro>;
            readonly JournalEntry: DocumentClass<JournalEntry>;
        };
        readonly data: {
            readonly operators: {
                /** Marks a key for deletion in update data (v14; earlier versions use `-=key`). */
                readonly ForcedDeletion: new () => object;
            };
        };
        readonly applications: {
            readonly api: {
                readonly ApplicationV2: ApplicationV2Class;
                readonly DialogV2: DialogV2Class;
            };
            /** Open applications by id. */
            readonly instances: Map<string, ApplicationV2>;
            readonly ux: {
                readonly ContextMenu: new (
                    container: HTMLElement,
                    selector: string,
                    entries: ContextMenuEntry[],
                    options: { jQuery: false; fixed?: boolean },
                ) => ContextMenu;
                readonly TextEditor: {
                    readonly implementation: {
                        getDragEventData(event: DragEvent): unknown;
                    };
                };
                readonly FormDataExtended: new (
                    form: HTMLFormElement,
                ) => object;
            };
            readonly apps: {
                readonly FilePicker: {
                    readonly implementation: new (options: {
                        type: "image";
                        current: string;
                        callback: (path: string) => void;
                    }) => FilePicker;
                };
            };
        };
    }
}
