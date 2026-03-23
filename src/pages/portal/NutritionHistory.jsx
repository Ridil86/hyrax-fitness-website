import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchNutritionHistory } from '../../api/nutrition';
import './my-nutrition.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function NutritionHistory() {
  const { getIdToken } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getIdToken();
        const data = await fetchNutritionHistory(token);
        if (!cancelled) {
          setPlans(data?.plans || data?.history || []);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getIdToken]);

  if (loading) {
    return (
      <div className="nutrition-loading">
        <div className="section-spinner" />
        <p>Loading history...</p>
      </div>
    );
  }

  return (
    <div className="nutrition-page">
      <div className="admin-page-header">
        <Link to="/portal/nutrition" style={{ fontSize: '.88rem', color: 'var(--rock)' }}>&larr; Back to My Nutrition</Link>
        <h1>Nutrition History</h1>
        <p>Your past AI-generated daily nutrition plans</p>
      </div>

      {plans.length === 0 ? (
        <div className="nutrition-gate nutrition-history-empty">
          <p>No nutrition history yet. Generate your first daily nutrition plan to get started!</p>
          <Link to="/portal/nutrition" className="btn primary">Go to My Nutrition</Link>
        </div>
      ) : (
        <div>
          {plans.map((plan, idx) => (
            <div key={plan.date || idx} className="nutrition-card nutrition-history-item">
              <button
                type="button"
                className="nutrition-history-header"
                onClick={() => setExpanded(expanded === idx ? null : idx)}
              >
                <span className={`nutrition-type-badge ${(plan.type || 'training').replace(/\s+/g, '_')}`}>
                  {plan.type === 'rest' || plan.type === 'rest_day'
                    ? 'Rest'
                    : plan.type === 'active_recovery'
                      ? 'Recovery'
                      : 'Train'}
                </span>
                <div className="nutrition-history-info">
                  <span className="nutrition-history-title">{plan.title || 'Nutrition Plan'}</span>
                  <span className="nutrition-history-meta">
                    {formatDate(plan.date)}
                    {plan.totalCalories ? ` \u00B7 ${plan.totalCalories} cal` : ''}
                    {plan.meals?.length ? ` \u00B7 ${plan.meals.length} meal${plan.meals.length !== 1 ? 's' : ''}` : ''}
                  </span>
                </div>
                <span className="nutrition-meal-chevron">{expanded === idx ? '\u25B2' : '\u25BC'}</span>
              </button>

              {expanded === idx && (
                <div className="nutrition-history-details">
                  {plan.meals?.map((meal, mIdx) => (
                    <div key={mIdx} className="nutrition-history-meal">
                      <span className="nutrition-history-meal-num">{mIdx + 1}</span>
                      <div>
                        <span className="nutrition-history-meal-name">{meal.name || `Meal ${mIdx + 1}`}</span>
                        {meal.calories && (
                          <span className="nutrition-history-meal-cal">{meal.calories} cal</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {plan.coachingNotes && (
                    <p style={{ margin: '10px 0 0', fontSize: '.84rem', color: 'var(--rock)', fontStyle: 'italic' }}>
                      {plan.coachingNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
