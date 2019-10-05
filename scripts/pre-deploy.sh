#!/usr/bin/env bash

set -e

files=(
    build/js/emoji.js
    build/css/emoji.css
    index.html
)

public_dir=public

for file in ${files[@]}
do
    mkdir -p "$public_dir/$(dirname "$file")"
    cp -R "$file" "$public_dir/$file"
done
