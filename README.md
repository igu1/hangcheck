# hangcheck

**Find asynchronous work that never finishes.**

> One small problem. One obvious API. Very little setup. Immediate value.

Applications accumulate promises that never resolve: forgotten resolves,
retries with no timeout, queues waiting forever. Tests hang. Requests pile up.
`hangcheck` tracks explicit promises and tells you which one is stuck and
where it was created.

## Install

```bash
npm i hangcheck
```

## Usage

```ts
import { track } from "hangcheck";

await track("confirm-payment", confirmPayment());
```

If it hangs, after 10 seconds you get:

```text
⚠ Promise still pending after 10s

confirm-payment

Created at:
src/services/payment.ts:52

Pending for: 10s
```

The promise itself passes through untouched — (value + errors), zero behavior
change.

### Groups

```ts
import { trackGroup } from "hangcheck";

await trackGroup("checkout", [
  reserveInventory(),
  createPayment(),
  sendConfirmation(),
]);
```

```text
⚠ group "checkout" has 1 pending promise(s)

  ✓ checkout[0]
  ✓ checkout[1]
  ⚠ checkout[2] pending 12.8s
```

### Configure

```ts
import { configure } from "hangcheck";

configure({
  warnAfter: 5_000,     // first warning
  repeatAfter: 30_000,  // re-warn while still pending (0 = warn once)
  output: "console",    // or "silent" | "buffer" | custom logger
});
```

### Registry / tests

```ts
import { registry, configure } from "hangcheck";

configure({ output: "buffer" });
// ... run your app / test
bufferWarnings();  // your string[] of leaks
```

Timers are unref'd so tracking never keeps your process alive.

Zero dependencies. ESM + CJS + `.d.ts`. Node >= 18.

## License

MIT
