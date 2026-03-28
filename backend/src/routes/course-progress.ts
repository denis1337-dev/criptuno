import { FastifyInstance } from "fastify";
import { pool } from "../db.js";

export const courseProgressRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/courses/:id/progress", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;
    
    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const { rows: progress } = await pool.query(
      `SELECT * FROM user_course_progress WHERE user_id = $1 AND course_id = $2`,
      [userId, id]
    );

    if (progress.length === 0) {
      return { completedModules: 0, totalModules: 0, isCompleted: false };
    }

    return {
      completedModules: progress[0].completed_modules,
      totalModules: progress[0].total_modules,
      isCompleted: progress[0].is_completed
    };
  });

  app.post("/courses/:courseId/modules/:moduleId/complete", async (request, reply) => {
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
    const userId = request.user?.userId;
    
    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    await pool.query(
      `INSERT INTO user_module_progress (user_id, module_id, is_completed, completed_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (user_id, module_id) DO UPDATE SET is_completed = TRUE, completed_at = NOW()`,
      [userId, moduleId]
    );

    const { rows: moduleCount } = await pool.query(
      `SELECT COUNT(*) as total FROM course_modules WHERE course_id = $1 AND is_active = TRUE`,
      [courseId]
    );

    const { rows: completedCount } = await pool.query(
      `SELECT COUNT(*) as completed FROM user_module_progress ump
       JOIN course_modules cm ON cm.id = ump.module_id
       WHERE ump.user_id = $1 AND cm.course_id = $2 AND ump.is_completed = TRUE`,
      [userId, courseId]
    );

    const totalModules = parseInt(moduleCount[0].total);
    const completedModules = parseInt(completedCount[0].completed);
    const isCompleted = completedModules >= totalModules;

    await pool.query(
      `INSERT INTO user_course_progress (user_id, course_id, completed_modules, total_modules, is_completed, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (user_id, course_id) DO UPDATE SET 
         completed_modules = $3, 
         total_modules = $4, 
         is_completed = $5,
         completed_at = $6`,
      [userId, courseId, completedModules, totalModules, isCompleted, isCompleted ? 'NOW()' : null]
    );

    return { completedModules, totalModules, isCompleted };
  });

  app.get("/courses/:id/modules/:moduleId/progress", async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const userId = request.user?.userId;
    
    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const { rows } = await pool.query(
      `SELECT is_completed FROM user_module_progress WHERE user_id = $1 AND module_id = $2`,
      [userId, moduleId]
    );

    return { isCompleted: rows.length > 0 && rows[0].is_completed };
  });
};
