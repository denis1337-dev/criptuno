import { describe, expect, it, vi } from "vitest";
import { recalculateProgress } from "../src/modules/progress/progress-service.js";

describe("recalculateProgress", () => {
  it("updates progress and avatar stage", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total_score: 280, completed_games: 4 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const client = { query } as unknown as Parameters<typeof recalculateProgress>[0];
    await recalculateProgress(client, 10);

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][1]).toEqual([10, "stage3"]);
  });
});
