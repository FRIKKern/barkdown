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
