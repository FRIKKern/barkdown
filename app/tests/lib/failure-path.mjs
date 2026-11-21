// Where a script's pictures sit, read by syntax (TypeScript's parser, the root's devDependency). A script that took
// no picture in a run may say "screenshots checked: 0" only when every .screenshot( call in it sits on a failure
// path (tests/screenshot-count.test.mjs). A call is on a failure path when it sits:
// (a) in a catch block that ends by throwing, or by process.exit(n) with n a nonzero literal; or
// (b) in a function whose last statement is process.exit(n), n a nonzero literal (a timer that fails a stuck run).
// A catch block or function that can also leave by a return, or by a break or continue to outside it, is a place the
// read cannot decide, even when it ends by failing: the run may go on past the picture. Any other call is on the
// passing path, or, inside a callback, a place the read cannot decide; all of these forbid 0.
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');

const failsTheRun = statement => {
  if (!statement) return false;
  if (ts.isThrowStatement(statement)) return true;
  const call = ts.isExpressionStatement(statement) ? statement.expression : null;
  return Boolean(call && ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)
    && call.expression.name.text === 'exit' && ts.isIdentifier(call.expression.expression) && call.expression.expression.text === 'process'
    && call.arguments.length === 1 && ts.isNumericLiteral(call.arguments[0]) && Number(call.arguments[0].text) !== 0);
};
const exitsNonzero = statement => failsTheRun(statement) && !ts.isThrowStatement(statement);
const isFunction = node => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);
const isLoop = node => ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node);

// Whether a block can be left other than by its end: a return, or a break or continue whose target is outside it.
// Nested functions and classes are their own flow and are not read.
function leavesEarly(block) {
  let early = false;
  const visit = (node, loops, switches, labels) => {
    if (early || isFunction(node) || ts.isClassLike(node)) return;
    if (ts.isReturnStatement(node)) { early = true; return; }
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

// Each .screenshot( call by line, sorted into failure, passing and undecided.
export function screenshotPaths(source, name = 'script.mjs') {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const paths = { failure: [], passing: [], undecided: [] };
  const place = call => {
    let callback = false;
    for (let node = call.parent; node; node = node.parent) {
      if (ts.isCatchClause(node) && failsTheRun(node.block.statements.at(-1))) return leavesEarly(node.block) ? 'undecided' : 'failure';
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
