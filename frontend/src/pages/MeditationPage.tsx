import { useEffect, useState, useRef } from "react";

export const MeditationPage = () => {
  const [isMeditating, setIsMeditating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(180);
  const [volume, setVolume] = useState(0.7);
  const [isUnlocked] = useState(() => {
    return localStorage.getItem('coursesUnlocked') === 'true';
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
            onClick={() => {
              localStorage.setItem('coursesUnlocked', 'true');
              localStorage.setItem('meditationUnlocked', 'true');
              setShowPaywall(false);
            }}
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
