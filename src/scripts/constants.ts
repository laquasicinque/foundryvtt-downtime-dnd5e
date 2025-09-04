const MODULE_ID: Downtime.MODULE_ID = "downtime-dnd5e";

const CONSTANTS = {
  MODULE_ID,
  PATH: `modules/${MODULE_ID}/`,
  FLAGS: {
    // changes: "changes",
    trainingItems: "trainingItems",
    backup: "backup",
    categories: "categories",
  },
  SETTINGS: {
    worldActivities: "activities",
    worldCategories: "categories",
  },
} as const;

export default CONSTANTS;
