#!/bin/bash

cat html/index_top.html > index.html
curl https://api.github.com/emojis | ./scripts/render-emojis.js ./scripts/render-emoji.sh >> index.html
cat html/index_bottom.html >> index.html
