// Where a script's --user-data= profiles come from, read by syntax and scope (TypeScript's parser and binder, the
// root's devDependency). tests/launch-profile.test.mjs uses it to prove each profile is made by fixtureFolder().
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
export { ts };

// One script, parsed and bound on its own: names resolve to their declarations in this file, imports to their specifier.
export function parseScript(source, name = 'script.js') {
  const file = name.replace(/\.(?:mjs|cjs)$/, '.js');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const host = {
    getSourceFile: n => (n === file ? sf : undefined), getDefaultLibFileName: () => 'lib.d.ts', writeFile() {}, getCurrentDirectory: () => '/',
    getCanonicalFileName: f => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n', fileExists: n => n === file, readFile: () => undefined,
  };
  const program = ts.createProgram([file], { allowJs: true, noResolve: true, noLib: true, types: [] }, host);
  const checker = program.getTypeChecker(), all = [];
  const walk = n => { all.push(n); ts.forEachChild(n, walk); };
  walk(sf);
  const line = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const symbolOf = n => checker.getSymbolAtLocation(n);
  // The name a script imports `what` under from a module whose specifier matches `from`, by symbol.
  const importsOf = (from, what) => new Set(all.filter(n => ts.isImportSpecifier(n) && (n.propertyName ?? n.name).text === what
    && from.test(n.parent.parent.parent.moduleSpecifier.text)).map(n => symbolOf(n.name)).filter(Boolean));
  return { sf, checker, all, line, symbolOf, importsOf };
}

const strip = n => { while (ts.isParenthesizedExpression(n) || ts.isAwaitExpression(n)) n = n.expression; return n; };
const isCall = (n, object, method) => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === method
  && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === object;
const isTmpdir = n => { n = strip(n); return (isCall(n, 'os', 'tmpdir') && !n.arguments.length) || (isCall(n, 'fs', 'realpathSync') && n.arguments.length === 1 && isTmpdir(n.arguments[0])); };
const isPlaceholder = n => n.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(n) && n.text === 'undefined');

// The --user-data= values in a script: the expression after the flag in a template or a `'--user-data=' + x`,
// and any other literal holding the flag (a profile with no value to trace).
export function profileValues(script) {
  const values = [], literals = [];
  for (const n of script.all) {
    if (ts.isTemplateExpression(n)) n.templateSpans.forEach((span, i) => { if ((i ? n.templateSpans[i - 1].literal : n.head).text.endsWith('--user-data=')) values.push({ value: span.expression, at: n }); });
    else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && ts.isStringLiteralLike(n.left) && n.left.text.endsWith('--user-data=')) values.push({ value: n.right, at: n });
    else if (ts.isStringLiteralLike(n) && n.text.includes('--user-data=') && !(ts.isBinaryExpression(n.parent) && n.parent.left === n && n.text.endsWith('--user-data='))) literals.push(n);
  }
  return { values, literals };
}

// Every place the value can come from, as leaves: { kind: 'fixture' | 'temp' | 'other', node, why }.
// A name follows each declaration and assignment of that binding; a parameter, each named call's argument (or its
// default); a call of a local function, each of its returns; path.join/resolve and fs.realpathSync, their first argument.
export function profileSources(script, value, folders) {
  const { all, symbolOf } = script, leaves = [];
  const fnOf = fn => (ts.isFunctionDeclaration(fn) ? fn.name : ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) ? fn.parent.name : undefined);
  const callsOf = name => { const sym = symbolOf(name); return sym ? all.filter(c => ts.isCallExpression(c) && ts.isIdentifier(c.expression) && symbolOf(c.expression) === sym) : []; };
  const returnsOf = fn => {
    if (!ts.isBlock(fn.body)) return [fn.body];
    const out = [];
    const visit = n => { if (n !== fn.body && ts.isFunctionLike(n)) return; if (ts.isReturnStatement(n) && n.expression) out.push(n.expression); ts.forEachChild(n, visit); };
    visit(fn.body);
    return out;
  };
  const trace = (n, seen) => {
    n = strip(n);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && folders.has(symbolOf(n.expression))) return leaves.push({ kind: 'fixture', node: n });
    if (isCall(n, 'fs', 'mkdtempSync') && n.arguments.length === 1) {
      const arg = strip(n.arguments[0]);
      if (isCall(arg, 'path', 'join') && arg.arguments.length === 2 && isTmpdir(arg.arguments[0])) return leaves.push({ kind: 'temp', node: n, prefix: arg.arguments[1] });
      return leaves.push({ kind: 'other', node: n, why: 'a mkdtempSync not of the temp folder' });
    }
    if ((isCall(n, 'path', 'join') || isCall(n, 'path', 'resolve') || isCall(n, 'fs', 'realpathSync')) && n.arguments.length) return trace(n.arguments[0], seen);
    if (ts.isConditionalExpression(n)) { trace(n.whenTrue, seen); trace(n.whenFalse, seen); return; }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const decl = symbolOf(n.expression)?.declarations?.[0];
      const fn = decl && (ts.isFunctionDeclaration(decl) ? decl : ts.isVariableDeclaration(decl) && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) ? decl.initializer : null);
      if (!fn || seen.has(fn)) return leaves.push({ kind: 'other', node: n, why: 'a call of no local function' });
      const returns = returnsOf(fn);
      if (!returns.length) return leaves.push({ kind: 'other', node: n, why: 'a local function that returns nothing' });
      for (const r of returns) trace(r, new Set([...seen, fn]));
      return;
    }
    if (!ts.isIdentifier(n)) return leaves.push({ kind: 'other', node: n, why: 'a profile made some other way' });
    const sym = symbolOf(n);
    if (!sym?.declarations?.length) return leaves.push({ kind: 'other', node: n, why: `${n.text} has no declaration in this file` });
    if (seen.has(sym)) return;
    const next = new Set([...seen, sym]); let bound = 0;
    for (const decl of sym.declarations) {
      if (ts.isVariableDeclaration(decl)) { if (decl.initializer && !isPlaceholder(decl.initializer)) { bound++; trace(decl.initializer, next); } }
      else if (ts.isParameter(decl)) {
        bound++;
        const fn = decl.parent, at = fn.parameters.indexOf(decl), name = fnOf(fn), calls = name ? callsOf(name) : [];
        if (!calls.length) leaves.push({ kind: 'other', node: decl, why: `${n.text} is a parameter of a function with no named call` });
        for (const c of calls) { const arg = c.arguments[at] ?? decl.initializer; if (arg && !c.arguments.slice(0, at + 1).some(ts.isSpreadElement)) trace(arg, next); else leaves.push({ kind: 'other', node: c, why: `a call passing no ${n.text}` }); }
      } else { bound++; leaves.push({ kind: 'other', node: decl, why: `${n.text} is not a variable or parameter` }); }
    }
    for (const id of all) if (ts.isIdentifier(id) && ts.isBinaryExpression(id.parent) && id.parent.left === id && id.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && symbolOf(id) === sym) { bound++; trace(id.parent.right, next); }
    if (!bound) leaves.push({ kind: 'other', node: n, why: `${n.text} is never given a value` });
  };
  trace(value, new Set());
  return leaves;
}
