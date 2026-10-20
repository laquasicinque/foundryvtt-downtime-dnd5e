/**
 * Moving and copying tracked items between stores, as a pure
 * plan: which items go, which references would break and what to do about
 * them, categories, and the resulting writes. The GM executor recomputes the
 * plan from current data and applies it; the dialog shows the same plan.
 *
 * - MOVE keeps the item (and its history). COPY creates a fresh copy with no
 *   history, like Duplicate.
 * - Ids are kept unless they collide in the destination; references inside
 *   the transferred set follow renamed ids.
 */
import { actionRecipient } from "../rules/milestones";
import { remapRefs, resolveRef, type RefContext } from "../rules/refs";
import type {
    CategoryData,
    Id,
    ItemRef,
    MilestoneAction,
    StoreRef,
    TrackedItemData,
} from "../../types/data";
import type {
    ReferenceChoice,
    TransferChoices,
    TransferMode,
} from "../../types/transfer";
import { storeKey } from "./stores";
import { getOrInsertComputed } from "../../lib/collections";

/** A place in an item that references another tracked item. */
export interface ItemRequirementSite {
    kind: "ITEM_REQUIREMENT";
    requirementId: Id;
    targetId: Id;
}

export interface MethodRequirementSite {
    kind: "METHOD_REQUIREMENT";
    methodId: Id;
    requirementId: Id;
    targetId: Id;
}

/** An ADJUST_PROGRESS action. */
export interface ActionSite {
    kind: "ACTION";
    milestoneId: Id;
    actionId: Id;
    targetId: Id;
}

export type RefSite = ItemRequirementSite | MethodRequirementSite | ActionSite;

const siteKey = (itemId: Id, site: RefSite) =>
    site.kind === "ACTION"
        ? `${itemId}:action:${site.actionId}`
        : `${itemId}:req:${site.requirementId}`;

/** Every reference to another tracked item, with where it sits. */
export function refSites(item: TrackedItemData): RefSite[] {
    const sites: RefSite[] = [];
    const target = (ref: ItemRef) =>
        ref.kind === "ITEM" && ref.id !== item.id ? ref.id : null;
    for (const requirement of item.requirements) {
        const t = requirement.test;
        if (t.kind !== "PROGRESS" && t.kind !== "MILESTONE") continue;
        const id = target(t.ref);
        if (id)
            sites.push({
                kind: "ITEM_REQUIREMENT",
                requirementId: requirement.id,
                targetId: id,
            });
    }
    for (const method of item.methods) {
        for (const requirement of method.requirements) {
            const t = requirement.test;
            if (t.kind !== "PROGRESS" && t.kind !== "MILESTONE") continue;
            const id = target(t.ref);
            if (id)
                sites.push({
                    kind: "METHOD_REQUIREMENT",
                    methodId: method.id,
                    requirementId: requirement.id,
                    targetId: id,
                });
        }
    }
    for (const milestone of item.milestones) {
        for (const action of milestone.actions) {
            if (action.kind !== "ADJUST_PROGRESS") continue;
            const id = target(action.ref);
            if (id)
                sites.push({
                    kind: "ACTION",
                    milestoneId: milestone.id,
                    actionId: action.id,
                    targetId: id,
                });
        }
    }
    return sites;
}

/** The item without the requirement / action at `site`. */
export function removeRefSite(
    item: TrackedItemData,
    site: RefSite,
): TrackedItemData {
    switch (site.kind) {
        case "ITEM_REQUIREMENT":
            return {
                ...item,
                requirements: item.requirements.filter(
                    (r) => r.id !== site.requirementId,
                ),
            };
        case "METHOD_REQUIREMENT":
            return {
                ...item,
                methods: item.methods.map((m) =>
                    m.id === site.methodId
                        ? {
                              ...m,
                              requirements: m.requirements.filter(
                                  (r) => r.id !== site.requirementId,
                              ),
                          }
                        : m,
                ),
            };
        case "ACTION":
            return {
                ...item,
                milestones: item.milestones.map((m) =>
                    m.id === site.milestoneId
                        ? {
                              ...m,
                              actions: m.actions.filter(
                                  (a) => a.id !== site.actionId,
                              ),
                          }
                        : m,
                ),
            };
    }
}

