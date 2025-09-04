import { UnionToIntersection } from "fvtt-types/utils";
import { pick } from "../utils/objectOnly";

const UNCHANGED_KEYS = [
    'category',
    'changes',
    'chat_icon',
    'completionAt',
    'dc',
    'description',
    'hidden',
    'id',
    'img',
    'name',
    'progress',
    'progressionStyle'
] as const

export function migrateToVersion2(old: Downtime.TrackedItemV1): Downtime.TrackedItemV2 {
    switch (old.progressionStyle) {
        case "FIXED":
            return {
                ...pick(old, UNCHANGED_KEYS),
                changes: updateChanges(old.changes),
                value: old.fixedIncrease,
                schemaVersion: 2
            } satisfies Downtime.TrackedItemV2Fixed
        case "ABILITY":
            return {
                ...pick(old, UNCHANGED_KEYS),
                changes: updateChanges(old.changes),
                value: old.ability,
                schemaVersion: 2
            }
        case "SKILL":
            return {
                ...pick(old, UNCHANGED_KEYS),
                changes: updateChanges(old.changes),
                value: old.skill,
                schemaVersion: 2
            }
        case "TOOL":
            return {
                ...pick(old, UNCHANGED_KEYS),
                changes: updateChanges(old.changes),
                value: old.tool,
                schemaVersion: 2
            }
        case "MACRO":
            return {
                ...pick(old, UNCHANGED_KEYS),
                changes: updateChanges(old.changes),
                value: old.macroName,
                schemaVersion: 2
            }
    }
}

function updateChanges(changes: Downtime.TrackedItemV1['changes']): Downtime.TrackedItemV2['changes'] {
    const rollTypes: Record<string, number> = {}

    for (const change of changes) {
        if (!change.actionName.startsWith("Roll")) continue
        if (change.actionName.includes("[object Object]")) continue
        if (change.actionName in rollTypes) {
            rollTypes[change.actionName] = 1
        } else {
            rollTypes[change.actionName]++
        }
    }

    const rollGuesses = Object.entries(rollTypes).sort(([, a], [, b]) => b - a)
    return changes.map(change => {
        const actionName = change.actionName === 'Roll [object Object]' ? (rollGuesses[0]?.[0] ?? "Roll unknown") : change.actionName
        return {
            id: change.id,
            actionName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            timestamp: new Date(change.timestamp).getTime(),
            valueChanged: change.valueChanged,
            note: change.note,
            user: {
                name: change.user,
                id: null
            },
        }
    })
}
