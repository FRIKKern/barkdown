// Where a script's pictures sit, read by syntax (TypeScript's parser, the root's devDependency). A script that took
// no picture in a run may say "screenshots checked: 0" only when every .screenshot( call in it sits on a failure
// path (tests/screenshot-count.test.mjs). A call is on a failure path when it sits:
// (a) in a catch block that ends by throwing, or by process.exit(n) with n a nonzero literal; or
// (b) in a function whose last statement is process.exit(n), n a nonzero literal (a timer that fails a stuck run).
// Any other call is on the passing path, or, inside a callback, a place the read cannot decide; both forbid 0.
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

// Each .screenshot( call by line, sorted into failure, passing and undecided.
export function screenshotPaths(source, name = 'script.mjs') {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const line = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const paths = { failure: [], passing: [], undecided: [] };
  const place = call => {
    let callback = false;
    for (let node = call.parent; node; node = node.parent) {
      if (ts.isCatchClause(node) && failsTheRun(node.block.statements.at(-1))) return 'failure';
      if (isFunction(node)) {
        if (node.body && ts.isBlock(node.body) && exitsNonzero(node.body.statements.at(-1))) return 'failure';
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