export interface TransferInput {
    mode: TransferMode;
    source: StoreRef;
    dest: StoreRef;
    sourceItems: readonly TrackedItemData[];
    sourceCategories: readonly CategoryData[];
    destItems: readonly TrackedItemData[];
    destCategories: readonly CategoryData[];
    /** World store items (for resolving references from an actor store). null if unavailable. */
    worldItems: readonly TrackedItemData[] | null;
    /** The items the user picked. */
    itemIds: readonly Id[];
}

export interface ReferenceIssue {
    key: string;
    direction: "OUTGOING" | "INCOMING";
    /** The item holding the reference. */
    itemId: Id;
    itemName: string;
    site: RefSite;
    /** The referenced item (name null when it can't be found at all). */
    targetId: Id;
    targetName: string | null;
    options: ReferenceChoice[];
    choice: ReferenceChoice;
}

export interface RecipientIssue {
    key: string;
    itemId: Id;
    itemName: string;
    milestoneId: Id;
    actionId: Id;
    /** SWITCH → TRIGGERING_ACTOR; KEEP → the action will fail in the world. */
    choice: "SWITCH" | "KEEP";
}

export interface CategoryIssue {
    /** Source category name. */
    name: string;
    choice: "CREATE" | "UNCATEGORISED";
}

export interface TransferEntry {
    sourceId: Id;
    /** Id in the destination (differs on collision). */
    destId: Id;
    name: string;
    mode: TransferMode;
    why: "SELECTED" | "DEPENDENCY" | "INCOMING";
}

export interface TransferPlan {
    entries: TransferEntry[];
    references: ReferenceIssue[];
    recipients: RecipientIssue[];
    categories: CategoryIssue[];
    /** The writes. */
    result: {
        /** Items to add to the destination. */
        create: TrackedItemData[];
        /** Items to delete from the source (moved). */
        remove: Id[];
        /** Items staying in the source, with references removed. */
        updateSource: TrackedItemData[];
        /** The destination's categories after the transfer, or null if unchanged. */
        destCategories: CategoryData[] | null;
    };
}

/**
 * Plan a transfer. `choices` override the defaults (INCLUDE / SWITCH /
 * CREATE); including an item can raise new issues, so the plan is iterated
 * until the transferred set stops growing.
 */
