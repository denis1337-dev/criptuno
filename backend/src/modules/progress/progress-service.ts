import { PoolClient } from "pg";
import { resolveAvatarStage } from "../avatar/avatar-rules-engine.js";

export const recalculateProgress = async (client: PoolClient, userId: number): Promise<void> => {
  const stats = await client.query<{ total_score: number; completed_games: number }>(
    `
      SELECT
        COALESCE(SUM(score), 0)::INT AS total_score,
        COUNT(*)::INT AS completed_games
      FROM game_results
      WHERE user_id = $1
    `,
    [userId]
  );

  const totalScore = stats.rows[0]?.total_score ?? 0;
  const completedGames = stats.rows[0]?.completed_games ?? 0;
  const avatarStage = resolveAvatarStage(totalScore);

  await client.query(
    `
      INSERT INTO user_progress (user_id, total_score, completed_games, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        total_score = EXCLUDED.total_score,
        completed_games = EXCLUDED.completed_games,
        updated_at = NOW()
    `,
    [userId, totalScore, completedGames]
  );

  await client.query(`UPDATE users SET avatar_stage = $2 WHERE id = $1`, [userId, avatarStage]);
};
