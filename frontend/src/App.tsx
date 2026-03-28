import { useEffect, useState, useRef } from "react";
import { useAppStore } from "./store";
import { PuzzleCollected, PuzzleLevel, QuizQuestion, QuizTest } from "./types";
import {
  completePuzzleLevel,
  getCollectedPuzzles,
  getPuzzleLevels,
  getQuizQuestions,
  getQuizTests
} from "./api";

const avatarMap: Record<string, string> = {
  stage1: "🙂",
  stage2: "😎",
  stage3: "🏆"
};

type PuzzleTile = { id: number };

const PUZZLE_SIZE = 4;
const getPuzzleSessionKey = (): string => {
  const key = "puzzleSessionKey";
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
};

const TrumpSledGame = ({
  onBack,
  onFinish
}: {
  onBack: () => void;
  onFinish: (score: number) => Promise<void>;
}) => {
  const SVG_W = 900;
  const SVG_H = 300;
  const GROUND_Y = 240;
  const PLAYER_X = 80;
  const PLAYER_W = 54;
  const PLAYER_H = 58;
  const PLAYER_TOP = GROUND_Y - PLAYER_H;
  const INIT_SPEED = 5;
  const MAX_SPEED = 14;
  const GRAVITY = 0.8;
  const JUMP_FORCE = -14;
  const OBSTACLE_W = 30;
  const OBSTACLE_H = 36;
  const OBSTACLE_TOP = GROUND_Y - OBSTACLE_H;
  const OBSTACLE_GAP_MIN = 350;
  const OBSTACLE_GAP_MAX = 650;
  const SPEED_INC = 0.002;
  const DUST_INTERVAL = 120;

  const OBSTACLE_EMOJI = 0;
  const COLLECTIBLE_MONEY = 1;
  const COLLECTIBLE_DIAMOND = 2;

  const obstacleEmojis = ["🐂", "🐻", "💰", "🚀", "📉", "🔥", "💎", "⚡"];
  const collectibleEmojis = ["💰", "💎"];
  const collectibleColors = ["#FFD700", "#00BFFF"];
  const collectiblePoints = [50, 100];

  const gs = useRef({
    running: false,
    over: false,
    score: 0,
    bonusScore: 0,
    speed: INIT_SPEED,
    playerY: 0,
    velY: 0,
    grounded: true,
    obstacles: [] as { worldX: number; type: number; collected: boolean }[],
    lastObstacleWorldX: 0,
    dustTimer: 0,
    blinkTimer: 0,
    gameOverFrame: 0
  });

  const [uiScore, setUiScore] = useState(0);
  const [uiBonusScore, setUiBonusScore] = useState(0);
  const [uiHighScore, setUiHighScore] = useState(() =>
    parseInt(window.localStorage.getItem("trumpDinoHighScore") ?? "0", 10)
  );
  const [uiRunning, setUiRunning] = useState(false);
  const [uiOver, setUiOver] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  const [uiSpeed, setUiSpeed] = useState(INIT_SPEED);
  const [dustParticles, setDustParticles] = useState<
    { id: number; x: number; y: number; vx: number; vy: number; life: number }[]
  >([]);
  const [dustId, setDustId] = useState(0);

  const rafRef = useRef<number>(0);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  const playSound = (type: string) => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === "jump") {
        osc.frequency.setValueAtTime(420, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.07);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "score") {
        osc.frequency.setValueAtTime(550, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.06);
      } else if (type === "die") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch { /* ignore */ }
  };

  const doJump = () => {
    const g = gs.current;
    if (!g.running || g.over) return;
    if (g.grounded) {
      g.velY = JUMP_FORCE;
      g.grounded = false;
      playSound("jump");
    }
  };

  const spawnDust = () => {
    setDustParticles((prev) => {
      const newDust = {
        id: dustId,
        x: PLAYER_X + 10,
        y: GROUND_Y - 2,
        vx: -(gs.current.speed * 0.3 + Math.random() * 2),
        vy: -Math.random() * 1.5 - 0.5,
        life: 1
      };
      setDustId((n) => n + 1);
      return [...prev.slice(-15), newDust];
    });
  };

  const startGame = () => {
    const g = gs.current;
    g.running = true;
    g.over = false;
    g.score = 0;
    g.bonusScore = 0;
    g.speed = INIT_SPEED;
    g.playerY = 0;
    g.velY = 0;
    g.grounded = true;
    g.obstacles = [];
    g.lastObstacleWorldX = PLAYER_X + 500;
    g.obstacles.push({ worldX: PLAYER_X + 500, type: OBSTACLE_EMOJI, collected: false });
    g.obstacles.push({ worldX: PLAYER_X + 800, type: COLLECTIBLE_MONEY, collected: false });
    g.obstacles.push({ worldX: PLAYER_X + 1100, type: OBSTACLE_EMOJI, collected: false });
    g.dustTimer = 0;
    g.blinkTimer = 0;
    g.gameOverFrame = 0;
    setUiScore(0);
    setUiBonusScore(0);
    setUiRunning(true);
    setUiOver(false);
    setUiSpeed(INIT_SPEED);
    setDustParticles([]);
    setRenderTick(0);
  };

  const triggerGameOver = (finalScore: number) => {
    const g = gs.current;
    g.running = false;
    g.over = true;
    g.gameOverFrame = renderTick;
    setUiRunning(false);
    setUiOver(true);
    playSound("die");
    if (finalScore > uiHighScore) {
      setUiHighScore(finalScore);
      window.localStorage.setItem("trumpDinoHighScore", String(finalScore));
    }
    void onFinishRef.current(finalScore);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        doJump();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!uiRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTime = performance.now();

    const loop = (now: number) => {
      const g = gs.current;
      if (!g.running) return;

      const dt = Math.min((now - lastTime) / 16.667, 2.5);
      lastTime = now;

      g.speed = Math.min(MAX_SPEED, g.speed + SPEED_INC * dt);
      g.score += Math.round(g.speed * dt * 0.6);

      const milestone = Math.floor(g.score / 100);
      if (milestone > 0 && milestone % 5 === 0 && g.score - Math.round(g.speed * dt * 0.6) < milestone * 100) {
        playSound("score");
      }

      g.velY += GRAVITY * dt;
      g.playerY += g.velY * dt;
      if (g.playerY >= 0) {
        g.playerY = 0;
        g.velY = 0;
        g.grounded = true;
      }

      for (const obs of g.obstacles) {
        obs.worldX -= g.speed * dt;
      }

      const spawnGap = OBSTACLE_GAP_MIN + Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN);
      const lastX = g.obstacles.length > 0 ? g.obstacles[g.obstacles.length - 1].worldX : PLAYER_X;
      if (lastX < SVG_W + 200) {
        const rand = Math.random();
        if (rand < 0.6) {
          g.obstacles.push({ worldX: lastX + spawnGap, type: OBSTACLE_EMOJI, collected: false });
        } else if (rand < 0.8) {
          g.obstacles.push({ worldX: lastX + spawnGap, type: COLLECTIBLE_MONEY, collected: false });
        } else {
          g.obstacles.push({ worldX: lastX + spawnGap, type: COLLECTIBLE_DIAMOND, collected: false });
        }
      }

      const playerLeft = PLAYER_X + 8;
      const playerRight = PLAYER_X + PLAYER_W - 8;
      const playerTop = GROUND_Y - PLAYER_H + g.playerY + 10;
      const playerBottom = GROUND_Y + g.playerY - 5;

      for (const obs of g.obstacles) {
        if (obs.collected) continue;

        const isCollectible = obs.type === COLLECTIBLE_MONEY || obs.type === COLLECTIBLE_DIAMOND;
        const obsScreenX = obs.worldX;
        const obsLeft = obsScreenX + 6;
        const obsRight = obsScreenX + OBSTACLE_W - 6;

        let obsTop: number;
        let obsBottom: number;
        if (isCollectible) {
          const collectY = GROUND_Y - PLAYER_H - 20;
          obsTop = collectY + 8;
          obsBottom = collectY + OBSTACLE_H - 4;
        } else {
          obsTop = OBSTACLE_TOP + 10;
          obsBottom = GROUND_Y;
        }

        const hOverlap = playerRight > obsLeft && playerLeft < obsRight;
        const vOverlap = playerBottom > obsTop && playerTop < obsBottom;

        if (hOverlap && vOverlap) {
          if (isCollectible) {
            obs.collected = true;
            const bonus = obs.type === COLLECTIBLE_DIAMOND ? 100 : 50;
            g.bonusScore += bonus;
            setUiBonusScore(g.bonusScore);
            playSound("score");
            for (let i = 0; i < 8; i++) {
              setDustParticles((prev) => {
                const newP = {
                  id: dustId + i,
                  x: obsScreenX + OBSTACLE_W / 2,
                  y: GROUND_Y - PLAYER_H - 10,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 1) * 4,
                  life: 1
                };
                return [...prev.slice(-20), newP];
              });
            }
          } else {
            triggerGameOver(g.score);
            return;
          }
        }
      }

      g.obstacles = g.obstacles.filter((o) => o.worldX > PLAYER_X - 100 && !o.collected);

      if (g.grounded) {
        g.dustTimer += dt;
        if (g.dustTimer > DUST_INTERVAL / (g.speed / INIT_SPEED)) {
          g.dustTimer = 0;
          spawnDust();
        }
      }

      setDustParticles((prev) =>
        prev
          .map((d) => ({ ...d, x: d.x - g.speed * dt * 0.5, y: d.y + d.vy * dt, life: d.life - 0.04 * dt }))
          .filter((d) => d.life > 0)
      );

      setUiScore(g.score);
      setUiSpeed(g.speed);
      setRenderTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [uiRunning]);

  const groundDashes = () => {
    const dashes: string[] = [];
    const offset = (renderTick * gs.current.speed * 0.5) % 40;
    for (let x = -offset; x < SVG_W + 40; x += 40) {
      dashes.push(`M ${x} ${GROUND_Y + 8} L ${x + 20} ${GROUND_Y + 8}`);
    }
    return dashes.join(" ");
  };

  const clouds = () => {
    const cloudPositions = [
      { x: 100, y: 40, scale: 1 },
      { x: 350, y: 60, scale: 0.8 },
      { x: 600, y: 30, scale: 1.2 },
      { x: 800, y: 70, scale: 0.7 }
    ];
    return cloudPositions.map((c, i) => {
      const offsetX = (renderTick * gs.current.speed * 0.1 + i * 200) % (SVG_W + 200) - 100;
      return (
        <g key={i} transform={`translate(${offsetX}, ${c.y}) scale(${c.scale})`} opacity="0.9">
          <ellipse cx="0" cy="0" rx="30" ry="18" fill="white" />
          <ellipse cx="25" cy="5" rx="25" ry="15" fill="white" />
          <ellipse cx="-20" cy="5" rx="20" ry="12" fill="white" />
        </g>
      );
    });
  };

  const visibleObstacles = gs.current.obstacles.map((o) => ({
    screenX: o.worldX,
    type: o.type,
    worldX: o.worldX,
    collected: o.collected
  })).filter((o) => o.screenX > -60 && o.screenX < SVG_W + 60 && !o.collected);

  const playerY = PLAYER_TOP + gs.current.playerY;

  const scoreStr = String(uiScore).padStart(5, "0");
  const bonusStr = uiBonusScore > 0 ? ` +${uiBonusScore}` : "";

  return (
    <section className="screen dino-screen">
      <h1>Трамп-Раннер</h1>
      <p>Пробел / ↑ — прыжок. Собирай 💰💎, избегай 🐂🐻🚀📉🔥⚡!</p>
      <div className="runner-hud">
        <span>СЧЁТ: <strong>{scoreStr}{bonusStr}</strong></span>
        <span>РЕКОРД: <strong>{String(uiHighScore).padStart(5, "0")}</strong></span>
      </div>
      <div className={`runner-wrapper ${uiOver ? "dino-over" : ""}`}>
        <svg
          className="runner-canvas"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          role="img"
          aria-label="Trump runner game"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#87CEEB" />
              <stop offset="60%" stopColor="#B0E0E6" />
              <stop offset="100%" stopColor="#E0F6FF" />
            </linearGradient>
            <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B4513" />
              <stop offset="100%" stopColor="#654321" />
            </linearGradient>
            <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#228B22" />
              <stop offset="100%" stopColor="#006400" />
            </linearGradient>
            <filter id="sunGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="playerShadow">
              <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3" />
            </filter>
            <filter id="collectGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#skyGrad)" />
          <circle cx="820" cy="60" r="40" fill="#FFD700" filter="url(#sunGlow)" opacity="0.9" />
          <circle cx="820" cy="60" r="35" fill="#FFEC8B" />
          {clouds()}
          <rect x="0" y={GROUND_Y} width={SVG_W} height="60" fill="url(#groundGrad)" />
          <rect x="0" y={GROUND_Y - 8} width={SVG_W} height="10" fill="url(#grassGrad)" />
          <path d={groundDashes()} stroke="#654321" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          {visibleObstacles.map((o, idx) => {
            const isCollectible = o.type === COLLECTIBLE_MONEY || o.type === COLLECTIBLE_DIAMOND;
            const emoji = isCollectible ? collectibleEmojis[o.type - 1] : obstacleEmojis[o.type];
            const emojiY = isCollectible ? GROUND_Y - PLAYER_H - 20 : OBSTACLE_TOP;
            const obsShadow = <ellipse cx={o.screenX + OBSTACLE_W / 2} cy={emojiY + OBSTACLE_H / 2 + 20} rx={OBSTACLE_W / 2 + 6} ry="5" fill="rgba(0,0,0,0.2)" />;
            const obsGlow = isCollectible ? <ellipse cx={o.screenX + OBSTACLE_W / 2} cy={emojiY + OBSTACLE_H / 2} rx={OBSTACLE_W / 2 + 8} ry={OBSTACLE_H / 2 + 8} fill={collectibleColors[o.type - 1]} opacity="0.3" filter="url(#collectGlow)" /> : null;
            const obsEmoji = <text x={o.screenX + OBSTACLE_W / 2} y={emojiY + OBSTACLE_H / 2} fontSize={isCollectible ? "36" : "34"} textAnchor="middle" dominantBaseline="middle" filter="url(#playerShadow)">{emoji}</text>;
            return <g key={`${o.worldX}-${idx}`}>{obsShadow}{obsGlow}{obsEmoji}</g>;
          })}
          <g transform={`translate(${PLAYER_X}, ${playerY})`} filter="url(#playerShadow)">
            {gs.current.grounded ? (
              <g>
                <ellipse cx="27" cy="56" rx="24" ry="6" fill="rgba(0,0,0,0.15)" />
                <rect x="8" y="44" width="38" height="14" rx="4" fill="#8B4513" />
                <ellipse cx="27" cy="48" rx="20" ry="10" fill="#1E3A5F" />
                <ellipse cx="20" cy="46" rx="6" ry="8" fill="#1E3A5F" />
                <ellipse cx="34" cy="46" rx="6" ry="8" fill="#1E3A5F" />
                <ellipse cx="27" cy="24" rx="18" ry="16" fill="#FFB347" />
                <ellipse cx="27" cy="20" rx="16" ry="10" fill="#FFD700" />
                <path d="M15 12 Q27 4 39 12" fill="#FFD700" />
                <ellipse cx="20" cy="22" rx="3" ry="2" fill="#1a1a1a" />
                <ellipse cx="34" cy="22" rx="3" ry="2" fill="#1a1a1a" />
                <circle cx="20.5" cy="21.5" r="1" fill="white" />
                <circle cx="34.5" cy="21.5" r="1" fill="white" />
                <ellipse cx="27" cy="28" rx="4" ry="2" fill="#e85d75" />
                <rect x="25" y="30" width="4" height="6" fill="white" />
                <polygon points="22,36 32,36 27,44" fill="#cc0000" />
                <rect x="16" y="38" width="8" height="12" rx="2" fill="#1E3A5F" />
                <rect x="30" y="38" width="8" height="12" rx="2" fill="#1E3A5F" />
              </g>
            ) : (
              <g transform="rotate(-12)">
                <ellipse cx="27" cy="56" rx="24" ry="6" fill="rgba(0,0,0,0.15)" />
                <rect x="8" y="44" width="38" height="14" rx="4" fill="#8B4513" />
                <ellipse cx="27" cy="48" rx="20" ry="10" fill="#1E3A5F" />
                <ellipse cx="20" cy="46" rx="6" ry="8" fill="#1E3A5F" />
                <ellipse cx="34" cy="46" rx="6" ry="8" fill="#1E3A5F" />
                <ellipse cx="27" cy="24" rx="18" ry="16" fill="#FFB347" />
                <ellipse cx="27" cy="20" rx="16" ry="10" fill="#FFD700" />
                <path d="M15 12 Q27 4 39 12" fill="#FFD700" />
                <ellipse cx="20" cy="22" rx="3" ry="2" fill="#1a1a1a" />
                <ellipse cx="34" cy="22" rx="3" ry="2" fill="#1a1a1a" />
                <circle cx="20.5" cy="21.5" r="1" fill="white" />
                <circle cx="34.5" cy="21.5" r="1" fill="white" />
                <ellipse cx="27" cy="28" rx="4" ry="2" fill="#e85d75" />
                <rect x="25" y="30" width="4" height="6" fill="white" />
                <polygon points="22,36 32,36 27,44" fill="#cc0000" />
                <rect x="16" y="38" width="8" height="12" rx="2" fill="#1E3A5F" />
                <rect x="30" y="38" width="8" height="12" rx="2" fill="#1E3A5F" />
              </g>
            )}
          </g>
          {dustParticles.map((d) => (
            <circle key={d.id} cx={d.x} cy={d.y} r={3 * d.life} fill="#D2B48C" opacity={d.life * 0.7} />
          ))}
          {uiOver && (
            <g>
              <rect width={SVG_W} height={SVG_H} fill="rgba(0,0,0,0.4)" />
              <rect x={SVG_W / 2 - 160} y={SVG_H / 2 - 75} width="320" height="120" rx="12" fill="white" stroke="#333" strokeWidth="3" />
              <text x={SVG_W / 2} y={SVG_H / 2 - 38} textAnchor="middle" fill="#333" fontSize="28" fontFamily="'Courier New', monospace" fontWeight="bold">
                GAME OVER
              </text>
              <text x={SVG_W / 2} y={SVG_H / 2 - 5} textAnchor="middle" fill="#666" fontSize="16" fontFamily="'Courier New', monospace">
                Итог: {String(uiScore + uiBonusScore).padStart(5, "0")}
              </text>
              {uiBonusScore > 0 && (
                <text x={SVG_W / 2} y={SVG_H / 2 + 18} textAnchor="middle" fill="#FFD700" fontSize="13" fontFamily="'Courier New', monospace">
                  💰 Бонус: +{uiBonusScore}
                </text>
              )}
              {uiScore + uiBonusScore >= uiHighScore && uiScore > 0 ? (
                <text x={SVG_W / 2} y={SVG_H / 2 + 42} textAnchor="middle" fill="#FFD700" fontSize="15" fontFamily="'Courier New', monospace" fontWeight="bold">
                  ★ НОВЫЙ РЕКОРД! ★
                </text>
              ) : (
                <text x={SVG_W / 2} y={SVG_H / 2 + 42} textAnchor="middle" fill="#999" fontSize="12" fontFamily="'Courier New', monospace">
                  Рекорд: {String(uiHighScore).padStart(5, "0")}
                </text>
              )}
            </g>
          )}
          {!uiRunning && !uiOver && (
            <g>
              <rect width={SVG_W} height={SVG_H} fill="rgba(135,206,235,0.3)" />
              <rect x={SVG_W / 2 - 180} y={SVG_H / 2 - 80} width="360" height="130" rx="16" fill="white" stroke="#333" strokeWidth="3" />
              <text x={SVG_W / 2} y={SVG_H / 2 - 40} textAnchor="middle" fill="#333" fontSize="28" fontFamily="'Courier New', monospace" fontWeight="bold">
                🏃 ТРАМП-РАННЕР 🏃
              </text>
              <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" fill="#666" fontSize="13" fontFamily="'Courier New', monospace">
                Пробел / ↑ — прыжок
              </text>
              <text x={SVG_W / 2} y={SVG_H / 2 + 25} textAnchor="middle" fill="#999" fontSize="12" fontFamily="'Courier New', monospace">
                Нажмите кнопку СТАРТ
              </text>
            </g>
          )}
        </svg>
      </div>
      {!uiRunning ? (
        <div className="actions">
          <button className="start-btn" onClick={startGame}>▶ СТАРТ</button>
          <button onClick={onBack}>← Назад</button>
        </div>
      ) : uiOver ? (
        <div className="actions">
          <button className="start-btn" onClick={startGame}>🔄 ЗАНОВО</button>
          <button onClick={onBack}>← Назад</button>
        </div>
      ) : (
        <div className="actions">
          <button onPointerDown={doJump} onTouchStart={(e) => { e.preventDefault(); doJump(); }}>
            ↑ Прыжок
          </button>
          <button onClick={onBack}>← Назад</button>
        </div>
      )}
      <p className="game-tip">💡 Пробел / ↑ — прыжок. Избегай 🐂🐻💰🚀!</p>
    </section>
  );
};

