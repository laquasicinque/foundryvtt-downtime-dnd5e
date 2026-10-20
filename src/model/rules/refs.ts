import type {
    Id,
    ItemRef,
    Requirement,
    TrackedItemData,
} from "../../types/data";

/**
 * The stores visible when resolving a reference, in resolution order:
 * same store → world store → acting actor's store.
 */
export interface RefContext {
    self: TrackedItemData;
    sameStore: readonly TrackedItemData[];
    worldStore: readonly TrackedItemData[] | null;
    actingActorStore: readonly TrackedItemData[] | null;
}

export function resolveRef(
    ref: ItemRef,
    ctx: RefContext,
): TrackedItemData | null {
    if (ref.kind === "SELF") return ctx.self;
    return (
        findById(ctx.sameStore, ref.id) ??
        findById(ctx.worldStore, ref.id) ??
        findById(ctx.actingActorStore, ref.id) ??
        null
    );
}

function findById(
    items: readonly TrackedItemData[] | null,
    id: Id,
): TrackedItemData | undefined {
    return items?.find((item) => item.id === id);
}

/**
 * Every tracked item id an item references: item-level and method
 * requirements, and ADJUST_PROGRESS actions.
 */
export function referencedIds(item: TrackedItemData): Set<Id> {
    const ids = new Set<Id>();
    const add = (ref: ItemRef) => {
        if (ref.kind === "ITEM" && ref.id !== item.id) ids.add(ref.id);
    };
    const requirements = [
        ...item.requirements,
        ...item.methods.flatMap((method) => method.requirements),
    ];
    for (const requirement of requirements) {
        if (
            requirement.test.kind === "PROGRESS" ||
            requirement.test.kind === "MILESTONE"
        ) {
            add(requirement.test.ref);
        }
    }
    for (const milestone of item.milestones) {
        for (const action of milestone.actions) {
            if (action.kind === "ADJUST_PROGRESS") add(action.ref);
        }
    }
    return ids;
}

/** Rewrite references after an id collision on transfer. */
export function remapRefs(
    item: TrackedItemData,
    mapping: ReadonlyMap<Id, Id>,
): TrackedItemData {
    const remap = (ref: ItemRef): ItemRef =>
        ref.kind === "ITEM" && mapping.has(ref.id)
            ? { kind: "ITEM", id: mapping.get(ref.id)! }
            : ref;

    const remapRequirement = (requirement: Requirement): Requirement =>
        requirement.test.kind === "PROGRESS" ||
        requirement.test.kind === "MILESTONE"
            ? {
                  ...requirement,
                  test: {
                      ...requirement.test,
                      ref: remap(requirement.test.ref),
                  },
              }
            : requirement;

    return {
        ...item,
        requirements: item.requirements.map(remapRequirement),
        methods: item.methods.map((method) => ({
            ...method,
            requirements: method.requirements.map(remapRequirement),
        })),
        milestones: item.milestones.map((milestone) => ({
            ...milestone,
            actions: milestone.actions.map((action) =>
                action.kind === "ADJUST_PROGRESS"
                    ? { ...action, ref: remap(action.ref) }
                    : action,
            ),
        })),
    };
}
