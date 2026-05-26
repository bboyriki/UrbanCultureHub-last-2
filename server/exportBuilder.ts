/**
 * Streaming, source-isolated export builder for Admin Lead Export.
 *
 * Supports five sources, three formats (CSV / XLSX / PDF), arbitrary row counts,
 * and automatic file-splitting + ZIP packaging when the dataset exceeds the
 * per-format part threshold.
 *
 * Each source has its OWN column definition so map spots, outreach leads,
 * gemeente outreach, events, and spotlighted places never get mixed up.
 *
 * Used by the `/api/admin/export/build` route in server/routes.ts.
 */

import { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ExportSource =
  | "locations"
  | "events"
  | "outreach_leads"
  | "gemeente"
  | "spotlighted_places";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ExportFilters {
  search?: string;
  cities?: string[];
  provinces?: string[];
  types?: string[];
  statuses?: string[];
  categories?: string[];
  municipalities?: string[];
}

export interface BuildOptions {
  source: ExportSource;
  format: ExportFormat;
  filters?: ExportFilters;
  /** Override default part size (rows per part). 0 / undefined = use defaults. */
  partSizeRows?: number;
  /** Optional human label shown on PDF cover and in filenames. */
  label?: string;
}

interface ColumnDef {
  /** Stable column key in the source row */
  key: string;
  /** Human-readable header used in CSV / XLSX / PDF */
  header: string;
  /** Optional formatter (e.g. dates, arrays, booleans) */
  format?: (v: any, row: any) => string;
}

// ────────────────────────────────────────────────────────────────────────────
// Per-format part-size defaults (chosen to keep generated files reasonable)
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_PART_SIZE: Record<ExportFormat, number> = {
  csv: 50_000,   // ~10–25 MB per CSV part for typical row widths
  xlsx: 50_000,  // xlsx (lib) starts to slow noticeably above this
  pdf: 2_500,    // PDFs grow fast; keep per-part download sane
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function fmtDate(v: any): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().split("T")[0];
}

function fmtDateTime(v: any): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().replace("T", " ").substring(0, 19);
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().replace("T", " ").substring(0, 19);
}

function fmtArr(v: any): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join("; ");
  return String(v);
}

function fmtBool(v: any): string {
  if (v === true || v === "true") return "Yes";
  if (v === false || v === "false") return "No";
  return v == null ? "" : String(v);
}

