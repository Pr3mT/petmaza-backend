import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import pdfParse from 'pdf-parse';
import QRCode from 'qrcode';

export interface PetmazaReportContext {
  requestId: string;
  birdIndex: number;
  farmName?: string;
  birdName?: string;
  bandId?: string;
  species?: string;
  customerName?: string;
  uploadedByName?: string;
}

export interface ParsedLabReportFields {
  bandId?: string;
  species?: string;
  submittedBy?: string;
  reportDate?: string;
  receivedDate?: string;
  certId?: string;
  result?: string;
  specimen?: string;
}

export interface LabReportSelectableRow {
  id: string;
  ringId?: string;
  species?: string;
  certId?: string;
  result?: string;
  reportDate?: string;
  submittedBy?: string;
  rawText?: string;
}

export interface ParsedLabReportDebug {
  fields: ParsedLabReportFields;
  extractedText: string;
  rows: LabReportSelectableRow[];
  csvText: string;
}

interface ExtractionContext {
  bandId?: string;
  species?: string;
  birdIndex?: number;
}

interface GloriousTableRow {
  srNo: string;
  reportDate: string;
  submittedBy: string;
  ringId: string;
  species: string;
  certId: string;
  result: string;
}

interface PdfTextItem {
  page: number;
  x: number;
  y: number;
  width: number;
  text: string;
}

interface PdfLine {
  page: number;
  y: number;
  items: PdfTextItem[];
}

interface DetectedTableColumns {
  page: number;
  headerBottomY: number;
  starts: Record<'srNo' | 'reportDate' | 'submittedBy' | 'ringId' | 'species' | 'certId' | 'result', number>;
}

const cleanValue = (value?: string) => {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').replace(/[|]/g, '').trim();
};

const normalizeText = (text: string) => {
  return text
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

const titleCase = (value?: string) => {
  const cleaned = cleanValue(value);
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : part)
    .join(' ');
};

const normalizeDateValue = (value?: string) => {
  const cleaned = cleanValue(value);
  if (!cleaned) return '';

  const match = cleaned.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (!match) {
    return cleaned;
  }

  return `${match[1]} ${titleCase(match[2].slice(0, 3))} ${match[3]}`;
};

const normalizeResultValue = (value?: string) => {
  const cleaned = cleanValue(value);
  if (!cleaned) return '';

  const match = cleaned.match(/male|female|unknown/i);
  return match ? titleCase(match[0]) : cleaned;
};

const normalizeCertIdValue = (value?: string) => cleanValue(value).replace(/\s+/g, '').toUpperCase();

const normalizeRingIdValue = (value?: string) => {
  const cleaned = cleanValue(value);
  if (!cleaned) return '';
  return /^no\s+ring$/i.test(cleaned) ? 'No Ring' : cleaned;
};

const normalizeSpeciesValue = (value?: string) => titleCase(value);

const normalizeSubmittedByValue = (value?: string) => titleCase(value);

const normalizeSrNoValue = (value?: string) => {
  const cleaned = cleanValue(value);
  const match = cleaned.match(/\d+/);
  return match ? match[0] : '';
};

