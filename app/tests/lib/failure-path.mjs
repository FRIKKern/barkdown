// Where a script's pictures sit, read by syntax (TypeScript's parser, the root's devDependency). A script that took
// no picture in a run may say "screenshots checked: 0" only when every .screenshot( call in it sits on a failure
// path (tests/screenshot-count.test.mjs). A call is on a failure path only when it sits:
// (a1) in a catch block whose last statement is process.exit(n), n a nonzero literal, anywhere;
// (a2) in a catch block whose last statement is a throw, at the module's top level only: in no function and in no
//      other try (its try block or its catch), where a rethrow could be caught and the run go on; or
// (b) in a function whose last statement is process.exit(n), n a nonzero literal (a timer that fails a stuck run).
// Even then, a block that can also be left by a return, or by a break or continue to outside it, or that holds a
// process.exit or process.exitCode that is not a nonzero literal, is a place the read cannot decide: the run may go
// on past the picture. Any other call is on the passing path, or, inside a callback, a place the read cannot
// decide; all of these forbid 0.
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');

const nonzero = node => Boolean(node && ts.isNumericLiteral(node) && Number(node.text) !== 0);
const ofProcess = (node, member) => ts.isPropertyAccessExpression(node) && node.name.text === member && ts.isIdentifier(node.expression) && node.expression.text === 'process';
const isExit = node => ts.isCallExpression(node) && ofProcess(node.expression, 'exit');
const exitsNonzero = statement => Boolean(statement && ts.isExpressionStatement(statement) && isExit(statement.expression)
  && statement.expression.arguments.length === 1 && nonzero(statement.expression.arguments[0]));
// A process.exit(…) or process.exitCode = … that may let the run end well.
const mayPass = node => (isExit(node) && !(node.arguments.length === 1 && nonzero(node.arguments[0])))
  || (ts.isBinaryExpression(node) && ofProcess(node.left, 'exitCode') && !nonzero(node.right));
const isFunction = node => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);
const isLoop = node => ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node);

// Whether a block can be left other than by its end (a return, or a break or continue whose target is outside it),
// or holds an exit that may pass. Nested functions and classes are their own flow and are not read.
function leavesEarly(block) {
  let early = false;
  const visit = (node, loops, switches, labels) => {
    if (early || isFunction(node) || ts.isClassLike(node)) return;
    if (ts.isReturnStatement(node) || mayPass(node)) { early = true; return; }
    if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
      const inside = node.label ? labels.has(node.label.text) : (loops > 0 || (ts.isBreakStatement(node) && switches > 0));
      if (!inside) { early = true; return; }
    }
    const nextLabels = ts.isLabeledStatement(node) ? new Set([...labels, node.label.text]) : labels;
    ts.forEachChild(node, child => visit(child, loops + (isLoop(node) && child === node.statement ? 1 : 0), switches + (ts.isSwitchStatement(node) && child === node.caseBlock ? 1 : 0), nextLabels));
  };
  for (const statement of block.statements) visit(statement, 0, 0, new Set());
  return early;
}

// Whether a try statement sits at the module's top level: in no function and in no other try.
const topLevel = tryStatement => {
  for (let node = tryStatement.parent; node; node = node.parent) if (isFunction(node) || ts.isClassLike(node) || ts.isTryStatement(node)) return false;
  return true;
};

// Each .screenshot( call by line, sorted into failure, passing and undecided.
export function screenshotPaths(source, name = 'script.mjs') {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const paths = { failure: [], passing: [], undecided: [] };
  const place = call => {
    let callback = false;
    for (let node = call.parent; node; node = node.parent) {
      if (ts.isCatchClause(node)) {
        const last = node.block.statements.at(-1);
        if (exitsNonzero(last)) return leavesEarly(node.block) ? 'undecided' : 'failure';
        if (last && ts.isThrowStatement(last)) return topLevel(node.parent) && !leavesEarly(node.block) ? 'failure' : 'undecided';
      }
      if (isFunction(node)) {
        if (node.body && ts.isBlock(node.body) && exitsNonzero(node.body.statements.at(-1))) return leavesEarly(node.body) ? 'undecided' : 'failure';
        if (ts.isCallExpression(node.parent) && node.parent.arguments.includes(node)) callback = true;
      }
    }
    return callback ? 'undecided' : 'passing';
  };
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'screenshot') paths[place(node)].push(line(node));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return paths;
}

// Why this script may not say "screenshots checked: 0", or null when every picture in it is on a failure path.
// A script the read finds no picture in, though its text names one, is refused too: the read fails closed.
export function zeroProblem(source, name = 'script.mjs') {
  const { failure, passing, undecided } = screenshotPaths(source, name);
  if (passing.length) return `it takes a picture on the passing path (line ${passing.join(', ')})`;
  if (undecided.length) return `the read cannot tell whether the picture on line ${undecided.join(', ')} is on a failure path`;
  if (!failure.length) return 'the read finds no screenshot call in it';
  return null;
}