function mapLink(lat: any, lon: any): string {
  if (!lat || !lon) return "";
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

function sanitizeForFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "export";
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ────────────────────────────────────────────────────────────────────────────
// Column definitions per source
// ────────────────────────────────────────────────────────────────────────────

const COLUMNS: Record<ExportSource, ColumnDef[]> = {
  locations: [
    { key: "id",            header: "ID" },
    { key: "name",          header: "Name" },
    { key: "category",      header: "Category" },
    { key: "type",          header: "Type" },
    { key: "address",       header: "Address" },
    { key: "city",          header: "City" },
    { key: "municipality",  header: "Municipality" },
    { key: "lat",           header: "Latitude" },
    { key: "lon",           header: "Longitude" },
    { key: "mapLink",       header: "Map Link" },
    { key: "website",       header: "Website" },
    { key: "phone",         header: "Phone" },
    { key: "email",         header: "Email" },
    { key: "openingHours",  header: "Opening Hours" },
    { key: "indoorOutdoor", header: "Indoor/Outdoor" },
    { key: "amenities",     header: "Amenities", format: fmtArr },
    { key: "tags",          header: "Tags", format: fmtArr },
    { key: "description",   header: "Description" },
    { key: "source",        header: "Source" },
  ],
  events: [
    { key: "id",                 header: "ID" },
    { key: "title",              header: "Event Name" },
    { key: "date",               header: "Date", format: fmtDateTime },
    { key: "endDate",            header: "End Date", format: fmtDateTime },
    { key: "category",           header: "Category" },
    { key: "subcategory",        header: "Subcategory" },
    { key: "musicGenre",         header: "Music Genre" },
    { key: "city",               header: "City" },
    { key: "location",           header: "Location" },
    { key: "latitude",           header: "Latitude" },
    { key: "longitude",          header: "Longitude" },
    { key: "mapLink",            header: "Map Link" },
    { key: "isPaid",             header: "Paid", format: fmtBool },
    { key: "price",              header: "Price (cents)" },
    { key: "priceModel",         header: "Price Model" },
    { key: "externalTicketLink", header: "Ticket Link" },
    { key: "capacity",           header: "Capacity" },
    { key: "soldOut",            header: "Sold Out", format: fmtBool },
    { key: "attendeeCount",      header: "Attendees" },
    { key: "status",             header: "Status" },
    { key: "isFeatured",         header: "Featured", format: fmtBool },
    { key: "source",             header: "Source" },
    { key: "externalId",         header: "External ID" },
    { key: "tags",               header: "Tags", format: fmtArr },
    { key: "description",        header: "Description" },
    { key: "createdAt",          header: "Created", format: fmtDate },
  ],
  outreach_leads: [
    { key: "id",              header: "ID" },
    { key: "organization",    header: "Organization" },
    { key: "name",            header: "Contact Name" },
    { key: "role",            header: "Role" },
    { key: "type",            header: "Type" },
    { key: "industry",        header: "Industry" },
    { key: "leadKind",        header: "Lead Kind" },
    { key: "department",      header: "Department" },
    { key: "email",           header: "Email" },
    { key: "phone",           header: "Phone" },
    { key: "linkedinUrl",     header: "LinkedIn" },
    { key: "website",         header: "Website" },
    { key: "city",            header: "City" },
    { key: "country",         header: "Country" },
    { key: "status",          header: "Status" },
    { key: "score",           header: "Score" },
    { key: "aiConfidence",    header: "AI Confidence" },
    { key: "whyRelevant",     header: "Why Relevant" },
    { key: "suggestedOpener", header: "Suggested Opener" },
    { key: "howToConnect",    header: "How To Connect" },
    { key: "tags",            header: "Tags", format: fmtArr },
    { key: "emailSentCount",  header: "Emails Sent" },
    { key: "lastEmailSubject",header: "Last Email Subject" },
    { key: "lastEmailSentAt", header: "Last Email Sent", format: fmtDateTime },
    { key: "discoveryQuery",  header: "Discovery Query" },
    { key: "notes",           header: "Notes" },
    { key: "createdAt",       header: "Added", format: fmtDate },
  ],
  gemeente: [
    { key: "id",                 header: "ID" },
    { key: "municipalityName",   header: "Municipality" },
    { key: "municipalityCode",   header: "Code" },
    { key: "province",           header: "Province" },
    { key: "city",               header: "City" },
    { key: "website",            header: "Website" },
    { key: "department",         header: "Department" },
    { key: "subDepartment",      header: "Sub-Department" },
    { key: "departmentEmail",    header: "Department Email" },
    { key: "departmentPhone",    header: "Department Phone" },
    { key: "contactName",        header: "Contact Name" },
    { key: "contactRole",        header: "Contact Role" },
    { key: "contactEmail",       header: "Contact Email" },
    { key: "contactPhone",       header: "Contact Phone" },
    { key: "contactLinkedin",    header: "Contact LinkedIn" },
    { key: "outreachStatus",     header: "Outreach Status" },
    { key: "outreachGoal",       header: "Outreach Goal" },
    { key: "priority",           header: "Priority" },
    { key: "emailSentCount",     header: "Emails Sent" },
    { key: "lastContactDate",    header: "Last Contact", format: fmtDate },
    { key: "nextFollowUpDate",   header: "Next Follow-Up", format: fmtDate },
    { key: "hasUrbanCultureBudget", header: "Urban Culture Budget", format: fmtBool },
    { key: "culturalBudgetInfo", header: "Budget Info" },
    { key: "relevantPrograms",   header: "Relevant Programs", format: fmtArr },
    { key: "tags",               header: "Tags", format: fmtArr },
    { key: "aiScore",            header: "AI Score" },
    { key: "aiSummary",          header: "AI Summary" },
    { key: "aiSuggestedApproach",header: "AI Suggested Approach" },
    { key: "internalNotes",      header: "Internal Notes" },
    { key: "meetingNotes",       header: "Meeting Notes" },
    { key: "createdAt",          header: "Added", format: fmtDate },
  ],
  spotlighted_places: [
    { key: "id",             header: "ID" },
    { key: "name",           header: "Name" },
    { key: "category",       header: "Category" },
    { key: "address",        header: "Address" },
    { key: "lat",            header: "Latitude" },
    { key: "lon",            header: "Longitude" },
    { key: "mapLink",        header: "Map Link" },
    { key: "website",        header: "Website" },
    { key: "osmId",          header: "OSM ID" },
    { key: "active",         header: "Active", format: fmtBool },
    { key: "isSuperFeatured",header: "Super Featured", format: fmtBool },
    { key: "adminNote",      header: "Admin Note" },
    { key: "createdAt",      header: "Added", format: fmtDate },
  ],
};

const SOURCE_LABELS: Record<ExportSource, string> = {
  locations: "Map Spots",
  events: "Events",
  outreach_leads: "Outreach Leads",
  gemeente: "Gemeente Outreach",
  spotlighted_places: "Spotlighted Places",
};

// ────────────────────────────────────────────────────────────────────────────
// Source loaders — fetch & normalize rows for a given source
// Each loader returns the FULL filtered dataset as an array. For 70k rows this
// is ~35MB which fits comfortably below the 512MB Node heap cap.
// ────────────────────────────────────────────────────────────────────────────

async function loadLocations(filters: ExportFilters): Promise<any[]> {
  // Map spots come from the prebuilt city-spots JSON cache (~70k OSM spots)
  // plus any approved DB-side `locations` rows.
  const cachePaths = [
    path.join(process.cwd(), "server/data/city_spots_cache.json"),
    path.join(process.cwd(), "data/city_spots_cache.json"),
    "/tmp/city_spots_cache.json",
  ];
  let rawSpots: any[] = [];
  for (const cp of cachePaths) {
    if (fs.existsSync(cp)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cp, "utf-8"));
        rawSpots = parsed.spots || parsed;
        break;
      } catch { /* try next */ }
    }
  }

  // Merge in approved DB locations
  try {
    const { db } = await import("./db");
    const { locations } = await import("../shared/schema");
    const { eq } = await import("drizzle-orm");
    const dbLocs = await db.select().from(locations).where(eq(locations.approvalStatus, "approved"));
    const dbMapped = dbLocs.map((l: any) => ({
      id: `db-${l.id}`,
      name: l.name,
      lat: l.latitude,
      lon: l.longitude,
      category: l.type,
      type: l.type,
      address: l.address || "",
      website: l.website || "",
      phone: "",
      email: "",
      opening_hours: l.openingHours || "",
      indoor_outdoor: l.indoorOutdoor || "",
      amenities: l.amenities || [],
      tags: l.tags || [],
      description: l.description || "",
      source: "platform",
    }));
    rawSpots = [...rawSpots, ...dbMapped];
  } catch { /* DB optional */ }

  // Normalize fields — OSM spots use snake_case, DB spots already mapped above
  const normalized = rawSpots.map((s: any) => ({
    id: s.id,
    name: s.name || "Unnamed Spot",
    category: s.category || s.amenity || s.leisure || s.sport || "place",
    type: s.type || s.category || s.amenity || s.leisure || s.sport || "place",
    address: s.address || "",
    city: s.city || s.addr_city || "",
    municipality: s.municipality || s.addr_municipality || "",
    lat: s.lat,
    lon: s.lon,
    mapLink: mapLink(s.lat, s.lon),
    website: s.website || "",
    phone: s.phone || "",
    email: s.email || "",
    openingHours: s.opening_hours || s.openingHours || "",
    indoorOutdoor: s.indoor_outdoor || s.indoorOutdoor || "",
    amenities: s.amenities || [],
    tags: s.tags || [],
    description: s.description || "",
    source: s.source || "osm",
  }));

  return applyClientFilters(normalized, filters, ["name", "address", "city", "category"]);
}

