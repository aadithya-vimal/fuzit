#!/usr/bin/env node

process.argv.splice(2, 0, "pack");
await import("../dist/bin.js");
