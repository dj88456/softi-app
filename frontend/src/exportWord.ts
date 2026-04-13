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

/** Format ISO week as "April 6 to April 10, 2026" */
function weekToDateRange(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${fmt(monday)} to ${fmt(sunday)}, ${sunday.getFullYear()}`;
}

/** Strip **bold** and _italic_ markers from a string */
function stripMarkers(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/_(.*?)_/g, '$1');
}

/** Parse inline **bold** and _italic_ into TextRun children */
function parseInline(text: string, size = 22): TextRun[] {
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

  const children: Paragraph[] = [];

  // ── Document header ──────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: memberName, bold: true, size: 28, color: '111827' }),
        new TextRun({ text: `  ·  ${teamName}`, size: 24, color: '6b7280' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 400 },
      children: [
        new TextRun({ text: `SOFTI – ${dateRange}`, size: 24, color: '374151' }),
      ],
    }),
  );

  // ── SOFTI Sections ───────────────────────────────────────────────────────────
  for (const key of SECTIONS) {
    const meta = SECTION_META[key];
    const items = data[key] ?? [];

    // Section heading — bold + underlined
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 320, after: 120 },
        children: [
          new TextRun({
            text: meta.label,
            bold: true,
            size: 32,
            underline: { type: UnderlineType.SINGLE, color: '111827' },
            color: '111827',
          }),
        ],
      }),
    );

    if (items.length === 0) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: 'n/a', size: 22, color: '9ca3af' })],
        }),
      );
      continue;
    }

    for (const item of items) {
      const lines = item.split('\n').filter(l => l.trim() !== '');
      if (lines.length === 0) continue;

      if (lines.length === 1) {
        // Single-line item → plain bullet
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: parseInline(lines[0]),
          }),
        );
      } else {
        // Multi-line: first line = bold sub-heading, rest = bullets
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({ text: stripMarkers(lines[0]), bold: true, size: 22, color: '111827' }),
            ],
          }),
        );
        for (let i = 1; i < lines.length; i++) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: parseInline(lines[i]),
            }),
          );
        }
      }
    }
  }

  // ── Build & download ─────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '111827' },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
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
