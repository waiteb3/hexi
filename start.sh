#!/bin/bash

set -eo pipefail

TZ=UTC deno run --allow-net --allow-read --allow-write --allow-env main.ts
