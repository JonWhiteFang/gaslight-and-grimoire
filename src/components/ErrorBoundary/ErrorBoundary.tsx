import React from 'react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-200 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-serif text-amber-400 mb-4">Something went wrong</h1>
            <p className="text-stone-400 mb-6">An unexpected error occurred. Your progress has been auto-saved.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-amber-50 font-serif rounded border border-amber-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              Return to Title
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
