SHELL := /bin/bash

PROJECT_NAME := emoji

LESS_FILES := $(shell find less -name "*.less")
JS_FILES := $(shell find js -name "*.js")

ROLLUP_CONFIG := .rollup.config.js

.PHONY: all clean lint deps

all: build/css/$(PROJECT_NAME).css js/data/emojis.js build/js/$(PROJECT_NAME).js

clean:
	rm -rf build/ js/data/emojis.js

deps:
	yarn install

lint:
	yarn run -s lessc --lint less/$(PROJECT_NAME).less

build/css/$(PROJECT_NAME).css: $(LESS_FILES)
	@mkdir -p $(@D)
ifeq ($(BUILD_MODE), release)
	yarn run -s lessc less/$(PROJECT_NAME).less | yarn run -s postcss -u autoprefixer -u cssnano -o $@
else
	yarn run -s lessc less/$(PROJECT_NAME).less | yarn run -s postcss -u autoprefixer -o $@
endif

build/js/$(PROJECT_NAME).js: $(JS_FILES)
	@mkdir -p $(@D)
	yarn run -s rollup -c $(ROLLUP_CONFIG) -o $@ js/$(PROJECT_NAME).js

js/data/emojis.js:
	@mkdir -p $(@D)
	echo -n "export const emojis = " > $@
	curl https://api.github.com/emojis | node scripts/transform-list.js >> $@
