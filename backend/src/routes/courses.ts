import { FastifyInstance } from "fastify";
import { pool } from "../db.js";

export const coursesRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/courses", async () => {
    const { rows } = await pool.query(
      `
        SELECT id, title, order_index AS "orderIndex", url, is_premium AS "isPremium"
        FROM courses
        WHERE is_active = TRUE
        ORDER BY order_index ASC
      `
    );
    return rows;
  });

  app.get("/courses/:id/modules", async (request) => {
    const { id } = request.params as { id: string };
    const { rows } = await pool.query(
      `
        SELECT id, title, content, order_index AS "orderIndex"
        FROM course_modules
        WHERE course_id = $1 AND is_active = TRUE
        ORDER BY order_index ASC
      `,
      [id]
    );
    return rows;
  });
};
