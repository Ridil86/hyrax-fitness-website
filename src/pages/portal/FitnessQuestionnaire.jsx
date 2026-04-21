import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchFitnessProfile, updateFitnessProfile } from '../../api/fitnessProfile';
import { loadDraft, saveDraft, clearDraft } from '../../utils/questionnaireDraft';
import './fitness-questionnaire.css';

const STEPS = [
  { key: 'background', title: 'Fitness Background', subtitle: 'Tell us about your experience' },
  { key: 'schedule', title: 'Schedule & Availability', subtitle: 'When and how often do you train?' },
  { key: 'environment', title: 'Environment & Equipment', subtitle: 'Where and with what do you train?' },
  { key: 'location', title: 'Location & Conditions', subtitle: 'Help us adapt to your climate' },
  { key: 'health', title: 'Health & Limitations', subtitle: 'Safety first' },
  { key: 'preferences', title: 'Preferences', subtitle: 'Fine-tune your experience' },
];

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'New to structured fitness or returning after a long break' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Consistent training for 6+ months' },
  { value: 'advanced', label: 'Advanced', desc: '2+ years of structured training' },
  { value: 'elite', label: 'Elite', desc: 'Competitive athlete or 5+ years dedicated training' },
];

const GOALS = [
  { value: 'build_strength', label: 'Build Strength' },
  { value: 'lose_fat', label: 'Lose Fat' },
  { value: 'improve_endurance', label: 'Improve Endurance' },
  { value: 'increase_mobility', label: 'Increase Mobility' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'sport_performance', label: 'Sport Performance' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little to no regular exercise' },
  { value: 'lightly_active', label: 'Lightly Active', desc: 'Light exercise 1-2 days/week' },
  { value: 'moderately_active', label: 'Moderately Active', desc: 'Moderate exercise 3-4 days/week' },
  { value: 'very_active', label: 'Very Active', desc: 'Intense exercise 5+ days/week' },
];

const DURATIONS = ['15', '20', '25', '30', '35', '40', '45'];

const TIMES_OF_DAY = [
  { value: 'early_morning', label: 'Early Morning (5-7am)' },
  { value: 'morning', label: 'Morning (7-10am)' },
  { value: 'midday', label: 'Midday (11am-1pm)' },
  { value: 'afternoon', label: 'Afternoon (2-5pm)' },
  { value: 'evening', label: 'Evening (5-9pm)' },
];

const WORK_SCHEDULES = [
  { value: 'standard_9to5', label: 'Standard 9-to-5' },
  { value: 'shift_work', label: 'Shift Work' },
  { value: 'flexible', label: 'Flexible / Freelance' },
  { value: 'remote', label: 'Remote / Work From Home' },
  { value: 'student', label: 'Student' },
];

const ENVIRONMENTS = [
  { value: 'home', label: 'Home' },
  { value: 'gym', label: 'Gym' },
  { value: 'outdoors', label: 'Outdoors' },
];

const EQUIPMENT_OPTIONS = [
  { id: 'dumbbells', name: 'Dumbbells' },
  { id: 'kettlebells', name: 'Kettlebells' },
  { id: 'pull-up-bar', name: 'Pull-Up Bar' },
  { id: 'plyo-box', name: 'Plyo Box / Bench' },
  { id: 'sandbag', name: 'Sandbag' },
  { id: 'weight-vest', name: 'Weight Vest' },
  { id: 'weighted-sled', name: 'Weighted Sled' },
  { id: 'barbell-plates', name: 'Barbell + Plates' },
  { id: 'parallettes', name: 'Parallettes' },
  { id: 'gymnastics-rings', name: 'Gymnastics Rings' },
  { id: 'cones-markers', name: 'Cones / Markers' },
  { id: 'loaded-backpack', name: 'Loaded Backpack' },
  { id: 'foam-roller', name: 'Foam Roller' },
  { id: 'resistance-band', name: 'Resistance Band' },
];

const INDOOR_OUTDOOR = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'both', label: 'Both' },
];

const CLIMATES = [
  { value: 'hot_humid', label: 'Hot & Humid' },
  { value: 'hot_dry', label: 'Hot & Dry' },
  { value: 'temperate', label: 'Temperate' },
  { value: 'cold', label: 'Cold' },
  { value: 'variable', label: 'Variable / Seasonal' },
];

