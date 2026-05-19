import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatPromotionPlan,
  getPromotionPlan,
  promotionSlices,
} from "../src/promotion";

describe("promotion plan", () => {
  function expandSliceId(id: string): string[] {
    if (!id.includes("-")) {
      return [id];
    }

    const [start, end] = id.split("-").map(Number);
    return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
  }

  function roadmapRows(): Array<{ id: string; title: string; status: string }> {
    const roadmap = readFileSync("../../docs/interop/usage-based-roadmap.md", "utf8");
    const rows = roadmap.match(/^\| [^|]+ \| [^|]+ \| [^|]+ \|$/gm) ?? [];

    return rows
      .map(row => row.split("|").slice(1, 4).map(cell => cell.trim()))
      .filter(([id]) => id !== "#" && id !== "---")
      .map(([id, title, status]) => ({ id, title, status }));
  }

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
      "31",
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

  it("keeps promotion slice IDs aligned with the roadmap table", () => {
    const roadmapIds = new Set(roadmapRows().map(row => row.id));
    const promotedIds = promotionSlices.flatMap(slice => expandSliceId(slice.id));

    expect(promotedIds).toEqual(expect.arrayContaining(["1", "12", "12a", "31"]));
    expect(promotedIds.every(id => roadmapIds.has(id))).toBe(true);
  });

  it("keeps roadmap statuses representable in promotion metadata", () => {
    const roadmapStatusById = new Map(roadmapRows().map(row => [row.id, row.status]));

    for (const slice of promotionSlices) {
      for (const id of expandSliceId(slice.id)) {
        const roadmapStatus = roadmapStatusById.get(id);
        expect(roadmapStatus).toBeDefined();

        if (roadmapStatus === "staged as experimental") {
          expect(slice.status).toBe("staged-experimental");
        } else {
          expect(slice.status).toBe(roadmapStatus);
        }
      }
    }
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
