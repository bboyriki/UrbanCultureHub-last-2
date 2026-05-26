/**
 * BTTS (Back to the Street) — Ticket email + PDF generation
 * A fully branded confirmation email with an attached PDF ticket.
 */
import PDFDocument from "pdfkit";
import path from "path";
import os from "os";
import fs from "fs";
import Mailgun from "mailgun.js";
import formData from "form-data";

const VERIFIED_SENDER_EMAIL = "riki@dancehealthy.net";
const ADMIN_EMAIL = "oudaialmouti@gmail.com";

const mailgun = new Mailgun(formData);
let mg: ReturnType<typeof mailgun.client> | null = null;
const mailgunKey = process.env.MAILGUN_SENDING_KEY || process.env.MAILGUN_API_KEY;
if (mailgunKey && process.env.MAILGUN_DOMAIN) {
  mg = mailgun.client({ username: "api", key: mailgunKey });
}

// ─── Brand colours ───────────────────────────────────────────────────────────
const C = {
  BLACK:       "#060609",
  DARK:        "#0d0d14",
  CARD:        "#111118",
  BORDER:      "#1e1e2a",
  ORANGE:      "#f97316",
  ORANGE_DARK: "#c2410c",
  RED:         "#ef4444",
  WHITE:       "#ffffff",
  GREY:        "#a1a1aa",
  LIGHT:       "#d4d4d8",
  GREEN:       "#22c55e",
  GOLD:        "#f59e0b",
};

// ─── Hex → RGB helper ─────────────────────────────────────────────────────────
function hexRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ─── PDF generation ───────────────────────────────────────────────────────────
export interface BttsTicketInfo {
  purchaseId:    number;
  holderName:    string;
  holderEmail?:  string;
  ticketName:    string;
  ticketType:    "spot" | "general" | "guest" | string;
  spotNumber?:   number | null;
  battleFormat?: string | null;
  amountPaid?:   string | number | null;
  eventTitle?:   string;
  eventYear?:    string;
  eventVenue?:   string;
  eventDate?:    string;
  qrCode:        string;   // base64 data URL
}

