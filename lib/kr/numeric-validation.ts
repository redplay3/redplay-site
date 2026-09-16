import { extractNumericTokens, type KrNumericToken } from "@/lib/kr/parser";

type Range = { start: number; end: number };

const RU_MONTHS: Record<string, number> = {
  январь: 1, января: 1, январе: 1, январю: 1,
  февраль: 2, февраля: 2, феврале: 2, февралю: 2,
  март: 3, марта: 3, марте: 3, марту: 3,
  апрель: 4, апреля: 4, апреле: 4, апрелю: 4,
  май: 5, мая: 5, мае: 5, маю: 5,
  июнь: 6, июня: 6, июне: 6, июню: 6,
  июль: 7, июля: 7, июле: 7, июлю: 7,
  август: 8, августа: 8, августе: 8, августу: 8,
  сентябрь: 9, сентября: 9, сентябре: 9, сентябрю: 9,
  октябрь: 10, октября: 10, октябре: 10, октябрю: 10,
  ноябрь: 11, ноября: 11, ноябре: 11, ноябрю: 11,
  декабрь: 12, декабря: 12, декабре: 12, декабрю: 12,
};

function normalizeDecimal(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function plainNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function masked(value: string, ranges: Range[]) {
  const chars = [...value];
  for (const range of ranges) {
    for (let index = range.start; index < range.end && index < chars.length; index += 1) chars[index] = " ";
  }
  return chars.join("");
}

function pushMatches(
  text: string,
  pattern: RegExp,
  ranges: Range[],
  facts: string[],
  makeFact: (match: RegExpExecArray) => string | null,
) {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (ranges.some((range) => match!.index < range.end && pattern.lastIndex > range.start)) continue;
    const fact = makeFact(match);
    if (!fact) continue;
    facts.push(fact);
    ranges.push({ start: match.index, end: pattern.lastIndex });
  }
}

function comparableFacts(text: string) {
  const facts: string[] = [];
  const ranges: Range[] = [];

  // Korean calendar dates: 9월 16일.
  pushMatches(text, /(1[0-2]|[1-9])\s*월\s*(3[01]|[12]\d|[1-9])\s*일/g, ranges, facts, (match) => {
    return `date:${Number(match[1])}-${Number(match[2])}`;
  });

  // PLAYNC often uses compact month/day notation in tables: 9/16~9/30.
  // Treat only unambiguous month/day pairs (day > 12) as dates here.
  pushMatches(text, /\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|1[3-9])\b/g, ranges, facts, (match) => {
    return `date:${Number(match[1])}-${Number(match[2])}`;
  });

  // Russian calendar dates: 16 сентября.
  const monthWords = Object.keys(RU_MONTHS).sort((a, b) => b.length - a.length).join("|");
  pushMatches(text, new RegExp(`(3[01]|[12]\\d|[1-9])\\s+(${monthWords})`, "gi"), ranges, facts, (match) => {
    const month = RU_MONTHS[match[2].toLowerCase()];
    return month ? `date:${month}-${Number(match[1])}` : null;
  });

  // Clock time should compare as one fact. Korean 20시 / 20시 30분 is equivalent to 20:00 / 20:30.
  pushMatches(text, /\b([01]?\d|2[0-3])\s*시(?:\s*([0-5]?\d)\s*분)?/g, ranges, facts, (match) => {
    return `time:${Number(match[1])}:${String(match[2] || "0").padStart(2, "0")}`;
  });
  pushMatches(text, /\b([01]?\d|2[0-3]):([0-5]\d)\b/g, ranges, facts, (match) => {
    return `time:${Number(match[1])}:${match[2].padStart(2, "0")}`;
  });

  // Korean large-number units. Korean letters are not JS \w chars, so do not use \b after the unit.
  // 10억 = 1,000,000,000; 5만 = 50,000; 3천 = 3,000; 1조 = 1,000,000,000,000.
  pushMatches(text, /([+-]?\d+(?:[.,]\d+)?)\s*(조|억|만|천)/g, ranges, facts, (match) => {
    const value = normalizeDecimal(match[1]);
    if (value == null) return null;
    const factor = match[2] === "조"
      ? 1_000_000_000_000
      : match[2] === "억"
        ? 100_000_000
        : match[2] === "만"
          ? 10_000
          : 1_000;
    return `n:${plainNumber(value * factor)}`;
  });

  // Russian large-number units.
  pushMatches(text, /([+-]?\d+(?:[.,]\d+)?)\s*(трлн\.?|триллион(?:а|ов)?|млрд\.?|миллиард(?:а|ов)?|млн\.?|миллион(?:а|ов)?|тыс\.?|тысяч(?:а|и)?)/gi, ranges, facts, (match) => {
    const value = normalizeDecimal(match[1]);
    if (value == null) return null;
    const unit = match[2].toLowerCase();
    const factor = unit.startsWith("трлн") || unit.startsWith("триллион")
      ? 1_000_000_000_000
      : unit.startsWith("млрд") || unit.startsWith("миллиард")
        ? 1_000_000_000
        : unit.startsWith("млн") || unit.startsWith("миллион")
          ? 1_000_000
          : 1_000;
    return `n:${plainNumber(value * factor)}`;
  });

  const remainder = masked(text, ranges);
  for (const token of extractNumericTokens(remainder)) {
    facts.push(token.kind === "percent" ? `p:${token.normalized}` : `n:${token.normalized}`);
  }
  return facts;
}

function outputFactsWithNumericDates(sourceFacts: string[], outputText: string) {
  const sourceDates = new Set(sourceFacts.filter((fact) => fact.startsWith("date:")));
  const ranges: Range[] = [];
  const dateFacts: string[] = [];
  const pattern = /\b(3[01]|[12]\d|0?[1-9])[./](1[0-2]|0?[1-9])\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(outputText)) !== null) {
    const fact = `date:${Number(match[2])}-${Number(match[1])}`;
    if (!sourceDates.has(fact)) continue;
    dateFacts.push(fact);
    ranges.push({ start: match.index, end: pattern.lastIndex });
  }
  if (!ranges.length) return comparableFacts(outputText);

  // comparableFacts would treat 16.09 as a decimal number. Mask matched source dates,
  // then put them back as canonical date facts.
  const withoutDates = comparableFacts(masked(outputText, ranges));
  return [...withoutDates, ...dateFacts];
}

function multiset(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return map;
}

export function compareNumericFacts(sourceText: string, outputText: string) {
  const source = comparableFacts(sourceText);
  const output = outputFactsWithNumericDates(source, outputText);
  const left = multiset(source);
  const right = multiset(output);
  const differences: Array<{ value: string; source: number; output: number }> = [];
  const keys = new Set([...left.keys(), ...right.keys()]);
  for (const value of keys) {
    const sourceCount = left.get(value) || 0;
    const outputCount = right.get(value) || 0;
    if (sourceCount !== outputCount) differences.push({ value, source: sourceCount, output: outputCount });
  }
  return { pass: differences.length === 0, source, output, differences };
}

export function factsToNumericTokens(facts: string[]): KrNumericToken[] {
  return facts.filter((fact) => fact.startsWith("n:") || fact.startsWith("p:")).map((fact) => {
    const percent = fact.startsWith("p:");
    const normalized = fact.slice(2);
    return { raw: normalized, normalized, kind: percent ? "percent" as const : "number" as const };
  });
}
