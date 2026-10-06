const fs = require('fs');
const path = require('path');
const ts = require('../client/node_modules/typescript');

const root = path.resolve(__dirname, '../client/src');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(dir, entry.name)] : []);
}
const tag = node => node.openingElement.tagName.getText();
const attr = (node, name) => node.openingElement.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText() === name);
const classes = node => attr(node, 'className')?.initializer?.getText() || '';
function insideOverlay(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent) && /\bfixed\b/.test(classes(parent)) && /\binset-0\b/.test(classes(parent))) return true;
  }
  return !!attr(node, 'aria-modal');
}
function contains(node, predicate) {
  let found = false;
  function visit(child) { if (predicate(child)) found = true; else if (!found) ts.forEachChild(child, visit); }
  visit(node);
  return found;
}
const hasTitle = node => contains(node, child => ts.isJsxElement(child) && /^h[123]$/.test(tag(child)));
const hasClose = node => contains(node, child => ts.isJsxSelfClosingElement(child) && /^(X|XCircle|ArrowLeft)$/.test(child.tagName.getText()));
const candidates = [];
for (const file of files(root)) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxElement(node) && /^(div|section|ModalPanel)$/.test(tag(node)) && (/\bmax-w-/.test(classes(node)) || attr(node, 'aria-modal')) && /\brounded/.test(classes(node)) && insideOverlay(node) && hasTitle(node)) {
      const children = node.children.filter(ts.isJsxElement);
      const header = children.find(child => hasTitle(child) && hasClose(child)) || children.find(hasTitle);
      const modern = tag(node) === 'ModalPanel' || (/flex-col/.test(classes(node)) && /overflow-hidden/.test(classes(node)));
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      candidates.push({ file: path.relative(root, file), line, modern, header: header ? tag(header) : null, first: header === children[0], className: classes(node), node, source });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (require.main === module) {
  const check = process.argv.includes('--check');
  for (const candidate of candidates.filter(candidate => !check || !candidate.modern)) console.log(`${candidate.modern ? 'FIXED' : 'SCROLL'} ${candidate.file}:${candidate.line} header=${candidate.header || 'custom'} first=${candidate.first}`);
  console.log(`${candidates.length} modal panels`);
  if (check && candidates.some(candidate => !candidate.modern)) process.exitCode = 1;
}
module.exports = { candidates, ts, tag, attr, classes, hasTitle, hasClose };
