import { h } from 'preact'

export const EmojiSearch = ({ onSearch }) => {
  return( 
  <div class="search-container">
    <input type="search"
      class="emoji-search"
      placeholder="Type to search ..."
      onInput={(event) => onSearch(event.target.value)} />
  </div>)
}
