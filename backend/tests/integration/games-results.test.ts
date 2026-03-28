import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("../../src/db.js", () => ({
  pool: {
    query: queryMock,
    connect: vi.fn().mockResolvedValue({
      query: queryMock,
      release: vi.fn()
    })
  }
}));

vi.mock("../../src/config.js", () => ({
  config: {
    frontendOrigin: "http://localhost:5173",
    jwtSecret: "test-secret",
    telegramBotToken: "bot-token"
  }
}));

import { buildApp } from "../../src/app.js";

describe("POST /games/:id/results", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("rejects unauthenticated calls", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/games/1/results",
      payload: { score: 10, idempotencyKey: "k1" }
    });

    expect(response.statusCode).toBe(401);
  });
});
