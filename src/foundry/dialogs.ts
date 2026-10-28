/**
 * Small prompts (pick, number, text, confirm). Rudimentary on purpose (the
 * real UI comes from the design track).
 */
import { localize } from "./i18n";
import { escapeHTML as escape } from "./utils";
import { finiteOrNull } from "../lib/values";

const { DialogV2 } = foundry.applications.api;

type DialogFormButton = { form?: HTMLFormElement | null };

/** Pick one option. Resolves immediately with the only option; null if cancelled. */
export async function pickOne<T>(
    title: string,
    options: readonly { label: string; value: T }[],
): Promise<T | null> {
    if (options.length === 0) return null;
    if (options.length === 1) return options[0]!.value;
    const content = options
        .map(
            (option, index) =>
                `<label style="display:block"><input type="radio" name="choice" value="${index}" ${index === 0 ? "checked" : ""}> ${escape(option.label)}</label>`,
        )
        .join("");
    const index = await DialogV2.prompt({
        window: { title },
        content: `<div class="downtime-dnd5e-pick">${content}</div>`,
        ok: {
            label: localize("COMMON.Confirm"),
            callback: (_event: unknown, button: DialogFormButton) => {
                const checked = button.form?.querySelector<HTMLInputElement>(
                    "input[name=choice]:checked",
                );
                return checked ? Number(checked.value) : null;
            },
        },
        rejectClose: false,
    });
    return index == null || typeof index !== "number"
        ? null
        : (options[index]?.value ?? null);
}

/**
 * Pick any number of options. Options are ticked unless `checked: false`;
 * `disabled` ones are shown greyed out and can't be picked. null if cancelled.
 */
export async function pickMany<T>(
    title: string,
    hint: string,
    options: readonly {
        label: string;
        value: T;
        checked?: boolean;
        disabled?: boolean;
        detail?: string;
    }[],
): Promise<T[] | null> {
    const content = options
        .map(
            (option, index) =>
                `<label style="display:block${option.disabled ? ";opacity:0.5" : ""}"><input type="checkbox" name="choice" value="${index}" ${option.checked !== false && !option.disabled ? "checked" : ""} ${option.disabled ? "disabled" : ""}> ${escape(option.label)}${option.detail ? ` <span style="opacity:0.7;font-size:0.85em">${escape(option.detail)}</span>` : ""}</label>`,
        )
        .join("");
    const indices = await DialogV2.prompt({
        window: { title },
        content: `<p>${escape(hint)}</p><div class="downtime-dnd5e-pick">${content}</div>`,
        ok: {
            label: localize("COMMON.Confirm"),
            callback: (_event: unknown, button: DialogFormButton) =>
                [
                    ...(button.form?.querySelectorAll<HTMLInputElement>(
                        "input[name=choice]:checked",
                    ) ?? []),
                ].map((input) => Number(input.value)),
        },
        rejectClose: false,
    });
    if (!indices) return null;
    return indices
        .map((index) => options[index]?.value)
        .filter((value): value is T => value !== undefined);
}

/** Ask for a number. null if cancelled or blank. */
export async function promptNumber(
    title: string,
    label: string,
    initial: number | null = null,
): Promise<number | null> {
    const value = await DialogV2.prompt({
        window: { title },
        content: `<label>${escape(label)} <input type="number" name="amount" step="any" value="${initial ?? ""}" autofocus></label>`,
        ok: {
            label: localize("COMMON.Confirm"),
            callback: (_event: unknown, button: DialogFormButton) => {
                const input =
                    button.form?.querySelector<HTMLInputElement>(
                        "input[name=amount]",
                    );
                return finiteOrNull(input?.valueAsNumber);
            },
        },
        rejectClose: false,
    });
    return value ?? null;
}

/** Ask for some text (multi-line). null if cancelled. */
export async function promptText(
    title: string,
    initial: string,
    label = localize("COMMON.Confirm"),
): Promise<string | null> {
    const value = await DialogV2.prompt({
        window: { title },
        content: `<textarea name="text" rows="3" style="width:100%">${escape(initial)}</textarea>`,
        ok: {
            label,
            callback: (_event: unknown, button: DialogFormButton) =>
                button.form?.querySelector<HTMLTextAreaElement>(
                    "textarea[name=text]",
                )?.value ?? null,
        },
        rejectClose: false,
    });
    return value ?? null;
}

export async function confirm(title: string, html: string): Promise<boolean> {
    return (
        (await DialogV2.confirm({
            window: { title },
            content: html,
            rejectClose: false,
        })) ?? false
    );
}
