import { FastifyInstance } from "fastify";
import { pool } from "../db.js";

export const profileRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/profile/me", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const { rows } = await pool.query(
      `
        SELECT
          u.telegram_id AS "telegramId",
          u.username,
          u.first_name AS "firstName",
          u.avatar_stage AS "avatarStage",
          up.total_score AS "totalScore",
          up.completed_games AS "completedGames"
        FROM users u
        LEFT JOIN user_progress up ON up.user_id = u.id
        WHERE u.id = $1
      `,
      [userId]
    );
    return rows[0] ?? null;
  });
};
