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

const LINE_HEIGHT = 4.8; // mm per line for ~9.5pt text
const SM_LINE_HEIGHT = 4.2; // mm per line for ~8.5pt text

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
  let h = 15; // name line + prescription line + spacing

  // Level badge line
  if (ex.modificationLevel) h += 5;

  // Modification text
  if (ex.modificationName || ex.modificationDescription) {
    doc.setFontSize(8.5);
    const modText = sanitize(ex.modificationName || '') +
      (ex.modificationDescription ? ': ' + sanitize(ex.modificationDescription) : '');
    const modLines = doc.splitTextToSize(modText, textWidth);
    h += modLines.length * SM_LINE_HEIGHT + 1;
  }

  // Equipment
  if (ex.equipment?.length > 0) h += SM_LINE_HEIGHT;

  // Notes
  if (ex.notes) {
    doc.setFontSize(8.5);
    const noteLines = doc.splitTextToSize(sanitize(ex.notes), textWidth);
    h += noteLines.length * SM_LINE_HEIGHT + 1;
  }

  h += 5; // bottom padding + separator
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
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.earth);
  doc.text(titleLines[0] || title, margin, y);
  y += 6;

  // ── Coaching Notes ──
  if (workout.coachingNotes) {
    const notes = sanitize(workout.coachingNotes);
    doc.setFontSize(10);
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
    doc.setFontSize(9.5);
    const warmLines = doc.splitTextToSize(warmText, contentWidth - 10);
    const boxHeight = 14 + warmLines.length * LINE_HEIGHT + 2;

    y = checkPageBreak(doc, y, boxHeight + 4, pageHeight, margin);
    doc.setFillColor(255, 245, 230);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.sunset);
    doc.text('WARM-UP' + (workout.warmUp.duration ? '  (' + sanitize(workout.warmUp.duration) + ')' : ''), margin + 5, y + 8);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    for (let li = 0; li < warmLines.length; li++) {
      doc.text(warmLines[li], margin + 5, y + 15 + li * LINE_HEIGHT);
    }

    y += boxHeight + 8;
  }

  // ── Exercises ──
  if (workout.exercises?.length > 0 && workout.type !== 'rest') {
    y = checkPageBreak(doc, y, 14, pageHeight, margin);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    doc.text('EXERCISES (' + workout.exercises.length + ')', margin, y);
    y += 8;

    for (let i = 0; i < workout.exercises.length; i++) {
      const ex = workout.exercises[i];

      // Estimate height for page break check (generous overestimate is fine)
      const estHeight = calcExerciseHeight(doc, ex, exTextWidth);
      y = checkPageBreak(doc, y, estHeight, pageHeight, margin);

      // Record start position for zebra stripe
      const exStartY = y - 3;
      const exStartPage = doc.getCurrentPageInfo().pageNumber;

      // Number circle - radius 4
      doc.setFillColor(...COLORS.sunset);
      doc.circle(margin + 5, y + 3, 4, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), margin + 5, y + 4.2, { align: 'center' });

      // Exercise name
      const exName = sanitize(ex.exerciseName || 'Exercise');
      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(exName, margin + 12, y + 4);

      // Prescription line
      const prescParts = [];
      if (ex.sets && ex.reps) prescParts.push(ex.sets + ' x ' + ex.reps);
      if (ex.duration && !ex.reps) prescParts.push(sanitize(ex.duration));
      if (ex.rest) prescParts.push(sanitize(ex.rest) + ' rest');
      if (prescParts.length) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.rock);
        doc.text(prescParts.join('  |  '), margin + 12, y + 9.5);
      }
      y += 13;

      // Modification level badge - on its own line below name
      if (ex.modificationLevel) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.sunset);
        doc.text(ex.modificationLevel.toUpperCase(), margin + 12, y);
        y += 5;
      }

      // Modification name + description
      if (ex.modificationName || ex.modificationDescription) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.earth);
        const modText = sanitize(ex.modificationName || '') +
          (ex.modificationDescription ? ': ' + sanitize(ex.modificationDescription) : '');
        const modLines = doc.splitTextToSize(modText, exTextWidth);
        for (let li = 0; li < modLines.length; li++) {
          doc.text(modLines[li], margin + 12, y);
          y += SM_LINE_HEIGHT;
        }
        y += 1;
      }

      // Equipment
      if (ex.equipment?.length > 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.rock);
        doc.text('Equipment: ' + ex.equipment.map(e => e.equipmentName).join(', '), margin + 12, y);
        y += SM_LINE_HEIGHT;
      }

      // Notes
      if (ex.notes) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.earth);
        const noteLines = doc.splitTextToSize(sanitize(ex.notes), exTextWidth);
        for (let li = 0; li < noteLines.length; li++) {
          doc.text(noteLines[li], margin + 12, y);
          y += SM_LINE_HEIGHT;
        }
        y += 1;
      }

      y += 4;

      // Draw zebra stripe BEHIND the content we just rendered (using actual measured height)
      // Only works if exercise didn't cross a page break
      const exEndPage = doc.getCurrentPageInfo().pageNumber;
      if (i % 2 === 0 && exStartPage === exEndPage) {
        const actualHeight = (y - 2) - exStartY;
        const currentPage = doc.getCurrentPageInfo().pageNumber;
        // Save current graphics state, draw the background, then re-draw content on top
        // jsPDF doesn't support z-ordering, so we use a white rect first then the stripe
        doc.setFillColor(250, 248, 242);
        doc.rect(margin, exStartY, contentWidth, actualHeight, 'F');

        // Re-render all content on this exercise over the background
        let ry = exStartY + 3;

        // Number circle
        doc.setFillColor(...COLORS.sunset);
        doc.circle(margin + 5, ry + 3, 4, 'F');
        doc.setTextColor(...COLORS.white);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(String(i + 1), margin + 5, ry + 4.2, { align: 'center' });

        // Exercise name
        doc.setTextColor(...COLORS.ink);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(exName, margin + 12, ry + 4);

        // Prescription
        if (prescParts.length) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.rock);
          doc.text(prescParts.join('  |  '), margin + 12, ry + 9.5);
        }
        ry += 13;

        // Modification level badge
        if (ex.modificationLevel) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.sunset);
          doc.text(ex.modificationLevel.toUpperCase(), margin + 12, ry);
          ry += 5;
        }

        // Modification name + description
        if (ex.modificationName || ex.modificationDescription) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.earth);
          const modText2 = sanitize(ex.modificationName || '') +
            (ex.modificationDescription ? ': ' + sanitize(ex.modificationDescription) : '');
          const modLines2 = doc.splitTextToSize(modText2, exTextWidth);
          for (let li = 0; li < modLines2.length; li++) {
            doc.text(modLines2[li], margin + 12, ry);
            ry += SM_LINE_HEIGHT;
          }
          ry += 1;
        }

        // Equipment
        if (ex.equipment?.length > 0) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.rock);
          doc.text('Equipment: ' + ex.equipment.map(e => e.equipmentName).join(', '), margin + 12, ry);
          ry += SM_LINE_HEIGHT;
        }

        // Notes
        if (ex.notes) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...COLORS.earth);
          const noteLines2 = doc.splitTextToSize(sanitize(ex.notes), exTextWidth);
          for (let li = 0; li < noteLines2.length; li++) {
            doc.text(noteLines2[li], margin + 12, ry);
            ry += SM_LINE_HEIGHT;
          }
        }
      }

      // Separator line
      if (i < workout.exercises.length - 1) {
        doc.setDrawColor(230, 225, 215);
        doc.line(margin + 12, y - 2, margin + contentWidth, y - 2);
      }

      y += 2;
    }
  }

  // ── Bask (Cooldown) ──
  if (workout.bask && workout.type !== 'rest') {
    const baskText = sanitize(workout.bask.description || '');
    doc.setFontSize(9.5);
    const baskLines = doc.splitTextToSize(baskText, contentWidth - 10);
    const boxHeight = 14 + baskLines.length * LINE_HEIGHT + 2;

    y = checkPageBreak(doc, y, boxHeight + 8, pageHeight, margin);
    y += 4;
    doc.setFillColor(235, 245, 240);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text('BASK (COOLDOWN)' + (workout.bask.duration ? '  (' + sanitize(workout.bask.duration) + ')' : ''), margin + 5, y + 8);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    for (let li = 0; li < baskLines.length; li++) {
      doc.text(baskLines[li], margin + 5, y + 15 + li * LINE_HEIGHT);
    }

    y += boxHeight + 6;
  }

  // ── Progression + Next Day ──
  if (workout.progressionContext || workout.nextDayHint) {
    if (workout.progressionContext) {
      doc.setFontSize(9.5);
      const progText = sanitize(workout.progressionContext);
      const progLines = doc.splitTextToSize(progText, contentWidth - 30);
      const progHeight = 6 + progLines.length * LINE_HEIGHT;
      y = checkPageBreak(doc, y, progHeight, pageHeight, margin);
      y += 2;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text('Progression:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      for (let li = 0; li < progLines.length; li++) {
        doc.text(progLines[li], margin + 28, y + li * LINE_HEIGHT);
      }
      y += progLines.length * LINE_HEIGHT + 5;
    }

    if (workout.nextDayHint) {
      doc.setFontSize(9.5);
      const hintText = sanitize(workout.nextDayHint);
      const hintLines = doc.splitTextToSize(hintText, contentWidth - 26);
      const hintHeight = 5 + hintLines.length * LINE_HEIGHT;
      y = checkPageBreak(doc, y, hintHeight, pageHeight, margin);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text('Tomorrow:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      for (let li = 0; li < hintLines.length; li++) {
        doc.text(hintLines[li], margin + 26, y + li * LINE_HEIGHT);
      }
      y += hintLines.length * LINE_HEIGHT + 5;
    }
  }

  // --- End Main Content ---

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
