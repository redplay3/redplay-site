"use client";

import { useEffect } from "react";
import { preferenceFromArticleEdition, saveEditionPreference } from "@/lib/edition-preference";

export function RememberEditionPreference({ edition }: { edition: "main" | "essence" | "special-project" }) {
  useEffect(() => {
    saveEditionPreference(preferenceFromArticleEdition(edition));
  }, [edition]);

  return null;
}
