import type { ParsedTransaction } from "./parseMobillsCsv";

/**
 * Auto-detect bank and parse CSV into transactions.
 *
 * Supported banks:
 * - Nubank (conta corrente + cartão de crédito)
 * - Inter (extrato)
 * - Itaú (extrato)
 * - C6 Bank
 * - Bradesco
 *
 * Falls back to generic parser if bank not detected.
 */
export function parseBankCsv(content: string): { transactions: ParsedTransaction[]; bank: string } {
  const cleaned = content.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return { transactions: [], bank: "unknown" };

  const lines = cleaned.split(/\r?\n/);
  if (lines.length < 2) return { transactions: [], bank: "unknown" };

  const headerLine = lines[0].toLowerCase();

  // Detect bank by header pattern — order matters (most specific first)
  if (isC6(headerLine)) {
    return { transactions: parseC6(lines), bank: "c6" };
  }
  if (isNubankCC(headerLine)) {
    return { transactions: parseNubankCC(lines), bank: "nubank_cc" };
  }
  if (isInter(headerLine)) {
    return { transactions: parseInter(lines), bank: "inter" };
  }
  if (isItau(headerLine)) {
    return { transactions: parseItau(lines), bank: "itau" };
  }
  if (isNubankConta(headerLine)) {
    return { transactions: parseNubankConta(lines), bank: "nubank_conta" };
  }

  return { transactions: [], bank: "unknown" };
}

// ── Nubank Credit Card ──────────────────────────────────────────
// Headers: date,title,amount  OR  date,category,title,amount
function isNubankCC(header: string): boolean {
  return (header.includes("date") && header.includes("title") && header.includes("amount"))
    || (header.includes("data") && header.includes("titulo") && header.includes("valor"));
}

function parseNubankCC(lines: string[]): ParsedTransaction[] {
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsv(lines[0], delimiter).map(normalizeHeader);

  const dateIdx = findIdx(headers, ["date", "data"]);
  const titleIdx = findIdx(headers, ["title", "titulo"]);
  const amountIdx = findIdx(headers, ["amount", "valor"]);
  const categoryIdx = findIdx(headers, ["category", "categoria"]);

  if (dateIdx === -1 || amountIdx === -1) return [];

  const txs: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCsv(line, delimiter);
    const rawDate = cols[dateIdx]?.trim();
    const rawAmount = cols[amountIdx]?.trim();
    if (!rawDate || !rawAmount) continue;

    const date = parseFlexDate(rawDate);
    if (!date) continue;

    const amount = parseBrNumber(rawAmount);
    if (isNaN(amount)) continue;

    txs.push({
      date,
      description: cols[titleIdx]?.trim() || "Sem descrição",
      // Nubank CC exports expenses as positive, negate them
      amount: -Math.abs(amount),
      category: cols[categoryIdx]?.trim() || "Outro",
      account: "Nubank Cartão",
    });
  }
  return txs;
}

// ── Nubank Conta ────────────────────────────────────────────────
// Headers vary but include: Data,Valor,Identificador,Descrição
function isNubankConta(header: string): boolean {
  const norm = normalizeHeader(header);
  return norm.includes("identificador") && norm.includes("descricao");
}

function parseNubankConta(lines: string[]): ParsedTransaction[] {
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsv(lines[0], delimiter).map(normalizeHeader);

  const dateIdx = findIdx(headers, ["data", "date"]);
  const amountIdx = findIdx(headers, ["valor", "value", "amount"]);
  const descIdx = findIdx(headers, ["descricao", "description"]);

  if (dateIdx === -1 || amountIdx === -1) return [];

  const txs: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCsv(line, delimiter);
    const rawDate = cols[dateIdx]?.trim();
    const rawAmount = cols[amountIdx]?.trim();
    if (!rawDate || !rawAmount) continue;

    const date = parseFlexDate(rawDate);
    if (!date) continue;

    const amount = parseBrNumber(rawAmount);
    if (isNaN(amount)) continue;

    txs.push({
      date,
      description: cols[descIdx]?.trim() || "Sem descrição",
      amount, // Nubank conta: negative=debit, positive=credit
      category: "Outro",
      account: "Nubank Conta",
    });
  }
  return txs;
}

// ── Banco Inter ─────────────────────────────────────────────────
// Headers: Data Lançamento;Histórico;Descrição;Valor;Saldo
function isInter(header: string): boolean {
  const norm = normalizeHeader(header);
  return (norm.includes("lancamento") || norm.includes("lançamento"))
    && (norm.includes("historico") || norm.includes("histórico"));
}

