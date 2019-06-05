import { h } from 'preact'
import { Image } from './image'

const FALLBACK_IMAGE = 'https://github.githubassets.com/images/icons/emoji/unicode/2753.png'

export const EmojiItem = ({ name, image }) => {
  return (
    <div class="emoji-item">
      <Image src={image} preview={FALLBACK_IMAGE} alt={name} class="image" />
      <span>:{name}:</span>
    </div>
  )
}
