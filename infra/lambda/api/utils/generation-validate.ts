import { invokeClaude } from './bedrock';

// ── Types ──

export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

// ── Catalog filtering ──

/**
 * Filter the exercise catalog so only modifications using equipment the user
 * actually owns remain. Bodyweight modifications (empty equipment array) are
 * always viable. Exercises with zero viable modifications are dropped entirely.
 *
 * The AI literally cannot pick an exercise it never sees, so this is a hard
 * filter rather than prompt engineering.
 */
export function filterExercisesByEquipment(exercises: any[], allowedIds: Set<string>): any[] {
  const filtered: any[] = [];
  for (const ex of exercises) {
    const mods = ex.modifications || {};
    const keptMods: Record<string, any> = {};
    for (const level of Object.keys(mods)) {
      const mod = mods[level];
      if (!mod) continue;
      const required = (mod.equipment || []) as Array<{ equipmentId: string }>;
      const ok = required.every((e) => e?.equipmentId && allowedIds.has(e.equipmentId));
      if (ok) keptMods[level] = mod;
    }
    if (Object.keys(keptMods).length === 0) continue;
    filtered.push({ ...ex, modifications: keptMods });
  }
  return filtered;
}

/** Filter the equipment catalog to only items the user owns. */
export function filterEquipmentByIds(equipment: any[], allowedIds: Set<string>): any[] {
  return equipment.filter((eq) => eq?.id && allowedIds.has(eq.id));
}

// ── Workout validation ──

/**
 * Verify every exercise in the generated workout uses only allowed equipment.
 * Matches on `equipment[].equipmentId`. Empty equipment arrays pass.
 */
export function validateWorkoutEquipment(workout: any, allowedIds: Set<string>): ValidationResult {
  const violations: string[] = [];
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  for (const ex of exercises) {
    const equip = Array.isArray(ex?.equipment) ? ex.equipment : [];
    const disallowed = equip
      .map((e: any) => e?.equipmentId)
      .filter((id: string | undefined) => !!id && !allowedIds.has(id));
    if (disallowed.length > 0) {
      const uniq = Array.from(new Set(disallowed));
      violations.push(
        `Exercise "${ex.exerciseName || ex.exerciseId || 'unknown'}" requires equipment the user does not own: ${uniq.join(', ')}`
      );
    }
  }
  return { ok: violations.length === 0, violations };
}

// ── Nutrition validation ──

const COOKING_METHODS = ['none', 'microwave', 'stovetop', 'oven', 'grill', 'air_fryer', 'other'] as const;
type CookingMethod = typeof COOKING_METHODS[number];

/**
 * Maps a structured cookingMethod to the kitchenEquipment label stored on the
 * nutrition profile. Used to verify the user owns what a meal needs.
 */
const METHOD_TO_EQUIPMENT: Record<CookingMethod, string | null> = {
  none: null,
  microwave: 'Microwave',
  stovetop: 'Stove',
  oven: 'Oven',
  grill: 'Grill',
  air_fryer: 'Air Fryer',
  other: null,
};

const COOKING_VERB_REGEX = /\b(cook|cooking|cooked|simmer|boil|fry|bake|baking|grill|grilling|roast|roasting|saut[eé]|broil|steam|poach|braise|sear|stir.?fry)\b/i;

/**
 * Verify a meal plan respects the user's cooking profile.
 *   - If cookingSkill === 'none': every meal must have requiresCooking=false AND cookingMethod='none'.
 *   - cookingMethod must be producible by the user's kitchenEquipment (when method != 'none').
 *   - Belt and suspenders: scan prepNotes for cooking verbs when requiresCooking=false.
 */
