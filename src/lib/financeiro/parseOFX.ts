import type { ParsedTransaction } from "./parseMobillsCsv";

/**
 * Parse an OFX/QFX bank statement file into transactions.
 *
 * OFX (Open Financial Exchange) is a standard format used by most
 * Brazilian banks (Itaú, Bradesco, BB, Santander, etc.) for exporting
 * account statements.
 *
 * Key tags parsed:
 * - STMTTRN: transaction block
 * - DTPOSTED: date (YYYYMMDD or YYYYMMDDHHmmss)
 * - TRNAMT: amount (positive=credit, negative=debit)
 * - MEMO or NAME: description
 * - TRNTYPE: DEBIT, CREDIT, etc.
 * - FITID: unique transaction ID (used for dedup)
 */
export function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Extract all STMTTRN blocks
  // Extract bank name once (not per-transaction)
  const bankName = extractBankName(content);

  const txRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi;
  let match;

  while ((match = txRegex.exec(content)) !== null) {
    const block = match[1];

    const date = extractTag(block, "DTPOSTED");
    const amount = extractTag(block, "TRNAMT");
    const memo = extractTag(block, "MEMO") || extractTag(block, "NAME") || "Sem descrição";
    const trnType = extractTag(block, "TRNTYPE");

    if (!date || !amount) continue;

    const parsedDate = parseOFXDate(date);
    if (!parsedDate) continue;

    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount)) continue;

    // Categorize based on transaction type and description
    const category = categorizeOFXTransaction(memo, trnType || "OTHER");

    // Extract timestamp for night transaction detection
    const occurredAt = parseOFXTimestamp(date);

    transactions.push({
      date: parsedDate,
      description: cleanDescription(memo),
      amount: parsedAmount,
      category,
      account: bankName,
      occurredAt,
    });
  }

  return transactions;
}

/** Extract a single OFX tag value — handles both SGML and XML styles. */
function extractTag(block: string, tag: string): string | null {
  // SGML style: <TAG>value\n
  const sgmlMatch = block.match(new RegExp(`<${tag}>([^<\\n]+)`, "i"));
  if (sgmlMatch) return sgmlMatch[1].trim();

  // XML style: <TAG>value</TAG>
  const xmlMatch = block.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
  if (xmlMatch) return xmlMatch[1].trim();

  return null;
}

/** Parse OFX date format: YYYYMMDD or YYYYMMDDHHmmss → YYYY-MM-DD */
function parseOFXDate(raw: string): string | null {
  // Remove timezone brackets: 20260315120000[-3:BRT]
  const cleaned = raw.replace(/\[.*\]/, "").trim();

  if (cleaned.length < 8) return null;

  const year = cleaned.slice(0, 4);
  const month = cleaned.slice(4, 6);
  const day = cleaned.slice(6, 8);

  const y = parseInt(year);
  const m = parseInt(month);
  const d = parseInt(day);

  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;

  return `${year}-${month}-${day}`;
}

/** Parse OFX date+time to a JS Date for night transaction detection. Returns undefined if no time component. */
function parseOFXTimestamp(raw: string): Date | undefined {
  const cleaned = raw.replace(/\[.*\]/, "").trim();
  if (cleaned.length < 12) return undefined; // No time component (just YYYYMMDD)

  const year = parseInt(cleaned.slice(0, 4));
  const month = parseInt(cleaned.slice(4, 6)) - 1;
  const day = parseInt(cleaned.slice(6, 8));
  const hour = parseInt(cleaned.slice(8, 10));
  const min = parseInt(cleaned.slice(10, 12));
  const sec = cleaned.length >= 14 ? parseInt(cleaned.slice(12, 14)) : 0;

  if (isNaN(hour) || isNaN(min)) return undefined;

  // Extract timezone offset from brackets: [-3:BRT] → -3
  const tzMatch = raw.match(/\[(-?\d+)/);
  const tzOffset = tzMatch ? parseInt(tzMatch[1]) : -3; // Default to BRT (-3)

  // Create UTC date adjusted for timezone
  const date = new Date(Date.UTC(year, month, day, hour - tzOffset, min, sec));
  if (isNaN(date.getTime())) return undefined;

  return date;
}

/** Clean OFX description text (remove extra spaces, trim). */
function cleanDescription(desc: string): string {
  return desc
    .replace(/\s+/g, " ")
    .replace(/^\d{2}\/\d{2}\s*/, "") // Remove leading date prefix some banks add
    .trim()
    .slice(0, 200) || "Sem descrição";
}

/** Try to extract bank name from OFX header. */
function extractBankName(content: string): string | null {
  const org = extractTag(content, "ORG");
  if (org) return org;

  // Common Brazilian bank codes in BANKID
  const bankId = extractTag(content, "BANKID");
  if (!bankId) return null;

  const BANK_NAMES: Record<string, string> = {
    "0001": "Banco do Brasil",
    "0033": "Santander",
    "0104": "Caixa",
    "0237": "Bradesco",
    "0341": "Itaú",
    "0399": "HSBC",
    "0745": "Citibank",
    "0077": "Inter",
    "0260": "Nubank",
  };

  // Try matching last 4 digits or full code
  const code = bankId.padStart(4, "0");
  return BANK_NAMES[code] || null;
}

/** Basic categorization for OFX transactions. */
function categorizeOFXTransaction(description: string, trnType: string): string {
  const desc = description.toLowerCase();

  // Income patterns
  if (trnType === "CREDIT" || trnType === "DEP") {
    if (desc.includes("salario") || desc.includes("salário") || desc.includes("folha")) return "Salario";
    if (desc.includes("pix") && !desc.includes("compra")) return "Transferencia";
    return "Receita";
  }

  // Expense patterns
  if (desc.includes("uber") || desc.includes("99") || desc.includes("cabify")) return "Transporte";
  if (desc.includes("ifood") || desc.includes("rappi") || desc.includes("delivery")) return "Delivery";
  if (desc.includes("farmacia") || desc.includes("drogaria") || desc.includes("droga")) return "Farmacia";
  if (desc.includes("mercado") || desc.includes("supermercado") || desc.includes("carrefour") || desc.includes("pao de acucar")) return "Mercado";
  if (desc.includes("netflix") || desc.includes("spotify") || desc.includes("disney") || desc.includes("amazon prime") || desc.includes("youtube")) return "Assinatura";
  if (desc.includes("academia") || desc.includes("smartfit") || desc.includes("smart fit")) return "Academia";
  if (desc.includes("aluguel") || desc.includes("condominio") || desc.includes("condomínio")) return "Moradia";
  if (desc.includes("energia") || desc.includes("cemig") || desc.includes("enel") || desc.includes("cpfl") || desc.includes("light")) return "Energia";
  if (desc.includes("agua") || desc.includes("água") || desc.includes("sabesp") || desc.includes("copasa")) return "Agua";
  if (desc.includes("gas") || desc.includes("gás") || desc.includes("comgas") || desc.includes("comgás")) return "Gas";
  if (desc.includes("internet") || desc.includes("vivo") || desc.includes("claro") || desc.includes("tim") || desc.includes("oi")) return "Internet";
  if (desc.includes("gasolina") || desc.includes("combustivel") || desc.includes("posto") || desc.includes("shell") || desc.includes("ipiranga")) return "Combustivel";

  return "Outro";
}
