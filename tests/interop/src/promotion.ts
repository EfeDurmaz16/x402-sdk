export type PromotionSliceStatus =
  | "staged"
  | "staged-experimental"
  | "design-gated"
  | "planned";

export type PromotionSlice = {
  id: string;
  title: string;
  status: PromotionSliceStatus;
  verification: string[];
};

export const promotionSlices: PromotionSlice[] = [
  {
    id: "1",
    title: "Scheme and intent boundary docs plus capability metadata tests.",
    status: "staged",
    verification: ["pnpm run test:probe:usage-boundaries", "pnpm capabilities"],
  },
  {
    id: "2",
    title: "Interop capability matrix surfaced in runner diagnostics.",
    status: "staged",
    verification: ["pnpm run test:probe:reports"],
  },
  {
    id: "3",
    title: "upto scenario fixtures and negative cases.",
    status: "staged",
    verification: ["pnpm run test:probe:upto-fixtures"],
  },
  {
    id: "4",
    title: "TypeScript upto server support.",
    status: "staged-experimental",
    verification: ["pnpm run test:probe:typescript-upto-server"],
  },
  {
    id: "5",
    title: "TypeScript upto client support.",
    status: "design-gated",
    verification: ["pnpm run test:probe:upto-boundary"],
  },
  {
    id: "6",
    title: "Rust upto server support.",
    status: "staged-experimental",
    verification: ["pnpm run test:probe:rust-upto-server"],
  },
  {
    id: "7",
    title: "Rust upto client support.",
    status: "planned",
    verification: ["pnpm run test:probe:upto-boundary"],
  },
  {
    id: "8-12",
    title: "Python, Go, Ruby, Lua, and PHP upto adapter support.",
    status: "planned",
    verification: ["pnpm run test:probe:planned-syntax", "pnpm run test:probe:planned-runtime"],
  },
  {
    id: "12a",
    title: "Solana upto vs batch-settlement authorization design note.",
    status: "staged",
    verification: ["pnpm run test:probe:batch-settlement-fixtures"],
  },
  {
    id: "13-14",
    title: "Session detection fixtures and experimental scenario contract.",
    status: "staged",
    verification: ["pnpm run test:probe:session-fixtures"],
  },
  {
    id: "15-19",
    title: "Python, Go, Ruby, Lua, and PHP session adapter support.",
    status: "planned",
    verification: ["pnpm run test:probe:session-boundary"],
  },
  {
    id: "20-21",
    title: "Subscription boundary docs, detection fixtures, and diagnostics.",
    status: "staged",
    verification: ["pnpm run test:probe:subscription-fixtures"],
  },
  {
    id: "22-25",
    title: "Matrix reports, maintainer runbook, CI opt-in flags, and capability cleanup.",
    status: "staged",
    verification: ["pnpm test:ci", "pnpm run test:probe:reports"],
  },
  {
    id: "26-30",
    title: "Planned adapter probes, Lua/PHP server-only checks, and targeted fixture probes.",
    status: "staged",
    verification: ["pnpm run test:probe:staging"],
  },
  {
    id: "31",
    title: "Machine-readable promotion plan for splitting staging into PRs.",
    status: "staged",
    verification: ["pnpm promotion", "pnpm promotion:json"],
  },
];

export function getPromotionPlan() {
  return {
    version: 1,
    slices: promotionSlices,
  };
}

export function formatPromotionPlan(): string {
  return promotionSlices
    .map(slice => {
      const verification = slice.verification.join(" && ");
      return `slice:${slice.id} status:${slice.status} title:${slice.title} verify:${verification}`;
    })
    .join("\n");
}
