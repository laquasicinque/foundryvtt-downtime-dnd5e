declare global {
    interface ModuleConfig {
        "tidy5e-sheet": {
            api: import("../node_modules/tidy5e-sheet/src/api/Tidy5eSheetsApi.ts").Tidy5eSheetsApi;
        };
    }
}

export { };

declare module "fvtt-types/configuration" {
    namespace Hooks {
        interface HookConfig {
            "tidy5e-sheet.ready": () => void;
        }
    }
}
