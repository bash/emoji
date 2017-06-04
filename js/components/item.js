import { h } from 'preact'
import { Image } from './image'

export const EmojiItem = ({ name, image }) => {
  return (
    <div class="emoji-item">
      <Image src={image} preview="https://assets-cdn.github.com/images/icons/emoji/unicode/2754.png?v7" alt={name} class="image" />
      <span>:{name}:</span>
    </div>
  )
}
