import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";

export const coursesRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/courses", async () => {
    const { rows } = await pool.query(`
      SELECT
        id,
        title,
        difficulty,
        order_index AS "orderIndex"
      FROM courses
      WHERE is_active = TRUE
      ORDER BY order_index ASC
    `);
    return rows;
  });

  app.get("/courses/:id/modules", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ message: "Invalid course id" });
    }

    const courseId = params.data.id;
    const course = await pool.query(
      `SELECT id, title, difficulty FROM courses WHERE id = $1 AND is_active = TRUE`,
      [courseId]
    );
    if (!course.rows[0]) {
      return reply.status(404).send({ message: "Course not found" });
    }

    const { rows } = await pool.query(`
      SELECT
        id,
        course_id AS "courseId",
        title,
        content,
        order_index AS "orderIndex"
      FROM course_modules
      WHERE course_id = $1 AND is_active = TRUE
      ORDER BY order_index ASC
    `, [courseId]);

    return { course: course.rows[0], modules: rows };
  });
};
