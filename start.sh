#!/bin/bash

set -eo pipefail

deno run --allow-net --allow-read --allow-write --allow-env main.ts
