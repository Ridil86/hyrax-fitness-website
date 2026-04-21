import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchNutritionProfile } from '../../api/nutritionProfile';
import { generateDailyNutrition, fetchTodayNutrition } from '../../api/nutrition';
import { fetchProfile } from '../../api/profile';
import { hasTierAccess } from '../../utils/tiers';
import { createMealLog, fetchMealLogs } from '../../api/mealLog';
import TrialBanner from '../../components/TrialBanner';
import './my-nutrition.css';

/** Strip em-dashes and emojis from AI output */
function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013\u2012]/g, '-')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .trim();
}

export default function MyNutrition() {
  const { getIdToken, effectiveTier } = useAuth();
  const [fitnessProfile, setFitnessProfile] = useState(null);
  const [nutritionProfile, setNutritionProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [groceryChecked, setGroceryChecked] = useState({});
  // Meal logging state
  const [completedMeals, setCompletedMeals] = useState(new Set());
  const [loggingMeal, setLoggingMeal] = useState(null); // index of meal being logged
  const [mealLogForm, setMealLogForm] = useState({ modifications: '', rating: 0, notes: '' });
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [showAdhocForm, setShowAdhocForm] = useState(false);
  const [adhocForm, setAdhocForm] = useState({ name: '', items: [{ food: '', amount: '', calories: '' }], notes: '' });

  const hasAccess = hasTierAccess(effectiveTier, 'Iron Dassie');
  const [generatingSince, setGeneratingSince] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      setGeneratingSince(null);
      return undefined;
    }
    const start = generatingSince || Date.now();
    if (!generatingSince) setGeneratingSince(start);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [generating, generatingSince]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getIdToken();
        const [profileData, npData, todayData] = await Promise.all([
          fetchProfile(token).catch(() => null),
          fetchNutritionProfile(token).catch(() => null),
          fetchTodayNutrition(token).catch(() => null),
        ]);
        if (cancelled) return;
        if (profileData) setFitnessProfile(profileData);
        // Only set nutritionProfile if the actual profile data exists (not just the wrapper)
        const np = npData?.nutritionProfile;
        if (np && typeof np === 'object' && Object.keys(np).length > 0) {
          setNutritionProfile(np);
        }

        if (todayData?.status === 'generating') {
          setGenerating(true);
          // Plan is still being generated - poll via a fresh generate call
          try {
            const result = await fetchTodayNutritionPoll(token);
            if (!cancelled) { setPlan(result); setGenerating(false); }
          } catch {
            if (!cancelled) setGenerating(false);
          }
        } else if (todayData && !todayData.error && todayData.status !== 'not_found') {
          setPlan(todayData);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (hasAccess) load();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [getIdToken, hasAccess]);

  /** Poll for a generating plan until ready */
  async function fetchTodayNutritionPoll(token) {
    const MAX_POLLS = 60;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const result = await fetchTodayNutrition(token);
        if (result.status === 'generating') continue;
        if (result.status === 'error') throw new Error(result.error || 'Generation failed');
        return result;
      } catch (err) {
        if (err.status === 404) continue;
        throw err;
      }
    }
    throw new Error('Generation timed out. Please refresh.');
  }

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const token = await getIdToken();
      const result = await generateDailyNutrition(token, (status) => {
        if (status === 'generating') setGenerating(true);
      });
      setPlan(result);
    } catch (err) {
      setError(err.message || 'Failed to generate nutrition plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [getIdToken]);

  // Load today's meal logs to mark completed meals
  useEffect(() => {
    if (!plan?.date) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const result = await fetchMealLogs({ date: plan.date }, token);
        if (!cancelled && result?.logs) {
          const logged = new Set();
          result.logs.forEach((log) => {
            if (log.source === 'plan' && log.mealNumber != null) {
              logged.add(log.mealNumber);
            }
          });
          setCompletedMeals(logged);
        }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [plan?.date, getIdToken]);

  const handleLogMeal = async (mealIdx) => {
    const meal = plan?.meals?.[mealIdx];
    if (!meal) return;
    setLogSubmitting(true);
    try {
      const token = await getIdToken();
      await createMealLog({
        source: 'plan',
        planDate: plan.date,
        mealNumber: mealIdx,
        mealName: meal.name || `Meal ${mealIdx + 1}`,
        items: meal.items || [],
        calories: meal.calories || 0,
        macros: meal.macros || null,
        modifications: mealLogForm.modifications || null,
        rating: mealLogForm.rating || null,
        notes: mealLogForm.notes || '',
      }, token);
      setCompletedMeals((prev) => new Set([...prev, mealIdx]));
      setLoggingMeal(null);
      setMealLogForm({ modifications: '', rating: 0, notes: '' });
    } catch {
      setError('Failed to log meal. Please try again.');
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleLogAllRemaining = async () => {
    if (!plan?.meals) return;
    setLogSubmitting(true);
    try {
      const token = await getIdToken();
      const unlogged = plan.meals
        .map((meal, idx) => ({ meal, idx }))
        .filter(({ idx }) => !completedMeals.has(idx));
      if (unlogged.length === 0) return;
      const mealsPayload = unlogged.map(({ meal, idx }) => ({
        source: 'plan',
        planDate: plan.date,
        mealNumber: idx,
        mealName: meal.name || `Meal ${idx + 1}`,
        items: meal.items || [],
        calories: meal.calories || 0,
        macros: meal.macros || null,
      }));
      const { createMealPlanLog } = await import('../../api/mealLog');
      await createMealPlanLog({ planDate: plan.date, meals: mealsPayload }, token);
      const allIdxs = new Set([...completedMeals, ...unlogged.map(({ idx }) => idx)]);
      setCompletedMeals(allIdxs);
    } catch {
      setError('Failed to log meals.');
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleAdhocSubmit = async () => {
    if (!adhocForm.name.trim()) return;
    setLogSubmitting(true);
    try {
      const token = await getIdToken();
      const items = adhocForm.items.filter((i) => i.food.trim());
      const totalCal = items.reduce((sum, i) => sum + (parseInt(i.calories, 10) || 0), 0);
      await createMealLog({
        source: 'adhoc',
        planDate: plan?.date || new Date().toISOString().slice(0, 10),
        mealName: adhocForm.name,
        items: items.map((i) => ({ food: i.food, amount: i.amount, calories: parseInt(i.calories, 10) || 0 })),
        calories: totalCal,
        notes: adhocForm.notes || '',
      }, token);
      setShowAdhocForm(false);
      setAdhocForm({ name: '', items: [{ food: '', amount: '', calories: '' }], notes: '' });
    } catch {
      setError('Failed to log meal.');
    } finally {
      setLogSubmitting(false);
    }
  };

  const toggleMeal = (idx) => {
    setExpandedMeal(expandedMeal === idx ? null : idx);
  };

  const toggleGroceryItem = (idx) => {
    setGroceryChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Loading state
  if (loading) {
    return (
      <div className="nutrition-loading">
        <div className="section-spinner" />
        <p>Loading your nutrition plan...</p>
      </div>
    );
  }

  // Tier gate
  if (!hasAccess) {
    return (
      <div className="nutrition-page">
        <div className="admin-page-header">
          <h1>My Nutrition</h1>
          <p>Personalized daily nutrition plans</p>
        </div>
        <div className="nutrition-gate">
          <div className="nutrition-gate-icon">&#x1F512;</div>
          <h2>Upgrade to Unlock</h2>
          <p>Personalized nutrition plans are available exclusively for Iron Dassie members.</p>
          <Link to="/portal/subscription" className="btn primary">View Plans</Link>
        </div>
      </div>
    );
  }

  // Profile gate - need both fitness profile and nutrition profile
  if (!fitnessProfile) {
    return (
      <div className="nutrition-page">
        <div className="admin-page-header">
          <h1>My Nutrition</h1>
          <p>Personalized daily nutrition plans</p>
        </div>
        <TrialBanner compact featureName="Custom Nutrition" />
        <div className="nutrition-gate">
          <div className="nutrition-gate-icon">&#x1F4CB;</div>
          <h2>Complete Your Fitness Profile</h2>
          <p>Before we can generate personalized nutrition plans, we need to know about your goals and preferences.</p>
          <Link to="/portal/questionnaire" className="btn primary">Start Fitness Questionnaire</Link>
        </div>
      </div>
    );
  }

  if (!nutritionProfile) {
    return (
      <div className="nutrition-page">
        <div className="admin-page-header">
          <h1>My Nutrition</h1>
          <p>Personalized daily nutrition plans</p>
        </div>
        <TrialBanner compact featureName="Custom Nutrition" />
        <div className="nutrition-gate">
          <div className="nutrition-gate-icon">&#x1F957;</div>
          <h2>Complete Your Nutrition Profile</h2>
          <p>Tell us about your allergies, restrictions, calorie targets, and meal schedule so we can plan safely.</p>
          <Link to="/portal/nutrition-questionnaire" className="btn primary">Start Nutrition Questionnaire</Link>
        </div>
      </div>
    );
  }

  // Generating state
  if (generating && !plan) {
    const patience = elapsed >= 60
      ? 'Still working on it. This can take up to three minutes.'
      : 'Your personalized plan is being crafted tailored to your profile, goals, and today\u2019s activity level.';
    return (
      <div className="nutrition-page">
        <div className="admin-page-header">
          <h1>My Nutrition</h1>
          <p>Personalized daily nutrition plans</p>
        </div>
        <div className="nutrition-generating">
          <div className="nutrition-generating-spinner" />
          <h2>Generating your personalized nutrition plan... ({elapsed}s)</h2>
          <p>{patience}</p>
        </div>
      </div>
    );
  }

  // No plan generated yet today
  if (!plan) {
    return (
      <div className="nutrition-page">
        <div className="admin-page-header">
          <h1>My Nutrition</h1>
          <p>Personalized daily nutrition plans</p>
        </div>
        <div className="nutrition-generate-cta">
          <div className="nutrition-gate-icon">&#x1F372;</div>
          <h2>Ready for Today&rsquo;s Nutrition Plan?</h2>
          <p>Your digital nutrition assistant will create a personalized meal plan based on your profile, dietary preferences, and today&rsquo;s training schedule.</p>
          {error && <div className="nutrition-error">{error}</div>}
          <button
            className="btn primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Today\u2019s Nutrition Plan'}
          </button>
          {nutritionProfile && (
            <div className="nutrition-profile-summary">
              {nutritionProfile.mealsPerDay && <span><strong>Meals:</strong> {nutritionProfile.mealsPerDay}/day</span>}
              {nutritionProfile.caloricGoal && <span><strong>Calories:</strong> {nutritionProfile.caloricGoal}</span>}
              {nutritionProfile.dietaryRestrictions?.length > 0 && <span><strong>Diet:</strong> {nutritionProfile.dietaryRestrictions.join(', ')}</span>}
            </div>
          )}
          <Link to="/portal/nutrition-questionnaire" className="nutrition-edit-link">Edit Nutrition Profile</Link>
        </div>
      </div>
    );
  }

  // Error state for failed plan
  if (plan.status === 'error') {
    return (
      <div className="nutrition-page">
        <div className="admin-page-header">
          <h1>My Nutrition</h1>
          <p>Personalized daily nutrition plans</p>
        </div>
        <div className="nutrition-generate-cta">
          <div className="nutrition-gate-icon">&#x26A0;</div>
          <h2>Generation Failed</h2>
          <p>{plan.error || 'Something went wrong generating your nutrition plan.'}</p>
          <button
            className="btn primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // Display today's nutrition plan
  const meals = plan.meals || [];
  const macros = plan.macros || {};
  const totalCalories = plan.totalCalories || 0;
  const proteinPct = macros.protein && totalCalories ? Math.round((macros.protein * 4 / totalCalories) * 100) : 0;
  const carbsPct = macros.carbs && totalCalories ? Math.round((macros.carbs * 4 / totalCalories) * 100) : 0;
  const fatPct = macros.fat && totalCalories ? Math.round((macros.fat * 9 / totalCalories) * 100) : 0;

  const canRegenerate = (plan.generationCount || 1) < 2;

  return (
    <div className="nutrition-page">
      <div className="admin-page-header">
        <h1>My Nutrition</h1>
        <p>Personalized daily nutrition plans</p>
      </div>

      <TrialBanner compact featureName="Custom Nutrition" />

      {/* Header Card */}
      <div className="nutrition-card nutrition-header-card">
        <div className="nutrition-header-top">
          <div>
            <span className={`nutrition-type-badge ${(plan.type || 'training').replace(/\s+/g, '_')}`}>
              {plan.type === 'rest' || plan.type === 'rest_day'
                ? 'Rest Day'
                : plan.type === 'active_recovery'
                  ? 'Active Recovery'
                  : 'Training Day'}
            </span>
            <h2 className="nutrition-title">{sanitize(plan.title) || "Today's Nutrition Plan"}</h2>
          </div>
          <div className="nutrition-calorie-summary">
            <span className="nutrition-calorie-total">{totalCalories.toLocaleString()}</span>
            <span className="nutrition-calorie-label">calories</span>
          </div>
        </div>

        {/* Macro summary bar */}
        {totalCalories > 0 && (
          <div className="nutrition-macro-section">
            <div className="nutrition-macro-bar">
              {proteinPct > 0 && (
                <div className="nutrition-macro-segment protein" style={{ width: `${proteinPct}%` }} />
              )}
              {carbsPct > 0 && (
                <div className="nutrition-macro-segment carbs" style={{ width: `${carbsPct}%` }} />
              )}
              {fatPct > 0 && (
                <div className="nutrition-macro-segment fat" style={{ width: `${fatPct}%` }} />
              )}
            </div>
            <div className="nutrition-macro-legend">
              {macros.protein != null && (
                <span className="nutrition-macro-item protein">
                  <span className="nutrition-macro-dot protein" />
                  Protein: {macros.protein}g
                </span>
              )}
              {macros.carbs != null && (
                <span className="nutrition-macro-item carbs">
                  <span className="nutrition-macro-dot carbs" />
                  Carbs: {macros.carbs}g
                </span>
              )}
              {macros.fat != null && (
                <span className="nutrition-macro-item fat">
                  <span className="nutrition-macro-dot fat" />
                  Fat: {macros.fat}g
                </span>
              )}
            </div>
          </div>
        )}

        <div className="nutrition-header-meta">
          <span>{meals.length} meal{meals.length !== 1 ? 's' : ''}</span>
        </div>

        {canRegenerate && (
          <div className="nutrition-header-actions">
            <button
              className="btn small"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Regenerating...' : 'Regenerate Plan'}
            </button>
          </div>
        )}
      </div>

      {/* Meals Section */}
      {meals.length > 0 && (
        <div className="nutrition-card">
          <h3>Meals ({meals.length})</h3>
          <div className="nutrition-meal-list">
            {meals.map((meal, idx) => (
              <div
                key={idx}
                className={`nutrition-meal-card ${expandedMeal === idx ? 'expanded' : ''} ${completedMeals.has(idx) ? 'logged' : ''}`}
              >
                <button
                  type="button"
                  className="nutrition-meal-header"
                  onClick={() => toggleMeal(idx)}
                >
                  <span className="nutrition-meal-num">{idx + 1}</span>
                  <div className="nutrition-meal-info">
                    <span className="nutrition-meal-name">
                      {sanitize(meal.name) || `Meal ${idx + 1}`}
                    </span>
                    <span className="nutrition-meal-meta">
                      {meal.time && <span>{meal.time}</span>}
                      {meal.calories && <span>{meal.calories} cal</span>}
                      {meal.timing && meal.timing !== 'null' && <span className="nutrition-timing-tag">{meal.timing}</span>}
                    </span>
                  </div>
                  {completedMeals.has(idx) && <span className="meal-logged-badge" title="Logged">&#x2705;</span>}
                  <span className="nutrition-meal-chevron">{expandedMeal === idx ? '\u25B2' : '\u25BC'}</span>
                </button>

                {expandedMeal === idx && (
                  <div className="nutrition-meal-details">
                    {/* Items list */}
                    {meal.items?.length > 0 && (
                      <div className="nutrition-items-list">
                        {meal.items.map((item, iIdx) => (
                          <div key={iIdx} className="nutrition-item">
                            <span className="nutrition-item-name">{sanitize(item.name) || item.food}</span>
                            <span className="nutrition-item-amount">{item.amount}</span>
                            {item.calories && <span className="nutrition-item-cal">{item.calories} cal</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meal macros */}
                    {meal.macros && (
                      <div className="nutrition-meal-macros">
                        {meal.macros.protein != null && <span>P: {meal.macros.protein}g</span>}
                        {meal.macros.carbs != null && <span>C: {meal.macros.carbs}g</span>}
                        {meal.macros.fat != null && <span>F: {meal.macros.fat}g</span>}
                      </div>
                    )}

                    {/* Prep notes */}
                    {meal.prepNotes && (
                      <p className="nutrition-prep-notes">{sanitize(meal.prepNotes)}</p>
                    )}

                    {/* Log meal action */}
                    {!completedMeals.has(idx) ? (
                      loggingMeal === idx ? (
                        <div className="meal-log-form">
                          <textarea
                            placeholder="Any modifications? (optional)"
                            value={mealLogForm.modifications}
                            onChange={(e) => setMealLogForm((f) => ({ ...f, modifications: e.target.value }))}
                            rows={2}
                          />
                          <div className="meal-log-rating">
                            <span>Rating:</span>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                className={`meal-rating-star ${mealLogForm.rating >= star ? 'active' : ''}`}
                                onClick={() => setMealLogForm((f) => ({ ...f, rating: star }))}
                              >&#9733;</button>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Notes (optional)"
                            value={mealLogForm.notes}
                            onChange={(e) => setMealLogForm((f) => ({ ...f, notes: e.target.value }))}
                          />
                          <div className="meal-log-actions">
                            <button className="btn primary btn-sm" onClick={() => handleLogMeal(idx)} disabled={logSubmitting}>
                              {logSubmitting ? 'Logging...' : 'Log Meal'}
                            </button>
                            <button className="btn secondary btn-sm" onClick={() => { setLoggingMeal(null); setMealLogForm({ modifications: '', rating: 0, notes: '' }); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn secondary btn-sm meal-log-btn" onClick={(e) => { e.stopPropagation(); setLoggingMeal(idx); }}>
                          Log This Meal
                        </button>
                      )
                    ) : (
                      <div className="meal-logged-msg">Meal logged</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Log all remaining + Ad-hoc meal */}
          <div className="meal-log-footer">
            {plan.meals && completedMeals.size < plan.meals.length && (
              <button className="btn secondary btn-sm" onClick={handleLogAllRemaining} disabled={logSubmitting}>
                {logSubmitting ? 'Logging...' : `Log All Remaining (${plan.meals.length - completedMeals.size})`}
              </button>
            )}
            <button className="btn secondary btn-sm" onClick={() => setShowAdhocForm(!showAdhocForm)}>
              {showAdhocForm ? 'Cancel' : 'Log Unplanned Meal'}
            </button>
          </div>

          {/* Ad-hoc meal form */}
          {showAdhocForm && (
            <div className="adhoc-meal-form">
              <h4>Log Unplanned Meal</h4>
              <input
                type="text"
                placeholder="Meal name (e.g., Afternoon Snack)"
                value={adhocForm.name}
                onChange={(e) => setAdhocForm((f) => ({ ...f, name: e.target.value }))}
              />
              {adhocForm.items.map((item, iIdx) => (
                <div key={iIdx} className="adhoc-item-row">
                  <input
                    type="text"
                    placeholder="Food item"
                    value={item.food}
                    onChange={(e) => {
                      const items = [...adhocForm.items];
                      items[iIdx] = { ...items[iIdx], food: e.target.value };
                      setAdhocForm((f) => ({ ...f, items }));
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => {
                      const items = [...adhocForm.items];
                      items[iIdx] = { ...items[iIdx], amount: e.target.value };
                      setAdhocForm((f) => ({ ...f, items }));
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Cal"
                    value={item.calories}
                    onChange={(e) => {
                      const items = [...adhocForm.items];
                      items[iIdx] = { ...items[iIdx], calories: e.target.value };
                      setAdhocForm((f) => ({ ...f, items }));
                    }}
                  />
                  {adhocForm.items.length > 1 && (
                    <button type="button" className="adhoc-remove-btn" onClick={() => {
                      setAdhocForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== iIdx) }));
                    }}>&times;</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn secondary btn-sm" onClick={() => {
                setAdhocForm((f) => ({ ...f, items: [...f.items, { food: '', amount: '', calories: '' }] }));
              }}>+ Add Item</button>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={adhocForm.notes}
                onChange={(e) => setAdhocForm((f) => ({ ...f, notes: e.target.value }))}
                style={{ marginTop: 8 }}
              />
              <button className="btn primary btn-sm" onClick={handleAdhocSubmit} disabled={logSubmitting || !adhocForm.name.trim()} style={{ marginTop: 8 }}>
                {logSubmitting ? 'Logging...' : 'Log Meal'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hydration Card */}
      {plan.hydration && (
        <div className="nutrition-card nutrition-hydration-card">
          <h3>Hydration</h3>
          {plan.hydration.target && (
            <p className="nutrition-hydration-target">{sanitize(plan.hydration.target)}</p>
          )}
          {plan.hydration.notes && (
            <p className="nutrition-hydration-notes">{sanitize(plan.hydration.notes)}</p>
          )}
        </div>
      )}

      {/* Supplements Card */}
      {plan.supplements?.length > 0 && (
        <div className="nutrition-card nutrition-supplements-card">
          <h3>Supplements</h3>
          <div className="nutrition-supplements-list">
            {plan.supplements.map((supp, idx) => (
              <div key={idx} className="nutrition-supplement-item">
                <span className="nutrition-supplement-name">{sanitize(supp.name)}</span>
                {supp.dosage && <span className="nutrition-supplement-dosage">{supp.dosage}</span>}
                {supp.timing && supp.timing !== 'null' && <span className="nutrition-supplement-timing">{supp.timing}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coaching Notes Card */}
      {plan.coachingNotes && (
        <div className="nutrition-card">
          <h3>Coaching Notes</h3>
          <p className="nutrition-coaching-text">{sanitize(plan.coachingNotes)}</p>
        </div>
      )}

      {/* Grocery List Card */}
      {plan.groceryList?.length > 0 && (
        <div className="nutrition-card">
          <h3>Grocery List</h3>
          <div className="nutrition-grocery-list">
            {plan.groceryList.map((item, idx) => (
              <label key={idx} className="nutrition-grocery-item">
                <input
                  type="checkbox"
                  checked={!!groceryChecked[idx]}
                  onChange={() => toggleGroceryItem(idx)}
                />
                <span className={groceryChecked[idx] ? 'checked' : ''}>
                  {typeof item === 'string' ? item : sanitize(item.name)}
                  {item.amount ? ` - ${item.amount}` : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Progression + Tomorrow */}
      {(plan.progressionContext || plan.nextDayHint) && (
        <div className="nutrition-card nutrition-insights-card">
          {plan.progressionContext && (
            <div className="nutrition-insight">
              <strong>Progression</strong>
              <p>{sanitize(plan.progressionContext)}</p>
            </div>
          )}
          {plan.nextDayHint && (
            <div className="nutrition-insight">
              <strong>Tomorrow</strong>
              <p>{sanitize(plan.nextDayHint)}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer Links */}
      <div className="nutrition-footer">
        <Link to="/portal/nutrition/history" className="nutrition-footer-link">View Past Plans &rarr;</Link>
        <Link to="/portal/nutrition-questionnaire" className="nutrition-footer-link">Edit Nutrition Profile</Link>
      </div>
    </div>
  );
}