export function planTransfer(
    input: TransferInput,
    choices: TransferChoices = {},
    newId: () => Id = () =>
        crypto.randomUUID().replaceAll("-", "").slice(0, 16),
): TransferPlan {
    const { mode } = input;
    const sameStore = storeKey(input.source) === storeKey(input.dest);
    const byId = new Map(input.sourceItems.map((i) => [i.id, i]));

    /** sourceId → mode/why. */
    const set = new Map<
        Id,
        { mode: TransferMode; why: TransferEntry["why"] }
    >();
    for (const id of input.itemIds)
        if (byId.has(id)) set.set(id, { mode, why: "SELECTED" });

    let references: ReferenceIssue[] = [];
    for (let round = 0; round < 50; round++) {
        references = findReferenceIssues(input, set, byId, sameStore, choices);
        let grew = false;
        for (const issue of references) {
            if (issue.choice === "INCLUDE") {
                const id =
                    issue.direction === "OUTGOING"
                        ? issue.targetId
                        : issue.itemId;
                if (!set.has(id) && byId.has(id)) {
                    set.set(id, {
                        mode,
                        why:
                            issue.direction === "OUTGOING"
                                ? "DEPENDENCY"
                                : "INCOMING",
                    });
                    grew = true;
                }
            } else if (issue.choice === "COPY_DEPENDENCY") {
                if (!set.has(issue.targetId) && byId.has(issue.targetId)) {
                    set.set(issue.targetId, {
                        mode: "COPY",
                        why: "DEPENDENCY",
                    });
                    grew = true;
                }
            }
        }
        if (!grew) break;
    }

    // Destination ids: keep unless taken (a MOVE within one store keeps everything).
    const taken = new Set(input.destItems.map((i) => i.id));
    const idMap = new Map<Id, Id>();
    const entries: TransferEntry[] = [];
    for (const [sourceId, entry] of set) {
        const item = byId.get(sourceId)!;
        let destId = sourceId;
        const keepsSlot = sameStore && entry.mode === "MOVE";
        if (!keepsSlot && taken.has(destId)) {
            do destId = newId();
            while (taken.has(destId) || byId.has(destId));
        }
        taken.add(destId);
        if (destId !== sourceId) idMap.set(sourceId, destId);
        entries.push({
            sourceId,
            destId,
            name: item.name,
            mode: entry.mode,
            why: entry.why,
        });
    }

    // OWNING_ACTOR recipients going to the world.
    const recipients: RecipientIssue[] = [];
    if (input.dest.kind === "WORLD") {
        for (const { sourceId } of entries) {
            const item = byId.get(sourceId)!;
            for (const milestone of item.milestones)
                for (const action of milestone.actions)
                    if (ownsRecipient(action)) {
                        const key = `${sourceId}:recipient:${action.id}`;
                        recipients.push({
                            key,
                            itemId: sourceId,
                            itemName: item.name,
                            milestoneId: milestone.id,
                            actionId: action.id,
                            choice: choices.recipients?.[key] ?? "SWITCH",
                        });
                    }
        }
    }

    // Categories by name.
    const destCategories = [...input.destCategories];
    const categoryIssues = new Map<string, CategoryIssue>();
    const categoryFor = (item: TrackedItemData): Id | null => {
        if (sameStore) return item.categoryId;
        const name = input.sourceCategories.find(
            (c) => c.id === item.categoryId,
        )?.name;
        if (!name) return null;
        const existing = destCategories.find((c) => c.name === name);
        if (existing) return existing.id;
        const choice = choices.categories?.[name] ?? "CREATE";
        categoryIssues.set(name, { name, choice });
        if (choice === "UNCATEGORISED") return null;
        const source = input.sourceCategories.find(
            (c) => c.id === item.categoryId,
        )!;
        const created: CategoryData = {
            ...source,
            id: destCategories.some((c) => c.id === source.id)
                ? newId()
                : source.id,
        };
        destCategories.push(created);
        return created.id;
    };

    // Build the items.
    const removals = new Map<Id, RefSite[]>();
    for (const issue of references)
        if (issue.choice === "REMOVE")
            getOrInsertComputed(removals, issue.itemId, () => []).push(
                issue.site,
            );

    const create: TrackedItemData[] = [];
    for (const entry of entries) {
        let item = byId.get(entry.sourceId)!;
        for (const site of removals.get(item.id) ?? [])
            item = removeRefSite(item, site);
        for (const issue of recipients)
            if (issue.itemId === item.id && issue.choice === "SWITCH")
                item = switchRecipient(item, issue.milestoneId, issue.actionId);
        item = remapRefs(item, idMap);
        create.push({
            ...item,
            id: entry.destId,
            categoryId: categoryFor(item),
            ...(entry.mode === "COPY" && { history: [] }),
        });
    }

    const moved = entries
        .filter((e) => e.mode === "MOVE")
        .map((e) => e.sourceId);
    const updateSource: TrackedItemData[] = [];
    for (const [itemId, sites] of removals) {
        if (set.has(itemId)) continue;
        let item = byId.get(itemId);
        if (!item) continue;
        for (const site of sites) item = removeRefSite(item, site);
        updateSource.push(item);
    }

    return {
        entries,
        references,
        recipients,
        categories: [...categoryIssues.values()],
        result: {
            create,
            remove: sameStore ? [] : moved,
            updateSource,
            destCategories:
                destCategories.length !== input.destCategories.length
                    ? destCategories
                    : null,
        },
    };
}

function ownsRecipient(action: MilestoneAction): boolean {
    return actionRecipient(action)?.type === "OWNING_ACTOR";
}

