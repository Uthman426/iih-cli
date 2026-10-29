'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeInput, InputError, MAX_BYTES } = require('../src/input');

test('empty input is rejected with a clear message', () => {
  assert.throws(() => decodeInput(Buffer.alloc(0)), { name: 'Error', message: /empty/ });
});

test('a UTF-8 byte-order mark is removed', () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('first word')]);
  assert.equal(decodeInput(bytes), 'first word');
});

test('UTF-16 text with a BOM is detected automatically', () => {
  const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('hi there', 'utf16le')]);
  assert.equal(decodeInput(bytes), 'hi there');
});

test('binary data is rejected instead of summarised', () => {
  assert.throws(() => decodeInput(Buffer.from([0, 1, 2, 3, 0, 255, 254, 0, 65])), /binary file/);
});

test('invalid UTF-8 suggests --encoding latin1, and latin1 then works', () => {
  const bytes = Buffer.from('caf\u00e9 menu', 'latin1');
  assert.throws(() => decodeInput(bytes), /--encoding latin1/);
  assert.equal(decodeInput(bytes, 'latin1'), 'caf\u00e9 menu');
});

test('an unknown encoding name gives a helpful error', () => {
  assert.throws(() => decodeInput(Buffer.from('hi'), 'klingon'), /unknown encoding 'klingon'/);
});

test('input over the size limit is refused', () => {
  assert.throws(() => decodeInput(Buffer.alloc(MAX_BYTES + 1, 97)), InputError);
});
