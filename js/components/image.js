import { h, Component } from 'preact'

export class Image extends Component {
  constructor () {
    super()

    // noinspection EqualityComparisonWithCoercionJS
    this.state.loaded = (window.IntersectionObserver == null)
  }

  _observerCallback = (entries, observer) => {
    if (entries[0].intersectionRatio <= 0) {
      return
    }

    observer.disconnect()
    this.setState({ loaded: true })
  }

  _observe (image) {
    this._unobserve()

    if (!image || this.state.loaded) {
      return
    }

    this._observer = new IntersectionObserver(this._observerCallback, {
      threshold: 0,
    })

    this._observer.observe(image)
  }

  _unobserve () {
    if (this._observer) {
      this._observer.disconnect()
      this._observer = null
    }
  }

  componentWillUnmount () {
    this._unobserve()
  }

  render ({ src, preview, ...props }, { loaded }) {
    const _src = loaded ? src : preview

    return <img src={_src} ref={(image) => this._observe(image)} {...props} />
  }
}
