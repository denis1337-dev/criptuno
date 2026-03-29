import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { coursesRoutes } from "./routes/courses.js";
import { gamesRoutes } from "./routes/games.js";
import { profileRoutes } from "./routes/profile.js";
import { puzzleRoutes } from "./routes/puzzle.js";
import { quizTestsRoutes } from "./routes/quiz-tests.js";
 
 declare module "fastify" {
   interface FastifyRequest {
     user: { userId: number; telegramId: number };
   }
 }
 
 export const buildApp = () => {
   const app = Fastify({ logger: true });
 
   app.register(cors, { 
     origin: true,
     credentials: true
   });
   app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
   app.register(jwt, { secret: config.jwtSecret });
 
   app.decorate("authenticate", async (request, reply) => {
     try {
       await request.jwtVerify();
     } catch {
       await reply.status(401).send({ message: "Unauthorized" });
     }
   });
 
    app.get("/health", async () => ({ ok: true }));
    app.register(authRoutes);
    app.register(coursesRoutes);
    app.register(gamesRoutes);
    app.register(quizTestsRoutes);
    app.register(puzzleRoutes);
    app.register(profileRoutes);

  return app;
};
