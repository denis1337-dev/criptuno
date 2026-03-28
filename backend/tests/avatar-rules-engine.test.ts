import { describe, expect, it } from "vitest";
import { resolveAvatarStage } from "../src/modules/avatar/avatar-rules-engine.js";

describe("resolveAvatarStage", () => {
  it("returns stage1 for low scores", () => {
    expect(resolveAvatarStage(0)).toBe("stage1");
    expect(resolveAvatarStage(99)).toBe("stage1");
  });

  it("returns stage2 for medium scores", () => {
    expect(resolveAvatarStage(100)).toBe("stage2");
    expect(resolveAvatarStage(249)).toBe("stage2");
  });

  it("returns stage3 for high scores", () => {
    expect(resolveAvatarStage(250)).toBe("stage3");
  });
});
