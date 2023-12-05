#!/bin/bash

# loop through all the files in the src directory
# and build them with esbuild
for file in src/*.ts;
do
  npx esbuild $file --format=esm --sourcemap --outfile=dist/$(basename $file)
done

npx tsc
