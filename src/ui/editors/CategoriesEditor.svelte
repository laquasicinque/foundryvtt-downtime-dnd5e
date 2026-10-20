<script lang="ts">
    import { localize } from "../../foundry/i18n";
    import { randomId } from "../../foundry/utils";
    import { untrack } from "svelte";
    import type { CategoryData, StoreRef } from "../../types/data";
    import { saveCategories } from "../actions";

    type Props = {
        store: StoreRef;
        categories: CategoryData[];
        sheet: { close(): Promise<unknown> };
    };

    const { store, categories, sheet }: Props = $props();

    // The editor works on a snapshot taken when it opens.
    let draft = $state<CategoryData[]>(
        untrack(() => structuredClone(categories)),
    );
    let saving = $state(false);

    function add() {
        draft.push({
            id: randomId(),
            name: localize("downtime-dnd5e.Category.New"),
            description: "",
        });
    }

    function move(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= draft.length) return;
        const [category] = draft.splice(index, 1);
        draft.splice(target, 0, category!);
    }

    async function save(event: SubmitEvent) {
        event.preventDefault();
        saving = true;
        try {
            await saveCategories(
                store,
                $state.snapshot(draft) as CategoryData[],
            );
            await sheet.close();
        } finally {
            saving = false;
        }
    }
</script>

<form class="categories-editor" onsubmit={save}>
    <p class="hint">
        {localize("downtime-dnd5e.CategoriesEditor.RemovingACategoryMoves")}
    </p>
    {#each draft as category, index (category.id)}
        <div class="category">
            <input
                type="text"
                bind:value={category.name}
                placeholder={localize("DOCUMENT.FIELDS.name.label")}
                required
            />
            <input
                type="text"
                bind:value={category.description}
                placeholder={localize("DOCUMENT.FIELDS.description.label")}
            />
            <button
                type="button"
                class="icon"
                disabled={index === 0}
                onclick={() => move(index, -1)}
                title={localize("downtime-dnd5e.CategoriesEditor.MoveUp")}
                ><i class="fas fa-arrow-up"></i></button
            >
            <button
                type="button"
                class="icon"
                disabled={index === draft.length - 1}
                onclick={() => move(index, 1)}
                title={localize("downtime-dnd5e.CategoriesEditor.MoveDown")}
                ><i class="fas fa-arrow-down"></i></button
            >
            <button
                type="button"
                class="icon"
                onclick={() => draft.splice(index, 1)}
                title={localize("downtime-dnd5e.CategoriesEditor.Remove")}
                ><i class="fas fa-trash"></i></button
            >
        </div>
    {/each}
    <button type="button" onclick={add}
        ><i class="fas fa-plus"></i>
        {localize("downtime-dnd5e.CategoriesEditor.AddCategory")}</button
    >
    <footer>
        <button type="submit" disabled={saving}
            ><i class="fas fa-save"></i>
            {localize("downtime-dnd5e.CategoriesEditor.Save")}</button
        >
    </footer>
</form>

<style>
    .categories-editor {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .category {
        display: flex;
        gap: 0.25rem;
    }
    button.icon {
        width: 1.75rem;
        flex: none;
    }
    .hint {
        font-size: 0.8rem;
        opacity: 0.7;
        margin: 0;
    }
</style>