const createShuffledTiles = (): PuzzleTile[] => {
  const base = Array.from({ length: PUZZLE_SIZE * PUZZLE_SIZE }, (_, i) => ({ id: i }));
  const shuffled = [...base];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const isSolved = shuffled.every((tile, index) => tile.id === index);
  return isSolved ? createShuffledTiles() : shuffled;
};


const courseIcons: Record<string, string> = {
  'Что такое блокчейн': '⛓️',
  'Криптовалюты: Bitcoin и Ethereum': '₿',
  'Основы криптографии': '🔐',
  'Практика: Кошельки и транзакции': '👛',
  '⚖️ Консенсус: PoW, PoS и альтернативы': '⚖️',
  '📜 Смарт-контракты и Solidity': '📜',
  '💎 DeFi и NFT': '💎',
  '🪙 Tokenomics': '🪙',
  '🛠️ Практика: ERC-20 и Uniswap': '🛠️',
};

const CoursesScreen = () => {
  const courses = useAppStore((s) => s.courses);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem('coursesUnlocked') === 'true';
  });

  const unlockCourses = () => {
    localStorage.setItem('coursesUnlocked', 'true');
    localStorage.setItem('meditationUnlocked', 'true');
    setIsUnlocked(true);
    setShowPaywall(false);
  };

  const basicCourses = courses.filter(c => !c.isPremium);
  const premiumCourses = courses.filter(c => c.isPremium);

  const handleCourseClick = (course: { id: number; isPremium: boolean }) => {
    if (course.isPremium && !isUnlocked) {
      setShowPaywall(true);
    } else {
      window.location.href = `/course.html?course=${course.id}`;
    }
  };

  const renderCourse = (course: { id: number; title: string; isPremium: boolean }) => {
    const isLocked = course.isPremium && !isUnlocked;
    return (
      <div
        key={course.id}
        className="card card-glow course-card"
        onClick={() => handleCourseClick(course)}
        style={{ opacity: isLocked ? 0.7 : 1, cursor: 'pointer' }}
      >
        <div className="course-icon">
          {courseIcons[course.title] || '📖'}
          {isLocked && <span style={{ position: 'absolute', top: '-5px', right: '-5px', fontSize: '14px' }}>🔒</span>}
        </div>
        <div className="course-info">
          <h3 style={{ color: 'var(--text)', margin: '0 0 4px', fontSize: '17px', fontWeight: 600 }}>{course.title}</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{isLocked ? '💎 Премиум курс' : '3 модуля • Интерактивные уроки'}</p>
        </div>
        <span className="course-arrow">{isLocked ? '🔒' : '→'}</span>
      </div>
    );
  };

  if (showPaywall) {
    return (
      <section className="screen">
        <div className="screen-header">
          <h1>📚 Премиум курсы</h1>
          <p>Разблокируйте весь контент</p>
        </div>

        <div className="card" style={{ 
          textAlign: 'center', 
          padding: '48px 24px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>💎</div>
          <h2 style={{ margin: '0 0 12px', fontSize: '24px' }}>Премиум подписка</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 1.6 }}>
            Получите доступ ко всем курсам среднего и продвинутого уровня
          </p>
          
          <div style={{ 
            background: 'var(--bg)', 
            borderRadius: '16px', 
            padding: '24px', 
            marginBottom: '24px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--accent)', marginBottom: '8px' }}>
              $4.99
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px' }}>
              единоразовый платёж • навсегда
            </p>
          </div>

          <ul style={{ 
            textAlign: 'left', 
            color: 'var(--text-secondary)', 
            paddingLeft: '0',
            listStyle: 'none',
            marginBottom: '32px'
          }}>
            {[
              { icon: '⚖️', text: 'Механизмы консенсуса (PoW, PoS)' },
              { icon: '📜', text: 'Смарт-контракты и Solidity' },
              { icon: '💎', text: 'DeFi и NFT' },
              { icon: '🪙', text: 'Tokenomics' },
              { icon: '🛠️', text: 'Практика: ERC-20 и Uniswap' },
              { icon: '🧘', text: 'Антистресс-медитация' },
            ].map((item, i) => (
              <li key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                marginBottom: '12px',
                fontSize: '15px'
              }}>
                <span style={{ fontSize: '24px' }}>{item.icon}</span>
                {item.text}
              </li>
            ))}
          </ul>

          <button 
            className="start-btn" 
            onClick={unlockCourses}
            style={{ 
              width: '100%',
              padding: '18px',
              fontSize: '18px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)'
            }}
          >
            💳 Оплатить $4.99
          </button>

          <p style={{ color: 'var(--text-muted)', marginTop: '16px', fontSize: '12px' }}>
            Безопасная оплата через Telegram
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>📚 Обучение</h1>
        <p>Изучайте криптовалюты с нуля</p>
      </div>
      
      {basicCourses.map(course => (
        <a key={course.id} href={`course.html?course=${course.id}`} style={{ textDecoration: 'none' }}>
          {renderCourse(course)}
        </a>
      ))}
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        margin: '24px 0 16px'
      }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ 
          color: 'var(--accent)', 
          fontWeight: 700, 
          fontSize: '14px',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          💎 Средний уровень
        </span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      
      {premiumCourses.map(course => {
        const locked = course.isPremium && !isUnlocked;
        return locked ? (
          <div key={course.id} onClick={() => handleCourseClick(course)} style={{ textDecoration: 'none' }}>
            {renderCourse(course)}
          </div>
        ) : (
          <a key={course.id} href={`course.html?course=${course.id}`} style={{ textDecoration: 'none' }}>
            {renderCourse(course)}
          </a>
        );
      })}
    </section>
  );
};

