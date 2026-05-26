import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  PageBreak,
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

const BULLET_PREFIX_RE = /^[•○–→✓⚠] /;

const PT         = 20;
const SIZE_BODY  = 24; // 12pt
const SIZE_HEAD  = 28; // 14pt — section heading
const SIZE_NA    = 20; // 10pt

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

function stripMarkers(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/_(.*?)_/g, '$1');
}

function parseInline(text: string, size: number): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) { runs.push(new TextRun({ text: text.slice(i + 2, end), bold: true, size })); i = end + 2; continue; }
    }
    if (text[i] === '_') {
      const end = text.indexOf('_', i + 1);
      if (end !== -1) { runs.push(new TextRun({ text: text.slice(i + 1, end), italics: true, size })); i = end + 1; continue; }
    }
    let j = i + 1;
    while (j < text.length && text[j] !== '*' && text[j] !== '_') j++;
    runs.push(new TextRun({ text: text.slice(i, j), size }));
    i = j;
  }
  return runs;
}

const blank = () => new Paragraph({ spacing: { before: 0, after: 0 }, children: [] });

function isNAItem(s: string): boolean {
  const norm = s.trim().toLowerCase().replace(/[\s/]/g, '');
  return norm === 'na' || norm === 'none' || norm === 'nil';
}

/** Build the SOFTI section paragraphs for one report's data */
function buildSOFTIParagraphs(data: SOFTIData): Paragraph[] {
  const out: Paragraph[] = [];
  for (const key of SECTIONS) {
    const meta = SECTION_META[key];
    const items = data[key] ?? [];

    out.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 14 * PT, after: 4 * PT },
      children: [new TextRun({
        text: meta.label, bold: true, font: 'Arial', size: SIZE_HEAD,
        underline: { type: UnderlineType.SINGLE, color: '111827' }, color: '111827',
      })],
    }));

    const allNA = items.length > 0 && items.every(isNAItem);
    if (items.length === 0 || allNA) {
      out.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: 'n/a', font: 'Arial', size: SIZE_NA, color: '111827' })] }));
      out.push(blank());
      continue;
    }

    out.push(blank());
    for (let idx = 0; idx < items.length; idx++) {
      const lines = items[idx].split('\n').filter(l => l.trim() !== '');
      if (lines.length === 0) continue;
      out.push(new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: stripMarkers(lines[0].replace(BULLET_PREFIX_RE, '')), bold: true, size: SIZE_BODY, color: '111827' })],
      }));
      for (const line of lines.slice(1)) {
        out.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 0, after: 0 },
          children: parseInline(line.replace(BULLET_PREFIX_RE, ''), SIZE_BODY),
        }));
      }
      if (idx < items.length - 1) out.push(blank());
    }
    out.push(blank());
  }
  return out;
}

function buildDocument(children: Paragraph[]): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: SIZE_BODY, color: '111827' },
          paragraph: { spacing: { line: 240 } },
        },
      },
    },
    sections: [{
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
    }],
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Single-week export ────────────────────────────────────────────────────────

export async function exportToWord(params: {
  week: string;
  memberName: string;
  teamName: string;
  data: SOFTIData;
  isGroup?: boolean;
}): Promise<void> {
  const { week, memberName, data, isGroup } = params;
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 16 * PT },
      children: [new TextRun({ text: `${isGroup ? 'EA ' : ''}SOFTI - ${weekToDateRange(week)}`, bold: true, size: SIZE_BODY + 4, color: '111827' })],
    }),
    ...buildSOFTIParagraphs(data),
  ];
  const blob = await Packer.toBlob(buildDocument(children));
  triggerDownload(blob, `SOFTI_${memberName.replace(/\s+/g, '_')}_${week}.docx`);
}

// ── Full-year export (secretary) ──────────────────────────────────────────────

export async function exportYearToWord(params: {
  year: number;
  entries: { week: string; teams: { name: string; data: SOFTIData }[] }[];
}): Promise<void> {
  const { year, entries } = params;
  const children: Paragraph[] = [];

  entries.forEach(({ week, teams }, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));

    // Week header
    children.push(new Paragraph({
      spacing: { after: 16 * PT },
      children: [new TextRun({ text: `EA SOFTI - ${weekToDateRange(week)}`, bold: true, size: SIZE_BODY + 4, color: '111827' })],
    }));

    teams.forEach(({ name, data }) => {
      if (teams.length > 1) {
        children.push(new Paragraph({
          spacing: { before: 12 * PT, after: 4 * PT },
          children: [new TextRun({ text: name, bold: true, size: SIZE_BODY + 2, color: '374151' })],
        }));
      }
      children.push(...buildSOFTIParagraphs(data));
    });
  });

  const blob = await Packer.toBlob(buildDocument(children));
  triggerDownload(blob, `EA_SOFTI_${year}_Annual.docx`);
}
