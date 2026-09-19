export type TestStatus = "draft" | "published" | "archived";
export type TestKind = "class-comparison" | "location-comparison";
export type EvidenceKind = "measurement" | "calculation" | "interpretation";

export type TestEntityRef = {
  id: string;
  type: "class" | "location";
  name: string;
};

export type TestContender = {
  id: string;
  name: string;
  shortName: string;
  accent: "red" | "cyan";
};

export type TestResultValue = {
  xpPerHour: number | null;
  adenaPerHour: number | null;
};

export type TestScenario = {
  id: string;
  name: string;
  durationMinutes: number;
  contenderIds?: string[];
  values: Record<string, TestResultValue>;
  unavailableReason?: Record<string, string>;
  xpDeltaPercent: number;
  adenaDeltaPercent: number | null;
  winnerXp: string;
  winnerAdena: string | null;
  xpNote?: string;
  adenaNote?: string;
};

export type TestDecision = {
  goal: string;
  choice: string;
  reason: string;
};

export type TestRecord = {
  id: string;
  number: string;
  slug: string;
  status: TestStatus;
  kind: TestKind;
  title: string;
  shortTitle: string;
  question: string;
  answer: string;
  summary: string;
  edition: string;
  testedAt: string | null;
  patch: string | null;
  sampleLabel: string;
  contenders: TestContender[];
  relations: TestEntityRef[];
  decisions: TestDecision[];
  method: string[];
  characterStats?: Array<{ label: string; values: Record<string, string> }>;
  scenarios: TestScenario[];
  measuredFacts: string[];
  interpretation: string[];
  limitations: string[];
  applicability: string[];
  notProven: string[];
  video: { status: "linked" | "awaiting-url"; title: string; url?: string };
  evidenceImages?: Array<{ src: string; alt: string; caption: string; width?: number; height?: number }>;
  history: Array<{ version: string; label: string; state: string }>;
};
