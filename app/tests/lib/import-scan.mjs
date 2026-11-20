// Whether a file loads Playwright, read by syntax: an import or export declaration, `import x = require()`,
// a dynamic import(), require(), module.require(), require.resolve() or import.meta.resolve(), a call on
// createRequire(...) directly or on a name bound to it, each with a string or plain template naming
// playwright, playwright-core or @playwright/test (or a path inside one). A name in a string, a template with
// parts, or a comment is not a load. TypeScript's parser (the root's devDependency) reads every file as
// TypeScript, which also takes plain JavaScript, and recovers from text that is not code at all.
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const PLAYWRIGHT_MODULE = /^(?:playwright|playwright-core|@playwright\/test)(?:\/.*)?$/;

const named = node => !!node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && PLAYWRIGHT_MODULE.test(node.text);
const isCreateRequire = node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createRequire';
const isImportMeta = node => ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta';

// The text form the scan used before it read syntax: the package name as a quoted module specifier.
const NAMES_PLAYWRIGHT = /(['"`])(?:playwright|playwright-core|@playwright\/test)(?:\/[^'"`\r\n]*)?\1/;

// A file too deeply nested for the parser (a minified bundle, a long one-line record) is judged by the text form,
// so a file that cannot be read by syntax is never let through.
export function loadsPlaywright(source) {
  if (!source.includes('playwright')) return false;
  try { return readsAsLoad(source); } catch (error) {
    if (error instanceof RangeError) return NAMES_PLAYWRIGHT.test(source);
    throw error;
  }
}

function readsAsLoad(source) {
  const file = ts.createSourceFile('scanned.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  // Names bound to createRequire(...) anywhere in the file, as `const req = createRequire(...)` or `req = createRequire(...)`.
  const requires = new Set(['require']);
  const bind = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isCreateRequire(node.initializer)) requires.add(node.name.text);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left) && isCreateRequire(node.right)) requires.add(node.left.text);
    ts.forEachChild(node, bind);
  };
  bind(file);
  const loader = callee => callee.kind === ts.SyntaxKind.ImportKeyword
    || (ts.isIdentifier(callee) && requires.has(callee.text))
    || isCreateRequire(callee)
    || (ts.isPropertyAccessExpression(callee) && callee.name.text === 'require')
    || (ts.isPropertyAccessExpression(callee) && callee.name.text === 'resolve'
      && ((ts.isIdentifier(callee.expression) && requires.has(callee.expression.text)) || isImportMeta(callee.expression)));
  let found = false;
  const visit = node => {
    if (found) return;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && named(node.moduleSpecifier)) found = true;
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && named(node.moduleReference.expression)) found = true;
    else if (ts.isCallExpression(node) && named(node.arguments[0]) && loader(node.expression)) found = true;
    else ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

// A file's free names (names it uses but neither declares nor imports: the globals), each with the uses it makes
// of them, and the modules it loads. TypeScript's binder resolves every name against the file's own declarations
// only (no library, no other file), so whatever does not resolve is free. A use is spelled by its form:
// `Name.member` (read or written), `Name[key]`, `new Name`, `Name()`, or, for any other form (an alias,
// destructuring, a spread, an argument), `Name in: <code>`. Loads are the specifiers of imports, exports,
// require-like calls and import(), a computed one as `<computed: code>`.
export function freeNamesOf(source) {
  const host = ts.createCompilerHost({});
  const sf = ts.createSourceFile('/read.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  host.getSourceFile = name => (name === '/read.mjs' ? sf : undefined);
  host.fileExists = name => name === '/read.mjs';
  host.readFile = () => undefined;
  const program = ts.createProgram(['/read.mjs'], { allowJs: true, noLib: true, noResolve: true, types: [], module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.Latest }, host);
  const checker = program.getTypeChecker();
  const text = node => node.getText(sf).replace(/\s+/g, ' ').slice(0, 80);
  // A name written only as a property or a key names no variable.
  const onlyAName = id => {
    const p = id.parent;
    return ((ts.isPropertyAccessExpression(p) || ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)
      || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) && p.name === id)
      || ((ts.isBindingElement(p) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) && p.propertyName === id)
      || ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p) || ts.isMetaProperty(p);
  };
  const useOf = id => {
    const p = id.parent;
    if (ts.isPropertyAccessExpression(p) && p.expression === id) return `${id.text}.${p.name.text}`;
    if (ts.isElementAccessExpression(p) && p.expression === id) return `${id.text}[${text(p.argumentExpression)}]`;
    if (ts.isNewExpression(p) && p.expression === id) return `new ${id.text}`;
    if (ts.isCallExpression(p) && p.expression === id) return `${id.text}()`;
    return `${id.text} in: ${text(p)}`;
  };
  const free = new Map(), loads = [];
  const spec = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : `<computed: ${node ? text(node) : 'none'}>`;
  const visit = node => {
    if (ts.isIdentifier(node) && !onlyAName(node) && !checker.getSymbolAtLocation(node)?.declarations?.length) {
      if (!free.has(node.text)) free.set(node.text, new Set());
      free.get(node.text).add(useOf(node));
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) loads.push(spec(node.moduleSpecifier));
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) loads.push(spec(node.moduleReference.expression));
    else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require') || isCreateRequire(callee)
        || (ts.isPropertyAccessExpression(callee) && (callee.name.text === 'require' || callee.name.text === 'resolve'))) loads.push(spec(node.arguments[0]));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { free: Object.fromEntries([...free].map(([name, uses]) => [name, [...uses].sort()]).sort(([a], [b]) => a.localeCompare(b))), loads: [...new Set(loads)].sort() };
}
