type Prettify<T> = {
    [P in keyof T]: T[P];
} & {};

declare namespace Downtime {
    type MODULE_ID = "downtime-dnd5e";

    interface ActorSheetApplication extends dnd5e.applications.actor.ActorSheet5eCharacter2, SvelteSheet {
        activateTrainingTab: boolean;
        constructor: typeof dnd5e.applications.actor.ActorSheet5eCharacter2 & { MODE: { EDIT: number; VIEW: number } };
    }

    type SvelteSheet = Prettify<{
        [K in `__${MODULE_ID}_INSTANCE__`]: Record<string, any>;
    }>;

    type TrackedItem = TrackedItemV1;

    /**
     * Tracked Item V2
     */
    type TrackedItemV2 =
        | TrackedItemV2Fixed
        | TrackedItemV2Ability
        | TrackedItemV2Skill
        | TrackedItemV2Tool
        | TrackedItemV2Macro;

    type TrackedItemV2Fixed = Prettify<
        {
            progressionStyle: "FIXED";
            /**
             * The value is the fixed number to increment
             */
            value: number;
        } & TrackedItemBaseV2
    >;

    type TrackedItemV2Ability = Prettify<
        {
            progressionStyle: "ABILITY";
            /**
             * the ability to roll
             */
            value: dnd5e.types.Ability.TypeKey;
            dc?: number;
        } & TrackedItemBaseV2
    >;

    type TrackedItemV2Skill = Prettify<
        {
            progressionStyle: "SKILL";
            /**
             * The skill to roll
             */
            value: dnd5e.types.Skill.TypeKey;
            dc?: number;
        } & TrackedItemBaseV2
    >;

    type TrackedItemV2Tool = Prettify<
        {
            progressionStyle: "TOOL";
            /**
             * The tool to roll
             */
            value: string;
            dc?: number;
        } & TrackedItemBaseV2
    >;

    type TrackedItemV2Macro = Prettify<
        {
            progressionStyle: "MACRO";
            /**
             * The macro to roll
             */
            value: string;
        } & TrackedItemBaseV2
    >;

    /**
     * Tracked Item V1
     */
    type TrackedItemV1 =
        | TrackedItemV1Fixed
        | TrackedItemV1Ability
        | TrackedItemV1Skill
        | TrackedItemV1Tool
        | TrackedItemV1Macro;

    type TrackedItemV1Fixed = Prettify<
        {
            progressionStyle: "FIXED";
            fixedIncrease: number;
        } & TrackedItemBaseV1
    >;

    type TrackedItemV1Ability = Prettify<
        {
            progressionStyle: "ABILITY";
            ability: dnd5e.types.Ability.TypeKey;
        } & TrackedItemBaseV1
    >;

    type TrackedItemV1Skill = Prettify<
        { progressionStyle: "SKILL"; skill: dnd5e.types.Skill.TypeKey } & TrackedItemBaseV1
    >;

    type TrackedItemV1Tool = Prettify<{ progressionStyle: "TOOL"; tool: string } & TrackedItemBaseV1>;

    type TrackedItemV1Macro = Prettify<{ progressionStyle: "MACRO"; macroName: string } & TrackedItemBaseV1>;

    type I18nKeys = keyof typeof import("./languages/en.json");

    type Category = {
        id: string;
        name: string;
        description: string;
    };

    type CategoryWithActivities = {
        id: string;
        name: string;
        description: string;
        activities: (TrackedItem & {
            dc: string | undefined;
            progressPercent: number;
            isComplete: boolean;
        })[];
    };

    type TrackedItemBaseV1 = {
        id: string;
        name: string;
        img: string;
        category: string;
        hidden: boolean;
        chat_icon?: string;
        description: string;
        dc?: number;
        progress: number;
        completionAt: number;
        changes: AuditLogV1[];
        schemaVersion: number;
    };

    type TrackedItemBaseV2 = {
        id: string;
        name: string;
        img: string;
        category: string;
        hidden: boolean;
        chat_icon?: string;
        description: string;
        progress: number;
        completionAt: number;
        changes: AuditLogV2[];
        schemaVersion: number;
    };

    type AuditLogV1 = {
        id: string;
        timestamp: string | Date;
        actionName: string;
        valueChanged: "progress";
        oldValue: number;
        newValue: number;
        dismissed?: boolean;
        user: string;
        note: "";
    };

    type AuditLogV2 = {
        id: string;
        timestamp: number;
        actionName: string;
        valueChanged: "progress";
        oldValue: number;
        newValue: number;
        user: {
            name: string;
            id: string | null;
        };
        dismissed?: boolean;
        note: "";
    };

    type ProgressionStyle = TrackedItem["progressionStyle"];

    type DropdownOptions = {
        abilities: ReadonlyArray<{ value: string; type: string; label: string }>;
        skills: ReadonlyArray<{ value: string; type: string; label: string }>;
        tools: ReadonlyArray<{ value: string; label: string }>;
    };

    // Extended roll type that supports additional module properties
    type Roll = foundry.dice.Roll.Any & {
        // BetterRolls support
        BetterRoll?: {
            entries: Array<{
                type: string;
                entries: Array<{ total: number }>;
            }>;
        };
    };

    type ActorResolvable = dnd5e.documents.Actor5e<'character'> | string
}
