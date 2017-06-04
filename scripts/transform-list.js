#!/usr/bin/env node
'use strict'

const stdin = process.stdin

let data = ''

stdin.resume()
stdin.setEncoding('utf8')

stdin.on('data', (buf) => {
  data += buf
})

stdin.on('end', () => {
  const emojis = JSON.parse(data)
  const items = Object.entries(emojis).map(([name, image]) => ({ name, image }))

  console.log(JSON.stringify(items, null, 2))
})
