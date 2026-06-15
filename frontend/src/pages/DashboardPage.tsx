/** Dashboard page — project overview shown as the app home screen. */
import { useCallback, useEffect, useState } from "react";
import { listStories, type Story } from "../api";

function DashboardPage() {
  const [stories, setStories] = useState<Story[]>([]);

  const fetchStories = useCallback(async () => {
    const data = await listStories();
    setStories(data);
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  return (
    <div className="dashboard">
      <h1>项目总览</h1>

      <div className="dashboard-cards">
        <div className="card">
          <div className="card-num">{stories.length}</div>
          <div className="card-label">作品</div>
        </div>
        <div className="card">
          <div className="card-num">0</div>
          <div className="card-label">总章节</div>
        </div>
        <div className="card">
          <div className="card-num">0</div>
          <div className="card-label">角色</div>
        </div>
        <div className="card">
          <div className="card-num">0</div>
          <div className="card-label">总字数</div>
        </div>
      </div>

      <section className="dashboard-section">
        <h2>最近作品</h2>
        {stories.length === 0 ? (
          <p className="placeholder-hint">暂无作品，前往「作品」页面创建第一个故事</p>
        ) : (
          <ul className="story-list">
            {stories.slice(0, 5).map((s) => (
              <li key={s.id}>
                <span>{s.title}</span>
                <span className="story-meta">{s.updated_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default DashboardPage;
