import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  formatPromotionPlan,
  getPromotionPlan,
  promotionSlices,
} from "../src/promotion";

describe("promotion plan", () => {
  it("keeps the staged branch split into reviewable promotion slices", () => {
    expect(promotionSlices.map(slice => slice.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8-12",
      "12a",
      "13-14",
      "15-19",
      "20-21",
      "22-25",
      "26-30",
    ]);
  });

  it("keeps implementation-gated runtime slices out of staged status", () => {
    expect(
      promotionSlices
        .filter(slice => slice.status === "design-gated" || slice.status === "planned")
        .map(slice => slice.id),
    ).toEqual(["5", "7", "8-12", "15-19"]);
  });

  it("requires every promotion slice to carry a local verification command", () => {
    expect(promotionSlices.every(slice => slice.verification.length > 0)).toBe(true);
    expect(
      promotionSlices.flatMap(slice => slice.verification),
    ).toEqual(expect.arrayContaining([
      "pnpm test:ci",
      "pnpm run test:probe:staging",
      "pnpm run test:probe:upto-fixtures",
      "pnpm run test:probe:session-fixtures",
    ]));
  });

  it("formats human-readable and JSON promotion artifacts", () => {
    expect(formatPromotionPlan()).toContain(
      "slice:26-30 status:staged title:Planned adapter probes",
    );
    expect(getPromotionPlan()).toMatchObject({
      version: 1,
      slices: expect.arrayContaining([
        expect.objectContaining({
          id: "12a",
          status: "staged",
        }),
      ]),
    });
  });

  it("prints clean machine-readable promotion JSON", () => {
    const output = execFileSync("pnpm", ["exec", "tsx", "src/print-promotion.ts", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(JSON.parse(output)).toMatchObject({
      version: 1,
      slices: expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          status: "staged",
        }),
      ]),
    });
  });
});