const csvEscape = (value?: string) => {
  const cleaned = cleanValue(value);
  if (!cleaned) return '';
  if (!/[",\n]/.test(cleaned)) {
    return cleaned;
  }
  return `"${cleaned.replace(/"/g, '""')}"`;
};

const extractTextWithPdfParse = async (pdfBuffer: Buffer): Promise<string> => {
  try {
    const parsed = await pdfParse(pdfBuffer);
    return normalizeText(parsed.text || '');
  } catch {
    return '';
  }
};

const extractPdfLayoutWithPdfJs = async (pdfBuffer: Buffer): Promise<PdfTextItem[]> => {
  try {
    const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;

    const itemsOut: PdfTextItem[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const items = (content.items || []) as any[];

      for (const item of items) {
        const text = item?.str ? String(item.str).trim() : '';
        if (!text) continue;

        const transform = Array.isArray(item.transform) ? item.transform : [];
        itemsOut.push({
          page: pageNum,
          x: Number(transform[4] || 0),
          y: Number(transform[5] || 0),
          width: Number(item.width || 0),
          text,
        });
      }
    }

    return itemsOut;
  } catch {
    return [];
  }
};

const groupItemsIntoLines = (items: PdfTextItem[], tolerance = 3): PdfLine[] => {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: PdfLine[] = [];

  for (const item of sorted) {
    const existing = lines.find((line) => line.page === item.page && Math.abs(line.y - item.y) <= tolerance);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    lines.push({
      page: item.page,
      y: item.y,
      items: [item],
    });
  }

  return lines
    .map((line) => ({
      ...line,
      items: [...line.items].sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => a.page - b.page || b.y - a.y);
};

const lineText = (line: PdfLine) => cleanValue(line.items.map((item) => item.text).join(' '));

const detectTableColumns = (items: PdfTextItem[]): DetectedTableColumns | null => {
  const lines = groupItemsIntoLines(items);

  for (const line of lines) {
    const lower = lineText(line).toLowerCase();
    if (!lower.includes('ring') || !lower.includes('species') || !lower.includes('result')) {
      continue;
    }

    const cluster = lines.filter(
      (candidate) => candidate.page === line.page && Math.abs(candidate.y - line.y) <= 24
    );
    const headerItems = cluster.flatMap((candidate) => candidate.items);

    const findHeaderX = (patterns: RegExp[]) => {
      const match = headerItems
        .filter((item) => patterns.some((pattern) => pattern.test(item.text)))
        .sort((a, b) => a.x - b.x)[0];

      return match?.x;
    };

    const ringX = findHeaderX([/^ring$/i]);
    const speciesX = findHeaderX([/^species$/i]);
    const certX = findHeaderX([/^cert\.?$/i, /^certificate$/i]);
    const resultX = findHeaderX([/^result$/i]);

    if ([ringX, speciesX, certX, resultX].some((value) => value === undefined)) {
      continue;
    }

    const reportX = findHeaderX([/^report$/i, /^date$/i]) ?? Math.max(0, ringX! - 180);
    const submittedX = findHeaderX([/^submitted$/i, /^by$/i]) ?? Math.max(reportX + 40, ringX! - 90);
    const headerBottomY = Math.min(...headerItems.map((item) => item.y));

    return {
      page: line.page,
      headerBottomY,
      starts: {
        srNo: 0,
        reportDate: reportX,
        submittedBy: submittedX,
        ringId: ringX!,
        species: speciesX!,
        certId: certX!,
        result: resultX!,
      },
    };
  }

  return null;
};

const assignColumn = (x: number, columns: DetectedTableColumns['starts']) => {
  const ordered = Object.entries(columns)
    .map(([key, start]) => ({ key, start }))
    .sort((a, b) => a.start - b.start);

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const boundary = next ? current.start + ((next.start - current.start) / 2) : Number.POSITIVE_INFINITY;

    if (x < boundary) {
      return current.key as keyof DetectedTableColumns['starts'];
    }
  }

  return 'result' as keyof DetectedTableColumns['starts'];
};

const buildValueFromBucket = (bucket: PdfTextItem[]) => {
  return cleanValue(
    [...bucket]
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((item) => item.text)
      .join(' ')
  );
};

const parseGloriousRowsFromLayout = (items: PdfTextItem[]): GloriousTableRow[] => {
  const detected = detectTableColumns(items);
  if (!detected) {
    return [];
  }

  const dataItems = items.filter(
    (item) => item.page === detected.page && item.y < detected.headerBottomY - 2
  );

  const firstBoundary = detected.starts.reportDate > 0 ? detected.starts.reportDate / 2 : 40;
  const anchors = dataItems
    .filter((item) => item.x < firstBoundary && /^\d{1,2}$/.test(item.text))
    .sort((a, b) => b.y - a.y);

  if (!anchors.length) {
    return [];
  }

  const rows: GloriousTableRow[] = [];

  for (let index = 0; index < anchors.length; index += 1) {
    const current = anchors[index];
    const previous = anchors[index - 1];
    const next = anchors[index + 1];
    const upperY = previous ? (previous.y + current.y) / 2 : detected.headerBottomY - 2;
    const lowerY = next ? (current.y + next.y) / 2 : Number.NEGATIVE_INFINITY;

    const rowItems = dataItems.filter((item) => item.y <= upperY && item.y > lowerY);
    if (!rowItems.length) {
      continue;
    }

    const buckets: Record<keyof DetectedTableColumns['starts'], PdfTextItem[]> = {
      srNo: [],
      reportDate: [],
      submittedBy: [],
      ringId: [],
      species: [],
      certId: [],
      result: [],
    };

    for (const item of rowItems) {
      const centerX = item.x + (item.width / 2);
      const column = assignColumn(centerX, detected.starts);
      buckets[column].push(item);
    }

    const row: GloriousTableRow = {
      srNo: normalizeSrNoValue(buildValueFromBucket(buckets.srNo)),
      reportDate: normalizeDateValue(buildValueFromBucket(buckets.reportDate)),
      submittedBy: normalizeSubmittedByValue(buildValueFromBucket(buckets.submittedBy)),
      ringId: normalizeRingIdValue(buildValueFromBucket(buckets.ringId)),
      species: normalizeSpeciesValue(buildValueFromBucket(buckets.species)),
      certId: normalizeCertIdValue(buildValueFromBucket(buckets.certId)),
      result: normalizeResultValue(buildValueFromBucket(buckets.result)),
    };

    if (!row.srNo && /^\d+$/.test(current.text)) {
      row.srNo = current.text;
    }

    if (row.certId || row.result || row.ringId || row.species) {
      rows.push(row);
    }
  }

  return rows.filter((row) => row.certId || row.result);
};

const extractTextWithPdfJs = async (pdfBuffer: Buffer): Promise<string> => {
  try {
    const layoutItems = await extractPdfLayoutWithPdfJs(pdfBuffer);
    const lines = groupItemsIntoLines(layoutItems);
    return normalizeText(lines.map((line) => lineText(line)).join('\n'));
  } catch {
    return '';
  }
};

const extractPdfText = async (pdfBuffer: Buffer): Promise<string> => {
  const primary = await extractTextWithPdfParse(pdfBuffer);
  if (primary) return primary;

  const fallback = await extractTextWithPdfJs(pdfBuffer);
  if (fallback) return fallback;

  return '';
};

const capture = (text: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return cleanValue(match[1]);
    }
  }
  return '';
};

