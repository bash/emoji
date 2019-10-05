#!/usr/bin/env python

import shutil
import os
import pathlib

FILES = [
    'build/js/emoji.js',
    'build/css/emoji.css',
    'index.html'
]

PUBLIC_DIR = 'public'

for file in FILES:
    target_file = os.path.join(PUBLIC_DIR, file)
    target_directory = pathlib.Path(os.path.dirname(target_file))
    target_directory.mkdir(parents=True, exist_ok=True)
    shutil.copy2(file, target_file)