const GamesScreen = () => {
  const games = useAppStore((s) => s.games);
  const playGame = useAppStore((s) => s.playGame);
  const [activeGame, setActiveGame] = useState<"menu" | "puzzle" | "quiz" | "trump-sled">("menu");
  const [sessionKey, setSessionKey] = useState("");
  const [puzzleLevels, setPuzzleLevels] = useState<PuzzleLevel[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [collected, setCollected] = useState<PuzzleCollected[]>([]);
  const [tiles, setTiles] = useState<PuzzleTile[]>(() => createShuffledTiles());
  const [draggingTile, setDraggingTile] = useState<number | null>(null);
  const [puzzleMoves, setPuzzleMoves] = useState(0);
  const [puzzleDone, setPuzzleDone] = useState(false);
  const [showPuzzlePreview, setShowPuzzlePreview] = useState(false);
  const [quizTests, setQuizTests] = useState<QuizTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const puzzleGameId = games.find((g) => g.slug === "memory-cards")?.id ?? games[0]?.id;
  const quizGameId = games.find((g) => g.slug === "quick-math")?.id ?? games[1]?.id ?? games[0]?.id;
  const runnerGameId = games[0]?.id;
  const currentLevel = puzzleLevels[currentLevelIndex];

  const loadCollected = async (key: string) => {
    const items = await getCollectedPuzzles(key);
    setCollected(items);
  };

  useEffect(() => {
    const key = getPuzzleSessionKey();
    setSessionKey(key);

    const loadPuzzle = async () => {
      const levels = await getPuzzleLevels();
      setPuzzleLevels(levels);
      setCurrentLevelIndex(0);
      await loadCollected(key);
    };
    void loadPuzzle();
  }, []);

  useEffect(() => {
    const loadQuizTests = async () => {
      const tests = await getQuizTests();
      setQuizTests(tests);
      if (tests[0] && !selectedTestId) {
        setSelectedTestId(tests[0].id);
      }
    };
    void loadQuizTests();
  }, []);

  useEffect(() => {
    if (!selectedTestId) {
      return;
    }
    const loadQuestions = async () => {
      setQuizLoading(true);
      try {
        const questions = await getQuizQuestions(selectedTestId);
        setQuizQuestions(questions);
        setQuizIndex(0);
        setQuizCorrect(0);
        setQuizDone(false);
        setSelectedAnswer(null);
      } finally {
        setQuizLoading(false);
      }
    };
    void loadQuestions();
  }, [selectedTestId]);

  const isPuzzleSolved = (nextTiles: PuzzleTile[]) =>
    nextTiles.every((tile, index) => tile.id === index);

  const resetPuzzle = () => {
    setTiles(createShuffledTiles());
    setPuzzleMoves(0);
    setPuzzleDone(false);
    setDraggingTile(null);
    setShowPuzzlePreview(false);
  };

  const openPuzzleLevel = (index: number) => {
    setCurrentLevelIndex(index);
    resetPuzzle();
  };

  const goToNextLevel = () => {
    if (currentLevelIndex >= puzzleLevels.length - 1) {
      return;
    }
    openPuzzleLevel(currentLevelIndex + 1);
  };

  const handleTileDrop = async (targetIndex: number) => {
    if (draggingTile === null) {
      return;
    }
    const sourceIndex = tiles.findIndex((tile) => tile.id === draggingTile);
    if (sourceIndex < 0 || sourceIndex === targetIndex) {
      return;
    }
    const nextTiles = [...tiles];
    [nextTiles[sourceIndex], nextTiles[targetIndex]] = [nextTiles[targetIndex], nextTiles[sourceIndex]];
    const nextMoves = puzzleMoves + 1;
    setTiles(nextTiles);
    setPuzzleMoves(nextMoves);
    setDraggingTile(null);

    if (isPuzzleSolved(nextTiles) && !puzzleDone) {
      setPuzzleDone(true);
      setShowPuzzlePreview(true);
      if (sessionKey && currentLevel) {
        await completePuzzleLevel(currentLevel.id, sessionKey);
        await loadCollected(sessionKey);
      }
      if (puzzleGameId) {
        const score = Math.max(20, 200 - nextMoves * 5);
        await playGame(puzzleGameId, score);
      }
    }
  };

  const restartQuiz = () => {
    setQuizIndex(0);
    setQuizCorrect(0);
    setQuizDone(false);
    setSelectedAnswer(null);
  };

  const onQuizAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null) {
      return;
    }
    const question = quizQuestions[quizIndex];
    if (!question) {
      return;
    }
    if (answerIndex === question.correctIndex) {
      setQuizCorrect((prev) => prev + 1);
    }
    setSelectedAnswer(answerIndex);
  };

  const goNextQuizStep = async () => {
    const isLast = quizIndex === quizQuestions.length - 1;
    if (isLast) {
      setQuizDone(true);
      if (quizGameId) {
        const score = quizCorrect * 40;
        await playGame(quizGameId, score);
      }
      return;
    }
    setQuizIndex((prev) => prev + 1);
    setSelectedAnswer(null);
  };

  if (activeGame === "puzzle") {
    return (
      <section className="screen">
        <div className="screen-header">
          <h1>🧩 Пазл</h1>
          <p>Перетаскивайте фрагменты, чтобы собрать картинку</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          {currentLevel ? <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>{currentLevel.title}</h3> : <p style={{ color: 'var(--text-muted)' }}>Загрузка...</p>}
          <div className="puzzle-grid" style={{ margin: '16px auto' }}>
          {tiles.map((tile, index) => {
            const row = Math.floor(tile.id / PUZZLE_SIZE);
            const col = tile.id % PUZZLE_SIZE;
            return (
              <button
                key={`${tile.id}-${index}`}
                className="puzzle-tile"
                draggable
                onDragStart={() => setDraggingTile(tile.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleTileDrop(index)}
                style={{
                  backgroundImage: `url(${currentLevel?.imageUrl ?? ""})`,
                  backgroundSize: `${PUZZLE_SIZE * 100}% ${PUZZLE_SIZE * 100}%`,
                  backgroundPosition: `${(col / (PUZZLE_SIZE - 1)) * 100}% ${(
                    (row / (PUZZLE_SIZE - 1)) *
                    100
                  )}%`
                }}
              />
            );
          })}
          </div>
          <div className="puzzle-stats">
            <span>🎯 Ходов: <strong>{puzzleMoves}</strong></span>
          </div>
          {puzzleDone ? <p className="success" style={{ marginTop: '12px' }}>🎉 Готово!</p> : null}
        </div>
        
        <div className="actions">
          <button className="btn-secondary" onClick={() => setShowPuzzlePreview((prev) => !prev)}>
            {showPuzzlePreview ? "🙈 Скрыть" : "👁️ Показать"}
          </button>
          <button className="btn-secondary" onClick={resetPuzzle}>🔀 Заново</button>
          <button className="btn-primary" onClick={goToNextLevel} disabled={currentLevelIndex >= puzzleLevels.length - 1}>
            →
          </button>
        </div>
        
        {showPuzzlePreview && currentLevel && (
          <div className="puzzle-preview">
            <img src={currentLevel.imageUrl} alt={currentLevel.title} />
          </div>
        )}
        
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>🖼️ Собранные</h3>
          {collected.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Пока нет собранных картинок</p>
          ) : (
            <div className="collected-list">
              {collected.map((item) => (
                <div key={`${item.levelId}-${item.completedAt}`} style={{ marginBottom: '12px' }}>
                  <img src={item.imageUrl} alt={item.levelTitle} style={{ borderRadius: '12px', width: '100%' }} />
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setActiveGame("menu")}>
            ← Назад к играм
          </button>
        </div>
      </section>
    );
  };

  if (activeGame === "quiz") {
    const currentQuestion = quizQuestions[quizIndex];
    const isCorrect = selectedAnswer !== null && currentQuestion
      ? selectedAnswer === currentQuestion.correctIndex
      : false;
    return (
      <section className="screen">
        <div className="screen-header">
          <h1>📝 Квиз</h1>
          <p>Проверьте свои знания</p>
        </div>
        
        <div className="card">
          <select
            value={selectedTestId ?? ""}
            onChange={(event) => {
              setSelectedTestId(Number(event.target.value));
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '15px',
              fontFamily: 'inherit',
              marginBottom: '16px'
            }}
          >
            {quizTests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.title}
              </option>
            ))}
          </select>
          
          {quizLoading && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка...</p>}
          
          {!quizLoading && quizQuestions.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>В этом тесте пока нет вопросов</p>
          )}
          
          {!quizLoading && quizQuestions.length > 0 && quizDone ? (
            <div className="quiz-result">
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>
                {quizCorrect === quizQuestions.length ? '🏆' : quizCorrect >= quizQuestions.length / 2 ? '🎉' : '📚'}
              </div>
              <h3 style={{ margin: '0 0 8px' }}>
                {quizCorrect === quizQuestions.length ? 'Отлично!' : quizCorrect >= quizQuestions.length / 2 ? 'Хороший результат!' : 'Попробуйте ещё'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                Правильных ответов: <strong style={{ color: 'var(--success)' }}>{quizCorrect}</strong> из {quizQuestions.length}
              </p>
              <div className="actions">
                <button className="btn-secondary" onClick={restartQuiz} style={{ flex: 1 }}>🔄 Ещё раз</button>
                <button className="btn-primary" onClick={() => setActiveGame("menu")} style={{ flex: 1 }}>← Игры</button>
              </div>
            </div>
          ) : null}
          
          {!quizLoading && quizQuestions.length > 0 && !quizDone && currentQuestion ? (
            <>
              <div className="quiz-progress">
                {quizQuestions.map((_, i) => (
                  <div key={i} className="quiz-progress-dot">
                    <div className="fill" style={{ width: i <= quizIndex ? '100%' : '0%' }} />
                  </div>
                ))}
              </div>
              
              <p style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '14px' }}>
                Вопрос {quizIndex + 1} из {quizQuestions.length}
              </p>
              
              <h3 className="quiz-question">{currentQuestion.questionText}</h3>
              
              <div className="quiz-options">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={option}
                    className={`quiz-option ${
                      selectedAnswer === null
                        ? ""
                        : index === currentQuestion.correctIndex
                        ? "correct"
                        : index === selectedAnswer
                        ? "wrong"
                        : ""
                    }`}
                    onClick={() => onQuizAnswer(index)}
                    disabled={selectedAnswer !== null}
                  >
                    <span style={{ marginRight: '12px', opacity: 0.6 }}>{String.fromCharCode(65 + index)}.</span>
                    {option}
                  </button>
                ))}
              </div>
              
              {selectedAnswer !== null && (
                <p className={isCorrect ? "success" : "error"} style={{ marginTop: '16px', textAlign: 'center' }}>
                  {isCorrect ? '✅ Верно!' : '❌ Неверно'}
                </p>
              )}
              
              <div className="quiz-actions">
                {selectedAnswer !== null && (
                  <button className="quiz-btn" onClick={() => void goNextQuizStep()}>
                    {quizIndex === quizQuestions.length - 1 ? '🏁 Завершить' : 'Далее →'}
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => setActiveGame("menu")} 
                style={{ 
                  width: '100%', 
                  marginTop: '12px', 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                ← Назад к играм
              </button>
            </>
          ) : null}
        </div>
      </section>
    );
  }

  if (activeGame === "trump-sled") {
    return (
      <TrumpSledGame
        onBack={() => setActiveGame("menu")}
        onFinish={async (score) => {
          if (runnerGameId) {
            await playGame(runnerGameId, Math.max(10, Math.floor(score / 8)));
          }
        }}
      />
    );
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>🎮 Мини-игры</h1>
        <p>Учитесь и зарабатывайте очки</p>
      </div>
      
      <div className="card game-card" onClick={() => setActiveGame("trump-sled")}>
        <h3>🛷 Trump on a Sled</h3>
        <p>Уклоняйтесь от медведей и собирайте бонусы на санях! Крипто-график ждёт.</p>
        <span className="game-badge badge-medium">⚡ Экшн</span>
        <span className="game-badge badge-medium">🎯 {Math.floor(parseInt(localStorage.getItem("trumpDinoHighScore") ?? "0") / 8)} очков</span>
      </div>
      
      <div className="card game-card" onClick={() => setActiveGame("puzzle")}>
        <h3>🧩 Пазл</h3>
        <p>Соберите красивые картинки из пазлов. Проверьте свою внимательность!</p>
        <span className="game-badge badge-easy">🟢 Лёгкий</span>
      </div>
      
      <div className="card game-card" onClick={() => setActiveGame("quiz")}>
        <h3>📝 Квиз</h3>
        <p>Проверьте знания о блокчейне и криптовалютах. Отвечайте на вопросы!</p>
        <span className="game-badge badge-easy">🟢 Лёгкий</span>
      </div>
    </section>
  );
};

