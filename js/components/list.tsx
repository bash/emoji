import { EmojiItem } from './item'

export const EmojiList = ({ items }) => {
  return (
    <div class="emoji-list">
      {items.map(({ name, image }) => <EmojiItem name={name} image={image} key={name} />)}
    </div>
  )
}
