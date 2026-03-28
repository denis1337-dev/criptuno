import { useAppStore } from "../store";

const avatarMap: Record<string, string> = {
  stage1: "🙂",
  stage2: "😎",
  stage3: "🏆"
};

export const ProfilePage = () => {
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
