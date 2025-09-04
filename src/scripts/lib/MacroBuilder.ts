import { isIterable, isNonStringIterable } from "it-al";

export class MacroBuilder {
  readonly #args: Map<string, unknown> = new Map();
  readonly #macro: Macro;

  constructor(macroOrUuid: string | Macro) {
    const macro =
      typeof macroOrUuid === "string" ? fromUuidSync(macroOrUuid) : macroOrUuid;
    if (!(macro instanceof Macro))
      throw new TypeError(
        "You must provide a uuid or Macro to the MacroBuilder constructor",
      );

    this.#macro = macro;
  }

  with(args: Iterable<[string, unknown]>): this;
  with(args: Record<string, unknown>): this;
  with(argName: string, arg: unknown): this;
  with(
    argsOrArgName:
      | string
      | Iterable<[string, unknown]>
      | Record<string, unknown>,
    arg?: unknown,
  ): this {
    if (typeof argsOrArgName === "string") {
      if (Number.isNumeric(argsOrArgName))
        throw new TypeError(
          "Illegal numeric Macro parameter passed to execution scope.",
        );
      this.#args.set(argsOrArgName, arg);
    } else {
      const args = isIterable(argsOrArgName)
        ? argsOrArgName
        : Object.entries(argsOrArgName);
      for (const [name, arg] of args) {
        if (Number.isNumeric(name))
          throw new TypeError(
            "Illegal numeric Macro parameter passed to execution scope.",
          );
        this.#args.set(name, arg);
      }
    }
    return this;
  }

  without(args: Iterable<string>): this;
  without(argName: string): this;
  without(argsOrArgName: string | Iterable<string>): this {
    if (isNonStringIterable(argsOrArgName)) {
      for (const name of argsOrArgName) {
        this.#args.delete(name);
      }
    } else {
      this.#args.delete(argsOrArgName);
    }
    return this;
  }

  #buildArgs(newArgs: Record<string, unknown> = {}) {
    const args = new Map([...this.#args, ...Object.entries(newArgs)]);
    // There are some values that we would like to ensure as arguments
    const actor = args.get("actor") as
      | dnd5e.documents.Actor5e<"character">
      | undefined;
    const existingToken = args.get("token") as
      | foundry.documents.TokenDocument
      | undefined;
    if (!args.has("speaker"))
      args.set(
        "speaker",
        foundry.documents.ChatMessage.implementation.getSpeaker({
          actor,
          token: existingToken,
        }),
      );
    const speaker = args.get("speaker") as ChatMessage.SpeakerData;
    if (!args.has("character")) args.set("character", game.user.character);
    if (!args.has("token"))
      args.set(
        "token",
        canvas.ready ? canvas.tokens?.get(speaker.token!) : null,
      );
    const token = args.get("token") as foundry.canvas.placeables.Token;
    if (!args.has("actor"))
      args.set(
        "actor",
        token?.actor || game.actors.get(speaker.actor!) || null,
      );

    return args;
  }

  execute(newArgs: Record<string, unknown> = {}) {
    const macro = new Macro(this.#macro);
    macro.ownership.default = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

    if (macro.type === "chat") return macro.execute();

    const args = this.#buildArgs(newArgs);

    const rawCmd = macro.command;
    let cmd = "";

    if (rawCmd.match(/\s*\(\s*(?:async)(?:\s+function)\s*\(/)) {
      cmd = `return ${rawCmd}`;
    } else {
      cmd = rawCmd;
    }
    /// @ts-expect-error
    const fn = new foundry.utils.AsyncFunction(...args.keys(), cmd);
    try {
      return fn.call(macro, ...args.values());
    } catch (err) {
      ui.notifications?.error("MACRO.Error", { localize: true });
    }
  }
}
