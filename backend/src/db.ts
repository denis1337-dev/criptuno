import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl
});

export const migrate = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT NOT NULL,
      avatar_stage TEXT NOT NULL DEFAULT 'stage1',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS game_results (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      score INT NOT NULL CHECK (score >= 0),
      idempotency_key TEXT,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, game_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_score INT NOT NULL DEFAULT 0,
      completed_games INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS quiz_tests (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      order_index INT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id SERIAL PRIMARY KEY,
      test_id INT NOT NULL REFERENCES quiz_tests(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_index INT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
      order_index INT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS puzzle_levels (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      image_url TEXT NOT NULL,
      order_index INT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS puzzle_collected (
      id SERIAL PRIMARY KEY,
      session_key TEXT NOT NULL,
      level_id INT NOT NULL REFERENCES puzzle_levels(id) ON DELETE CASCADE,
      level_title TEXT NOT NULL,
      image_url TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_key, level_id)
    );
  `);

  await pool.query(`DELETE FROM quiz_questions`);
  await pool.query(`DELETE FROM quiz_tests`);
  await pool.query(`DELETE FROM puzzle_levels`);

  await pool.query(`
    INSERT INTO games (slug, title, difficulty, is_active)
    VALUES
      ('memory-cards', 'Memory Cards', 'easy', TRUE),
      ('quick-math', 'Quick Math', 'medium', TRUE)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO quiz_tests (title, order_index, is_active)
    VALUES
      ('Тест: Основы блокчейна', 1, TRUE),
      ('Тест: Криптовалюты', 2, TRUE),
      ('Тест: Криптография', 3, TRUE),
      ('Тест: Практика', 4, TRUE),
      ('Тест: DeFi и Tokenomics', 5, TRUE)
  `);

  await pool.query(`
    INSERT INTO puzzle_levels (title, image_url, order_index, is_active)
    VALUES
      ('Горы на рассвете', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80', 1, TRUE),
      ('Лесное озеро', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80', 2, TRUE),
      ('Ночное небо', 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=900&q=80', 3, TRUE)
  `);

  const quizTestResult = await pool.query<{ id: number; title: string }>(`
    SELECT id, title
    FROM quiz_tests
    WHERE is_active = TRUE
    ORDER BY order_index ASC
  `);

  for (const test of quizTestResult.rows) {
    if (test.title.includes("блокчейн")) {
      await pool.query(`
        INSERT INTO quiz_questions
          (test_id, question_text, option_a, option_b, option_c, option_d, correct_index, order_index)
        VALUES
          ($1, 'Что такое блокчейн?', 'Централизованная база данных', 'Децентрализованный распределённый реестр', 'Облачное хранилище', 'Локальный файл', 1, 1),
          ($1, 'Что делает блокчейн устойчивым к цензуре?', 'Централизованный сервер', 'Распределённая сеть узлов', 'Единый администратор', 'Облако', 1, 2),
          ($1, 'Что такое консенсус в блокчейне?', 'Соглашение большинства узлов о состоянии сети', 'Центральный орган управления', 'Один узел решает все', 'Банковский перевод', 0, 3)
      `, [test.id]);
    } else if (test.title.includes("Криптовалюты")) {
      await pool.query(`
        INSERT INTO quiz_questions
          (test_id, question_text, option_a, option_b, option_c, option_d, correct_index, order_index)
        VALUES
          ($1, 'Кто создал Bitcoin?', 'Виталик Бутерин', 'Сатоши Накамото', 'Чарли Ли', 'Гэвин Андресен', 1, 1),
          ($1, 'Что такое кошелёк для криптовалюты?', 'Место хранения монет', 'Программа для хранения ключей', 'Банковский счёт', 'Веб-сайт', 1, 2),
          ($1, 'В чём разница между публичным и приватным ключом?', 'Публичный — для отправки, приватный — для получения', 'Приватный — публичный, публичный — приватный', 'Они одинаковые', 'Нет разницы', 0, 3)
      `, [test.id]);
    } else if (test.title.includes("Криптография")) {
      await pool.query(`
        INSERT INTO quiz_questions
          (test_id, question_text, option_a, option_b, option_c, option_d, correct_index, order_index)
        VALUES
          ($1, 'Что такое хэширование?', 'Шифрование данных', 'Преобразование данных в фиксированную строку', 'Сжатие файлов', 'Удаление данных', 1, 1),
          ($1, 'Какой алгоритм использует Bitcoin?', 'SHA-256', 'MD5', 'AES', 'RSA', 0, 2),
          ($1, 'Что такое цифровая подпись?', 'Рукописная подпись в PDF', 'Криптографическое подтверждение владения приватным ключом', 'Электронная почта', 'Фотография', 1, 3)
      `, [test.id]);
    } else if (test.title.includes("Практика")) {
      await pool.query(`
        INSERT INTO quiz_questions
          (test_id, question_text, option_a, option_b, option_c, option_d, correct_index, order_index)
        VALUES
          ($1, 'Что такое тестовая сеть (testnet)?', 'Основная сеть Bitcoin', 'Сеть для безопасного тестирования без реальных денег', 'Сеть для майнинга', 'Приватная сеть банка', 1, 1),
          ($1, 'Как создать кошелёк?', 'Запомнить seed-фразу и хранить в безопасности', 'Забыть приватный ключ', 'Использовать чужой компьютер', 'Не делать резервную копию', 0, 2),
          ($1, 'Что такое seed-фраза?', 'Пароль от email', 'Набор из 12-24 слов для восстановления кошелька', 'Номер банковской карты', 'Имя пользователя', 1, 3)
      `, [test.id]);
    } else if (test.title.includes("DeFi")) {
      await pool.query(`
        INSERT INTO quiz_questions
          (test_id, question_text, option_a, option_b, option_c, option_d, correct_index, order_index)
        VALUES
          ($1, 'Что такое механизм консенсуса?', 'Способ добычи токенов', 'Соглашение о состоянии сети между узлами', 'Тип транзакции', 'Способ хранения данных', 1, 1),
          ($1, 'Чем PoS отличается от PoW?', 'Быстрее скорость блока', 'Не требует вычислительной мощности', 'Более децентрализован', 'Все перечисленное', 3, 2),
          ($1, 'Что такое смарт-контракт?', 'Умная сделка с банком', 'Программа в блокчейне', 'Криптовалютный кошелёк', 'Тип токена', 1, 3)
      `, [test.id]);
    }
  }
};
