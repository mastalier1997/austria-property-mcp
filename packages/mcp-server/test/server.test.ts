import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { underwrite, type UnderwriteInput, type UnderwriteResult } from "@austria-property/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, SERVER_VERSION, viennaToday } from "../src/server.js";

const TODAY = "2026-10-18";
let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([client.connect(clientTransport), createServer({ today: () => TODAY }).connect(serverTransport)]);
});

afterAll(async () => {
  await client.close();
});

const call = async (name: string, args: Record<string, unknown>) =>
  (await client.callTool({ name, arguments: args })) as CallToolResult;

const texts = (r: CallToolResult) => r.content.map((c) => (c.type === "text" ? c.text : ""));
const json = <T>(r: CallToolResult): T => JSON.parse(texts(r)[1] as string) as T;

const MEIDLING = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../fixtures/golden/underwrite/meidling-condo-1978.json"), "utf8"),
);

describe("MCP server", () => {
  it("matches the package version and identifies itself", () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8"));
    expect(SERVER_VERSION).toBe(pkg.version);
    const registry = JSON.parse(readFileSync(join(import.meta.dirname, "../server.json"), "utf8"));
    expect(registry.version).toBe(pkg.version);
    expect(registry.packages[0]).toMatchObject({ identifier: pkg.name, version: pkg.version });
    expect(registry.name).toBe(pkg.mcpName);
    expect(registry.description.length).toBeLessThanOrEqual(100);
    expect(client.getServerVersion()).toEqual({ name: "austria-property", version: SERVER_VERSION });
    expect(client.getInstructions()).toMatch(/not investment, tax or legal advice/);
  });

  it("lists three read-only tools with descriptions and input schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["estimate_acquisition_costs", "get_rules", "underwrite_property"]);
    for (const tool of tools) {
      expect(tool.description?.length, tool.name).toBeGreaterThan(100);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    }
    const underwriteTool = tools.find((t) => t.name === "underwrite_property")!;
    expect(underwriteTool.inputSchema.required).toEqual(expect.arrayContaining(["purchasePrice", "broker", "rent"]));
  });

  it("underwrites with the same numbers as the engine and the golden case", async () => {
    const r = await call("underwrite_property", { ...MEIDLING.input, detail: "full" });
    expect(r.isError).toBeFalsy();
    const data = json<UnderwriteResult>(r);
    expect(data).toEqual(underwrite(MEIDLING.input));
    expect(data.metrics).toMatchObject(MEIDLING.expected.metrics);
    expect(texts(r)[0]).toMatch(/cash flow before tax -€246\.16/);
    expect(texts(r)[0]).toMatch(/Break-even rent: €1,051\.42/);
    expect(texts(r)[0]).toMatch(/\| 1 \| -€6,345\.93 \| -€2,538\.37 \| -€34\.63 \|/);
    expect(texts(r)[0]).toMatch(/Liebhaberei \(25 years\): total surplus from year 20/);
  });

  it("reports the Richtwert cap for a fully regulated flat", async () => {
    const input = {
      valuationDate: "2026-10-18",
      purchasePrice: 340_000,
      broker: "none",
      property: { livingAreaM2: 68, ownership: "condominium", buildingPermitDate: "1905-06-01", state: "wien" },
      rent: { netColdMonthly: 980, fixedTerm: true },
      ownerCosts: { reserveFundMonthly: 95 },
    };
    const r = await call("underwrite_property", input);
    expect(r.isError).toBeFalsy();
    expect(json<UnderwriteResult>(r).rentCap.applicableBaseCents).toBe(34_374);
    expect(texts(r)[0]).toMatch(/Richtwert cap: Richtwert €6\.74 per m² × 68 m² = €343\.74 for the fixed-term lease/);
    expect(texts(r)[0]).toMatch(/The assumed rent is 285\.1% of €343\.74\./);
  });

  it("passes tax facts through to the engine", async () => {
    const input = { ...MEIDLING.input, tax: { otherTaxableIncome: 45_000, municipalityInhabitants: 2_000_000 } };
    const r = await call("underwrite_property", { ...input, detail: "full" });
    expect(r.isError).toBeFalsy();
    const data = json<UnderwriteResult>(r);
    expect(data.tax.method).toBe("tariff");
    expect(data).toEqual(underwrite(input as UnderwriteInput));
    expect(texts(r)[0]).toMatch(/Income tax: § 33 tariff 2026 on €45,000\.00 other income, bracket 40%\./);
  });

  it("uses today's date when no valuation date is given", async () => {
    const { valuationDate: _omit, ...input } = MEIDLING.input;
    const data = json<UnderwriteResult>(await call("underwrite_property", input));
    expect(data.valuationDate).toBe(TODAY);
  });

  it("estimates acquisition costs with a readable table", async () => {
    const r = await call("estimate_acquisition_costs", {
      purchasePrice: 250000,
      broker: { commissionPct: 3, sellerPaysCommission: true },
      financing: { loanAmount: 200000 },
    });
    expect(json<{ totalCents: number }>(r).totalCents).toBe(2_815_100);
    expect(json<{ lineItems: object[] }>(r).lineItems[0]).not.toHaveProperty("calculation");
    expect(texts(r)[0]).toMatch(/\| \*\*Total\*\* \| \*\*€28,151\.00\*\* \| 11\.26% of the price \|/);
    expect(texts(r)[0]).toMatch(/§ 7 Abs\. 1 Z 3 GrEStG 1987/);
  });

  it("returns engine validation problems as a tool error the agent can act on", async () => {
    const r = await call("underwrite_property", {
      purchasePrice: 200000,
      broker: { commissionPct: 12 },
      financing: { loanAmount: 100000, ratePct: 3.5, termYears: 0 },
      rent: { netColdMonthly: 800 },
    });
    expect(r.isError).toBe(true);
    expect(texts(r)[0]).toMatch(/broker\.commissionPct/);
    expect(texts(r)[0]).toMatch(/financing\.termYears/);
  });

  it("rejects malformed arguments before they reach the engine", async () => {
    const r = await call("underwrite_property", { purchasePrice: "a lot", broker: "none", rent: { netColdMonthly: 800 } });
    expect(r.isError).toBe(true);
  });

  it("explains uncovered dates", async () => {
    const r = await call("estimate_acquisition_costs", { valuationDate: "2024-01-01", purchasePrice: 200000, broker: "none" });
    expect(r.isError).toBe(true);
    expect(texts(r)[0]).toMatch(/2025-04-01/);
  });

  it("suggests passing the reserve when its legal minimum is not published yet", async () => {
    const r = await call("underwrite_property", { ...MEIDLING.input, valuationDate: "2028-03-01", ownerCosts: {} });
    expect(r.isError).toBe(true);
    expect(texts(r)[0]).toMatch(/reserveFundMonthly/);
  });

  it("lists the rules for a date with sources", async () => {
    const r = await call("get_rules", { date: "2026-07-31" });
    const data = json<{ rules: { id: string; value: string; sourceUrl: string }[]; assumptions: unknown[] }>(r);
    expect(data.rules.find((rule) => rule.id === "at.ggg.eingabe.fee")?.value).toBe("€58.00");
    expect(data.rules.find((rule) => rule.id === "at.mrg.condominiumPermitAfter")?.value).toBe("1945-05-08");
    expect(data.rules.every((rule) => rule.sourceUrl.startsWith("https://"))).toBe(true);
    expect(data.assumptions.length).toBeGreaterThanOrEqual(7);
  });
});

