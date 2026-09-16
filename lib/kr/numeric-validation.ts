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

function maskListEnumerators(value: string) {
  return value.replace(/(^|\n)\s*\d{1,3}[.)]\s+/g, (match) => match.replace(/[0-9.)]/g, " "));
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

function comparableFacts(input: string) {
  // PLAYNC frequently inserts zero-width Unicode between month/day tokens.
  // Remove formatting-only characters before any numeric parsing.
  const cleanInput = input.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  const text = maskListEnumerators(cleanInput);
  const facts: string[] = [];
  const ranges: Range[] = [];

  pushMatches(text, /(1[0-2]|[1-9])\s*월\s*(3[01]|[12]\d|[1-9])\s*일/g, ranges, facts, (match) => {
    return `date:${Number(match[1])}-${Number(match[2])}`;
  });

  pushMatches(text, /\b(1[0-2]|0?[1-9])\/(3[01]|[12]\d|1[3-9])\b/g, ranges, facts, (match) => {
    return `date:${Number(match[1])}-${Number(match[2])}`;
  });

  const monthWords = Object.keys(RU_MONTHS).sort((a, b) => b.length - a.length).join("|");
  pushMatches(text, new RegExp(`(3[01]|[12]\\d|[1-9])\\s+(${monthWords})`, "gi"), ranges, facts, (match) => {
    const month = RU_MONTHS[match[2].toLowerCase()];
    return month ? `date:${month}-${Number(match[1])}` : null;
  });

  // Daily limits: Korean "1일 1회" and natural Russian "1 раз в день"
  // are semantically equivalent even though the latter writes only one digit.
  pushMatches(text, /(\d+)\s*일\s*(\d+)\s*회/g, ranges, facts, (match) => {
    return `freq:${Number(match[1])}d:${Number(match[2])}`;
  });
  pushMatches(text, /\b(\d+)\s+раз(?:а)?\s+в\s+(?:1\s+)?день\b/gi, ranges, facts, (match) => {
    return `freq:1d:${Number(match[1])}`;
  });

  // Korean whole-hour ranges such as 18~24시 are a single schedule fact.
  pushMatches(text, /(?<!\d)([01]?\d|2[0-4])\s*[~～–-]\s*([01]?\d|2[0-4])\s*시/g, ranges, facts, (match) => {
    return `timerange:${Number(match[1])}:00-${Number(match[2])}:00`;
  });
  pushMatches(text, /\b([01]?\d|2[0-4]):00\s*(?:~|～|–|-|до)\s*([01]?\d|2[0-4]):00\b/gi, ranges, facts, (match) => {
    return `timerange:${Number(match[1])}:00-${Number(match[2])}:00`;
  });

  pushMatches(text, /(?<!\d)(오전|오후)?\s*(24|[01]?\d|2[0-3])\s*시(?:\s*([0-5]?\d)\s*분)?/g, ranges, facts, (match) => {
    let hour = Number(match[2]);
    if (hour === 24) return `time:24:00`;
    if (match[1] === "오후" && hour < 12) hour += 12;
    if (match[1] === "오전" && hour === 12) hour = 0;
    return `time:${hour}:${String(match[3] || "0").padStart(2, "0")}`;
  });
  pushMatches(text, /\b(24|[01]?\d|2[0-3]):([0-5]\d)\b/g, ranges, facts, (match) => {
    if (match[1] === "24" && match[2] !== "00") return null;
    return `time:${Number(match[1])}:${match[2].padStart(2, "0")}`;
  });

  pushMatches(text, /([+-]?\d+(?:[.,]\d+)?)\s*(조|억|만|천)(?![가-힣])/g, ranges, facts, (match) => {
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

  // Natural Russian often spells Korean 1종 as "один из вариантов".
  // Add the omitted numeric fact without changing the displayed translation.
  const oneOfMatches = remainder.match(/\bод(?:ин|на|но)\s+из\b/gi) || [];
  for (let index = 0; index < oneOfMatches.length; index += 1) facts.push("n:1");

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
