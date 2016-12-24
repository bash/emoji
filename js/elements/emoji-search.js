/**
 * (c) 2016 Ruben Schmidmeister
 */

export class EmojiSearch extends HTMLInputElement {

  constructor () {
    super()

    this._onInput = this._onInput.bind(this)
  }

  connectedCallback () {
    this.addEventListener('input', this._onInput)
  }

  disconnectedCallback () {
    this.removeEventListener('input', this._onInput)
  }

  _onInput () {
    
    // TODO: find a better solution for this
    
    document.querySelector('emoji-list').filter(this.value)

  }

}
