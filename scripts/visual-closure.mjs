// The capture closure: every repo file the capture entry points load, read by syntax (TypeScript's parser, the
// root's devDependency, reads plain JavaScript too). Edges the walk follows:
//   - an import or export declaration, or `import x = require()`, naming a repo file;
//   - require() with a string, on `require`, `module.require` or a name bound to createRequire(import.meta.url);
//   - import() with a string;
//   - a child script started by a literal default path: spawn/fork/execFile of node (process.execPath or 'node')
//     with an argument list that is, or defaults to, an array of string paths ending in .js, .mjs or .cjs.
// Packages and builtins (any specifier that is not relative) stay outside; the lockfiles cover them.
// A load whose path is computed is listed, never followed: the tripwire refuses it unless it is in ALLOWED_COMPUTED.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');

export const ENTRIES = ['app/tests/visual-capture.mjs', 'app/tests/status-shots.mjs', 'app/tests/status-shots-isolated.mjs'];
// Computed loads that provably stay in a folder that is an input as a whole by inputs()' own rule. Each is matched
// by its file and its exact code; `into` is the folder its path cannot leave.
export const ALLOWED_COMPUTED = [];
const SCRIPT = /\.(?:m|c)?js$/;
const CHILD_CALLS = new Set(['spawn', 'spawnSync', 'fork', 'execFile', 'execFileSync']);

const literal = node => !!node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
const nameOf = callee => ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
const isImportMetaUrl = node => ts.isPropertyAccessExpression(node) && node.name.text === 'url'
  && ts.isMetaProperty(node.expression) && node.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
const isSelfBase = node => isImportMetaUrl(node) || (ts.isIdentifier(node) && node.text === '__filename');
const isCreateRequire = node => ts.isCallExpression(node) && nameOf(node.expression) === 'createRequire';
const isNode = node => (ts.isPropertyAccessExpression(node) && node.name.text === 'execPath' && ts.isIdentifier(node.expression) && node.expression.text === 'process')
  || (literal(node) && node.text === 'node');

