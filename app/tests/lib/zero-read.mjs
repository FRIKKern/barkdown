// The read behind "screenshots checked: 0". Such a script may take pictures only through failureShot
// (tests/lib/failure-shot.mjs), which always ends the run as failed, called by that name as imported from that
// file. The read goes by names, not by paths through the code, and fails closed: a direct picture call, the helper
// under another name or from another file, a function of its own with the helper's name, or any name that can
// reach the process (process, global, globalThis, eval, Function, a constructor, a module loaded by a computed
// name or a URL) is named by line.
import path from 'node:path';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const HELPER = 'tests/lib/failure-shot.mjs', NAME = 'failureShot';
const REACH = new Set(['process', 'global', 'globalThis', 'eval', 'Function']);
const WORDS = new Set(['screenshot', 'constructor', 'process', 'node:process']);

// A name that is only a property's name (a.process(), { exitCode: 1 }), not a name in scope.
const memberName = node => {
  const p = node.parent;
  return Boolean(p && p.name === node && (ts.isPropertyAccessExpression(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)
    || ts.isMethodDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)));
};
const declares = node => {
  const p = node.parent;
  return Boolean(p && p.name === node && (ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)
    || ts.isClassDeclaration(p) || ts.isClassExpression(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isMethodDeclaration(p)));
};
const literal = node => Boolean(node && ts.isStringLiteralLike(node));

export function zeroProblem(source, name = 'tests/script.mjs') {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const found = [], say = (text, node) => found.push(`${text} (line ${line(node)})`);
  const target = spec => path.posix.normalize(path.posix.join(path.posix.dirname(name), spec));
  const loadable = spec => !spec.includes(':') || /^node:[a-z_/]+$/.test(spec);
  const checkLoad = (spec, node) => {
    if (spec === 'process' || spec === 'node:process') say(`it loads ${spec}`, node);
    else if (!loadable(spec)) say(`it loads a module from a URL`, node);
  };
  // The helper by its own name, from its own file; and the names this script holds a require under.
  let imported = false;
  const requires = new Set(['require']);
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !literal(statement.moduleSpecifier)) continue;
    const clause = statement.importClause, named = clause?.namedBindings;
    if (target(statement.moduleSpecifier.text) !== HELPER) continue;
    if (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length && named.elements.every(e => !e.propertyName && e.name.text === NAME)) imported = true;
  }
  let shots = 0;
  const visit = node => {
    if (ts.isImportDeclaration(node)) {
      const spec = literal(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
      checkLoad(spec, node);
      const clause = node.importClause, names = [];
      if (clause?.name) names.push(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const e of clause.namedBindings.elements) names.push(e.name.text, (e.propertyName ?? e.name).text);
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) names.push(clause.namedBindings.name.text);
      if (target(spec) === HELPER) { if (!imported || names.some(n => n !== NAME)) say(`it takes lib/failure-shot.mjs under another name`, node); }
      else if (names.includes(NAME)) say(`its ${NAME} comes from ${spec}, not lib/failure-shot.mjs`, node);
      else if (names.some(n => REACH.has(n))) say(`it imports a name that can reach the process`, node);
      if (names.includes('createRequire')) { /* followed below, by call */ }
      return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)
      && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'createRequire') requires.add(node.name.text);
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const loads = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && requires.has(callee.text))
        || (ts.isCallExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'createRequire');
      if (loads) {
        const spec = node.arguments[0];
        if (node.arguments.length < 1 || !literal(spec)) say('it loads a module by a computed name', node);
        else if (target(spec.text) === HELPER) say('it loads lib/failure-shot.mjs by hand', node);
        else checkLoad(spec.text, node);
      }
    }
    if (ts.isElementAccessExpression(node) && !literal(node.argumentExpression) && !ts.isNumericLiteral(node.argumentExpression)) say('it reaches a member by a computed name', node);
    if (literal(node) && WORDS.has(node.text) && !ts.isImportDeclaration(node.parent)) say(`it names '${node.text}' as text`, node);
    if (ts.isIdentifier(node)) {
      const text = node.text, p = node.parent;
      if (text === 'screenshot') say('it takes a picture directly', node);
      else if (text === 'constructor' && ts.isPropertyAccessExpression(p)) say('it reaches a constructor', node);
      else if (REACH.has(text) && !memberName(node)) say(`it names ${text}`, node);
      else if (text === 'createRequire' && !(ts.isCallExpression(p) && p.expression === node && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name))) say('it keeps a require the read cannot follow', node);
      else if (requires.has(text) && text !== 'require' && !(ts.isCallExpression(p) && p.expression === node) && !declares(node)) say('it keeps a require the read cannot follow', node);
      else if (text === NAME) {
        if (declares(node)) say(`it defines its own ${NAME}`, node);
        else if (!(ts.isCallExpression(p) && p.expression === node)) say(`it uses ${NAME} other than by calling it`, node);
        else if (!imported) say(`it calls a ${NAME} that is not imported from lib/failure-shot.mjs`, node);
        else shots++;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (found.length) return [...new Set(found)].join('; ');
  return shots ? null : 'the read finds no picture call in it';
}
