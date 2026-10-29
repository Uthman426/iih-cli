'use strict';

const number = (n) => n.toLocaleString('en-US');

function shorten(word, max = 40) {
  const chars = [...word];
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : word;
}

function readingTime(minutes) {
  return minutes < 0.5 ? 'under 1 min' : `about ${Math.round(minutes)} min`;
}

function formatReport(result, label) {
  const rows = [
    ['File', label],
    ['Lines', number(result.lines)],
    ['Paragraphs', number(result.paragraphs)],
    ['Sentences', `~${number(result.sentences)}`],
    ['Words', number(result.words)],
    ['Unique words', number(result.uniqueWords)],
    ['Characters', number(result.characters)],
    ['Average word length', result.averageWordLength.toFixed(1)],
    ['Longest word', result.longestWord
      ? `${shorten(result.longestWord.word)} (${number(result.longestWord.length)} chars)` : '-'],
    ['Longest line', `line ${result.longestLine.line} (${number(result.longestLine.length)} chars)`],
    ['Reading time', readingTime(result.readingMinutes)],
  ];
  const pad = Math.max(...rows.map(([name]) => name.length)) + 2;
  const out = rows.map(([name, value]) => `${`${name}:`.padEnd(pad)}${value}`);

  out.push('');
  if (result.topWords.length === 0) {
    out.push('Top words: none (only common words found; try --all-words)');
  } else {
    out.push(`Top ${result.topWords.length} word${result.topWords.length === 1 ? '' : 's'}:`);
    const width = Math.max(...result.topWords.map((w) => [...w.word].length));
    result.topWords.forEach(({ word, count }, i) => {
      out.push(`  ${String(i + 1).padStart(2)}. ${shorten(word).padEnd(width)}  ${number(count)}`);
    });
  }
  return `${out.join('\n')}\n`;
}

module.exports = { formatReport, readingTime };
