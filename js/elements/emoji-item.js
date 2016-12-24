/**
 * (c) 2016 Ruben Schmidmeister
 */

export class EmojiItem extends HTMLElement {

  constructor (name, imageSrc) {

    super()

    this._name = name
    this._imageSrc = imageSrc
    this.className = 'emoji-item'

  }

  connectedCallback () {

    const image = document.createElement('img')
    image.src = this._imageSrc
    image.className = 'image'

    this.appendChild(image)

    const name = document.createElement('span')
    name.innerText = `:${this._name}:`
    name.className = 'name'

    this.appendChild(name)

    this.setAttribute('emoji-name', this._name)
  }

}
