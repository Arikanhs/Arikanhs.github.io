// Privacy check, run before every commit: `npm run check:private`.
//
// Fails if the phone number from the private resume, or anything shaped like a
// street address, appears anywhere in the working tree: source, docs, tests,
// public/, dist/, and the text inside every PDF. The number is read from
// private/ at runtime and is never printed or written anywhere; hits are
// reported as file:line only.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractLinks, extractText, getDocumentProxy } from 'unpdf';

const ROOT = path.resolve(import.meta.dirname, '..');
const PRIVATE_DIR = path.join(ROOT, 'private');
const SKIP_DIRS = new Set(['node_modules', '.git', 'private']);
const SEPARATORS = String.raw`[\s().\-–—_/+]{0,3}`;

// Each sample is stored in parts so this file does not match its own patterns.
const ADDRESS_PATTERNS = [
  {
    name: 'street address',
    re: /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][A-Za-z]+\.?\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Parkway|Pkwy|Circle|Cir|Terrace|Ter|Highway|Hwy)\b/g,
    sample: ['56 N Sample', 'Ave'],
  },
  { name: 'apartment number', re: /\b(?:Apt|Apartment|Ste)\.?\s*#?\s*\d+\b/g, sample: ['Apt', '4'] },
  { name: 'Nevada ZIP code', re: /\b(?:NV|Nevada),?\s+89\d{3}\b/g, sample: ['Las Vegas, NV', '89154'] },
  { name: 'PO box', re: /\bP\.?\s?O\.?\s+Box\s+\d+/gi, sample: ['PO Box', '12'] },
];

async function pdfContent(file) {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(file)));
  const { text } = await extractText(pdf, { mergePages: true });
  const { links } = await extractLinks(pdf);
  return `${text}\n${links.flat().join('\n')}`;
}

/** Last 10 digits of every phone-like run (10-15 digits) in the text. */
function phoneNumbers(text) {
  const numbers = new Set();
  for (const match of text.matchAll(/\+?\(?\d[\d\s().\-–]{8,}\d/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) numbers.add(digits.slice(-10));
  }
  return numbers;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      yield path.join(dir, entry.name);
    }
  }
}

/** Proves the patterns fire, using in-memory samples only. */
function selfTest(numbers, phonePatterns) {
  const failures = [];
  for (const [i, n] of [...numbers].entries()) {
    const [a, b, c] = [n.slice(0, 3), n.slice(3, 6), n.slice(6)];
    const variants = [n, `+1${n}`, `+1 ${a} ${b} ${c}`, `(${a}) ${b}-${c}`, `${a}.${b}.${c}`, `tel:+1-${a}-${b}-${c}`];
    for (const v of variants) {
      phonePatterns[i].lastIndex = 0;
      if (!phonePatterns[i].test(`x ${v} x`)) failures.push(`phone variant #${variants.indexOf(v)}`);
    }
  }
  for (const { name, re, sample } of ADDRESS_PATTERNS) {
    re.lastIndex = 0;
    if (!re.test(sample.join(' '))) failures.push(name);
  }
  if (failures.length > 0) {
    console.error(`check:private: self-test failed (${failures.join(', ')}); not trusting the scan.`);
    process.exit(2);
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

async function main() {
  const resumes = (await readdir(PRIVATE_DIR).catch(() => [])).filter((f) => /\.pdf$/i.test(f));
  if (resumes.length === 0) {
    console.error('check:private: no PDF in private/, so the phone number cannot be checked.');
    process.exit(2);
  }

  const numbers = new Set();
  for (const file of resumes) {
    for (const n of phoneNumbers(await pdfContent(path.join(PRIVATE_DIR, file)))) numbers.add(n);
  }
  if (numbers.size === 0) {
    console.error('check:private: found no phone number in the private resume; check the parser.');
    process.exit(2);
  }
  const phonePatterns = [...numbers].map((n) => new RegExp(n.split('').join(SEPARATORS), 'g'));
  selfTest(numbers, phonePatterns);

  const hits = [];
  let scanned = 0;
  for await (const file of walk(ROOT)) {
    const buffer = await readFile(file);
    let text;
    if (file.toLowerCase().endsWith('.pdf')) {
      text = await pdfContent(file);
    } else if (buffer.subarray(0, 8000).includes(0)) {
      continue; // binary (images, fonts)
    } else {
      text = buffer.toString('utf8');
    }
    scanned += 1;
    const rel = path.relative(ROOT, file);
    for (const re of phonePatterns) {
      for (const m of text.matchAll(re)) hits.push(`${rel}:${lineOf(text, m.index)}  phone number`);
    }
    for (const { name, re } of ADDRESS_PATTERNS) {
      for (const m of text.matchAll(re)) hits.push(`${rel}:${lineOf(text, m.index)}  ${name}`);
    }
  }

  if (hits.length > 0) {
    console.error(`check:private: ${hits.length} hit(s). Remove them before committing:`);
    for (const hit of hits) console.error(`  ${hit}`);
    process.exit(1);
  }
  console.log(
    `check:private: OK. Scanned ${scanned} files for ${numbers.size} phone number(s) and address patterns; no hits.`,
  );
}

await main();