function switchRecipient(
    item: TrackedItemData,
    milestoneId: Id,
    actionId: Id,
): TrackedItemData {
    return {
        ...item,
        milestones: item.milestones.map((m) =>
            m.id !== milestoneId
                ? m
                : {
                      ...m,
                      actions: m.actions.map((a) =>
                          a.id === actionId && actionRecipient(a)
                              ? ({
                                    ...a,
                                    recipient: { type: "TRIGGERING_ACTOR" },
                                } as MilestoneAction)
                              : a,
                      ),
                  },
        ),
    };
}

function findReferenceIssues(
    input: TransferInput,
    set: ReadonlyMap<Id, { mode: TransferMode; why: TransferEntry["why"] }>,
    byId: ReadonlyMap<Id, TrackedItemData>,
    sameStore: boolean,
    choices: TransferChoices,
): ReferenceIssue[] {
    if (sameStore) return [];
    const issues: ReferenceIssue[] = [];
    const transferred = [...set.keys()].map((id) => byId.get(id)!);
    // Items pulled in by an issue's choice don't count as resolving it, so
    // the issue (and its choice) stays visible.
    const selected = transferred.filter(
        (i) => set.get(i.id)?.why === "SELECTED",
    );
    // After the transfer, from the destination: what's there + the picked items + the world.
    const destView: RefContext = {
        self: transferred[0]!,
        sameStore: [...input.destItems, ...selected],
        worldStore: input.dest.kind === "WORLD" ? null : input.worldItems,
        actingActorStore: null,
    };
    const resolvesFromDest = (targetId: Id) =>
        !!resolveRef({ kind: "ITEM", id: targetId }, destView);

    const choose = (key: string, options: ReferenceChoice[]) => {
        const chosen = choices.references?.[key];
        return chosen && options.includes(chosen) ? chosen : options[0]!;
    };

    for (const item of transferred) {
        for (const site of refSites(item)) {
            if (resolvesFromDest(site.targetId)) continue;
            const target = byId.get(site.targetId);
            const options: ReferenceChoice[] = target
                ? input.mode === "MOVE" && set.get(item.id)?.mode === "MOVE"
                    ? ["INCLUDE", "COPY_DEPENDENCY", "REMOVE", "KEEP"]
                    : ["INCLUDE", "REMOVE", "KEEP"]
                : ["KEEP", "REMOVE"];
            const key = siteKey(item.id, site);
            issues.push({
                key,
                direction: "OUTGOING",
                itemId: item.id,
                itemName: item.name,
                site,
                targetId: site.targetId,
                targetName: target?.name ?? null,
                options,
                choice: choose(key, options),
            });
        }
    }

    // Items left behind that reference moved ones. After a move to the world
    // they still resolve (world is in the chain); anywhere else they don't.
    if (input.dest.kind !== "WORLD") {
        const movedIds = new Set(
            [...set].filter(([, e]) => e.mode === "MOVE").map(([id]) => id),
        );
        for (const item of input.sourceItems) {
            // Picked items and moving dependencies go too; items pulled in
            // by an incoming issue (or copied dependencies) are checked as staying.
            const entry = set.get(item.id);
            if (
                entry &&
                (entry.why === "SELECTED" ||
                    (entry.why === "DEPENDENCY" && entry.mode === "MOVE"))
            )
                continue;
            for (const site of refSites(item)) {
                if (!movedIds.has(site.targetId)) continue;
                const options: ReferenceChoice[] = [
                    "INCLUDE",
                    "REMOVE",
                    "KEEP",
                ];
                const key = siteKey(item.id, site);
                issues.push({
                    key,
                    direction: "INCOMING",
                    itemId: item.id,
                    itemName: item.name,
                    site,
                    targetId: site.targetId,
                    targetName: byId.get(site.targetId)?.name ?? null,
                    options,
                    choice: choose(key, options),
                });
            }
        }
    }
    // A site found both ways (an item pulled in by an incoming issue that
    // references a moving one) is decided by its incoming issue.
    const incoming = new Set(
        issues.filter((i) => i.direction === "INCOMING").map((i) => i.key),
    );
    return issues.filter(
        (i) => i.direction === "INCOMING" || !incoming.has(i.key),
    );
}
