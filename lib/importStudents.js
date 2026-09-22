const ExcelJS = require('exceljs');

const HEADER_ALIASES = {
  name: ['name', 'student name', 'student'],
  roll_no: ['roll_no', 'roll no', 'roll number', 'roll', 'rollno'],
  phone: ['phone', 'student phone', 'mobile', 'student mobile'],
  parent_name: ['parent_name', 'parent name', 'guardian name'],
  parent_phone: ['parent_phone', 'parent phone', 'guardian phone', 'guardian mobile'],
  parent_contact: ['parent_contact', 'parent contact', 'parent email', 'email']
};

function matchHeader(headerCell) {
  const h = String(headerCell || '').trim().toLowerCase();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

function rowsFromGrid(grid) {
  if (!grid.length) return [];
  const headerMap = {}; // column index -> field name
  grid[0].forEach((cell, i) => {
    const field = matchHeader(cell);
    if (field) headerMap[i] = field;
  });
  if (!Object.values(headerMap).includes('name') || !Object.values(headerMap).includes('roll_no')) {
    throw new Error('Could not find "name" and "roll_no" columns. Check the header row.');
  }

  const rows = [];
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!raw || raw.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const row = { name: '', roll_no: '', phone: '', parent_name: '', parent_phone: '', parent_contact: '' };
    Object.entries(headerMap).forEach(([idx, field]) => {
      row[field] = String(raw[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  // Minimal CSV split — handles simple comma-separated values and quoted fields.
  const splitLine = (line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  };
  const grid = lines.map(splitLine);
  return rowsFromGrid(grid);
}

async function parseXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The spreadsheet has no sheets.');
  const grid = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    grid.push(row.values.slice(1)); // exceljs values are 1-indexed with a leading empty slot
  });
  return rowsFromGrid(grid);
}

async function parseStudentFile(buffer, filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.csv')) return parseCsvBuffer(buffer);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseXlsxBuffer(buffer);
  throw new Error('Please upload a .csv or .xlsx file.');
}

module.exports = { parseStudentFile };
