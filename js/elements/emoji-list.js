/**
 * (c) 2016 Ruben Schmidmeister
 */

import { EmojiItem } from './emoji-item'

export class EmojiList extends HTMLElement {
  filter (query) {

    const normalizedQuery = query.toLowerCase().trim()

    let result = this.emojiItems.map((item) => {
      const name = item.emojiName
      const order = name.indexOf(normalizedQuery)
      const show = (order !== -1)

      return { item, order, show }
    })

    result.forEach(({ item, order, show }) => {
      if (show) {
        item.style.order = order
        item.style.display = ''
      } else {
        item.style.display = 'none'
      }
    })
  }

  get emojiItems () {
    return Array.from(this.querySelectorAll('emoji-item'))
  }
}
