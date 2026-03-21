import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// ── Logo cache ──
let _cachedLogo = null;

async function loadLogoBase64() {
  if (_cachedLogo) return _cachedLogo;
  try {
    const response = await fetch('/img/hyrax-fitness-logo-512x512.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        _cachedLogo = reader.result;
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Fetch an image URL and convert to base64 data URL.
 * Returns null on failure (graceful degradation).
 */
async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Brand colors
const COLORS = {
  ink: [27, 18, 10],
  paper: [251, 247, 230],
  sand: [211, 191, 151],
  rock: [164, 128, 81],
  earth: [101, 76, 43],
  sunset: [242, 133, 1],
  sunrise: [253, 185, 15],
  white: [255, 255, 255],
};

/**
 * Generate a branded Hyrax Fitness PDF for a workout.
 * @param {Object} workout - The workout data object
 * @param {Object} options - Generation options
 * @param {string} options.logoBase64 - Pre-loaded logo
 * @param {Object} options.exerciseData - Map of exerciseId -> full exercise objects
 * @param {string} options.activeDifficulty - User's selected difficulty
 * @param {Object} options.exerciseOverrides - Per-exercise difficulty overrides
 * @param {Object} options.userProfile - { givenName, familyName }
 * @param {Object} options.workoutStats - { completionCount, lastCompleted, logs }
 * @param {Object} options.imageCache - Pre-fetched exercise images { exerciseId: base64 }
 * @returns {jsPDF} The generated PDF document
 */
export function generateWorkoutPdf(workout, options = {}) {
  const {
    logoBase64 = null,
    exerciseData = {},
    activeDifficulty = 'beginner',
    exerciseOverrides = {},
    userProfile = null,
    userTier = null,
    workoutStats = null,
    imageCache = {},
    qrDataUrl = null,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ── Header Bar ──
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Brand accent line
  doc.setFillColor(...COLORS.sunset);
  doc.rect(0, 42, pageWidth, 3, 'F');

  // Logo in header (actual image is 817x625, ratio 1.307:1)
  const logoHeight = 22;
  const logoWidth = logoHeight * (817 / 625);
  const textOffsetX = logoBase64 ? margin + logoWidth + 4 : margin;
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 8, logoWidth, logoHeight);
  }

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text('HYRAX FITNESS', textOffsetX, 18);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.sand);
  doc.text('START-STOP SCRAMBLE & CARRY TRAINING', textOffsetX, 24);

  // User name (right-aligned)
  if (userProfile?.givenName || userProfile?.familyName) {
    const userName = [userProfile.givenName, userProfile.familyName].filter(Boolean).join(' ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(15);
    doc.setTextColor(...COLORS.sand);
    doc.text(`${userName}`, pageWidth - margin, 16, { align: 'right' });
  }

  // Tier capsule (right-aligned, below name)
  if (userTier) {
    const tierColors = {
      'Pup': COLORS.sand,
      'Rock Runner': COLORS.sunset,
      'Iron Dassie': COLORS.earth,
    };
    const capsuleColor = tierColors[userTier] || COLORS.sand;
    const tierLabel = userTier.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const tierTextWidth = doc.getTextWidth(tierLabel) + 6;
    const capsuleX = pageWidth - margin - tierTextWidth;
    const capsuleY = 20;
    doc.setFillColor(...capsuleColor);
    doc.roundedRect(capsuleX, capsuleY, tierTextWidth, 5.5, 2, 2, 'F');
    doc.setTextColor(...COLORS.white);
    doc.text(tierLabel, capsuleX + 3, capsuleY + 4);
  }

  // Date generated (right-aligned)
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.sand);
  doc.text(`${dateStr}`, pageWidth - margin, 32, { align: 'right' });

  y = 56;

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.ink);
  const titleLines = doc.splitTextToSize(workout.title || 'Workout', contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  // ── Meta badges ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let badgeX = margin;

  const diffLabel = activeDifficulty
    ? activeDifficulty.charAt(0).toUpperCase() + activeDifficulty.slice(1)
    : null;

  const badges = [
    { label: workout.category, color: COLORS.earth },
    { label: diffLabel, color: COLORS.sunset },
    { label: workout.duration, color: COLORS.rock },
  ].filter((b) => b.label);

  for (const badge of badges) {
    const text = badge.label.toUpperCase();
    const textWidth = doc.getTextWidth(text) + 8;
    doc.setFillColor(...badge.color);
    doc.roundedRect(badgeX, y - 4, textWidth, 7, 2, 2, 'F');
    doc.setTextColor(...COLORS.white);
    doc.text(text, badgeX + 4, y + 1);
    badgeX += textWidth + 4;
  }
  y += 14;

  // ── Description ──
  if (workout.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.ink);
    const descLines = doc.splitTextToSize(workout.description, contentWidth);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 8;
  }

  // ── Your Progress (personal stats) ──
  if (workoutStats && workoutStats.completionCount > 0) {
    y = checkPageBreak(doc, y, 30, pageHeight, margin);

    doc.setFillColor(251, 247, 230); // paper
    doc.setDrawColor(...COLORS.sunset);
    doc.setLineWidth(0.5);

    const statsBoxHeight = 22;
    doc.roundedRect(margin, y - 4, contentWidth, statsBoxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.sunset);
    doc.text('YOUR PROGRESS', margin + 5, y + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.ink);

    const statsLine = [];
    statsLine.push(`Completed: ${workoutStats.completionCount} time${workoutStats.completionCount === 1 ? '' : 's'}`);
    if (workoutStats.lastCompleted) {
      const lastDate = new Date(workoutStats.lastCompleted).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      statsLine.push(`Last: ${lastDate}`);
    }
    if (workoutStats.streak && workoutStats.streak > 1) {
      statsLine.push(`Streak: ${workoutStats.streak} days`);
    }
    doc.text(statsLine.join('   |   '), margin + 5, y + 11);

    y += statsBoxHeight + 6;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
  }

  // ── Warm-Up Section ──
  y = checkPageBreak(doc, y, 26, pageHeight, margin);

  doc.setFillColor(253, 248, 235); // warm cream
  const warmUpHeight = 20;
  doc.roundedRect(margin, y - 4, contentWidth, warmUpHeight, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.earth);
  doc.text('WARM-UP', margin + 5, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  const warmUpText = '5 minutes of light movement - walking, arm circles, hip openers, and dynamic stretches to prepare your body for the session ahead.';
  const warmUpLines = doc.splitTextToSize(warmUpText, contentWidth - 10);
  doc.text(warmUpLines, margin + 5, y + 9);

  y += warmUpHeight + 6;

  // ── Equipment ──
  const hasReferencedExercises = workout.exercises?.some((e) => e.exerciseId);
  const equipmentList = hasReferencedExercises
    ? deriveEquipment(workout, exerciseData, activeDifficulty, exerciseOverrides)
    : (workout.equipment || []);

  if (equipmentList.length > 0) {
    y = checkPageBreak(doc, y, 12 + equipmentList.length * 5.5, pageHeight, margin);

    const equipBoxHeight = 10 + equipmentList.length * 5.5;
    doc.setFillColor(...COLORS.paper);
    doc.roundedRect(margin, y - 4, contentWidth, equipBoxHeight, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.earth);
    doc.text('EQUIPMENT NEEDED', margin + 5, y + 2);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    for (const item of equipmentList) {
      doc.setFillColor(...COLORS.sunset);
      doc.circle(margin + 7, y - 1, 1.2, 'F');
      doc.text(item, margin + 12, y);
      y += 5.5;
    }
    y += 6;
  }

  // ── Exercises ──
  if (workout.exercises && workout.exercises.length > 0) {
    y = checkPageBreak(doc, y, 20, pageHeight, margin);

    // Section heading
    doc.setFillColor(...COLORS.sunset);
    doc.rect(margin, y - 1, 4, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.ink);
    doc.text('EXERCISES', margin + 8, y + 5);
    y += 16;

    workout.exercises.forEach((exercise, index) => {
      y = checkPageBreak(doc, y, 35, pageHeight, margin);

      const isLegacy = !exercise.exerciseId;
      const full = isLegacy ? null : exerciseData[exercise.exerciseId];
      const effectiveDiff = isLegacy
        ? null
        : exerciseOverrides[exercise.exerciseId] || activeDifficulty;
      const mod = full?.modifications?.[effectiveDiff];
      const displayName = isLegacy
        ? (exercise.name || `Exercise ${index + 1}`)
        : (exercise.exerciseName || full?.name || `Exercise ${index + 1}`);

      // Check for exercise image
      const modImageUrl = mod?.imageUrl || full?.imageUrl;
      const imageB64 = exercise.exerciseId ? imageCache[exercise.exerciseId] : null;
      const hasImage = !!imageB64;
      const imgW = 25;
      const imgH = 25;
      const textWidth = hasImage ? contentWidth - imgW - 8 : contentWidth - 14;

      // Exercise number circle
      doc.setFillColor(...COLORS.sunset);
      doc.circle(margin + 5, y, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.white);
      doc.text(String(index + 1), margin + 5, y + 1, { align: 'center' });

      // Exercise image (right-aligned)
      const imgStartY = y - 5;
      if (hasImage) {
        try {
          doc.addImage(imageB64, 'JPEG', pageWidth - margin - imgW, imgStartY, imgW, imgH);
        } catch {
          // Skip image on failure
        }
      }

      // Exercise name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.ink);
      doc.text(displayName, margin + 14, y + 1);
      y += 6;

      // Modification name (subName)
      if (mod?.subName) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.sunset);
        doc.text(`Modification: ${mod.subName}`, margin + 14, y);
        y += 4.5;
      }

      // Per-exercise difficulty override indicator
      if (!isLegacy && exerciseOverrides[exercise.exerciseId]) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.rock);
        const overrideLabel = exerciseOverrides[exercise.exerciseId].charAt(0).toUpperCase() +
          exerciseOverrides[exercise.exerciseId].slice(1);
        doc.text(`[${overrideLabel}]`, margin + 14, y);
        y += 4;
      }

      // Modification description
      if (mod?.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.earth);
        const modDescLines = doc.splitTextToSize(mod.description, textWidth);
        doc.text(modDescLines, margin + 14, y);
        y += modDescLines.length * 4 + 2;
      }

      // Sets / Reps / Rest / Duration row
      const details = [];
      if (exercise.sets) details.push(`Sets: ${exercise.sets}`);
      if (exercise.reps) details.push(`Reps: ${exercise.reps}`);
      if (exercise.rest) details.push(`Rest: ${exercise.rest}`);
      if (exercise.duration) details.push(`Duration: ${exercise.duration}`);

      if (details.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...COLORS.rock);
        doc.text(details.join('  |  '), margin + 14, y);
        y += 5.5;
      }

      // Notes
      const noteText = mod?.notes || exercise.notes;
      if (noteText) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.earth);
        const noteLines = doc.splitTextToSize(noteText, textWidth);
        doc.text(noteLines, margin + 14, y);
        y += noteLines.length * 4.5;
      }

      // Equipment for this exercise
      if (mod?.equipment && mod.equipment.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.rock);
        const equipStr = mod.equipment.map((eq) => eq.equipmentName).join(', ');
        doc.text(`Equipment: ${equipStr}`, margin + 14, y);
        y += 4.5;
      }

      // Progression tip
      if (workoutStats?.exerciseHistory && exercise.exerciseId) {
        const exHistory = workoutStats.exerciseHistory[exercise.exerciseId];
        if (exHistory && exHistory.count >= 8 && effectiveDiff !== 'elite') {
          const nextDiff = getNextDifficulty(effectiveDiff);
          if (nextDiff) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(...COLORS.sunrise);
            const tipLabel = nextDiff.charAt(0).toUpperCase() + nextDiff.slice(1);
            doc.text(
              `Tip: You've logged this ${exHistory.count} times at this level \u2014 consider trying ${tipLabel}!`,
              margin + 14, y
            );
            y += 4.5;
          }
        }
      }

      // Ensure y is past image if one was drawn
      if (hasImage) {
        const imgEndY = imgStartY + imgH + 2;
        if (y < imgEndY) y = imgEndY;
      }

      y += 6;
    });
  }

  // ── Workout Structure Notes ──
  if (workout.notes) {
    y = checkPageBreak(doc, y, 20, pageHeight, margin);

    doc.setFillColor(...COLORS.paper);
    const notesLines = doc.splitTextToSize(workout.notes, contentWidth - 10);
    const notesBoxHeight = 12 + notesLines.length * 4.5;
    doc.roundedRect(margin, y - 4, contentWidth, notesBoxHeight, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.earth);
    doc.text('WORKOUT NOTES', margin + 5, y + 2);
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.ink);
    doc.text(notesLines, margin + 5, y);
    y += notesLines.length * 4.5 + 8;
  }

  // ── Bask / Cooldown Section ──
  y = checkPageBreak(doc, y, 26, pageHeight, margin);

  doc.setFillColor(245, 240, 225); // warm neutral
  const baskHeight = 24;
  doc.roundedRect(margin, y - 4, contentWidth, baskHeight, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.earth);
  doc.text('BASK \u2014 COOLDOWN', margin + 5, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  const baskText = 'Take 5\u201310 minutes to bask in your effort. Slow your breathing, walk it off, and stretch the major muscle groups used. ' +
    'Hydrate, reflect on what felt strong, and note any areas to focus on next time.';
  const baskLines = doc.splitTextToSize(baskText, contentWidth - 10);
  doc.text(baskLines, margin + 5, y + 9);

  y += baskHeight + 6;

  // ── QR Code link back to workout ──
  const qrSize = 35; // mm — large enough for easy mobile scanning
  const qrSectionHeight = qrDataUrl ? qrSize + 8 : 20;
  y = checkPageBreak(doc, y, qrSectionHeight, pageHeight, margin);

  const workoutUrl = `https://hyraxfitness.com/portal/workouts/${workout.id || ''}`;
  const textAreaWidth = qrDataUrl ? contentWidth - qrSize - 10 : contentWidth;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.rock);
  const qrHeadingLines = doc.splitTextToSize(
    'Log your completion online at the URL below or scan this QR code:',
    textAreaWidth
  );
  doc.text(qrHeadingLines, margin, y);

  doc.setTextColor(...COLORS.sunset);
  doc.setFontSize(12);
  doc.textWithLink(workoutUrl, margin, y + qrHeadingLines.length * 6 + 2, { url: workoutUrl });

  // QR code image (right-aligned)
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - qrSize, y - 4, qrSize, qrSize);
    } catch {
      // Skip QR on failure
    }
  }

  y += qrSectionHeight;

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Watermark
    if (logoBase64) {
      const watermarkW = pageWidth * 0.5;
      const watermarkH = watermarkW * (625 / 817);
      const watermarkX = (pageWidth - watermarkW) / 2;
      const watermarkY = (pageHeight - watermarkH) / 2;
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.03 }));
      doc.addImage(logoBase64, 'PNG', watermarkX, watermarkY, watermarkW, watermarkH);
      doc.restoreGraphicsState();
    }

    // Footer line
    doc.setDrawColor(...COLORS.sand);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.rock);
    doc.text('hyraxfitness.com', margin, pageHeight - 10);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, {
      align: 'right',
    });

    // Copyright
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.sand);
    doc.text(
      `\u00A9 ${new Date().getFullYear()} Hyrax Fitness. All rights reserved.`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Download the PDF for a workout with full context.
 * @param {Object} workout - The workout data
 * @param {Object} options - { exerciseData, activeDifficulty, exerciseOverrides, userProfile, workoutStats }
 */
export async function downloadWorkoutPdf(workout, options = {}) {
  const logoBase64 = await loadLogoBase64();

  // Pre-fetch exercise images
  const imageCache = {};
  const { exerciseData = {}, activeDifficulty = 'beginner', exerciseOverrides = {} } = options;

  if (workout.exercises) {
    const imagePromises = workout.exercises
      .filter((ex) => ex.exerciseId)
      .map(async (ex) => {
        const full = exerciseData[ex.exerciseId];
        const effectiveDiff = exerciseOverrides[ex.exerciseId] || activeDifficulty;
        const mod = full?.modifications?.[effectiveDiff];
        const imgUrl = mod?.imageUrl || full?.imageUrl;
        if (imgUrl) {
          const b64 = await fetchImageAsBase64(imgUrl);
          if (b64) imageCache[ex.exerciseId] = b64;
        }
      });
    await Promise.all(imagePromises);
  }

  // Generate QR code for workout URL
  let qrDataUrl = null;
  try {
    const workoutUrl = `https://hyraxfitness.com/portal/workouts/${workout.id || ''}`;
    qrDataUrl = await QRCode.toDataURL(workoutUrl, { width: 200, margin: 1 });
  } catch {
    // QR generation is best-effort
  }

  const doc = generateWorkoutPdf(workout, {
    ...options,
    logoBase64,
    imageCache,
    qrDataUrl,
  });

  const filename = `hyrax-${(workout.title || 'workout')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.pdf`;
  doc.save(filename);
}

/**
 * Derive equipment list from exercise modifications at selected difficulty.
 */
function deriveEquipment(workout, exerciseData, activeDifficulty, exerciseOverrides) {
  const equipMap = new Map();
  (workout.exercises || []).forEach((ex) => {
    if (!ex.exerciseId) return;
    const full = exerciseData[ex.exerciseId];
    if (!full?.modifications) return;
    const diff = exerciseOverrides[ex.exerciseId] || activeDifficulty;
    const mod = full.modifications[diff];
    if (mod?.equipment) {
      mod.equipment.forEach((eq) => {
        equipMap.set(eq.equipmentId, eq.equipmentName);
      });
    }
  });
  return Array.from(equipMap.values());
}

/**
 * Get the next difficulty level up.
 */
function getNextDifficulty(current) {
  const levels = ['beginner', 'intermediate', 'advanced', 'elite'];
  const idx = levels.indexOf(current);
  return idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
}

/**
 * Check if we need a page break; if so, add a new page and reset y.
 */
function checkPageBreak(doc, y, needed, pageHeight, margin) {
  if (y + needed > pageHeight - 22) {
    doc.addPage();
    return margin + 10;
  }
  return y;
}
