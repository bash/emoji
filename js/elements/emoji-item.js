/**
 * (c) 2016 Ruben Schmidmeister
 */

export class EmojiItem extends HTMLElement {
  get emojiName () {
    return this.getAttribute('emoji-name')
  }
}
