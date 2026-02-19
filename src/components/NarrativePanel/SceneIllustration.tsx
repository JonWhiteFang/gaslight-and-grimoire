/**
 * SceneIllustration — conditionally renders the scene illustration.
 * Req 2.4: When a Scene_Node has an associated illustration, the NarrativePanel
 * SHALL display the illustration alongside the narrative text.
 */
import React from 'react';

export interface SceneIllustrationProps {
  /** Path or URL to the illustration image. When undefined/empty, renders nothing. */
  src?: string;
  /** Alt text for the illustration */
  alt?: string;
}

export function SceneIllustration({ src, alt = 'Scene illustration' }: SceneIllustrationProps) {
  if (!src) return null;

  return (
    <figure className="mb-4 rounded overflow-hidden border border-gaslight-fog/20">
      <img
        src={src}
        alt={alt}
        className="w-full object-cover max-h-64"
        aria-label={alt}
      />
    </figure>
  );
}
