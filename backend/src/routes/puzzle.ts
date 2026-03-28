import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";

const sessionSchema = z.object({
  sessionKey: z.string().min(1).max(120)
});

export const puzzleRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/puzzle-levels", async () => {
    const { rows } = await pool.query(
      `
        SELECT id, title, image_url AS "imageUrl", order_index AS "orderIndex"
        FROM puzzle_levels
        WHERE is_active = TRUE
        ORDER BY order_index ASC, id ASC
      `
    );
    return rows;
  });

  app.get("/puzzle-collected", async (request, reply) => {
    const parsed = sessionSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Missing sessionKey" });
    }
    const { sessionKey } = parsed.data;
    const { rows } = await pool.query(
      `
        SELECT
          level_id AS "levelId",
          level_title AS "levelTitle",
          image_url AS "imageUrl",
          completed_at AS "completedAt"
        FROM puzzle_collected
        WHERE session_key = $1
        ORDER BY completed_at DESC
      `,
      [sessionKey]
    );
    return rows;
  });

  app.post("/puzzle-levels/:id/complete", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    const body = sessionSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ message: "Invalid completion payload" });
    }

    const levelId = params.data.id;
    const { sessionKey } = body.data;
    const level = await pool.query<{ id: number; title: string; imageUrl: string }>(
      `
        SELECT id, title, image_url AS "imageUrl"
        FROM puzzle_levels
        WHERE id = $1 AND is_active = TRUE
      `,
      [levelId]
    );
    if (!level.rows[0]) {
      return reply.status(404).send({ message: "Puzzle level not found" });
    }

    const current = level.rows[0];
    await pool.query(
      `
        INSERT INTO puzzle_collected (session_key, level_id, level_title, image_url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_key, level_id) DO NOTHING
      `,
      [sessionKey, levelId, current.title, current.imageUrl]
    );
    return { ok: true };
  });
};
