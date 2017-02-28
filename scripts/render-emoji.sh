#!/bin/bash

NAME="${1}" 
IMAGE="${2}"

cat html/emoji.html \
  | sed "s#{{name}}#${NAME}#g" \
  | sed "s#{{image}}#${IMAGE}#g"
