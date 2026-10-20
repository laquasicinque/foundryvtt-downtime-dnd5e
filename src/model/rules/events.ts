import type {
    HistoryEventData,
    HistoryEventKind,
    ProgressEventData,
} from "../../types/data";

/** Events that change progress, i.e. the entries of the revert stack. */
export const PROGRESS_EVENT_KINDS = [
    "METHOD",
    "ADJUST",
    "SET",
    "LEGACY",
] as const satisfies readonly HistoryEventKind[];

export function isProgressEvent(
    event: HistoryEventData,
): event is ProgressEventData {
    return (PROGRESS_EVENT_KINDS as readonly string[]).includes(event.kind);
}
