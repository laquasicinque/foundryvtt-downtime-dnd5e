// This is only required for roll options
declare global {
  interface ModuleConfig {
    "midi-qol": {
      api: any;
    };
  }
}

export {};

declare module "fvtt-types/configuration" {
  interface ModuleConfig {
    "midi-qol": {
      api: any;
    };
  }

  interface RequiredModules {
    "midi-qol": true;
  }
}
