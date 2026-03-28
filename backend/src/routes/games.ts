import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { recalculateProgress } from "../modules/progress/progress-service.js";

const resultBodySchema = z.object({
  score: z.number().int().min(0),
  idempotencyKey: z.string().min(1)
});

export const gamesRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/games", async () => {
    const { rows } = await pool.query(
      `
        SELECT id, slug, title, difficulty
        FROM games
        WHERE is_active = TRUE
        ORDER BY id ASC
      `
    );
    return rows;
  });

  app.post("/games/:id/results", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    const body = resultBodySchema.safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.status(400).send({ message: "Invalid result payload" });
    }

    const userId = request.user.userId;
    const gameId = params.data.id;
    const { score, idempotencyKey } = body.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO game_results (user_id, game_id, score, idempotency_key)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, game_id, idempotency_key) DO NOTHING
        `,
        [userId, gameId, score, idempotencyKey]
      );
      await recalculateProgress(client, userId);
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
};
