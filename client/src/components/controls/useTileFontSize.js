// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { useState, useEffect } from 'react';
import apiClient from '../../api/client';

const FONT_SIZE_MAP = {
  xs: '10px',
  sm: '12px',
  md: '14px',
  lg: '16px'
};

// Module-level cache to avoid redundant API calls across multiple tiles
let cachedFontSize = null;
let fetchPromise = null;

export function useTileFontSize() {
  const [fontSize, setFontSize] = useState(cachedFontSize || FONT_SIZE_MAP.sm);

  useEffect(() => {
    if (cachedFontSize) return;

    if (!fetchPromise) {
      fetchPromise = apiClient.getSetting('tile_font_size')
        .then(res => {
          const key = res?.value || 'sm';
          const size = FONT_SIZE_MAP[key] || FONT_SIZE_MAP.sm;
          cachedFontSize = size;
          return size;
        })
        .catch(() => {
          cachedFontSize = FONT_SIZE_MAP.sm;
          return FONT_SIZE_MAP.sm;
        });
    }

    fetchPromise.then(size => setFontSize(size));
  }, []);

  return fontSize;
}

export default useTileFontSize;
