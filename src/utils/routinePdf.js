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

const COLORS = {
  ink:     [27, 18, 10],
  paper:   [251, 247, 230],
  sand:    [211, 191, 151],
  rock:    [164, 128, 81],
  earth:   [101, 76, 43],
  sunset:  [242, 133, 1],
  sunrise: [253, 185, 15],
  white:   [255, 255, 255],
};

const TIER_COLORS = {
  'Pup':          COLORS.sand,
  'Rock Runner':  COLORS.sunset,
  'Iron Dassie':  COLORS.earth,
};

const LINE_HEIGHT = 4; // mm per line for 8pt text
const SM_LINE_HEIGHT = 3.5; // mm per line for 7pt text

/** Strip em-dashes, emojis, and other problematic characters */
function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013\u2012]/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/[\u{1F600}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .trim();
}

function checkPageBreak(doc, y, needed, pageHeight, margin) {
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin + 10;
  }
  return y;
}

/**
 * Pre-calculate total height an exercise entry will need.
 */
function calcExerciseHeight(doc, ex, textWidth) {
  let h = 12; // name line + prescription line + spacing

  // Level badge line
  if (ex.modificationLevel) h += 4;

  // Modification text
  if (ex.modificationName || ex.modificationDescription) {
    doc.setFontSize(7);
    const modText = sanitize(ex.modificationName || '') +
      (ex.modificationDescription ? ': ' + sanitize(ex.modificationDescription) : '');
    const modLines = doc.splitTextToSize(modText, textWidth);
    h += modLines.length * SM_LINE_HEIGHT + 1;
  }

  // Equipment
  if (ex.equipment?.length > 0) h += SM_LINE_HEIGHT;

  // Notes
  if (ex.notes) {
    doc.setFontSize(7);
    const noteLines = doc.splitTextToSize(sanitize(ex.notes), textWidth);
    h += noteLines.length * SM_LINE_HEIGHT + 1;
  }

  h += 4; // bottom padding + separator
  return h;
}

/**
 * Generate and download a PDF for an AI-generated daily workout.
 */
