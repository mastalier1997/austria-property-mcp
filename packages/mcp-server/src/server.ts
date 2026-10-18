import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ACQUISITION_ASSUMPTIONS,
  acquisitionCosts,
  DISCLAIMER,
  ENGINE_VERSION,
  HEURISTICS,
  InputError,
  listRules,
  OPERATING_ASSUMPTIONS,
  RuleNotCoveredError,
  underwrite,
  type AcquisitionCostsInput,
  type UnderwriteInput,
} from "@austria-property/engine";
import { acquisitionInput, rulesInput, underwriteInput } from "./schemas.js";
import { formatRuleValue, summariseAcquisition, summariseUnderwrite } from "./summary.js";

/** Keep in sync with package.json (checked by a test). */
export const SERVER_VERSION = "0.5.0";
export const SERVER_NAME = "austria-property";

export interface ServerOptions {
  /** Today's date as YYYY-MM-DD; injectable for tests. Defaults to the date in Vienna. */
  today?: () => string;
}

/** Today's calendar date in Vienna, YYYY-MM-DD. */
export function viennaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const INSTRUCTIONS = `Austrian residential property calculations with cited legal sources (RIS).
- estimate_acquisition_costs: purchase costs on top of the price (Kaufnebenkosten).
- underwrite_property: full buy-to-let analysis (costs, loan, cash flow before and after income tax, yields, break-even rent, MRG rent caps with the Richtwert, AfA, Liebhaberei check, risk flags).
- get_rules: the statutory values and default assumptions behind the numbers, for citing.
All amounts are EUR; rents and owner costs are monthly and net of VAT. Results are deterministic calculations, not investment, tax or legal advice; say so when presenting them.`;

const ANNOTATIONS = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

function result(summary: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text: summary },
      { type: "text", text: JSON.stringify(data) },
    ],
  };
}

function toolError(error: unknown): CallToolResult {
  if (error instanceof InputError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Invalid input. Fix these fields and call again:\n${error.issues.map((i) => `- ${i.path || "(input)"}: ${i.message}`).join("\n")}`,
        },
      ],
    };
  }
  if (error instanceof RuleNotCoveredError) {
    const hint =
      error.ruleId === "at.weg.minReservePerM2"
        ? " The statutory minimum repair reserve for that date is not published yet; pass ownerCosts.reserveFundMonthly."
        : " Use a valuationDate between 2025-04-01 and 2027-12-31.";
    return { isError: true, content: [{ type: "text", text: `${error.message}${hint}` }] };
  }
  throw error;
}

function withoutUndefined<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createServer(options: ServerOptions = {}): McpServer {
  const today = options.today ?? (() => viennaToday());
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "estimate_acquisition_costs",
    {
      title: "Austrian property purchase costs",
      description:
        "Calculate the one-off costs of buying residential property in Austria on top of the price (Kaufnebenkosten): " +
        "real estate transfer tax (Grunderwerbsteuer), land-register court fees, broker commission with a check against the legal maximum, " +
        "and lawyer/notary contract costs, each with VAT where it applies. " +
        "Use when someone asks what buying a specific flat or house in Austria costs in total. " +
        "Every statutory line cites its legal basis and source. Amounts in EUR. " +
        "Not covered: bank or valuation fees, purchases within the family, exemptions for a primary residence.",
      inputSchema: acquisitionInput,
      annotations: ANNOTATIONS,
    },
    async (args) => {
      try {
        const input = withoutUndefined({ ...args, valuationDate: args.valuationDate ?? today() }) as AcquisitionCostsInput;
        const r = acquisitionCosts(input);
        return result(summariseAcquisition(r), r);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "underwrite_property",
    {
      title: "Underwrite an Austrian buy-to-let purchase",
      description:
        "Analyse an Austrian residential property as a rental investment: acquisition costs, annuity loan payment, monthly cash flow before and after income tax, " +
        "gross and net yield, cash-on-cash return, debt cover (DSCR), break-even rent, whether statutory rent caps (MRG) apply and the Richtwert cap, " +
        "depreciation (AfA) with the legal land share, a 25-year Liebhaberei check, and risk flags. " +
        "Use when evaluating whether a specific flat or house is a good buy-to-let deal. " +
        "Inputs in EUR; rents and owner costs are monthly and net of VAT. Pass what you know: missing facts fall back to documented assumptions and are flagged. " +
        "Not covered: rent increases or interest-rate changes over time, tax credits, Richtwert surcharges and deductions (Zuschläge/Abschläge).",
      inputSchema: underwriteInput,
      annotations: ANNOTATIONS,
    },
    async (args) => {
      try {
        const input = withoutUndefined({ ...args, valuationDate: args.valuationDate ?? today() }) as UnderwriteInput;
        const r = underwrite(input);
        return result(summariseUnderwrite(r), r);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "get_rules",
    {
      title: "Statutory rules and assumptions",
      description:
        "List the statutory values the engine uses on a date (tax and fee rates, broker caps, minimum repair reserve, MRG cut-off dates, Richtwerte per state, AfA rates, land shares, income tax brackets), " +
        "each with legal basis, source URL and the date it was last verified, plus the default assumptions and risk thresholds. " +
        "Use to cite sources or to explain how a number was calculated.",
      inputSchema: rulesInput,
      annotations: ANNOTATIONS,
    },
    async (args) => {
      try {
        const date = args.date ?? today();
        const rules = listRules(date).map((rule) => ({
          id: rule.id,
          description: rule.description,
          value: formatRuleValue(rule),
          validFrom: rule.validFrom,
          validTo: rule.validTo ?? null,
          legalBasis: rule.legalBasis,
          sourceUrl: rule.sourceUrl,
          publicationUrl: rule.publicationUrl ?? null,
          verifiedOn: rule.verifiedOn,
          note: rule.note ?? null,
        }));
        const assumptions = Object.entries({ ...ACQUISITION_ASSUMPTIONS, ...OPERATING_ASSUMPTIONS }).map(([id, def]) => ({
          id,
          default: def.default,
          description: def.description,
          source: def.source,
        }));
        const data = { date, engineVersion: ENGINE_VERSION, rules, assumptions, heuristics: HEURISTICS, disclaimer: DISCLAIMER };
        const summary = [
          `Rules valid on ${date} (${rules.length}):`,
          ...rules.map((r) => `- ${r.description}: ${r.value} (${r.legalBasis}; verified ${r.verifiedOn})`),
          "",
          `Default assumptions: ${assumptions.map((a) => `${a.id} = ${a.default}`).join(", ")}.`,
        ].join("\n");
        return result(summary, data);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}
