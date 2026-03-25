import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTiers } from '../../hooks/useTiers';
import { fetchProfile } from '../../api/profile';
import { fetchLogStats, fetchUserLogs, fetchCalendarData } from '../../api/completionLog';
import { fetchTodayWorkout } from '../../api/routine';
import { fetchTodayNutrition } from '../../api/nutrition';
import { fetchNutritionProfile } from '../../api/nutritionProfile';
import { createMealLog, fetchMealLogs } from '../../api/mealLog';
import { hasTierAccess, getEffectiveTier } from '../../utils/tiers';
import TrialBanner from '../../components/TrialBanner';
import './portal-dashboard.css';

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

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1; // Mon-first
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

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function tierClass(tier) {
  if (!tier) return 'pup';
  const t = tier.toLowerCase();
  if (t.includes('iron')) return 'iron-dassie';
  if (t.includes('runner') || t.includes('rock')) return 'rock-runner';
  return 'pup';
}

function formatDate(iso) {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function PortalDashboard() {
  const { user, getIdToken } = useAuth();
  const { tiers } = useTiers();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activityStats, setActivityStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [calendarData, setCalendarData] = useState({});
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [todayNutrition, setTodayNutrition] = useState(null);
  const [hasNutritionProfile, setHasNutritionProfile] = useState(false);
  const [dashMealLogged, setDashMealLogged] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const token = await getIdToken();
        if (token) {
          const result = await fetchProfile(token);
          if (!cancelled) setProfile(result);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => { cancelled = true; };
  }, [getIdToken]);

  // Load activity/progress data for tier II+ users
  useEffect(() => {
    if (loading || !profile) return;
    if (!hasTierAccess(getEffectiveTier(profile), 'Rock Runner')) return;

    let cancelled = false;
    const now = new Date();

    (async () => {
      try {
        const token = await getIdToken();
        const fetches = [
          fetchLogStats(token),
          fetchUserLogs({ limit: 3 }, token),
          fetchCalendarData(now.getFullYear(), now.getMonth() + 1, token),
          fetchTodayWorkout(token).catch(() => null),
        ];
        // Iron Dassie: also fetch nutrition data
        const isIronDassie = hasTierAccess(getEffectiveTier(profile), 'Iron Dassie');
        if (isIronDassie) {
          fetches.push(
            fetchTodayNutrition(token).catch(() => null),
            fetchNutritionProfile(token).catch(() => null),
          );
        }
        const results = await Promise.all(fetches);
        const [statsData, logsData, calData, todayData] = results;
        if (!cancelled) {
          setActivityStats(statsData);
          const logs = Array.isArray(logsData) ? logsData : logsData?.logs || [];
          setRecentLogs(logs.slice(0, 3));
          setCalendarData(calData || {});
          if (todayData && !todayData.error) setTodayWorkout(todayData);
          if (isIronDassie) {
            const nutData = results[4];
            const nutProfile = results[5];
            if (nutData && !nutData.error) {
              setTodayNutrition(nutData);
              // Load today's meal logs
              try {
                const mealLogsResult = await fetchMealLogs({ date: nutData.date }, token);
                if (!cancelled && mealLogsResult?.logs) {
                  const logged = new Set();
                  mealLogsResult.logs.forEach((log) => {
                    if (log.source === 'plan' && log.mealNumber != null) logged.add(log.mealNumber);
                  });
                  setDashMealLogged(logged);
                }
              } catch { /* best-effort */ }
            }
            if (nutProfile?.nutritionProfile) setHasNutritionProfile(true);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard activity data:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [loading, profile, getIdToken]);

  // Check for pending upgrade from /programs page
  useEffect(() => {
    if (!loading && profile) {
      try {
        const pendingTier = localStorage.getItem('pendingUpgradeTier');
        if (pendingTier) {
          localStorage.removeItem('pendingUpgradeTier');
          navigate(`/portal/subscription?upgradeTier=${pendingTier}`, { replace: true });
        }
      } catch { /* ignore localStorage errors */ }
    }
  }, [loading, profile, navigate]);

  // Get display name from profile or user object
  const givenName = profile?.givenName || user?.signInDetails?.loginId?.split('@')[0] || '';
  const familyName = profile?.familyName || '';
  const fullName = [givenName, familyName].filter(Boolean).join(' ') || 'Member';
  const initial = (givenName || fullName || '?')[0].toUpperCase();
  const email = profile?.email || user?.signInDetails?.loginId || '';
  const tier = getEffectiveTier(profile);
  const memberSince = profile?.createdAt;

  const hasActivityAccess = hasTierAccess(tier, 'Rock Runner');

  // Mini calendar cells for current month
  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth() + 1;
  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, key: `empty-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = calendarData[dateStr] || 0;
      cells.push({ day: d, dateStr, count, key: dateStr });
    }
    return cells;
  }, [calYear, calMonth, calendarData]);

  // Find current tier data for logo and level
  const currentTierData = tiers.find((t) => t.name === tier);
  const maxTierLevel = tiers.length > 0 ? Math.max(...tiers.map((t) => t.level || 0)) : 3;
  const isMaxTier = currentTierData?.level >= maxTierLevel;

  if (loading) {
    return (
      <div>
        <div className="portal-header">
          <h1>Dashboard</h1>
          <p>Loading your profile...</p>
        </div>
        <div className="portal-skeleton">
          <div className="portal-skeleton-block" />
          <div className="portal-skeleton-block short" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="portal-header">
        <h1>Welcome back, {givenName || 'there'}!</h1>
        <p>Your Hyrax Fitness dashboard</p>
      </div>

      <TrialBanner />

      {/* Onboarding: Fitness Profile Prompt */}
      {hasActivityAccess && profile && !profile.fitnessProfile && (
        <div className="portal-card dashboard-onboarding-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: '1.8rem' }}>&#x1F4CB;</span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', fontSize: '.96rem', marginBottom: 4 }}>Set Up Your Fitness Profile</strong>
              <span style={{ fontSize: '.86rem', color: 'var(--rock)' }}>
                Complete a quick questionnaire to unlock personalized daily workouts.
              </span>
            </div>
            <Link to="/portal/questionnaire" className="btn primary small">Get Started</Link>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="portal-card">
        <div className="portal-profile-header">
          <div className="portal-avatar">{initial}</div>
          <div className="portal-identity">
            <h2>{fullName}</h2>
            <span className="portal-email">{email}</span>
            <div>
              <span className={`portal-tier ${tierClass(tier)}`}>{tier}</span>
            </div>
          </div>
          {/* Tier Logo Column */}
          <div className="portal-tier-logo-col">
            {currentTierData?.logoUrl && (
              <img
                src={currentTierData.logoUrl}
                alt={`${tier} logo`}
                className="portal-tier-logo"
              />
            )}
            {!isMaxTier && (
              <Link to="/portal/subscription" className="btn primary small portal-upgrade-btn">
                Upgrade
              </Link>
            )}
          </div>
        </div>

        <div className="portal-details">
          <div className="portal-detail-item">
            <label>Member Since</label>
            <span>{formatDate(memberSince)}</span>
          </div>
          <div className="portal-detail-item">
            <label>Current Tier</label>
            <span>{tier}</span>
          </div>
          <div className="portal-detail-item">
            <label>Email</label>
            <span>{email}</span>
          </div>
          <div className="portal-detail-item">
            <label>Name</label>
            <span>{fullName}</span>
          </div>
        </div>
      </div>

      {/* Today's AI Workout */}
      <div className="portal-card">
        <h3>{'\u{1F3CB}'} Today&rsquo;s Workout</h3>
        {hasActivityAccess ? (
          todayWorkout ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 10,
                  fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
                  background: todayWorkout.type === 'rest' ? 'rgba(27,18,10,.06)' : 'rgba(242,133,1,.12)',
                  color: todayWorkout.type === 'rest' ? 'var(--rock)' : 'var(--sunset)',
                }}>
                  {todayWorkout.type === 'rest' ? 'Rest Day' : todayWorkout.type === 'active_recovery' ? 'Recovery' : 'Training'}
                </span>
                {todayWorkout.duration && (
                  <span style={{ fontSize: '.82rem', color: 'var(--rock)' }}>{todayWorkout.duration}</span>
                )}
              </div>
              <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '.96rem' }}>{todayWorkout.title || 'Workout'}</p>
              {todayWorkout.exercises?.length > 0 && (
                <p style={{ margin: '0 0 12px', fontSize: '.84rem', color: 'var(--rock)' }}>
                  {todayWorkout.exercises.length} exercises
                  {todayWorkout.focus?.length > 0 ? ` \u00B7 ${todayWorkout.focus.map(t => t.replace(/[-_]/g, ' ')).join(', ')}` : ''}
                </p>
              )}
              <Link to="/portal/routine" className="dashboard-view-more">
                View Full Workout &rarr;
              </Link>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: '.88rem', color: 'var(--rock)' }}>
                No workout generated yet today. Let your digital training assistant create one for you.
              </p>
              <Link to="/portal/routine" className="dashboard-view-more">
                Generate Workout &rarr;
              </Link>
            </>
          )
        ) : (
          <div className="dashboard-locked-msg">
            <span>{'\u{1F512}'}</span>
            <span>Personalized routines are available with Rock Runner and above.</span>
            <Link to="/portal/subscription">Upgrade &rarr;</Link>
          </div>
        )}
      </div>

      {/* Today's Meal Plan — Iron Dassie only */}
      <div className="portal-card">
        <h3>{'\u{1F957}'} Today&rsquo;s Meal Plan</h3>
        {hasTierAccess(getEffectiveTier(profile), 'Iron Dassie') ? (
          !hasNutritionProfile ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: '.88rem', color: 'var(--rock)' }}>
                Complete your nutrition questionnaire to unlock personalized daily meal plans.
              </p>
              <Link to="/portal/nutrition-questionnaire" className="dashboard-view-more">
                Start Nutrition Questionnaire &rarr;
              </Link>
            </>
          ) : todayNutrition ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{
                  fontSize: '.78rem', fontWeight: 600, padding: '2px 10px',
                  borderRadius: 12,
                  background: todayNutrition.type === 'rest_day' ? 'rgba(27,18,10,.06)' : 'rgba(242,133,1,.12)',
                  color: todayNutrition.type === 'rest_day' ? 'var(--rock)' : 'var(--sunset)',
                }}>
                  {todayNutrition.type === 'rest_day' ? 'Rest Day' : todayNutrition.type === 'active_recovery' ? 'Recovery' : 'Training Day'}
                </span>
                {todayNutrition.totalCalories && (
                  <span style={{ fontSize: '.82rem', color: 'var(--rock)' }}>{todayNutrition.totalCalories} cal</span>
                )}
              </div>
              <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '.96rem' }}>{todayNutrition.title || 'Meal Plan'}</p>
              {todayNutrition.meals?.length > 0 && (
                <>
                  <div style={{ margin: '0 0 10px' }}>
                    <span style={{ fontSize: '.84rem', color: 'var(--rock)' }}>
                      {dashMealLogged.size}/{todayNutrition.meals.length} meals logged
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    {todayNutrition.meals.map((meal, idx) => (
                      <label key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: '.84rem', color: dashMealLogged.has(idx) ? '#2e7d32' : 'var(--ink)',
                        cursor: dashMealLogged.has(idx) ? 'default' : 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={dashMealLogged.has(idx)}
                          disabled={dashMealLogged.has(idx)}
                          onChange={async () => {
                            if (dashMealLogged.has(idx)) return;
                            try {
                              const token = await getIdToken();
                              await createMealLog({
                                source: 'plan',
                                planDate: todayNutrition.date,
                                mealNumber: idx,
                                mealName: meal.name || `Meal ${idx + 1}`,
                                items: meal.items || [],
                                calories: meal.calories || 0,
                                macros: meal.macros || null,
                              }, token);
                              setDashMealLogged((prev) => new Set([...prev, idx]));
                            } catch { /* best-effort */ }
                          }}
                          style={{ accentColor: 'var(--sunset)' }}
                        />
                        <span style={{ textDecoration: dashMealLogged.has(idx) ? 'line-through' : 'none' }}>
                          {meal.name || `Meal ${idx + 1}`}
                          {meal.calories ? ` (${meal.calories} cal)` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <Link to="/portal/nutrition" className="dashboard-view-more">
                View Full Plan &rarr;
              </Link>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: '.88rem', color: 'var(--rock)' }}>
                No meal plan generated yet today. Let your digital nutrition assistant create one for you.
              </p>
              <Link to="/portal/nutrition" className="dashboard-view-more">
                Generate Meal Plan &rarr;
              </Link>
            </>
          )
        ) : (
          <div className="dashboard-locked-msg">
            <span>{'\u{1F512}'}</span>
            <span>Personalized nutrition plans are available with Iron Dassie.</span>
            <Link to="/portal/subscription">Upgrade &rarr;</Link>
          </div>
        )}
      </div>

      {/* Activity Summary */}
      <div className="portal-card">
        <h3>{'\u{1F4CA}'} Activity</h3>
        {hasActivityAccess ? (
          <>
            <div className="dashboard-stats">
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{activityStats?.totalLogs || 0}</span>
                <span className="dashboard-stat-label">Total Logs</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{activityStats?.currentStreak || 0}</span>
                <span className="dashboard-stat-label">Day Streak</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{activityStats?.uniqueExercises || 0}</span>
                <span className="dashboard-stat-label">Unique Exercises</span>
              </div>
            </div>
            {recentLogs.length > 0 && (
              <ul className="dashboard-recent-list">
                {recentLogs.map((log) => (
                  <li key={log.id} className="dashboard-recent-item">
                    <span className="dashboard-recent-name">{log.exerciseName || 'Exercise'}</span>
                    <span className="dashboard-recent-detail">
                      {log.sets && log.reps ? `${log.sets}x${log.reps}` : ''}
                      {log.weight ? ` @ ${log.weight}${log.weightUnit || 'kg'}` : ''}
                    </span>
                    <span className="dashboard-recent-time">{timeAgo(log.completedAt || log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/portal/activity" className="dashboard-view-more">
              View All Activity &rarr;
            </Link>
          </>
        ) : (
          <div className="dashboard-locked-msg">
            <span>{'\u{1F512}'}</span>
            <span>Activity tracking is available with Rock Runner and above.</span>
            <Link to="/portal/subscription">Upgrade &rarr;</Link>
          </div>
        )}
      </div>

      {/* Progress Summary */}
      <div className="portal-card">
        <h3>{'\u{1F4C8}'} Progress</h3>
        {hasActivityAccess ? (
          <>
            <div className="dashboard-stats">
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{activityStats?.totalSessions || 0}</span>
                <span className="dashboard-stat-label">Total Workouts</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{activityStats?.totalLogs || 0}</span>
                <span className="dashboard-stat-label">Exercises Logged</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{activityStats?.currentStreak || 0}</span>
                <span className="dashboard-stat-label">Streak</span>
              </div>
            </div>
            <div className="dashboard-mini-calendar">
              {DAY_HEADERS.map((d, i) => (
                <div key={`h-${i}`} className="dashboard-cal-header">{d}</div>
              ))}
              {calendarCells.map((cell) => (
                <div key={cell.key} className="dashboard-cal-day">
                  {cell.day && (
                    <>
                      <span className="dashboard-cal-day-num">{cell.day}</span>
                      <span
                        className="dashboard-cal-dot"
                        style={{ backgroundColor: ACTIVITY_COLORS[getActivityLevel(cell.count)] }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            <Link to="/portal/progress" className="dashboard-view-more">
              View Full Progress &rarr;
            </Link>
          </>
        ) : (
          <div className="dashboard-locked-msg">
            <span>{'\u{1F512}'}</span>
            <span>Progress tracking is available with Rock Runner and above.</span>
            <Link to="/portal/subscription">Upgrade &rarr;</Link>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="portal-card">
        <h3>Quick Links</h3>
        <div className="portal-links">
          <Link to="/portal/workouts" className="portal-link">
            <span className="portal-link-icon">&#128170;</span>
            Workout Library
          </Link>
          <Link to="/portal/profile" className="portal-link">
            <span className="portal-link-icon">&#128100;</span>
            Edit Profile
          </Link>
          <Link to="/portal/subscription" className="portal-link">
            <span className="portal-link-icon">&#11088;</span>
            Manage Subscription
          </Link>
          <Link to="/portal/settings" className="portal-link">
            <span className="portal-link-icon">&#9881;</span>
            Settings
          </Link>
          <Link to="/portal/support" className="portal-link">
            <span className="portal-link-icon">&#127915;</span>
            Support
          </Link>
          <Link to="/faq" className="portal-link">
            <span className="portal-link-icon">&#10067;</span>
            FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
