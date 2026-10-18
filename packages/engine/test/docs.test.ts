import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACQUISITION_ASSUMPTIONS, OPERATING_ASSUMPTIONS, RULE_CATALOGUE } from "../src/index.js";

const doc = readFileSync(join(import.meta.dirname, "../../../docs/rules.md"), "utf8");

describe("docs/rules.md", () => {
  it.each([...new Set(RULE_CATALOGUE.map((r) => r.id))])("documents rule %s", (id) => {
    expect(doc).toContain(`\`${id}\``);
  });

  it.each([...Object.keys(ACQUISITION_ASSUMPTIONS), ...Object.keys(OPERATING_ASSUMPTIONS)])("documents assumption %s", (id) => {
    expect(doc).toContain(`\`${id}\``);
  });
});
