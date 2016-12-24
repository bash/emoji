/**
 * (c) 2016 Ruben Schmidmeister
 */

import { EmojiItem } from './emoji-item'

const ENDPOINT_URL = 'https://api.github.com/emojis'

export class EmojiList extends HTMLElement {

  constructor () {
    super()

    /**
     * 
     * @type {Array<string>}
     */
    this._emojiNames = []

    /**
     * 
     * @type {Map<string,string>}
     */
    this._emojis = new Map()

    /**
     * 
     * @type {Map<string,Element>}
     */
    this._elements = new Map()
  }

  connectedCallback () {
    fetch(ENDPOINT_URL)
      .then((resp) => resp.json())
      .then((emojis) => {

        const names = Object.keys(emojis)
        const map = names.map((key) => [key, emojis[key]])

        this._emojis = new Map(map)
        this._emojiNames = names

        this._render()
      })
  }

  _render () {

    this._emojis.forEach((imageSrc, name) => {
      window.setTimeout(() => {
        const item = new EmojiItem(name, imageSrc)

        this.appendChild(item)

        this._elements.set(name, item)
      })
    })
  }

  filter (query) {

    const normalizedQuery = query.toLowerCase().trim()
    const matches = {}

    this._emojiNames.forEach((name) => {
      const order = name.indexOf(normalizedQuery)
      const show = (order !== -1)

      matches[name] = { order, show }
    })
    
  
    this._elements.forEach((element, name) => {
      const match = matches[name]

      if (match.show) {
        element.style.order = match.order
        element.style.display = ''
      } else {
        element.style.display = 'none'
      }
    })
    
  }

}
