// silentdrop — does your JS database's query layer secretly return the wrong rows?
//
// Many client-side / embedded / sync databases re-implement SQL-ish operators
// (LIKE, case-insensitive match, range comparison) in JavaScript. Subtle gaps
// between those JS implementations and real SQL semantics make queries SILENTLY
// drop or over-match rows — no error, just wrong data.
//
// These exact bugs were found + fixed this month in PowerSync, Rocicorp's Zero,
// InstantDB, ElectricSQL, and Dexie. This kit checks for them in YOUR database.
//
// Usage: implement the adapter for your DB (see examples/dexie.mjs) and run check().

const cp = (n) => String.fromCodePoint(n); // build non-ASCII test data without source mangling

export const TESTS = [
  {
    id: "like-newline",
    op: "like",
    title: "LIKE '%' must span newlines",
    detail:
      "In SQL, % matches any sequence INCLUDING newlines. JS engines that compile " +
      "LIKE to a RegExp without the dotAll (`s`) flag silently miss rows with \\n.",
    data: ["abc", "a\nb\nc", "axc"],
    input: "a%c",
    expect: ["a\nb\nc", "axc"],
  },
  {
    id: "like-metachar",
    op: "like",
    title: "LIKE treats regex metacharacters literally",
    detail:
      "LIKE 'a.b' must match the literal 'a.b', not 'axb'. Engines that translate to " +
      "RegExp without escaping metacharacters over-match (a correctness + injection risk).",
    data: ["a.b", "axb", "ayb"],
    input: "a.b",
    expect: ["a.b"],
  },
  {
    id: "ilike-casefold",
    op: "ilike",
    title: "Case-insensitive match must handle length-changing case folds",
    detail:
      "equalsIgnoreCase('straße') must match 'STRAßE'. Index walks that assume case " +
      "conversion is length-preserving (ß→SS, ﬁ→FI, İ) silently drop rows. Found in Dexie (#2306).",
    data: ["straße", "STRAßE", "Straße", "sTRAßE", "STRASSE", "strasse"],
    input: "straße",
    expect: ["straße", "STRAßE", "Straße", "sTRAßE"],
  },
  {
    id: "compare-nonbmp",
    op: "gt",
    title: "Range comparison must order non-BMP characters by code point",
    detail:
      "SQL/Postgres orders text by code point. Naive JS comparison orders by UTF-16 code " +
      "unit, so U+1F600 (😀) sorts BELOW U+F000 — range queries silently drop the astral row.",
    data: ["a", cp(0xf000), cp(0x1f600)],
    input: cp(0xefff),
    expect: [cp(0xf000), cp(0x1f600)],
  },
];

const norm = (a) => [...(a || [])].map(String).sort();

export async function check(adapter) {
  const results = [];
  for (const t of TESTS) {
    if (typeof adapter[t.op] !== "function") {
      results.push({ id: t.id, title: t.title, status: "skip", note: `adapter has no ${t.op}()` });
      continue;
    }
    let got = null, error = null;
    try {
      await adapter.reset();
      await adapter.seed(t.data);
      got = await adapter[t.op](t.input);
    } catch (e) { error = String((e && e.message) || e); }
    const pass = !error && JSON.stringify(norm(got)) === JSON.stringify(norm(t.expect));
    results.push({ id: t.id, title: t.title, detail: t.detail, status: error ? "error" : pass ? "pass" : "DIVERGENCE", expect: t.expect, got, error });
  }
  return results;
}

export function report(results) {
  let bad = 0;
  for (const r of results) {
    if (r.status === "skip") { console.log(`  ?  ${r.id} (skipped: ${r.note})`); continue; }
    if (r.status === "pass") { console.log(`  ✓  ${r.id} — ${r.title}`); continue; }
    bad++;
    console.log(`\n  ✗  ${r.status}: ${r.id} — ${r.title}`);
    console.log(`     ${r.detail}`);
    if (r.error) console.log(`     threw: ${r.error}`);
    else { console.log(`     expected: ${JSON.stringify(r.expect)}`); console.log(`     got:      ${JSON.stringify(r.got)}   <-- wrong rows`); }
  }
  console.log(`\n${bad === 0 ? "✓ no divergences" : `✗ ${bad} silent-data-loss divergence(s) — these queries return wrong rows`}`);
  return bad;
}