const MeditationScreen = () => {
  const [isMeditating, setIsMeditating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(180);
  const [volume, setVolume] = useState(0.7);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem('coursesUnlocked') === 'true';
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unlockMeditation = () => {
    localStorage.setItem('coursesUnlocked', 'true');
    localStorage.setItem('meditationUnlocked', 'true');
    setIsUnlocked(true);
    setShowPaywall(false);
  };

  const initAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/antistress-trading.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = volume;
    }
    return audioRef.current;
  };

  const toggleAudio = () => {
    const audio = initAudio();
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const startMeditation = () => {
    const audio = initAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
    setIsPlaying(true);
    setIsMeditating(true);
    setTimer(selectedDuration);
    intervalRef.current = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          stopMeditation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopMeditation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsMeditating(false);
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const meditationTips = [
    { emoji: '🌊', title: 'Дыхание', text: 'Вдох на 4 секунды, задержка на 4, выдох на 6' },
    { emoji: '💰', title: 'Отпустите потери', text: 'Деньги вернутся. FOMO — враг трейдера' },
    { emoji: '📈', title: 'Долгосрочный взгляд', text: 'Крипта растёт годами. Не паникуйте от минутных просадок' },
    { emoji: '🧠', title: 'Чистый разум', text: 'Примите неопределённость. Рынок не предсказуем на 100%' },
  ];

  if (!isUnlocked || showPaywall) {
    return (
      <section className="screen">
        <div className="screen-header">
          <h1>🧘 Антистресс</h1>
          <p>Верните контроль над разумом</p>
        </div>

        <div className="card" style={{ 
          textAlign: 'center', 
          padding: '48px 24px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ margin: '0 0 12px', fontSize: '24px' }}>Премиум контент</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 1.6 }}>
            Антистресс-медитация для крипто-трейдеров:<br/>
            обретите покой и ясность ума
          </p>
          
          <div style={{ 
            background: 'var(--bg)', 
            borderRadius: '16px', 
            padding: '24px', 
            marginBottom: '24px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--accent)', marginBottom: '8px' }}>
              $1.99
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px' }}>
              единоразовый платёж
            </p>
          </div>

          <ul style={{ 
            textAlign: 'left', 
            color: 'var(--text-secondary)', 
            paddingLeft: '0',
            listStyle: 'none',
            marginBottom: '32px'
          }}>
            {[
              { icon: '⏱️', text: 'Таймер медитации без ограничений' },
              { icon: '🎧', text: 'Расслабляющее аудио сопровождение' },
              { icon: '🌊', text: 'Дыхательные упражнения' },
              { icon: '💡', text: 'Советы для крипто-трейдеров' },
            ].map((item, i) => (
              <li key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                marginBottom: '12px',
                fontSize: '15px'
              }}>
                <span style={{ fontSize: '24px' }}>{item.icon}</span>
                {item.text}
              </li>
            ))}
          </ul>

          <button 
            className="start-btn" 
            onClick={unlockMeditation}
            style={{ 
              width: '100%',
              padding: '18px',
              fontSize: '18px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)'
            }}
          >
            💳 Оплатить $1.99
          </button>

          <p style={{ color: 'var(--text-muted)', marginTop: '16px', fontSize: '12px' }}>
            Безопасная оплата через Telegram
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>🧘 Антистресс</h1>
        <p>Верните контроль над разумом</p>
      </div>

      <div className="card meditation-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        {isMeditating ? (
          <>
            <div className="meditation-circle" style={{ 
              width: '180px', 
              height: '180px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 0 60px rgba(99, 102, 241, 0.5)',
              animation: 'breathe 4s ease-in-out infinite'
            }}>
              <span style={{ fontSize: '48px', color: 'white', fontWeight: 700 }}>
                {formatTime(timer)}
              </span>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={toggleAudio}
                style={{
                  background: isPlaying ? 'linear-gradient(135deg, var(--primary), #8b5cf6)' : 'var(--bg-card)',
                  border: '2px solid var(--border)',
                  borderRadius: '50%',
                  width: '64px',
                  height: '64px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  cursor: 'pointer',
                  fontSize: '28px',
                  transition: 'all 0.2s'
                }}
              >
                {isPlaying ? '🔊' : '🔇'}
              </button>
              {isPlaying && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  style={{
                    width: '150px',
                    accentColor: 'var(--primary)'
                  }}
                />
              )}
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Дышите глубоко... Рынок подождёт 🌍
            </p>
            <button className="btn-secondary" onClick={stopMeditation} style={{ padding: '14px 32px' }}>
              ⏹️ Остановить
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '72px', marginBottom: '16px' }}>🧘‍♂️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>Антистресс-медитация</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
              Для крипто-трейдеров, которые устали от скачков рынка и хотят обрести покой
            </p>
            
            <div className="card" style={{ 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '32px' }}>🎧</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>Аудио сопровождение</h4>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>Расслабляющая музыка для медитации</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={toggleAudio}
                  style={{
                    background: isPlaying ? 'var(--primary)' : 'var(--bg)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '20px',
                    flexShrink: 0
                  }}
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  style={{
                    flex: 1,
                    accentColor: 'var(--primary)'
                  }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '14px' }}>Выберите длительность:</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[60, 180, 300, 600].map((duration) => (
                  <button
                    key={duration}
                    onClick={() => setSelectedDuration(duration)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: selectedDuration === duration ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: selectedDuration === duration ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg)',
                      color: selectedDuration === duration ? 'var(--primary-light)' : 'var(--text)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 600
                    }}
                  >
                    {duration >= 60 ? `${Math.floor(duration / 60)} мин` : `${duration} сек`}
                  </button>
                ))}
              </div>
            </div>

            <button className="start-btn" onClick={startMeditation} style={{ 
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
            }}>
              ▶️ Начать медитацию
            </button>
          </>
        )}
      </div>

      <h3 style={{ marginTop: '24px', marginBottom: '16px', fontSize: '18px' }}>💡 Советы для трейдеров</h3>
      
      {meditationTips.map((tip, index) => (
        <div key={index} className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <span style={{ fontSize: '28px' }}>{tip.emoji}</span>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '15px' }}>{tip.title}</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>{tip.text}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="card" style={{ 
        marginTop: '24px', 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
        textAlign: 'center',
        padding: '24px'
      }}>
        <p style={{ fontSize: '20px', margin: '0 0 8px' }}>💆</p>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Чистый разум = лучшие решения</h3>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
          Меньше стресса → меньше эмоциональных сделок → больше профита
        </p>
      </div>
    </section>
  );
};

