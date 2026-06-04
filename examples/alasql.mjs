// Run silentdrop against AlaSQL — a pure-JavaScript SQL database (~widely used).
//   npm i alasql && node examples/alasql.mjs
import alasql from "alasql";
import { check, report } from "../index.mjs";

const alasqlAdapter = {
  async reset() {
    alasql("DROP TABLE IF EXISTS t");
    alasql("CREATE TABLE t (v STRING)");
  },
  async seed(values) {
    for (const v of values) alasql("INSERT INTO t VALUES (?)", [v]);
  },
  async like(pattern) {
    return alasql("SELECT v FROM t WHERE v LIKE ?", [pattern]).map((r) => r.v);
  },
  async ilike(needle) {
    return alasql("SELECT v FROM t WHERE LOWER(v) = LOWER(?)", [needle]).map((r) => r.v);
  },
  async gt(bound) {
    return alasql("SELECT v FROM t WHERE v > ?", [bound]).map((r) => r.v);
  },
};

console.log("silentdrop — checking AlaSQL (pure-JS SQL engine)\n");
const bad = report(await check(alasqlAdapter));
process.exit(bad ? 1 : 0);
