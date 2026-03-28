import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db.js";
import { extractTelegramUser, verifyTelegramInitData } from "../modules/auth/telegram.js";

const bodySchema = z.object({
  initData: z.string().min(1)
});

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/auth/telegram", async (request, reply) => {
    const parse = bodySchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ message: "Invalid request body" });
    }

    const { initData } = parse.data;
    const isValid = verifyTelegramInitData(initData, config.telegramBotToken);
    if (!isValid) {
      return reply.status(401).send({ message: "Invalid Telegram initData" });
    }

    const tgUser = extractTelegramUser(initData);
    if (!tgUser) {
      return reply.status(400).send({ message: "Missing Telegram user data" });
    }

    const result = await pool.query<{ id: number }>(
      `
        INSERT INTO users (telegram_id, username, first_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (telegram_id)
        DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name
        RETURNING id
      `,
      [tgUser.id, tgUser.username ?? null, tgUser.first_name]
    );

    const userId = result.rows[0].id;
    await pool.query(
      `
        INSERT INTO user_progress (user_id, total_score, completed_games)
        VALUES ($1, 0, 0)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [userId]
    );

    const token = await reply.jwtSign({ userId, telegramId: tgUser.id });
    return reply.send({ token });
  });
};
