'use strict';

// Words, not whitespace-separated chunks: Intl.Segmenter knows that "don't" is one
// word, that "Hello," is "Hello", and where words end in Japanese, Chinese and Thai.
const wordSegmenter = new Intl.Segmenter('und', { granularity: 'word' });
const sentenceSegmenter = new Intl.Segmenter('und', { granularity: 'sentence' });

const COMMON_WORDS = new Set(
  ('a about after all also am an and any are as at be because been but by can could did do ' +
   'does for from had has have he her him his how i if in into is it its just me more my no ' +
   'not of on or our out she so than that the their them then there these they this to up ' +
   'us was we were what when which who will with would you your').split(' '),
);

const WORDS_PER_MINUTE = 200;

/** Length in Unicode code points, so an emoji counts as 1 rather than 2. */
function length(string) {
  let count = 0;
  for (const _ of string) count += 1; // eslint-disable-line no-unused-vars
  return count;
}

function splitLines(text) {
  if (text === '') return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop(); // trailing newline
  return lines;
}

function summarise(input, { top = 5, includeCommon = false } = {}) {
  // Composed and decomposed forms of "é" must be the same word.
  const text = input.normalize('NFC');
  const lines = splitLines(text);

  let characters = 0;
  let paragraphs = 0;
  let inParagraph = false;
  let longestLine = { line: 0, length: 0 };
  lines.forEach((line, index) => {
    const size = length(line);
    characters += size;
    if (size > longestLine.length) longestLine = { line: index + 1, length: size };
    const blank = line.trim() === '';
    if (!blank && !inParagraph) paragraphs += 1;
    inParagraph = !blank;
  });

  const frequency = new Map();
  let words = 0;
  let totalWordLength = 0;
  let longestWord = null;
  for (const { segment, isWordLike } of wordSegmenter.segment(text)) {
    if (!isWordLike) continue;
    words += 1;
    const size = length(segment);
    totalWordLength += size;
    if (!longestWord || size > longestWord.length) longestWord = { word: segment, length: size };
    const key = segment.toLowerCase();
    frequency.set(key, (frequency.get(key) || 0) + 1);
  }

  let sentences = 0;
  for (const { segment } of sentenceSegmenter.segment(text)) {
    if (/[\p{L}\p{N}]/u.test(segment)) sentences += 1;
  }

  const topWords = [...frequency.entries()]
    .filter(([word]) => includeCommon || !COMMON_WORDS.has(word))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)) // most used, then alphabetical
    .slice(0, top)
    .map(([word, count]) => ({ word, count }));

  return {
    lines: lines.length,
    paragraphs,
    sentences,
    words,
    uniqueWords: frequency.size,
    characters,
    averageWordLength: words ? Math.round((totalWordLength / words) * 10) / 10 : 0,
    longestWord,
    longestLine,
    readingMinutes: Math.round((words / WORDS_PER_MINUTE) * 10) / 10,
    topWords,
  };
}

module.exports = { summarise, length, WORDS_PER_MINUTE };
