/**
 * ui-component.tsx — React component that renders the sorted, streamed task list.
 *
 * This is a self-contained component. It receives scored tasks (which can be
 * streamed in progressively) and renders them with match percentage, reward,
 * and time-estimate filters.
 */

import React, { useState, useMemo, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskMatch {
  id: string;
  title: string;
  score: number;
  labels: string[];
  reward?: number;
  timeEstimate?: string;
  url?: string;
}

interface MatchmakingUIProps {
  /** Tasks streamed in progressively — component re-renders as new items arrive */
  tasks: TaskMatch[];
  /** Whether more tasks are still being computed / streamed */
  isLoading?: boolean;
  /** Called when user clicks a task (optional) */
  onSelectTask?: (task: TaskMatch) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MatchmakingUI: React.FC<MatchmakingUIProps> = ({
  tasks,
  isLoading = false,
  onSelectTask,
}) => {
  // Filters
  const [minReward, setMinReward] = useState<number>(0);
  const [maxReward, setMaxReward] = useState<number>(Infinity);
  const [minScore, setMinScore] = useState<number>(0);
  const [timeFilter, setTimeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (t.score < minScore) return false;
      if (t.reward !== undefined) {
        if (t.reward < minReward) return false;
        if (maxReward !== Infinity && t.reward > maxReward) return false;
      }
      if (timeFilter !== "all" && t.timeEstimate !== timeFilter) return false;
      return true;
    });
  }, [tasks, minScore, minReward, maxReward, timeFilter]);

  const handleSelect = useCallback(
    (task: TaskMatch) => {
      onSelectTask?.(task);
    },
    [onSelectTask],
  );

  return (
    <div className="matchmaking-ui">
      {/* Header */}
      <header className="matchmaking-header">
        <h2>🎯 Task Matches</h2>
        <p>
          {filtered.length} of {tasks.length} tasks
          {isLoading && " · Loading more…"}
        </p>
      </header>

      {/* Filters */}
      <div className="matchmaking-filters">
        <label>
          Min match %{" "}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(minScore * 100)}
            onChange={(e) => setMinScore(Number(e.target.value) / 100)}
          />
          <span>{Math.round(minScore * 100)}%</span>
        </label>

        <label>
          Min reward{" "}
          <input
            type="number"
            min={0}
            step={50}
            value={minReward || ""}
            placeholder="$0"
            onChange={(e) => setMinReward(Number(e.target.value) || 0)}
          />
        </label>

        <label>
          Max reward{" "}
          <input
            type="number"
            min={0}
            step={50}
            value={maxReward === Infinity ? "" : maxReward}
            placeholder="∞"
            onChange={(e) =>
              setMaxReward(Number(e.target.value) || Infinity)
            }
          />
        </label>

        <label>
          Time{" "}
          <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="< 1 hour">&lt; 1 hour</option>
            <option value="< 1 day">&lt; 1 day</option>
            <option value="< 1 week">&lt; 1 week</option>
          </select>
        </label>
      </div>

      {/* Task list — streamed */}
      <ul className="matchmaking-list">
        {filtered.map((task) => (
          <li
            key={task.id}
            className="matchmaking-item"
            onClick={() => handleSelect(task)}
            style={{
              padding: "12px 16px",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <div className="task-header" style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{task.title}</strong>
              <span
                className="match-score"
                style={{
                  fontWeight: 700,
                  color:
                    task.score >= 0.8
                      ? "#16a34a"
                      : task.score >= 0.5
                      ? "#d97706"
                      : "#6b7280",
                }}
              >
                {Math.round(task.score * 100)}%
              </span>
            </div>

            <div className="task-meta" style={{ marginTop: 4, fontSize: 14, color: "#666" }}>
              {task.reward !== undefined && <span>${task.reward} · </span>}
              {task.timeEstimate && <span>{task.timeEstimate} · </span>}
              {task.labels.map((l) => (
                <span
                  key={l}
                  style={{
                    background: "#f3f4f6",
                    padding: "2px 6px",
                    borderRadius: 4,
                    marginRight: 4,
                    fontSize: 12,
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* Loading indicator */}
      {isLoading && (
        <div className="matchmaking-loading" style={{ textAlign: "center", padding: 16 }}>
          <span>⏳ Streaming matches…</span>
        </div>
      )}
    </div>
  );
};

export default MatchmakingUI;
