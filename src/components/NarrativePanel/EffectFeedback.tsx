/**
 * EffectFeedback — inline stacked messages showing onEnter effect consequences.
 * Auto-dismisses after 6 seconds. Respects reducedMotion.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface EffectFeedbackProps {
  messages: string[];
  reducedMotion?: boolean;
}

const DISMISS_MS = 6000;

export function EffectFeedback({ messages, reducedMotion = false }: EffectFeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length === 0) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), DISMISS_MS);
    return () => clearTimeout(id);
  }, [messages]);

  if (messages.length === 0 || !visible) return null;

  return (
    <div aria-live="polite" className="flex flex-col gap-1.5">
      <AnimatePresence>
        {messages.map((msg, i) => (
          <motion.p
            key={`${msg}-${i}`}
            role="status"
            className="pl-4 py-1.5 border-l-2 border-gaslight-amber/40 italic font-serif text-sm text-gaslight-fog/70"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: i * 0.15 }}
          >
            {msg}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
