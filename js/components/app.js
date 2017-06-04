import { h, Component } from 'preact'
import { EmojiSearch } from './search'
import { EmojiList } from './list'
import { emojis } from '../data/emojis'

const compareNumbers = (a, b) => {
  if (a === b) return 0
  if (a > b) return 1
  return -1
}

const filterItems = (items, query) => {
  if (query.length === 0) {
    return items
  }

  const normalizedQuery = query.trim().toLowerCase()

  return items
    .map(({ name, ...rest }) => ({ name, sorting: name.indexOf(normalizedQuery), ...rest }))
    .filter(({ sorting }) => sorting !== -1)
    .sort((a, b) => compareNumbers(a.sorting, b.sorting))
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
