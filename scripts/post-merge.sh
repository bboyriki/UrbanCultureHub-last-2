#!/bin/bash
set -e
npm install
# Pipe "enter" to auto-accept the default answer on any interactive drizzle prompts
# (default is always the safe non-destructive option)
echo "" | npx drizzle-kit push --force
