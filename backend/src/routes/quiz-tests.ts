import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";

export const quizTestsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/quiz-tests", async () => {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          title,
          order_index AS "orderIndex"
        FROM quiz_tests
        WHERE is_active = TRUE
        ORDER BY order_index ASC, id ASC
      `
    );
    return rows;
  });

  app.get("/quiz-tests/:id/questions", async (request, reply) => {
    const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ message: "Invalid test id" });
    }

    const testId = params.data.id;
    const test = await pool.query<{ id: number }>(
      `SELECT id FROM quiz_tests WHERE id = $1 AND is_active = TRUE`,
      [testId]
    );
    if (!test.rows[0]) {
      return reply.status(404).send({ message: "Test not found" });
    }

    const { rows } = await pool.query(
      `
        SELECT
          id,
          question_text AS "questionText",
          ARRAY[option_a, option_b, option_c, option_d] AS options,
          correct_index AS "correctIndex",
          order_index AS "orderIndex"
        FROM quiz_questions
        WHERE test_id = $1
        ORDER BY order_index ASC, id ASC
      `,
      [testId]
    );
    return rows;
  });
};
