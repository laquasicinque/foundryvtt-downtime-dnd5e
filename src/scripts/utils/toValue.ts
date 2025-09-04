import type { MaybeGetter } from "../types";

export const toValue = <T>(value: MaybeGetter<T>): T => {
  return typeof value === "function" ? (value as Function)() : value;
};
