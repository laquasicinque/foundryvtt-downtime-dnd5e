declare global {
  namespace Hooks {
    interface HookConfig {
      TrainingTabReady: (
        app: Downtime.ActorSheetApplication,
        html: HTMLFormElement,
        data: Record<string, unknown>,
      ) => void;

      renderActorSheetV2: (
        sheet: Downtime.ActorSheetApplication,
        html: HTMLFormElement,
        context: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => void;
    }
  }

  interface AssumeHookRan {
    setup: never; // the type doesn't matter
    init: never; // the type doesn't matter
  }

  interface ModuleConfig {
    "downtime-dnd5e": {
      api: any;
    };
  }

  interface SystemConfig {
    Item: {
      moduleSubType: "ignore";
      base: "ignore";
    };
  }

  interface SettingConfig {
    "downtime-dnd5e.resetAllSettings": unknown;
    "downtime-dnd5e.config": unknown;
    "downtime-dnd5e.lastMigrationApplied": number;
    "downtime-dnd5e.showImportButton": boolean;
    "downtime-dnd5e.gmOnlyMode": boolean;
    "downtime-dnd5e.gmOnlyEditMode": boolean;
    "downtime-dnd5e.enableTraining": boolean;
    "downtime-dnd5e.enableTrainingNpc": boolean;
    "downtime-dnd5e.tabName": string;
    "downtime-dnd5e.extraSheetWidth": number;
    "downtime-dnd5e.totalToComplete": number;
    "downtime-dnd5e.announceCompletionFor": "pc" | "npc" | "both" | "none";
    "downtime-dnd5e.debug": boolean;
    "downtime-dnd5e.activities": Downtime.TrackedItem[];
    "downtime-dnd5e.categories": Downtime.Category[];
  }

  interface FlagConfig {
    Actor: {
      "downtime-dnd5e": {
        trainingItems: Downtime.TrackedItem[];
        categories: Downtime.Category[];
      };
    };
  }

  interface RequiredModules {
    "downtime-dnd5e": true;
  }
}

export {};

declare module "fvtt-types/configuration" {
  namespace Hooks {
    interface HookConfig {
      TrainingTabReady: (
        app: Downtime.ActorSheetApplication,
        html: HTMLFormElement,
        data: Record<string, unknown>,
      ) => void;

      renderActorSheetV2: (
        sheet: Downtime.ActorSheetApplication,
        html: HTMLFormElement,
        context: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => void;
    }
  }

  interface AssumeHookRan {
    setup: never; // the type doesn't matter
    init: never; // the type doesn't matter
  }

  interface ModuleConfig {
    "downtime-dnd5e": {
      api: any;
    };
  }

  interface SystemConfig {
    Item: {
      moduleSubType: "ignore";
      base: "ignore";
    };
  }

  interface SettingConfig {
    "downtime-dnd5e.resetAllSettings": unknown;
    "downtime-dnd5e.config": unknown;
    "downtime-dnd5e.lastMigrationApplied": number;
    "downtime-dnd5e.showImportButton": boolean;
    "downtime-dnd5e.gmOnlyMode": boolean;
    "downtime-dnd5e.gmOnlyEditMode": boolean;
    "downtime-dnd5e.enableTraining": boolean;
    "downtime-dnd5e.enableTrainingNpc": boolean;
    "downtime-dnd5e.tabName": string;
    "downtime-dnd5e.extraSheetWidth": number;
    "downtime-dnd5e.totalToComplete": number;
    "downtime-dnd5e.announceCompletionFor": "pc" | "npc" | "both" | "none";
    "downtime-dnd5e.debug": boolean;
    "downtime-dnd5e.activities": Downtime.TrackedItem[];
    "downtime-dnd5e.categories": Downtime.Category[];
  }

  interface FlagConfig {
    Actor: {
      "downtime-dnd5e": {
        trainingItems: Downtime.TrackedItem[];
        categories: Downtime.Category[];
      };
    };
  }

  interface RequiredModules {
    "downtime-dnd5e": true;
  }
}