const LIMITATIONS = [
  { value: 'knee_issues', label: 'Knee Issues' },
  { value: 'back_issues', label: 'Back Issues' },
  { value: 'shoulder_issues', label: 'Shoulder Issues' },
  { value: 'wrist_issues', label: 'Wrist Issues' },
  { value: 'ankle_issues', label: 'Ankle Issues' },
  { value: 'heart_condition', label: 'Heart Condition' },
  { value: 'pregnancy', label: 'Pregnancy' },
  { value: 'none', label: 'None' },
];

const INTENSITIES = [
  { value: 'low', label: 'Low', desc: 'Easy pace, focus on movement quality' },
  { value: 'moderate', label: 'Moderate', desc: 'Challenging but sustainable' },
  { value: 'high', label: 'High', desc: 'Pushing limits regularly' },
  { value: 'very_high', label: 'Very High', desc: 'Maximum effort, competitive edge' },
];

const REST_PREFERENCES = [
  { value: 'every_other', label: 'Every Other Day', desc: 'Train, rest, train, rest' },
  { value: 'two_on_one_off', label: '2 On, 1 Off', desc: 'Two training days, one rest' },
  { value: 'flexible', label: 'Flexible', desc: 'Let the system decide based on recovery' },
];

const FOCUS_AREAS = [
  { value: 'upper_body', label: 'Upper Body' },
  { value: 'lower_body', label: 'Lower Body' },
  { value: 'core', label: 'Core' },
  { value: 'carries', label: 'Loaded Carries' },
  { value: 'agility', label: 'Agility & Speed' },
  { value: 'full_body', label: 'Full Body' },
];

const DEFAULT_PROFILE = {
  experienceLevel: '',
  fitnessGoals: [],
  currentActivityLevel: '',
  daysPerWeek: 3,
  preferredDuration: '30',
  preferredTimeOfDay: '',
  workSchedule: '',
  trainingEnvironment: [],
  availableEquipment: [],
  indoorOutdoorPreference: '',
  location: { region: '', climate: '' },
  hasOutdoorSpace: false,
  injuries: '',
  limitations: [],
  age: '',
  preferredIntensity: '',
  restDayPreference: '',
  focusAreas: [],
};

