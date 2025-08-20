Hooks.on("tidy5e-sheet.ready", () => {
  const api = game.modules.get("tidy5e-sheet")?.api;
  if (!api) return;

  const tab = new api.models.SvelteTab({
    component: undefined,
    title: "Wahoo",
    // iconClass?: string | undefined,
    tabId: "downtime",
  });

  api.registerCharacterTab(tab);
});
