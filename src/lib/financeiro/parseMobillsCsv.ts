export interface ParsedTransaction {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;      // positive = income, negative = expense
  category: string;
  account: string | null;
}

/**
 * Parse a Mobills CSV export into transactions.
 *
 * Mobills CSV format:
 * - Columns: DATA, DESCRICAO/DESCRIPTION, VALOR/VALUE, CONTA/ACCOUNT, CATEGORIA/CATEGORY
 * - Date format: dd/mm/yyyy
 * - Number format: Brazilian ("1.234,56" = 1234.56) or standard ("1234.56")
 * - Delimiter: comma or semicolon
 * - May have BOM prefix
 */
export function parseMobillsCsv(csvContent: string): ParsedTransaction[] {
  // Strip BOM
  let content = csvContent.replace(/^\uFEFF/, "");
  content = content.trim();
  if (!content) return [];

  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect delimiter from header line
  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : ",";

  // Parse header to find column indices
  const headers = parseLine(headerLine, delimiter).map((h) => normalizeHeader(h));
  const dateIdx = headers.findIndex((h) => h === "data" || h === "date");
  const descIdx = headers.findIndex((h) => h === "descricao" || h === "description");
  const valueIdx = headers.findIndex((h) => h === "valor" || h === "value");
  const accountIdx = headers.findIndex((h) => h === "conta" || h === "account");
  const categoryIdx = headers.findIndex((h) => h === "categoria" || h === "category");

  if (dateIdx === -1 || valueIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseLine(line, delimiter);

    const rawDate = cols[dateIdx]?.trim();
    const rawValue = cols[valueIdx]?.trim();
    if (!rawDate || !rawValue) continue;

    const date = parseBrazilianDate(rawDate);
    if (!date) continue;

    const amount = parseBrazilianNumber(rawValue);
    if (isNaN(amount)) continue;

    transactions.push({
      date,
      description: cols[descIdx]?.trim() || "Sem descricao",
      amount,
      category: cols[categoryIdx]?.trim() || "Outro",
      account: cols[accountIdx]?.trim() || null,
    });
  }

  return transactions;
}

/** Parse a CSV line handling quoted fields. */
function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  result.push(current);
  return result;
}

/** Normalize header to lowercase, remove accents. */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/[""]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Parse dd/mm/yyyy → YYYY-MM-DD. Also accepts YYYY-MM-DD. */
function parseBrazilianDate(raw: string): string | null {
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // dd/mm/yyyy
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];

  // Basic validation
  const m = parseInt(month);
  const d = parseInt(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  return `${year}-${month}-${day}`;
}

/**
 * Parse Brazilian number format: "1.234,56" → 1234.56
 * Also handles standard format: "1234.56"
 * Negative values: "-1.234,56" or "(1.234,56)"
 */
function parseBrazilianNumber(raw: string): number {
  let str = raw.replace(/\s/g, "");

  // Handle parentheses as negative: (100) → -100
  const isParenNeg = str.startsWith("(") && str.endsWith(")");
  if (isParenNeg) {
    str = "-" + str.slice(1, -1);
  }

  // Detect format: if both . and , exist, determine which is decimal
  if (str.includes(",") && str.includes(".")) {
    // Brazilian: 1.234,56 — dots are thousands, comma is decimal
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    }
    // else standard: 1,234.56 — commas are thousands, dot is decimal
    else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",") && !str.includes(".")) {
    // Only comma: could be decimal separator
    // "123,45" → 123.45
    str = str.replace(",", ".");
  }
  // Only dot or no separator: parse as-is

  return parseFloat(str);
}
