import * as XLSX from "xlsx";
import type { ParsedTransaction } from "./parseMobillsCsv";

/**
 * Parse a Mobills XLSX export into transactions.
 *
 * Reads the first sheet and looks for the same columns as the CSV parser:
 * DATA/DATE, DESCRICAO/DESCRIPTION, VALOR/VALUE, CONTA/ACCOUNT, CATEGORIA/CATEGORY
 */
export function parseMobillsXlsx(buffer: ArrayBuffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // Convert sheet to array of arrays (raw rows)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false, // get formatted strings so dates come as text
    defval: "",
  });

  if (rows.length < 2) return [];

  // Parse header to find column indices
  const headers = (rows[0] as string[]).map((h) => normalizeHeader(String(h)));
  const dateIdx = headers.findIndex((h) => h === "data" || h === "date");
  const descIdx = headers.findIndex(
    (h) => h === "descricao" || h === "description",
  );
  const valueIdx = headers.findIndex((h) => h === "valor" || h === "value");
  const accountIdx = headers.findIndex((h) => h === "conta" || h === "account");
  const categoryIdx = headers.findIndex(
    (h) => h === "categoria" || h === "category",
  );

  if (dateIdx === -1 || valueIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length === 0) continue;

    const rawDate = String(cols[dateIdx] ?? "").trim();
    const rawValue = String(cols[valueIdx] ?? "").trim();
    if (!rawDate || !rawValue) continue;

    const date = parseDateValue(rawDate);
    if (!date) continue;

    const amount = parseBrazilianNumber(rawValue);
    if (isNaN(amount)) continue;

    transactions.push({
      date,
      description:
        descIdx >= 0 ? String(cols[descIdx] ?? "").trim() || "Sem descricao" : "Sem descricao",
      amount,
      category:
        categoryIdx >= 0
          ? String(cols[categoryIdx] ?? "").trim() || "outro"
          : "outro",
      account:
        accountIdx >= 0
          ? String(cols[accountIdx] ?? "").trim() || null
          : null,
    });
  }

  return transactions;
}

/** Normalize header to lowercase, remove accents. */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Parse date from various formats:
 * - dd/mm/yyyy (Brazilian)
 * - yyyy-mm-dd (ISO)
 * - Excel serial number (e.g. 45350)
 * - mm/dd/yyyy (US format from Excel)
 */
function parseDateValue(raw: string): string | null {
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // dd/mm/yyyy or mm/dd/yyyy
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1]);
    const b = parseInt(slashMatch[2]);
    const year = slashMatch[3];

    // If first part > 12, it must be day (Brazilian dd/mm/yyyy)
    if (a > 12) {
      const day = String(a).padStart(2, "0");
      const month = String(b).padStart(2, "0");
      if (b < 1 || b > 12 || a < 1 || a > 31) return null;
      return `${year}-${month}-${day}`;
    }
    // If second part > 12, it must be day (US mm/dd/yyyy)
    if (b > 12) {
      const month = String(a).padStart(2, "0");
      const day = String(b).padStart(2, "0");
      if (a < 1 || a > 12 || b < 1 || b > 31) return null;
      return `${year}-${month}-${day}`;
    }
    // Ambiguous — assume Brazilian (dd/mm/yyyy) since Mobills is Brazilian
    const day = String(a).padStart(2, "0");
    const month = String(b).padStart(2, "0");
    if (b < 1 || b > 12 || a < 1 || a > 31) return null;
    return `${year}-${month}-${day}`;
  }

  // Excel serial number (pure number)
  if (/^\d+$/.test(raw)) {
    const serial = parseInt(raw);
    if (serial > 30000 && serial < 100000) {
      // Excel date serial → JS date
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + serial * 86400000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

/**
 * Parse Brazilian number format: "1.234,56" → 1234.56
 * Also handles standard format: "1234.56"
 */
function parseBrazilianNumber(raw: string): number {
  let str = raw.replace(/\s/g, "").replace(/^R\$\s*/i, "");

  // Handle parentheses as negative
  if (str.startsWith("(") && str.endsWith(")")) {
    str = "-" + str.slice(1, -1);
  }

  if (str.includes(",") && str.includes(".")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",") && !str.includes(".")) {
    str = str.replace(",", ".");
  }

  return parseFloat(str);
}