const buildKeyValueMap = (text: string) => {
  const map: Record<string, string> = {};
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z\s\/]+?)\s*[:.-]\s*(.+)$/);
    if (!match) continue;
    const key = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
    map[key] = cleanValue(match[2]);
  }

  return map;
};

const normalizeToken = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const isLikelyCertId = (value?: string) => {
  const token = (value || '').toUpperCase();
  return token.length >= 6 && /[A-Z]/.test(token) && /\d/.test(token);
};

const parseGloriousTableRows = (text: string): GloriousTableRow[] => {
  const rows: GloriousTableRow[] = [];
  const rowPattern = /(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3})\s+(No\s+Ring|[A-Za-z0-9-]+)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,4})\s+([A-Za-z0-9]+)\s+(Male|Female|Unknown)/gi;

  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(text)) !== null) {
    rows.push({
      srNo: cleanValue(match[1]),
      reportDate: cleanValue(match[2]),
      submittedBy: cleanValue(match[3]),
      ringId: cleanValue(match[4]),
      species: cleanValue(match[5]),
      certId: cleanValue(match[6]),
      result: cleanValue(match[7]),
    });
  }

  return rows;
};

const isDateLeadLine = (line: string) => /^\d{1,2}\s+[A-Za-z]{3}\b/.test(cleanValue(line));

const isRowCoreLine = (line: string) => /^\d+\s+(?:No\s+Ring|\d+)\b.*\b(Male|Female|Unknown)\b/i.test(cleanValue(line));

