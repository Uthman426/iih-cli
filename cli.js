'use strict';

const fs = require('node:fs');
const { parseArgs } = require('node:util');
const { decodeInput, InputError, MAX_BYTES } = require('./input');
const { summarise } = require('./summarise');
const { formatReport } = require('./format');
const pkg = require('../package.json');

const EXIT_OK = 0;
const EXIT_INPUT = 1; // problem with the file or its contents
const EXIT_USAGE = 2; // wrong command-line usage

const HELP = `Usage: textsum [options] [file]

Summarise a text file: line, word and sentence counts, reading time and the
most-used words. Reads standard input if the file is '-' or text is piped in.

Options:
  -n, --top <N>       how many top words to list, 1-1000 (default: 5)
      --all-words     include common words such as "the" and "and" in that list
      --json          print the summary as JSON
  -e, --encoding <X>  text encoding of the input (default: utf-8; a byte-order
                      mark is detected automatically). Example: latin1
  -h, --help          show this help
  -v, --version       show the version

Examples:
  textsum notes.txt
  textsum essay.txt -n 10 --all-words
  textsum report.txt --json
  cat notes.txt | textsum -

Exit status: 0 success, 1 problem with the input, 2 wrong usage.
`;

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    process.stdin.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new InputError(`the input is larger than ${MAX_BYTES / 1024 / 1024} MB, which is the limit`));
        process.stdin.destroy();
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);
  });
}

async function readFile(path) {
  let stats;
  try {
    stats = await fs.promises.stat(path);
  } catch (error) {
    if (error.code === 'ENOENT') throw new InputError(`file not found: ${path}`);
    if (error.code === 'EACCES') throw new InputError(`permission denied: ${path}`);
    throw new InputError(`cannot read '${path}': ${error.message}`);
  }
  if (stats.isDirectory()) throw new InputError(`'${path}' is a directory, not a text file`);
  if (stats.size > MAX_BYTES) {
    throw new InputError(`'${path}' is larger than ${MAX_BYTES / 1024 / 1024} MB, which is the limit`);
  }
  try {
    return await fs.promises.readFile(path);
  } catch (error) {
    if (error.code === 'EACCES') throw new InputError(`permission denied: ${path}`);
    throw new InputError(`cannot read '${path}': ${error.message}`);
  }
}

function defaultIO() {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    readStdin,
    readFile,
    stdinIsTTY: Boolean(process.stdin.isTTY),
  };
}

function usageError(io, message) {
  io.stderr(`textsum: error: ${message}\nTry 'textsum --help' for usage.\n`);
  return EXIT_USAGE;
}

/** Run the CLI. `overrides` lets tests replace stdin/stdout/stderr. Returns the exit code. */
async function run(argv, overrides = {}) {
  const io = { ...defaultIO(), ...overrides };

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        top: { type: 'string', short: 'n' },
        'all-words': { type: 'boolean' },
        json: { type: 'boolean' },
        encoding: { type: 'string', short: 'e' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    return usageError(io, error.message.split('. ')[0].replace(/\.$/, ''));
  }
  const { values, positionals } = parsed;

  if (values.help) { io.stdout(HELP); return EXIT_OK; }
  if (values.version) { io.stdout(`textsum ${pkg.version}\n`); return EXIT_OK; }

  let top = 5;
  if (values.top !== undefined) {
    top = /^\d+$/.test(values.top) ? Number(values.top) : NaN;
    if (!(top >= 1 && top <= 1000)) {
      return usageError(io, `--top needs a whole number from 1 to 1000, not '${values.top}'`);
    }
  }
  if (positionals.length > 1) {
    return usageError(io, `expected one file but got ${positionals.length}; run textsum once per file`);
  }
  if (positionals.length === 0 && io.stdinIsTTY) {
    return usageError(io, "no input given: pass a file name, or pipe text in and use '-'");
  }

  const source = positionals[0] === undefined ? '-' : positionals[0];
  try {
    const bytes = source === '-' ? await io.readStdin() : await io.readFile(source);
    const text = decodeInput(bytes, values.encoding);
    if (text.trim() === '') throw new InputError('the input contains no text to summarise');

    const result = summarise(text, { top, includeCommon: Boolean(values['all-words']) });
    const label = source === '-' ? '(standard input)' : source;
    io.stdout(values.json
      ? `${JSON.stringify({ file: label, ...result }, null, 2)}\n`
      : formatReport(result, label));
    return EXIT_OK;
  } catch (error) {
    if (error instanceof InputError) {
      io.stderr(`textsum: error: ${error.message}\n`);
      return EXIT_INPUT;
    }
    throw error;
  }
}

module.exports = { run, HELP };
