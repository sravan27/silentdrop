// Run silentdrop against Dexie (the dominant IndexedDB wrapper, ~2M downloads/wk).
//   npm i dexie fake-indexeddb && node examples/dexie.mjs
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { check, report } from "../index.mjs";

let db;
const dexieAdapter = {
  async reset() {
    if (db) db.close();
    await Dexie.delete("silentdrop");
    db = new Dexie("silentdrop");
    db.version(1).stores({ t: "++id,v" });
  },
  async seed(values) {
    await db.t.bulkAdd(values.map((v) => ({ v })));
  },
  // Dexie's case-insensitive index walk:
  async ilike(needle) {
    return (await db.t.where("v").equalsIgnoreCase(needle).toArray()).map((r) => r.v);
  },
  // Dexie range query:
  async gt(bound) {
    return (await db.t.where("v").above(bound).toArray()).map((r) => r.v);
  },
  // (Dexie has no LIKE operator, so like-* tests are skipped.)
};

console.log("silentdrop — checking Dexie's query layer\n");
const results = await check(dexieAdapter);
const bad = report(results);
process.exit(bad ? 1 : 0);
