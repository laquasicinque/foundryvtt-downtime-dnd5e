/**
 * dnd5e 6: the parts this module uses, checked against 6.0.6. Only the
 * compat layer (src/dnd5e) uses these. Write against `Dnd5e.latest`; name
 * `Dnd5e.v6` only in code that handles v6 specifically.
 */
declare namespace Dnd5e.v6 {
    // ── Keys ─────────────────────────────────────────────────────────────────
    // dnd5e's own keys. Modules can add more to CONFIG.DND5E; those work at
    // runtime (checked with `key in CONFIG.DND5E.*`) but aren't typed here.

    type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

    type SkillKey =
        | "acr"
        | "ani"
        | "arc"
        | "ath"
        | "dec"
        | "his"
        | "ins"
        | "itm"
        | "inv"
        | "med"
        | "nat"
        | "prc"
        | "prf"
        | "per"
        | "rel"
        | "slt"
        | "ste"
        | "sur";

    type ToolKey =
        | "alchemist"
        | "bagpipes"
        | "brewer"
        | "calligrapher"
        | "card"
        | "carpenter"
        | "cartographer"
        | "chess"
        | "cobbler"
        | "cook"
        | "dice"
        | "disg"
        | "drum"
        | "dulcimer"
        | "flute"
        | "forg"
        | "glassblower"
        | "herb"
        | "horn"
        | "jeweler"
        | "leatherworker"
        | "lute"
        | "lyre"
        | "mason"
        | "navg"
        | "painter"
        | "panflute"
        | "pois"
        | "potter"
        | "shawm"
        | "smith"
        | "thief"
        | "tinker"
        | "viol"
        | "weaver"
        | "woodcarver";

    // ── Rolls ────────────────────────────────────────────────────────────────

    interface D20Roll extends Foundry.v14.Roll {
        /** The d20 term; its `total` is the kept face. */
        readonly d20: { readonly total: number | undefined } | undefined;
    }

    /** The parts of dnd5e's roll process configuration this module passes. */
    interface CheckConfig {
        ability?: AbilityKey;
        /** The DC. */
        target?: number;
        /** Extra parts, e.g. an activity's bonus. */
        rolls?: { parts: string[] }[];
    }

    /** dnd5e's roll methods resolve to the rolls, or null if cancelled. */
    type Rolls = Promise<D20Roll[] | null>;

    // ── Documents ────────────────────────────────────────────────────────────

    interface ActorSystem {
        readonly abilities?: Record<string, { value?: number; mod?: number }>;
        readonly skills?: Record<string, { value?: number; total?: number }>;
        readonly tools?: Record<string, { value?: number }>;
    }

    interface Actor extends Foundry.v14.Actor {
        readonly type: "character" | "npc" | "vehicle" | "group" | "encounter";
        readonly system: ActorSystem;
        readonly items: Foundry.v14.Collection<Item>;
        rollAbilityCheck(config: CheckConfig & { ability: AbilityKey }): Rolls;
        rollSkill(config: CheckConfig & { skill: SkillKey }): Rolls;
        rollToolCheck(
            config: CheckConfig & {
                tool: ToolKey;
                /** An owned tool item's own bonus, proficiency and the item. */
                bonus?: string;
                prof?: object;
                item?: ToolItem;
            },
        ): Rolls;
        rollSavingThrow(config: {
            ability: AbilityKey;
            target?: number;
        }): Rolls;
    }

    interface ItemSystem {
        readonly identifier?: string;
        readonly quantity?: number;
    }

    interface Item extends Foundry.v14.Item {
        readonly system: ItemSystem;
    }

    interface ToolItem extends Item {
        readonly type: "tool";
        readonly system: ItemSystem & {
            readonly type: { value: string; baseItem: ToolKey | "" };
            /** A formula, or "". */
            readonly bonus: string;
            readonly prof: object;
            readonly activities: Iterable<Activity>;
        };
        /** Forwards to the owner's `rollToolCheck` with this tool's settings. */
        rollToolCheck(config?: CheckConfig): Rolls;
    }

    /** The parts of an activity the built-in roll adapters read. */
    interface Activity {
        readonly id: string;
        /** "check", "save", "utility", or a module's own type. */
        readonly type: string;
        readonly name: string;
        readonly item: Item;
        getRollData(): Record<string, unknown>;
        getAbility?(associated: string): AbilityKey | null | undefined;
        readonly check?: {
            readonly ability?: AbilityKey;
            /** Skill and tool keys. */
            readonly associated?: Iterable<string>;
            readonly bonus?: string;
            readonly dc?: { value?: number | null };
        };
        readonly save?: {
            readonly ability?: Iterable<AbilityKey>;
            readonly dc?: { value?: number | null };
        };
        readonly roll?: { formula?: string; name?: string };
        rollFormula?(
            config?: object,
            dialog?: object,
            message?: object,
        ): Promise<Foundry.v14.Roll[] | void>;
    }

    // ── Applications ─────────────────────────────────────────────────────────

    /** The static parts of an actor sheet class this module extends. */
    interface ActorSheetClass {
        TABS: { label: string; tab: string; icon: string }[];
        PARTS: Record<string, { template: string }>;
    }

    /** What this module reads from an actor sheet (dnd5e's and Tidy5e's both have these). */
    interface ActorSheet {
        readonly actor: Actor;
        readonly isEditMode?: boolean;
        readonly element?: HTMLElement | null;
    }

    // ── Configuration ────────────────────────────────────────────────────────

    /** What dnd5e adds to `CONFIG`. */
    interface Config {
        readonly DND5E: {
            readonly abilities: Record<
                AbilityKey,
                { label: string; abbreviation: string }
            >;
            readonly skills: Record<
                SkillKey,
                { label: string; ability: AbilityKey }
            >;
            /** Includes tools added by modules. */
            readonly tools: Record<string, { ability: AbilityKey; id: string }>;
        };
        readonly Dice: {
            readonly BasicRoll: {
                /** Resolve `@` references in a formula against roll data. */
                replaceFormulaData(
                    formula: string,
                    data: Record<string, unknown>,
                    options?: { missing?: string; warn?: boolean },
                ): string;
            };
        };
    }

    /** The `dnd5e` global. */
    interface Namespace {
        readonly documents: {
            readonly Actor5e: Foundry.v14.DocumentClass<Actor>;
            readonly Item5e: Foundry.v14.DocumentClass<Item>;
            readonly Trait: {
                keyLabel(
                    key: string,
                    options: { trait: "tool" | "skills" | "languages" },
                ): string | undefined;
            };
        };
        readonly applications: {
            readonly actor: {
                readonly CharacterActorSheet: ActorSheetClass;
                readonly NPCActorSheet: ActorSheetClass;
            };
        };
    }
}
