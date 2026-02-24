# 📄 Transcript Link Finder

This is a simple web app built with **React**, **TypeScript**, and **Vite** that allows users to find their high school transcript request link by selecting their school name and graduation year.

### ✨ Features

- 🔍 Autocomplete inputs for school name and graduation year
- 🔁 Alias support for historical/renamed schools (e.g., "BFHS" → "Benjamin Franklin High School")
- 📅 Graduation year dropdown from 1900 to present
- 📤 Pulls data directly from a live **Google Sheet** (CSV format)
- ⚡ Built with Vite for fast development and easy GitHub Pages deployment

### 🔗 Live Demo

[https://nola-public-schools.github.io/school-transcript-link/](https://nola-public-schools.github.io/school-transcript-link/)

### 🚀 Local Development

```bash
npm install
npm run dev
npm run deploy
```

### ✅ CSV Data Quality Check

Run this script to validate the live Google Sheet CSV (same source used by the app) for:

- missing school names
- missing links
- missing/invalid year ranges (`Type`)
- year gaps or overlaps within the same school

```bash
npm run check:csv
```
