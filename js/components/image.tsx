import { Component } from 'preact'

type State = { loaded: boolean }

export type ImageProps = { src: string, preview: string, [key: string]: any }

export class Image extends Component<ImageProps, State> {
  private _observer: IntersectionObserver|null

  state = { loaded: window.IntersectionObserver == null }

  _observerCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
    if (entries[0].intersectionRatio <= 0) {
      return
    }

    observer.disconnect()
    this.setState({ loaded: true })
  }

  _observe (image: HTMLImageElement) {
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

    return <img src={_src} ref={(image: HTMLImageElement) => this._observe(image)} {...props} />
  }
}
