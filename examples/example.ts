import * as pl from "../src/index";

console.log("\x1b[90m$ npm i hangcheck\n\x1b[0m");

// Never-settling promise — the classic "I forgot to await/resolve" leak
const neverResolves = new Promise<void>(() => {
  /* forgot to call resolve() */
});

console.log("\x1b[32m1. tracked promise that hangs\x1b[0m\n");
pl.track("confirm-payment", neverResolves);

console.log("\x1b[32m2. group tracking\x1b[0m\n");
void pl.trackGroup("checkout", [
  Promise.resolve("ok"),
  new Promise(() => {}), // this one hangs forever
]);

console.log("(waiting for warnings...)\n");
await new Promise((r) => setTimeout(r, 10_500));
process.exit(0);
