# ShadowNet SOC Dashboard - What the Site Shows and Why

## Purpose & Audience
ShadowNet is a lightweight, frontend-only SOC dashboard built for security analysts, SOC teams, IT operators, and small-to-medium organizations that need quick visibility into networked devices without a backend. It helps teams prioritize remediation, triage incidents, and produce simple reports from locally-provided device data.

Who benefits:
- SOC analysts and incident responders — fast triage and top-risk lists
- IT / operations teams — asset visibility and patch-age insights
- Compliance owners — quick exportable evidence (PDF/CSV/Excel)
- Trainers/POCs — demo risk scoring and dashboards without infra

## What data we ask for
The dashboard expects device inventory rows (manual entry or upload). Required fields:
- `ip` (string)
- `port` or `open_ports` (integer or list)
- `protocol` (e.g., TCP, UDP, HTTP, SSH)
- `last_patch_year` (4-digit year)
- `uptime` or `uptime_days` (integer, days)

Optional helpful fields:
- `device_type`, `business_impact`, `recommendation`

Files accepted: CSV or Excel (.csv, .xlsx, .xls). The upload preview shows parsed rows before import.

## What the site shows (derived from the provided data)
From the fields above the app derives risk scores and visualizations that answer operational questions:

- Dashboard summary metrics: Security Score, counts of Critical / High / Medium / Low devices, total devices.
- Risk Distribution (donut): percentage and counts per risk level (CRITICAL / HIGH / MEDIUM / LOW).
- Device Composition (bar): top device types and their counts to show asset mix.
- Top 5 Critical Devices: sorted list of the highest-risk devices with a risk percentage, brief recommendation, and a visual severity bar (color-coded: deep red → orange → yellow → green).
- Exposure Index / High+Critical %: aggregate metric showing proportion of devices needing urgent attention.
- Business Impact breakdown: how risk maps to declared business impact buckets (stacked bars).
- Lifecycle correlation: comparison of average risk between outdated (long-unpatched) vs maintained systems.
- Current vs Projected Risk Trend: simple trend lines to visualize direction of risk.
- Devices table: full device list with details, expandable risk analysis, and filtering/sorting.
- Alerts panel: active / resolved / escalated alerts computed from risk state and user actions; alert badge shows active critical/high counts.
- Upload preview table: raw parsed rows with counts before adding to the dashboard.
- Export options: download the current dataset or report as CSV, Excel, or PDF for sharing and audit.

Each visualization is computed client-side from the uploaded or manually-entered rows; charts update instantly when devices are added.

## Why this matters
- Fast, infrastructure-free visibility: teams can get meaningful risk insights without deploying servers or databases.
- Prioritization: the Top 5 and Exposure Index give a focused view for remediation planning.
- Auditability: PDF/CSV/Excel exports let teams include dashboard output in reports or ticketing systems.
- Portable demos & training: easy to demonstrate SOC workflows without backend complexity.

## Data privacy & limits
- All processing happens in the browser — no data leaves your machine unless you explicitly export it.
- No persistence: data is kept in-memory for the session and cleared on refresh (by design).
- Not a replacement for enterprise SIEMs — this is a lightweight tool for visibility, triage, and demonstration.

## How to use the data (short guide)
1. Open `index.html` (Live Server recommended).
2. Go to Add Devices → Manual Entry to add single devices, or Upload to import a CSV/Excel file.
3. Preview the upload, then confirm to add devices to the session.
4. Visit Dashboard / Analytics to review charts, Top 5, and alert badge.
5. Export a report via PDF / CSV / Excel for stakeholders.

## Want changes?
If you need different derived fields (different risk weights, new impact buckets, or persistence), edit `app.js` (risk calculation and `getRiskLevel()`), or ask and I can add an offline persistence option (localStorage) or CSV auto-save.

---
Updated to document what the site shows, the required input data, the target audience, and why this frontend-only SOC dashboard is useful.
A: Yes! Use any static hosting (Netlify, Vercel, GitHub Pages, etc.).

---

## Ready to Use!

No installation. No configuration. No database setup.

**Open `index.html` and start analyzing!**

---

*ShadowNet Frontend-Only Edition - Pure Browser-Based Security Analysis*
