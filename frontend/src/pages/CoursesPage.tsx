import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store";
import { getCourseModules } from "../api";
import { Course, CourseModule } from "../types";

const difficultyLabels: Record<string, { label: string; color: string }> = {
  easy: { label: "Лёгкий", color: "#22c55e" },
  medium: { label: "Средний", color: "#f59e0b" },
  hard: { label: "Сложный", color: "#ef4444" },
};

export const CoursesPage = () => {
  const { t } = useTranslation();
  const courses = useAppStore((s) => s.courses);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCourse) {
      setLoading(true);
      getCourseModules(selectedCourse.id)
        .then((data) => setModules(data.modules))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedCourse]);

  if (selectedCourse) {
    const diff = difficultyLabels[selectedCourse.difficulty] ?? difficultyLabels.easy;
    return (
      <div className="page">
        <button className="back-btn" onClick={() => setSelectedCourse(null)}>
          ← Назад
        </button>
        <div className="course-detail">
          <div className="course-detail-header">
            <h1>{selectedCourse.title}</h1>
            <span className="difficulty-badge" style={{ background: diff.color }}>
              {diff.label}
            </span>
          </div>
          {loading ? (
            <p>{t("app.loading")}</p>
          ) : (
            <div className="modules-list">
              {modules.map((mod) => (
                <div key={mod.id} className="module-card">
                  <span className="module-number">{mod.orderIndex}</span>
                  <div className="module-info">
                    <h3>{mod.title}</h3>
                    {mod.content ? (
                      <div dangerouslySetInnerHTML={{ __html: mod.content }} />
                    ) : (
                      <p className="module-empty">Скоро появится</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const grouped = {
    easy: courses.filter((c) => c.difficulty === "easy"),
    medium: courses.filter((c) => c.difficulty === "medium"),
    hard: courses.filter((c) => c.difficulty === "hard"),
  };

  return (
    <div className="page">
      <h1 className="page-title">{t("courses.title")}</h1>
      <p className="page-subtitle">{t("courses.subtitle")}</p>

      {Object.entries(grouped).map(([diff, list]) => {
        if (list.length === 0) return null;
        const info = difficultyLabels[diff] ?? difficultyLabels.easy;
        return (
          <div key={diff} className="difficulty-group">
            <h2 className="difficulty-title">
              <span className="difficulty-dot" style={{ background: info.color }} />
              {info.label}
            </h2>
            {list.map((course) => (
              <div
                key={course.id}
                className="course-card"
                onClick={() => setSelectedCourse(course)}
              >
                <div className="course-icon">📖</div>
                <div className="course-info">
                  <h3>{course.title}</h3>
                </div>
                <span className="course-arrow">›</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
