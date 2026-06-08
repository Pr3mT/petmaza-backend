/* One-shot codemod: console.* -> logger.* in runtime code, adding the logger
 * import where missing. Excludes standalone scripts (src/scripts/** and the
 * src-root diagnostic files) where console output is intentional. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..'); // src/
const RUNTIME_DIRS = ['controllers', 'services', 'middlewares', 'websocket', 'utils', 'routes', 'models'];
const EXTRA_FILES = ['index.ts'];

const MAP = [
  [/console\.log\s*\(/g, 'logger.info('],
  [/console\.info\s*\(/g, 'logger.info('],
  [/console\.warn\s*\(/g, 'logger.warn('],
  [/console\.error\s*\(/g, 'logger.error('],
  [/console\.debug\s*\(/g, 'logger.debug('],
];

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const files = [];
for (const d of RUNTIME_DIRS) {
  const full = path.join(SRC, d);
  if (fs.existsSync(full)) walk(full, files);
}
for (const f of EXTRA_FILES) {
  const full = path.join(SRC, f);
  if (fs.existsSync(full)) files.push(full);
}

let totalCalls = 0, changedFiles = 0, importsAdded = 0;
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  if (!/console\.(log|info|warn|error|debug)\s*\(/.test(src)) continue;

  const before = src;
  let calls = 0;
  for (const [re, repl] of MAP) {
    src = src.replace(re, () => { calls++; return repl; });
  }
  if (src === before) continue;

  // Ensure logger import
  const hasImport = /import\s+logger\s+from\s+['"][^'"]*config\/logger['"]/.test(src);
  if (!hasImport) {
    let rel = path.relative(path.dirname(file), path.join(SRC, 'config', 'logger'));
    rel = rel.split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    src = `import logger from '${rel}';\n` + src;
    importsAdded++;
  }

  fs.writeFileSync(file, src, 'utf8');
  totalCalls += calls;
  changedFiles++;
  console.log(`  ${path.relative(SRC, file).padEnd(48)} ${calls} call(s)${hasImport ? '' : ' +import'}`);
}

console.log(`\nDone: ${totalCalls} calls converted across ${changedFiles} files (${importsAdded} imports added).`);
