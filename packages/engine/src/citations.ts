/** Where a number or a method comes from. */
export interface Citation {
  legalBasis: string;
  sourceUrl: string;
}

/** Official sources (RIS, Bundesgesetzblatt) used by the rule catalogue. */
export const SOURCES = {
  grestg7:
    "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004531&Paragraf=7",
  ggg: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10002667",
  gggValorisation2025:
    "https://www.ris.bka.gv.at/Dokumente/BgblAuth/BGBLA_2025_II_51/BGBLA_2025_II_51.pdf",
  gggValorisation2026:
    "https://www.ris.bka.gv.at/Dokumente/BgblAuth/BGBLA_2026_II_227/BGBLA_2026_II_227.pdf",
  makler:
    "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10007765",
  ustg10:
    "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Paragraf=10",
  bao204:
    "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=204",
  weg31:
    "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001921&Paragraf=31",
  wkoReserve2026:
    "https://www.wko.at/information-consulting/immobilien-vermoegenstreuhaender/mindestruecklage-wohnungseigentumsgesetz",
  oviReserve2026: "https://www.ovi.at/aktuelles/detailansicht/anhebung-der-mindestruecklage-1-1-2026",
  mrg16: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10002531&Paragraf=16",
  richtwg5: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003166&Paragraf=5",
  richtwg: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003166",
  richtwerte2023: "https://www.ris.bka.gv.at/Dokumente/BgblAuth/BGBLA_2023_II_81/BGBLA_2023_II_81.pdf",
  richtwerte2026: "https://www.statistik.at/fileadmin/pages/2114/VOe_Richtwerte_Kategoriemieten_20260401.pdf",
  mrg1: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10002531&Paragraf=1",
  estg16: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=16",
  estg19: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=19",
  estg33: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=33",
  grundanteilV: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20009521",
  lvo: "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004804",
  bfgReserve2014: "https://linda.lindeverlag.at/Dokument/153221/",
} as const;

const MAKLER = "Standes- und Ausübungsregeln für Immobilienmakler";

/** Citations for methods (rounding, cap logic) rather than single values. */
export const METHOD_CITATIONS = {
  /** Court fees: base and percentage fee are rounded up to the next whole euro. */
  gggRounding: { legalBasis: "§ 6 Abs. 2 GGG", sourceUrl: SOURCES.ggg },
  /** Taxes are rounded commercially to whole cents. */
  baoRounding: { legalBasis: "§ 204 Abs. 1 BAO", sourceUrl: SOURCES.bao204 },
  /** Broker cap base: agreed price plus assumed liabilities. */
  maklerValue: { legalBasis: `§ 16 Abs. 1 ${MAKLER}`, sourceUrl: SOURCES.makler },
  /** Above a bracket threshold, the cap never falls below the lower bracket's maximum. */
  maklerFloor: { legalBasis: `§ 12 Abs. 4 ${MAKLER}`, sourceUrl: SOURCES.makler },
  /** One side may pay up to double the cap if the other side pays no commission. */
  maklerOneSided: { legalBasis: `§ 12 Abs. 2 ${MAKLER}`, sourceUrl: SOURCES.makler },
  /** USt is not included in the caps. */
  maklerVatExcluded: { legalBasis: `§ 12 Abs. 1 ${MAKLER}`, sourceUrl: SOURCES.makler },
  /** Prepaid costs of borrowing are spread evenly over the period they cover. */
  loanCostsSpread: { legalBasis: "§ 19 Abs. 3 EStG 1988", sourceUrl: SOURCES.estg19 },
  /** Repair-reserve contributions are deductible only when the reserve is spent. */
  reserveDeduction: { legalBasis: "BFG 23.10.2014, RV/3100573/2014", sourceUrl: SOURCES.bfgReserve2014 },
} satisfies Record<string, Citation>;
