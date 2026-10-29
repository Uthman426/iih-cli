'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarise } = require('../src/summarise');

test('counts lines, words, sentences and characters in plain text', () => {
  const r = summarise('The quick brown fox. It jumps over the lazy dog!\nSecond line here.\n');
  assert.equal(r.lines, 2);
  assert.equal(r.words, 13);
  assert.equal(r.sentences, 3);
  assert.equal(r.characters, 'The quick brown fox. It jumps over the lazy dog!'.length + 'Second line here.'.length);
});

test('punctuation and capitals do not create different words', () => {
  const r = summarise('Hello, hello. HELLO! "Hello" (hello)');
  assert.equal(r.words, 5);
  assert.equal(r.uniqueWords, 1);
  assert.deepEqual(r.topWords, [{ word: 'hello', count: 5 }]);
});

test('apostrophes stay inside a word (straight and curly)', () => {
  const r = summarise("don't can\u2019t");
  assert.equal(r.words, 2);
  assert.deepEqual(r.topWords.map((w) => w.word).sort(), ["can\u2019t", "don't"]);
});

test('Japanese text is split into words and sentences, not one giant word', () => {
  const r = summarise('今日は天気がいいですね。散歩に行きましょう。');
  assert.ok(r.words > 3, `expected several words, got ${r.words}`);
  assert.equal(r.sentences, 2);
});

test('emoji count as one character each, not two', () => {
  assert.equal(summarise('😀😀😀 ok\n').characters, 6); // line breaks are not counted
});

test('composed and decomposed accents are the same word', () => {
  const r = summarise('caf\u00e9 cafe\u0301');
  assert.equal(r.words, 2);
  assert.equal(r.uniqueWords, 1);
});

test('CRLF, CR and LF line endings give the same line count; trailing newline adds none', () => {
  for (const eol of ['\n', '\r\n', '\r']) {
    assert.equal(summarise(`one${eol}two${eol}three${eol}`).lines, 3, JSON.stringify(eol));
  }
  assert.equal(summarise('no newline at end').lines, 1);
});

test('paragraphs are blocks separated by blank lines', () => {
  assert.equal(summarise('a\nb\n\n\n   \nc\n\nd\n').paragraphs, 3);
});

test('top words skip common words by default and include them with includeCommon', () => {
  const text = 'the cat and the dog and the cat';
  assert.deepEqual(summarise(text).topWords, [{ word: 'cat', count: 2 }, { word: 'dog', count: 1 }]);
  assert.equal(summarise(text, { includeCommon: true }).topWords[0].word, 'the');
});

test('ties are broken alphabetically and the list is limited to top N', () => {
  const r = summarise('pear apple pear apple mango', { top: 2 });
  assert.deepEqual(r.topWords, [{ word: 'apple', count: 2 }, { word: 'pear', count: 2 }]);
});

test('finds the longest line and the longest word', () => {
  const r = summarise('short\nthis is the longest line here\nmid line\nextraordinary');
  assert.deepEqual(r.longestLine, { line: 2, length: 'this is the longest line here'.length });
  assert.equal(r.longestWord.word, 'extraordinary');
});

test('reading time uses 200 words per minute', () => {
  assert.equal(summarise(Array(400).fill('word').join(' ')).readingMinutes, 2);
});
