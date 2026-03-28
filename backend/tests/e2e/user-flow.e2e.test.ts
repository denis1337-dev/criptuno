import { describe, expect, it } from "vitest";
import { resolveAvatarStage } from "../../src/modules/avatar/avatar-rules-engine.js";

describe("e2e user flow (logic level)", () => {
  it("maps cumulative score to expected avatar stage", () => {
    const scores = [60, 70, 140];
    const total = scores.reduce((acc, value) => acc + value, 0);
    expect(resolveAvatarStage(total)).toBe("stage3");
  });
});