export async function downloadRoutinePdf(workout, options = {}) {
  if (!workout) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const exTextWidth = contentWidth - 14; // text area for exercise content (after circle + gap)

  // Load logo
  const logo = await loadLogoBase64();

  let y = margin;

  // ── Header Bar ──
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 44, 'F');
  doc.setFillColor(...COLORS.sunset);
  doc.rect(0, 44, pageWidth, 1.5, 'F');

  // Logo — square aspect ratio, not squished, positioned with breathing room
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin - 7, 8, 35, 27);
    } catch { /* skip if logo fails */ }
  }
  const textStart = logo ? margin + 37 : margin;

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HYRAX FITNESS', textStart, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.sunrise);
  doc.text('Custom Daily Workout', textStart, 19);

  // Workout title in header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  const title = sanitize(workout.title || 'Daily Workout');
  const titleLines = doc.splitTextToSize(title, contentWidth - 70);
  doc.text(titleLines[0] || title, textStart, 25);

  // Type badge
  const typeBadge = workout.type === 'rest' ? 'REST DAY' : workout.type === 'active_recovery' ? 'ACTIVE RECOVERY' : 'TRAINING';
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.sunrise);
  doc.text(typeBadge, textStart, 31);

  // Duration + Focus
  if (workout.duration || workout.focus?.length) {
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    const metaParts = [];
    if (workout.duration) metaParts.push(sanitize(workout.duration));
    if (workout.focus?.length) metaParts.push(workout.focus.map(t => t.replace(/[-_]/g, ' ')).join(', '));
    doc.text(metaParts.join('  |  '), textStart, 37);
  }

  // Right side: User info
  const userName = options.userProfile
    ? [options.userProfile.givenName, options.userProfile.familyName].filter(Boolean).join(' ')
    : '';
  if (userName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(userName, pageWidth - margin, 15, { align: 'right' });
  }

  if (options.userTier) {
    const tierColor = TIER_COLORS[options.userTier] || COLORS.sand;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const tierText = options.userTier;
    const tierWidth = doc.getTextWidth(tierText) + 8;
    const tierX = pageWidth - margin - tierWidth;
    doc.setFillColor(...tierColor);
    doc.roundedRect(tierX, 19, tierWidth, 6, 3, 3, 'F');
    doc.setTextColor(...COLORS.white);
    doc.text(tierText, tierX + tierWidth / 2, 23, { align: 'center' });
  }

  // Date
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const dateStr = workout.date
    ? new Date(workout.date + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(dateStr, pageWidth - margin, 32, { align: 'right' });

  y = 54;

  // --- End Header ---
  // --- Begin Main Content ---

  // Workout title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.earth);
  doc.text(titleLines[0] || title, margin, y);
  y += 6;

  // ── Coaching Notes ──
  if (workout.coachingNotes) {
    const notes = sanitize(workout.coachingNotes);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.earth);
    const lines = doc.splitTextToSize(notes, contentWidth);
    y = checkPageBreak(doc, y, lines.length * LINE_HEIGHT + 6, pageHeight, margin);
    doc.text(lines, margin, y);
    y += lines.length * LINE_HEIGHT;
  }

  // ── Warm-Up ──
  if (workout.warmUp && workout.type !== 'rest') {
    const warmText = sanitize(workout.warmUp.description || '');
    doc.setFontSize(8);
    const warmLines = doc.splitTextToSize(warmText, contentWidth - 10);
    const boxHeight = 12 + warmLines.length * LINE_HEIGHT + 2;

    y = checkPageBreak(doc, y, boxHeight + 4, pageHeight, margin);
    doc.setFillColor(255, 245, 230);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.sunset);
    doc.text('WARM-UP' + (workout.warmUp.duration ? '  (' + sanitize(workout.warmUp.duration) + ')' : ''), margin + 5, y + 7);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    for (let li = 0; li < warmLines.length; li++) {
      doc.text(warmLines[li], margin + 5, y + 13 + li * LINE_HEIGHT);
    }

    y += boxHeight + 6;
  }

  // ── Exercises ──
  if (workout.exercises?.length > 0 && workout.type !== 'rest') {
    y = checkPageBreak(doc, y, 12, pageHeight, margin);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    doc.text('EXERCISES (' + workout.exercises.length + ')', margin, y);
    y += 7;

    for (let i = 0; i < workout.exercises.length; i++) {
      const ex = workout.exercises[i];

      // Pre-calculate height for this exercise
      const exHeight = calcExerciseHeight(doc, ex, exTextWidth);
      y = checkPageBreak(doc, y, exHeight, pageHeight, margin);

      // Alternate row background — drawn at calculated height
      if (i % 2 === 0) {
        doc.setFillColor(250, 248, 242);
        doc.rect(margin, y - 3, contentWidth, exHeight, 'F');
      }

      // Number circle — center is at (margin+4, y+2), radius 3.5
      doc.setFillColor(...COLORS.sunset);
      doc.circle(margin + 5, y + 2.5, 3.5, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), margin + 5, y + 3.5, { align: 'center' });

      // Exercise name
      const exName = sanitize(ex.exerciseName || 'Exercise');
      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(exName, margin + 11, y + 3);

      // Prescription line
      const prescParts = [];
      if (ex.sets && ex.reps) prescParts.push(ex.sets + ' x ' + ex.reps);
      if (ex.duration && !ex.reps) prescParts.push(sanitize(ex.duration));
      if (ex.rest) prescParts.push(sanitize(ex.rest) + ' rest');
      if (prescParts.length) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.rock);
        doc.text(prescParts.join('  |  '), margin + 11, y + 8);
      }
      y += 11;

      // Modification level badge — on its own line below name
      if (ex.modificationLevel) {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.sunset);
        doc.text(ex.modificationLevel.toUpperCase(), margin + 11, y);
        y += 4;
      }

      // Modification name + description
      if (ex.modificationName || ex.modificationDescription) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.earth);
        const modText = sanitize(ex.modificationName || '') +
          (ex.modificationDescription ? ': ' + sanitize(ex.modificationDescription) : '');
        const modLines = doc.splitTextToSize(modText, exTextWidth);
        for (let li = 0; li < modLines.length; li++) {
          doc.text(modLines[li], margin + 11, y);
          y += SM_LINE_HEIGHT;
        }
        y += 1;
      }

      // Equipment
      if (ex.equipment?.length > 0) {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.rock);
        doc.text('Equipment: ' + ex.equipment.map(e => e.equipmentName).join(', '), margin + 11, y);
        y += SM_LINE_HEIGHT;
      }

      // Notes
      if (ex.notes) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.earth);
        const noteLines = doc.splitTextToSize(sanitize(ex.notes), exTextWidth);
        for (let li = 0; li < noteLines.length; li++) {
          doc.text(noteLines[li], margin + 11, y);
          y += SM_LINE_HEIGHT;
        }
        y += 1;
      }

      y += 3;

      // Separator line
      if (i < workout.exercises.length - 1) {
        doc.setDrawColor(230, 225, 215);
        doc.line(margin + 11, y - 2, margin + contentWidth, y - 2);
      }

      y += 2;
    }

    // Remove excess padding.
    y -= 2;
  }

  // ── Bask (Cooldown) ──
  if (workout.bask && workout.type !== 'rest') {
    const baskText = sanitize(workout.bask.description || '');
    doc.setFontSize(8);
    const baskLines = doc.splitTextToSize(baskText, contentWidth - 10);
    const boxHeight = 12 + baskLines.length * LINE_HEIGHT + 2;

    y = checkPageBreak(doc, y, boxHeight + 8, pageHeight, margin);
    y += 4;
    doc.setFillColor(235, 245, 240);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text('BASK (COOLDOWN)' + (workout.bask.duration ? '  (' + sanitize(workout.bask.duration) + ')' : ''), margin + 5, y + 7);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    for (let li = 0; li < baskLines.length; li++) {
      doc.text(baskLines[li], margin + 5, y + 13 + li * LINE_HEIGHT);
    }

    y += boxHeight + 6;
  }

  // ── Progression + Next Day ──
  if (workout.progressionContext || workout.nextDayHint) {
    if (workout.progressionContext) {
      doc.setFontSize(8);
      const progText = sanitize(workout.progressionContext);
      const progLines = doc.splitTextToSize(progText, contentWidth - 28);
      const progHeight = 6 + progLines.length * LINE_HEIGHT;
      y = checkPageBreak(doc, y, progHeight, pageHeight, margin);
      y += 2;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text('Progression:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      for (let li = 0; li < progLines.length; li++) {
        doc.text(progLines[li], margin + 24, y + li * LINE_HEIGHT);
      }
      y += progLines.length * LINE_HEIGHT + 4;
    }

    if (workout.nextDayHint) {
      doc.setFontSize(8);
      const hintText = sanitize(workout.nextDayHint);
      const hintLines = doc.splitTextToSize(hintText, contentWidth - 24);
      const hintHeight = 4 + hintLines.length * LINE_HEIGHT;
      y = checkPageBreak(doc, y, hintHeight, pageHeight, margin);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text('Tomorrow:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      for (let li = 0; li < hintLines.length; li++) {
        doc.text(hintLines[li], margin + 24, y + li * LINE_HEIGHT);
      }
      y += hintLines.length * LINE_HEIGHT + 4;
    }
  }

  // ── QR Code + URL ──
  y = checkPageBreak(doc, y, 42, pageHeight, margin);
  y += 6;
  const workoutUrl = 'https://hyraxfitness.com/portal/routine';
  try {
    const qrDataUrl = await QRCode.toDataURL(workoutUrl, { width: 200, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', margin, y, 28, 28);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.rock);
    doc.setFontSize(14);
    doc.text('Track your progress and set benchmarks!', margin + 32, y + 8);
    doc.setFontSize(10);
    doc.text('Log your completion online:', margin + 32, y + 16);
    doc.setTextColor(...COLORS.sunset);
    doc.setFontSize(12);
    doc.text(workoutUrl, margin + 32, y + 24);
  } catch {
    // QR generation failed, skip
  }

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Watermark
    if (logo) {
      const watermarkW = pageWidth * 0.5;
      const watermarkH = watermarkW * (625 / 817);
      const watermarkX = (pageWidth - watermarkW) / 2;
      const watermarkY = (pageHeight - watermarkH) / 2;
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.03 }));
      doc.addImage(logo, 'PNG', watermarkX, watermarkY, watermarkW, watermarkH);
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

  // Save
  const fileName = 'hyrax-routine-' + (workout.date || 'today') + '.pdf';
  doc.save(fileName);
}
