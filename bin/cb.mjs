#!/usr/bin/env node
import { main } from '../src/cli.js';
import { makeRunner } from '../src/runner.js';

const code = main(process.argv.slice(2), makeRunner());
process.exit(code);
