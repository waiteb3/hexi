#!/usr/bin/env bash

set -eo pipefail

TZ=UTC deno run -c tsconfig.json --allow-net --allow-read --allow-write --allow-env main.ts