async function loadEvents(filters: ExportFilters): Promise<any[]> {
  const { db } = await import("./db");
  const { events } = await import("../shared/schema");
  const { desc, like, or, and, inArray } = await import("drizzle-orm");

  let q = db.select().from(events).$dynamic();
  const conds: any[] = [];
  if (filters.cities?.length)     conds.push(inArray(events.city, filters.cities as any));
  if (filters.categories?.length) conds.push(inArray(events.category, filters.categories));
  if (filters.statuses?.length)   conds.push(inArray(events.status, filters.statuses as any));
  if (filters.search) {
    conds.push(or(
      like(events.title, `%${filters.search}%`),
      like(events.location, `%${filters.search}%`),
      like(events.description, `%${filters.search}%`),
    ));
  }
  if (conds.length) q = q.where(and(...conds));
  const rows = await q.orderBy(desc(events.date));

  return rows.map((e: any) => ({
    ...e,
    mapLink: mapLink(e.latitude, e.longitude),
  }));
}

async function loadOutreachLeads(filters: ExportFilters): Promise<any[]> {
  const { db } = await import("./db");
  const { outreachLeads } = await import("../shared/schema");
  const { desc, like, or, and, inArray } = await import("drizzle-orm");

  let q = db.select().from(outreachLeads).$dynamic();
  const conds: any[] = [];
  if (filters.types?.length)    conds.push(inArray(outreachLeads.type, filters.types));
  if (filters.statuses?.length) conds.push(inArray(outreachLeads.status, filters.statuses));
  if (filters.cities?.length)   conds.push(inArray(outreachLeads.city, filters.cities as any));
  if (filters.search) {
    conds.push(or(
      like(outreachLeads.organization, `%${filters.search}%`),
      like(outreachLeads.name, `%${filters.search}%`),
      like(outreachLeads.city, `%${filters.search}%`),
      like(outreachLeads.email, `%${filters.search}%`),
    ));
  }
  if (conds.length) q = q.where(and(...conds));
  return await q.orderBy(desc(outreachLeads.createdAt));
}

