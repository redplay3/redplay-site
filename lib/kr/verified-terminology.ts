const VERIFIED_RU_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Дредноут/g, "Полководец"],
  [/Вангард/g, "Авангард"],
  [/Магических кристаллов/g, "Руды духов"],
  [/магических кристаллов/g, "руды духов"],
  [/Магические кристаллы/g, "Руда духов"],
  [/магические кристаллы/g, "руда духов"],
  [/Магический кристалл/g, "Руда духов"],
  [/магический кристалл/g, "руда духов"],
  [/Магических камней/g, "Руды духов"],
  [/магических камней/g, "руды духов"],
  [/Магические камни/g, "Руда духов"],
  [/магические камни/g, "руда духов"],
];

/**
 * Human-verified RedPlay terminology. This layer has higher priority than AI
 * output and is intentionally tiny: only terms confirmed by the editor belong
 * here. Expand it as terminology is verified.
 */
export function applyVerifiedRuTerminology(value: string) {
  return VERIFIED_RU_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export const VERIFIED_CLASS_TERMS = {
  Dreadnought: "Полководец",
  Vanguard: "Авангард",
} as const;

export const VERIFIED_GAME_TERMS = {
  "마정석": "Руда духов",
  "Magic Crystal": "Руда духов",
} as const;
