import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  UnderlineType,
  convertInchesToTwip,
} from 'docx';
import type { SOFTIData } from './types';

const SECTION_META = {
  successes:     { label: 'Successes' },
  opportunities: { label: 'Opportunities' },
  failures:      { label: 'Failures' },
  threats:       { label: 'Threats' },
  issues:        { label: 'Issues' },
} as const;

type SectionKey = keyof typeof SECTION_META;
const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

// Strip any typed bullet prefix so we don't double-up with Word's native bullet
const BULLET_PREFIX_RE = /^[•○–→✓⚠] /;

/** Format ISO week as "April 6 to April 10, 2026" (Monday–Friday workdays) */
function weekToDateRange(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${fmt(monday)} to ${fmt(friday)}, ${friday.getFullYear()}`;
}

/** Strip **bold** and _italic_ markers from a string */
function stripMarkers(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/_(.*?)_/g, '$1');
}

/** Parse inline **bold** and _italic_ into TextRun children */
function parseInline(text: string, size: number): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        runs.push(new TextRun({ text: text.slice(i + 2, end), bold: true, size }));
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '_') {
      const end = text.indexOf('_', i + 1);
      if (end !== -1) {
        runs.push(new TextRun({ text: text.slice(i + 1, end), italics: true, size }));
        i = end + 1;
        continue;
      }
    }
    let j = i + 1;
    while (j < text.length && text[j] !== '*' && text[j] !== '_') j++;
    runs.push(new TextRun({ text: text.slice(i, j), size }));
    i = j;
  }
  return runs;
}

export async function exportToWord(params: {
  week: string;
  memberName: string;
  teamName: string;
  data: SOFTIData;
}): Promise<void> {
  const { week, memberName, teamName, data } = params;
  const dateRange = weekToDateRange(week);

  const PT = 20; // 1pt = 20 twips

  const SIZE_BODY    = 24; // 12pt  — Calibri (Body)
  const SIZE_SECTION = 28; // 14pt  — Arial
  const SIZE_NA      = 20; // 10pt  — Arial
  const SIZE_META    = 22; // 11pt

  const blank = () => new Paragraph({ spacing: { before: 0, after: 0 }, children: [] });

  const children: Paragraph[] = [];

  // ── Document header ──────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { after: 2 * PT },
      children: [
        new TextRun({ text: memberName, bold: true, size: SIZE_BODY + 4, color: '111827' }),
        new TextRun({ text: `  ·  ${teamName}`, size: SIZE_META, color: '6b7280' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 16 * PT },
      children: [
        new TextRun({ text: `SOFTI – ${dateRange}`, size: SIZE_META, color: '374151' }),
      ],
    }),
  );

  // ── SOFTI Sections ───────────────────────────────────────────────────────────
  for (const key of SECTIONS) {
    const meta = SECTION_META[key];
    const items = data[key] ?? [];

    // Section heading — bold underlined 18pt
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 14 * PT, after: 4 * PT },
        children: [
          new TextRun({
            text: meta.label,
            bold: true,
            font: 'Arial',
            size: SIZE_SECTION,
            underline: { type: UnderlineType.SINGLE, color: '111827' },
            color: '111827',
          }),
        ],
      }),
    );

    const isNAItem = (s: string) => {
      const norm = s.trim().toLowerCase().replace(/[\s/]/g, '');
      return norm === 'na' || norm === 'none' || norm === 'nil';
    };
    const allNA = items.length > 0 && items.every(isNAItem);

    if (items.length === 0 || allNA) {
      children.push(
        new Paragraph({
          spacing: { after: 4 * PT },
          children: [new TextRun({ text: 'n/a', font: 'Arial', size: SIZE_NA, color: '111827' })],
        }),
      );
      continue;
    }

    // Blank line before first item
    children.push(blank());

    for (let idx = 0; idx < items.length; idx++) {
      const lines = items[idx].split('\n').filter(l => l.trim() !== '');
      if (lines.length === 0) continue;

      // First line: always bold, strip any typed bullet/marker prefix
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: stripMarkers(lines[0].replace(BULLET_PREFIX_RE, '')),
              bold: true,
              size: SIZE_BODY,
              color: '111827',
            }),
          ],
        }),
      );

      // Remaining lines: plain bullet char, no list indentation
      for (const line of lines.slice(1)) {
        children.push(
          new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({ text: '• ', size: SIZE_BODY, color: '111827' }),
              ...parseInline(line.replace(BULLET_PREFIX_RE, ''), SIZE_BODY),
            ],
          }),
        );
      }

      // Blank line between items (not after the last one)
      if (idx < items.length - 1) {
        children.push(blank());
      }
    }

    // Blank line after last item
    children.push(blank());
  }

  // ── Build & download ─────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: SIZE_BODY, color: '111827' },
          paragraph: { spacing: { line: 240 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1.25),
              right:  convertInchesToTwip(1.25),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SOFTI_${memberName.replace(/\s+/g, '_')}_${week}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