const ProfileScreen = () => {
  const profile = useAppStore((s) => s.profile);

  if (!profile) {
    return (
      <section className="screen">
        <div className="screen-header">
          <h1>👤 Профиль</h1>
          <p>Авторизуйтесь в Telegram для сохранения прогресса</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔐</div>
          <p style={{ color: 'var(--text-secondary)' }}>Войдите через Telegram, чтобы:</p>
          <ul style={{ textAlign: 'left', color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: '2' }}>
            <li>Сохранять очки</li>
            <li>Отслеживать прогресс</li>
            <li>Проходить курсы</li>
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>👤 Профиль</h1>
      </div>
      <div className="card profile-card">
        <div className="profile-avatar">{avatarMap[profile.avatarStage] ?? "🙂"}</div>
        <h2 className="profile-name">{profile.firstName}</h2>
        <p className="profile-username">@{profile.username ?? "user"}</p>
        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-value">{profile.totalScore}</div>
            <div className="stat-label">Очков</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{profile.completedGames}</div>
            <div className="stat-label">Игр пройдено</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const BottomNav = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  return (
    <nav className="bottom-nav">
      <button className={activeTab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>
        <span className="nav-icon">📚</span>
        <span>Курсы</span>
      </button>
      <button className={activeTab === "games" ? "active" : ""} onClick={() => setTab("games")}>
        <span className="nav-icon">🎮</span>
        <span>Игры</span>
      </button>
      <button className={activeTab === "meditation" ? "active" : ""} onClick={() => setTab("meditation")}>
        <span className="nav-icon">🧘</span>
        <span>Антистресс</span>
      </button>
      <button className={activeTab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
        <span className="nav-icon">👤</span>
        <span>Профиль</span>
      </button>
    </nav>
  );
};

export const App = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const loading = useAppStore((s) => s.loading);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <main className="app">
      {loading ? <p>Загрузка...</p> : null}
      {activeTab === "courses" ? <CoursesScreen /> : null}
      {activeTab === "games" ? <GamesScreen /> : null}
      {activeTab === "meditation" ? <MeditationScreen /> : null}
      {activeTab === "profile" ? <ProfileScreen /> : null}
      <BottomNav />
    </main>
  );
};
