/**
 * (c) 2016 Ruben Schmidmeister
 */

import { EmojiList } from './elements/emoji-list'
import { EmojiItem } from './elements/emoji-item'
import { EmojiSearch } from './elements/emoji-search'

customElements.define('emoji-list', EmojiList)
customElements.define('emoji-item', EmojiItem)
customElements.define('emoji-search', EmojiSearch, { extends: 'input' })
