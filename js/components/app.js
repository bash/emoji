import { h, Component } from 'preact'
import { EmojiSearch } from './search'
import { EmojiList } from './list'
import { emojis } from '../data/emojis'

const filterItems = (items, query) => {
  if (query.length === 0) {
    return items
  }

  const normalizedQuery = query.trim().toLowerCase()

  return items
    .map(({ name, ...rest }) => ({ name, order: name.indexOf(normalizedQuery), ...rest }))
    .filter(({ order }) => order !== -1)
    .sort((a, b) => a.order > b.order)
}

export class EmojiApp extends Component {
  constructor () {
    super()

    this.state.query = ''
  }

  render ({}, { query }) {
    return (
      <main class="page-wrap">
        <EmojiSearch onSearch={(query) => this.setState({ query })} />
        <EmojiList items={filterItems(emojis, query)} />
      </main>
    )
  }
}
