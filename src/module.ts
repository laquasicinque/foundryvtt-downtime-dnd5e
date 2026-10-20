import { onceHook } from "./foundry/hooks";
import { init, ready } from "./runtime";

onceHook("init", init);
onceHook("ready", ready);
