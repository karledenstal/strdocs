const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { generateContent } = require('../scripts/generate-content');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starlight-content-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const docs = path.join(root, 'docs');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(docs);
  return {
    docs,
    dist,
    note(name, content) {
      const filename = path.join(docs, name);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, content);
    },
    json(name) {
      return JSON.parse(fs.readFileSync(path.join(dist, name), 'utf8'));
    },
  };
}

test('publishes explicit public notes with normalized keywords and unchanged Markdown', (t) => {
  const site = fixture(t);
  site.note('New Bergen/Districts.md', '---\ntitle: New Bergen Districts\npublic: true\nkeywords: [City, lore, city]\n---\n# Districts\n\n---\n\nBody.\n');
  site.note('Draft.md', '---\npublic: false\n---\nSecret');
  site.note('Unmarked.md', 'No frontmatter\n---\nStill body');

  assert.equal(generateContent(site.docs, site.dist), 1);
  assert.deepEqual(site.json('index.json'), [{
    id: 'new-bergen/districts', title: 'New Bergen Districts',
    keywords: ['city', 'lore'], path: 'pages/new-bergen/districts.json',
  }]);
  assert.deepEqual(site.json('pages/new-bergen/districts.json'), {
    id: 'new-bergen/districts', title: 'New Bergen Districts',
    keywords: ['city', 'lore'], body: '# Districts\n\n---\n\nBody.\n',
  });
  assert.equal(fs.existsSync(path.join(site.dist, 'pages/draft.json')), false);
});

test('uses filename as title and removes pages no longer public', (t) => {
  const site = fixture(t);
  site.note('Premise.md', '---\npublic: true\n---\nHello');
  generateContent(site.docs, site.dist);
  assert.equal(site.json('pages/premise.json').title, 'Premise');
  assert.deepEqual(site.json('pages/premise.json').keywords, []);

  site.note('Premise.md', '---\npublic: false\n---\nHello');
  generateContent(site.docs, site.dist);
  assert.deepEqual(site.json('index.json'), []);
  assert.equal(fs.existsSync(path.join(site.dist, 'pages/premise.json')), false);
});

test('rejects malformed frontmatter and invalid public or keywords fields', (t) => {
  const site = fixture(t);
  site.note('Bad.md', '---\npublic: true\n');
  assert.throws(() => generateContent(site.docs, site.dist), /Bad\.md: invalid frontmatter: missing closing/);
  site.note('Bad.md', '---\npublic: "true"\n---\nBody');
  assert.throws(() => generateContent(site.docs, site.dist), /public must be true or false/);
  site.note('Bad.md', '---\npublic: true\nkeywords: city\n---\nBody');
  assert.throws(() => generateContent(site.docs, site.dist), /keywords must be a list/);
});

test('rejects IDs that collide after slugging paths', (t) => {
  const site = fixture(t);
  site.note('New Bergen.md', '---\npublic: true\n---\nFirst');
  site.note('new-bergen.md', '---\npublic: true\n---\nSecond');
  assert.throws(() => generateContent(site.docs, site.dist), /ID new-bergen already belongs to/);
});
