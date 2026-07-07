import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "habit-sheet-local-v2";

const seedHabits = [
  { id: "deep-work", name: "Deep work", area: "Focus", goal: 2, unit: "blocks", cadence: "Daily", archived: false },
  { id: "training", name: "Training", area: "Health", goal: 1, unit: "session", cadence: "Daily", archived: false },
  { id: "reading", name: "Reading", area: "Learning", goal: 30, unit: "min", cadence: "Daily", archived: false },
  { id: "planning", name: "Planning", area: "System", goal: 1, unit: "review", cadence: "Daily", archived: false }
];

function App() {
  const [store, setStore] = useLocalStore();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [query, setQuery] = useState("");
  const [selectedCell, setSelectedCell] = useState("A1");
  const [activeSheet, setActiveSheet] = useState("daily");

  const weekDays = useMemo(() => lastDays(7, selectedDate), [selectedDate]);
  const activeHabits = store.habits.filter(habit => !habit.archived);
  const archivedHabits = store.habits.filter(habit => habit.archived);
  const visibleHabits = activeHabits.filter(habit => {
    const text = `${habit.name} ${habit.area} ${habit.unit} ${habit.cadence}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const stats = useMemo(() => getDayStats(store, selectedDate), [store, selectedDate]);
  const currentStreak = useMemo(() => fullDayStreak(store), [store]);
  const monthDays = useMemo(() => monthMatrix(selectedDate), [selectedDate]);
  const heatDays = useMemo(() => lastDays(70, selectedDate), [selectedDate]);
  const title = {
    daily: "Daily tracker",
    monthly: "Monthly review",
    archive: "Archive",
    summary: "Summary"
  }[activeSheet];

  useEffect(() => {
    document.documentElement.dataset.theme = store.theme;
  }, [store.theme]);

  function updateStore(recipe) {
    setStore(current => {
      const next = structuredClone(current);
      recipe(next);
      return next;
    });
  }

  function updateHabit(habitId, field, rawValue) {
    updateStore(next => {
      const habit = next.habits.find(item => item.id === habitId);
      if (!habit) return;
      if (field === "goal") {
        habit.goal = clamp(Number(rawValue), 1, 999);
      } else {
        habit[field] = rawValue;
      }
    });
  }

  function setProgress(day, habitId, rawValue) {
    updateStore(next => {
      const habit = next.habits.find(item => item.id === habitId);
      const value = clamp(Number(rawValue), 0, habit?.goal || 999);
      next.entries[day] ||= {};
      if (value <= 0) {
        delete next.entries[day][habitId];
      } else {
        next.entries[day][habitId] = value;
      }
    });
  }

  function toggleComplete(day, habit) {
    const progress = getProgress(store, day, habit.id);
    setProgress(day, habit.id, progress >= habit.goal ? 0 : habit.goal);
  }

  function addHabit() {
    updateStore(next => {
      next.habits.push({
        id: crypto.randomUUID(),
        name: "New habit",
        area: "Personal",
        goal: 1,
        unit: "time",
        cadence: "Daily",
        archived: false
      });
    });
    setActiveSheet("daily");
  }

  function deleteHabit(habitId) {
    updateStore(next => {
      next.habits = next.habits.filter(habit => habit.id !== habitId);
      Object.values(next.entries).forEach(day => delete day[habitId]);
    });
  }

  function archiveHabit(habitId) {
    updateStore(next => {
      const habit = next.habits.find(item => item.id === habitId);
      if (habit) {
        habit.archived = true;
        habit.archivedAt = todayKey();
      }
    });
  }

  function restoreHabit(habitId) {
    updateStore(next => {
      const habit = next.habits.find(item => item.id === habitId);
      if (habit) {
        habit.archived = false;
        delete habit.archivedAt;
      }
    });
  }

  return (
    <div className="sheet-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="sheet-logo" aria-hidden="true"></div>
          <div>
            <strong>Habit Sheet</strong>
            <span>Saved locally</span>
          </div>
        </div>

        <nav className="sheet-tabs" aria-label="Workbook sheets">
          {[
            ["daily", "Daily tracker"],
            ["monthly", "Monthly review"],
            ["summary", "Summary"],
            ["archive", "Archive"]
          ].map(([key, label]) => (
            <button
              className={activeSheet === key ? "active" : ""}
              type="button"
              key={key}
              onClick={() => setActiveSheet(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="side-card">
          <span>Today</span>
          <strong>{stats.percent}%</strong>
          <small>{stats.done} of {activeHabits.length} habits complete</small>
          <ProgressRing value={stats.percent} />
        </div>

        <button
          className="theme-toggle"
          type="button"
          onClick={() => updateStore(next => {
            next.theme = next.theme === "dark" ? "light" : "dark";
          })}
        >
          {store.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {store.theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </aside>

      <main className="workbook">
        <header className="sheet-header">
          <div>
            <p>Private spreadsheet</p>
            <h1>{title}</h1>
          </div>
          <div className="header-tools">
            <label className="search">
              <Search size={15} />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find in sheet" />
            </label>
            <div className="date-stepper">
              <button type="button" onClick={() => setSelectedDate(offsetDate(selectedDate, -1))} aria-label="Previous day">
                <ChevronLeft size={15} />
              </button>
              <span>{selectedDate === todayKey() ? "Today" : shortDate(selectedDate)}</span>
              <button type="button" onClick={() => setSelectedDate(offsetDate(selectedDate, 1))} aria-label="Next day">
                <ChevronRight size={15} />
              </button>
            </div>
            <button className="primary-button" type="button" onClick={addHabit}>
              <Plus size={15} />
              New row
            </button>
          </div>
        </header>

        <section className="toolbar" aria-label="Spreadsheet toolbar">
          <button type="button" onClick={addHabit}><Plus size={14} /> Insert row</button>
          <button type="button" onClick={() => setSelectedDate(todayKey())}><CalendarDays size={14} /> Today</button>
          <button type="button" onClick={() => setActiveSheet("summary")}><BarChart3 size={14} /> Summary</button>
          <button type="button" onClick={() => setActiveSheet("monthly")}><CalendarDays size={14} /> Monthly review</button>
          <button type="button" onClick={() => setActiveSheet("archive")}><Archive size={14} /> Archive</button>
          <span className="toolbar-divider"></span>
          <strong>{selectedCell}</strong>
          <div className="formula-bar">=SHEET("{title}") + LOCAL_STORAGE("{STORAGE_KEY}")</div>
        </section>

        {activeSheet === "daily" && (
          <DailySheet
            habits={visibleHabits}
            store={store}
            weekDays={weekDays}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            setSelectedCell={setSelectedCell}
            updateHabit={updateHabit}
            setProgress={setProgress}
            toggleComplete={toggleComplete}
            archiveHabit={archiveHabit}
            deleteHabit={deleteHabit}
          />
        )}

        {activeSheet === "monthly" && (
          <MonthlyReviewSheet
            habits={activeHabits}
            store={store}
            selectedDate={selectedDate}
            setSelectedCell={setSelectedCell}
          />
        )}

        {activeSheet === "summary" && (
          <SummarySheet
            store={store}
            habits={activeHabits}
            selectedDate={selectedDate}
            currentStreak={currentStreak}
          />
        )}

        {activeSheet === "archive" && (
          <ArchiveSheet
            habits={archivedHabits}
            restoreHabit={restoreHabit}
            deleteHabit={deleteHabit}
          />
        )}

        <section className="bottom-panels">
          <div className="panel">
            <div className="panel-head">
              <span>Weekly chart</span>
              <strong>{average(weekDays.map(day => getDayStats(store, day).percent))}% avg</strong>
            </div>
            <BarChart days={weekDays} store={store} />
          </div>

          <div className="panel calendar-panel">
            <div className="panel-head">
              <span>{formatMonth(selectedDate)}</span>
              <strong>{currentStreak}d streak</strong>
            </div>
            <CalendarGrid days={monthDays} selectedDate={selectedDate} setSelectedDate={setSelectedDate} store={store} />
          </div>

          <div className="panel">
            <div className="panel-head">
              <span>Activity heatmap</span>
              <strong>70 days</strong>
            </div>
            <Heatmap days={heatDays} store={store} />
          </div>
        </section>
      </main>
    </div>
  );
}

function DailySheet({
  habits,
  store,
  weekDays,
  selectedDate,
  setSelectedDate,
  setSelectedCell,
  updateHabit,
  setProgress,
  toggleComplete,
  archiveHabit,
  deleteHabit
}) {
  return (
    <section className="sheet-shell">
      <div className="sheet-grid daily-grid">
        <div className="corner-cell"></div>
        {["Habit", "Area", "Goal", "Unit", "Cadence", ...weekDays.map(day => weekday(day)), "Streak", "Archive", "Delete"].map((label, index) => (
          <div className="column-letter" key={`${label}-${index}`}>
            {String.fromCharCode(65 + index)}
          </div>
        ))}

        <div className="row-number header-number">1</div>
        <div className="sheet-cell sheet-head">Habit</div>
        <div className="sheet-cell sheet-head">Area</div>
        <div className="sheet-cell sheet-head number">Goal</div>
        <div className="sheet-cell sheet-head">Unit</div>
        <div className="sheet-cell sheet-head">Cadence</div>
        {weekDays.map(day => (
          <div className={`sheet-cell sheet-head day-head ${day === selectedDate ? "selected-day" : ""}`} key={day}>
            <button type="button" onClick={() => setSelectedDate(day)}>
              <span>{weekday(day)}</span>
              <strong>{parseKey(day).getDate()}</strong>
            </button>
          </div>
        ))}
        <div className="sheet-cell sheet-head number">Streak</div>
        <div className="sheet-cell sheet-head action-head">Archive</div>
        <div className="sheet-cell sheet-head action-head">Delete</div>

        {habits.map((habit, rowIndex) => (
          <React.Fragment key={habit.id}>
            <div className="row-number">{rowIndex + 2}</div>
            <EditableCell
              cellId={`A${rowIndex + 2}`}
              value={habit.name}
              onFocus={setSelectedCell}
              onChange={value => updateHabit(habit.id, "name", value)}
            />
            <EditableCell
              cellId={`B${rowIndex + 2}`}
              value={habit.area}
              onFocus={setSelectedCell}
              onChange={value => updateHabit(habit.id, "area", value)}
            />
            <EditableCell
              cellId={`C${rowIndex + 2}`}
              value={habit.goal}
              type="number"
              className="number"
              onFocus={setSelectedCell}
              onChange={value => updateHabit(habit.id, "goal", value)}
            />
            <EditableCell
              cellId={`D${rowIndex + 2}`}
              value={habit.unit}
              onFocus={setSelectedCell}
              onChange={value => updateHabit(habit.id, "unit", value)}
            />
            <EditableCell
              cellId={`E${rowIndex + 2}`}
              value={habit.cadence}
              onFocus={setSelectedCell}
              onChange={value => updateHabit(habit.id, "cadence", value)}
            />
            {weekDays.map((day, dayIndex) => {
              const progress = getProgress(store, day, habit.id);
              const done = progress >= habit.goal;
              return (
                <div
                  className={`sheet-cell progress-cell ${done ? "done" : ""} ${day === selectedDate ? "active-column" : ""}`}
                  key={day}
                >
                  <button
                    type="button"
                    onClick={() => toggleComplete(day, habit)}
                    onFocus={() => setSelectedCell(`${String.fromCharCode(70 + dayIndex)}${rowIndex + 2}`)}
                    aria-label={`Toggle ${habit.name} on ${day}`}
                  >
                    {done ? <Check size={14} /> : null}
                  </button>
                  <input
                    value={progress}
                    onFocus={() => setSelectedCell(`${String.fromCharCode(70 + dayIndex)}${rowIndex + 2}`)}
                    onChange={event => setProgress(day, habit.id, event.target.value)}
                    type="number"
                    min="0"
                    max={habit.goal}
                    aria-label={`${habit.name} progress on ${day}`}
                  />
                </div>
              );
            })}
            <div className="sheet-cell number readonly">{habitStreak(store, habit.id)}d</div>
            <div className="sheet-cell action-cell">
              <button type="button" onClick={() => archiveHabit(habit.id)} aria-label={`Archive ${habit.name}`}>
                <Archive size={14} />
              </button>
            </div>
            <div className="sheet-cell action-cell">
              <button type="button" onClick={() => deleteHabit(habit.id)} aria-label={`Delete ${habit.name}`}>
                <Trash2 size={14} />
              </button>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function MonthlyReviewSheet({ habits, store, selectedDate, setSelectedCell }) {
  const days = daysInMonth(selectedDate);
  const columns = ["Habit", "Area", "Completed", "Total", "Rate", "Best streak", "Missed"];

  return (
    <section className="sheet-shell">
      <div className="sheet-grid review-grid">
        <div className="corner-cell"></div>
        {columns.map((label, index) => (
          <div className="column-letter" key={label}>{String.fromCharCode(65 + index)}</div>
        ))}

        <div className="row-number header-number">1</div>
        {columns.map(label => <div className="sheet-cell sheet-head" key={label}>{label}</div>)}

        {habits.map((habit, index) => {
          const completed = days.filter(day => getProgress(store, day, habit.id) >= habit.goal).length;
          const rate = Math.round((completed / days.length) * 100);
          const missed = days.length - completed;
          return (
            <React.Fragment key={habit.id}>
              <div className="row-number">{index + 2}</div>
              <ReadCell value={habit.name} onFocus={() => setSelectedCell(`A${index + 2}`)} />
              <ReadCell value={habit.area} onFocus={() => setSelectedCell(`B${index + 2}`)} />
              <ReadCell className="number" value={completed} onFocus={() => setSelectedCell(`C${index + 2}`)} />
              <ReadCell className="number" value={days.length} onFocus={() => setSelectedCell(`D${index + 2}`)} />
              <ReadCell className="number neon-text" value={`${rate}%`} onFocus={() => setSelectedCell(`E${index + 2}`)} />
              <ReadCell className="number" value={`${habitStreak(store, habit.id)}d`} onFocus={() => setSelectedCell(`F${index + 2}`)} />
              <ReadCell className="number" value={missed} onFocus={() => setSelectedCell(`G${index + 2}`)} />
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

function SummarySheet({ store, habits, selectedDate, currentStreak }) {
  const week = lastDays(7, selectedDate);
  const month = daysInMonth(selectedDate);
  const bestHabit = habits
    .map(habit => ({
      habit,
      score: month.filter(day => getProgress(store, day, habit.id) >= habit.goal).length
    }))
    .sort((a, b) => b.score - a.score)[0];
  const rows = [
    ["Active habits", habits.length],
    ["Archived habits", store.habits.filter(habit => habit.archived).length],
    ["Today completion", `${getDayStats(store, selectedDate).percent}%`],
    ["Weekly average", `${average(week.map(day => getDayStats(store, day).percent))}%`],
    ["Monthly average", `${average(month.map(day => getDayStats(store, day).percent))}%`],
    ["Current streak", `${currentStreak} days`],
    ["Best monthly habit", bestHabit ? `${bestHabit.habit.name} (${bestHabit.score}/${month.length})` : "None"]
  ];

  return (
    <section className="sheet-shell">
      <div className="sheet-grid summary-grid">
        <div className="corner-cell"></div>
        {["Metric", "Value", "Formula"].map((label, index) => (
          <div className="column-letter" key={label}>{String.fromCharCode(65 + index)}</div>
        ))}
        <div className="row-number header-number">1</div>
        <div className="sheet-cell sheet-head">Metric</div>
        <div className="sheet-cell sheet-head">Value</div>
        <div className="sheet-cell sheet-head">Formula</div>
        {rows.map(([metric, value], index) => (
          <React.Fragment key={metric}>
            <div className="row-number">{index + 2}</div>
            <ReadCell value={metric} />
            <ReadCell value={value} className="neon-text" />
            <ReadCell value={`=HABIT.${metric.toUpperCase().replaceAll(" ", "_")}()`} className="formula-cell" />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function ArchiveSheet({ habits, restoreHabit, deleteHabit }) {
  return (
    <section className="sheet-shell">
      <div className="sheet-grid archive-grid">
        <div className="corner-cell"></div>
        {["Habit", "Area", "Goal", "Unit", "Archived", "Restore", "Delete"].map((label, index) => (
          <div className="column-letter" key={label}>{String.fromCharCode(65 + index)}</div>
        ))}
        <div className="row-number header-number">1</div>
        {["Habit", "Area", "Goal", "Unit", "Archived", "Restore", "Delete"].map(label => (
          <div className="sheet-cell sheet-head" key={label}>{label}</div>
        ))}
        {habits.length === 0 ? (
          <>
            <div className="row-number">2</div>
            <div className="sheet-cell empty-row">No archived habits yet</div>
            <div className="sheet-cell"></div>
            <div className="sheet-cell"></div>
            <div className="sheet-cell"></div>
            <div className="sheet-cell"></div>
            <div className="sheet-cell"></div>
            <div className="sheet-cell"></div>
          </>
        ) : habits.map((habit, index) => (
          <React.Fragment key={habit.id}>
            <div className="row-number">{index + 2}</div>
            <ReadCell value={habit.name} />
            <ReadCell value={habit.area} />
            <ReadCell value={habit.goal} className="number" />
            <ReadCell value={habit.unit} />
            <ReadCell value={habit.archivedAt || "Unknown"} />
            <div className="sheet-cell action-cell">
              <button type="button" onClick={() => restoreHabit(habit.id)}>Restore</button>
            </div>
            <div className="sheet-cell action-cell">
              <button type="button" onClick={() => deleteHabit(habit.id)} aria-label={`Delete ${habit.name}`}>
                <Trash2 size={14} />
              </button>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function EditableCell({ cellId, value, onChange, onFocus, type = "text", className = "" }) {
  return (
    <div className={`sheet-cell editable ${className}`}>
      <input
        value={value}
        type={type}
        min={type === "number" ? "1" : undefined}
        onFocus={() => onFocus(cellId)}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

function ReadCell({ value, onFocus, className = "" }) {
  return (
    <div className={`sheet-cell readonly-cell ${className}`} tabIndex="0" onFocus={onFocus}>
      {value}
    </div>
  );
}

function BarChart({ days, store }) {
  return (
    <div className="bar-chart">
      {days.map(day => {
        const percent = getDayStats(store, day).percent;
        return (
          <div className="bar-column" key={day}>
            <div className="bar-track">
              <span style={{ height: `${Math.max(4, percent)}%` }}></span>
            </div>
            <small>{weekday(day)}</small>
          </div>
        );
      })}
    </div>
  );
}

function CalendarGrid({ days, selectedDate, setSelectedDate, store }) {
  return (
    <div className="calendar-grid">
      {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      {days.map(day => {
        const selected = day === selectedDate;
        const complete = getDayStats(store, day).percent === 100;
        const outside = day.slice(0, 7) !== selectedDate.slice(0, 7);
        return (
          <button
            className={`${selected ? "selected" : ""} ${complete ? "complete" : ""} ${outside ? "outside" : ""}`}
            type="button"
            key={day}
            onClick={() => setSelectedDate(day)}
          >
            {parseKey(day).getDate()}
          </button>
        );
      })}
    </div>
  );
}

function Heatmap({ days, store }) {
  return (
    <div className="heatmap">
      {days.map(day => {
        const level = Math.round(getDayStats(store, day).percent / 20);
        return <span className={`heat level-${level}`} title={`${day}: ${getDayStats(store, day).percent}%`} key={day}></span>;
      })}
    </div>
  );
}

function ProgressRing({ value }) {
  return (
    <div className="progress-ring" style={{ "--value": value }}>
      <span>{value}%</span>
    </div>
  );
}

function useLocalStore() {
  const [store, setStore] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.habits && saved?.entries) {
        return { ...saved, theme: saved.theme || "dark" };
      }
    } catch {
      return null;
    }
    return { habits: seedHabits, entries: {}, theme: "dark" };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  return [store, setStore];
}

function getDayStats(store, day) {
  const habits = store.habits.filter(habit => !habit.archived);
  const done = habits.filter(habit => getProgress(store, day, habit.id) >= habit.goal).length;
  const totalRatio = habits.reduce((sum, habit) => {
    return sum + Math.min(1, getProgress(store, day, habit.id) / habit.goal);
  }, 0);
  const percent = habits.length ? Math.round((totalRatio / habits.length) * 100) : 0;
  return { done, percent };
}

function getProgress(store, day, habitId) {
  return Number(store.entries[day]?.[habitId] || 0);
}

function habitStreak(store, habitId) {
  const habit = store.habits.find(item => item.id === habitId);
  if (!habit) return 0;
  let count = 0;
  let day = todayKey();
  while (getProgress(store, day, habitId) >= habit.goal) {
    count += 1;
    day = offsetDate(day, -1);
  }
  return count;
}

function fullDayStreak(store) {
  let count = 0;
  let day = todayKey();
  while (store.habits.length && getDayStats(store, day).percent === 100) {
    count += 1;
    day = offsetDate(day, -1);
  }
  return count;
}

function monthMatrix(dayKey) {
  const date = parseKey(dayKey);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toKey(day);
  });
}

function daysInMonth(dayKey) {
  const date = parseKey(dayKey);
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, index) => toKey(new Date(date.getFullYear(), date.getMonth(), index + 1)));
}

function lastDays(count, endDay) {
  return Array.from({ length: count }, (_, index) => offsetDate(endDay, index - count + 1));
}

function offsetDate(key, amount) {
  const date = parseKey(key);
  date.setDate(date.getDate() + amount);
  return toKey(date);
}

function todayKey() {
  return toKey(new Date());
}

function toKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shortDate(key) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseKey(key));
}

function formatMonth(key) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(parseKey(key));
}

function weekday(key) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(parseKey(key));
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

createRoot(document.getElementById("root")).render(<App />);