export function validateNutritionCooking(plan: any, nutritionProfile: any): ValidationResult {
  const violations: string[] = [];
  const meals = Array.isArray(plan?.meals) ? plan.meals : [];
  const cookingSkill = String(nutritionProfile?.cookingSkill || '').toLowerCase();
  const kitchenEquipment = new Set(
    (Array.isArray(nutritionProfile?.kitchenEquipment) ? nutritionProfile.kitchenEquipment : []) as string[]
  );
  const noCookRequired = cookingSkill === 'none';

  for (const meal of meals) {
    const label = meal?.name || `Meal ${meal?.mealNumber ?? '?'}`;
    const method: CookingMethod = (meal?.cookingMethod || 'none') as CookingMethod;
    const requiresCooking = !!meal?.requiresCooking;
    const prepNotes = typeof meal?.prepNotes === 'string' ? meal.prepNotes : '';

    if (!COOKING_METHODS.includes(method)) {
      violations.push(`${label}: invalid cookingMethod "${meal?.cookingMethod}"`);
      continue;
    }

    if (noCookRequired) {
      if (requiresCooking || method !== 'none') {
        violations.push(
          `${label}: user selected No Cooking but meal has requiresCooking=${requiresCooking} cookingMethod="${method}"`
        );
        continue;
      }
      if (COOKING_VERB_REGEX.test(prepNotes)) {
        violations.push(`${label}: prep notes mention cooking verbs although requiresCooking=false ("${prepNotes.slice(0, 80)}")`);
        continue;
      }
    }

    // Equipment compliance for cooking methods
    if (method !== 'none' && method !== 'other') {
      const requiredEquip = METHOD_TO_EQUIPMENT[method];
      if (requiredEquip && !kitchenEquipment.has(requiredEquip)) {
        violations.push(
          `${label}: uses cookingMethod "${method}" which requires ${requiredEquip}, not in user's kitchenEquipment`
        );
      }
    }

    // Consistency: requiresCooking=false but cookingMethod implies cooking
    if (!requiresCooking && method !== 'none') {
      violations.push(`${label}: requiresCooking=false but cookingMethod="${method}" - inconsistent`);
    }
  }

  return { ok: violations.length === 0, violations };
}

// ── Generation wrapper with retry-on-violation ──

export interface GenerateWithValidationOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  /** Parse raw model text into a structured object; throw if malformed. */
  parse: (raw: string) => T;
  /** Run a hard constraint check. Returns violations that trigger a retry. */
  validate: (parsed: T) => ValidationResult;
  /** Build a strict retry addendum quoting the specific violations. */
  buildRetryAddendum: (violations: string[]) => string;
  /** Logging label. */
  label: string;
}

export interface GenerateWithValidationResult<T> {
  parsed: T;
  usage: { inputTokens: number; outputTokens: number };
  totalUsage: { inputTokens: number; outputTokens: number };
  attempts: number;
}

/**
 * Invoke Bedrock, parse, validate, and regenerate ONCE if the first response
 * violates a hard constraint. On the retry the user prompt is extended with an
 * addendum quoting the specific violations. If the retry also violates, throws
 * a ConstraintViolationError with the final violation list so the caller can
 * store status='error'.
 */
export async function generateWithValidation<T>(
  opts: GenerateWithValidationOptions<T>
): Promise<GenerateWithValidationResult<T>> {
  let userPrompt = opts.userPrompt;
  let lastViolations: string[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await invokeClaude(opts.systemPrompt, userPrompt, {
      maxTokens: opts.maxTokens ?? 4096,
    });
    totalInput += result.usage.inputTokens;
    totalOutput += result.usage.outputTokens;

    const parsed = opts.parse(result.content);
    const { ok, violations } = opts.validate(parsed);

    if (ok) {
      return {
        parsed,
        usage: result.usage,
        totalUsage: { inputTokens: totalInput, outputTokens: totalOutput },
        attempts: attempt,
      };
    }

    lastViolations = violations;
    console.warn(
      `[${opts.label}] attempt ${attempt} failed validation: ${violations.join('; ')}`
    );

    if (attempt === 1) {
      userPrompt = opts.userPrompt + '\n\n' + opts.buildRetryAddendum(violations);
    }
  }

  throw new ConstraintViolationError(
    `Constraint violations persisted after retry: ${lastViolations.join('; ')}`,
    lastViolations
  );
}

export class ConstraintViolationError extends Error {
  violations: string[];
  constructor(message: string, violations: string[]) {
    super(message);
    this.name = 'ConstraintViolationError';
    this.violations = violations;
  }
}