async function loadGemeente(filters: ExportFilters): Promise<any[]> {
  const { db } = await import("./db");
  const { gemeenteOutreach } = await import("../shared/schema");
  const { desc, like, or, and, inArray } = await import("drizzle-orm");

  let q = db.select().from(gemeenteOutreach).$dynamic();
  const conds: any[] = [];
  if (filters.provinces?.length)      conds.push(inArray(gemeenteOutreach.province, filters.provinces as any));
  if (filters.statuses?.length)       conds.push(inArray(gemeenteOutreach.outreachStatus, filters.statuses));
  if (filters.cities?.length)         conds.push(inArray(gemeenteOutreach.city, filters.cities as any));
  if (filters.municipalities?.length) conds.push(inArray(gemeenteOutreach.municipalityName, filters.municipalities));
  if (filters.search) {
    conds.push(or(
      like(gemeenteOutreach.municipalityName, `%${filters.search}%`),
      like(gemeenteOutreach.city, `%${filters.search}%`),
      like(gemeenteOutreach.contactName, `%${filters.search}%`),
      like(gemeenteOutreach.department, `%${filters.search}%`),
    ));
  }
  if (conds.length) q = q.where(and(...conds));
  return await q.orderBy(desc(gemeenteOutreach.createdAt));
}

async function loadSpotlightedPlaces(filters: ExportFilters): Promise<any[]> {
  const { db } = await import("./db");
  const { spotlightedPlaces } = await import("../shared/schema");
  const { desc, like, or, and, inArray } = await import("drizzle-orm");

  let q = db.select().from(spotlightedPlaces).$dynamic();
  const conds: any[] = [];
  if (filters.categories?.length) conds.push(inArray(spotlightedPlaces.category, filters.categories));
  if (filters.search) {
    conds.push(or(
      like(spotlightedPlaces.name, `%${filters.search}%`),
      like(spotlightedPlaces.address, `%${filters.search}%`),
    ));
  }
  if (conds.length) q = q.where(and(...conds));
  const rows = await q.orderBy(desc(spotlightedPlaces.id));
  return rows.map((s: any) => ({ ...s, mapLink: mapLink(s.lat, s.lon) }));
}

function applyClientFilters(rows: any[], filters: ExportFilters, searchKeys: string[]): any[] {
  let out = rows;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    out = out.filter(r => searchKeys.some(k => String(r[k] || "").toLowerCase().includes(q)));
  }
  if (filters.categories?.length) {
    const set = new Set(filters.categories);
    out = out.filter(r => set.has(r.category));
  }
  if (filters.types?.length) {
    const set = new Set(filters.types);
    out = out.filter(r => set.has(r.type));
  }
  if (filters.cities?.length) {
    const set = new Set(filters.cities.map(c => c.toLowerCase()));
    out = out.filter(r => set.has(String(r.city || "").toLowerCase()));
  }
  if (filters.municipalities?.length) {
    const set = new Set(filters.municipalities.map(c => c.toLowerCase()));
    out = out.filter(r => set.has(String(r.municipality || "").toLowerCase()));
  }
  return out;
}

