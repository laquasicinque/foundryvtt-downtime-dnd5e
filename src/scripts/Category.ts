import { localize } from "./utils/localize"

export function createCategory({ id, name, description }: Partial<Downtime.Category> = {}): Downtime.Category {
    return {
        id: id ?? foundry.utils.randomID(),
        name: name ?? localize("downtime-dnd5e.NewCategory"),
        description: description ?? "",
    }
}