export async function generateBttsPdfTicket(info: BttsTicketInfo): Promise<Buffer> {
  const isSpot  = info.ticketType === "spot";
  const isGuest = info.ticketType === "guest";
  const accentColor = isSpot ? C.ORANGE : isGuest ? "#10b981" : "#3b82f6";
  const accentDark  = isSpot ? C.ORANGE_DARK : isGuest ? "#047857" : "#1d4ed8";

  return new Promise((resolve, reject) => {
    try {
      const tmpPath = path.join(os.tmpdir(), `btts-ticket-${info.purchaseId}-${Date.now()}.pdf`);

      const doc = new PDFDocument({
        size: [595, 842],   // A4
        margin: 0,
        bufferPages: true,
        info: {
          Title:   `BTTS Ticket — ${info.ticketName}`,
          Author:  "Urban Culture Hub",
          Subject: "Back to the Street — Ticket",
          Creator: "Urban Culture Hub Ticketing",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));

      const stream = fs.createWriteStream(tmpPath);
      doc.pipe(stream);

      const W = 595;
      const H = 842;

      // ── Full dark background ──────────────────────────────────────────────
      doc.rect(0, 0, W, H).fill(C.BLACK);

      // ── Top gradient band ─────────────────────────────────────────────────
      // Simulate gradient with layered rectangles fading from orange/red to transparent
      const bandH = 200;
      for (let i = 0; i < bandH; i++) {
        const alpha = Math.pow(1 - i / bandH, 2);
        const [or, og, ob] = hexRgb(C.ORANGE);
        const [dr, dg, db] = hexRgb(C.RED);
        const t = i / bandH;
        const r = Math.round(or + (dr - or) * t);
        const g = Math.round(og + (dg - og) * t);
        const b = Math.round(ob + (db - ob) * t);
        const hex = `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
        doc.rect(0, i, W, 1).fillOpacity(alpha * 0.4).fill(hex);
      }
      doc.fillOpacity(1);

      // ── Diagonal decorative lines (urban feel) ────────────────────────────
      doc.save();
      doc.strokeOpacity(0.06);
      for (let i = -100; i < W + 100; i += 30) {
        doc.moveTo(i, 0).lineTo(i + 200, H).strokeColor(C.ORANGE).lineWidth(1).stroke();
      }
      doc.restore();
      doc.strokeOpacity(1);

      // ── Card container ────────────────────────────────────────────────────
      const cx = 40;
      const cy = 40;
      const cw = W - 80;
      const ch = H - 80;
      doc.roundedRect(cx, cy, cw, ch, 12).fillOpacity(0.0).fill(C.DARK);
      // border
      doc.roundedRect(cx, cy, cw, ch, 12).strokeOpacity(0.35).strokeColor(accentColor).lineWidth(1.5).stroke();
      doc.fillOpacity(1).strokeOpacity(1);

      // ── Logo area ─────────────────────────────────────────────────────────
      // Flame icon made of circles
      const logoX = W / 2;
      const logoY = 90;
      doc.circle(logoX, logoY, 22).fillOpacity(0.15).fill(C.ORANGE);
      doc.circle(logoX, logoY, 22).strokeOpacity(0.4).strokeColor(C.ORANGE).lineWidth(1).stroke();
      doc.fillOpacity(1).strokeOpacity(1);

      // Flame shape (simple polygon approximation)
      doc
        .moveTo(logoX, logoY - 14)
        .bezierCurveTo(logoX + 10, logoY - 5, logoX + 8, logoY + 8, logoX, logoY + 10)
        .bezierCurveTo(logoX - 8, logoY + 8, logoX - 10, logoY - 5, logoX, logoY - 14)
        .fill(C.ORANGE);

      // Brand name
      doc.font("Helvetica-Bold").fontSize(13).fillColor(C.WHITE).fillOpacity(1)
        .text("URBAN CULTURE HUB", 0, logoY + 32, { align: "center", width: W });

      // Event name
      doc.font("Helvetica-Bold").fontSize(22).fillColor(C.ORANGE)
        .text("BACK TO THE STREET", 0, logoY + 52, { align: "center", width: W });

      // Year / edition tag
      const yearTag = [info.eventYear, info.eventTitle].filter(Boolean).join(" · ") || "2025";
      doc.font("Helvetica").fontSize(10).fillColor(C.GREY)
        .text(yearTag, 0, logoY + 78, { align: "center", width: W });

      // ── Horizontal divider ────────────────────────────────────────────────
      const divY1 = logoY + 100;
      doc.moveTo(cx + 20, divY1).lineTo(cx + cw - 20, divY1)
        .strokeColor(accentColor).strokeOpacity(0.3).lineWidth(0.8).stroke();
      doc.strokeOpacity(1);

      // ── Ticket type badge ─────────────────────────────────────────────────
      const badgeY = divY1 + 16;
      const badgeLabel = isSpot ? "🏆  BATTLE SPOT" : "🎟️  GUEST ENTRY";
      const badgeW = 160;
      const badgeH2 = 24;
      const badgeX = (W - badgeW) / 2;
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH2, 6)
        .fillOpacity(0.2).fill(accentColor);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH2, 6)
        .strokeOpacity(0.5).strokeColor(accentColor).lineWidth(1).stroke();
      doc.fillOpacity(1).strokeOpacity(1);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(accentColor)
        .text(badgeLabel, badgeX, badgeY + 6, { align: "center", width: badgeW });

      // ── Ticket name ───────────────────────────────────────────────────────
      doc.font("Helvetica-Bold").fontSize(16).fillColor(C.WHITE).fillOpacity(1)
        .text(info.ticketName, 0, badgeY + 36, { align: "center", width: W });

      // ── QR code ───────────────────────────────────────────────────────────
      const qrSize = 180;
      const qrX = (W - qrSize) / 2;
      const qrY = badgeY + 70;

      // White card behind QR
      doc.roundedRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 10)
        .fill(C.WHITE);

      try {
        const base64Data = info.qrCode.split(",")[1];
        if (base64Data) {
          const qrBuf = Buffer.from(base64Data, "base64");
          doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });
        }
      } catch (_) {
        doc.font("Helvetica").fontSize(10).fillColor(C.RED)
          .text("QR Code unavailable", qrX, qrY + 80, { width: qrSize, align: "center" });
      }

      doc.font("Helvetica").fontSize(9).fillColor(C.GREY)
        .text("Scan at the door · One use only", 0, qrY + qrSize + 18, { align: "center", width: W });

      // ── Divider with scissors icon ─────────────────────────────────────────
      const divY2 = qrY + qrSize + 38;
      const dashes = 30;
      const dashW = (cw - 60) / dashes;
      for (let i = 0; i < dashes; i++) {
        if (i % 2 === 0) {
          doc.moveTo(cx + 30 + i * dashW, divY2)
            .lineTo(cx + 30 + (i + 1) * dashW, divY2)
            .strokeColor(C.BORDER).strokeOpacity(1).lineWidth(1).stroke();
        }
      }

      // ── Details grid ──────────────────────────────────────────────────────
      const detY = divY2 + 18;
      const col1X = cx + 30;
      const col2X = W / 2 + 10;
      const rowH = 44;

      const details: Array<[string, string, number, number]> = [];

      details.push(["Ticket Holder", info.holderName || "—", col1X, detY]);
      details.push(["Ticket #", `${info.purchaseId}`, col2X, detY]);

      if (info.spotNumber) {
        details.push(["Spot Number", `#${info.spotNumber}`, col1X, detY + rowH]);
      }
      if (info.battleFormat) {
        details.push(["Format", info.battleFormat, info.spotNumber ? col2X : col1X, detY + rowH]);
      }

      if (info.eventVenue) {
        details.push(["Venue", info.eventVenue, col1X, detY + rowH * 2]);
      }
      if (info.eventDate) {
        details.push(["Date", info.eventDate, info.eventVenue ? col2X : col1X, detY + rowH * 2]);
      }

      const amtNum = info.amountPaid ? Number(info.amountPaid) : 0;
      const amtStr = amtNum > 0 ? `€${amtNum.toFixed(2)}` : "FREE";
      details.push(["Amount Paid", amtStr, col1X, detY + rowH * 3]);

      for (const [label, value, dx, dy] of details) {
        doc.font("Helvetica").fontSize(8).fillColor(C.GREY).fillOpacity(1)
          .text(label.toUpperCase(), dx, dy, { width: 200 });
        doc.font("Helvetica-Bold").fontSize(12).fillColor(C.WHITE)
          .text(value, dx, dy + 12, { width: 200 });
      }

      // ── Bottom accent bar ─────────────────────────────────────────────────
      const footerY = H - 80;
      doc.rect(cx, footerY, cw, 1).fillOpacity(0.2).fill(accentColor);
      doc.fillOpacity(1);

      // ── Footer ────────────────────────────────────────────────────────────
      doc.font("Helvetica").fontSize(8).fillColor(C.GREY).fillOpacity(0.6)
        .text("Urban Culture Hub · dancehealthy.net · Non-transferable · Keep this ticket safe", cx + 10, footerY + 12, { align: "center", width: cw - 20 });
      doc.font("Helvetica").fontSize(7).fillColor(C.GREY).fillOpacity(0.4)
        .text(`Generated ${new Date().toLocaleString("nl-NL")} · Purchase ID ${info.purchaseId}`, cx + 10, footerY + 28, { align: "center", width: cw - 20 });

      doc.fillOpacity(1);
      doc.end();

      doc.on("end", () => {
        const buf = Buffer.concat(chunks);
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
        resolve(buf);
      });
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ─── HTML email body ─────────────────────────────────────────────────────────
function buildBttsEmailHtml(info: BttsTicketInfo): string {
  const isSpot  = info.ticketType === "spot";
  const isGuest = info.ticketType === "guest";
  const accentHex = isSpot ? "#f97316" : isGuest ? "#10b981" : "#3b82f6";
  const badgeLabel = isSpot ? "🏆 Battle Spot" : isGuest ? "🟢 Guest Pass" : "🎟️ Entry Ticket";
  const amtNum = info.amountPaid ? Number(info.amountPaid) : 0;
  const amtStr = amtNum > 0 ? `€${amtNum.toFixed(2)}` : "FREE";
  const eventLine = [info.eventTitle, info.eventYear].filter(Boolean).join(" · ") || "Back to the Street";
  // Use a reliable QR code API URL for email (base64 data URLs are blocked by most email clients)
  const qrPayload = JSON.stringify({ type: "btts_ticket", purchaseId: info.purchaseId });
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrPayload)}&size=240x240&margin=2&format=png&color=000000&bgcolor=ffffff`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your BTTS Ticket</title>
</head>
<body style="margin:0;padding:0;background:#060609;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#060609;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

  <!-- Header gradient band -->
  <tr><td style="background:linear-gradient(135deg,#f97316 0%,#ef4444 50%,#1a0a00 100%);border-radius:16px 16px 0 0;padding:40px 32px 32px;text-align:center;">
    <!-- Flame icon -->
    <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.25);border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">🔥</div>
    <div style="color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">Urban Culture Hub</div>
    <div style="color:#ffffff;font-size:28px;font-weight:900;letter-spacing:1px;line-height:1.1;margin-bottom:6px;">BACK TO THE STREET</div>
    <div style="color:rgba(255,255,255,0.6);font-size:13px;">${eventLine}</div>
  </td></tr>

  <!-- Main card -->
  <tr><td style="background:#0d0d14;border-left:1px solid #1e1e2a;border-right:1px solid #1e1e2a;padding:0;">

    <!-- Badge strip -->
    <div style="background:${accentHex}22;border-top:3px solid ${accentHex};padding:14px 32px;text-align:center;">
      <span style="display:inline-block;background:${accentHex}33;border:1px solid ${accentHex}66;border-radius:999px;color:${accentHex};font-weight:700;font-size:12px;letter-spacing:2px;padding:6px 20px;text-transform:uppercase;">${badgeLabel}</span>
      <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:10px;">${info.ticketName}</div>
    </div>

    <!-- QR code section -->
    <div style="padding:36px 32px;text-align:center;border-bottom:1px solid #1e1e2a;background:#080810;">
      <div style="color:${accentHex};font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;">📲 SCAN AT ENTRY</div>
      <div style="display:inline-block;background:#ffffff;border-radius:20px;padding:20px;box-shadow:0 0 0 4px ${accentHex}44, 0 0 60px ${accentHex}33, 0 8px 32px rgba(0,0,0,0.6);">
        <img src="${qrSrc}" width="240" height="240" alt="Ticket QR Code" style="display:block;border-radius:4px;"/>
      </div>
      <div style="margin-top:16px;">
        <span style="display:inline-block;background:${accentHex}22;border:1px solid ${accentHex}55;border-radius:999px;color:${accentHex};font-size:11px;font-weight:700;letter-spacing:1.5px;padding:6px 18px;text-transform:uppercase;">Show this at the door</span>
      </div>
      <div style="color:#52525b;font-size:10px;margin-top:10px;letter-spacing:0.5px;">Ticket #${info.purchaseId} · Single use · Non-transferable</div>
    </div>

    <!-- Ticket details -->
    <div style="padding:28px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Ticket Holder</div>
            <div style="color:#ffffff;font-size:15px;font-weight:700;">${info.holderName || "—"}</div>
          </td>
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Ticket Number</div>
            <div style="color:#ffffff;font-size:15px;font-weight:700;">#${info.purchaseId}</div>
          </td>
        </tr>
        ${info.spotNumber ? `
        <tr>
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Battle Spot</div>
            <div style="color:${accentHex};font-size:15px;font-weight:700;">#${info.spotNumber}</div>
          </td>
          ${info.battleFormat ? `
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Format</div>
            <div style="color:#ffffff;font-size:15px;font-weight:700;">${info.battleFormat}</div>
          </td>` : "<td></td>"}
        </tr>` : ""}
        ${info.eventVenue ? `
        <tr>
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Venue</div>
            <div style="color:#ffffff;font-size:15px;font-weight:700;">${info.eventVenue}</div>
          </td>
          ${info.eventDate ? `
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Date</div>
            <div style="color:#ffffff;font-size:15px;font-weight:700;">${info.eventDate}</div>
          </td>` : "<td></td>"}
        </tr>` : ""}
        <tr>
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Amount Paid</div>
            <div style="color:${amtNum > 0 ? "#22c55e" : accentHex};font-size:15px;font-weight:700;">${amtStr}</div>
          </td>
          <td width="50%" style="padding-bottom:24px;vertical-align:top;">
            <div style="color:#71717a;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Status</div>
            <div style="color:#22c55e;font-size:15px;font-weight:700;">✓ Confirmed</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Instructions banner -->
    <div style="margin:0 32px 28px;background:#111118;border:1px solid #1e1e2a;border-radius:12px;padding:20px;">
      <div style="color:${accentHex};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">📋 What to do next</div>
      <div style="color:#a1a1aa;font-size:13px;line-height:1.7;">
        ${isSpot
          ? `1. You are registered as a <strong style="color:#ffffff;">battle competitor</strong> — check the schedule closer to the date.<br/>
             2. Arrive at least <strong style="color:#ffffff;">45 min before</strong> your battle time to warm up and check in.<br/>
             3. Show this QR code (email or in-app) at the <strong style="color:#ffffff;">competitor desk</strong>.`
          : `1. Download your PDF ticket (attached) or open the app ticket in the <strong style="color:#ffffff;">Urban Culture Hub</strong> app.<br/>
             2. Arrive at least <strong style="color:#ffffff;">30 min</strong> before doors open.<br/>
             3. Show this QR code at the <strong style="color:#ffffff;">entrance</strong> for scanning.`}
      </div>
    </div>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0a0a10;border:1px solid #1e1e2a;border-top:0;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
    <div style="color:#3f3f46;font-size:11px;line-height:1.7;">
      This ticket is personal and non-transferable.<br/>
      Urban Culture Hub · <a href="https://dancehealthy.net" style="color:#f97316;text-decoration:none;">dancehealthy.net</a> · riki@dancehealthy.net<br/>
      <span style="color:#27272a;">Purchase ID: ${info.purchaseId} · ${new Date().toLocaleString("nl-NL")}</span>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Main send function ───────────────────────────────────────────────────────
export async function sendBttsTicketEmail(info: BttsTicketInfo): Promise<boolean> {
  if (!mg) {
    console.warn("[BTTS email] Mailgun not configured — skipping ticket email.");
    return false;
  }
  if (!info.holderEmail) {
    console.warn(`[BTTS email] No email address for purchase #${info.purchaseId} — skipping.`);
    return false;
  }

  try {
    const pdfBuffer = await generateBttsPdfTicket(info);
    const html = buildBttsEmailHtml(info);

    const isSpot  = info.ticketType === "spot";
    const isGuest = info.ticketType === "guest";
    const subjectEmoji = isSpot ? "🔥" : isGuest ? "🟢" : "🎟️";
    const subject = `${subjectEmoji} Your BTTS Ticket — ${info.ticketName}`;

    const msgData: any = {
      from: `Urban Culture Hub <${VERIFIED_SENDER_EMAIL}>`,
      to: [info.holderEmail],
      subject,
      html,
      text: `Hi ${info.holderName},\n\nYour Back to the Street ticket is confirmed!\n\nTicket: ${info.ticketName}\nHolder: ${info.holderName}\nTicket #: ${info.purchaseId}${info.spotNumber ? `\nBattle Spot: #${info.spotNumber}` : ""}\n\nPresent the attached PDF or the QR code in the Urban Culture Hub app at the door.\n\nSee you at the event!\n— Urban Culture Hub`,
      attachment: [
        {
          data: pdfBuffer,
          filename: `BTTS-Ticket-${info.purchaseId}.pdf`,
          contentType: "application/pdf",
        },
      ],
    };

    await mg.messages.create(process.env.MAILGUN_DOMAIN!, msgData);
    console.log(`[BTTS email] ✅ Ticket email sent to ${info.holderEmail} (purchase #${info.purchaseId})`);

    // Admin copy (bcc-style) — no PDF for brevity
    if (info.holderEmail !== ADMIN_EMAIL) {
      try {
        const adminMsg: any = {
          from: `Urban Culture Hub <${VERIFIED_SENDER_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `[Admin] BTTS ticket confirmed — ${info.holderName} · #${info.purchaseId}`,
          html: `<div style="font-family:sans-serif;background:#0d0d14;color:#e4e4e7;padding:24px;border-radius:8px;">
<h2 style="color:#f97316;margin:0 0 16px;">New BTTS Ticket Confirmed</h2>
<p><strong>Holder:</strong> ${info.holderName} (${info.holderEmail ?? "—"})</p>
<p><strong>Ticket:</strong> ${info.ticketName} (${isSpot ? "Battle Spot" : isGuest ? "Guest Pass" : "Entry Ticket"})</p>
${info.spotNumber ? `<p><strong>Spot:</strong> #${info.spotNumber}${info.battleFormat ? ` · ${info.battleFormat}` : ""}</p>` : ""}
<p><strong>Purchase ID:</strong> #${info.purchaseId}</p>
<p><strong>Amount:</strong> ${info.amountPaid && Number(info.amountPaid) > 0 ? `€${Number(info.amountPaid).toFixed(2)}` : "FREE"}</p>
<p style="color:#71717a;font-size:12px;margin-top:20px;">Automated notification · Urban Culture Hub</p>
</div>`,
        };
        await mg.messages.create(process.env.MAILGUN_DOMAIN!, adminMsg);
      } catch (_) { /* admin email is best-effort */ }
    }

    return true;
  } catch (err) {
    console.error("[BTTS email] ❌ Failed to send ticket email:", err);
    return false;
  }
}
