import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

const LOCAL_CSV_PATH = path.resolve("public/schools_and_links.csv");
const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTZ5SnVlSKEzmdrP89pURZJJsm_s3y3vjr8cy3t-eR12UxiZt5pkiz8QCEoYc6mWZJtoXkyJs-vXqN/pub?output=csv";

const currentYear = new Date().getFullYear();

async function loadCsvText() {
  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV (${response.status} ${response.statusText})`,
      );
    }

    return {
      sourceLabel: GOOGLE_SHEET_CSV_URL,
      text: (await response.text()).replace(/^\uFEFF/, ""),
    };
  } catch (error) {
    const localText = fs
      .readFileSync(LOCAL_CSV_PATH, "utf8")
      .replace(/^\uFEFF/, "");
    console.warn(
      `Warning: Could not fetch Google Sheet CSV (${error.message}). Falling back to local file: ${LOCAL_CSV_PATH}`,
    );
    return { sourceLabel: LOCAL_CSV_PATH, text: localText };
  }
}

function parseType(rawType) {
  const trimmed = rawType.trim();

  const yearRangeMatch = trimmed.match(/^(\d{4})\s*-\s*(\d{4}|present)$/i);
  if (yearRangeMatch) {
    const start = Number.parseInt(yearRangeMatch[1], 10);
    const end = /present/i.test(yearRangeMatch[2])
      ? currentYear
      : Number.parseInt(yearRangeMatch[2], 10);

    if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
      return { start, end };
    }

    return null;
  }

  const beforeMatch = trimmed.match(/^In\s+School\s+Before\s+(\d{4})$/i);
  if (beforeMatch) {
    const end = Number.parseInt(beforeMatch[1], 10);
    if (!Number.isNaN(end) && end >= 1900) {
      return { start: 1900, end };
    }
  }

  return null;
}

function reportAndExit(issues) {
  let hasIssues = false;

  if (issues.missingSchoolName.length > 0) {
    hasIssues = true;
    console.error("\nMissing school name:");
    for (const item of issues.missingSchoolName) {
      console.error(`  - line ${item.line}`);
    }
  }

  if (issues.missingLink.length > 0) {
    hasIssues = true;
    console.error("\nRows with missing links:");
    for (const item of issues.missingLink) {
      console.error(
        `  - line ${item.line}: ${item.schoolName} (${item.type || "no type"})`,
      );
    }
  }

  if (issues.missingType.length > 0) {
    hasIssues = true;
    console.error("\nRows with missing year ranges (Type):");
    for (const item of issues.missingType) {
      console.error(`  - line ${item.line}: ${item.schoolName}`);
    }
  }

  if (issues.invalidType.length > 0) {
    hasIssues = true;
    console.error("\nRows with invalid year ranges:");
    for (const item of issues.invalidType) {
      console.error(`  - line ${item.line}: ${item.schoolName} (${item.type})`);
    }
  }

  if (issues.gaps.length > 0) {
    hasIssues = true;
    console.error("\nDetected year gaps within the same school:");
    for (const item of issues.gaps) {
      console.error(
        `  - ${item.schoolName}: ${item.fromYear}-${item.toYear} (between lines ${item.prevLine} and ${item.currLine})`,
      );
    }
  }

  if (issues.overlaps.length > 0) {
    hasIssues = true;
    console.error("\nDetected overlapping year ranges within the same school:");
    for (const item of issues.overlaps) {
      console.error(
        `  - ${item.schoolName}: ${item.overlapStart}-${item.overlapEnd} (between lines ${item.prevLine} and ${item.currLine})`,
      );
    }
  }

  if (hasIssues) {
    process.exit(1);
  }

  console.log(
    "CSV validation passed: no missing links, invalid ranges, gaps, or overlaps found.",
  );
}

async function main() {
  const { sourceLabel, text } = await loadCsvText();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error("CSV parse errors detected:");
    for (const err of parsed.errors) {
      console.error(`  - row ${err.row ?? "?"}: ${err.message}`);
    }
    process.exit(1);
  }

  const rows = parsed.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("CSV appears empty or missing data rows.");
    process.exit(1);
  }

  const issues = {
    missingSchoolName: [],
    missingLink: [],
    missingType: [],
    invalidType: [],
    gaps: [],
    overlaps: [],
  };

  /** @type {Map<string, Array<{line:number,start:number,end:number,rawType:string,link:string}>>} */
  const rangesBySchool = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const schoolName = String(row["School Name"] ?? "").trim();
    const link = String(row["Link"] ?? "").trim();
    const type = String(row["Type"] ?? "").trim();

    if (!schoolName) {
      issues.missingSchoolName.push({ line: rowNumber });
      return;
    }

    if (!link) {
      issues.missingLink.push({ line: rowNumber, schoolName, type });
    }

    if (!type) {
      issues.missingType.push({ line: rowNumber, schoolName });
      return;
    }

    const parsedType = parseType(type);
    if (!parsedType) {
      issues.invalidType.push({ line: rowNumber, schoolName, type });
      return;
    }

    const existing = rangesBySchool.get(schoolName) ?? [];
    existing.push({
      line: rowNumber,
      start: parsedType.start,
      end: parsedType.end,
      rawType: type,
      link,
    });
    rangesBySchool.set(schoolName, existing);
  });

  for (const [schoolName, ranges] of rangesBySchool.entries()) {
    const sorted = ranges.sort((a, b) => a.start - b.start || a.end - b.end);

    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (curr.start > prev.end + 1) {
        issues.gaps.push({
          schoolName,
          fromYear: prev.end + 1,
          toYear: curr.start - 1,
          prevLine: prev.line,
          currLine: curr.line,
        });
      } else if (curr.start <= prev.end) {
        issues.overlaps.push({
          schoolName,
          overlapStart: curr.start,
          overlapEnd: Math.min(prev.end, curr.end),
          prevLine: prev.line,
          currLine: curr.line,
        });
      }
    }
  }

  console.log(`Checked source: ${sourceLabel}`);
  reportAndExit(issues);
}

main().catch((error) => {
  console.error(`Failed to validate CSV: ${error.message}`);
  process.exit(1);
});