const parseRowsByLineBlocks = (text: string): GloriousTableRow[] => {
  const lines = text
    .split('\n')
    .map((line) => cleanValue(line))
    .filter(Boolean)
    .filter((line) => !/^(report submitted|sr no ring id species cert\.? id\.? result|date by)$/i.test(line));

  const rows: GloriousTableRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const coreLine = lines[index];
    if (!isRowCoreLine(coreLine)) {
      continue;
    }

    const prevLine = lines[index - 1] || '';
    const nextLine = lines[index + 1] || '';
    if (!isDateLeadLine(prevLine) || !/^\d{4}\b/.test(nextLine)) {
      continue;
    }

    const prevMatch = prevLine.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(.+?)\s+([A-Z0-9]{6,12})$/i);
    const coreMatch = coreLine.match(/^(\d+)\s+(No\s+Ring|\d+)(?:\s+(.+?))?\s+(Male|Female|Unknown)$/i);
    const nextMatch = nextLine.match(/^(\d{4})\s+(.+)$/);

    if (!prevMatch || !coreMatch || !nextMatch) {
      continue;
    }

    const prevTokens = cleanValue(prevMatch[3]).split(' ').filter(Boolean);
    const nextTokens = cleanValue(nextMatch[2]).split(' ').filter(Boolean);
    if (!prevTokens.length || !nextTokens.length) {
      continue;
    }

    const firstName = prevTokens[0] || '';
    const surname = nextTokens[0] || '';
    const speciesPrev = prevTokens.slice(1);
    const coreSpecies = cleanValue(coreMatch[3] || '');
    const tailTokens = nextTokens.slice(1);
    const lastTailToken = tailTokens[tailTokens.length - 1] || '';
    const certSuffix = /^[A-Z]$/i.test(lastTailToken) ? lastTailToken.toUpperCase() : '';
    const speciesNext = certSuffix ? tailTokens.slice(0, -1) : tailTokens;

    const extraSpeciesLines: string[] = [];
    let lookAhead = index + 2;
    while (lookAhead < lines.length && !isDateLeadLine(lines[lookAhead]) && !isRowCoreLine(lines[lookAhead])) {
      extraSpeciesLines.push(lines[lookAhead]);
      lookAhead += 1;
    }

    const speciesParts = [
      ...speciesPrev,
      ...(coreSpecies ? [coreSpecies] : []),
      ...extraSpeciesLines,
      ...speciesNext,
    ].filter(Boolean);

    const reportDate = normalizeDateValue(`${prevMatch[1]} ${prevMatch[2]} ${nextMatch[1]}`);
    const certId = normalizeCertIdValue(`${prevMatch[4]}${certSuffix}`);
    const row: GloriousTableRow = {
      srNo: normalizeSrNoValue(coreMatch[1]),
      reportDate,
      submittedBy: normalizeSubmittedByValue(`${firstName} ${surname}`),
      ringId: normalizeRingIdValue(coreMatch[2]),
      species: normalizeSpeciesValue(speciesParts.join(' ')),
      certId,
      result: normalizeResultValue(coreMatch[4]),
    };

    if (isLikelyCertId(row.certId)) {
      rows.push(row);
    }
  }

  return rows;
};

const parseRowsByCertResultFallback = (text: string): GloriousTableRow[] => {
  const byLineBlocks = parseRowsByLineBlocks(text);
  if (byLineBlocks.length) {
    return byLineBlocks;
  }

  const compact = text.replace(/\s+/g, ' ').trim();
  const rows: GloriousTableRow[] = [];
  const certResultPattern = /\b((?=[A-Z0-9]{6,12}\b)(?=[A-Z0-9]*\d)[A-Z0-9]{6,12})\b[\s\S]{0,80}?\b(Male|Female|Unknown)\b/g;
  const globalDateMatch = compact.match(/\b\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/);
  const globalDate = globalDateMatch ? cleanValue(globalDateMatch[0]) : '';

  let match: RegExpExecArray | null;
  while ((match = certResultPattern.exec(compact)) !== null) {
    const certId = cleanValue(match[1]);
    const result = cleanValue(match[2]);
    if (!isLikelyCertId(certId)) {
      continue;
    }

    const certEndIndex = match.index + match[0].indexOf(match[1]) + match[1].length;
    const afterCert = compact.slice(certEndIndex, certEndIndex + 8).trim();
    const suffixMatch = afterCert.match(/^([A-Z])\b/);
    const certWithSuffix = suffixMatch ? `${certId}${suffixMatch[1]}` : certId;

    const before = compact.slice(Math.max(0, match.index - 120), match.index);
    const noRingRegex = /No\s+Ring/gi;
    const numericRegex = /\b\d{1,4}\b/g;

    const ringCandidates: Array<{ value: string; distance: number }> = [];
    let nrMatch: RegExpExecArray | null;
    while ((nrMatch = noRingRegex.exec(before)) !== null) {
      ringCandidates.push({ value: 'No Ring', distance: before.length - nrMatch.index });
    }
    let numMatch: RegExpExecArray | null;
    while ((numMatch = numericRegex.exec(before)) !== null) {
      const n = Number(numMatch[0]);
      if (n > 0 && n < 1900) {
        ringCandidates.push({ value: String(n), distance: before.length - numMatch.index });
      }
    }
    ringCandidates.sort((a, b) => a.distance - b.distance);
    const ringId = ringCandidates.length ? ringCandidates[0].value : '';

    const speciesMatch = before.match(/(Yellow\s+Sided\s+Conure|Pineapple\s+Conure|[A-Za-z]+(?:\s+[A-Za-z]+)?\s+Conure)/i);
    const species = cleanValue(speciesMatch?.[1] || '');

    rows.push({
      srNo: String(rows.length + 1),
      reportDate: globalDate,
      submittedBy: '',
      ringId,
      species,
      certId: certWithSuffix,
      result,
    });
  }

  return rows;
};

