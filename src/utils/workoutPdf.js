import jsPDF from 'jspdf';

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
 * @returns {jsPDF} The generated PDF document
 */
export function generateWorkoutPdf(workout, logoBase64 = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ── Header Bar ──
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Brand accent line
  doc.setFillColor(...COLORS.sunset);
  doc.rect(0, 38, pageWidth, 3, 'F');

  // Logo in header
  const textOffsetX = logoBase64 ? margin + 34 : margin;
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 4, 30, 30);
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
  doc.text('START-STOP SCRAMBLE & CARRY TRAINING', textOffsetX, 28);

  y = 52;

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

  const badges = [
    { label: workout.category, color: COLORS.earth },
    { label: workout.difficulty, color: COLORS.sunset },
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

  // ── Equipment ──
  if (workout.equipment && workout.equipment.length > 0) {
    y = checkPageBreak(doc, y, 20, pageHeight, margin);

    doc.setFillColor(...COLORS.paper);
    doc.roundedRect(margin, y - 4, contentWidth, 8 + workout.equipment.length * 5.5, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.earth);
    doc.text('EQUIPMENT NEEDED', margin + 5, y + 2);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    for (const item of workout.equipment) {
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
      y = checkPageBreak(doc, y, 30, pageHeight, margin);

      // Exercise number circle
      doc.setFillColor(...COLORS.sunset);
      doc.circle(margin + 5, y, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.white);
      doc.text(String(index + 1), margin + 5, y + 1, { align: 'center' });

      // Exercise name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.ink);
      doc.text(exercise.name || `Exercise ${index + 1}`, margin + 14, y + 1);
      y += 7;

      // Sets / Reps / Rest row
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
      if (exercise.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.earth);
        const noteLines = doc.splitTextToSize(exercise.notes, contentWidth - 14);
        doc.text(noteLines, margin + 14, y);
        y += noteLines.length * 4.5;
      }

      y += 6;
    });
  }

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Watermark (very low opacity logo centered on page)
    if (logoBase64) {
      const watermarkSize = pageWidth * 0.5;
      const watermarkX = (pageWidth - watermarkSize) / 2;
      const watermarkY = (pageHeight - watermarkSize) / 2;
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.03 }));
      doc.addImage(logoBase64, 'PNG', watermarkX, watermarkY, watermarkSize, watermarkSize);
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
 * Download the PDF for a workout.
 */
export async function downloadWorkoutPdf(workout) {
  const logoBase64 = await loadLogoBase64();
  const doc = generateWorkoutPdf(workout, logoBase64);
  const filename = `hyrax-${(workout.title || 'workout')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.pdf`;
  doc.save(filename);
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
