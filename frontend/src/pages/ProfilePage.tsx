import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";

const avatarMap: Record<string, string> = {
  stage1: "🙂",
  stage2: "😎",
  stage3: "🏆"
};

export const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const profile = useAppStore((s) => s.profile);
  const [, setRefresh] = useState(0);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setRefresh(r => r + 1);
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>👤 {t('profile.title')}</h1>
      </div>
      
      {!profile && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔐</div>
          <p style={{ color: 'var(--text-secondary)' }}>{t('profile.authTitle')}</p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{t('profile.authDesc')}</p>
          <ul style={{ textAlign: 'left', color: 'var(--text-secondary)', paddingLeft: '24px', lineHeight: '2' }}>
            <li>{t('profile.authBenefits.score')}</li>
            <li>{t('profile.authBenefits.progress')}</li>
            <li>{t('profile.authBenefits.courses')}</li>
          </ul>
        </div>
      )}

      {profile && (
        <div className="card profile-card">
          <div className="profile-avatar">{avatarMap[profile.avatarStage] ?? "🙂"}</div>
          <h2 className="profile-name">{profile.firstName}</h2>
          <p className="profile-username">@{profile.username ?? "user"}</p>
          <div className="profile-stats">
            <div className="stat-card">
              <div className="stat-value">{profile.totalScore}</div>
              <div className="stat-label">{t('profile.score')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{profile.completedGames}</div>
              <div className="stat-label">{t('profile.gamesCompleted')}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '16px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>🌐 {t('language')}</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => changeLanguage('ru')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: i18n.language === 'ru' ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: i18n.language === 'ru' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg)',
              color: i18n.language === 'ru' ? 'var(--primary-light)' : 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: '15px'
            }}
          >
            🇷🇺 Русский
          </button>
          <button
            onClick={() => changeLanguage('en')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: i18n.language === 'en' ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: i18n.language === 'en' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg)',
              color: i18n.language === 'en' ? 'var(--primary-light)' : 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: '15px'
            }}
          >
            🇬🇧 English
          </button>
        </div>
      </div>
    </section>
  );
};
