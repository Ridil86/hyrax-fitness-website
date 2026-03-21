import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchAnalyticsOverview, fetchAnalyticsTrends } from '../../api/adminAnalytics';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import './admin.css';
import './analytics.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = String(d.getFullYear()).slice(2);
  return `${month} '${year}`;
}

function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtCost(n) {
  if (!n) return '$0.00';
  return '$' + n.toFixed(4);
}

function costAlertClass(cost) {
  if (cost >= 100) return 'cost-alert-red';
  if (cost >= 50) return 'cost-alert-yellow';
  return '';
}

function AIRoutineSection({ stats, tierDistribution }) {
  const bc = stats.billingCycle || {};
  const daily = stats.dailyBreakdown || [];
  const topUsers = stats.topUsers || [];

  // Revenue estimate from tier distribution
  const tierDist = tierDistribution || {};
  const rockRunners = tierDist['Rock Runner'] || 0;
  const ironDassies = tierDist['Iron Dassie'] || 0;
  const estRevenue = rockRunners * 5 + ironDassies * 20;
  const estProfit = estRevenue - (bc.estimatedCostTotal || 0);

  // Daily token chart
  const tokenChartData = {
    labels: daily.map((d) => {
      const parts = d.date.split('-');
      return parts[1] + '/' + parts[2];
    }),
    datasets: [
      {
        label: 'Input Tokens',
        data: daily.map((d) => d.inputTokens),
        backgroundColor: 'rgba(242,133,1,.6)',
        borderRadius: 3,
      },
      {
        label: 'Output Tokens',
        data: daily.map((d) => d.outputTokens),
        backgroundColor: 'rgba(101,76,43,.5)',
        borderRadius: 3,
      },
    ],
  };

  const tokenChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#A48051', font: { size: 11 }, boxWidth: 12, padding: 12 } },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: 'rgba(27,18,10,.06)' },
        ticks: { color: '#A48051', font: { size: 10 }, maxRotation: 45 },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(27,18,10,.06)' },
        ticks: { color: '#A48051', font: { size: 10 }, callback: (v) => fmtTokens(v) },
      },
    },
  };

  const costPerGen = bc.generations > 0
    ? ((bc.estimatedCostTotal || 0) / bc.generations).toFixed(4)
    : '0.0000';

  return (
    <>
      <div className="analytics-chart-card">
        <h2 className="analytics-chart-title">AI Routine Generation</h2>

        {/* Row 1: Key Metrics */}
        <div className="admin-stats ai-stats-grid">
          <div className="admin-stat-card">
            <div className="stat-label">This Month</div>
            <div className="stat-value">{stats.thisMonthTotal}</div>
            <div className="stat-sub">generations</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">This Week</div>
            <div className="stat-value">{stats.thisWeekTotal}</div>
            <div className="stat-sub">generations</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Input Tokens</div>
            <div className="stat-value">{fmtTokens(stats.totalInputTokens)}</div>
            <div className="stat-sub">avg {fmtTokens(stats.avgInputTokensPerGen)}/gen</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Output Tokens</div>
            <div className="stat-value">{fmtTokens(stats.totalOutputTokens)}</div>
            <div className="stat-sub">avg {fmtTokens(stats.avgOutputTokensPerGen)}/gen</div>
          </div>
        </div>

        {/* Row 2: Billing Cycle Cost Estimator */}
        <div className={`ai-billing-card ${costAlertClass(bc.estimatedCostTotal || 0)}`}>
          <div className="ai-billing-header">
            <h3>Billing Cycle Cost Estimate</h3>
            <span className="ai-billing-period">
              {bc.startDate || 'N/A'} to {bc.endDate || 'N/A'}
            </span>
          </div>
          <div className="ai-billing-grid">
            <div className="ai-billing-item">
              <span className="ai-billing-label">Input</span>
              <span className="ai-billing-tokens">{fmtTokens(bc.inputTokens)} tokens</span>
              <span className="ai-billing-rate">@ $3/M</span>
              <span className="ai-billing-cost">{fmtCost(bc.estimatedCostInput)}</span>
            </div>
            <div className="ai-billing-item">
              <span className="ai-billing-label">Output</span>
              <span className="ai-billing-tokens">{fmtTokens(bc.outputTokens)} tokens</span>
              <span className="ai-billing-rate">@ $15/M</span>
              <span className="ai-billing-cost">{fmtCost(bc.estimatedCostOutput)}</span>
            </div>
            <div className="ai-billing-item ai-billing-total">
              <span className="ai-billing-label">Total API Cost</span>
              <span className="ai-billing-tokens">{bc.generations || 0} generations</span>
              <span className="ai-billing-rate">{fmtCost(Number(costPerGen))}/gen</span>
              <span className="ai-billing-cost ai-billing-cost-total">{fmtCost(bc.estimatedCostTotal)}</span>
            </div>
          </div>

          {/* Revenue vs Cost */}
          <div className="ai-revenue-row">
            <div className="ai-revenue-item">
              <span className="ai-revenue-label">Est. Monthly Revenue</span>
              <span className="ai-revenue-value">${estRevenue.toFixed(2)}</span>
              <span className="ai-revenue-detail">{rockRunners} Rock Runner + {ironDassies} Iron Dassie</span>
            </div>
            <div className="ai-revenue-item">
              <span className="ai-revenue-label">Est. AI Cost</span>
              <span className="ai-revenue-value">{fmtCost(bc.estimatedCostTotal)}</span>
            </div>
            <div className="ai-revenue-item">
              <span className="ai-revenue-label">Net Margin</span>
              <span className={`ai-revenue-value ${estProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                ${estProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Token Usage Chart */}
      {daily.length > 0 && (
        <div className="analytics-chart-card">
          <h2 className="analytics-chart-title">Daily Token Usage - Last 30 Days</h2>
          <div className="analytics-chart-wrap">
            <Bar data={tokenChartData} options={tokenChartOptions} />
          </div>
        </div>
      )}

      {/* Top Users by Token Usage */}
      {topUsers.length > 0 && (
        <div className="analytics-chart-card">
          <h2 className="analytics-chart-title">Top Users by Token Usage</h2>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Generations</th>
                <th>Input</th>
                <th>Output</th>
                <th>Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u, i) => (
                <tr key={u.userSub}>
                  <td><span className="analytics-rank">{i + 1}</span></td>
                  <td>{u.name || u.email}</td>
                  <td>{u.generations}</td>
                  <td>{fmtTokens(u.inputTokens)}</td>
                  <td>{fmtTokens(u.outputTokens)}</td>
                  <td>{fmtCost(u.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Analytics() {
  const { getIdToken } = useAuth();
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const [overviewResult, trendsResult] = await Promise.allSettled([
          fetchAnalyticsOverview(token),
          fetchAnalyticsTrends(token),
        ]);
        if (cancelled) return;
        if (overviewResult.status === 'fulfilled') {
          setOverview(overviewResult.value);
        }
        if (trendsResult.status === 'fulfilled') {
          setTrends(trendsResult.value || []);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getIdToken]);

  const avgPerUser = useMemo(() => {
    if (!overview || !overview.totalUsers) return '0.0';
    return (overview.thisMonthTotal / overview.totalUsers).toFixed(1);
  }, [overview]);

  // Line chart - daily activity
  const dailyChartData = useMemo(() => {
    const dailyStats = overview?.dailyStats || [];
    return {
      labels: dailyStats.map((d) => formatDateLabel(d.date)),
      datasets: [
        {
          label: 'Completions',
          data: dailyStats.map((d) => d.count),
          borderColor: '#F28501',
          backgroundColor: 'rgba(242,133,1,.12)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#F28501',
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [overview]);

  const dailyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        grid: { color: 'rgba(27,18,10,.06)' },
        ticks: { color: '#A48051', font: { size: 11 }, maxRotation: 45 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(27,18,10,.06)' },
        ticks: { color: '#A48051', font: { size: 11 }, precision: 0 },
      },
    },
  }), []);

  // Doughnut chart - tier distribution
  const tierChartData = useMemo(() => {
    const dist = overview?.tierDistribution || {};
    const labels = [];
    const data = [];
    const colors = [];
    const tierColors = {
      Pup: '#86efac',
      'Rock Runner': '#60a5fa',
      'Iron Dassie': '#fbbf24',
    };
    Object.entries(dist).forEach(([tier, count]) => {
      labels.push(tier);
      data.push(count);
      colors.push(tierColors[tier] || '#ccc');
    });
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  }, [overview]);

  const tierChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#A48051', font: { size: 12 }, padding: 16 },
      },
    },
  }), []);

  // Bar chart - monthly trends
  const trendsChartData = useMemo(() => ({
    labels: trends.map((t) => formatMonthLabel(t.month)),
    datasets: [
      {
        label: 'Completions',
        data: trends.map((t) => t.count),
        backgroundColor: 'rgba(242,133,1,.45)',
        borderColor: '#F28501',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }), [trends]);

  const trendsChartOptions = useMemo(() => ({
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
        ticks: { color: '#A48051', font: { size: 11 }, precision: 0 },
      },
    },
  }), []);

  if (loading) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>Analytics</h1>
          <p>Platform activity and engagement metrics</p>
        </div>
        <div className="analytics-loading">
          <div className="section-spinner" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  const topExercises = overview?.topExercises || [];
  const topWorkouts = overview?.topWorkouts || [];

  return (
    <div>
      <div className="admin-page-header">
        <h1>Analytics</h1>
        <p>Platform activity and engagement metrics</p>
      </div>

      {/* Section 1 - Overview Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="stat-label">All-Time Completions</div>
          <div className="stat-value">{overview?.allTimeTotal || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value">{overview?.thisMonthTotal || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">This Week</div>
          <div className="stat-value">{overview?.thisWeekTotal || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{overview?.totalUsers || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Avg Per User</div>
          <div className="stat-value">{avgPerUser}</div>
        </div>
      </div>

      {/* AI Routine Generation Stats */}
      {overview?.routineStats && <AIRoutineSection stats={overview.routineStats} tierDistribution={overview.tierDistribution} />}

      {/* Section 2 - Daily Activity Trend */}
      <div className="analytics-chart-card">
        <h2 className="analytics-chart-title">Daily Activity - Last 30 Days</h2>
        <div className="analytics-chart-wrap">
          <Line data={dailyChartData} options={dailyChartOptions} />
        </div>
      </div>

      {/* Section 3 - Popular Content */}
      <div className="analytics-charts">
        <div className="analytics-chart-card">
          <h2 className="analytics-chart-title">Top Exercises This Month</h2>
          {topExercises.length === 0 ? (
            <div className="analytics-empty">No exercise data yet</div>
          ) : (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Exercise</th>
                  <th>Completions</th>
                  <th>Total Sets</th>
                </tr>
              </thead>
              <tbody>
                {topExercises.slice(0, 10).map((ex, i) => (
                  <tr key={ex.name || i}>
                    <td><span className="analytics-rank">{i + 1}</span></td>
                    <td>{ex.name}</td>
                    <td>{ex.completions}</td>
                    <td>{ex.totalSets || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="analytics-chart-card">
          <h2 className="analytics-chart-title">Top Workouts This Month</h2>
          {topWorkouts.length === 0 ? (
            <div className="analytics-empty">No workout data yet</div>
          ) : (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Workout</th>
                  <th>Completions</th>
                </tr>
              </thead>
              <tbody>
                {topWorkouts.slice(0, 10).map((w, i) => (
                  <tr key={w.name || i}>
                    <td><span className="analytics-rank">{i + 1}</span></td>
                    <td>{w.name}</td>
                    <td>{w.completions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Section 4 - User Engagement */}
      <div className="analytics-charts">
        <div className="analytics-chart-card">
          <h2 className="analytics-chart-title">Subscription Distribution</h2>
          <div className="analytics-chart-wrap analytics-doughnut-wrap">
            <Doughnut data={tierChartData} options={tierChartOptions} />
          </div>
        </div>

        <div className="analytics-chart-card">
          <h2 className="analytics-chart-title">Monthly Trends - Last 12 Months</h2>
          <div className="analytics-chart-wrap">
            <Bar data={trendsChartData} options={trendsChartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