// What one file loads: literal specifiers, child scripts (literal paths, unresolved), and computed loads.
export function loadsOf(source) {
  const sf = ts.createSourceFile('/read.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const code = node => node.getText(sf).replace(/\s+/g, ' ');
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const literals = new Set(), children = new Set(), computed = [];
  // Names bound to createRequire(...): true when the base is the file itself, false when it is computed.
  const requires = new Map([['require', true]]);
  const inits = new Map();
  const bind = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      inits.set(node.name.text, node.initializer);
      if (isCreateRequire(node.initializer)) requires.set(node.name.text, isSelfBase(node.initializer.arguments[0]));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left) && isCreateRequire(node.right))
      requires.set(node.left.text, isSelfBase(node.right.arguments[0]));
    ts.forEachChild(node, bind);
  };
  bind(sf);
  const load = (node, arg, selfBase = true) => {
    if (literal(arg) && selfBase) literals.add(arg.text);
    else if (literal(arg) && !arg.text.startsWith('.') && !arg.text.startsWith('/')) literals.add(arg.text);   // a package from any base
    else computed.push({ line: line(node), code: code(node) });
  };
  // String paths in an array, or in the arrays a name or a conditional defaults to.
  const arrays = (node, depth = 0) => {
    if (!node || depth > 3) return [];
    if (ts.isArrayLiteralExpression(node)) return node.elements.filter(literal).map(e => e.text);
    if (ts.isConditionalExpression(node)) return [...arrays(node.whenTrue, depth + 1), ...arrays(node.whenFalse, depth + 1)];
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind))
      return [...arrays(node.left, depth + 1), ...arrays(node.right, depth + 1)];
    if (ts.isIdentifier(node) && inits.has(node.text)) return arrays(inits.get(node.text), depth + 1);
    return [];
  };
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) load(node, node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) load(node, node.moduleReference.expression);
    else if (ts.isCallExpression(node)) {
      const callee = node.expression, name = nameOf(callee), arg = node.arguments[0];
      if (callee.kind === ts.SyntaxKind.ImportKeyword) load(node, arg);
      else if (ts.isIdentifier(callee) && requires.has(name)) load(node, arg, requires.get(name));
      else if (ts.isPropertyAccessExpression(callee) && name === 'require' && ts.isIdentifier(callee.expression) && callee.expression.text === 'module') load(node, arg);
      else if (isCreateRequire(callee)) load(node, arg, isSelfBase(callee.arguments[0]));
      else if (CHILD_CALLS.has(name)) {
        const script = name === 'fork' ? [arg] : isNode(arg) ? [node.arguments[1]] : [];
        for (const a of script) for (const s of (literal(a) ? [a.text] : arrays(a))) if (SCRIPT.test(s)) children.add(s);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { literals: [...literals].sort(), children: [...children].sort(), computed };
}

// A relative specifier against the loading file, by Node's file rules; a child script path against the file's
// folder and then each folder above it (a child's working folder is one of them). null when no repo file matches.
function resolveIn(tracked, dir, spec) {
  const base = path.posix.normalize(path.posix.join(dir, spec));
  for (const c of [base, base + '.js', base + '.mjs', base + '.cjs', base + '.json', base + '/index.js']) if (tracked.has(c)) return c;
  return null;
}
function resolveChild(tracked, file, spec) {
  for (let dir = path.posix.dirname(file); ; dir = path.posix.dirname(dir)) {
    const hit = resolveIn(tracked, dir === '.' ? '' : dir, spec);
    if (hit || dir === '.' || dir === '') return hit;
  }
}

// Walk from the entry points. `tracked` is the set of repo paths (forward slashes); `read` returns a file's text.
export function closure(tracked, read, entries = ENTRIES) {
  const files = new Set(), computed = [], unresolved = [], packages = new Set();
  const todo = [...entries];
  while (todo.length) {
    const file = todo.shift();
    if (files.has(file)) continue;
    files.add(file);
    if (!SCRIPT.test(file)) continue;
    const { literals, children, computed: c } = loadsOf(read(file));
    for (const x of c) {
      const ok = ALLOWED_COMPUTED.find(a => a.file === file && a.code === x.code);
      if (!ok) computed.push({ file, ...x });
    }
    for (const spec of literals) {
      if (!spec.startsWith('.') && !spec.startsWith('/')) { packages.add(spec); continue; }
      const hit = resolveIn(tracked, path.posix.dirname(file), spec);
      if (hit) todo.push(hit); else unresolved.push({ file, spec });
    }
    for (const spec of children) {
      const hit = resolveChild(tracked, file, spec);
      if (hit) todo.push(hit); else unresolved.push({ file, spec });
    }
  }
  return { files: [...files].sort(), computed, unresolved, packages: [...packages].sort() };
}

// Capture-starting scripts: a script directly in app/tests or scripts/, not a test, that launches Electron
// (`electron.launch(` or `_electron.launch(`) and names a capture output folder (docs/visual/runs or
// docs/images/status, as one string or as path.join parts), plus any script there that starts one of those by
// a literal default path. Read by syntax, so a comment names nothing.
export const OUTPUTS = /docs\/(?:visual\/runs|images\/status)(?:\/|$)/;
const STARTER_DIR = /^(?:app\/tests|scripts)\/[^/]+\.(?:m|c)?js$/;
export function startsCapture(source) {
  const sf = ts.createSourceFile('/read.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let launches = false, names = false;
  const visit = node => {
    if (literal(node) && OUTPUTS.test(node.text)) names = true;
    if (ts.isTemplateExpression(node) && OUTPUTS.test(node.head.text)) names = true;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const { expression: obj, name } = node.expression;
      if (name.text === 'launch' && ts.isIdentifier(obj) && /^_?electron$/.test(obj.text)) launches = true;
      if (name.text === 'join' || name.text === 'resolve') {
        const parts = node.arguments.filter(literal).map(a => a.text).join('/');
        if (OUTPUTS.test(parts)) names = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return launches && names;
}
export function captureStarters(names, read) {
  const tracked = new Set(names);
  const candidates = names.filter(p => STARTER_DIR.test(p) && !/\.test\./.test(p));
  const starters = new Set(candidates.filter(p => startsCapture(read(p))));
  for (const p of candidates) {
    if (starters.has(p)) continue;
    if (loadsOf(read(p)).children.some(s => starters.has(resolveChild(tracked, p, s)))) starters.add(p);
  }
  return [...starters].sort();
}

// The closure of a checkout at `root`, from its working tree.
export function closureAt(root, tracked, entries = ENTRIES) {
  return closure(tracked, p => fs.readFileSync(path.join(root, p), 'utf8'), entries);
}
