import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchNutritionProfile, updateNutritionProfile } from '../../api/nutritionProfile';
import './nutrition-questionnaire.css';

const STEPS = [
  { id: 'allergies', label: 'Allergies', icon: '!' },
  { id: 'restrictions', label: 'Dietary', icon: '2' },
  { id: 'preferences', label: 'Foods', icon: '3' },
  { id: 'access', label: 'Access', icon: '4' },
  { id: 'schedule', label: 'Schedule', icon: '5' },
  { id: 'cooking', label: 'Cooking', icon: '6' },
  { id: 'goals', label: 'Goals', icon: '7' },
  { id: 'supplements', label: 'Supplements', icon: '8' },
];

const ALLERGENS = [
  'Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Soy', 'Wheat/Gluten',
  'Fish', 'Shellfish', 'Sesame', 'Corn', 'Nightshades',
];

const DIETARY_RESTRICTIONS = [
  'None', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher',
  'Keto', 'Paleo', 'Low-FODMAP', 'Carnivore', 'Gluten-Free', 'Dairy-Free',
];

const FOOD_ITEMS = [
  'Chicken', 'Beef', 'Pork', 'Fish', 'Eggs', 'Rice', 'Pasta', 'Beans',
  'Lentils', 'Tofu', 'Tempeh', 'Quinoa', 'Sweet Potato', 'Oats',
  'Greek Yogurt', 'Cheese', 'Avocado', 'Nuts', 'Berries', 'Leafy Greens',
];

const CUISINES = [
  'Mediterranean', 'Asian', 'Latin American', 'Indian',
  'Middle Eastern', 'African', 'American', 'European',
];

const FOOD_ACCESS_OPTIONS = [
  'Supermarket', 'Farmers Market', 'Health Food Store', 'Online Delivery', 'Limited/Rural',
];

const BUDGET_RANGES = [
  { value: 'very_budget', label: 'Very Budget', desc: '$30-50/wk' },
  { value: 'budget', label: 'Budget', desc: '$50-80/wk' },
  { value: 'moderate', label: 'Moderate', desc: '$80-120/wk' },
  { value: 'flexible', label: 'Flexible', desc: '$120+/wk' },
];

const SNACKING_OPTIONS = [
  { value: 'none', label: 'None', desc: 'No snacking' },
  { value: 'light', label: 'Light', desc: '1-2 snacks' },
  { value: 'moderate', label: 'Moderate', desc: '2-3 snacks' },
];

