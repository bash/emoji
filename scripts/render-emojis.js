#!/usr/bin/env node

'use strict'

const spawnSync = require('child_process').spawnSync
const stdin = process.stdin
const stdout = process.stdout

const command = process.argv.slice(2).join(' ')
let data = ''

stdin.resume()
stdin.setEncoding('utf8')

stdin.on('data', (buf) => {
  data += buf
})

stdin.on('end', () => {  
  let emojis = JSON.parse(data);

  Object.keys(emojis).forEach((name) => {
    let image = emojis[name];

    spawnSync(command, [name, image], { stdio: 'inherit' })
  })
})
