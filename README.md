# silentdrop

**Does your JavaScript database silently return the wrong rows?**

Client‑side, embedded, and sync databases re‑implement SQL‑ish operators — `LIKE`,
case‑insensitive match, range comparison — in JavaScript. Subtle gaps between those
JS implementations and the SQL semantics they're meant to mirror make queries
**silently drop or over‑match rows**. No error. No crash. Just wrong data — the
worst kind of bug.

This month I found and fixed this exact bug class in **five production databases**:

| Database | Bug | Status |
|---|---|---|
| PowerSync | LIKE/range semantics | merged (`powersync-service#644`) + paid hardening sprint |
| Rocicorp's Zero | range/comparison | merged (`mono#6083`, `#6088`) |
| InstantDB | `$like`/`$ilike` newline | merged (`instant#2714`) |
| ElectricSQL | LIKE newline + escaped wildcards | PR open (`electric#4437`) |
| Dexie | case‑fold drops rows | PR open (`Dexie.js#2306`) |

`silentdrop` packages that audit so you can run it against **your** database.

## It catches real bugs

Run it against Dexie (the dominant IndexedDB wrapper, ~2M downloads/week):

```
$ node examples/dexie.mjs

  ✗  DIVERGENCE: ilike-casefold — Case-insensitive match must handle length-changing case folds
     equalsIgnoreCase('straße') must match 'STRAßE'. Index walks that assume case
     conversion is length-preserving (ß→SS, ﬁ→FI, İ) silently drop rows.
     expected: ["straße","STRAßE","Straße","sTRAßE"]
     got:      ["Straße","sTRAßE","straße"]   <-- 'STRAßE' silently dropped

  ✗  DIVERGENCE: compare-nonbmp — Range comparison must order non-BMP characters by code point
     A range query over astral characters (emoji, CJK ext.) drops rows, because
     JS compares UTF-16 code units while SQL orders by code point.

  ✗ 2 silent-data-loss divergences — these queries return wrong rows
```

Both are genuine: the case‑fold one is reported as [Dexie #2306](https://github.com/dexie/Dexie.js/pull/2306).

## What it checks

- **`LIKE` across newlines** — `%` must span `\n` (SQL semantics; RegExp without `dotAll` misses it)
- **`LIKE` metacharacter literalness** — `LIKE 'a.b'` matches `a.b`, not `axb` (escaping)
- **Case‑fold length changes** — `ß`→`SS`, ligatures, Turkish `İ` must not drop rows
- **Non‑BMP ordering** — range comparison must order by code point, not UTF‑16 code unit

## Usage

```js
import { check, report } from "silentdrop";

// Wire your DB's query operators (returns matching string values).
const adapter = {
  async reset() { /* clear store */ },
  async seed(values) { /* insert string values */ },
  async like(pattern) { /* run a LIKE query, return matches (omit if unsupported) */ },
  async ilike(needle) { /* case-insensitive equality */ },
  async gt(bound) { /* values > bound */ },
};

report(await check(adapter));
```

See [`examples/dexie.mjs`](examples/dexie.mjs) for a complete adapter.

## Need the deep version?

`silentdrop` catches the common cases automatically. If your database/sync layer is
correctness‑critical and you want a **full manual hardening pass** — reduced repros +
fixes + regression tests across the whole operator surface (the same work behind the
5 databases above) — I do it as a fixed **$1,000 / 48‑hour sprint**, no‑find‑no‑charge:

**→ https://buy.polar.sh/polar_cl_z0eLsPUJeMwrcNs4MQPAQbKIM3Rbdb8fLDgVj2RZcmr**

Smaller scope? **$500 Diagnostic Fix** — one operator I find a divergence on, repro + fix + PR delivered:

**→ https://buy.polar.sh/polar_cl_G0fuUHHZ1tg9E0oe7gluje9gs44l8FAqVnfwS2AJkbw**

Track record (June 2026): 8 silent-row-loss PRs at PowerSync (4 merged + 4 open), 2 each at Rocicorp Zero and Autumn (all merged), plus shipped fixes at InstantDB, ElectricSQL, Dexie, RxDB. Every bug is real and silent — no error, no log, just wrong rows.

## License

MIT © Sravan Sridhar · [github.com/sravan27](https://github.com/sravan27)
