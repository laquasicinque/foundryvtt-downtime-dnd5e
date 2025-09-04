import type { AnyFunction } from "../types";

type SheetStoredValues = {
  instance?: {}; // the output of mount
  element?: HTMLElement; // The element the instance is mounted to
  version: number;
  api: {
    /**
     * Subscribes to version changes
     */
    subs: <Fn extends AnyFunction>(fn: Fn) => Fn;
    /**
     * triggers/publishes version changes
     */
    pubs: <Fn extends AnyFunction>(fn: Fn) => Fn;
  };
};

type Application =
  | foundry.applications.api.ApplicationV2
  | Downtime.ActorSheetApplication;
const sheets = new WeakMap<Application, SheetStoredValues>();

export function getSvelteInstance(sheet: Application): {} | undefined {
  return sheets.get(sheet)?.instance;
}

export function setSvelteInstance(
  sheet: Application,
  instance: {} | undefined,
) {
  const obj = ensureSheetStoredValues(sheet);
  obj.instance = instance;
}

export function getSvelteElement(sheet: Application): HTMLElement | undefined {
  return sheets.get(sheet)?.element;
}

export function setSvelteElement(
  sheet: Application,
  element: HTMLElement | undefined,
) {
  const obj = ensureSheetStoredValues(sheet);
  obj.element = element;
}

export function triggerUpdates(sheet: Application) {
  const values = sheets.get(sheet);
  if (values) values.version++;
  else throw new Error("No versioning on sheet");
}

export function getSheetFns(sheet: Application) {
  return sheets.get(sheet)!.api;
}

export function ensureSheetStoredValues(sheet: Application) {
  const values = sheets.get(sheet);
  if (values) return values;

  const newValues = $state({
    version: 0,
    api: {
      subs:
        <T>(fn: () => T) =>
        () => {
          // gotta reference the version so this gets called within
          newValues.version;
          return fn();
        },
      pubs: <T extends AnyFunction>(fn: T) => {
        return (...args: Parameters<T>) => {
          const result = fn(...args);
          if (!(result instanceof Promise)) {
            newValues.version++;
            return result;
          }
          // for promises, we wrap in an async IIFE to keep our stack trace so we can await
          return (async () => {
            const awaitedResult = await result;
            newValues.version++;
            return awaitedResult;
          })();
        };
      },
    },
  }) as SheetStoredValues;
  sheets.set(sheet, newValues);

  return newValues;
}
