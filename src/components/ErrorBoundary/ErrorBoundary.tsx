import React from 'react';
import { SaveManager } from '../../engine/saveManager';

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
      // Only reassure the player about an autosave when one actually exists.
      // In Manual save mode no autosave slot is ever written, so the old
      // unconditional "auto-saved" line was a false promise (#57).
      const hasAutosave = SaveManager.listSaves().some((s) => s.id === 'autosave');
      return (
        <div className="min-h-screen bg-stone-950 text-stone-200 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-serif text-amber-400 mb-4">Something went wrong</h1>
            <p className="text-stone-400 mb-6">
              An unexpected error occurred.
              {hasAutosave
                ? ' Your progress has been auto-saved.'
                : ' Any unsaved progress may be lost.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-amber-50 font-serif rounded border border-amber-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