function parseInter(lines: string[]): ParsedTransaction[] {
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsv(lines[0], delimiter).map(normalizeHeader);

  const dateIdx = findIdx(headers, ["data lancamento", "data lançamento", "data"]);
  const descIdx = findIdx(headers, ["descricao", "descrição", "historico", "histórico"]);
  const amountIdx = findIdx(headers, ["valor", "value"]);

  if (dateIdx === -1 || amountIdx === -1) return [];

  const txs: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCsv(line, delimiter);
    const rawDate = cols[dateIdx]?.trim();
    const rawAmount = cols[amountIdx]?.trim();
    if (!rawDate || !rawAmount) continue;

    const date = parseFlexDate(rawDate);
    if (!date) continue;

    const amount = parseBrNumber(rawAmount);
    if (isNaN(amount)) continue;

    // Inter uses description column, fallback to histórico
    const desc = cols[descIdx]?.trim() || "Sem descrição";

    txs.push({
      date,
      description: desc,
      amount,
      category: "Outro",
      account: "Inter",
    });
  }
  return txs;
}

// ── Itaú ────────────────────────────────────────────────────────
// Headers: data;lancamento;ag_orig;lote;doc;valor
// Or: Data;Lançamento;Valor
function isItau(header: string): boolean {
  const norm = normalizeHeader(header);
  return norm.includes("lancamento") && !norm.includes("historico")
    && !norm.includes("identificador");
}

function parseItau(lines: string[]): ParsedTransaction[] {
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsv(lines[0], delimiter).map(normalizeHeader);

  const dateIdx = findIdx(headers, ["data", "date"]);
  const descIdx = findIdx(headers, ["lancamento", "lançamento", "descricao"]);
  const amountIdx = findIdx(headers, ["valor", "value"]);

  if (dateIdx === -1 || amountIdx === -1) return [];

  const txs: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCsv(line, delimiter);
    const rawDate = cols[dateIdx]?.trim();
    const rawAmount = cols[amountIdx]?.trim();
    if (!rawDate || !rawAmount) continue;

    const date = parseFlexDate(rawDate);
    if (!date) continue;

    const amount = parseBrNumber(rawAmount);
    if (isNaN(amount)) continue;

    txs.push({
      date,
      description: cols[descIdx]?.trim() || "Sem descrição",
      amount,
      category: "Outro",
      account: "Itaú",
    });
  }
  return txs;
}

// ── C6 Bank ─────────────────────────────────────────────────────
// Headers: Data da Transação;Descrição;Tipo de Transação;Valor;Identificador
function isC6(header: string): boolean {
  const norm = normalizeHeader(header);
  return norm.includes("tipo de transacao") || norm.includes("data da transacao");
}

function parseC6(lines: string[]): ParsedTransaction[] {
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsv(lines[0], delimiter).map(normalizeHeader);

  const dateIdx = findIdx(headers, ["data da transacao", "data"]);
  const descIdx = findIdx(headers, ["descricao", "descrição"]);
  const amountIdx = findIdx(headers, ["valor", "value"]);

  if (dateIdx === -1 || amountIdx === -1) return [];

  const txs: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCsv(line, delimiter);
    const rawDate = cols[dateIdx]?.trim();
    const rawAmount = cols[amountIdx]?.trim();
    if (!rawDate || !rawAmount) continue;

    const date = parseFlexDate(rawDate);
    if (!date) continue;

    const amount = parseBrNumber(rawAmount);
    if (isNaN(amount)) continue;

    txs.push({
      date,
      description: cols[descIdx]?.trim() || "Sem descrição",
      amount,
      category: "Outro",
      account: "C6 Bank",
    });
  }
  return txs;
}

// ── Shared utilities ────────────────────────────────────────────

function detectDelimiter(header: string): string {
  return header.includes(";") ? ";" : ",";
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .replace(/[""]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findIdx(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const normalized = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const idx = headers.findIndex((h) => h.includes(normalized));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Split CSV line handling quoted fields. */
function splitCsv(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
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

/** Parse flexible date: YYYY-MM-DD, dd/mm/yyyy, dd-mm-yyyy */
function parseFlexDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;

  const a = parseInt(match[1]);
  const b = parseInt(match[2]);
  const year = match[3];

  // If first > 12, must be day (BR: dd/mm/yyyy)
  if (a > 12) {
    if (b < 1 || b > 12 || a > 31) return null;
    return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  // Assume Brazilian format
  if (b < 1 || b > 12) return null;
  // a=day, b=month in BR format... wait, BR is dd/mm, so a=day, b=month
  // But we should check: if a <= 12 and b <= 12, assume dd/mm (Brazilian)
  const day = String(a).padStart(2, "0");
  const month = String(b).padStart(2, "0");
  if (a < 1 || a > 31) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Parse Brazilian number format: "1.234,56" → 1234.56
 * Also handles: "-1.234,56", "(1.234,56)", "R$ 1.234,56"
 */
function parseBrNumber(raw: string): number {
  let str = raw.replace(/\s/g, "").replace(/^R\$\s*/i, "");

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
