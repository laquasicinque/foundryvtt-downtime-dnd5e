/**
 * GM command: add the sample downtimes (model/authoring/samples.ts) to an actor and the
 * world. Idempotent: samples already present (by preset key) are skipped, and
 * references from new samples point at the existing copies.
 */
import type { TrackedItem } from "../domain/TrackedItem";
import {
    compendiumItemUuid,
    createWorldItem,
    firstEffectUuid,
    worldItemByName,
} from "../foundry/items";
import { createScriptMacro, macroByName } from "../foundry/macros";
import { localize } from "../foundry/i18n";
import { notifyInfo } from "../foundry/notifications";
import { isGM } from "../foundry/users";
import { randomId } from "../foundry/utils";
import { remapRefs } from "../model/rules/refs";
import { buildSamples } from "../model/authoring/samples";
import type {
    CategoryData,
    Id,
    StoreRef,
    TrackedItemData,
} from "../types/data";
import {
    getCategories,
    getTrackedItems,
    resolveStore,
    v3Api,
    type StoreResolvable,
} from "./api";

// Documents the samples use, found again by name (so in the language they were made in).
const sampleMacroName = () =>
    localize("downtime-dnd5e.Sample.Docs.ProgressMacro");
const celebrateMacroName = () =>
    localize("downtime-dnd5e.Sample.Docs.CelebrateMacro");
const undoCelebrateMacroName = () =>
    localize("downtime-dnd5e.Sample.Docs.UndoCelebrateMacro");
const effectSourceName = () =>
    localize("downtime-dnd5e.Sample.Docs.EffectSource");

async function ensureSampleMacro(): Promise<string | null> {
    const name = sampleMacroName();
    if (macroByName(name)) return name;
    const created = await createScriptMacro({
        name,
        img: "icons/svg/dice-target.svg",
        command:
            '// Downtime sample: return a number to add to progress.\nreturn (await new Roll("1d4").evaluate()).total;',
    });
    return created ? name : null;
}

/** A world macro by name, created with `command` if missing. Resolves to its uuid. */
async function ensureMacro(
    name: string,
    command: string,
): Promise<string | null> {
    const existing = macroByName(name);
    if (existing) return existing.uuid ?? null;
    return createScriptMacro({ name, img: "icons/svg/wing.svg", command });
}

/**
 * A world feat carrying the "Inspired" effect the effect sample applies.
 * Resolves to the effect's uuid.
 */
async function ensureSampleEffect(): Promise<string | null> {
    let source = worldItemByName(effectSourceName());
    if (!source) {
        source = await createWorldItem({
            name: effectSourceName(),
            type: "feat",
            img: "icons/magic/control/buff-flight-wings-runes-blue.webp",
            system: {
                description: {
                    value: `<p>${localize("downtime-dnd5e.Sample.Docs.EffectSourceDescription")}</p>`,
                },
            },
            effects: [
                {
                    name: localize("downtime-dnd5e.Sample.Docs.Effect"),
                    img: "icons/magic/control/buff-flight-wings-runes-blue.webp",
                    transfer: false,
                    changes: [
                        {
                            key: "system.bonuses.abilities.check",
                            mode: 2,
                            value: "+1",
                        },
                    ],
                },
            ],
        });
    }
    return source ? firstEffectUuid(source) : null;
}

const CELEBRATE_COMMAND = `// Downtime sample (milestone macro): count celebrations on the actor.
// \`downtime.undo\` is false here; the undo macro runs with true.
if (!actor) return;
const count = actor.getFlag("world", "downtimeCelebrations") ?? 0;
await actor.setFlag("world", "downtimeCelebrations", count + 1);
ChatMessage.create({ content: \`\${actor.name} celebrates! (\${count + 1})\` });`;

const UNDO_CELEBRATE_COMMAND = `// Downtime sample: undo one celebration.
if (!actor) return;
const count = actor.getFlag("world", "downtimeCelebrations") ?? 0;
await actor.setFlag("world", "downtimeCelebrations", Math.max(0, count - 1));`;

async function ensureCategory(
    store: StoreRef,
    category: CategoryData,
): Promise<Id> {
    const categories = (await getCategories(store)).map((c) => c.toJSON());
    const existing = categories.find((c) => c.name === category.name);
    if (existing) return existing.id;
    await v3Api.setCategories(store, [...categories, category]);
    return category.id;
}

