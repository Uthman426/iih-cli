# textsum

Summarise a text file from the command line: line, word and sentence counts, reading time and the most-used words. No dependencies, works on Windows, macOS and Linux.

## Install and run (two commands)

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install -g github:YOUR-USER/textsum
textsum notes.txt
```

Don't want to install anything? This runs it once: `npx github:YOUR-USER/textsum notes.txt`

> Replace `YOUR-USER/textsum` with the repository's real path on GitHub.

## Usage

```
$ textsum story.txt
File:                story.txt
Lines:               5
Paragraphs:          2
Sentences:           ~7
Words:               49
Unique words:        35
Characters:          256
Average word length: 4.1
Longest word:        exception (9 chars)
Longest line:        line 4 (80 chars)
Reading time:        under 1 min

Top 5 words:
   1. dog      3
   2. fox      3
   3. weather  2
   4. amused   1
   5. animals  1
```

More examples:

```bash
textsum essay.txt -n 10             # list the 10 most-used words
textsum essay.txt --all-words       # count "the", "and" and other common words too
textsum report.txt --json           # machine-readable output
cat notes.txt | textsum -           # read standard input
textsum old-file.txt -e latin1      # file saved in an older encoding
```

### Options

| Option | Meaning |
| --- | --- |
| `-n, --top <N>` | How many top words to list, 1 to 1000 (default 5) |
| `--all-words` | Include common words such as "the" and "and" in the top list |
| `--json` | Print the summary as JSON |
| `-e, --encoding <X>` | Input encoding (default UTF-8; byte-order marks are detected automatically) |
| `-h, --help` | Show help |
| `-v, --version` | Show the version |

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Problem with the input (missing file, binary file, empty, wrong encoding) |
| 2 | Wrong usage (unknown option, bad number, two files, no input) |

Errors are short and say what to do next:

```
$ textsum notes.txt -n 0
textsum: error: --top needs a whole number from 1 to 1000, not '0'
Try 'textsum --help' for usage.

$ textsum photo.png
textsum: error: this looks like a binary file, not text (it contains NUL bytes)

$ textsum old-file.txt
textsum: error: the input is not valid utf-8 text; if it is an older file, try --encoding latin1
```

## How awkward input is handled

| Input | Behaviour |
| --- | --- |
| Punctuation and capitals (`Hello, HELLO!`) | Same word, counted together |
| Japanese, Chinese, Thai (no spaces) | Split into real words and sentences |
| Emoji and accents typed two ways (`é` vs `e` + accent) | Emoji count as one character; both accent forms are the same word |
| Windows, old Mac and Unix line endings | Same line count; a trailing newline adds no extra line |
| UTF-8 or UTF-16 byte-order mark | Detected and removed |
| Binary file, empty file, whitespace-only file | Clear error, exit code 1 |
| A 5,000-character word with no spaces | Shown shortened in the report |
| Piping into `head` | Exits quietly |
| Files over 50 MB | Refused with a message (the whole input is held in memory) |

## Run the tests

```bash
git clone https://github.com/YOUR-USER/textsum.git
cd textsum
npm test
```

There are 32 automated tests, using Node's built-in test runner, so there is nothing else to install. They cover the counting logic, text decoding, the command-line behaviour (including error messages and exit codes) and the real executable run as a separate process. A GitHub Actions workflow runs them on Node 18, 20 and 22.

## Design decision I changed after testing on awkward input

**Decision: how to split text into words.** The first version split on whitespace (`text.split(/\s+/)`), which is the obvious approach. I then ran it on awkward files and it gave wrong answers without any warning:

| Input | First version said | Now |
| --- | --- | --- |
| `Hello, hello. HELLO! "Hello" (hello)` | 5 different words | 5 words, 1 unique |
| A Japanese sentence with no spaces | 1 word | 12 words, 2 sentences |
| `😀😀😀 ok` | emoji counted as 2 characters each | 6 characters |
| `café` typed two ways (precomposed and decomposed) | 2 different words | 1 unique word |
| A file of random bytes | "1 word" | error: looks like a binary file |
| An empty file | zero counts, no complaint | error: the input is empty |

The fix was to stop treating spaces as the definition of a word. The tool now uses the language-aware `Intl.Segmenter` built into Node, normalises text to a single accent form first, counts characters as Unicode code points, and refuses input that is not text. The trade-off is speed: about 1.7 seconds for a 5 MB file with 900,000 words, against much less for naive splitting. For a tool that people run on notes and essays, correct counts matter more than shaving a second off a very large file.

## Limitations

- Sentence counts are approximate (shown with a `~`), because abbreviations like "e.g." are ambiguous.
- Common-word filtering uses an English list only. Use `--all-words` for other languages.
- The whole input is read into memory, hence the 50 MB limit.

## Project layout

```
bin/textsum.js      command entry point
src/cli.js          argument parsing, reading input, exit codes
src/input.js        decoding bytes to text, rejecting binary and invalid input
src/summarise.js    the counting logic (no input or output)
src/format.js       the human-readable report
test/               automated tests
```

## Licence

MIT
