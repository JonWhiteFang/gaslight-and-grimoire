import React from 'react';
import ReactDOM from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveAnnouncer } from './components/LiveAnnouncer';
import './index.css';
import { initAudioSubscription } from './store/audioSubscription';

initAudioSubscription();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Always-mounted screen-reader announcer (UI/UX Phase 1). Sits OUTSIDE
        ErrorBoundary so a caught app error can't unmount the live regions;
        components call announce() from src/announcer.ts. */}
    <LiveAnnouncer />
    <ErrorBoundary>
      {/* LazyMotion + the `m` component (F-046): the animation feature bundle
          (`domAnimation`) loads once here instead of every `motion.*` import
          pulling the full framer-motion API into the eager chunk. `strict` is
          off so a stray `motion.*` still works if one is missed. */}
      <LazyMotion features={domAnimation}>
        <App />
      </LazyMotion>
    </ErrorBoundary>
  </React.StrictMode>,
);
