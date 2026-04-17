'use client';

import { useState, useEffect } from 'react';

export function useEmbedMode(): boolean {
  const [embed, setEmbed] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmbed(params.get('embed') === '1');
  }, []);
  return embed;
}