/** Every key of `part` exists in `whole` with an equal value; arrays match element by element in any position. */
function isSubset(part: unknown, whole: unknown): boolean {
  if (Array.isArray(part)) return Array.isArray(whole) && part.every((p) => whole.some((w) => isSubset(p, w)));
  if (part !== null && typeof part === "object") {
    if (whole === null || typeof whole !== "object") return false;
    return Object.entries(part).every(([k, v]) => k in whole && isSubset(v, (whole as Record<string, unknown>)[k]));
  }
  return part === whole;
}

describe("detail levels", () => {
  const cases = [
    ["underwrite_property", MEIDLING.input],
    ["underwrite_property", { ...MEIDLING.input, tax: { otherTaxableIncome: 45_000, municipalityInhabitants: 2_000_000 } }],
    ["underwrite_property", { ...MEIDLING.input, financing: undefined }],
    ["estimate_acquisition_costs", { purchasePrice: 250000, broker: { commissionPct: 3 }, financing: { loanAmount: 200000 } }],
  ] as const;

  it.each(cases)("%s: the summary is a much smaller subset of the full result", async (tool, input) => {
    const summary = await call(tool, input);
    const full = await call(tool, { ...input, detail: "full" });
    const s = json<Record<string, unknown>>(summary);
    const f = json<Record<string, unknown>>(full);
    const { citations, ...rest } = s;
    expect(isSubset(rest, f)).toBe(true);
    // Citations are collected from the whole result: each one appears in it, none twice.
    const fullText = texts(full)[1] as string;
    const list = citations as { legalBasis: string; sourceUrl: string }[];
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) expect(fullText).toContain(JSON.stringify(c));
    expect(new Set(list.map((c) => c.sourceUrl + c.legalBasis)).size).toBe(list.length);
    expect(texts(summary)[0]).toBe(texts(full)[0]);
    expect((texts(summary)[1] as string).length * (tool === "underwrite_property" ? 2 : 1.5)).toBeLessThan(fullText.length);
  });

  it("keeps the figures an agent needs, and nothing else is required for the answer", async () => {
    const s = json<Record<string, any>>(await call("underwrite_property", MEIDLING.input));
    expect(s.metrics).toMatchObject({ totalInvestmentCents: expect.any(Number), equityCents: expect.any(Number), breakEvenRentCents: expect.any(Number) });
    expect(s.financing.monthlyPaymentCents).toBeGreaterThan(0);
    expect(s.tax.years.map((y: { year: number }) => y.year)).toEqual([1, 3]);
    expect(s.rentRegulation.status).toBeDefined();
    expect(s.rentCap.status).toBeDefined();
    expect(s.tax.landShare.pct).toBeGreaterThan(0);
    expect(s.tax.liebhaberei.status).toBeDefined();
    expect(s.flags.every((f: object) => !("citations" in f))).toBe(true);
    expect(s.disclaimer).toMatch(/not investment, tax or legal advice/);
    expect(s.limitations.length).toBeGreaterThan(0);
    expect(s.assumptionsUsed.vacancyPct).toBeDefined();
  });

  it("rejects an unknown detail level", async () => {
    expect((await call("underwrite_property", { ...MEIDLING.input, detail: "everything" })).isError).toBe(true);
  });
});

describe("viennaToday", () => {
  it("uses Vienna's calendar date, not UTC", () => {
    expect(viennaToday(new Date("2026-10-17T22:30:00Z"))).toBe("2026-10-18");
    expect(viennaToday(new Date("2026-01-15T12:00:00Z"))).toBe("2026-01-15");
  });
});
