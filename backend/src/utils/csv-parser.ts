import { parse } from 'csv-parse/sync';
import { ParseRecipientsResult } from '../types';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export class RecipientParser {
  /**
   * Parse either CSV buffer/text or newline-separated email leads
   */
  static parse(content: string | Buffer): ParseRecipientsResult {
    const rawContent = typeof content === 'string' ? content : content.toString('utf-8');
    const validEmails: string[] = [];
    const invalidList: { email: string; reason: string }[] = [];
    const duplicateList: string[] = [];
    const seen = new Set<string>();

    let extractedStrings: string[] = [];

    // Attempt CSV parsing first
    try {
      const records = parse(rawContent, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as string[][];

      if (records.length > 0) {
        // Detect header row if present
        const firstRow = records[0].map((c) => c.toLowerCase().trim());
        let emailColIdx = firstRow.findIndex((col) => col.includes('email') || col.includes('recipient') || col.includes('lead'));

        let startRow = 0;
        if (emailColIdx !== -1) {
          startRow = 1; // skip header
        } else {
          // If no column named email, find first column in row 0 that looks like an email or default to 0
          emailColIdx = 0;
          if (records[0][0] && EMAIL_REGEX.test(records[0][0])) {
            startRow = 0;
          }
        }

        for (let i = startRow; i < records.length; i++) {
          const row = records[i];
          if (emailColIdx !== -1 && startRow === 1) {
            // Header was explicitly detected, pick that specific column
            if (row[emailColIdx] !== undefined) {
              extractedStrings.push(row[emailColIdx]);
            }
          } else if (row.length === 1) {
            // Single column list (e.g. text file or 1-column CSV)
            extractedStrings.push(row[0]);
          } else {
            // Multi-column list
            for (const cell of row) {
              if (cell && (cell.includes('@') || !cell.includes(' '))) {
                extractedStrings.push(cell);
              }
            }
          }
        }
      }
    } catch (e) {
      // If CSV parse failed, fallback to line-by-line / comma splitting
      extractedStrings = rawContent
        .split(/[\r\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (extractedStrings.length === 0) {
      extractedStrings = rawContent
        .split(/[\r\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    let total = 0;

    for (const rawEmail of extractedStrings) {
      const email = rawEmail.trim().toLowerCase();
      // Skip obvious header names that leaked
      if (email === 'email' || email === 'emails' || email === 'recipient' || email === 'lead') {
        continue;
      }

      total++;

      if (!EMAIL_REGEX.test(email)) {
        invalidList.push({ email: rawEmail, reason: 'Invalid email address syntax' });
        continue;
      }

      if (seen.has(email)) {
        duplicateList.push(email);
        continue;
      }

      seen.add(email);
      validEmails.push(email);
    }

    return {
      valid: validEmails,
      invalid: invalidList,
      duplicates: duplicateList,
      total,
    };
  }
}
