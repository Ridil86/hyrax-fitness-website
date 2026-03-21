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

/** Strip em-dashes, emojis, and other problematic characters */
function sanitize(text) {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013\u2012]/g, '-')  // em-dash, en-dash, figure dash
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    // Remove emojis and other non-BMP characters
    .replace(/[\u{1F600}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // variation selectors
    .replace(/[\u{200D}]/gu, '')              // zero-width joiner
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
 * Generate and download a PDF for an AI-generated daily workout.
 * Layout matches the branded workout PDF style from workoutPdf.js.
 */
export async function downloadRoutinePdf(workout, options = {}) {
  if (!workout) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Load logo
  const logo = await loadLogoBase64();

  let y = margin;

  // ── Header Bar ──
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 48, 'F');
  doc.setFillColor(...COLORS.sunset);
  doc.rect(0, 48, pageWidth, 1.5, 'F');

  // Logo
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 5, 16, 16);
    } catch { /* skip if logo fails */ }
  }
  const textStart = logo ? margin + 20 : margin;

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HYRAX FITNESS', textStart, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.sunrise);
  doc.text('AI-Generated Daily Workout', textStart, 20);

  // Workout title in header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  const title = sanitize(workout.title || 'Daily Workout');
  const titleLines = doc.splitTextToSize(title, contentWidth - 60);
  doc.text(titleLines[0] || title, textStart, 30);

  // Type badge
  const typeBadge = workout.type === 'rest' ? 'REST DAY' : workout.type === 'active_recovery' ? 'ACTIVE RECOVERY' : 'TRAINING';
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.sunrise);
  doc.text(typeBadge, textStart, 36);

  // Duration + Focus
  if (workout.duration || workout.focus?.length) {
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    const metaParts = [];
    if (workout.duration) metaParts.push(sanitize(workout.duration));
    if (workout.focus?.length) metaParts.push(workout.focus.map(t => t.replace(/[-_]/g, ' ')).join(', '));
    doc.text(metaParts.join('  |  '), textStart, 42);
  }

  // Right side: User info
  const userName = options.userProfile
    ? [options.userProfile.givenName, options.userProfile.familyName].filter(Boolean).join(' ')
    : '';
  if (userName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(userName, pageWidth - margin, 14, { align: 'right' });
  }

  if (options.userTier) {
    const tierColor = TIER_COLORS[options.userTier] || COLORS.sand;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const tierText = options.userTier;
    const tierWidth = doc.getTextWidth(tierText) + 8;
    const tierX = pageWidth - margin - tierWidth;
    doc.setFillColor(...tierColor);
    doc.roundedRect(tierX, 17, tierWidth, 7, 3, 3, 'F');
    doc.setTextColor(...COLORS.white);
    doc.text(tierText, tierX + tierWidth / 2, 22, { align: 'center' });
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
  doc.text(dateStr, pageWidth - margin, 30, { align: 'right' });

  y = 58;

  // ── Coaching Notes ──
  if (workout.coachingNotes) {
    const notes = sanitize(workout.coachingNotes);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.earth);
    const lines = doc.splitTextToSize(notes, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 3.5 + 6;
  }

  // ── Warm-Up ──
  if (workout.warmUp && workout.type !== 'rest') {
    const warmText = sanitize(workout.warmUp.description || '');
    const warmLines = doc.splitTextToSize(warmText, contentWidth - 10);
    const boxHeight = 10 + warmLines.length * 3.5 + 4;

    y = checkPageBreak(doc, y, boxHeight + 4, pageHeight, margin);
    doc.setFillColor(255, 245, 230);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.sunset);
    doc.text(`WARM-UP${workout.warmUp.duration ? '  (' + sanitize(workout.warmUp.duration) + ')' : ''}`, margin + 5, y + 6);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    doc.text(warmLines, margin + 5, y + 12);

    y += boxHeight + 6;
  }

  // ── Exercises ──
  if (workout.exercises?.length > 0 && workout.type !== 'rest') {
    y = checkPageBreak(doc, y, 12, pageHeight, margin);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    doc.text(`EXERCISES (${workout.exercises.length})`, margin, y);
    y += 7;

    for (let i = 0; i < workout.exercises.length; i++) {
      const ex = workout.exercises[i];
      y = checkPageBreak(doc, y, 22, pageHeight, margin);

      // Alternate row background
      if (i % 2 === 0) {
        doc.setFillColor(250, 248, 242);
        doc.rect(margin, y - 3, contentWidth, 20, 'F');
      }

      // Number circle
      doc.setFillColor(...COLORS.sunset);
      doc.circle(margin + 4, y + 2, 3, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), margin + 4, y + 3.2, { align: 'center' });

      // Exercise name
      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(sanitize(ex.exerciseName || 'Exercise'), margin + 11, y + 3);

      // Modification level badge
      if (ex.modificationLevel) {
        const levelText = ex.modificationLevel.toUpperCase();
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.sunset);
        const nameWidth = doc.getTextWidth(sanitize(ex.exerciseName || 'Exercise'));
        doc.setFontSize(9);
        doc.setFontSize(6);
        doc.text(levelText, margin + 11 + nameWidth + 4, y + 3);
      }

      // Prescription line
      const prescParts = [];
      if (ex.sets && ex.reps) prescParts.push(`${ex.sets} x ${ex.reps}`);
      if (ex.duration && !ex.reps) prescParts.push(sanitize(ex.duration));
      if (ex.rest) prescParts.push(`${sanitize(ex.rest)} rest`);
      if (prescParts.length) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.rock);
        doc.text(prescParts.join('  |  '), margin + 11, y + 7.5);
      }
      y += 10;

      // Modification name + description (compact)
      if (ex.modificationName || ex.modificationDescription) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.earth);
        const modText = sanitize(ex.modificationName || '') +
          (ex.modificationDescription ? ': ' + sanitize(ex.modificationDescription) : '');
        const modLines = doc.splitTextToSize(modText, contentWidth - 14);
        doc.text(modLines.slice(0, 2), margin + 11, y);
        y += Math.min(modLines.length, 2) * 3 + 1;
      }

      // Equipment
      if (ex.equipment?.length > 0) {
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.rock);
        doc.text('Equip: ' + ex.equipment.map(e => e.equipmentName).join(', '), margin + 11, y);
        y += 3.5;
      }

      // Notes (1 line max)
      if (ex.notes) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.earth);
        const noteText = sanitize(ex.notes);
        const noteLine = doc.splitTextToSize(noteText, contentWidth - 14);
        doc.text(noteLine[0] || noteText, margin + 11, y);
        y += 4;
      }

      y += 3;

      // Separator
      if (i < workout.exercises.length - 1) {
        doc.setDrawColor(230, 225, 215);
        doc.line(margin + 11, y - 2, margin + contentWidth, y - 2);
      }
    }
  }

  // ── Bask (Cooldown) ──
  if (workout.bask && workout.type !== 'rest') {
    const baskText = sanitize(workout.bask.description || '');
    const baskLines = doc.splitTextToSize(baskText, contentWidth - 10);
    const boxHeight = 10 + baskLines.length * 3.5 + 4;

    y = checkPageBreak(doc, y, boxHeight + 8, pageHeight, margin);
    y += 4;
    doc.setFillColor(235, 245, 240);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text(`BASK (COOLDOWN)${workout.bask.duration ? '  (' + sanitize(workout.bask.duration) + ')' : ''}`, margin + 5, y + 6);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    doc.text(baskLines, margin + 5, y + 12);

    y += boxHeight + 6;
  }

  // ── Progression + Next Day ──
  if (workout.progressionContext || workout.nextDayHint) {
    y = checkPageBreak(doc, y, 16, pageHeight, margin);
    y += 2;

    if (workout.progressionContext) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text('Progression:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      const progLines = doc.splitTextToSize(sanitize(workout.progressionContext), contentWidth - 28);
      doc.text(progLines.slice(0, 2), margin + 26, y);
      y += Math.min(progLines.length, 2) * 3.5 + 4;
    }

    if (workout.nextDayHint) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text('Tomorrow:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      const hintText = sanitize(workout.nextDayHint);
      const hintTrunc = hintText.length > 100 ? hintText.slice(0, 100) + '...' : hintText;
      doc.text(hintTrunc, margin + 22, y);
      y += 6;
    }
  }

  // ── QR Code + URL ──
  y = checkPageBreak(doc, y, 42, pageHeight, margin);
  y += 6;
  const workoutUrl = 'https://hyraxfitness.com/portal/routine';
  try {
    const qrDataUrl = await QRCode.toDataURL(workoutUrl, { width: 200, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', margin, y, 28, 28);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.rock);
    doc.text('Log your completion online:', margin + 32, y + 12);
    doc.setTextColor(...COLORS.sunset);
    doc.setFontSize(7);
    doc.text(workoutUrl, margin + 32, y + 17);
  } catch {
    // QR generation failed, skip
  }

  // ── Footer ──
  const footerY = pageHeight - 8;
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.sand);
  doc.text('Generated by Hyrax Fitness AI Training Assistant', margin, footerY);
  doc.text('hyraxfitness.com', pageWidth - margin, footerY, { align: 'right' });

  // Save
  const fileName = `hyrax-routine-${workout.date || 'today'}.pdf`;
  doc.save(fileName);
}