const selectRowForBird = (rows: GloriousTableRow[], context?: ExtractionContext): GloriousTableRow | null => {
  if (!rows.length) return null;

  const bandToken = normalizeToken(context?.bandId);
  const speciesToken = normalizeToken(context?.species);

  if (bandToken) {
    const byBand = rows.find((row) => normalizeToken(row.ringId) === bandToken);
    if (byBand) return byBand;
  }

  if (speciesToken) {
    const bySpecies = rows.find((row) => {
      const rowSpecies = normalizeToken(row.species);
      return rowSpecies.includes(speciesToken) || speciesToken.includes(rowSpecies);
    });
    if (bySpecies) return bySpecies;
  }

  if (rows.length === 1) {
    return rows[0];
  }

  if (context?.birdIndex !== undefined && context.birdIndex >= 0 && context.birdIndex < rows.length) {
    return rows[context.birdIndex];
  }

  return null;
};

const buildSelectableRows = (text: string): LabReportSelectableRow[] => {
  const primaryRows = parseGloriousTableRows(text);
  const fallbackRows = parseRowsByCertResultFallback(text);
  const merged = [...primaryRows, ...fallbackRows]
    .filter((row) => isLikelyCertId(row.certId));

  const uniqueRows = merged.filter((row, index, arr) => {
    const key = `${normalizeToken(row.certId)}|${normalizeToken(row.result)}`;
    return key !== '|' && arr.findIndex((r) => `${normalizeToken(r.certId)}|${normalizeToken(r.result)}` === key) === index;
  });

  return uniqueRows.map((row, idx) => ({
    id: String(idx),
    ringId: row.ringId || '',
    species: row.species || '',
    certId: row.certId || '',
    result: row.result || '',
    reportDate: row.reportDate || '',
    submittedBy: row.submittedBy || '',
    rawText: `${row.ringId || ''} ${row.species || ''} ${row.certId || ''} ${row.result || ''}`.trim(),
  }));
};

const buildSelectableRowsFromStructuredRows = (rows: GloriousTableRow[]): LabReportSelectableRow[] => {
  const uniqueRows = rows.filter((row, index, arr) => {
    const key = `${normalizeToken(row.certId)}|${normalizeToken(row.result)}|${normalizeToken(row.ringId)}`;
    return key !== '||' && arr.findIndex((candidate) => `${normalizeToken(candidate.certId)}|${normalizeToken(candidate.result)}|${normalizeToken(candidate.ringId)}` === key) === index;
  });

  return uniqueRows.map((row, idx) => ({
    id: String(idx),
    ringId: normalizeRingIdValue(row.ringId),
    species: normalizeSpeciesValue(row.species),
    certId: normalizeCertIdValue(row.certId),
    result: normalizeResultValue(row.result),
    reportDate: normalizeDateValue(row.reportDate),
    submittedBy: normalizeSubmittedByValue(row.submittedBy),
    rawText: cleanValue([
      row.srNo,
      row.reportDate,
      row.submittedBy,
      row.ringId,
      row.species,
      row.certId,
      row.result,
    ].join(' ')),
  }));
};

const buildRowsCsv = (rows: LabReportSelectableRow[]) => {
  const header = ['srNo', 'reportDate', 'submittedBy', 'ringId', 'species', 'certId', 'result'];
  const body = rows.map((row, index) => ([
    String(index + 1),
    csvEscape(row.reportDate),
    csvEscape(row.submittedBy),
    csvEscape(row.ringId),
    csvEscape(row.species),
    csvEscape(row.certId),
    csvEscape(row.result),
  ].join(',')));

  return [header.join(','), ...body].join('\n');
};

