import { useState } from "react";
import { useAppStore } from "../store";

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

export const CoursesPage = () => {
  const courses = useAppStore((s) => s.courses);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUnlocked] = useState(() => {
    return localStorage.getItem('coursesUnlocked') === 'true';
  });

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
