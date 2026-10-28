/** Moving and copying tracked items between stores: the choices a transfer is made with. */

export type TransferMode = "MOVE" | "COPY";

/** OUTGOING: a transferred item references one that isn't. INCOMING (MOVE): an item left behind references a moved one. */
export type ReferenceChoice =
    /** Transfer the other item along (OUTGOING: same mode; INCOMING: move it too). */
    | "INCLUDE"
    /** OUTGOING on MOVE: leave it, put a copy in the destination. */
    | "COPY_DEPENDENCY"
    /** Delete the requirement / action holding the reference. */
    | "REMOVE"
    /** Leave it as it is; it won't resolve (requirement unmet, adjustment fails). */
    | "KEEP";

export interface TransferChoices {
    references?: Record<string, ReferenceChoice>;
    recipients?: Record<string, "SWITCH" | "KEEP">;
    categories?: Record<string, "CREATE" | "UNCATEGORISED">;
}
