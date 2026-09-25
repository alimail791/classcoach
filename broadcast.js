// Sends a marketing email to a list of leads imported from a CSV file.
//
// Usage:
//   node broadcast.js leads.csv     — imports the CSV, then sends
//   node broadcast.js               — no CSV given, just sends to
//                                      whatever's already pending
//
// Safe to re-run: already-sent and unsubscribed leads are always skipped,
// and importing the same CSV twice won't create duplicates (matched by
// email address).
//
// Respects Resend's hard rate limit (2 requests/second, every plan) with
// a safety margin, and stops after MAX_SENDS_PER_RUN emails (default 90,
// comfortably under the free plan's 100/day cap) so this can just be run
// once a day via Task Scheduler / cron and naturally pace itself across
// however many days it takes to reach everyone — rerun it daily and it
// picks up exactly where it left off.

const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const { signUnsubscribeToken } = require('./lib/unsubscribe');

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS || '';
const FROM_ADDRESS = process.env.SMTP_FROM || process.env.RESEND_FROM || 'ClassCoach <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://www.classcoach.in';
const MAX_SENDS_PER_RUN = parseInt(process.env.MAX_SENDS_PER_RUN, 10) || 90;
const DELAY_MS = 600; // keeps us safely under Resend's 2 req/sec limit

const SUBJECT = 'Cut your grading time in half — free ClassCoach trial';

function emailBody(name) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `${greeting}

If you're spending hours writing tests and grading papers by hand, ClassCoach might save you real time.

Paste your syllabus or upload a PDF, and it drafts exam-ready questions in minutes. Objective answers grade themselves the second a student submits — no more marking MCQs by hand. And for every student, you'll see exactly which chapter they're struggling with, not just their overall score.

Parents get updates automatically — a link, an email, or their own login — so "how is my child doing" stops being a weekly phone call.

Free for your first month, no card needed:
${APP_URL}

— Team ClassCoach

---
You're receiving this because you're a teacher or coaching centre we thought this might help.
Don't want these emails? Unsubscribe here: UNSUBSCRIBE_URL_PLACEHOLDER`;
}

// --- CSV import (only runs if a file path was given) ---

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const splitLine = (line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  };
  const grid = lines.map(splitLine);
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const emailCol = header.findIndex((h) => h === 'email' || h.includes('email'));
  const nameCol = header.findIndex((h) => h === 'name' || h.includes('name'));
  if (emailCol === -1) throw new Error('Could not find an "email" column in the CSV header.');

  return grid.slice(1).map((row) => ({
    email: (row[emailCol] || '').trim().toLowerCase(),
    name: nameCol !== -1 ? (row[nameCol] || '').trim() : ''
  }));
}

function importLeads(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text).filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));

  const insert = db.prepare('INSERT INTO email_leads (email, name) VALUES (?, ?) ON CONFLICT(email) DO NOTHING');
  let imported = 0;
  rows.forEach((r) => {
    const info = insert.run(r.email, r.name);
    if (info.changes > 0) imported += 1;
  });
  console.log(`Imported ${imported} new lead(s) from ${csvPath} (${rows.length - imported} were already in the list).`);
}

// --- Sending ---

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendOne(lead) {
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(lead.email)}&token=${signUnsubscribeToken(lead.email)}`;
  const text = emailBody(lead.name).replace('UNSUBSCRIBE_URL_PLACEHOLDER', unsubscribeUrl);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [lead.email], subject: SUBJECT, text })
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch (e) {
      // keep the generic message
    }
    throw new Error(message);
  }
}

async function sendPending() {
  if (!RESEND_API_KEY) {
    console.error('No RESEND_API_KEY (or SMTP_PASS) found in .env — nothing to send with.');
    process.exit(1);
  }

  const pending = db.prepare("SELECT * FROM email_leads WHERE status = 'pending' LIMIT ?").all(MAX_SENDS_PER_RUN);
  if (pending.length === 0) {
    const remaining = db.prepare("SELECT COUNT(*) c FROM email_leads WHERE status = 'pending'").get().c;
    console.log(remaining === 0 ? 'No pending leads — everyone has been sent to or unsubscribed.' : 'Nothing to send (unexpected).');
    return;
  }

  console.log(`Sending to ${pending.length} lead(s) this run (cap: ${MAX_SENDS_PER_RUN}/run)...\n`);
  let sent = 0;
  let failed = 0;

  for (const lead of pending) {
    try {
      await sendOne(lead);
      db.prepare("UPDATE email_leads SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(lead.id);
      sent += 1;
      console.log(`  ✓ ${lead.email}`);
    } catch (err) {
      db.prepare("UPDATE email_leads SET status = 'failed' WHERE id = ?").run(lead.id);
      failed += 1;
      console.log(`  ✗ ${lead.email} — ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  const totals = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) AS unsubscribed
       FROM email_leads`
    )
    .get();

  console.log(`\nThis run: ${sent} sent, ${failed} failed.`);
  console.log(`Overall: ${totals.pending} pending, ${totals.sent} sent, ${totals.failed} failed, ${totals.unsubscribed} unsubscribed.`);
  if (totals.pending > 0) {
    console.log(`\n${totals.pending} lead(s) still pending — run this script again (tomorrow, if you're on Resend's free daily cap) to continue.`);
  }
}

async function main() {
  const csvPath = process.argv[2];
  if (csvPath) {
    if (!fs.existsSync(csvPath)) {
      console.error(`File not found: ${csvPath}`);
      process.exit(1);
    }
    importLeads(path.resolve(csvPath));
  }
  await sendPending();
}

main();
