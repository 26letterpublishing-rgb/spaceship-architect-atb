const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {resolvePublicAsset} = require('../public-assets');
const root = path.resolve(__dirname, '..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'starship-help-content.js'), 'utf8'), context);
const content = context.window.SAStarshipHelpContent;

test('both campaign roles and the creator can load the shared guide through public assets', () => {
  for (const file of ['starship-help-content.js','starship-guide.js','starship-guide.css']) {
    assert.equal(resolvePublicAsset(root, '/' + file), path.join(root, file));
    for (const page of ['gm.html','character.html','starship.html']) {
      assert.ok(fs.readFileSync(path.join(root, page), 'utf8').includes(file), `${page} missing ${file}`);
    }
  }
});

test('every instructional image and section destination resolves to an existing public asset', () => {
  assert.equal(new Set(content.sections.map(item => item.id)).size, content.sections.length);
  for (const key of [...content.gmPages.map(page => page[2]), ...content.sections.flatMap(item => item.shots)]) {
    const shot = content.shots[key];
    assert.ok(shot, `Missing image definition: ${key}`);
    const file = resolvePublicAsset(root, '/' + shot.file);
    assert.ok(file && fs.existsSync(file), `Missing public image: ${key}`);
    for (const [,x,y,tx,ty] of shot.marks || []) {
      assert.ok(x>=0 && x<=shot.w && tx>=0 && tx<=shot.w && y>=0 && y<=shot.h && ty>=0 && ty<=shot.h, `Callout outside ${key}`);
    }
  }
  for (const item of content.sections) for (const [,src] of item.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    assert.ok(fs.existsSync(resolvePublicAsset(root, '/' + src)), `Missing illustration: ${src}`);
  }
});

test('guide content loads before its renderer and campaign Help', () => {
  for (const page of ['gm.html','character.html','starship.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const data = html.indexOf('src="starship-help-content.js"'), guide = html.indexOf('src="starship-guide.js"');
    assert.ok(data >= 0 && guide > data, `${page}: guide load order`);
    const help = html.indexOf('src="app-help.js"');
    if (help >= 0) assert.ok(help > guide, `${page}: Help load order`);
  }
});