export const extractLabReportWithText = async (pdfBuffer: Buffer, context?: ExtractionContext): Promise<ParsedLabReportDebug> => {
  try {
    const text = await extractPdfText(pdfBuffer);
    const layoutItems = await extractPdfLayoutWithPdfJs(pdfBuffer);
    const kv = buildKeyValueMap(text);
    const layoutRows = parseGloriousRowsFromLayout(layoutItems);
    const gloriousRows = layoutRows.length ? layoutRows : parseGloriousTableRows(text);
    const fallbackRows = gloriousRows.length ? gloriousRows : parseRowsByCertResultFallback(text);
    const matchedRow = selectRowForBird(fallbackRows, context);
    const rows = layoutRows.length
      ? buildSelectableRowsFromStructuredRows(layoutRows)
      : buildSelectableRows(text);
    const csvText = buildRowsCsv(rows);

    const fields: ParsedLabReportFields = {
      bandId: capture(text, [
        /Bird\s*ID\s*\/\s*Band\s*:?\s*([^\n]+)/i,
        /Bird\s*Id\s*\/\s*Band\s*:?\s*([^\n]+)/i,
        /Bird\s*Id\s*\/\s*Band\s*[:.-]?\s*([A-Za-z0-9-]+)/i,
        /Band\s*Id\s*[:.-]?\s*([A-Za-z0-9-]+)/i,
        /Band\s*:?\s*([^\n]+)/i,
      ]) || matchedRow?.ringId || kv['bird id / band'] || kv['bird id/band'] || kv['band id'] || kv['band'],
      species: capture(text, [
        /Bird\s*Species\s*:?\s*([^\n]+)/i,
        /Species\s*:?\s*([^\n]+)/i,
      ]) || matchedRow?.species || kv['bird species'] || kv['species'],
      submittedBy: capture(text, [
        /Submitted\s*By\s*:?\s*([^\n]+)/i,
      ]) || matchedRow?.submittedBy || kv['submitted by'],
      reportDate: capture(text, [
        /Report\s*Date\s*:?\s*([^\n]+)/i,
      ]) || matchedRow?.reportDate || kv['report date'],
      receivedDate: capture(text, [
        /Receiv(?:ed|e)\s*Date\s*:?\s*([^\n]+)/i,
      ]) || kv['received date'] || kv['receive date'],
      certId: capture(text, [
        /Cert\s*ID\s*:?\s*([^\n]+)/i,
        /Certificate\s*ID\s*:?\s*([^\n]+)/i,
      ]) || matchedRow?.certId || kv['cert id'] || kv['certificate id'],
      result: capture(text, [
        /\bResult\s*[:.-]?\s*(Male|Female|Unknown)\b/i,
        /\bReport\s*[:.-]?\s*(Male|Female|Unknown)\b/i,
        /\b(Male|Female|Unknown)\b/i,
      ]) || matchedRow?.result || kv['result'] || kv['report'],
      specimen: capture(text, [
        /Specimen\s*Submitted\s*:?\s*([^\n]+)/i,
        /Specimen\s*submitted\s*:?\s*([^\n]+)/i,
      ]) || kv['specimen submitted'] || kv['specimen'],
    };

    return {
      fields,
      extractedText: text || 'No text extracted from PDF. It may be scanned/image-only PDF without text layer.',
      rows,
      csvText,
    };
  } catch {
    return {
      fields: {},
      extractedText: 'Text extraction failed unexpectedly. Please try another lab PDF.',
      rows: [],
      csvText: '',
    };
  }
};

export const extractLabReportFields = async (pdfBuffer: Buffer, context?: ExtractionContext): Promise<ParsedLabReportFields> => {
  const { fields } = await extractLabReportWithText(pdfBuffer, context);
  return fields;
};

const getVerificationBaseUrl = () => {
  const raw = process.env.PETMAZA_VERIFICATION_BASE_URL
    || process.env.BACKEND_PUBLIC_URL
    || process.env.APP_BASE_URL
    || 'http://localhost:6969';

  return raw.replace(/\/+$/, '');
};

