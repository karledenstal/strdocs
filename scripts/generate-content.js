const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

function parseNote(text) {
  const opening = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(text);
  if (!opening) return { data: {}, content: text };

  const closing = /^---[ \t]*(?:\r?\n|$)/gm;
  closing.lastIndex = opening[0].length;
  const end = closing.exec(text);
  if (!end) throw new Error('missing closing ---');

  const document = YAML.parseDocument(text.slice(opening[0].length, end.index), { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join('; '));
  const data = document.toJS() ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('frontmatter must be a YAML mapping');
  }
  return { data, content: text.slice(end.index + end[0].length) };
}

function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(fullPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [fullPath] : [];
  });
}

function slugify(segment) {
  const slug = segment.normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new Error(`Cannot make an ID from path segment: ${segment}`);
  return slug;
}

function normalizeKeywords(value, source) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((keyword) => typeof keyword !== 'string' || !keyword.trim())) {
    throw new Error(`${source}: keywords must be a list of non-empty strings, for example keywords: [city, lore] (without quotes around the list)`);
  }
  return [...new Set(value.map((keyword) => keyword.trim().toLowerCase()))];
}

function generateContent(sourceDir, outputDir) {
  sourceDir = path.resolve(sourceDir);
  outputDir = path.resolve(outputDir);
  if (sourceDir === outputDir || sourceDir.startsWith(`${outputDir}${path.sep}`) || outputDir.startsWith(`${sourceDir}${path.sep}`)) {
    throw new Error('Source and output directories must not contain one another');
  }

  const entries = [];
  const pages = new Map();
  for (const file of markdownFiles(sourceDir)) {
    const relativePath = path.relative(sourceDir, file);
    let parsed;
    try {
      parsed = parseNote(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`${relativePath}: invalid frontmatter: ${error.message}`);
    }

    const metadata = parsed.data;
    if (metadata.public !== undefined && typeof metadata.public !== 'boolean') {
      throw new Error(`${relativePath}: public must be true or false, without quotes (for example public: true)`);
    }
    if (metadata.public !== true) continue;

    const stem = path.basename(relativePath, path.extname(relativePath));
    const segments = path.dirname(relativePath) === '.' ? [] : path.dirname(relativePath).split(path.sep);
    const id = [...segments, stem].map(slugify).join('/');
    if (pages.has(id)) throw new Error(`${relativePath}: ID ${id} already belongs to ${pages.get(id).source}`);

    const title = metadata.title === undefined ? stem : metadata.title;
    if (typeof title !== 'string' || !title.trim()) {
      throw new Error(`${relativePath}: title must be a non-empty string`);
    }
    const keywords = normalizeKeywords(metadata.keywords, relativePath);
    const entry = { id, title: title.trim(), keywords, path: `pages/${id}.json` };
    entries.push(entry);
    pages.set(id, { source: relativePath, page: { id, title: entry.title, keywords, body: parsed.content } });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
  for (const entry of entries) {
    const pagePath = path.join(outputDir, entry.path);
    fs.mkdirSync(path.dirname(pagePath), { recursive: true });
    fs.writeFileSync(pagePath, `${JSON.stringify(pages.get(entry.id).page, null, 2)}\n`);
  }
  return entries.length;
}

if (require.main === module) {
  try {
    const count = generateContent(path.join(__dirname, '..', 'docs'), path.join(__dirname, '..', 'dist'));
    console.log(`Generated ${count} public page(s) in dist/`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { generateContent };
