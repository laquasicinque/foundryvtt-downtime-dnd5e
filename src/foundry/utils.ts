/** General Foundry utilities. */

export function randomId(): string {
    return foundry.utils.randomID();
}

export function escapeHTML(value: string): string {
    return foundry.utils.escapeHTML(value);
}

export function getProperty(object: object, path: string): unknown {
    return foundry.utils.getProperty(object, path);
}

export function setProperty(
    object: object,
    path: string,
    value: unknown,
): void {
    foundry.utils.setProperty(object, path, value);
}

/** Offer `data` to the user as a file download. */
export function saveDataToFile(
    data: string,
    type: string,
    filename: string,
): void {
    foundry.utils.saveDataToFile(data, type, filename);
}

export function readTextFromFile(file: File): Promise<string> {
    return foundry.utils.readTextFromFile(file);
}

export async function copyToClipboard(text: string): Promise<void> {
    await game.clipboard.copyPlainText(text);
}
