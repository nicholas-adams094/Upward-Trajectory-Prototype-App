import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { resetDemoData } from '../data/store'

interface State {
  error: Error | null
}

/**
 * A prototype that white-screens in front of a client is worse than one that
 * admits it broke. Anything that throws during render lands here, with the one
 * button that fixes the most likely cause — a stale local store.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the portal:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-full items-center justify-center bg-plane p-6">
        <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface px-6 py-6">
          <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            This is a prototype, and it just hit an error it did not expect. Resetting the demo data
            clears anything stored in this browser and puts the portal back to its seeded state.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => { resetDemoData(); window.location.href = import.meta.env.BASE_URL }}
              className="rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-medium text-white hover:bg-indigo-700"
            >
              Reset demo data and start over
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-hairline px-3.5 py-2 text-[13.5px] font-medium text-ink hover:bg-plane"
            >
              Reload the page
            </button>
          </div>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-hairline bg-surface-2 p-3 text-[11.5px] leading-snug text-ink-2">
            {error.message}
          </pre>
        </div>
      </div>
    )
  }
}
