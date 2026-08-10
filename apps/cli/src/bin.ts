#!/usr/bin/env node

import { runCliProcess } from "./index.js";

process.exitCode = await runCliProcess(process.argv.slice(2));