async function addMissing(
    store: StoreRef,
    samples: TrackedItemData[],
    categoryId: Id,
): Promise<{ created: number; skipped: number }> {
    const existingByPreset = new Map(
        (await getTrackedItems(store))
            .filter((i) => i.preset)
            .map((i) => [i.preset!, i]),
    );
    // Sample id → the copy already in the store, if any.
    const present = new Map<Id, TrackedItem>();
    for (const sample of samples) {
        const match = existingByPreset.get(sample.preset!);
        if (match) present.set(sample.id, match);
    }

    /** A MILESTONE requirement on an existing copy: use that copy's milestone with the same label. */
    const remapMilestone = (sampleItemId: Id, milestoneId: Id): Id => {
        const copy = present.get(sampleItemId);
        const sample = samples.find((s) => s.id === sampleItemId);
        if (!copy || !sample) return milestoneId;
        const label = sample.milestones.find(
            (m) => m.id === milestoneId,
        )?.label;
        return (
            copy.milestones.find((m) => m.label === label)?.id ?? milestoneId
        );
    };

    const idMap = new Map(
        [...present].map(([sampleId, copy]) => [sampleId, copy.id]),
    );
    let created = 0;
    for (const sample of samples) {
        if (present.has(sample.id)) continue;
        const withMilestones: TrackedItemData = {
            ...sample,
            categoryId,
            // Follow-up items created by ADD_TRACKED_ITEM land in the same category.
            milestones: sample.milestones.map((milestone) => ({
                ...milestone,
                actions: milestone.actions.map((action) =>
                    action.kind === "ADD_TRACKED_ITEM"
                        ? {
                              ...action,
                              template: { ...action.template, categoryId },
                          }
                        : action,
                ),
            })),
            methods: sample.methods.map((method) => ({
                ...method,
                requirements: method.requirements.map((requirement) => {
                    const test = requirement.test;
                    if (test.kind !== "MILESTONE" || test.ref.kind !== "ITEM")
                        return requirement;
                    return {
                        ...requirement,
                        test: {
                            ...test,
                            milestoneId: remapMilestone(
                                test.ref.id,
                                test.milestoneId,
                            ),
                        },
                    };
                }),
            })),
        };
        await v3Api.createItem(store, remapRefs(withMilestones, idMap));
        created++;
    }
    return { created, skipped: present.size };
}

/** GM: add the sample downtimes to `actor` and the world. */
export async function createSampleDowntimes(actor: StoreResolvable) {
    if (!isGM()) throw new Error(localize("downtime-dnd5e.Sample.GMOnly"));
    const samples = buildSamples({
        newId: randomId,
        t: localize,
        grantItemUuid: await compendiumItemUuid(
            "dnd5e.items",
            "Potion of Healing",
        ),
        batchItemUuid: await compendiumItemUuid(
            "dnd5e.items",
            "Arrows",
            "Arrows (20)",
            "Arrow",
        ),
        macroName: await ensureSampleMacro(),
        effectUuid: await ensureSampleEffect(),
        actionMacroUuid: await ensureMacro(
            celebrateMacroName(),
            CELEBRATE_COMMAND,
        ),
        undoMacroUuid: await ensureMacro(
            undoCelebrateMacroName(),
            UNDO_CELEBRATE_COMMAND,
        ),
    });
    const actorStore = await resolveStore(actor);
    const worldStore: StoreRef = { kind: "WORLD" };

    const actorResult = await addMissing(
        actorStore,
        samples.actor,
        await ensureCategory(actorStore, samples.category),
    );
    const worldResult = await addMissing(
        worldStore,
        samples.world,
        await ensureCategory(worldStore, {
            ...samples.category,
            id: randomId(),
        }),
    );
    const created = actorResult.created + worldResult.created;
    const skipped = actorResult.skipped + worldResult.skipped;
    notifyInfo(
        !created
            ? localize("downtime-dnd5e.Sample.AllThere")
            : skipped
              ? localize("downtime-dnd5e.Sample.AddedSome", {
                    count: created,
                    skipped,
                })
              : localize("downtime-dnd5e.Sample.Added", { count: created }),
    );
    return { created, skipped };
}
