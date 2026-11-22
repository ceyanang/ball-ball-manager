import { Component, type ReactNode } from 'react'

/** Keeps a broken screen (e.g. from a damaged save) from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel stack" role="alert" style={{ maxWidth: 560, margin: '2rem auto' }}>
        <h2>This screen couldn’t load</h2>
        <p className="muted" style={{ margin: 0 }}>The league data for this page looks damaged: {this.state.error.message}</p>
        <div className="row">
          <a className="btn btn-primary" href="#/saves" onClick={() => this.setState({ error: null })}>Go to saves</a>
          <a className="btn" href="#/" onClick={() => this.setState({ error: null })}>Back to home</a>
        </div>
      </div>
    )
  }
}
