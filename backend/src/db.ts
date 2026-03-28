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

    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      order_index INT NOT NULL,
      url TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_premium BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS course_modules (
      id SERIAL PRIMARY KEY,
      course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_index INT NOT NULL,
      content TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
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
      course_id INT REFERENCES courses(id) ON DELETE SET NULL,
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

    CREATE TABLE IF NOT EXISTS user_course_progress (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      completed_modules INT NOT NULL DEFAULT 0,
      total_modules INT NOT NULL DEFAULT 0,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      UNIQUE (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS user_module_progress (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id INT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, module_id)
    );
  `);

  await pool.query(`DELETE FROM course_modules`);
  console.log('Deleted old course_modules');
  await pool.query(`DELETE FROM courses`);
  console.log('Deleted old courses');
  await pool.query(`DELETE FROM quiz_questions`);
  await pool.query(`DELETE FROM quiz_tests`);
  await pool.query(`DELETE FROM puzzle_levels`);

  await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE`);

  await pool.query(`
    INSERT INTO courses (title, order_index, url, is_active, is_premium)
    VALUES
      ('Что такое блокчейн', 1, 'https://example.com/blockchain-basics', TRUE, FALSE),
      ('Криптовалюты: Bitcoin и Ethereum', 2, 'https://example.com/crypto-basics', TRUE, FALSE),
      ('Основы криптографии', 3, 'https://example.com/cryptography', TRUE, FALSE),
      ('Практика: Кошельки и транзакции', 4, 'https://example.com/wallets-practice', TRUE, FALSE),
      ('⚖️ Консенсус: PoW, PoS и альтернативы', 5, 'https://example.com/consensus', TRUE, TRUE),
      ('📜 Смарт-контракты и Solidity', 6, 'https://example.com/smart-contracts', TRUE, TRUE),
      ('💎 DeFi и NFT', 7, 'https://example.com/defi-nft', TRUE, TRUE),
      ('🪙 Tokenomics', 8, 'https://example.com/tokenomics', TRUE, TRUE),
      ('🛠️ Практика: ERC-20 и Uniswap', 9, 'https://example.com/practice-erc20', TRUE, TRUE)
  `);

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

  await seedCourseModules();

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

async function seedCourseModules() {
  const courses = await pool.query(`SELECT id, title FROM courses ORDER BY order_index`);
  console.log('Seeding modules for courses:', courses.rows.map(c => c.title));
  
  const courseData = [
    {
      title: 'Что такое блокчейн',
      modules: [
        {
          title: '📜 История блокчейна',
          content: `<h2>История блокчейна</h2>
<p>Блокчейн был впервые описан в 1991 году учеными <strong>Стюартом Хабером и У. Скоттом Шторнеттом</strong>, но настоящая революция произошла в 2008 году, когда <strong>Сатоши Накамото</strong> представил Bitcoin — первую децентрализованную криптовалюту.</p>

<h3>Ключевые даты:</h3>
<ul>
<li><strong>1991</strong> — Концепция цепочки блоков</li>
<li><strong>2008</strong> — White Paper Bitcoin</li>
<li><strong>2009</strong> — Запуск сети Bitcoin</li>
<li><strong>2015</strong> — Ethereum с умными контрактами</li>
</ul>

<h3>Зачем это нужно?</h3>
<p>До появления блокчейна все финансовые системы работали через <strong>централизованных посредников</strong>: банки, платёжные системы. Блокчейн позволяет совершать транзакции <strong>напрямую</strong>, без посредников.</p>

<blockquote>💡 Блокчейн — это как цифровой дневник, который нельзя подделать и который хранится одновременно у миллионов людей!</blockquote>`
        },
        {
          title: '🏛️ Децентрализация',
          content: `<h2>Что такое децентрализация?</h2>
<p><strong>Децентрализация</strong> — это когда нет одного главного. Вместо одного сервера/банка данные хранятся на тысячах компьютеров по всему миру.</p>

<h3>Преимущества децентрализации:</h3>
<ol>
<li><strong>Устойчивость</strong> — сеть нельзя выключить</li>
<li><strong>Прозрачность</strong> — все транзакции публичны</li>
<li><strong>Невозможность подделки</strong> — изменение данных практически невозможно</li>
</ol>`
        },
        {
          title: '🏦 Блокчейн vs Банки',
          content: `<h2>Блокчейн и традиционные финансы</h2>
<p>Давайте сравним, как работают переводы в банке и в блокчейне:</p>

<h3>Банковский перевод:</h3>
<p>⏱️ <strong>Время:</strong> 1-5 рабочих дней<br>
💰 <strong>Комиссия:</strong> 1-5% + фиксированная</p>

<h3>Перевод в блокчейне:</h3>
<p>⏱️ <strong>Время:</strong> 10 минут — 15 минут<br>
💰 <strong>Комиссия:</strong> $0.5 — $50 (зависит от загрузки сети)</p>`
        }
      ]
    },
    {
      title: 'Криптовалюты: Bitcoin и Ethereum',
      modules: [
        {
          title: '₿ Bitcoin — цифровое золото',
          content: `<h2>Bitcoin (BTC)</h2>
<p><strong>Bitcoin</strong> — первая и самая известная криптовалюта, созданная в 2009 году загадочным Сатоши Накамото.</p>

<h3>Основные характеристики:</h3>
<ul>
<li><strong>Максимальное предложение:</strong> 21,000,000 BTC</li>
<li><strong>Время блока:</strong> ~10 минут</li>
<li><strong>Алгоритм:</strong> SHA-256</li>
</ul>`
        },
        {
          title: '♦️ Ethereum — компьютер будущего',
          content: `<h2>Ethereum (ETH)</h2>
<p><strong>Ethereum</strong> — вторая по капитализации криптовалюта, созданная Виталиком Бутериным в 2015 году.</p>

<h3>Отличия от Bitcoin:</h3>
<ul>
<li>Поддержка смарт-контрактов</li>
<li>Быстрее транзакции (12-15 секунд)</li>
<li>EVM — Ethereum Virtual Machine</li>
</ul>`
        },
        {
          title: '💰 Как хранить криптовалюту',
          content: `<h2>Криптовалютные кошельки</h2>
<p>Для хранения криптовалюты используются кошельки. Они бывают:</p>

<h3>Типы кошельков:</h3>
<ul>
<li><strong>Hot wallets</strong> — онлайн, подключены к интернету</li>
<li><strong>Cold wallets</strong> — аппаратные, офлайн хранение</li>
<li><strong>Paper wallets</strong> — бумажные, приватные ключи на бумаге</li>
</ul>`
        }
      ]
    }
  ];

  for (const course of courses.rows) {
    console.log('Processing course:', course.title, 'id:', course.id);
    
    // Find matching course data by checking if title contains first word
    const firstWord = course.title.split(' ')[0];
    const courseDataItem = courseData.find(c => course.title.includes(c.title.split(' ')[0]));
    
    if (!courseDataItem) {
      console.log('No modules found for course:', course.title);
      // Add default modules
      await pool.query(
        `INSERT INTO course_modules (course_id, title, content, order_index) VALUES ($1, $2, $3, $4)`,
        [course.id, '📖 Модуль 1', '<h2>Добро пожаловать!</h2><p>Контент этого модуля скоро появится.</p>', 1]
      );
      await pool.query(
        `INSERT INTO course_modules (course_id, title, content, order_index) VALUES ($1, $2, $3, $4)`,
        [course.id, '📖 Модуль 2', '<h2>Продолжение следует...</h2><p>Контент этого модуля скоро появится.</p>', 2]
      );
      await pool.query(
        `INSERT INTO course_modules (course_id, title, content, order_index) VALUES ($1, $2, $3, $4)`,
        [course.id, '📖 Модуль 3', '<h2>Финал!</h2><p>Контент этого модуля скоро появится.</p>', 3]
      );
      console.log('Added default modules to course:', course.title);
      continue;
    }

    for (let i = 0; i < courseDataItem.modules.length; i++) {
      const mod = courseDataItem.modules[i];
      await pool.query(
        `INSERT INTO course_modules (course_id, title, content, order_index) VALUES ($1, $2, $3, $4)`,
        [course.id, mod.title, mod.content, i + 1]
      );
      console.log('Added module:', mod.title, 'to course', course.title);
    }
  }
  
  console.log('Course modules seeding complete!');
}
    {
      title: 'Что такое блокчейн',
      modules: [
        {
          title: '📜 История блокчейна',
          content: `<h2>История блокчейна</h2>
<p>Блокчейн был впервые описан в 1991 году учеными <strong>Стюартом Хабером и У. Скоттом Шторнеттом</strong>, но настоящая революция произошла в 2008 году, когда <strong>Сатоши Накамото</strong> представил Bitcoin — первую децентрализованную криптовалюту.</p>

<h3>Ключевые даты:</h3>
<ul>
<li><strong>1991</strong> — Концепция цепочки блоков</li>
<li><strong>2008</strong> — White Paper Bitcoin</li>
<li><strong>2009</strong> — Запуск сети Bitcoin</li>
<li><strong>2015</strong> — Ethereum с умными контрактами</li>
</ul>

<h3>Зачем это нужно?</h3>
<p>До появления блокчейна все финансовые системы работали через <strong>централизованных посредников</strong>: банки, платёжные системы. Блокчейн позволяет совершать транзакции <strong>напрямую</strong>, без посредников.</p>

<blockquote>💡 Блокчейн — это как цифровой дневник, который нельзя подделать и который хранится одновременно у миллионов людей!</blockquote>`
        },
        {
          title: '🏛️ Децентрализация',
          content: `<h2>Что такое децентрализация?</h2>
<p><strong>Децентрализация</strong> — это когда нет одного главного. Вместо одного сервера/банка данные хранятся на тысячах компьютеров по всему миру.</p>

<h3>Централизованная vs Децентрализованная система</h3>

<p><strong>Централизованная (банк):</strong></p>
<ul>
<li>Есть главный сервер ❌</li>
<li>Если он упадёт — всё сломается</li>
<li>Один орган контролирует всё</li>
<li>Можно заблокировать доступ</li>
</ul>

<p><strong>Децентрализованная (блокчейн):</strong></p>
<ul>
<li>Нет главного сервера ✓</li>
<li>Сеть работает, пока есть хотя бы один узел</li>
<li>Никто не может в одностороннем порядке изменить правила</li>
<li>Устойчива к цензуре</li>
</ul>

<h3>Преимущества децентрализации:</h3>
<ol>
<li><strong>Устойчивость</strong> — сеть нельзя выключить</li>
<li><strong>Прозрачность</strong> — все транзакции публичны</li>
<li><strong>Невозможность подделки</strong> — изменение данных практически невозможно</li>
</ol>`
        },
        {
          title: '🏦 Блокчейн vs Банки',
          content: `<h2>Блокчейн и традиционные финансы</h2>
<p>Давайте сравним, как работают переводы в банке и в блокчейне:</p>

<h3>Банковский перевод:</h3>
<pre>
Вы → Банк A → SWIFT/корреспондент → Банк B → Получатель
</pre>
<p>⏱️ <strong>Время:</strong> 1-5 рабочих дней<br>
💰 <strong>Комиссия:</strong> 1-5% + фиксированная<br>
📋 <strong>Документы:</strong> Паспорт, счёт, назначение</p>

<h3>Перевод в блокчейне:</h3>
<pre>
Вы (приватный ключ) → Сеть Bitcoin/Ethereum → Получатель (публичный адрес)
</pre>
<p>⏱️ <strong>Время:</strong> 10 минут — 15 минут<br>
💰 <strong>Комиссия:</strong> $0.5 — $50 (зависит от загрузки сети)<br>
📋 <strong>Документы:</strong> Только ваш кошелёк</p>

<h3>Ключевые отличия:</h3>
<table>
<tr><td></td><td>Банк</td><td>Блокчейн</td></tr>
<tr><td>Регуляция</td><td>ЦБ страны</td><td>Код протокола</td></tr>
<tr><td>Отмена транзакции</td><td>Возможна</td><td>Невозможна</td></tr>
<tr><td>Анонимность</td><td>Минимальная</td><td>Псевдонимность</td></tr>
<tr><td>Доступ 24/7</td><td>Нет</td><td>Да</td></tr>
</table>`
        }
      ]
    },
    {
      title: 'Криптовалюты: Bitcoin и Ethereum',
      modules: [
        {
          title: '₿ Bitcoin — цифровое золото',
          content: `<h2>Bitcoin (BTC)</h2>
<p><strong>Bitcoin</strong> — первая и самая известная криптовалюта, созданная в 2009 году загадочным Сатоши Накамото.</p>

<h3>Основные характеристики:</h3>
<ul>
<li><strong>Максимальное предложение:</strong> 21,000,000 BTC</li>
<li><strong>Время блока:</strong> ~10 минут</li>
<li><strong>Алгоритм:</strong> SHA-256</li>
<li><strong>Награда за блок:</strong> 6.25 BTC (2024)</li>
</ul>

<h3>Почему Bitcoin называют "цифровым золотом"?</h3>
<ol>
<li><strong>Дефицитность</strong> — всего 21 миллион монет, как золота на Земле</li>
<li><strong>Долговечность</strong> — работает 15+ лет без единой остановки</li>
<li><strong>Делимость</strong> — можно делить до 8 знаков после запятой (0.00000001 BTC = 1 сатоши)</li>
<li><strong>Portability</strong> — можно перевести в любую точку мира за минуты</li>
</ol>

<h3>Как работает транзакция:</h3>
<pre>
1. Вы создаёте транзакцию
2. Подписываете её своим приватным ключом
3. Отправляете в сеть
4. Майнеры включают её в блок
5. Блок добавляется в цепочку
6. Получатель видит средства
</pre>`
        },
        {
          title: 'Ξ Ethereum — компьютер будущего',
          content: `<h2>Ethereum (ETH)</h2>
<p><strong>Ethereum</strong> — это не просто валюта, а целая <strong>платформа для создания приложений</strong>. Создан <strong>Виталиком Бутериным</strong> в 2015 году.</p>

<h3>Что делает Ethereum особенным?</h3>

<p><strong>Умные контракты (Smart Contracts)</strong></p>
<p>Это программы, которые автоматически исполняются при выполнении условий. Никаких посредников!</p>

<pre>
Пример: ICO (сбор средств)
Если достигнута цель → автоматически отправляю токены инвесторам
Если цель НЕ достигнута → автоматически возвращаю средства
</pre>

<h3>Сравнение Bitcoin и Ethereum:</h3>
<table>
<tr><td></td><td>Bitcoin</td><td>Ethereum</td></tr>
<tr><td>Цель</td><td>Цифровые деньги</td><td>Децентрализованный компьютер</td></tr>
<tr><td>Токены</td><td>Только BTC</td><td>Тысячи токенов (ERC-20)</td></tr>
<tr><td>Комиссия</td><td>Низкая</td><td>Gas (динамическая)</td></tr>
<tr><td>Скорость</td><td>~7 TPS</td><td>~15-30 TPS</td></tr>
</table>

<h3>Примеры dApps на Ethereum:</h3>
<ul>
<li><strong>DeFi</strong> — децентрализованные финансы (Aave, Uniswap)</li>
<li><strong>NFT</strong> — невзаимозаменяемые токены (OpenSea)</li>
<li><strong>DAO</strong> — децентрализованные организации</li>
</ul>`
        },
        {
          title: '👛 Кошельки и транзакции',
          content: `<h2>Как работают кошельки</h2>
<p><strong>Криптовалютный кошелёк</strong> — это не "место хранения денег", а инструмент для <strong>управления ключами</strong>.</p>

<h3>Типы кошельков:</h3>

<p><strong>🥶 Горячие кошельки (Hot Wallets)</strong></p>
<ul>
<li>Подключены к интернету</li>
<li>Удобны для ежедневных операций</li>
<li>Примеры: MetaMask, Trust Wallet, Exodus</li>
</ul>

<p><strong>❄️ Холодные кошельки (Cold Wallets)</strong></p>
<ul>
<li>Не подключены к интернету</li>
<li>Максимальная безопасность</li>
<li>Примеры: Ledger, Trezor, бумажные кошельки</li>
</ul>

<h3>Структура транзакции:</h3>
<pre>
{
  "from": "0x742d35Cc6634C0532...",
  "to": "0x8B3f5dA24Bc8F7f5...",
  "value": "0.05 ETH",
  "gas": "21000",
  "nonce": 42,
  "signature": "0x7d3a8f7..."
}
</pre>

<h3>Что такое nonce?</h3>
<p><strong>Nonce</strong> — порядковый номер транзакции от кошелька. Защита от <strong>double spending</strong> (двойной траты).</p>

<blockquote>⚠️ Никогда не делись приватным ключом или seed-фразой! С их помощью можно украсть все средства.</blockquote>`
        }
      ]
    },
    {
      title: 'Основы криптографии',
      modules: [
        {
          title: '#️⃣ Хэширование',
          content: `<h2>Что такое хэширование?</h2>
<p><strong>Хэширование</strong> — это преобразование данных любого размера в фиксированную строку фиксированной длины.</p>

<h3>Свойства хэш-функций:</h3>
<ol>
<li><strong>Детерминированность</strong> — одни данные всегда дают один хэш</li>
<li><strong>Быстрое вычисление</strong> — хэш считается мгновенно</li>
<li><strong>Необратимость</strong> — по хэшу нельзя восстановить данные</li>
<li><strong>Уникальность</strong> — разные данные дают разные хэши</li>
</ol>

<h3>Пример хэширования:</h3>
<pre>
Вход: "Hello, Blockchain!"
SHA-256: 4d3d5e1f9f3c7a8b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9

Вход: "hello, blockchain!"
SHA-256: a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e
</pre>

<p>Обратите внимание: <strong>одна буква изменилась</strong>, и хэш <strong>полностью другой</strong>!</p>

<h3>Применение в блокчейне:</h3>
<ul>
<li><strong>Linking blocks</strong> — каждый блок содержит хэш предыдущего</li>
<li><strong>Merkle Tree</strong> — эффективное хранение транзакций</li>
<li><strong>Proof of Work</strong> — поиск хэша с определёнными свойствами</li>
</ul>`
        },
        {
          title: '🔐 Публичные и приватные ключи',
          content: `<h2>Асимметричная криптография</h2>
<p>В блокчейне используется <strong>асимметричная криптография</strong> — пара связанных ключей: публичный и приватный.</p>

<h3>Принцип работы:</h3>

<p><strong>Приватный ключ (Private Key)</strong></p>
<ul>
<li>Секретный, никому не показываем</li>
<li>64 символа (256 бит)</li>
<li>Пример: <code>0x742d35Cc6634C053292051aef8485445...</code></li>
</ul>

<p><strong>Публичный ключ (Public Key)</strong></p>
<ul>
<li>Можно делиться свободно</li>
<li>Вычисляется из приватного ключа</li>
<li>Пример: <code>0x742d35Cc6634C053292051aef8485445...</code></li>
</ul>

<p><strong>Адрес (Address)</strong></p>
<ul>
<li>Производная от публичного ключа</li>
<li>Используется для получения средств</li>
<li>Пример: <code>0x742d35Cc6634C0532...</code></li>
</ul>

<h3>Как это работает:</h3>
<pre>
Приватный ключ → Публичный ключ → Адрес
        ↓
  Невозможно
  вычислить
  обратно
</pre>

<h3>Подпись транзакции:</h3>
<pre>
1. Берём данные транзакции
2. Хэшируем
3. Шифруем приватным ключом = ПОДПИСЬ
4. Проверяем публичным ключом = ВЕРНО/НЕВЕРНО
</pre>

<blockquote>🔐 Кто знает приватный ключ — тот владеет средствами. Это абсолютная истина в криптовалютах.</blockquote>`
        },
        {
          title: '✅ Цифровые подписи',
          content: `<h2>Цифровые подписи в блокчейне</h2>
<p><strong>Цифровая подпись</strong> — это математическая схема для подтверждения подлинности сообщения или документа.</p>

<h3>Как создаётся подпись:</h3>
<pre>
1. Транзакция: "Отправить 1 BTC на адрес X"
                   ↓
2. Создаём хэш транзакции
   Hash: "a591a6d40bf420404a..."
                   ↓
3. Шифруем приватным ключом (ECDSA)
   Signature: "0x7d3a8f7b9c..."
                   ↓
4. Отправляем: [Транзакция + Подпись]
</pre>

<h3>Как проверяется подпись:</h3>
<pre>
1. Получаем: [Транзакция + Подпись + Публичный ключ]
                    ↓
2. Расшифровываем подпись публичным ключом
   Получаем: "a591a6d40bf420404a..."
                    ↓
3. Хэшируем полученную транзакцию
   Хэш: "a591a6d40bf420404a..."
                    ↓
4. Сравниваем:
   ✓ Совпало = Подпись верна ✓
   ✗ Не совпало = Подпись неверна ✗
</pre>

<h3>Гарантии:</h3>
<ul>
<li><strong>Аутентичность</strong> — подпись мог создать только владелец приватного ключа</li>
<li><strong>Целостность</strong> — любое изменение данных аннулирует подпись</li>
<li><strong>Неотрицаемость</strong> — нельзя отрицать создание подписи</li>
</ul>

<h3>Алгоритмы:</h3>
<table>
<tr><td>Bitcoin</td><td>ECDSA (secp256k1)</td></tr>
<tr><td>Ethereum</td><td>ECDSA (secp256k1)</td></tr>
<tr><td>Будущее</td><td>Post-quantum (Lattice)</td></tr>
</table>`
        }
      ]
    },
    {
      title: 'Практика: Кошельки и транзакции',
      modules: [
        {
          title: '📦 Установка кошелька MetaMask',
          content: `<h2>MetaMask — самый популярный криптокошелёк</h2>
<p><strong>MetaMask</strong> — это браузерное расширение и мобильное приложение для работы с Ethereum и другими EVM-совместимыми сетями.</p>

<h3>Установка (Chrome/Brave):</h3>
<ol>
<li>Перейдите на <a href="https://metamask.io" target="_blank">metamask.io</a></li>
<li>Нажмите "Download"</li>
<li>Установите расширение для браузера</li>
<li>Нажмите "Create a new wallet"</li>
</ol>

<h3>Создание кошелька:</h3>
<pre>
Шаг 1: Создание пароля
        └─ Минимум 8 символов
        └─ Этот пароль ЗАШИФРОВЫВАЕТ приватный ключ локально

Шаг 2: Seed-фраза (КРИТИЧЕСКИ ВАЖНО!)
        └─ 12 или 24 слова
        └─ Это ВАШ приватный ключ в читаемом виде
        └─ НИКОМУ не показывайте!
        └─ Сохраните в 3+ местах (бумага, менеджер паролей)
        
Шаг 3: Подтверждение
        └─ Введите слова в правильном порядке
        └─ Подтверждаем, что вы поняли важность
</pre>

<h3>Структура меню MetaMask:</h3>
<ul>
<li><strong>Account</strong> — ваш адрес и баланс</li>
<li><strong>Send</strong> — отправка токенов</li>
<li><strong>Swap</strong> — обмен токенов</li>
<li><strong>Buy</strong> — покупка за фиат</li>
<li><strong>Activity</strong> — история транзакций</li>
</ul>

<blockquote>⚠️ MetaMask хранит ключи локально. Если удалите расширение без seed — доступ потеряете навсегда!</blockquote>`
        },
        {
          title: '💸 Первая тестовая транзакция',
          content: `<h2>Тестовая сеть (Testnet)</h2>
<p>Прежде чем работать с реальными деньгами, используйте <strong>тестовую сеть (testnet)</strong>. Это точная копия основной сети, но с бесплатными токенами.</p>

<h3>Тестовые сети Ethereum:</h3>
<table>
<tr><td>Сеть</td><td>Особенность</td><td>Кран (Faucet)</td></tr>
<tr><td>Sepolia</td><td>Актуальная, рекомендуемая</td><td>faucet.sepolia.dev</td></tr>
<tr><td>Goerli</td><td>Старая, но популярная</td><td>goerli-faucet.slock.it</td></tr>
<tr><td>Localhost</td><td>Для разработчиков</td><td>—</td></tr>
</table>

<h3>Как получить тестовые ETH:</h3>
<pre>
1. Откройте MetaMask
2. Переключитесь на сеть "Sepolia"
3. Нажмите "Buy" → "Get Test ETH"
4. Или перейдите на faucet.sepolia.dev
5. Вставьте адрес кошелька
6. Получите тестовые ETH
</pre>

<h3>Отправка тестовой транзакции:</h3>
<pre>
1. Нажмите "Send" в MetaMask
2. Вставьте адрес получателя
   (или выберите из контактов)
3. Укажите сумму: 0.01 ETH
4. Нажмите "Next"
5. Просмотрите комиссию (Gas)
6. Нажмите "Confirm"
7. Готово! Транзакция в пуле
8. Ждём ~15 секунд (или быстрее)
9. Статус: "Confirmed" ✓
</pre>

<h3>Что такое Gas?</h3>
<p><strong>Gas</strong> — комиссия за транзакцию в Ethereum. Состоит из:</p>
<ul>
<li><strong>Base fee</strong> — минимум (сжигается)</li>
<li><strong>Priority fee</strong> — чаевые майнеру/валидатору</li>
<li><strong>Gas Limit</strong> — максимальное потребление</li>
</ul>

<p>Формула: <code>Gas = (Base + Priority) × Gas Used</code></p>`
        },
        {
          title: '📊 Анализ транзакций',
          content: `<h2>Как читать транзакции в блокчейне</h2>
<p>Все транзакции публичны. Научимся их анализировать через <strong>block explorer</strong>.</p>

<h3>Популярные explorers:</h3>
<ul>
<li><strong>Ethereum:</strong> <a href="https://etherscan.io" target="_blank">etherscan.io</a></li>
<li><strong>Bitcoin:</strong> <a href="https://blockchair.com" target="_blank">blockchair.com</a></li>
<li><strong>BNB Chain:</strong> bscscan.com</li>
</ul>

<h3>Разбор транзакции в Etherscan:</h3>

<p><strong>Hash:</strong> <code>0x7d3a8f7b9c1d0e9f...</code></p>
<p>Уникальный идентификатор. По нему можно найти любую транзакцию.</p>

<p><strong>Status:</strong> ✓ Success / ✗ Fail</p>
<p>Успешная транзакция не всегда означает выполнение. Например, в DeFi может быть ошибка в контракте.</p>

<p><strong>From:</strong> <code>0x742d35Cc6634C0532...</code></p>
<p>Адрес отправителя (ваш кошелёк или другой)</p>

<p><strong>To:</strong> <code>0x8B3f5dA24Bc8F7f5...</code></p>
<p>Адрес получателя. Если это контракт — там будет код!</p>

<p><strong>Value:</strong> 0.5 ETH ($1,500)</p>
<p>Сумма перевода. Может быть 0 — тогда это вызов контракта.</p>

<p><strong>Gas Used:</strong> 21,000 / 21,000 (100%)</p>
<p>Сколько газа потрачено. Стандартный перевод = 21,000.</p>

<h3>Чтение данных контракта:</h3>
<pre>
Contract: 0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD
          (Uniswap V3: Router)

Method: swapExactETHForTokens
Input:
  amountOutMin: 1500000000
  path: [WETH → USDC → DAI]
  deadline: 1700000000
  recipient: 0x742d...6634
</pre>

<blockquote>🔍 Block explorer — это Google для блокчейна. Там можно найти всё!</blockquote>`
        }
      ]
    },
    {
      title: '⚖️ Консенсус: PoW, PoS и альтернативы',
      modules: [
        {
          title: '⛏️ Proof of Work (PoW)',
          content: `<h2>Proof of Work — доказательство работы</h2>
<p>PoW — первый и самый надёжный механизм консенсуса. Впервые использован в Bitcoin.</p>

<h3>Принцип работы</h3>
<p>Майнеры соревнуются в решении сложной математической задачи — <strong>нахождение хэша</strong> с определёнными свойствами.</p>
<pre>
Данные блока → SHA-256 → Hash
                            ↓
                      Nonce (меняется)
                            ↓
                      Hash是否符合条件？
                      
Нет → меняем Nonce → повторяем
Да → нашли! Добавляем блок
</pre>

<h3>Почему это работает?</h3>
<ul>
<li><strong>Сложность</strong> — решение требует огромных вычислений</li>
<li><strong>Дешевизна проверки</strong> — любой может быстро проверить хэш</li>
<li><strong>Экономическая безопасность</strong> — атака требует >50% хэшрейта</li>
</ul>

<h3>Bitcoin и SHA-256</h3>
<pre>
Хэш начинается с нужного количества нулей
Пример: 0000a7b8c9d2e3f4... (4 нуля)
Сложность пересчитывается каждые 2016 блоков (~2 недели)
</pre>

<h3>Преимущества PoW</h3>
<ul>
<li>🛡️ <strong>Максимальная безопасность</strong> — проверен 15+ годами</li>
<li>⚖️ <strong>Децентрализация</strong> — стимулы выравниваются</li>
<li>📜 <strong>Предсказуемость</strong> — эмиссия известна заранее</li>
</ul>

<h3>Недостатки PoW</h3>
<ul>
<li>⚡ <strong>Энергопотребление</strong> — сравнимо с энергией стран</li>
<li>🐢 <strong>Скорость</strong> — ~7 TPS (Bitcoin), ~15 TPS (Dogecoin)</li>
<li>💸 <strong>Комиссии</strong> — растут при высокой нагрузке</li>
</ul>

<blockquote>⚡ PoW — это "золотой стандарт" безопасности блокчейна. Bitcoin работает без единой остановки с 2009 года!</blockquote>`
        },
        {
          title: '💎 Proof of Stake (PoS)',
          content: `<h2>Proof of Stake — доказательство доли</h2>
<p>PoS заменяет вычислительную работу на экономическую долю. Вместо майнеров — валидаторы.</p>

<h3>Принцип работы</h3>
<p>Валидаторы <strong>замораживают (stake)</strong> свои токены и получают право создавать блоки пропорционально доле.</p>
<pre>
Валидаторы голосуют за блок
├── Validator A (10 ETH staked) → 10% шанс быть выбранным
├── Validator B (90 ETH staked) → 90% шанс быть выбранным
└── Если правильно → награда
    Если обманул → Slash (штраф)
</pre>

<h3>Ethereum 2.0 (The Merge)</h3>
<ul>
<li>🗓️ Сентябрь 2022 — переход с PoW на PoS</li>
<li>⚡ <strong>-99.95%</strong> потребления энергии</li>
<li>📊 14% APR для стейкеров (2024)</li>
<li>🔐 Минимальный стейк: 32 ETH</li>
</ul>

<h3>Slash — штрафы за нечестность</h3>
<pre>
Виды наказаний:
├── Proposing empty block → небольшой штраф
├── Double signing → Slash (32 ETH)
└── Attestation violations → постепенные штрафы
</pre>

<h3>Liquid Staking (жидкий стейкинг)</h3>
<p>Не хотите замораживать 32 ETH? Используйте <strong>Lido</strong> или <strong>Rocket Pool</strong>:</p>
<ul>
<li>🔄 Ставите любую сумму → получаете stETH/rETH</li>
<li>💰 stETH можно использовать в DeFi</li>
<li>📉 Недостаток: зависимость от протокола</li>
</ul>

<blockquote>💎 PoS — это эволюция консенсуса. Энергоэффективность + экономическая безопасность.</blockquote>`
        },
        {
          title: '🚀 Solana, Polygon и альтернативы',
          content: `<h2>Сравнение быстрых сетей</h2>
<p>Solana и Polygon — популярные альтернативы Ethereum с высокой скоростью.</p>

<h3>Solana</h3>
<p><strong>Уникальный подход:</strong> Proof of History (PoH) + PoS</p>
<pre>
PoH = "часы" сети — упорядочивает события
PoS = выбор валидаторов

Преимущества:
├── TPS: до 65,000
├── Комиссия: ~$0.00025
└── Архитектура: Sealevel (параллельные смарт-контракты)

Проблемы:
├── ❌ centraisция — мало валидаторов
├── ❌ Downtime — сеть падала несколько раз
└── ❌ Censorship — фильтрация транзакций
</pre>

<h3>Polygon (PoS)</h3>
<p><strong>Сайдчейн Ethereum</strong> — совместим с EVM, быстрый и дешёвый.</p>
<pre>
TPS: до 7,000
Комиссия: ~$0.001-0.01
Блокировка/разблокировка с ETH: ~7 дней
</pre>

<h3>Polygon zkEVM</h3>
<p><strong>Zero-Knowledge rollup</strong> — приватность + масштабирование:</p>
<ul>
<li>🛡️ Криптографическая гарантия валидности</li>
<li>📦 БATCH транзакций в одно доказательство</li>
<li>⚡ Быстрее чем optimistic rollups</li>
</ul>

<h3>Сравнительная таблица</h3>
<table>
<tr><td>Сеть</td><td>TPS</td><td>Комиссия</td><td>Тип</td></tr>
<tr><td>Ethereum</td><td>~30</td><td>$1-50</td><td>Layer 1</td></tr>
<tr><td>Arbitrum</td><td>~4,500</td><td>$0.1-1</td><td>L2 Rollup</td></tr>
<tr><td>Optimism</td><td>~2,000</td><td>$0.1-1</td><td>L2 Rollup</td></tr>
<tr><td>Solana</td><td>65,000</td><td>$0.00025</td><td>L1</td></tr>
<tr><td>Polygon</td><td>7,000</td><td>$0.001</td><td>Sidechain</td></tr>
<tr><td>Avalanche</td><td>4,500</td><td>$0.025</td><td>L1</td></tr>
<tr><td>BNB Chain</td><td>3,000</td><td>$0.2</td><td>L1</td></tr>
</table>

<blockquote>🚀 Выбор сети зависит от задачи: безопасность (Ethereum), скорость (Solana), или компромисс (Polygon).</blockquote>`
        }
      ]
    },
    {
      title: '📜 Смарт-контракты и Solidity',
      modules: [
        {
          title: '📜 Основы Solidity',
          content: `<h2>Введение в Solidity</h2>
<p>Solidity — язык программирования для создания смарт-контрактов на Ethereum и EVM-сетях.</p>

<h3>Первая программа</h3>
<pre>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public greeting;
    
    constructor(string memory _greeting) {
        greeting = _greeting;
    }
    
    function setGreeting(string memory _new) public {
        greeting = _new;
    }
    
    function getGreeting() public view returns (string memory) {
        return greeting;
    }
}
</pre>

<h3>Обязательные элементы</h3>
<ul>
<li><code>SPDX-License-Identifier</code> — указывает лицензию</li>
<li><code>pragma solidity ^0.8.0</code> — версия компилятора</li>
<li><code>contract Name { }</code> — объявление контракта</li>
</ul>

<h3>Типы данных</h3>
<table>
<tr><td>Тип</td><td>Пример</td><td>Описание</td></tr>
<tr><td>address</td><td>0x742d...6634</td><td>Адрес (20 байт)</td></tr>
<tr><td>uint256</td><td>1000000</td><td>Число без знака</td></tr>
<tr><td>int256</td><td>-42</td><td>Число со знаком</td></tr>
<tr><td>bool</td><td>true/false</td><td>Логический</td></tr>
<tr><td>string</td><td>"Hello"</td><td>Текст</td></tr>
<tr><td>bytes32</td><td>0x1234...</td><td>Байты (фикс.)</td></tr>
<tr><td>mapping</td><td>mapping(address => uint)</td><td>Ключ-значение</td></tr>
<tr><td>array</td><td>uint[]</td><td>Динамический массив</td></tr>
</table>

<h3>Модификаторы доступа</h3>
<pre>
public    → доступно извне и внутри
external  → только извне (дешевле gas)
internal  → только внутри контракта
private   → только внутри + наследуемые
view      → только чтение (без изменения состояния)
pure      → без чтения и записи
</pre>

<h3>Remix IDE — онлайн IDE</h3>
<p><a href="https://remix.ethereum.org" target="_blank">Remix.ethereum.org</a></p>
<ol>
<li>Создайте файл HelloWorld.sol</li>
<li>Напишите код</li>
<li>Ctrl+S — компиляция</li>
<li>Выберите Environment (JavaScript VM)</li>
<li>Deploy — деплой в тестовую сеть</li>
</ol>

<blockquote>📚 Практика: создайте контракт "Hello World" в Remix и вызовите все функции!</blockquote>`
        },
        {
          title: '📝 Функции и события',
          content: `<h2>Функции и Events в Solidity</h2>
<p>Функции — основной способ взаимодействия с контрактом. Events — способ логирования.</p>

<h3>Функции</h3>
<pre>
function transfer(address to, uint amount) public returns (bool) {
    require(balance[msg.sender] >= amount, "Недостаточно средств");
    balance[msg.sender] -= amount;
    balance[to] += amount;
    return true;
}

• msg.sender — кто вызвал
• require() — проверка условий
• returns() — что возвращаем
</pre>

<h3>payable функции</h3>
<pre>
function deposit() public payable {
    balance[msg.sender] += msg.value;
}

• msg.value — сколько ETH отправлено
• payable — функция принимает ETH
</pre>

<h3>Events (события)</h3>
<p>Events записываются в блокчейн и позволяют отслеживать действия:</p>
<pre>
event Transfer(address indexed from, address indexed to, uint amount);

function transfer(address to, uint amount) public {
    // ... логика ...
    emit Transfer(msg.sender, to, amount);
}

• indexed — можно фильтровать в логах
• emit — вызов события
</pre>

<h3>Практический пример: Token</h3>
<pre>
contract SimpleToken {
    mapping(address => uint) public balanceOf;
    
    event Transfer(address indexed from, address indexed to, uint value);
    
    function mint(address to, uint amount) public {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function transfer(address to, uint amount) public {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
    }
}
</pre>

<h3>Gas оптимизация</h3>
<ul>
<li>📦 <code>external</code> вместо <code>public</code> — дешевле</li>
<li>💾 <code>uint256</code> — базовый тип, не использует доп. gas</li>
<li>🗑️ Не храните лишнее в storage</li>
<li>🔢 Используйте <code>unchecked</code> где возможно</li>
</ul>

<blockquote>📝 Events — ваш "console.log" в блокчейне. Используйте их для отладки и мониторинга!</blockquote>`
        },
        {
          title: '🎯 Примеры на Remix',
          content: `<h2>Практика: пишем контракты в Remix</h2>
<p>Создадим 3 контракта разной сложности в Remix IDE.</p>

<h3>1. Простой Storage</h3>
<pre>
// Хранит и читает одно число
contract Storage {
    uint public number;
    
    function store(uint _number) public {
        number = _number;
    }
    
    function retrieve() public view returns (uint) {
        return number;
    }
}
</pre>

<h3>2. Voting (голосование)</h3>
<pre>
contract Ballot {
    struct Voter { uint weight; bool voted; address delegate; uint vote; }
    struct Proposal { string name; uint voteCount; }
    
    address public chairperson;
    mapping(address => Voter) public voters;
    Proposal[] public proposals;
    
    constructor(string[] memory names) {
        chairperson = msg.sender;
        voters[chairperson].weight = 1;
        
        for (uint i = 0; i < names.length; i++) {
            proposals.push(Proposal(names[i], 0));
        }
    }
    
    function giveRightToVote(address voter) public {
        require(msg.sender == chairperson);
        require(!voters[voter].voted);
        voters[voter].weight = 1;
    }
    
    function vote(uint proposal) public {
        Voter storage sender = voters[msg.sender];
        require(sender.weight != 0 && !sender.voted);
        sender.voted = true;
        sender.vote = proposal;
        proposals[proposal].voteCount += sender.weight;
    }
}
</pre>

<h3>3. Token с OpenZeppelin</h3>
<pre>
// Используем готовые контракты OpenZeppelin
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}

// decimals() по умолчанию = 18
// 1 MTK = 1 * 10^18 единиц
</pre>

<h3>Подключение OpenZeppelin в Remix</h3>
<ol>
<li>File Explorers → Solidity</li>
<li>Contracts → New File</li>
<li>Вверху: "Import a contract from GitHub"</li>
<li>Вставьте: @openzeppelin/contracts/token/ERC20/ERC20.sol</li>
</ol>

<blockquote>🎯 Скопируйте каждый пример в Remix, скомпилируйте и протестируйте в JavaScript VM!</blockquote>`
        }
      ]
    },
    {
      title: '💎 DeFi и NFT',
      modules: [
        {
          title: '💰 DEX и AMM',
          content: `<h2>Децентрализованные биржи (DEX)</h2>
<p>DEX позволяют обменивать токены без посредников. Цены определяются математически.</p>

<h3>Как работает AMM?</h3>
<p><strong>AMM (Automated Market Maker)</strong> — алгоритм, определяющий цену автоматически.</p>
<pre>
Формула: x * y = k

x = количество Token A
y = количество Token B
k = константа (не меняется)

Если покупаете Token B:
├── Token A увеличивается
├── Token B уменьшается
└── Цена Token B растёт
</pre>

<h3>Основные DEX</h3>
<ul>
<li><strong>Uniswap</strong> — крупнейший на Ethereum</li>
<li><strong>PancakeSwap</strong> — BSC</li>
<li><strong>Raydium</strong> — Solana</li>
<li><strong>Trader Joe</strong> — Avalanche</li>
</ul>

<h3>Типы пулов</h3>
<pre>
Constant Product (x*y=k)
├── Uniswap V2
├── Самое популярное
└── Неограниченная ликвидность

Stable Swap (x+y=k или подобное)
├── Curve Finance
└── Для стейблкоинов (USDC/USDT)

Concentrated Liquidity (Uniswap V3)
├── Ликвидность в ценовых диапазонах
├── Больше дохода для провайдеров
└── Сложнее управлять
</pre>

<h3>Имперских потери (Impermanent Loss)</h3>
<p>Риск поставщика ликвидности:</p>
<pre>
Было: 1 ETH + 1000 USDC (при ETH=$1000)
Стало: ETH=$2000

В пуле: 0.7 ETH + 1400 USDC = $2800
Просто держали: $3000

Impermanent Loss = $200 (пока не вывели)
</pre>

<blockquote>💰 Зарабатывайте 5-50% APY на ликвидности, но помните про Impermanent Loss!</blockquote>`
        },
        {
          title: '🏦 Lending и Borrowing',
          content: `<h2>Lending & Borrowing в DeFi</h2>
<p>Зарабатывайте проценты на своих активах или занимайте без посредников.</p>

<h3>Aave — крупнейший протокол</h3>
<pre>
Deposits (вклады):
├── USDC → 3.5% APY
├── ETH → 1.2% APY
├── WBTC → 0.5% APY
└── Забираете в любое время

Borrows (займы):
├── Ставка: 3-8% APY (переменная)
├── Нужно внести залог
└── liquidationThreshold: 80-90%
</pre>

<h3>Как работает залог?</h3>
<pre>
Вы хотите занять 1000 USDC
├── Вносите 1 ETH как залог (~$2000)
├── Максимальный залог: 75% = $1500
├── Health Factor = Залог / Долг
└── Если HF < 1 → ликвидация
</pre>

<h3>Compound Finance</h3>
<pre>
• Автоматические ставки
• Компиляция процентов каждую блок
• cToken — начисляемые токены
  ├── cETH для ETH
  ├── cUSDC для USDC
  └── cDAI для DAI
</pre>

<h3>Риски</h3>
<ul>
<li>⚠️ <strong>Ликвидация</strong> — потеря залога</li>
<li>📉 <strong>Impermanent loss</strong> — для LP</li>
<li>🦠 <strong>Smart contract risk</strong> — баги в коде</li>
<li>🔗 <strong>Oracle risk</strong> — манипуляция ценами</li>
</ul>

<h3>Топ протоколы</h3>
<table>
<tr><td>Протокол</td><td>TVL</td><td>Сеть</td></tr>
<tr><td>Aave</td><td>$5B+</td><td>Multi-chain</td></tr>
<tr><td>Compound</td><td>$2B+</td><td>Ethereum</td></tr>
<tr><td>MakerDAO</td><td>$3B+</td><td>Ethereum</td></tr>
<tr><td>Cream</td><td>$500M</td><td>Multi-chain</td></tr>
</table>

<blockquote>🏦 DeFi Lending — альтернатива банковским вкладам с 3-10% годовых!</blockquote>`
        },
        {
          title: '🎨 NFT и маркетплейсы',
          content: `<h2>NFT — невзаимозаменяемые токены</h2>
<p>NFT — уникальные токены для цифрового искусства, игр и прав собственности.</p>

<h3>ERC-721 vs ERC-20</h3>
<pre>
ERC-20 (fungible token):
  tokenId не важен
  1 ETH = 1 ETH = 1 ETH ✅
  
ERC-721 (NFT):
  tokenId уникален
  CryptoPunk #123 ≠ CryptoPunk #456 ✅
</pre>

<h3>Стандарт NFT</h3>
<pre>
contract MyNFT is ERC721 {
    constructor() ERC721("MyNFT", "MNFT") {
        _mint(msg.sender, 1);
        _mint(msg.sender, 2);
    }
}

// tokenId 1 и 2 — разные NFT
// У каждого может быть разный владелец
</pre>

<h3>Маркетплейсы</h3>
<ul>
<li><strong>OpenSea</strong> — крупнейший (80% рынка)</li>
<li><strong>Blur</strong> — для трейдеров, быстрый, 0% комиссия</li>
<li><strong>Rarible</strong> — децентрализованный</li>
<li><strong>Magic Eden</strong> — Solana NFT</li>
</ul>

<h3> royalties (роялти)</h3>
<pre>
NFT creators usually set 5-10% royalties
├── При каждой перепродаже
├── Автоматически через контракт
└── Blur bypasses royalties (controversy)
</pre>

<h3>Use cases NFT</h3>
<pre>
🎨 Цифровое искусство
   └── Beeple, XCopy, Pak
   
🎮 In-game items
   └── Axie Infinity, Gods Unchained
   
🎫 Билеты и access passes
   └── ENS, GaterNames
   
🏠 Токенизация активов
   └── Real estate, art
</pre>

<h3>Как создать NFT</h3>
<ol>
<li>Скачайте MetaMask</li>
<li>Получите тестовый ETH (Sepolia faucet)</li>
<li>Откройте OpenSea Testnets</li>
<li>Create → создайте коллекцию</li>
<li>Mint → создайте NFT</li>
</ol>

<blockquote>🎨 NFT — это не только картинки. Токенизация любых уникальных активов!</blockquote>`
        }
      ]
    },
    {
      title: '🪙 Tokenomics',
      modules: [
        {
          title: '📊 Эмиссия и инфляция',
          content: `<h2>Tokenomics: эмиссия токена</h2>
<p>Tokenomics определяет экономическую модель токена: создание, распределение и использование.</p>

<h3>Типы эмиссии</h3>
<pre>
DEFLATIONARY (дефляционная)
├── Токенов становится меньше
├── Механизм сжигания (burn)
├── Примеры: BNB (quarterly burn), SHIB
└── Цель: дефицит → рост цены

INFLATIONARY (инфляционная)
├── Новые токены выпускаются
├── Награды валидаторам, стейкерам
├── Примеры: ETH (EIP-1559), SOL
└── Цель: мотивация участников

FIXED (фиксированная)
├── Total Supply = максимум
├── Никогда не меняется
├── Пример: Bitcoin (21M), Shiba (500B)
└── Цель: предсказуемость
</pre>

<h3>EIP-1559: сжигание комиссий</h3>
<pre>
До EIP-1559:
  Комиссии → майнерам

После EIP-1559:
  Base Fee → сжигается 🔥
  Priority Fee → майнерам/валидаторам
  ETH became deflationary в some blocks!
</pre>

<h3>Сжигание токенов</h3>
<pre>
Механизмы burn:
├── Buy & Burn — покупка и сжигание
├── Auto Burn — автоматический % от транзакций
├── Quarterly Burn — BNB model
└── Token Burn events

address(0) — "burn address" (сжигание)
</pre>

<h3>Token Supply метрики</h3>
<table>
<tr><td>Метрика</td><td>Описание</td></tr>
<tr><td>Total Supply</td><td>Уже выпущено</td></tr>
<tr><td>Max Supply</td><td>Максимум возможно</td></tr>
<tr><td>Circulating Supply</td><td>В обращении</td></tr>
<tr><td>FDV</td><td>Fully Diluted Value = цена × max supply</td></tr>
</table>

<blockquote>📊 FDV — главная метрика для сравнения. $1 токен с 1B supply = $1B FDV.</blockquote>`
        },
        {
          title: '🎯 Utility vs Security',
          content: `<h2>Utility vs Security токены</h2>
<p>Классификация токенов важна для регуляции и понимания проекта.</p>

<h3>Utility токены</h3>
<pre>
Назначение: доступ к функциям сервиса

Примеры:
├── ETH — gas для транзакций
├── UNI — governance (голосование)
├── AAVE — доступ к протоколу
└── BNB — скидки на комиссии

Регуляция:
├── Обычно НЕ регулируются
├── Howey Test: "no investment contract"
└── SEC обычно не интересуется
</pre>

<h3>Security токены</h3>
<pre>
Назначение: инвестиция в проект

Признаки:
├── Ожидание прибыли
├── Общая entreprise
├── Прибыль от усилий других
└── Пример: токены с dividends

Регуляция:
├── SEC, FCA, и др.
├── Нужна регистрация
└── Нарушение = крупные штрафы
</pre>

<h3>Как определить?</h3>
<pre>
Howey Test (США):
├── Деньги вложены? ✅
├── В общее предприятие? ✅
├── Ожидание прибыли? ✅
├── От усилий других? ✅
   └── Да на все = Security!
</pre>

<h3>Известные cases</h3>
<ul>
<li>⚖️ <strong>SEC vs Ripple</strong> — XRP security или нет?</li>
<li>⚖️ <strong>SEC vs Binance</strong> — нарушения securities laws</li>
<li>✅ <strong>BTC, ETH</strong> — признаны НЕ security</li>
</ul>

<h3>Governance токены</h3>
<pre>
Права:
├── Голосование за proposals
├── Изменение параметров
├── Treasury управления
└── Примеры: UNI, COMP, AAVE

Токеномика governance обычно:
├── Inflationary (награды)
├── Limited utility
└── Governance-only value
</pre>

<blockquote>🎯 Перед покупкой изучите: это utility или potential security? Это влияет на регуляцию.</blockquote>`
        },
        {
          title: '📈 Распределение и Vesting',
          content: `<h2>Tokenomics: распределение и Vesting</h2>
<p>Как токены распределяются между участниками — критически важно для долгосрочной цены.</p>

<h3>Типичное распределение</h3>
<pre>
Примеры новых проектов:

🎁 Публичная продажа: 20-40%
├── IDO/IEO
├── Fair launch
└── Airdrops

👥 Команда: 10-20%
└── Обычно vesting 4 года

💼 Инвесторы: 15-30%
└── Обычно vesting 1-2 года

📦 Экосистема/Казна: 20-40%
├── Grants
├── Partnerships
└── Liquidity mining

🏦 Liquidity: 5-15%
└── Первичные пулы
</pre>

<h3>Vesting — постепенная разблокировка</h3>
<pre>
 cliff = период до первой разблокировки
 vesting = период полной разблокировки

Пример с cliff 1 год, vesting 3 года:
├── Год 0-1: 0 токенов
├── Год 1-2: ~33% токенов
├── Год 2-3: ~66% токенов
├── Год 3-4: 100% токенов
└── После: полный unlock
</pre>

<h3>Когда смотреть на unlock?</h3>
<ul>
<li>📅 <strong>TGE (Token Generation Event)</strong> — когда токены созданы</li>
<li>📊 <strong>Unlock schedule</strong> — когда разблокировки</li>
<li>📉 <strong>Market cap vs FDV</strong> — разница между циркулирующим и полным supply</li>
</ul>

<h3>Пример: высокий FDV риск</h3>
<pre>
Token с Unlock:

Сейчас:
├── Circulating: 10% (инвесторы рано)
├── Цирк. капитализация: $10M
└── FDV: $100M

После unlock:
├── 100% tokens unlocked
├── Могут продавать инвесторы
└── Price dump potential!
</pre>

<h3>Где смотреть</h3>
<ul>
<li><strong>Token Unlocks</strong> — токены с unlock events</li>
<li><strong>Messari</strong> — research и tokenomics</li>
<li><strong>DeepDAO</strong> — governance данных</li>
<li><strong>Etherscan</strong> — holders и контракты</li>
</ul>

<blockquote>📈 Перед покупкой проверьте unlock schedule и FDV/cap ratio!</blockquote>`
        }
      ]
    },
    {
      title: '🛠️ Практика: ERC-20 и Uniswap',
      modules: [
        {
          title: '🪙 Создание ERC-20 токена',
          content: `<h2>Создание ERC-20 токена</h2>
<p>Создадим свой токен на Remix IDE. Это проще чем кажется!</p>

<h3>Способ 1: Ручной ERC-20</h3>
<pre>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function totalSupply() external view returns (uint);
    function balanceOf(address account) external view returns (uint);
    function transfer(address to, uint amount) external returns (bool);
    // ... другие функции
}

contract MyToken is IERC20 {
    uint public totalSupply;
    mapping(address => uint) public balanceOf;
    
    function mint(address to, uint amount) public {
        totalSupply += amount;
        balanceOf[to] += amount;
    }
    
    function transfer(address to, uint amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
</pre>

<h3>Способ 2: OpenZeppelin (рекомендуется)</h3>
<pre>
// Используем готовые, безопасные контракты
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    uint public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    
    constructor() ERC20("MyToken", "MTK") {
        // Mint при создании
        _mint(msg.sender, MAX_SUPPLY);
    }
}
</pre>

<h3>Параметры</h3>
<pre>
Symbol: MTK (тикер, как BTC, ETH)
Decimals: 18 (стандарт Ethereum)
Total Supply: 1,000,000,000 * 10^18 = 1B tokens

Total Supply = decimals влияют только на отображение:
├── 1 MTK = 1 * 10^18 единиц
├── UI показывает: 1.000.000.000 MTK
└── В контракте: 1000000000000000000
</pre>

<h3>Деплой в Remix</h3>
<ol>
<li>📁 Создайте файл: MyToken.sol</li>
<li>📋 Выберите compiler: 0.8.x</li>
<li>🔨 Compile (Ctrl+S)</li>
<li>🌐 Environment: JavaScript VM (London)</li>
<li>📦 Deploy</li>
<li>✅ Тестируйте в тестовой сети!</li>
</ol>

<blockquote>🪙 Создайте токен, отправьте другу, проверьте в block explorer!</blockquote>`
        },
        {
          title: '🔄 Работа с Uniswap',
          content: `<h2>Uniswap: обмен токенов</h2>
<p>Uniswap — крупнейший DEX. Научимся делать обмены программно.</p>

<h3>Uniswap V2 Router</h3>
<pre>
Адреса (Ethereum mainnet):
Router: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
Factory: 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f
</pre>

<h3>Обмен ETH → Token</h3>
<pre>
Функция:
swapExactETHForTokens

Параметры:
├── amountOutMin — минимум на выходе (slippage)
├── path — [WETH, TOKEN_ADDRESS]
├── to — получатель
├── deadline — время дедлайна
└── value — ETH для обмена

Пример кода (ethers.js v5):
const router = new ethers.Contract(
    ROUTER, ROUTER_ABI, signer
);

await router.swapExactETHForTokens(
    amountOutMin,
    path,
    recipient,
    deadline,
    { value: ethers.utils.parseEther("0.1") }
);
</pre>

<h3>Добавление ликвидности</h3>
<pre>
addLiquidityETH(
    token,           // адрес токена
    amountTokenDesired, // кол-во токенов
    amountTokenMin,    // мин токенов
    amountETHMin,       // мин ETH
    to,                // получатель LP токенов
    deadline
) { value: ETH_amount }
</pre>

<h3>Uniswap V3 — новые функции</h3>
<pre>
Concentrated Liquidity:
├── Выбираете ценовой диапазон
├── Больше дохода при same capital
├── Range Orders
└── Сложнее управлять

Oracles:
├── TWAP (Time-Weighted Average Price)
├── Аккуратнее чем spot
└── Для других протоколов
</pre>

<h3>Frontend для обмена</h3>
<pre>
using ethers.js:

// Проверка баланса
const balance = await provider.getBalance(address);

// Approval (если токен)
const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
await token.approve(router, amount);

// Swap
const tx = await router.swapExactETHForTokens(
    minAmountOut, path, to, deadline,
    { value: ethAmount, gasLimit: 250000 }
);

await tx.wait(); // ждём подтверждения
</pre>

<blockquote>🔄 Практика: создайте токен, добавьте ликвидность, обменяйте ETH на свой токен!</blockquote>`
        },
        {
          title: '📊 Анализ токенов и проектов',
          content: `<h2>Как анализировать крипто-проекты</h2>
<p>Перед покупкой токена или участием в проекте — всегда проводите due diligence.</p>

<h3>Чеклист анализа</h3>
<pre>
1. TOKENOMICS
├── Total/Max Supply
├── FDV vs Market Cap
├── Inflation rate
├── Unlock schedule (когда разблокировки?)
└── Allocation (% команда, инвесторы, community)

2. TEAM & INVESTORS
├── Кто основатели? (верифицированы?)
├── Какие инвесторы? (a16z, Paradigm?)
├── Transparency (KYC?)
└── Токены команды locked?

3. PRODUCT & TOKEN UTILITY
├── Решает реальную проблему?
├── Почему токен нужен?
├── Governance? Fee discount? Staking?
└── Токен захардкожен или можно убрать?

4. TECHNICAL
├── Code audited?
├── Github public?
├── TVL / Revenue / Users
└── Competitors
</pre>

<h3>Где искать данные</h3>
<ul>
<li><strong>DeFi Llama</strong> — TVL всех протоколов</li>
<li><strong>Dune Analytics</strong> — on-chain data</li>
<li><strong>Token Terminal</strong> — revenue, P/S ratio</li>
<li><strong>Messari</strong> — research reports</li>
<li><strong>Etherscan</strong> — контракты, holders</li>
<li><strong>DexScreener</strong> — свежие токены, графики</li>
<li><strong>Nansen</strong> — smart money tracking</li>
</ul>

<h3>Red flags 🚩</h3>
<pre>
Остерегайтесь:
├── Anonymous team
├── Непропорциональный unlock для команды
├── Suspiciously high APY
├── Copy-paste whitepaper
├── No code audits
└── Massive FDV with tiny real use
</pre>

<h3>Green flags ✅</h3>
<pre>
Хорошие знаки:
├── Known, reputable team
├── Multiple audits (Trail of Bits, Certik)
├── Transparent tokenomics
├── Logical token utility
├── Real users и revenue
└── Strong community
</pre>

<h3>Пример: анализ DEGEN</h3>
<pre>
Total Supply: 36.6B DEGEN
FDV at $0.02: ~$732M
Market Cap: ~$70M (circulating ~10%)

Unlock:
├── 42% in community (airdrop)
├── 35% equipo
├── 23% investors
└── Cliff: 12 months, Vesting 3 years

Verdict:
├── Small circulating supply
├── High unlock risk
├── But: strong use case (tips)
└── Track unlock schedule!
</pre>

<blockquote>📊 Успех в крипте = умение отличать реальные проекты от rug pulls. Учитесь анализировать!</blockquote>`
        }
      ]
    }
  ];

  for (const course of courses.rows) {
    const courseDataItem = courseData.find(c => c.title === course.title);
    if (!courseDataItem) continue;

    for (let i = 0; i < courseDataItem.modules.length; i++) {
      const mod = courseDataItem.modules[i];
      await pool.query(
        `INSERT INTO course_modules (course_id, title, content, order_index) VALUES ($1, $2, $3, $4)`,
        [course.id, mod.title, mod.content, i + 1]
      );
    }
  }
}
