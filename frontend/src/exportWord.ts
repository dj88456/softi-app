import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  TableRow,
  TableCell,
  Table,
  WidthType,
} from 'docx';
import type { SOFTIData } from './types';

const SECTION_META = {
  successes:     { label: 'S — Successes',     color: '059669' },
  opportunities: { label: 'O — Opportunities', color: '2563eb' },
  failures:      { label: 'F — Failures',      color: 'dc2626' },
  threats:       { label: 'T — Threats',       color: 'ea580c' },
  issues:        { label: 'I — Issues',        color: 'd97706' },
} as const;

type SectionKey = keyof typeof SECTION_META;
const SECTIONS: SectionKey[] = ['successes', 'opportunities', 'failures', 'threats', 'issues'];

/** Parse inline **bold** and _italic_ markers into TextRun children */
function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        runs.push(new TextRun({ text: text.slice(i + 2, end), bold: true, size: 22 }));
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '_') {
      const end = text.indexOf('_', i + 1);
      if (end !== -1) {
        runs.push(new TextRun({ text: text.slice(i + 1, end), italics: true, size: 22 }));
        i = end + 1;
        continue;
      }
    }
    let j = i + 1;
    while (j < text.length && text[j] !== '*' && text[j] !== '_') j++;
    runs.push(new TextRun({ text: text.slice(i, j), size: 22 }));
    i = j;
  }
  return runs;
}

/** Turn a multi-line item string into one or more Paragraphs */
function itemToParagraphs(itemText: string, bullet: boolean): Paragraph[] {
  const lines = itemText.split('\n');
  return lines.map((line, idx) => {
    const runs = parseInline(line || ' ');
    if (idx === 0 && bullet) {
      return new Paragraph({
        bullet: { level: 0 },
        children: runs,
        spacing: { after: 60 },
      });
    }
    return new Paragraph({
      indent: { left: convertInchesToTwip(0.25) },
      children: runs,
      spacing: { after: 60 },
    });
  });
}

export async function exportToWord(params: {
  week: string;
  memberName: string;
  teamName: string;
  data: SOFTIData;
}): Promise<void> {
  const { week, memberName, teamName, data } = params;

  const children: (Paragraph | Table)[] = [];

  // ── Title ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'SOFTI Weekly Report', bold: true, size: 52, color: '1e1b4b' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${memberName}  ·  ${teamName}`, size: 24, color: '6b7280' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: week, size: 22, color: '6b7280' }),
      ],
    }),
  );

  // ── SOFTI Sections ─────────────────────────────────────────────────────────
  for (const key of SECTIONS) {
    const meta = SECTION_META[key];
    const items = data[key] ?? [];

    // Section heading row (colored background)
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        shading: { type: ShadingType.SOLID, color: meta.color, fill: meta.color },
        border: {
          bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
        children: [
          new TextRun({
            text: `  ${meta.label}`,
            bold: true,
            size: 26,
            color: 'FFFFFF',
          }),
        ],
      }),
    );

    if (items.length === 0) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: '—', size: 22, color: '9ca3af', italics: true })],
        }),
      );
    } else {
      for (const item of items) {
        itemToParagraphs(item, true).forEach(p => children.push(p));
      }
    }
  }

  // ── Build & download ───────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
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
