import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchLogStats, fetchUserLogs, fetchExerciseHistory, fetchCalendarData } from '../../api/completionLog';
import { fetchProfile } from '../../api/profile';
import { hasTierAccess } from '../../utils/tiers';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import './progress-dashboard.css';
import './portal-dashboard.css';

// Register only needed Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getMonthName(month) {
  return new Date(2026, month - 1).toLocaleString('en-US', { month: 'long' });
}

function filterByTimeRange(data, range) {
  if (range === 'All' || !data.length) return data;
  const now = new Date();
  let cutoff;
  if (range === '1W') {
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === '1M') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (range === '3M') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  } else {
    return data;
  }
  return data.filter((d) => new Date(d.date || d.completedAt || d.createdAt) >= cutoff);
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month - 1, 1).getDay();
  // Convert Sunday=0 to Monday-first: Mon=0...Sun=6
  return day === 0 ? 6 : day - 1;
}

function getActivityLevel(count) {
  if (!count || count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}

const ACTIVITY_COLORS = [
  'transparent',
  'rgba(242,133,1,.2)',
  'rgba(242,133,1,.5)',
  'rgba(242,133,1,1)',
];

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_RANGES = ['1W', '1M', '3M', 'All'];

export default function ProgressDashboard() {
  const { getIdToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [timeRange, setTimeRange] = useState('3M');
  const [exerciseHistory, setExerciseHistory] = useState([]);
  const [calendarData, setCalendarData] = useState({});
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch profile for tier check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (token) {
          const result = await fetchProfile(token);
          if (!cancelled) setProfile(result);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getIdToken]);

  const locked = !profileLoading && !hasTierAccess(profile?.tier, 'Rock Runner');

  // Load stats + all logs on mount
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const [statsData, logsData] = await Promise.all([
        fetchLogStats(token),
        fetchUserLogs({ limit: 500 }, token),
      ]);
      setStats(statsData);
      const logs = Array.isArray(logsData) ? logsData : logsData?.logs || [];
      setAllLogs(logs);
    } catch (err) {
      console.error('Failed to load progress data:', err);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Fetch exercise history when selectedExercise changes
  useEffect(() => {
    if (!selectedExercise) {
      setExerciseHistory([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const data = await fetchExerciseHistory(selectedExercise, token);
        if (!cancelled) {
          setExerciseHistory(Array.isArray(data) ? data : data?.history || []);
        }
      } catch (err) {
        console.error('Failed to load exercise history:', err);
        if (!cancelled) setExerciseHistory([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedExercise, getIdToken]);

  // Fetch calendar data when year/month changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const data = await fetchCalendarData(calendarYear, calendarMonth, token);
        if (!cancelled) setCalendarData(data || {});
      } catch (err) {
        console.error('Failed to load calendar data:', err);
        if (!cancelled) setCalendarData({});
      }
    })();
    return () => { cancelled = true; };
  }, [calendarYear, calendarMonth, getIdToken]);

  // Compute unique exercises for dropdown
  const uniqueExercises = useMemo(() => {
    const map = {};
    allLogs.forEach((log) => {
      const id = log.exerciseId || log.exerciseName;
      if (id && !map[id]) {
        map[id] = { id, name: log.exerciseName || id };
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [allLogs]);

  // Compute "This Week" count
  const thisWeekCount = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return allLogs.filter((l) => new Date(l.completedAt || l.createdAt) >= weekAgo).length;
  }, [allLogs]);

  // Compute personal best (heaviest weight)
  const personalBest = useMemo(() => {
    let best = 0;
    allLogs.forEach((l) => {
      if (l.weight != null && l.weight > best) best = l.weight;
    });
    return best;
  }, [allLogs]);

  // Filter exercise history by time range
  const filteredHistory = useMemo(
    () => filterByTimeRange(exerciseHistory, timeRange),
    [exerciseHistory, timeRange]
  );

  // Chart data for weight progression
  const weightChartData = useMemo(() => ({
    labels: filteredHistory.map((h) => formatShortDate(h.date || h.completedAt)),
    datasets: [
      {
        label: 'Weight',
        data: filteredHistory.map((h) => h.weight || 0),
        borderColor: '#F28501',
        backgroundColor: 'rgba(242,133,1,.15)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#F28501',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }), [filteredHistory]);

  // Chart data for volume
  const volumeChartData = useMemo(() => ({
    labels: filteredHistory.map((h) => formatShortDate(h.date || h.completedAt)),
    datasets: [
      {
        label: 'Volume (sets x reps)',
        data: filteredHistory.map((h) => (h.sets || 0) * (h.reps || 0)),
        backgroundColor: 'rgba(242,133,1,.45)',
        borderColor: '#F28501',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }), [filteredHistory]);

  // Shared chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        grid: { color: 'rgba(27,18,10,.06)' },
        ticks: { color: '#A48051', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(27,18,10,.06)' },
        ticks: { color: '#A48051', font: { size: 11 } },
      },
    },
  }), []);

  // Calendar rendering
  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);

  const calendarCells = useMemo(() => {
    const cells = [];
    // Empty cells for offset
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, key: `empty-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = calendarData[dateStr] || 0;
      cells.push({ day: d, dateStr, count, key: dateStr });
    }
    return cells;
  }, [calendarYear, calendarMonth, daysInMonth, firstDay, calendarData]);

  // Recent activity feed (last 5 logs)
  const recentLogs = useMemo(
    () => [...allLogs].sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)).slice(0, 5),
    [allLogs]
  );

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  if (profileLoading) {
    return (
      <div className="progress-dashboard">
        <div className="progress-loading">
          <div className="section-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="progress-dashboard">
        <div className="progress-header">
          <h1>Progress Dashboard</h1>
        </div>
        <div className="portal-tier-gate">
          <span className="portal-tier-gate-icon">{'\u{1F512}'}</span>
          <h2>Upgrade to Rock Runner</h2>
          <p>View detailed progress charts, activity calendar, and exercise history with a Rock Runner or higher subscription.</p>
          <Link to="/portal/subscription" className="btn primary">Upgrade Account</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="progress-dashboard">
        <div className="progress-loading">
          <div className="section-spinner" />
          <p>Loading progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-dashboard">
      <div className="progress-header">
        <h1>Progress Dashboard</h1>
      </div>

      {/* Section 1 — Overview Stats */}
      <div className="progress-stats">
        <div className="progress-stat-card">
          <span className="progress-stat-value">{stats?.currentStreak || 0}</span>
          <span className="progress-stat-label">Current Streak</span>
        </div>
        <div className="progress-stat-card">
          <span className="progress-stat-value">{stats?.totalSessions || 0}</span>
          <span className="progress-stat-label">Total Workouts</span>
        </div>
        <div className="progress-stat-card">
          <span className="progress-stat-value">{stats?.totalLogs || 0}</span>
          <span className="progress-stat-label">Exercises Logged</span>
        </div>
        <div className="progress-stat-card">
          <span className="progress-stat-value">{thisWeekCount}</span>
          <span className="progress-stat-label">This Week</span>
        </div>
        <div className="progress-stat-card">
          <span className="progress-stat-value">{personalBest > 0 ? `${personalBest}` : '--'}</span>
          <span className="progress-stat-label">Personal Best</span>
        </div>
      </div>

      {/* Section 2 — Exercise Progress Charts */}
      <div className="progress-section">
        <h2 className="progress-section-title">Exercise Progress</h2>
        <div className="progress-filters">
          <select
            className="progress-exercise-select"
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            <option value="">Select an exercise...</option>
            {uniqueExercises.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
          <div className="progress-time-btns">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                className={`progress-time-btn ${timeRange === r ? 'progress-time-btn--active' : ''}`}
                onClick={() => setTimeRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {!selectedExercise ? (
          <div className="progress-chart-placeholder">
            <p>Select an exercise to view progress</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="progress-chart-placeholder">
            <p>No data yet for this exercise</p>
          </div>
        ) : (
          <div className="progress-charts">
            <div className="progress-chart-card">
              <h3>Weight Progression</h3>
              <div className="progress-chart-wrap">
                <Line data={weightChartData} options={chartOptions} />
              </div>
            </div>
            <div className="progress-chart-card">
              <h3>Volume</h3>
              <div className="progress-chart-wrap">
                <Bar data={volumeChartData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 3 — Activity Calendar */}
      <div className="progress-section">
        <h2 className="progress-section-title">Activity Calendar</h2>
        <div className="progress-calendar-nav">
          <button className="progress-cal-nav-btn" onClick={handlePrevMonth} aria-label="Previous month">&lt;</button>
          <span className="progress-cal-month-label">
            {getMonthName(calendarMonth)} {calendarYear}
          </span>
          <button className="progress-cal-nav-btn" onClick={handleNextMonth} aria-label="Next month">&gt;</button>
        </div>

        <div className="progress-calendar">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="progress-cal-header">{d}</div>
          ))}
          {calendarCells.map((cell) => (
            <div
              key={cell.key}
              className={`progress-cal-day ${cell.day ? '' : 'progress-cal-day--empty'}`}
              onMouseEnter={() => cell.day && setHoveredDay(cell.key)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {cell.day && (
                <>
                  <span className="progress-cal-day-num">{cell.day}</span>
                  <span
                    className="progress-cal-dot"
                    style={{ backgroundColor: ACTIVITY_COLORS[getActivityLevel(cell.count)] }}
                  />
                  {hoveredDay === cell.key && cell.count > 0 && (
                    <span className="progress-cal-tooltip">
                      {cell.count} {cell.count === 1 ? 'activity' : 'activities'}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Recent Activity Feed */}
        {recentLogs.length > 0 && (
          <div className="progress-recent">
            <h3 className="progress-recent-title">Recent Activity</h3>
            <ul className="progress-recent-list">
              {recentLogs.map((log) => (
                <li key={log.id} className="progress-recent-item">
                  <span className="progress-recent-name">{log.exerciseName || 'Exercise'}</span>
                  <span className="progress-recent-detail">
                    {log.sets && log.reps ? `${log.sets}x${log.reps}` : ''}
                    {log.weight ? ` @ ${log.weight}${log.weightUnit || 'kg'}` : ''}
                  </span>
                  <span className="progress-recent-time">{timeAgo(log.completedAt || log.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
