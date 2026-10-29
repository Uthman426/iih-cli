'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run } = require('../src/cli');
const pkg = require('../package.json');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'textsum-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function file(name, content) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, content);
  return p;
}

/** Run the CLI in-process with captured output. */
async function cli(argv, { stdin = null, tty = false } = {}) {
  let out = '';
  let err = '';
  const code = await run(argv, {
    stdout: (s) => { out += s; },
    stderr: (s) => { err += s; },
    stdinIsTTY: tty,
    readStdin: async () => Buffer.from(stdin ?? ''),
  });
  return { code, out, err };
}

test('summarises a file and prints a readable report', async () => {
  const p = file('a.txt', 'The cat sat. The cat ran.\n');
  const { code, out, err } = await cli([p]);
  assert.equal(code, 0);
  assert.equal(err, '');
  assert.match(out, /Words:\s+6/);
  assert.match(out, /1\.\s+cat\s+2/);
});

test('--json prints valid JSON with the same numbers', async () => {
  const p = file('b.txt', 'one two two three\n');
  const { code, out } = await cli([p, '--json', '-n', '1']);
  const data = JSON.parse(out);
  assert.equal(code, 0);
  assert.equal(data.words, 4);
  assert.deepEqual(data.topWords, [{ word: 'two', count: 2 }]);
  assert.equal(data.file, p);
});

test("reads standard input with '-' and when text is piped without a file name", async () => {
  for (const argv of [['-'], []]) {
    const { code, out } = await cli(argv, { stdin: 'alpha beta gamma' });
    assert.equal(code, 0);
    assert.match(out, /\(standard input\)/);
    assert.match(out, /Words:\s+3/);
  }
});

test('--all-words includes common words in the top list', async () => {
  const { out } = await cli(['-', '--all-words', '-n', '1'], { stdin: 'the the the cat' });
  assert.match(out, /1\.\s+the\s+3/);
});

test('missing file: exit 1, friendly message, no stack trace', async () => {
  const { code, out, err } = await cli([path.join(tmp, 'nope.txt')]);
  assert.equal(code, 1);
  assert.equal(out, '');
  assert.match(err, /file not found/);
  assert.doesNotMatch(err, /at .*\.js/);
});

test('a directory is not accepted as input', async () => {
  const { code, err } = await cli([tmp]);
  assert.equal(code, 1);
  assert.match(err, /is a directory/);
});

test('binary, empty and whitespace-only files exit 1 with a clear reason', async () => {
  const cases = [
    [file('bin.dat', Buffer.from([0, 1, 2, 0, 255])), /binary file/],
    [file('empty.txt', ''), /empty/],
    [file('blank.txt', '  \n\t\n'), /no text to summarise/],
  ];
  for (const [p, pattern] of cases) {
    const { code, err } = await cli([p]);
    assert.equal(code, 1, p);
    assert.match(err, pattern);
  }
});

test('--encoding latin1 reads an older file that fails as UTF-8', async () => {
  const p = file('old.txt', Buffer.from('caf\u00e9 caf\u00e9', 'latin1'));
  assert.equal((await cli([p])).code, 1);
  const { code, out } = await cli([p, '-e', 'latin1', '--json']);
  assert.equal(code, 0);
  assert.equal(JSON.parse(out).topWords[0].word, 'caf\u00e9');
});

test('a huge unbroken "word" is shortened in the report, not dumped', async () => {
  const { out } = await cli(['-'], { stdin: `${'x'.repeat(5000)} end` });
  assert.match(out, /Longest word:\s+x{40}… \(5,000 chars\)/);
});

test('usage errors exit 2 and point to --help', async () => {
  const bad = [['--bogus'], ['-n'], ['-n', '0'], ['-n', 'abc'], ['-n', '5000'], ['a.txt', 'b.txt']];
  for (const argv of bad) {
    const { code, out, err } = await cli(argv, { stdin: 'x' });
    assert.equal(code, 2, argv.join(' '));
    assert.equal(out, '');
    assert.match(err, /textsum: error:/);
    assert.match(err, /--help/);
  }
});

test('no arguments on a terminal explains what to do instead of hanging', async () => {
  const { code, err } = await cli([], { tty: true });
  assert.equal(code, 2);
  assert.match(err, /no input given/);
});

test('--help lists every option and shows examples; --version matches package.json', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  for (const piece of ['--top', '--all-words', '--json', '--encoding', 'Examples:', 'Exit status']) {
    assert.ok(help.out.includes(piece), `help is missing ${piece}`);
  }
  assert.equal((await cli(['-v'])).out, `textsum ${pkg.version}\n`);
});

test('the real executable works end to end, including piped input', () => {
  const bin = path.join(__dirname, '..', 'bin', 'textsum.js');
  const p = file('real.txt', 'hello world hello\n');
  const direct = spawnSync(process.execPath, [bin, p, '--json']);
  assert.equal(direct.status, 0);
  assert.equal(JSON.parse(direct.stdout).words, 3);

  const piped = spawnSync(process.execPath, [bin, '-'], { input: 'a b c d' });
  assert.equal(piped.status, 0);
  assert.match(piped.stdout.toString(), /Words:\s+4/);

  const missing = spawnSync(process.execPath, [bin, path.join(tmp, 'zzz.txt')]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr.toString(), /file not found/);
});
