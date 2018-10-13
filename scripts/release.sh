#!/bin/bash

BRANCH="gh-pages"
FILES=(
  build/js/emoji.js
  build/css/emoji.css
  index.html
)

CURRENT_DIRECTORY=`pwd`
TEMP_DIR=$(mktemp -d)
REMOTE_URL=$(git config --get remote.origin.url)


set -e

cleanup() {
    rm -rf ${TEMP_DIR}
    cd ${CURRENT_DIRECTORY}
}

trap cleanup EXIT

echo "Cloning repository..."
git clone -b ${BRANCH} ${REMOTE_URL} ${TEMP_DIR} -q

echo "Cleaning old files..."

OLD_FILES=$(find ${TEMP_DIR} -maxdepth 1 -mindepth 1 -not -name ".git")

for FILE in ${OLD_FILES}; do
    rm -rf ${FILE}
done

echo "Copying new files..."

for FILE in ${FILES[@]}; do
    mkdir -p ${TEMP_DIR}/$(dirname ${FILE})
    cp -R ${FILE} ${TEMP_DIR}/${FILE}
done

cd ${TEMP_DIR}
git add -A

TIMESTAMP=$(date +"%s")

git commit -m "Build #${TIMESTAMP}"

echo "Pushing..."
git push origin ${BRANCH}
