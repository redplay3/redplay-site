export type EditionPreference = "all" | "main" | "essence";

export const EDITION_COOKIE_NAME = "redplay_edition";
export const EDITION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function readEditionPreference(): EditionPreference {
  if (typeof document === "undefined") return "all";
  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${EDITION_COOKIE_NAME}=`))
    ?.split("=")[1];
  return value === "main" || value === "essence" ? value : "all";
}

export function saveEditionPreference(value: EditionPreference) {
  if (typeof document === "undefined") return;
  document.cookie = `${EDITION_COOKIE_NAME}=${value}; Max-Age=${EDITION_COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`;
}

export function preferenceFromArticleEdition(edition: "main" | "essence" | "special-project"): Exclude<EditionPreference, "all"> {
  return edition === "main" ? "main" : "essence";
}
