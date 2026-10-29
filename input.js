'use strict';

/** Raised when the input cannot be summarised. Messages are written for end users. */
class InputError extends Error {}

const MAX_BYTES = 50 * 1024 * 1024; // whole input is held in memory, so cap it
const BINARY_SNIFF_BYTES = 8192;

function detectBom(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'utf-8';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'utf-16le';
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'utf-16be';
  return null;
}

/**
 * Turn raw bytes into text. A byte-order mark picks the encoding automatically;
 * --encoding overrides it. Binary data and invalid text are rejected, not guessed at.
 */
function decodeInput(buf, requestedEncoding) {
  if (buf.length === 0) throw new InputError('the input is empty');
  if (buf.length > MAX_BYTES) {
    throw new InputError(`the input is larger than ${MAX_BYTES / 1024 / 1024} MB, which is the limit`);
  }

  const bomEncoding = detectBom(buf);
  const encoding = requestedEncoding || bomEncoding || 'utf-8';

  const isUtf16 = /^utf-?16/i.test(encoding);
  if (!isUtf16 && buf.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
    throw new InputError('this looks like a binary file, not text (it contains NUL bytes)');
  }

  let decoder;
  try {
    decoder = new TextDecoder(encoding, { fatal: true }); // also strips a matching BOM
  } catch {
    throw new InputError(`unknown encoding '${encoding}'; try utf-8, latin1 or utf-16le`);
  }
  try {
    return decoder.decode(buf);
  } catch {
    throw new InputError(
      `the input is not valid ${encoding} text; if it is an older file, try --encoding latin1`,
    );
  }
}

module.exports = { InputError, decodeInput, MAX_BYTES };
