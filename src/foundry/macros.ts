/** Macros: lookups, creation and execution, and what code outside the compat layer can read from one. */

type MacroDocument = Foundry.latest.Macro;

declare const brand: unique symbol;

/** A macro as code outside the compat layer sees it (at runtime, the document itself). */
export interface Macro {
    readonly uuid: string;
    readonly name: string;
    readonly [brand]: "Macro";
}

const macroDocument = (macro: Macro) => macro as unknown as MacroDocument;
const asMacro = (document: MacroDocument) => document as unknown as Macro;

export function macroByName(name: string): Macro | null {
    const macro = game.macros.getName(name);
    return macro ? asMacro(macro) : null;
}

/** A macro by uuid, falling back to a world macro by name. */
export async function findMacro(
    uuid: string | null,
    name: string | null = null,
): Promise<Macro | null> {
    const doc = uuid ? await fromUuid(uuid) : null;
    const byUuid =
        doc?.documentName === "Macro" ? asMacro(doc as MacroDocument) : null;
    return byUuid ?? (name ? macroByName(name) : null);
}

/** Create a world script macro; resolves to its uuid. */
export async function createScriptMacro(data: {
    name: string;
    img: string;
    command: string;
}): Promise<string | null> {
    const created = await foundry.documents.Macro.create({
        ...data,
        type: "script",
    });
    return created?.uuid ?? null;
}

/** Run a macro with extra variables in its scope; resolves to what it returns. */
export async function executeMacro(
    macro: Macro,
    scope: Record<string, unknown>,
): Promise<unknown> {
    return macroDocument(macro).execute(scope);
}
