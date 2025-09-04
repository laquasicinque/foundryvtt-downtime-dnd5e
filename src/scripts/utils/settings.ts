import { Iter } from "it-al";
import CONSTANTS from "../constants";

type KeyFor<K extends ClientSettings.Namespace> = ClientSettings.KeyFor<K>;

export const settings = new Proxy(
  {
    safeSet(
      k: KeyFor<"downtime-dnd5e">,
      v: unknown,
      options?: ClientSettings.SetOptions<undefined>,
    ) {
      return game.settings.set(CONSTANTS.MODULE_ID, k, v, options);
    },
  },
  {
    get(target, p, receiver) {
      if (p === "safeSet") return Reflect.get(target, p, receiver);
      return game.settings.get(
        CONSTANTS.MODULE_ID,
        p as KeyFor<"downtime-dnd5e">,
      );
    },
    set(target, p, newValue, receiver) {
      game.settings.set(
        CONSTANTS.MODULE_ID,
        p as KeyFor<"downtime-dnd5e">,
        newValue,
      );
      return true;
    },
    ownKeys(target) {
      return Iter.from(game.settings.settings)
        .filter(([key]) => key.startsWith(CONSTANTS.MODULE_ID))
        .pluck(0)
        .map((key) => key.slice(CONSTANTS.MODULE_ID.length + 1))
        .toArray();
    },
    has(target, p) {
      return game.settings.settings.has(
        `${CONSTANTS.MODULE_ID}.${p as KeyFor<"downtime-dnd5e">}`,
      );
    },
  },
) as unknown as Prettify<
  {
    [K in Extract<
      keyof SettingConfig,
      `downtime-dnd5e.${string}`
    > as K extends `downtime-dnd5e.${infer M}` ? M : never]: SettingConfig[K];
  } & {
    safeSet(
      k: KeyFor<"downtime-dnd5e">,
      v: unknown,
      options?: ClientSettings.SetOptions,
    ): Promise<unknown>;
  }
>;
