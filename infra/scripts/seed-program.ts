/**
 * Seed script: Loads the full Hyrax Fitness program (equipment, exercises, workouts)
 * into DynamoDB from the program document data.
 *
 * Run: cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-program.ts --profile hyrax-fitness
 *
 * Idempotent - uses deterministic IDs so re-running overwrites with same keys.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';

const TABLE_NAME = 'HyraxContent';
const REGION = 'us-east-1';

const args = process.argv.slice(2);
const profileIndex = args.indexOf('--profile');
const profile = profileIndex !== -1 ? args[profileIndex + 1] : undefined;

const clientConfig: any = { region: REGION };
if (profile) {
  clientConfig.credentials = fromIni({ profile });
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

// ---------------------------------------------------------------------------
// Equipment (14 items)
// ---------------------------------------------------------------------------

const EQUIPMENT = [
  { id: 'dumbbells', name: 'Dumbbells', description: 'Light (10–15 lb), Medium (20–30 lb), Heavy (35–50 lb)', sortOrder: 1 },
  { id: 'kettlebells', name: 'Kettlebells', description: 'Light (18–26 lb), Medium (35–44 lb), Heavy (53–70 lb)', sortOrder: 2 },
  { id: 'pull-up-bar', name: 'Pull-Up Bar', description: 'Doorframe-mounted or freestanding', sortOrder: 3 },
  { id: 'plyo-box', name: 'Plyo Box / Sturdy Bench', description: '12″, 16″, 20″, 24″, 30″ heights', sortOrder: 4 },
  { id: 'sandbag', name: 'Sandbag', description: 'Light (30–40 lb), Heavy (60–80 lb)', sortOrder: 5 },
  { id: 'weight-vest', name: 'Weight Vest', description: '20 lb, 40 lb', sortOrder: 6 },
  { id: 'weighted-sled', name: 'Weighted Sled', description: 'Gym-only; load as needed', sortOrder: 7 },
  { id: 'barbell-plates', name: 'Barbell + Plates', description: 'Olympic barbell (45 lb) + assorted plates', sortOrder: 8 },
  { id: 'parallettes', name: 'Parallettes', description: 'Low (6–9″) for L-sits, dips, and push-up variations', sortOrder: 9 },
  { id: 'gymnastics-rings', name: 'Gymnastics Rings', description: 'Adjustable strap length; ceiling or pull-up bar mounted', sortOrder: 10 },
  { id: 'cones-markers', name: 'Cones / Markers', description: '4–6 cones for outdoor sprint courses', sortOrder: 11 },
  { id: 'loaded-backpack', name: 'Loaded Backpack', description: 'Outdoor carry substitute; fill with water bottles or sandbag filler', sortOrder: 12 },
  { id: 'foam-roller', name: 'Foam Roller', description: 'Standard density; for Bask cooldown', sortOrder: 13 },
  { id: 'resistance-band', name: 'Resistance Band', description: 'Light, Medium, Heavy; for mobility and warm-up', sortOrder: 14 },
];

// ---------------------------------------------------------------------------
// Exercises (15 items, 4 variants each)
// ---------------------------------------------------------------------------

// Helper: build a modification entry with correct frontend schema
function mod(subName: string, description: string, equipment: { equipmentId: string; equipmentName: string }[] = []) {
  return { subName, description, imageUrl: '', notes: '', equipment };
}

const EXERCISES = [
  {
    id: 'boulder-press',
    name: 'Boulder Press',
    description: 'Pressing movement that simulates shoving rock overhead to claim a perch.',
    tags: ['upper-push'],
    sortOrder: 1,
    modifications: {
      beginner: mod('Knee Push-Up', 'Push-up from knees, full range of motion'),
      intermediate: mod('Strict Push-Up', 'Standard push-up, chest to ground'),
      advanced: mod('Archer Push-Up', 'Wide stance, shift weight to one arm per rep'),
      elite: mod('Handstand Push-Up', 'Wall-assisted or freestanding, full lockout'),
    },
  },
  {
    id: 'crag-pull',
    name: 'Crag Pull',
    description: 'Vertical pulling to simulate hauling yourself up a rock face.',
    tags: ['upper-pull'],
    sortOrder: 2,
    modifications: {
      beginner: mod('Dead Hang + Scap Pull', 'Hang from bar, retract shoulder blades, hold 3 sec', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }]),
      intermediate: mod('Strict Pull-Up', 'Full dead hang to chin over bar, no kip', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }]),
      advanced: mod('Weighted Pull-Up', 'Add 25–45 lb via belt or vest', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }, { equipmentId: 'weight-vest', equipmentName: 'Weight Vest' }]),
      elite: mod('One-Arm Pull-Up Negative', 'Slow 5-sec eccentric descent on one arm', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }]),
    },
  },
  {
    id: 'colony-carry',
    name: 'Colony Carry',
    description: 'Loaded carry mimicking foraging haul back to the colony. Core and grip endurance.',
    tags: ['loaded-carry'],
    sortOrder: 3,
    modifications: {
      beginner: mod("Farmer's Walk (light)", 'Two light dumbbells, 40 m walk', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      intermediate: mod("Farmer's Walk (heavy)", 'Two heavy dumbbells or kettlebells, 40 m', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }, { equipmentId: 'kettlebells', equipmentName: 'Kettlebells' }]),
      advanced: mod('Uneven Carry', 'Heavy implement in one hand, lighter in the other, 40 m', [{ equipmentId: 'kettlebells', equipmentName: 'Kettlebells' }, { equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      elite: mod('Sandbag Bear Hug Carry', 'Heavy sandbag hugged to chest, 40 m', [{ equipmentId: 'sandbag', equipmentName: 'Sandbag' }]),
    },
  },
  {
    id: 'ledge-scramble',
    name: 'Ledge Scramble',
    description: "Step-up or box climb replicating the hyrax's signature rock scramble.",
    tags: ['climb', 'scramble'],
    sortOrder: 4,
    modifications: {
      beginner: mod('Low Box Step-Up', '12–16″ box, alternating legs', [{ equipmentId: 'plyo-box', equipmentName: 'Plyo Box / Sturdy Bench' }]),
      intermediate: mod('High Box Step-Up', '20–24″ box, controlled step, no push off trail leg', [{ equipmentId: 'plyo-box', equipmentName: 'Plyo Box / Sturdy Bench' }]),
      advanced: mod('Weighted Box Step-Up', '20–24″ box holding dumbbells or wearing vest', [{ equipmentId: 'plyo-box', equipmentName: 'Plyo Box / Sturdy Bench' }, { equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      elite: mod('Box Jump-Over', '24–30″ box, jump up and over, land softly, repeat', [{ equipmentId: 'plyo-box', equipmentName: 'Plyo Box / Sturdy Bench' }]),
    },
  },
  {
    id: 'bolt-sprint',
    name: 'Bolt Sprint',
    description: 'Short explosive dash between cover points. Pure hyrax flight response.',
    tags: ['sprint', 'agility'],
    sortOrder: 5,
    modifications: {
      beginner: mod('Fast Walk / Jog Intervals', '20 m jog, walk back, repeat'),
      intermediate: mod('20 m Sprint', 'All-out 20 m sprint from standing start'),
      advanced: mod('Shuttle Sprint', '5-10-5 shuttle drill, touch ground at each turn'),
      elite: mod('Weighted Sled Sprint', 'Push or pull sled 20 m, max effort', [{ equipmentId: 'weighted-sled', equipmentName: 'Weighted Sled' }]),
    },
  },
  {
    id: 'outcrop-crawl',
    name: 'Outcrop Crawl',
    description: 'Low crawl under obstacles, building shoulder stability and coordination.',
    tags: ['crawl', 'locomotion'],
    sortOrder: 6,
    modifications: {
      beginner: mod('Hands-and-Knees Crawl', 'Crawl forward 10 m, knees lightly touching ground'),
      intermediate: mod('Bear Crawl', 'Knees off ground, 10 m forward + 10 m backward'),
      advanced: mod('Low Bear Crawl', 'Hips below shoulders, 15 m, stay tight to ground'),
      elite: mod('Weighted Bear Crawl', 'Vest or plate on back, 15 m, slow and controlled', [{ equipmentId: 'weight-vest', equipmentName: 'Weight Vest' }]),
    },
  },
  {
    id: 'perch-squat',
    name: 'Perch Squat',
    description: "Deep squat mimicking the hyrax's crouched resting position on a ledge.",
    tags: ['lower-body', 'squat'],
    sortOrder: 7,
    modifications: {
      beginner: mod('Goblet Squat (light)', 'Hold light dumbbell at chest, squat to parallel', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      intermediate: mod('Goblet Squat (heavy)', 'Heavy dumbbell or kettlebell, full depth', [{ equipmentId: 'kettlebells', equipmentName: 'Kettlebells' }]),
      advanced: mod('Front Squat (barbell)', 'Barbell in front rack, full depth, upright torso', [{ equipmentId: 'barbell-plates', equipmentName: 'Barbell + Plates' }]),
      elite: mod('Pistol Squat', 'Single-leg squat to full depth, no assistance'),
    },
  },
  {
    id: 'sunstone-hold',
    name: 'Sunstone Hold',
    description: 'Static holds that build the rigid midline needed for climbing and carrying.',
    tags: ['core', 'isometric'],
    sortOrder: 8,
    modifications: {
      beginner: mod('Forearm Plank', 'Hold 30–45 sec, neutral spine'),
      intermediate: mod('Plank with Shoulder Tap', 'Plank position, alternate tapping opposite shoulder'),
      advanced: mod('L-Sit (parallettes or floor)', 'Hold legs at 90°, 15–20 sec', [{ equipmentId: 'parallettes', equipmentName: 'Parallettes' }]),
      elite: mod('Front Lever Hold or Tuck', 'Hang from bar, body horizontal, hold 10+ sec', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }]),
    },
  },
  {
    id: 'ridge-row',
    name: 'Ridge Row',
    description: 'Horizontal pulling for back thickness and posture, like pulling yourself across a ledge.',
    tags: ['upper-pull', 'horizontal'],
    sortOrder: 9,
    modifications: {
      beginner: mod('Inverted Row (high bar)', 'Bar at chest height, feet on ground, pull chest to bar', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }]),
      intermediate: mod('Inverted Row (low bar)', 'Bar at hip height, body nearly horizontal', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }]),
      advanced: mod('Single-Arm Dumbbell Row', 'Heavy dumbbell, bench supported, strict form', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      elite: mod('Weighted Inverted Row', 'Vest or plate on chest, bar at hip height', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }, { equipmentId: 'weight-vest', equipmentName: 'Weight Vest' }]),
    },
  },
  {
    id: 'cliff-lunge',
    name: 'Cliff Lunge',
    description: 'Unilateral leg work for the uneven terrain a hyrax navigates daily.',
    tags: ['lower-body', 'single-leg'],
    sortOrder: 10,
    modifications: {
      beginner: mod('Static Reverse Lunge', 'Bodyweight, step back, knee to 1″ off floor'),
      intermediate: mod('Walking Lunge', 'Bodyweight or light dumbbells, continuous forward steps', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      advanced: mod('Weighted Walking Lunge', 'Heavy dumbbells or barbell, 20 m', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      elite: mod('Bulgarian Split Squat (loaded)', 'Rear foot elevated, heavy dumbbells, full depth', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }, { equipmentId: 'plyo-box', equipmentName: 'Plyo Box / Sturdy Bench' }]),
    },
  },
  {
    id: 'basalt-burpee',
    name: 'Basalt Burpee',
    description: "Explosive full-body movement for metabolic conditioning. The hyrax's emergency escape.",
    tags: ['full-body', 'explosive'],
    sortOrder: 11,
    modifications: {
      beginner: mod('Step-Back Burpee', 'Step feet back one at a time, no push-up, stand up'),
      intermediate: mod('Standard Burpee', 'Jump back, chest to floor, jump up'),
      advanced: mod('Burpee Box Jump', 'Burpee into immediate box jump, step down', [{ equipmentId: 'plyo-box', equipmentName: 'Plyo Box / Sturdy Bench' }]),
      elite: mod('Burpee Muscle-Up', 'Burpee under pull-up bar, jump to muscle-up', [{ equipmentId: 'pull-up-bar', equipmentName: 'Pull-Up Bar' }]),
    },
  },
  {
    id: 'sentinel-press',
    name: 'Sentinel Press',
    description: 'Overhead pressing for the vigilant, upright posture of a hyrax on lookout.',
    tags: ['overhead', 'shoulder'],
    sortOrder: 12,
    modifications: {
      beginner: mod('Seated Dumbbell Press (light)', 'Seated, light dumbbells, full lockout', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      intermediate: mod('Standing Dumbbell Press', 'Standing, moderate load, strict press', [{ equipmentId: 'dumbbells', equipmentName: 'Dumbbells' }]),
      advanced: mod('Push Press (barbell)', 'Slight dip-and-drive, barbell overhead', [{ equipmentId: 'barbell-plates', equipmentName: 'Barbell + Plates' }]),
      elite: mod('Strict Barbell Overhead Press', 'No leg drive, heavy barbell, standing', [{ equipmentId: 'barbell-plates', equipmentName: 'Barbell + Plates' }]),
    },
  },
  {
    id: 'summit-inversion',
    name: 'Summit Inversion',
    description: 'Inverted balance work mimicking the hyrax perched upside-down on a cliff face. Builds shoulder stability, proprioception, and midline control.',
    tags: ['handstand', 'balance'],
    sortOrder: 13,
    modifications: {
      beginner: mod('Wall Walk-Up', 'Start in push-up position, walk feet up wall to 45° angle, hold 10 sec, walk back down'),
      intermediate: mod('Wall Handstand Hold', 'Chest facing wall, walk up to full handstand, hold 20–30 sec with controlled breathing'),
      advanced: mod('Freestanding Handstand Hold', 'Kick up to freestanding handstand, hold 15–20 sec, controlled bail'),
      elite: mod('Handstand Walk', 'Freestanding handstand walk 10 m with control, no wall assistance'),
    },
  },
  {
    id: 'kopje-dip',
    name: 'Kopje Dip',
    description: 'Pressing downward from an elevated perch. Builds tricep and chest strength for scrambling and pressing out of low positions.',
    tags: ['calisthenics', 'upper-push'],
    sortOrder: 14,
    modifications: {
      beginner: mod('Bench Dip', 'Hands on bench behind you, feet on ground, dip to 90° elbow bend', [{ equipmentId: 'plyo-box', equipmentName: 'Plyo Box / Sturdy Bench' }]),
      intermediate: mod('Parallel Bar Dip', 'Full bodyweight dip on parallel bars or parallettes, chest slight forward lean', [{ equipmentId: 'parallettes', equipmentName: 'Parallettes' }]),
      advanced: mod('Weighted Dip', 'Add 25–45 lb via belt or vest, full depth on parallel bars', [{ equipmentId: 'parallettes', equipmentName: 'Parallettes' }, { equipmentId: 'weight-vest', equipmentName: 'Weight Vest' }]),
      elite: mod('Ring Dip', 'Full dip on gymnastic rings, rings turned out at top, strict form', [{ equipmentId: 'gymnastics-rings', equipmentName: 'Gymnastics Rings' }]),
    },
  },
  {
    id: 'crevice-flow',
    name: 'Crevice Flow',
    description: 'Fluid ground-based movement combining animal flow patterns. Mimics the hyrax threading through tight rock crevices with agility and control.',
    tags: ['calisthenics', 'locomotion'],
    sortOrder: 15,
    modifications: {
      beginner: mod('Tabletop to Crab Walk', 'Alternate 5 m tabletop bridge walk and 5 m crab walk, 2 laps'),
      intermediate: mod('Scorpion Reach + Ape Walk', 'Prone scorpion stretch into deep ape squat walk, 10 m continuous'),
      advanced: mod('Flow Sequence', 'Beast crawl → side kick-through → crab reach → sprawl, continuous 30 sec'),
      elite: mod('Inverted Flow', 'Cartwheel → macaco → handstand pirouette → low transition, continuous 30 sec'),
    },
  },
];

// ---------------------------------------------------------------------------
// Workouts (15 items: 5 home, 5 gym, 5 outdoors)
// ---------------------------------------------------------------------------

// Build exercise name lookup from EXERCISES array
const EX_NAMES: Record<string, string> = {};
for (const ex of EXERCISES) {
  EX_NAMES[ex.id] = ex.name;
}

// Helper: build a workout exercise reference with correct frontend schema
function exRef(
  exerciseId: string,
  overrides: { sets?: string; reps?: string; rest?: string; duration?: string; notes?: string } = {}
) {
  return {
    exerciseId,
    exerciseName: EX_NAMES[exerciseId] || exerciseId,
    sets: overrides.sets || '',
    reps: overrides.reps || '',
    rest: overrides.rest || '',
    duration: overrides.duration || '',
    notes: overrides.notes || '',
  };
}

const WORKOUTS = [
  // ── At Home (5) ──
  {
    id: 'dawn-forage',
    title: 'Dawn Forage',
    description: 'Quick morning scramble. No equipment needed.',
    category: 'home',
    duration: '20 min',
    exercises: [
      exRef('bolt-sprint', { duration: '45s', rest: '15s', notes: 'In place: high knees' }),
      exRef('boulder-press', { duration: '45s', rest: '15s' }),
      exRef('outcrop-crawl', { duration: '45s', rest: '15s' }),
      exRef('perch-squat', { duration: '45s', rest: '15s' }),
      exRef('sunstone-hold', { duration: '45s', rest: '15s' }),
    ],
    equipment: [],
    tags: ['bodyweight', 'no-equipment', 'morning'],
    sortOrder: 1,
    notes: 'Structure: 4 rounds. Each exercise is a 45-sec forage bout, 15 sec rest between exercises. 90 sec rest between rounds.\n\nBask (5 min): Seated forward fold, deep breathing, hip 90/90 stretch.',
  },
  {
    id: 'colony-circuit',
    title: 'Colony Circuit',
    description: 'Full-body loop. One pair of dumbbells is all you need.',
    category: 'home',
    duration: '25 min',
    exercises: [
      exRef('boulder-press', { duration: '40s', rest: '20s' }),
      exRef('colony-carry', { duration: '40s', rest: '20s', notes: 'Dumbbells, around room or hallway' }),
      exRef('cliff-lunge', { duration: '40s', rest: '20s' }),
      exRef('sentinel-press', { duration: '40s', rest: '20s' }),
      exRef('sunstone-hold', { duration: '40s', rest: '20s' }),
      exRef('basalt-burpee', { duration: '40s', rest: '20s' }),
    ],
    equipment: [],
    tags: ['full-body', 'dumbbells'],
    sortOrder: 2,
    notes: 'Structure: 5 rounds. 40 sec work / 20 sec rest per exercise. 60 sec rest between rounds.\n\nBask (5 min): Child\'s pose, thoracic extension over pillow, box breathing.',
  },
  {
    id: 'burrow-burn',
    title: 'Burrow Burn',
    description: 'Short and savage. Bodyweight only.',
    category: 'home',
    duration: '15 min',
    exercises: [
      exRef('basalt-burpee', { reps: '5' }),
      exRef('boulder-press', { reps: '10' }),
      exRef('perch-squat', { reps: '10' }),
      exRef('outcrop-crawl', { duration: '30s', notes: '20 m or 30 sec in place' }),
    ],
    equipment: [],
    tags: ['bodyweight', 'no-equipment', 'amrap', 'quick'],
    sortOrder: 3,
    notes: 'Structure: AMRAP (as many rounds as possible) in 12 minutes.\n\nBask (3 min): Supine spinal twist, slow nasal breathing.',
  },
  {
    id: 'thermal-drift',
    title: 'Thermal Drift',
    description: 'Longer session emphasizing carries and core.',
    category: 'home',
    duration: '30 min',
    exercises: [
      exRef('colony-carry', { duration: '30s', rest: '30s', notes: 'Dumbbells, 40 m or 45 sec' }),
      exRef('ridge-row', { duration: '30s', rest: '30s', notes: 'Inverted row under sturdy table' }),
      exRef('cliff-lunge', { duration: '30s', rest: '30s' }),
      exRef('sunstone-hold', { duration: '30s', rest: '30s' }),
      exRef('boulder-press', { duration: '30s', rest: '30s' }),
      exRef('bolt-sprint', { duration: '20s', rest: '30s', notes: 'High knees in place, all-out' }),
    ],
    equipment: [],
    tags: ['carries', 'core', 'endurance'],
    sortOrder: 4,
    notes: 'Structure: 6 rounds. 30 sec work / 30 sec rest. 90 sec rest every 2 rounds.\n\nBask (5 min): Pigeon stretch, shoulder pass-throughs, 4-7-8 breathing.',
  },
  {
    id: 'pinnacle-flow',
    title: 'Pinnacle Flow',
    description: 'Handstand and calisthenics focus. Wall space and parallettes recommended.',
    category: 'home',
    duration: '25 min',
    exercises: [
      exRef('summit-inversion', { duration: '40s', rest: '20s', notes: 'Wall walk-up or wall handstand hold' }),
      exRef('kopje-dip', { duration: '40s', rest: '20s', notes: 'Bench dip or parallette dip' }),
      exRef('crevice-flow', { duration: '40s', rest: '20s', notes: 'Tabletop/crab or flow sequence' }),
      exRef('boulder-press', { duration: '40s', rest: '20s' }),
      exRef('sunstone-hold', { duration: '40s', rest: '20s' }),
    ],
    equipment: [],
    tags: ['calisthenics', 'handstand', 'bodyweight'],
    sortOrder: 5,
    notes: 'Structure: 5 rounds. 40-sec forage bouts, 20 sec rest between exercises. 90 sec rest between rounds.\n\nBask (5 min): Wrist circles, puppy pose stretch, wall-assisted shoulder opener, slow nasal breathing.',
  },

  // ── Gym (5) ──
  {
    id: 'kopje-complex',
    title: 'Kopje Complex',
    description: 'Heavy compound work with carries. Full gym setup.',
    category: 'gym',
    duration: '35 min',
    exercises: [
      exRef('perch-squat', { duration: '60s', rest: '30s', notes: 'Barbell front squat or goblet' }),
      exRef('crag-pull', { duration: '60s', rest: '30s' }),
      exRef('colony-carry', { duration: '60s', rest: '30s', notes: 'Heavy kettlebells, 40 m' }),
      exRef('sentinel-press', { duration: '60s', rest: '30s' }),
      exRef('ledge-scramble', { duration: '60s', rest: '30s', notes: 'Box step-ups' }),
      exRef('sunstone-hold', { duration: '60s', rest: '30s' }),
    ],
    equipment: [],
    tags: ['strength', 'compound', 'carries'],
    sortOrder: 6,
    notes: 'Structure: 5 rounds. 60-sec forage bouts, 30 sec rest between exercises. 2 min rest between rounds.\n\nBask (7 min): Foam roll quads and lats, banded shoulder stretch, crocodile breathing.',
  },
  {
    id: 'granite-grind',
    title: 'Granite Grind',
    description: 'Push-pull supersets with explosive finishers.',
    category: 'gym',
    duration: '30 min',
    exercises: [
      exRef('boulder-press', { duration: '45s', rest: '15s', notes: 'Superset A' }),
      exRef('ridge-row', { duration: '45s', rest: '15s', notes: 'Superset A' }),
      exRef('cliff-lunge', { duration: '45s', rest: '15s', notes: 'Superset B' }),
      exRef('sentinel-press', { duration: '45s', rest: '15s', notes: 'Superset B' }),
      exRef('bolt-sprint', { duration: '20s', notes: 'Finisher - rower or bike' }),
      exRef('basalt-burpee', { reps: '10', notes: 'Finisher' }),
    ],
    equipment: [],
    tags: ['supersets', 'push-pull', 'explosive'],
    sortOrder: 7,
    notes: 'Structure: 4 rounds. Superset pairs: 45 sec each, 15 sec transition. 90 sec rest between rounds.\n\nBask (5 min): Hanging decompression, couch stretch, slow exhale breathing.',
  },
  {
    id: 'slab-ascent',
    title: 'Slab Ascent',
    description: 'Vertical emphasis. Pulling and climbing focus.',
    category: 'gym',
    duration: '25 min',
    exercises: [
      exRef('crag-pull', { duration: '40s', rest: '20s' }),
      exRef('ledge-scramble', { duration: '40s', rest: '20s' }),
      exRef('outcrop-crawl', { duration: '40s', rest: '20s' }),
      exRef('sunstone-hold', { duration: '40s', rest: '20s' }),
      exRef('colony-carry', { duration: '40s', rest: '20s', notes: 'Single heavy kettlebell, suitcase carry' }),
    ],
    equipment: [],
    tags: ['pulling', 'climbing', 'vertical'],
    sortOrder: 8,
    notes: 'Structure: 5 rounds. 40 sec work / 20 sec rest. 90 sec rest between rounds.\n\nBask (5 min): Dead hang, wrist circles, seated meditation with nasal breathing.',
  },
  {
    id: 'talus-storm',
    title: 'Talus Storm',
    description: 'High volume. Every core exercise in one session.',
    category: 'gym',
    duration: '40 min',
    exercises: [
      exRef('boulder-press', { duration: '30s', rest: '10s' }),
      exRef('crag-pull', { duration: '30s', rest: '10s' }),
      exRef('colony-carry', { duration: '30s', rest: '10s' }),
      exRef('ledge-scramble', { duration: '30s', rest: '10s' }),
      exRef('bolt-sprint', { duration: '20s', rest: '10s', notes: 'Rower, 20 sec' }),
      exRef('outcrop-crawl', { duration: '30s', rest: '10s' }),
      exRef('perch-squat', { duration: '30s', rest: '10s' }),
      exRef('sunstone-hold', { duration: '30s', rest: '10s' }),
      exRef('ridge-row', { duration: '30s', rest: '10s' }),
      exRef('cliff-lunge', { duration: '30s', rest: '10s' }),
      exRef('basalt-burpee', { duration: '30s', rest: '10s' }),
      exRef('sentinel-press', { duration: '30s', rest: '10s' }),
    ],
    equipment: [],
    tags: ['high-volume', 'full-body', 'all-exercises'],
    sortOrder: 9,
    notes: 'Structure: 3 rounds. 30 sec per exercise, 10 sec transition. 2 min rest between rounds.\n\nBask (10 min): Full mobility sequence - ankles, hips, thoracic spine, shoulders. Box breathing throughout.',
  },
  {
    id: 'spire-session',
    title: 'Spire Session',
    description: 'Heavy calisthenics and inversions with gym equipment. Rings, bars, and boxes.',
    category: 'gym',
    duration: '35 min',
    exercises: [
      exRef('summit-inversion', { duration: '50s', rest: '20s', notes: 'Freestanding handstand or handstand walk' }),
      exRef('kopje-dip', { duration: '50s', rest: '20s', notes: 'Weighted or ring dip' }),
      exRef('crag-pull', { duration: '50s', rest: '20s' }),
      exRef('crevice-flow', { duration: '50s', rest: '20s', notes: 'Flow sequence or inverted flow' }),
      exRef('ledge-scramble', { duration: '50s', rest: '20s', notes: 'Box jump-over' }),
      exRef('colony-carry', { duration: '50s', rest: '20s', notes: 'Heavy kettlebell suitcase carry, 40 m' }),
      exRef('sunstone-hold', { duration: '50s', rest: '20s', notes: 'L-sit or front lever' }),
    ],
    equipment: [],
    tags: ['calisthenics', 'inversions', 'rings'],
    sortOrder: 10,
    notes: 'Structure: 4 rounds. 50-sec forage bouts, 20 sec rest between exercises. 2 min rest between rounds.\n\nBask (7 min): Dead hang, foam roll shoulders and lats, wrist stretches, crocodile breathing.',
  },

  // ── Outdoors (5) ──
  {
    id: 'ridge-run',
    title: 'Ridge Run',
    description: 'Trail-ready. Sprint between landmarks, work at each stop.',
    category: 'outdoors',
    duration: '25 min',
    exercises: [
      exRef('boulder-press', { notes: 'Station 1: on ground' }),
      exRef('perch-squat', { notes: 'Station 2: bodyweight or rock hold' }),
      exRef('outcrop-crawl', { notes: 'Station 3: 15 m' }),
      exRef('cliff-lunge', { reps: '10', notes: 'Station 4: 10 per leg' }),
      exRef('sunstone-hold', { duration: '30s', notes: 'Station 5' }),
    ],
    equipment: [],
    tags: ['trail', 'sprint', 'stations'],
    sortOrder: 11,
    notes: 'Structure: Pick 5 landmarks 30–50 m apart. Sprint to each, perform exercise, sprint to next. 3 full laps.\n\nBask (5 min): Standing quad stretch, calf stretch on rock, slow breathing facing the sun.',
  },
  {
    id: 'outcrop',
    title: 'Outcrop',
    description: 'Find a rock, wall, or bench. That\'s your gym.',
    category: 'outdoors',
    duration: '30 min',
    exercises: [
      exRef('ledge-scramble', { duration: '45s', rest: '15s', notes: 'Bench or rock step-up' }),
      exRef('boulder-press', { duration: '45s', rest: '15s', notes: 'Hands on bench, decline or incline' }),
      exRef('colony-carry', { duration: '45s', rest: '15s', notes: 'Backpack loaded with rocks or water bottles, 40 m' }),
      exRef('ridge-row', { duration: '45s', rest: '15s', notes: 'Inverted row under sturdy railing or low branch' }),
      exRef('basalt-burpee', { duration: '45s', rest: '15s' }),
    ],
    equipment: [],
    tags: ['outdoor-gym', 'improvised', 'bench'],
    sortOrder: 12,
    notes: 'Structure: 5 rounds. 45-sec bouts, 15 sec rest. 90 sec rest between rounds.\n\nBask (5 min): Seated straddle stretch, sky-gazing neck stretch, slow breathing.',
  },
  {
    id: 'bolt',
    title: 'Bolt',
    description: 'Pure speed and agility on open ground.',
    category: 'outdoors',
    duration: '20 min',
    exercises: [
      exRef('bolt-sprint', { duration: '90s', rest: '60s', notes: '20 m out and back x3' }),
      exRef('outcrop-crawl', { notes: '10 m bear crawl' }),
      exRef('basalt-burpee', { reps: '5' }),
      exRef('cliff-lunge', { notes: 'Walking lunge back to start, 20 m' }),
    ],
    equipment: [],
    tags: ['speed', 'agility', 'sprint'],
    sortOrder: 13,
    notes: 'Structure: Set two cones (or markers) 20 m apart. 6 rounds. 90 sec work / 60 sec rest.\n\nBask (5 min): Calf walk-outs, standing forward fold, deep nasal breathing.',
  },
  {
    id: 'colony-march',
    title: 'Colony March',
    description: 'Long carry session. Load up and move.',
    category: 'outdoors',
    duration: '35 min',
    exercises: [
      exRef('colony-carry', { notes: 'Loaded backpack, continuous walking between stations' }),
      exRef('boulder-press', { reps: '15', notes: 'Station 1' }),
      exRef('perch-squat', { reps: '15', notes: 'Station 2' }),
      exRef('cliff-lunge', { reps: '10', notes: 'Station 3: 10 per leg' }),
      exRef('sunstone-hold', { duration: '45s', notes: 'Station 4' }),
      exRef('basalt-burpee', { reps: '10', notes: 'Station 5' }),
      exRef('outcrop-crawl', { notes: 'Station 6: 15 m' }),
    ],
    equipment: [],
    tags: ['carries', 'endurance', 'stations'],
    sortOrder: 14,
    notes: 'Structure: Continuous movement. Every 5 min, stop for a 60-sec exercise station. Total: 6 stations.\n\nBask (7 min): Set pack down. Hip circles, hamstring stretch, child\'s pose on grass, slow breathing.',
  },
  {
    id: 'skyline',
    title: 'Skyline',
    description: 'Bodyweight calisthenics and balance on open ground. No equipment needed.',
    category: 'outdoors',
    duration: '25 min',
    exercises: [
      exRef('summit-inversion', { duration: '45s', rest: '15s', notes: 'Wall walk-up on tree or freestanding attempt' }),
      exRef('crevice-flow', { duration: '45s', rest: '15s', notes: 'Scorpion reach + ape walk or flow sequence' }),
      exRef('kopje-dip', { duration: '45s', rest: '15s', notes: 'Hands on bench, park rail, or rock' }),
      exRef('bolt-sprint', { duration: '45s', rest: '15s', notes: '20 m out and back' }),
      exRef('basalt-burpee', { reps: '5', rest: '15s' }),
      exRef('cliff-lunge', { duration: '45s', rest: '15s', notes: 'Walking lunge, 20 m' }),
    ],
    equipment: [],
    tags: ['calisthenics', 'bodyweight', 'balance'],
    sortOrder: 15,
    notes: 'Structure: 5 rounds. 45-sec bouts, 15 sec rest. 90 sec rest between rounds.\n\nBask (5 min): Standing wrist stretches, downward dog, seated forward fold, slow breathing.',
  },
];

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedEquipment(): Promise<void> {
  const now = new Date().toISOString();
  for (const eq of EQUIPMENT) {
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'EQUIPMENT',
          sk: `EQUIPMENT#${eq.id}`,
          id: eq.id,
          name: eq.name,
          description: eq.description,
          imageUrl: '',
          notes: '',
          sortOrder: eq.sortOrder,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
    console.log(`  EQUIPMENT#${eq.id}: ${eq.name}`);
  }
}

async function seedExercises(): Promise<void> {
  const now = new Date().toISOString();
  for (const ex of EXERCISES) {
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'EXERCISE',
          sk: `EXERCISE#${ex.id}`,
          id: ex.id,
          name: ex.name,
          description: ex.description,
          imageUrl: '',
          notes: '',
          modifications: ex.modifications,
          tags: ex.tags,
          sortOrder: ex.sortOrder,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
    console.log(`  EXERCISE#${ex.id}: ${ex.name}`);
  }
}

async function seedWorkouts(): Promise<void> {
  const now = new Date().toISOString();
  for (const w of WORKOUTS) {
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'WORKOUT',
          sk: `WORKOUT#${w.id}`,
          id: w.id,
          title: w.title,
          description: w.description,
          category: w.category,
          difficulty: 'all-levels',
          duration: w.duration,
          exercises: w.exercises,
          equipment: w.equipment,
          tags: w.tags,
          imageUrl: '',
          requiredTier: 'Pup',
          status: 'published',
          sortOrder: w.sortOrder,
          notes: w.notes,
          createdBy: 'seed-script',
          createdAt: now,
          updatedAt: now,
        },
      })
    );
    console.log(`  WORKOUT#${w.id}: ${w.title}`);
  }
}

async function main(): Promise<void> {
  console.log(`Seeding Hyrax Fitness Program into: ${TABLE_NAME}`);
  console.log(`Region: ${REGION}`);
  if (profile) console.log(`Profile: ${profile}`);
  console.log('');

  console.log(`Seeding ${EQUIPMENT.length} equipment items...`);
  await seedEquipment();
  console.log('');

  console.log(`Seeding ${EXERCISES.length} exercises...`);
  await seedExercises();
  console.log('');

  console.log(`Seeding ${WORKOUTS.length} workouts...`);
  await seedWorkouts();
  console.log('');

  console.log(`Done! ${EQUIPMENT.length + EXERCISES.length + WORKOUTS.length} items seeded successfully.`);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