const toDisplayDate = (value?: string) => {
  if (!value) {
    return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return value;
};

export const convertPartnerLabPdfToPetmazaPdf = async (
  sourcePdfBuffer: Buffer,
  context: PetmazaReportContext,
  preExtracted?: ParsedLabReportFields
): Promise<{ buffer: Buffer; verificationUrl: string; extracted: ParsedLabReportFields }> => {
  const extracted = preExtracted || await extractLabReportFields(sourcePdfBuffer);

  const bandId = extracted.bandId || context.bandId || `BIRD-${context.birdIndex + 1}`;
  const species = extracted.species || context.species || 'Not specified';
  const submittedBy = extracted.submittedBy || context.uploadedByName || 'Petmaza Partner Lab';
  const reportDate = toDisplayDate(extracted.reportDate);
  const receivedDate = toDisplayDate(extracted.receivedDate);
  const certId = extracted.certId || '';
  const result = (extracted.result || '').toUpperCase();
  const specimen = extracted.specimen || 'Feather';

  if (!certId || !result || !['MALE', 'FEMALE', 'UNKNOWN'].includes(result)) {
    throw new Error('Could not extract required fields (Result/Cert ID) from uploaded PDF.');
  }

  const verificationUrl = `${getVerificationBaseUrl()}/api/services/verify-report?requestId=${encodeURIComponent(context.requestId)}&birdIndex=${context.birdIndex}&certId=${encodeURIComponent(certId)}&bandId=${encodeURIComponent(bandId)}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    margin: 1,
    width: 180,
    color: {
      dark: '#1F2A44',
      light: '#FFFFFF',
    },
  });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve({ buffer: Buffer.concat(chunks), verificationUrl, extracted }));
      stream.on('error', reject);

      doc.pipe(stream);

      const pageWidth = doc.page.width;

      doc.rect(0, 0, pageWidth, 64).fill('#1F2A44');
      doc.rect(pageWidth - 130, 0, 130, 64).fill('#F4C430');

      doc
        .fillColor('#FFFFFF')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('PETMAZA DNA LABS', 36, 22);

      doc
        .fillColor('#1F2A44')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('DNA SEXING REPORT', 36, 90);

      doc
        .fontSize(10)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text(`Petmaza Request: ${context.requestId.slice(-10).toUpperCase()}`)
        .text(`Generated On: ${new Date().toLocaleString('en-IN')}`);

      const startY = 150;
      const leftX = 36;
      const rightX = 310;
      const lineGap = 26;

      const drawPair = (label: string, value: string, x: number, y: number) => {
        doc
          .fontSize(11)
          .fillColor('#374151')
          .font('Helvetica-Bold')
          .text(`${label}:`, x, y, { width: 120 });
        doc
          .fontSize(11)
          .fillColor('#111827')
          .font('Helvetica')
          .text(value || 'N/A', x + 120, y, { width: 160 });
      };

      drawPair('Bird Name', context.birdName || `Bird ${context.birdIndex + 1}`, leftX, startY);
      drawPair('Band Id', bandId, rightX, startY);
      drawPair('Farm Name', context.farmName || 'N/A', leftX, startY + lineGap);
      drawPair('Species', species, rightX, startY + lineGap);
      drawPair('Submitted By', submittedBy, leftX, startY + lineGap * 2);
      drawPair('Specimen', specimen, rightX, startY + lineGap * 2);
      drawPair('Received Date', receivedDate, leftX, startY + lineGap * 3);
      drawPair('Report Date', reportDate, rightX, startY + lineGap * 3);
      drawPair('Certificate Id', certId, leftX, startY + lineGap * 4);

      doc
        .roundedRect(36, 315, pageWidth - 72, 75, 8)
        .fill('#F9FAFB');

      doc
        .fontSize(15)
        .fillColor('#1F2A44')
        .font('Helvetica-Bold')
        .text('RESULT', 56, 335);

      doc
        .fontSize(30)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text(result, 140, 325);

      doc
        .image(qrBuffer, pageWidth - 145, 290, { fit: [95, 95] })
        .fontSize(9)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text('Scan to verify', pageWidth - 145, 392, { width: 95, align: 'center' });

      doc
        .fontSize(9)
        .fillColor('#4B5563')
        .text('Verification URL:', 36, 420)
        .fillColor('#2563EB')
        .text(verificationUrl, { link: verificationUrl, underline: true });

      doc
        .fontSize(10)
        .fillColor('#6B7280')
        .text('Verified and issued by Petmaza DNA Labs for customer delivery.', 36, 720, {
          width: pageWidth - 72,
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