const COOKING_SKILLS = [
  { value: 'beginner', label: 'Beginner', desc: 'Basic meals only' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable with most recipes' },
  { value: 'advanced', label: 'Advanced', desc: 'Enjoy complex cooking' },
  { value: 'none', label: 'No Cooking', desc: 'Prefer ready meals or minimal prep' },
];

const COOKING_TIMES = [
  { value: 'under_15', label: 'Under 15 min', desc: 'Quick and simple' },
  { value: '15_30', label: '15-30 min', desc: 'Moderate prep' },
  { value: '30_60', label: '30-60 min', desc: 'Full meals' },
  { value: '60_plus', label: '60+ min', desc: 'Elaborate cooking' },
];

const KITCHEN_EQUIPMENT = [
  'Stove', 'Oven', 'Microwave', 'Blender',
  'Slow Cooker', 'Air Fryer', 'Grill', 'Instant Pot',
];

const CALORIC_GOALS = [
  { value: 'lose', label: 'Lose Weight', desc: 'Caloric deficit' },
  { value: 'maintain', label: 'Maintain Weight', desc: 'Stay where you are' },
  { value: 'gain', label: 'Gain Weight', desc: 'Caloric surplus' },
  { value: 'specific', label: 'Specific Target', desc: 'Enter exact calories' },
];

const MACRO_PREFERENCES = [
  { value: 'balanced', label: 'Balanced', desc: 'Even macro split' },
  { value: 'high_protein', label: 'High Protein', desc: 'Protein emphasis' },
  { value: 'high_carb', label: 'High Carb', desc: 'Carb emphasis' },
  { value: 'low_carb', label: 'Low Carb', desc: 'Reduced carbs' },
  { value: 'keto', label: 'Keto', desc: 'Very low carb, high fat' },
];

const SUPPLEMENT_OPTIONS = [
  'Protein Powder', 'Creatine', 'BCAAs', 'Multivitamin', 'Omega-3',
  'Vitamin D', 'Magnesium', 'Pre-workout', 'Collagen', 'None',
];

const CAFFEINE_OPTIONS = [
  { value: 'none', label: 'None', desc: 'No caffeine' },
  { value: 'light', label: 'Light', desc: '1-2 cups' },
  { value: 'moderate', label: 'Moderate', desc: '3-4 cups' },
  { value: 'heavy', label: 'Heavy', desc: '5+ cups' },
];

const DEFAULT_PROFILE = {
  // Step 1: Allergies
  allergies: [],
  otherAllergies: '',
  allergySeverity: 'severe',
  // Step 2: Dietary Restrictions
  dietaryRestrictions: [],
  // Step 3: Food Preferences
  foodLikes: [],
  foodDislikes: [],
  cuisinePreferences: [],
  // Step 4: Food Access & Budget
  foodAccess: [],
  budgetRange: '',
  regionalFoodNotes: '',
  // Step 5: Meal Schedule
  mealsPerDay: 3,
  mealTimes: '',
  snackingPreference: 'light',
  intermittentFasting: false,
  fastingWindow: '',
  // Step 6: Cooking
  cookingSkill: '',
  cookingTimePerMeal: '',
  kitchenEquipment: [],
  // Step 7: Goals & Macros
  caloricGoal: '',
  specificCalories: '',
  macroPreference: 'balanced',
  weight: '',
  weightUnit: 'lbs',
  height: '',
  // Step 8: Supplements & Hydration
  supplements: [],
  dailyWaterIntake: 2.5,
  caffeineConsumption: 'moderate',
};

export default function NutritionQuestionnaire() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getIdToken();
        const data = await fetchNutritionProfile(token);
        if (cancelled) return;
        if (data?.nutritionProfile) {
          setProfile({ ...DEFAULT_PROFILE, ...data.nutritionProfile });
          setIsEdit(true);
        }
      } catch {
        // first time — use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getIdToken]);

  const updateField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const toggleMulti = (field, value) => {
    setProfile((prev) => {
      const arr = prev[field] || [];
      const noneValues = ['None', 'none'];
      // If selecting a "none" value, clear others
      if (noneValues.includes(value)) {
        return { ...prev, [field]: arr.includes(value) ? [] : [value] };
      }
      // If current array has a "none" value and user picks something else, remove none
      const filtered = arr.filter((v) => !noneValues.includes(v));
      return {
        ...prev,
        [field]: filtered.includes(value)
          ? filtered.filter((v) => v !== value)
          : [...filtered, value],
      };
    });
    setMessage(null);
  };

  const canAdvance = () => {
    switch (step) {
      case 0: return !!profile.allergySeverity;
      case 1: return true;
      case 2: return true;
      case 3: return !!profile.budgetRange;
      case 4: return true;
      case 5: return !!profile.cookingSkill && !!profile.cookingTimePerMeal;
      case 6: return !!profile.caloricGoal;
      case 7: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = await getIdToken();
      const profileData = {
        ...profile,
        mealsPerDay: Number(profile.mealsPerDay),
        dailyWaterIntake: Number(profile.dailyWaterIntake),
        specificCalories: profile.specificCalories ? Number(profile.specificCalories) : '',
        weight: profile.weight ? Number(profile.weight) : '',
      };
      await updateNutritionProfile(token, { nutritionProfile: profileData });
      setMessage({ type: 'success', text: 'Nutrition profile saved!' });
      setTimeout(() => navigate('/portal/nutrition'), 1200);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="nq-loading">
        <div className="section-spinner" />
        <p>Loading questionnaire...</p>
      </div>
    );
  }

  const _currentStep = STEPS[step];

  return (
    <div className="nq-container">
      <div className="admin-page-header">
        <h1>{isEdit ? 'Edit' : ''} Nutrition Profile</h1>
        <p>Help us personalize your meal plans</p>
      </div>

      {/* Progress Bar */}
      <div className="nq-progress">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`nq-progress-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => i <= step && setStep(i)}
          >
            <div className="nq-progress-dot">{i < step ? '\u2713' : s.icon}</div>
            <span className="nq-progress-label">{s.label}</span>
          </div>
        ))}
      </div>

      {message && (
        <div className={`portal-profile-msg ${message.type}`}>{message.text}</div>
      )}

      <div className="nq-card">
        {/* Step 0: Allergies & Safety */}
        {step === 0 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Allergies &amp; Safety</h2>
              <p>Critical information for your safety</p>
            </div>

            <div className="nq-allergy-warning">
              <span className="nq-allergy-warning-icon">&#9888;</span>
              <div>
                <strong>Allergy information is critical for your safety.</strong>
                <p>Please list ALL allergies. This ensures your meal plans never include harmful ingredients.</p>
              </div>
            </div>

            <div className="nq-field">
              <label>Known Allergies <span className="nq-hint">(select all that apply)</span></label>
              <div className="nq-chips">
                <button
                  type="button"
                  className={`nq-chip nq-chip-none ${profile.allergies.length === 0 ? 'selected' : ''}`}
                  onClick={() => updateField('allergies', [])}
                >
                  None
                </button>
                {ALLERGENS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`nq-chip nq-chip-allergy ${profile.allergies.includes(a) ? 'selected' : ''}`}
                    onClick={() => {
                      setProfile((prev) => {
                        const arr = prev.allergies;
                        return {
                          ...prev,
                          allergies: arr.includes(a)
                            ? arr.filter((v) => v !== a)
                            : [...arr, a],
                        };
                      });
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Other Allergies <span className="nq-hint">(not listed above)</span></label>
              <input
                type="text"
                value={profile.otherAllergies}
                onChange={(e) => updateField('otherAllergies', e.target.value)}
                placeholder="e.g. Mustard, Celery, Lupin..."
                className="nq-input"
              />
            </div>

            <div className="nq-field">
              <label>Severity *</label>
              <div className="nq-option-cards">
                <button
                  type="button"
                  className={`nq-option-card nq-severity-severe ${profile.allergySeverity === 'severe' ? 'selected' : ''}`}
                  onClick={() => updateField('allergySeverity', 'severe')}
                >
                  <strong>Severe Allergy</strong>
                  <span>Anaphylaxis risk - strict avoidance required</span>
                </button>
                <button
                  type="button"
                  className={`nq-option-card nq-severity-mild ${profile.allergySeverity === 'mild' ? 'selected' : ''}`}
                  onClick={() => updateField('allergySeverity', 'mild')}
                >
                  <strong>Mild Intolerance</strong>
                  <span>Discomfort - prefer to avoid but not dangerous</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Dietary Restrictions */}
        {step === 1 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Dietary Restrictions</h2>
              <p>Any dietary patterns you follow</p>
            </div>

            <div className="nq-field">
              <label>Restrictions <span className="nq-hint">(select all that apply)</span></label>
              <div className="nq-chips">
                {DIETARY_RESTRICTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`nq-chip ${profile.dietaryRestrictions.includes(r) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('dietaryRestrictions', r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Food Preferences */}
        {step === 2 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Food Preferences</h2>
              <p>What you enjoy and what to avoid</p>
            </div>

            <div className="nq-field">
              <label>Foods You Enjoy <span className="nq-hint">(select all that apply)</span></label>
              <div className="nq-chips">
                {FOOD_ITEMS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`nq-chip ${profile.foodLikes.includes(f) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('foodLikes', f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Foods You Dislike <span className="nq-hint">(select any to avoid)</span></label>
              <div className="nq-chips">
                {FOOD_ITEMS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`nq-chip nq-chip-dislike ${profile.foodDislikes.includes(f) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('foodDislikes', f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Cuisine Preferences <span className="nq-hint">(select your favorites)</span></label>
              <div className="nq-chips">
                {CUISINES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`nq-chip ${profile.cuisinePreferences.includes(c) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('cuisinePreferences', c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Food Access & Budget */}
        {step === 3 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Food Access &amp; Budget</h2>
              <p>Help us recommend realistic meals</p>
            </div>

            <div className="nq-field">
              <label>Where do you shop? <span className="nq-hint">(select all that apply)</span></label>
              <div className="nq-chips">
                {FOOD_ACCESS_OPTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`nq-chip ${profile.foodAccess.includes(a) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('foodAccess', a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Weekly Food Budget *</label>
              <div className="nq-option-cards">
                {BUDGET_RANGES.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    className={`nq-option-card ${profile.budgetRange === b.value ? 'selected' : ''}`}
                    onClick={() => updateField('budgetRange', b.value)}
                  >
                    <strong>{b.label}</strong>
                    <span>{b.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Regional Food Notes <span className="nq-hint">(optional)</span></label>
              <input
                type="text"
                value={profile.regionalFoodNotes}
                onChange={(e) => updateField('regionalFoodNotes', e.target.value)}
                placeholder="e.g. South African staples, limited fresh produce in winter..."
                className="nq-input"
              />
            </div>
          </div>
        )}

        {/* Step 4: Meal Schedule */}
        {step === 4 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Meal Schedule</h2>
              <p>When and how often you eat</p>
            </div>

            <div className="nq-field">
              <label>Meals Per Day</label>
              <div className="nq-slider">
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={profile.mealsPerDay}
                  onChange={(e) => updateField('mealsPerDay', Number(e.target.value))}
                />
                <div className="nq-slider-value">{profile.mealsPerDay} meals/day</div>
              </div>
            </div>

            <div className="nq-field">
              <label>Preferred Meal Times <span className="nq-hint">(optional)</span></label>
              <input
                type="text"
                value={profile.mealTimes}
                onChange={(e) => updateField('mealTimes', e.target.value)}
                placeholder="e.g. 7am, 12pm, 6pm"
                className="nq-input"
              />
            </div>

            <div className="nq-field">
              <label>Snacking Preference</label>
              <div className="nq-option-cards">
                {SNACKING_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`nq-option-card ${profile.snackingPreference === s.value ? 'selected' : ''}`}
                    onClick={() => updateField('snackingPreference', s.value)}
                  >
                    <strong>{s.label}</strong>
                    <span>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label className="nq-checkbox-label">
                <input
                  type="checkbox"
                  checked={profile.intermittentFasting}
                  onChange={(e) => updateField('intermittentFasting', e.target.checked)}
                />
                I practice intermittent fasting
              </label>
            </div>

            {profile.intermittentFasting && (
              <div className="nq-field">
                <label>Fasting Window</label>
                <input
                  type="text"
                  value={profile.fastingWindow}
                  onChange={(e) => updateField('fastingWindow', e.target.value)}
                  placeholder="e.g. 16:8, 18:6, 20:4"
                  className="nq-input nq-input-short"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 5: Cooking Preferences */}
        {step === 5 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Cooking Preferences</h2>
              <p>Your skill level and available equipment</p>
            </div>

            <div className="nq-field">
              <label>Cooking Skill Level *</label>
              <div className="nq-option-cards">
                {COOKING_SKILLS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`nq-option-card ${profile.cookingSkill === s.value ? 'selected' : ''}`}
                    onClick={() => updateField('cookingSkill', s.value)}
                  >
                    <strong>{s.label}</strong>
                    <span>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Time Per Meal *</label>
              <div className="nq-option-cards">
                {COOKING_TIMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`nq-option-card ${profile.cookingTimePerMeal === t.value ? 'selected' : ''}`}
                    onClick={() => updateField('cookingTimePerMeal', t.value)}
                  >
                    <strong>{t.label}</strong>
                    <span>{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Kitchen Equipment <span className="nq-hint">(select all you have)</span></label>
              <div className="nq-equipment-grid">
                {KITCHEN_EQUIPMENT.map((eq) => (
                  <button
                    key={eq}
                    type="button"
                    className={`nq-equipment-item ${profile.kitchenEquipment.includes(eq) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('kitchenEquipment', eq)}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Goals & Macros */}
        {step === 6 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Goals &amp; Macros</h2>
              <p>Your nutritional targets</p>
            </div>

            <div className="nq-field">
              <label>Caloric Goal *</label>
              <div className="nq-option-cards">
                {CALORIC_GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`nq-option-card ${profile.caloricGoal === g.value ? 'selected' : ''}`}
                    onClick={() => updateField('caloricGoal', g.value)}
                  >
                    <strong>{g.label}</strong>
                    <span>{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {profile.caloricGoal === 'specific' && (
              <div className="nq-field">
                <label>Target Calories (kcal/day)</label>
                <input
                  type="number"
                  value={profile.specificCalories}
                  onChange={(e) => updateField('specificCalories', e.target.value)}
                  placeholder="e.g. 2200"
                  className="nq-input nq-input-short"
                  min={800}
                  max={6000}
                />
              </div>
            )}

            <div className="nq-field">
              <label>Macro Preference</label>
              <div className="nq-option-cards">
                {MACRO_PREFERENCES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`nq-option-card ${profile.macroPreference === m.value ? 'selected' : ''}`}
                    onClick={() => updateField('macroPreference', m.value)}
                  >
                    <strong>{m.label}</strong>
                    <span>{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field nq-inline-fields">
              <div>
                <label>Weight <span className="nq-hint">(optional)</span></label>
                <div className="nq-weight-row">
                  <input
                    type="number"
                    value={profile.weight}
                    onChange={(e) => updateField('weight', e.target.value)}
                    placeholder="e.g. 160"
                    className="nq-input nq-input-short"
                    min={30}
                    max={500}
                  />
                  <div className="nq-unit-toggle">
                    <button
                      type="button"
                      className={`nq-unit-btn ${profile.weightUnit === 'lbs' ? 'selected' : ''}`}
                      onClick={() => updateField('weightUnit', 'lbs')}
                    >
                      lbs
                    </button>
                    <button
                      type="button"
                      className={`nq-unit-btn ${profile.weightUnit === 'kg' ? 'selected' : ''}`}
                      onClick={() => updateField('weightUnit', 'kg')}
                    >
                      kg
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label>Height <span className="nq-hint">(optional)</span></label>
                <input
                  type="text"
                  value={profile.height}
                  onChange={(e) => updateField('height', e.target.value)}
                  placeholder="e.g. 5'10 or 178cm"
                  className="nq-input nq-input-short"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Supplements & Hydration */}
        {step === 7 && (
          <div className="nq-step-body">
            <div className="nq-step-header">
              <h2>Supplements &amp; Hydration</h2>
              <p>What you take and how much you drink</p>
            </div>

            <div className="nq-field">
              <label>Current Supplements <span className="nq-hint">(select all that apply)</span></label>
              <div className="nq-chips">
                {SUPPLEMENT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`nq-chip ${profile.supplements.includes(s) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('supplements', s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="nq-field">
              <label>Daily Water Intake</label>
              <div className="nq-slider">
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={profile.dailyWaterIntake}
                  onChange={(e) => updateField('dailyWaterIntake', Number(e.target.value))}
                />
                <div className="nq-slider-value">{profile.dailyWaterIntake}L / day</div>
              </div>
            </div>

            <div className="nq-field">
              <label>Caffeine Consumption</label>
              <div className="nq-option-cards">
                {CAFFEINE_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`nq-option-card ${profile.caffeineConsumption === c.value ? 'selected' : ''}`}
                    onClick={() => updateField('caffeineConsumption', c.value)}
                  >
                    <strong>{c.label}</strong>
                    <span>{c.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="nq-nav">
          {step > 0 && (
            <button type="button" className="btn" onClick={handleBack}>
              Back
            </button>
          )}
          <div className="nq-nav-right">
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn primary"
                onClick={handleNext}
                disabled={!canAdvance()}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn primary"
                onClick={handleSave}
                disabled={!canAdvance() || saving}
              >
                {saving ? 'Saving...' : isEdit ? 'Update Profile' : 'Save & Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