export async function loadSource(source: ExportSource, filters: ExportFilters): Promise<any[]> {
  switch (source) {
    case "locations":          return await loadLocations(filters);
    case "events":             return await loadEvents(filters);
    case "outreach_leads":     return await loadOutreachLeads(filters);
    case "gemeente":           return await loadGemeente(filters);
    case "spotlighted_places": return await loadSpotlightedPlaces(filters);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Per-format part renderers
// ────────────────────────────────────────────────────────────────────────────

function renderRow(row: any, columns: ColumnDef[]): any[] {
  return columns.map(col => {
    const v = row[col.key];
    if (col.format) return col.format(v, row);
    if (v == null) return "";
    if (Array.isArray(v)) return fmtArr(v);
    if (v instanceof Date) return fmtDateTime(v);
    return v;
  });
}

function buildCsvPart(rows: any[], columns: ColumnDef[]): Buffer {
  // OWASP CSV-injection defence: any cell whose first char is one of
  // = + - @ \t \r is interpreted by Excel/LibreOffice as a formula and many
  // antivirus scanners flag those cells as a macro-injection attempt.
  // Prefixing such cells with a single quote (`'`) neutralises both.
  const FORMULA_PREFIX = /^[=+\-@\t\r]/;
  const escape = (val: any): string => {
    let s = val == null ? "" : String(val);
    if (s.length && FORMULA_PREFIX.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(columns.map(c => escape(c.header)).join(","));
  for (const r of rows) {
    lines.push(renderRow(r, columns).map(escape).join(","));
  }
  // BOM for Excel UTF-8 detection
  return Buffer.from("\uFEFF" + lines.join("\r\n"), "utf-8");
}

// ────────────────────────────────────────────────────────────────────────────
// Styled XLSX renderer (ExcelJS)
//
// Why ExcelJS instead of SheetJS Community here:
//   1. Real visual quality — header banner, frozen panes, autofilter,
//      zebra rows, hyperlink cells, numeric formatting, colours.
//   2. ExcelJS emits a complete OOXML package (theme1.xml, styles.xml,
//      calcChain, etc.) that matches what Excel itself produces, so AV
//      heuristics treat it as a normal workbook instead of a
//      "machine-generated zip with bare sheet xml".
// ────────────────────────────────────────────────────────────────────────────

const BRAND_PRIMARY  = "FF4338CA"; // indigo-700  (ARGB; FF = opaque)
const BRAND_DARK     = "FF312E81"; // indigo-900
const BRAND_ACCENT   = "FFF59E0B"; // amber-500
const ROW_ZEBRA      = "FFF5F3FF"; // indigo-50

const NUMERIC_KEYS   = new Set(["lat", "lon", "latitude", "longitude"]);
const HYPERLINK_KEYS = new Set([
  "mapLink", "website", "linkedinUrl", "contactLinkedin",
  "externalTicketLink", "instagramUrl", "facebookUrl", "twitterUrl",
]);

function isHyperlinkKey(key: string): boolean {
  if (HYPERLINK_KEYS.has(key)) return true;
  return /(^|[A-Z])(Url|Link|Website|Linkedin|Instagram|Facebook|Twitter)$/i.test(key);
}

function hyperlinkLabel(key: string): string {
  if (key === "mapLink") return "Open in Google Maps ↗";
  if (key === "website") return "Visit website ↗";
  if (/linkedin/i.test(key)) return "LinkedIn profile ↗";
  if (/instagram/i.test(key)) return "Instagram ↗";
  if (/facebook/i.test(key)) return "Facebook ↗";
  if (/twitter/i.test(key)) return "Twitter / X ↗";
  if (/ticket/i.test(key)) return "Tickets ↗";
  return "Open link ↗";
}

async function buildXlsxPart(
  rows: any[],
  columns: ColumnDef[],
  source: ExportSource,
  partLabel: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // — Document metadata (reduces antivirus false positives) —
  wb.creator       = "Urban Culture Hub";
  wb.lastModifiedBy = "Urban Culture Hub Export Builder";
  wb.company       = "Urban Culture Hub";
  wb.title         = `Urban Culture Hub — ${SOURCE_LABELS[source]} Export`;
  wb.subject       = `${SOURCE_LABELS[source]} dataset export (${partLabel})`;
  wb.keywords      = `urban-culture-hub, ${source}, export, outreach-intelligence`;
  wb.category      = "Outreach Intelligence Export";
  wb.description   = "Generated by Urban Culture Hub. Tabular data only — no macros, no embedded code.";
  wb.created       = new Date();
  wb.modified      = new Date();

  // ── DATA SHEET ──────────────────────────────────────────────────────────
  const sheetName = SOURCE_LABELS[source].slice(0, 28).replace(/[\\/?*\[\]:]/g, "-");
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 3 }],   // freeze title + subtitle + header
    properties: { defaultRowHeight: 18 },
  });

  const lastColIndex = columns.length;

  // Row 1 — Title banner (merged across all columns)
  ws.mergeCells(1, 1, 1, lastColIndex);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `Urban Culture Hub  —  ${SOURCE_LABELS[source]}`;
  titleCell.font  = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_PRIMARY } };
  ws.getRow(1).height = 34;

  // Row 2 — Subtitle / metadata strip
  ws.mergeCells(2, 1, 2, lastColIndex);
  const subCell = ws.getCell(2, 1);
  subCell.value = `${rows.length.toLocaleString("en-US")} records  •  Part ${partLabel}  •  Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
  subCell.font  = { name: "Calibri", size: 10, italic: true, color: { argb: "FF4B5563" } };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  subCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ZEBRA } };
  ws.getRow(2).height = 20;

  // Row 3 — Column headers
  const headerRow = ws.getRow(3);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value     = col.header;
    cell.font      = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_DARK } };
    cell.border    = {
      top:    { style: "thin", color: { argb: BRAND_PRIMARY } },
      bottom: { style: "medium", color: { argb: BRAND_ACCENT } },
    };
  });
  headerRow.height = 26;

  // Auto-filter on the header row
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to:   { row: 3, column: lastColIndex },
  };

  // ── DATA ROWS ───────────────────────────────────────────────────────────
  const widthAccumulator: number[] = columns.map(c => Math.min(String(c.header).length + 4, 60));

  rows.forEach((r, rowIdx) => {
    const excelRow = ws.getRow(rowIdx + 4);
    const isZebra  = rowIdx % 2 === 1;

    columns.forEach((col, colIdx) => {
      const raw  = r[col.key];
      const cell = excelRow.getCell(colIdx + 1);

      // Hyperlink cells — friendly label, real URL underneath
      if (isHyperlinkKey(col.key) && raw && typeof raw === "string" && /^https?:\/\//i.test(raw)) {
        cell.value = { text: hyperlinkLabel(col.key), hyperlink: raw, tooltip: raw };
        cell.font  = { color: { argb: "FF1D4ED8" }, underline: true, name: "Calibri", size: 10 };
        widthAccumulator[colIdx] = Math.max(widthAccumulator[colIdx], hyperlinkLabel(col.key).length + 2);
      }
      // Numeric (lat/lon) — proper number type with 6-decimal format
      else if (NUMERIC_KEYS.has(col.key) && raw != null && raw !== "") {
        const n = typeof raw === "number" ? raw : parseFloat(raw);
        if (!isNaN(n)) {
          cell.value      = n;
          cell.numFmt     = "0.000000";
          cell.alignment  = { horizontal: "right" };
          cell.font       = { name: "Consolas", size: 10, color: { argb: "FF374151" } };
          widthAccumulator[colIdx] = Math.max(widthAccumulator[colIdx], 12);
        }
      }
      // Dates
      else if (raw instanceof Date) {
        cell.value     = raw;
        cell.numFmt    = "yyyy-mm-dd hh:mm";
        cell.alignment = { horizontal: "left" };
        widthAccumulator[colIdx] = Math.max(widthAccumulator[colIdx], 18);
      }
      // Everything else — pass through formatter
      else {
        const rendered = renderRow(r, [col])[0];
        const text = rendered == null ? "" : String(rendered);
        cell.value = text;
        if (!cell.font) cell.font = { name: "Calibri", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: text.length > 60 };
        widthAccumulator[colIdx] = Math.max(widthAccumulator[colIdx], Math.min(text.length + 2, 60));
      }

      // Zebra striping
      if (isZebra && !cell.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ZEBRA } };
      }
      // Subtle bottom border between rows
      cell.border = {
        ...(cell.border || {}),
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  // Apply final column widths
  columns.forEach((_col, i) => {
    ws.getColumn(i + 1).width = Math.min(Math.max(widthAccumulator[i], 10), 60);
  });

  // ── SUMMARY SHEET ───────────────────────────────────────────────────────
  const sws = wb.addWorksheet("About this export", {
    views: [{ showGridLines: false }],
  });

  sws.mergeCells(1, 1, 1, 2);
  const sTitle = sws.getCell(1, 1);
  sTitle.value = "About this export";
  sTitle.font  = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  sTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sTitle.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_PRIMARY } };
  sws.getRow(1).height = 34;

  const summary: Array<[string, string]> = [
    ["Source",         SOURCE_LABELS[source]],
    ["Records",        rows.length.toLocaleString("en-US")],
    ["Part",           partLabel],
    ["Generated",      new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })],
    ["Generator",      "Urban Culture Hub Export Builder"],
    ["Format",         "Microsoft Excel (.xlsx, OOXML)"],
    ["Contains macros", "No"],
    ["Contains code",  "No"],
    ["Notes",          "Each row is a record from the selected source. Hyperlink cells open in your default browser."],
  ];

  summary.forEach(([k, v], i) => {
    const r = sws.getRow(i + 3);
    r.getCell(1).value = k;
    r.getCell(1).font  = { bold: true, color: { argb: BRAND_DARK } };
    r.getCell(1).alignment = { vertical: "top", horizontal: "left", indent: 1 };
    r.getCell(2).value = v;
    r.getCell(2).font  = { color: { argb: "FF111827" } };
    r.getCell(2).alignment = { vertical: "top", horizontal: "left", indent: 1, wrapText: true };
    if (i % 2 === 1) {
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ZEBRA } };
      r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ZEBRA } };
    }
    r.height = 22;
  });

  sws.getColumn(1).width = 22;
  sws.getColumn(2).width = 80;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

async function buildPdfPart(
  rows: any[],
  columns: ColumnDef[],
  source: ExportSource,
  partLabel: string,
  totalRecords: number,
): Promise<Buffer> {
  return new Promise((resolve) => {
    // PDF document metadata. PDFs without an /Info dict are routinely flagged
    // by antivirus heuristics as "suspicious / unknown origin". Filling these
    // fields produces a properly-attributed PDF that scanners trust.
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape",
      info: {
        Title:        `Urban Culture Hub — ${SOURCE_LABELS[source]} (${partLabel})`,
        Author:       "Urban Culture Hub",
        Subject:      `${SOURCE_LABELS[source]} dataset export`,
        Keywords:     `urban-culture-hub, ${source}, export, outreach-intelligence`,
        Creator:      "Urban Culture Hub Export Builder",
        Producer:     "Urban Culture Hub Export Builder (PDFKit)",
        CreationDate: new Date(),
        ModDate:      new Date(),
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const BRAND = { primary: "#0d1220", accent: "#f97316", text: "#1f2937", muted: "#6b7280", soft: "#f3f4f6" };
    const pageW = doc.page.width - 80;

    // ── Cover ──
    doc.rect(0, 0, doc.page.width, 130).fill(BRAND.primary);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(24).text(SOURCE_LABELS[source], 40, 35);
    doc.font("Helvetica").fontSize(11).fillColor("#cbd5e1")
      .text("Urban Culture Hub — Outreach Intelligence Export", 40, 65);
    doc.fillColor(BRAND.accent).rect(40, 92, 50, 3).fill();
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(9)
      .text(`Records in this part: ${rows.length.toLocaleString()}`, 40, 102)
      .text(`Total in dataset: ${totalRecords.toLocaleString()}`, 220, 102)
      .text(`Part: ${partLabel}`, 400, 102)
      .text(`Generated: ${new Date().toLocaleString("nl-NL")}`, 520, 102);

    doc.moveTo(40, 145).lineTo(doc.page.width - 40, 145).strokeColor("#e5e7eb").stroke();

    // ── Records ──
    // Render each record as a compact card with the most important fields,
    // plus a "more" line for additional values.  Landscape A4 fits ~5–6 cards.
    const PRIMARY_FIELDS_BY_SOURCE: Record<ExportSource, string[]> = {
      locations:          ["category", "address", "city", "website", "phone", "openingHours", "mapLink"],
      events:             ["date", "category", "city", "location", "isPaid", "price", "externalTicketLink", "status"],
      outreach_leads:     ["organization", "role", "email", "phone", "city", "status", "score", "linkedinUrl"],
      gemeente:           ["province", "department", "departmentEmail", "contactName", "contactEmail", "outreachStatus", "priority", "aiScore"],
      spotlighted_places: ["category", "address", "website", "active", "isSuperFeatured"],
    };
    const primaryKeys = PRIMARY_FIELDS_BY_SOURCE[source];
    const colByKey = new Map(columns.map(c => [c.key, c]));

    let y = 160;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cardH = 92;
      if (y + cardH > doc.page.height - 50) {
        // Footer + new page
        doc.fontSize(8).fillColor(BRAND.muted)
          .text(`Urban Culture Hub — ${SOURCE_LABELS[source]} — Part ${partLabel}`, 40, doc.page.height - 30, { width: pageW, align: "center" });
        doc.addPage();
        y = 40;
      }

      // Card frame
      doc.roundedRect(40, y, pageW, cardH, 6).fillAndStroke(BRAND.soft, "#e5e7eb");

      // Title
      const title =
        row.name || row.title || row.organization || row.municipalityName || `Record #${row.id}`;
      doc.fillColor(BRAND.primary).font("Helvetica-Bold").fontSize(12).text(String(title), 52, y + 8, {
        width: pageW * 0.7, ellipsis: true,
      });
      // Right-side badge: status/score/etc
      const badge =
        row.status || row.outreachStatus || row.category || row.type || "";
      if (badge) {
        doc.fillColor(BRAND.accent).font("Helvetica-Bold").fontSize(9)
          .text(String(badge).toUpperCase(), doc.page.width - 200, y + 10, { width: 160, align: "right" });
      }

      // Two-column key/value rows for primary fields
      let lineY = y + 28;
      let col = 0;
      for (const key of primaryKeys) {
        const colDef = colByKey.get(key);
        if (!colDef) continue;
        const raw = row[key];
        const val = colDef.format ? colDef.format(raw, row) : (raw == null ? "" : String(raw));
        if (!val) continue;
        const xPos = col === 0 ? 52 : 52 + pageW / 2;
        doc.fillColor(BRAND.muted).font("Helvetica").fontSize(8.5)
          .text(`${colDef.header}:`, xPos, lineY, { width: 100, continued: true })
          .fillColor(BRAND.text).font("Helvetica-Bold")
          .text(` ${String(val).slice(0, 80)}`, { width: pageW / 2 - 110, ellipsis: true });
        if (col === 1) { lineY += 12; col = 0; } else { col = 1; }
        if (lineY > y + cardH - 8) break;
      }

      y += cardH + 6;
    }

    // Last page footer
    doc.fontSize(8).fillColor(BRAND.muted)
      .text(`Urban Culture Hub — ${SOURCE_LABELS[source]} — Part ${partLabel}`, 40, doc.page.height - 30, { width: pageW, align: "center" });

    doc.end();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Public API: build an export and stream it back over HTTP
