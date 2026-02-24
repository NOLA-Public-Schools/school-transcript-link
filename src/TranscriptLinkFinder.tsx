import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Autocomplete,
  Box,
  Button,
  TextField,
  Typography,
  Link as MuiLink,
} from "@mui/material";

const SCHOOL_NAME_ALIASES: Record<string, string> = {
  //   "Rabouin High School": "The NET Central City",
  //   "Fredrick Douglass High": "Frederick A. Douglass High",
  //   "Sarah T. Reed": "Livingston Collegiate Academy",
  // Add more aliases here...
  BFHS: "Benjamin Franklin High School",
};

interface SchoolRow {
  "School Name": string;
  Link: string;
  Type: string; // e.g. "2006-present"
}

export default function TranscriptLinkFinder() {
  const [data, setData] = useState<SchoolRow[]>([]);
  const [schoolOptions, setSchoolOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetch(
      `https://docs.google.com/spreadsheets/d/e/2PACX-1vQTZ5SnVlSKEzmdrP89pURZJJsm_s3y3vjr8cy3t-eR12UxiZt5pkiz8QCEoYc6mWZJtoXkyJs-vXqN/pub?output=csv`,
    )
      .then((res) => res.text())
      .then((csvText) => {
        const parsed = Papa.parse<SchoolRow>(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        const rows = parsed.data;
        setData(rows);

        const schools: string[] = Array.from(
          new Set([
            ...rows.map((r: SchoolRow) => r["School Name"]),
            ...Object.keys(SCHOOL_NAME_ALIASES), // ← Add old names too
          ]),
        ).sort();
        setSchoolOptions(schools);

        const currentYear = new Date().getFullYear();
        const fullYearRange = Array.from(
          { length: currentYear - 1900 + 1 },
          (_, i) => (currentYear - i).toString(),
        );
        setYearOptions(fullYearRange);
        setSelectedYear(currentYear.toString());
      });
  }, []);

  useEffect(() => {
    setLinkResult(null);
    setHasSearched(false);
  }, [selectedSchool, selectedYear]);

  const graduationInRange = (type: string, year: number): boolean => {
    const startYear = parseInt(type.match(/\d{4}/g)?.[0] || "0");
    const endYear = type.includes("present")
      ? new Date().getFullYear()
      : parseInt(type.match(/\d{4}/g)?.[1] || "0");

    //   if not a valid range, return false
    if (isNaN(startYear) || isNaN(endYear) || startYear > endYear) {
      return false;
    }
    return year >= startYear && year <= endYear;
  };

  const handleSearch = () => {
    setHasSearched(true);

    if (!selectedSchool || !selectedYear) {
      setLinkResult(null);
      return;
    }

    const year = parseInt(selectedYear);
    const normalizedSchool =
      SCHOOL_NAME_ALIASES[selectedSchool] || selectedSchool;

    const match = data.find((row) => {
      const nameMatch =
        row["School Name"].toLowerCase() === normalizedSchool.toLowerCase();
      const matchYears = graduationInRange(row.Type, year);

      return nameMatch && matchYears;
    });
    setLinkResult(match?.Link || null);
  };

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", mt: 6 }}>
      <Typography variant="h5" sx={{ mb: 4 }}>
        Find Your Transcript Link
      </Typography>

      <Autocomplete
        options={schoolOptions}
        value={selectedSchool}
        onChange={(_, val) => setSelectedSchool(val)}
        renderInput={(params) => <TextField {...params} label="School Name" />}
        sx={{ mb: 2 }}
        freeSolo
      />
      {selectedSchool && SCHOOL_NAME_ALIASES[selectedSchool] && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          Mapped to current school:{" "}
          <strong>{SCHOOL_NAME_ALIASES[selectedSchool]}</strong>
        </Typography>
      )}

      <Autocomplete
        options={yearOptions}
        value={selectedYear}
        onChange={(_, val) => setSelectedYear(val)}
        renderInput={(params) => (
          <TextField {...params} label="Graduation Year" />
        )}
        sx={{ mb: 2 }}
        freeSolo
      />

      <Button
        variant="contained"
        fullWidth
        onClick={handleSearch}
        disabled={!selectedSchool || !selectedYear}
      >
        Get Link
      </Button>

      {linkResult && (
        <Typography sx={{ mt: 2 }}>
          <MuiLink href={linkResult} target="_blank" rel="noopener">
            {linkResult}
          </MuiLink>
        </Typography>
      )}
      {hasSearched && !linkResult && (
        <Typography sx={{ mt: 2, color: "text.secondary" }}>
          No link found for the selected school and year. Please contact NOLAPS
          for assistance.
        </Typography>
      )}
    </Box>
  );
}