export default function FitnessQuestionnaire() {
  const { getIdToken, user } = useAuth();
  const navigate = useNavigate();
  const userKey = user?.username || user?.userId || 'anon';
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getIdToken();
        const data = await fetchFitnessProfile(token);
        if (cancelled) return;
        if (data?.fitnessProfile) {
          setProfile({ ...DEFAULT_PROFILE, ...data.fitnessProfile });
          setIsEdit(true);
        } else {
          const draft = loadDraft('fitness', userKey);
          if (draft?.profile) {
            setProfile({ ...DEFAULT_PROFILE, ...draft.profile });
            if (typeof draft.step === 'number') setStep(draft.step);
          }
        }
      } catch {
        // first time — fall back to draft if any
        const draft = loadDraft('fitness', userKey);
        if (!cancelled && draft?.profile) {
          setProfile({ ...DEFAULT_PROFILE, ...draft.profile });
          if (typeof draft.step === 'number') setStep(draft.step);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDraftReady(true);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getIdToken, userKey]);

  useEffect(() => {
    if (!draftReady) return;
    saveDraft('fitness', userKey, { profile, step });
  }, [draftReady, userKey, profile, step]);

  const updateField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const toggleMulti = (field, value) => {
    setProfile((prev) => {
      const arr = prev[field] || [];
      // If selecting 'none' for limitations, clear others
      if (field === 'limitations' && value === 'none') {
        return { ...prev, [field]: arr.includes('none') ? [] : ['none'] };
      }
      if (field === 'limitations' && arr.includes('none')) {
        return { ...prev, [field]: [value] };
      }
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
    setMessage(null);
  };

  const updateLocation = (field, value) => {
    setProfile((prev) => ({
      ...prev,
      location: { ...prev.location, [field]: value },
    }));
    setMessage(null);
  };

  const canAdvance = () => {
    switch (step) {
      case 0:
        return profile.experienceLevel && profile.fitnessGoals.length > 0 && profile.currentActivityLevel;
      case 1:
        return profile.daysPerWeek && profile.preferredDuration && profile.preferredTimeOfDay && profile.workSchedule;
      case 2:
        return profile.trainingEnvironment.length > 0 && profile.indoorOutdoorPreference;
      case 3:
        return true; // location is optional
      case 4:
        return true; // health is optional
      case 5:
        return profile.preferredIntensity && profile.restDayPreference && profile.focusAreas.length > 0;
      default:
        return false;
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
        age: profile.age ? Number(profile.age) : null,
      };
      await updateFitnessProfile(token, { fitnessProfile: profileData });
      clearDraft('fitness', userKey);
      setMessage({ type: 'success', text: 'Fitness profile saved!' });
      setTimeout(() => navigate('/portal/routine'), 1200);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fq-loading">
        <div className="section-spinner" />
        <p>Loading questionnaire...</p>
      </div>
    );
  }

  const currentStep = STEPS[step];

  return (
    <div className="fq-container">
      <div className="admin-page-header">
        <h1>{isEdit ? 'Edit' : ''} Fitness Profile</h1>
        <p>Help us personalize your workout routines</p>
      </div>

      {/* Progress Bar */}
      <div className="fq-progress">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`fq-progress-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => i <= step && setStep(i)}
          >
            <div className="fq-progress-dot">{i < step ? '\u2713' : i + 1}</div>
            <span className="fq-progress-label">{s.title}</span>
          </div>
        ))}
      </div>

      {message && (
        <div className={`portal-profile-msg ${message.type}`}>{message.text}</div>
      )}

      <div className="fq-card">
        <div className="fq-step-header">
          <h2>{currentStep.title}</h2>
          <p>{currentStep.subtitle}</p>
        </div>

        {/* Step 0: Fitness Background */}
        {step === 0 && (
          <div className="fq-step-body">
            <div className="fq-field">
              <label>Experience Level *</label>
              <div className="fq-option-cards">
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    type="button"
                    className={`fq-option-card ${profile.experienceLevel === lvl.value ? 'selected' : ''}`}
                    onClick={() => updateField('experienceLevel', lvl.value)}
                  >
                    <strong>{lvl.label}</strong>
                    <span>{lvl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Fitness Goals * <span className="fq-hint">(select all that apply)</span></label>
              <div className="fq-chips">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`fq-chip ${profile.fitnessGoals.includes(g.value) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('fitnessGoals', g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Current Activity Level *</label>
              <div className="fq-option-cards">
                {ACTIVITY_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    type="button"
                    className={`fq-option-card ${profile.currentActivityLevel === lvl.value ? 'selected' : ''}`}
                    onClick={() => updateField('currentActivityLevel', lvl.value)}
                  >
                    <strong>{lvl.label}</strong>
                    <span>{lvl.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Schedule & Availability */}
        {step === 1 && (
          <div className="fq-step-body">
            <div className="fq-field">
              <label>Training Days Per Week *</label>
              <div className="fq-days-slider">
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={profile.daysPerWeek}
                  onChange={(e) => updateField('daysPerWeek', Number(e.target.value))}
                />
                <div className="fq-days-value">{profile.daysPerWeek} days/week</div>
              </div>
            </div>

            <div className="fq-field">
              <label>Preferred Session Duration *</label>
              <div className="fq-chips">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`fq-chip ${profile.preferredDuration === d ? 'selected' : ''}`}
                    onClick={() => updateField('preferredDuration', d)}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Preferred Time of Day *</label>
              <div className="fq-chips">
                {TIMES_OF_DAY.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`fq-chip ${profile.preferredTimeOfDay === t.value ? 'selected' : ''}`}
                    onClick={() => updateField('preferredTimeOfDay', t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Work Schedule *</label>
              <div className="fq-chips">
                {WORK_SCHEDULES.map((ws) => (
                  <button
                    key={ws.value}
                    type="button"
                    className={`fq-chip ${profile.workSchedule === ws.value ? 'selected' : ''}`}
                    onClick={() => updateField('workSchedule', ws.value)}
                  >
                    {ws.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Environment & Equipment */}
        {step === 2 && (
          <div className="fq-step-body">
            <div className="fq-field">
              <label>Training Environment * <span className="fq-hint">(select all that apply)</span></label>
              <div className="fq-chips">
                {ENVIRONMENTS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    className={`fq-chip ${profile.trainingEnvironment.includes(e.value) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('trainingEnvironment', e.value)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Available Equipment <span className="fq-hint">(select all you have access to)</span></label>
              <div className="fq-equipment-grid">
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    className={`fq-equipment-item ${profile.availableEquipment.includes(eq.id) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('availableEquipment', eq.id)}
                  >
                    {eq.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Indoor / Outdoor Preference *</label>
              <div className="fq-chips">
                {INDOOR_OUTDOOR.map((io) => (
                  <button
                    key={io.value}
                    type="button"
                    className={`fq-chip ${profile.indoorOutdoorPreference === io.value ? 'selected' : ''}`}
                    onClick={() => updateField('indoorOutdoorPreference', io.value)}
                  >
                    {io.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Location & Conditions */}
        {step === 3 && (
          <div className="fq-step-body">
            <div className="fq-field">
              <label>Region <span className="fq-hint">(optional, e.g. "Southeast US", "Northern Europe")</span></label>
              <input
                type="text"
                value={profile.location.region}
                onChange={(e) => updateLocation('region', e.target.value)}
                placeholder="Your general region"
                className="fq-input"
              />
            </div>

            <div className="fq-field">
              <label>Climate</label>
              <div className="fq-chips">
                {CLIMATES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`fq-chip ${profile.location.climate === c.value ? 'selected' : ''}`}
                    onClick={() => updateLocation('climate', c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label className="fq-checkbox-label">
                <input
                  type="checkbox"
                  checked={profile.hasOutdoorSpace}
                  onChange={(e) => updateField('hasOutdoorSpace', e.target.checked)}
                />
                I have access to outdoor space (yard, nearby park, trail, etc.)
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Health & Limitations */}
        {step === 4 && (
          <div className="fq-step-body">
            <div className="fq-field">
              <label>Physical Limitations <span className="fq-hint">(select any that apply)</span></label>
              <div className="fq-chips">
                {LIMITATIONS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    className={`fq-chip ${profile.limitations.includes(l.value) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('limitations', l.value)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Injuries or Conditions <span className="fq-hint">(optional, free text)</span></label>
              <textarea
                value={profile.injuries}
                onChange={(e) => updateField('injuries', e.target.value)}
                placeholder="Describe any injuries, conditions, or movement restrictions..."
                className="fq-textarea"
                rows={3}
              />
            </div>

            <div className="fq-field">
              <label>Age <span className="fq-hint">(optional, helps calibrate recovery recommendations)</span></label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => updateField('age', e.target.value)}
                placeholder="Your age"
                className="fq-input fq-input-short"
                min={13}
                max={100}
              />
            </div>
          </div>
        )}

        {/* Step 5: Preferences */}
        {step === 5 && (
          <div className="fq-step-body">
            <div className="fq-field">
              <label>Preferred Intensity *</label>
              <div className="fq-option-cards">
                {INTENSITIES.map((i) => (
                  <button
                    key={i.value}
                    type="button"
                    className={`fq-option-card ${profile.preferredIntensity === i.value ? 'selected' : ''}`}
                    onClick={() => updateField('preferredIntensity', i.value)}
                  >
                    <strong>{i.label}</strong>
                    <span>{i.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Rest Day Preference *</label>
              <div className="fq-option-cards">
                {REST_PREFERENCES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`fq-option-card ${profile.restDayPreference === r.value ? 'selected' : ''}`}
                    onClick={() => updateField('restDayPreference', r.value)}
                  >
                    <strong>{r.label}</strong>
                    <span>{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fq-field">
              <label>Focus Areas * <span className="fq-hint">(select all that apply)</span></label>
              <div className="fq-chips">
                {FOCUS_AREAS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={`fq-chip ${profile.focusAreas.includes(f.value) ? 'selected' : ''}`}
                    onClick={() => toggleMulti('focusAreas', f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="fq-nav">
          {step > 0 && (
            <button type="button" className="btn" onClick={handleBack}>
              Back
            </button>
          )}
          <div className="fq-nav-right">
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
