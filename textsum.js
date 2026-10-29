#!/usr/bin/env node
'use strict';

const { run } = require('../src/cli');

// `textsum big.txt | head` closes the pipe early; that is not an error.
process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

run(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (error) => {
    console.error(`textsum: unexpected error: ${error.message}`);
    process.exitCode = 1;
  },
);
