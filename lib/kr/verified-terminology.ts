const VERIFIED_RU_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Дредноут/g, "Полководец"],
  [/Вангард/g, "Авангард"],
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
