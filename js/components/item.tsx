import { Image } from './image'

const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAGAAAAADiNXWtAAAAIUlEQVRIDe3QAQ0AAADCoPdP7ewBESgMGDBgwIABAwY+MAkYAAGvX7w8AAAAAElFTkSuQmCC'

export const EmojiItem = ({ name, image }: { name: string, image: string, key?: string }) => {
  return (
    <div class="emoji-item">
      <Image src={image} preview={FALLBACK_IMAGE} alt={name} class="image" />
      <span>:{name}:</span>
    </div>
  )
}
