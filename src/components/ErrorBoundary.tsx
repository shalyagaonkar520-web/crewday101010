import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/layout/Logo'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last line of defence. A render crash anywhere below shows a recoverable
 * screen instead of a white page — the one failure mode that loses a user for
 * good.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept as a console error so it surfaces in whatever monitoring is wired up.
    console.error('CrewDay crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-50 px-6 text-center">
        <Logo />
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Something went wrong</h1>
          <p className="mt-2 max-w-sm text-ink-500">
            The app hit an unexpected error. Reloading usually sorts it out.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()}>Reload CrewDay</Button>
          <Button
            variant="outline"
            onClick={() => {
              this.setState({ error: null })
              window.location.assign('/home')
            }}
          >
            Go home
          </Button>
        </div>
        {import.meta.env.DEV ? (
          <pre className="max-w-lg overflow-auto rounded-xl bg-ink-900 p-4 text-left text-xs text-ink-100">
            {this.state.error.message}
          </pre>
        ) : null}
      </div>
    )
  }
}
