import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const COLORS = {
  ink:     [27, 18, 10],
  paper:   [245, 240, 230],
  sand:    [164, 128, 81],
  rock:    [120, 100, 75],
  earth:   [90, 65, 40],
  sunset:  [242, 133, 1],
  sunrise: [253, 185, 15],
  white:   [255, 255, 255],
};

const TIER_COLORS = {
  'Pup':          COLORS.sand,
  'Rock Runner':  COLORS.sunset,
  'Iron Dassie':  COLORS.earth,
};

function checkPageBreak(doc, y, needed, pageHeight, margin) {
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin + 10;
  }
  return y;
}

/**
 * Generate and download a PDF for an AI-generated daily workout.
 * @param {object} workout - The daily workout object from the API
 * @param {object} options - { userProfile?: { givenName, familyName }, userTier?: string }
 */
export async function downloadRoutinePdf(workout, options = {}) {
  if (!workout) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // ── Header Bar ──
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 44, 'F');
  doc.setFillColor(...COLORS.sunset);
  doc.rect(0, 44, pageWidth, 2, 'F');

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('HYRAX FITNESS', margin, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('AI-Generated Daily Workout', margin, 23);

  // User name + tier
  const userName = options.userProfile
    ? [options.userProfile.givenName, options.userProfile.familyName].filter(Boolean).join(' ')
    : '';
  if (userName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(userName, pageWidth - margin, 14, { align: 'right' });
  }

  if (options.userTier) {
    const tierColor = TIER_COLORS[options.userTier] || COLORS.sand;
    const tierText = options.userTier;
    const tierWidth = doc.getTextWidth(tierText) + 8;
    const tierX = pageWidth - margin - tierWidth;
    doc.setFillColor(...tierColor);
    doc.roundedRect(tierX, 17, tierWidth, 7, 3, 3, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(tierText, tierX + tierWidth / 2, 22, { align: 'center' });
  }

  // Date
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const dateStr = workout.date
    ? new Date(workout.date + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(dateStr, pageWidth - margin, 30, { align: 'right' });

  // Type badge
  const typeBadge = workout.type === 'rest' ? 'REST DAY' : workout.type === 'active_recovery' ? 'ACTIVE RECOVERY' : 'TRAINING';
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.sunrise);
  doc.text(typeBadge, pageWidth - margin, 38, { align: 'right' });

  y = 56;

  // ── Workout Title ──
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(workout.title || 'Daily Workout', margin, y);
  y += 8;

  // Duration + Focus
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.rock);
  const metaParts = [];
  if (workout.duration) metaParts.push(workout.duration);
  if (workout.focus?.length) metaParts.push(workout.focus.map(t => t.replace(/[-_]/g, ' ')).join(', '));
  if (metaParts.length) {
    doc.text(metaParts.join('  |  '), margin, y);
    y += 6;
  }

  // Coaching notes
  if (workout.coachingNotes) {
    y += 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.earth);
    const lines = doc.splitTextToSize(workout.coachingNotes, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  y += 4;

  // ── Warm-Up ──
  if (workout.warmUp && workout.type !== 'rest') {
    y = checkPageBreak(doc, y, 20, pageHeight, margin);
    doc.setFillColor(255, 245, 230);
    doc.roundedRect(margin, y - 2, contentWidth, 18, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.sunset);
    doc.text(`WARM-UP${workout.warmUp.duration ? ` (${workout.warmUp.duration})` : ''}`, margin + 4, y + 5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    const warmLines = doc.splitTextToSize(workout.warmUp.description || '', contentWidth - 8);
    doc.text(warmLines, margin + 4, y + 11);
    y += 18 + Math.max(0, (warmLines.length - 1) * 4) + 6;
  }

  // ── Exercises ──
  if (workout.exercises?.length > 0 && workout.type !== 'rest') {
    y = checkPageBreak(doc, y, 12, pageHeight, margin);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    doc.text(`EXERCISES (${workout.exercises.length})`, margin, y);
    y += 8;

    for (let i = 0; i < workout.exercises.length; i++) {
      const ex = workout.exercises[i];
      y = checkPageBreak(doc, y, 24, pageHeight, margin);

      // Number circle
      doc.setFillColor(...COLORS.sunset);
      doc.circle(margin + 4, y + 2, 3.5, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), margin + 4, y + 3.5, { align: 'center' });

      // Exercise name
      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(ex.exerciseName || 'Exercise', margin + 12, y + 3);

      // Prescription
      const prescParts = [];
      if (ex.sets && ex.reps) prescParts.push(`${ex.sets} x ${ex.reps}`);
      if (ex.duration && !ex.reps) prescParts.push(ex.duration);
      if (ex.rest) prescParts.push(`${ex.rest} rest`);
      if (prescParts.length) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.rock);
        doc.text(prescParts.join('  |  '), margin + 12, y + 8);
      }
      y += 11;

      // Modification
      if (ex.modificationName) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.sunset);
        doc.text(`${(ex.modificationLevel || '').toUpperCase()}: `, margin + 12, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.ink);
        doc.text(ex.modificationName, margin + 12 + doc.getTextWidth(`${(ex.modificationLevel || '').toUpperCase()}: `), y);
        y += 4;
      }

      if (ex.modificationDescription) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.rock);
        const descLines = doc.splitTextToSize(ex.modificationDescription, contentWidth - 14);
        doc.text(descLines, margin + 12, y);
        y += descLines.length * 3.5 + 2;
      }

      // Equipment
      if (ex.equipment?.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.earth);
        doc.text(`Equipment: ${ex.equipment.map(e => e.equipmentName).join(', ')}`, margin + 12, y);
        y += 4;
      }

      // Notes
      if (ex.notes) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.earth);
        const noteLines = doc.splitTextToSize(ex.notes, contentWidth - 14);
        doc.text(noteLines, margin + 12, y);
        y += noteLines.length * 3.5 + 2;
      }

      y += 4;

      // Separator line
      if (i < workout.exercises.length - 1) {
        doc.setDrawColor(230, 225, 215);
        doc.line(margin + 12, y - 2, margin + contentWidth, y - 2);
      }
    }
  }

  // ── Bask (Cooldown) ──
  if (workout.bask && workout.type !== 'rest') {
    y = checkPageBreak(doc, y, 20, pageHeight, margin);
    y += 4;
    doc.setFillColor(240, 248, 245);
    doc.roundedRect(margin, y - 2, contentWidth, 18, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text(`BASK${workout.bask.duration ? ` (${workout.bask.duration})` : ''}`, margin + 4, y + 5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    const baskLines = doc.splitTextToSize(workout.bask.description || '', contentWidth - 8);
    doc.text(baskLines, margin + 4, y + 11);
    y += 18 + Math.max(0, (baskLines.length - 1) * 4) + 6;
  }

  // ── Progression + Next Day ──
  if (workout.progressionContext || workout.nextDayHint) {
    y = checkPageBreak(doc, y, 18, pageHeight, margin);
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.ink);
    if (workout.progressionContext) {
      doc.text('Progression:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      const progLines = doc.splitTextToSize(workout.progressionContext, contentWidth - 28);
      doc.text(progLines, margin + 28, y);
      y += progLines.length * 4 + 4;
    }
    if (workout.nextDayHint) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ink);
      doc.text('Tomorrow:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.rock);
      doc.text(workout.nextDayHint, margin + 24, y);
      y += 6;
    }
  }

  // ── QR Code ──
  y = checkPageBreak(doc, y, 45, pageHeight, margin);
  y += 8;
  const workoutUrl = `https://hyraxfitness.com/portal/routine`;
  try {
    const qrDataUrl = await QRCode.toDataURL(workoutUrl, { width: 200, margin: 1 });
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.rock);
    doc.text('Scan to view your routine:', margin, y + 4);
    doc.setTextColor(...COLORS.sunset);
    doc.setFontSize(7);
    doc.text(workoutUrl, margin, y + 9);
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 30, y - 4, 30, 30);
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