// ────────────────────────────────────────────────────────────────────────────

export async function buildAndStreamExport(opts: BuildOptions, res: Response): Promise<void> {
  const { source, format, filters = {}, label } = opts;
  const partSize = opts.partSizeRows && opts.partSizeRows > 0
    ? opts.partSizeRows
    : DEFAULT_PART_SIZE[format];

  const columns = COLUMNS[source];
  if (!columns) throw new Error(`Unknown source: ${source}`);

  // Load all matching rows for this source. We deliberately do not paginate at
  // the loader level because we need accurate part counts up-front and the
  // worst-case dataset (~70k locations) fits comfortably in memory.
  const rows = await loadSource(source, filters);
  const total = rows.length;

  if (total === 0) {
    res.status(404).json({ message: "No records match the selected filters" });
    return;
  }

  const baseName = sanitizeForFilename(`${label || SOURCE_LABELS[source]}-${format}`);
  const partCount = Math.max(1, Math.ceil(total / partSize));

  // ── Single part: send the file directly ──
  // Important: ALL headers (including X-Export-* counts) must be set BEFORE
  // res.send() / writing the body — otherwise Node throws ERR_HTTP_HEADERS_SENT.
  if (partCount === 1) {
    const part = rows;
    let buf: Buffer;
    let contentType: string;
    let ext: string;

    if (format === "csv") {
      buf = buildCsvPart(part, columns);
      contentType = "text/csv; charset=utf-8";
      ext = "csv";
    } else if (format === "xlsx") {
      buf = await buildXlsxPart(part, columns, source, "1 of 1");
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = "xlsx";
    } else {
      buf = await buildPdfPart(part, columns, source, "1 of 1", total);
      contentType = "application/pdf";
      ext = "pdf";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${todayStr()}.${ext}"`);
    res.setHeader("X-Export-Total", String(total));
    res.setHeader("X-Export-Parts", "1");
    res.setHeader("Access-Control-Expose-Headers", "X-Export-Total, X-Export-Parts, Content-Disposition");
    res.send(buf);
    return;
  }

  // ── Multi-part: build a streaming ZIP ──
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${todayStr()}-${partCount}-parts.zip"`);
  res.setHeader("X-Export-Total", String(total));
  res.setHeader("X-Export-Parts", String(partCount));
  res.setHeader("Access-Control-Expose-Headers", "X-Export-Total, X-Export-Parts, Content-Disposition");

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("warning", (err: any) => { if (err.code !== "ENOENT") throw err; });
  archive.on("error", (err: any) => { try { res.destroy(err); } catch {} });
  archive.pipe(res);

  // README inside the archive
  const readme =
`Urban Culture Hub — Export
Source     : ${SOURCE_LABELS[source]}
Format     : ${format.toUpperCase()}
Records    : ${total.toLocaleString()}
Parts      : ${partCount} (≤ ${partSize.toLocaleString()} records per part)
Generated  : ${new Date().toLocaleString("nl-NL")}

This dataset was split across multiple files because it would otherwise be too
large for a single file. Open them individually or merge as needed. Each part
contains the same column structure, so concatenating CSVs is safe.
`;
  archive.append(readme, { name: "README.txt" });

  for (let i = 0; i < partCount; i++) {
    const start = i * partSize;
    const slice = rows.slice(start, start + partSize);
    const partLabel = `${i + 1} of ${partCount}`;
    const partIndex = String(i + 1).padStart(String(partCount).length, "0");
    const fname = `${baseName}-part-${partIndex}.${format}`;

    let buf: Buffer;
    if (format === "csv")        buf = buildCsvPart(slice, columns);
    else if (format === "xlsx")  buf = await buildXlsxPart(slice, columns, source, partLabel);
    else                          buf = await buildPdfPart(slice, columns, source, partLabel, total);

    archive.append(buf, { name: fname });
  }

  await archive.finalize();
}

// ────────────────────────────────────────────────────────────────────────────
// Lightweight preview: returns first N normalized rows + total for the UI
// ────────────────────────────────────────────────────────────────────────────

export async function previewSource(
  source: ExportSource,
  filters: ExportFilters,
  limit = 50,
): Promise<{ source: ExportSource; total: number; columns: { key: string; header: string }[]; rows: any[] }> {
  const rows = await loadSource(source, filters);
  const columns = COLUMNS[source].map(c => ({ key: c.key, header: c.header }));
  const sample = rows.slice(0, Math.max(1, limit));
  // Normalize values for JSON transport (Dates -> string, arrays kept)
  const normalized = sample.map(r => {
    const o: any = {};
    for (const c of COLUMNS[source]) {
      const v = r[c.key];
      o[c.key] = c.format ? c.format(v, r) : (v instanceof Date ? fmtDateTime(v) : v);
    }
    return o;
  });
  return { source, total: rows.length, columns, rows: normalized };
}
