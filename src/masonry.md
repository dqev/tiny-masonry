# tiny-masonry - Agent Reference & API Context

Machine-readable reference for AI coding agents and LLMs.
Direct CDN URL: https://unpkg.com/tiny-masonry/masonry.md
Package: tiny-masonry (v0.0.2)
Repository: https://github.com/dqev/tiny-masonry

## Overview

tiny-masonry is a zero-dependency, ultra-lightweight JavaScript masonry grid engine.
- UMD bundle: Works in Node.js (SSR safe checks), bundlers (Vite/Webpack/ESBuild), and plain `<script>` tags.
- Coordinates: Calculates Pinterest-style column layouts positioning cards by shortest column height.
- Performance: Features native ResizeObserver, RAF debounced rendering, and built-in virtual rendering.
- Size: ~5.5 KB gzipped.

## Quick Install & CDN

```bash
npm install tiny-masonry
```

Or via CDN:
```html
<script src="https://unpkg.com/tiny-masonry/masonry.min.js"></script>
```

Agent Documentation Endpoint:
```
https://unpkg.com/tiny-masonry/masonry.md
```

## Mental Model & Architecture

1. Container:
   - Must be an HTMLElement.
   - tiny-masonry automatically sets `position: relative` on the container.
   - The container height dynamically expands to fit the tallest column.

2. Grid Items:
   - Children of the container (or elements matching `options.itemSelector`).
   - tiny-masonry positions items with `position: absolute`, `left`, `top`, and `width`.
   - Items should NOT have CSS margins. Use the `gap` option instead.
   - Avoid CSS `transition: all` on items that might fight inline transform/top/left transitions.

3. Virtual Rendering:
   - When `virtualRender: true` (default), only items within the viewport (plus `overscan` buffer) remain mounted in the DOM.
   - Off-screen items are placeholder-swapped to preserve scrolling performance with 1,000+ items.
   - Set `virtualRender: false` if items contain uncontrolled state (inputs, iframes, audio).

4. Aspect Ratio & Images:
   - Images without dimensions trigger layout recalculation once loaded.
   - Use `data-aspect-ratio="width/height"` (e.g. `data-aspect-ratio="16/9"`) on items or child images to reserve space instantly.

## Options Reference

Pass options into `Masonry.create(container, options)`:

```javascript
{
  // Gap between items in pixels (default: 12)
  gap: 16,

  // Responsive column count mapped by container min-width in pixels
  // Default: { 0: 1, 540: 2, 900: 3, 1200: 4 }
  columnsCountBreakPoints: { 0: 1, 640: 2, 1024: 3, 1440: 4 },

  // Responsive gap mapped by container min-width in pixels (optional)
  gutterBreakPoints: { 0: 8, 768: 16, 1280: 24 },

  // Array of breakpoint thresholds (alternative to columnsCountBreakPoints)
  // Default: [540, 900, 1200, 1600]
  breakpoints: [540, 900, 1200, 1600],

  // Virtual rendering for infinite lists (default: true)
  virtualRender: true,

  // Pixel buffer above and below viewport for virtual windowing (default: 800)
  overscan: 800,

  // Fallback height in pixels used before item can be measured (default: 320)
  fallbackHeight: 320,

  // Auto-detect image and video aspect ratio (default: true)
  autoDetect: true,

  // CSS selector to filter which child elements are treated as items (default: null)
  itemSelector: '.grid-item',

  // CSS transition duration for smooth card animations (default: '0.35s', 0 disables)
  transitionDuration: '0.35s',

  // Stagger delay between items in milliseconds (default: 0)
  stagger: 0,

  // Fill left to right before shortest column (default: false)
  horizontalOrder: false,

  // Left to right layout (default: true, set false for RTL)
  originLeft: true,

  // Top to bottom layout (default: true, set false for bottom-to-top)
  originTop: true,

  // Shrink container width to fit actual columns used (default: false)
  fitWidth: false,

  // Selector or element for fixed obstacles cards wrap around (default: null)
  stamp: '.stamp-banner',

  // Callback executed on each layout run (default: null)
  onLayout: (info) => {}
}
```

## HTML Data Attributes (Zero-JS Auto Init)

Add `data-masonry` to container for automatic initialization:

```html
<div data-masonry
     data-masonry-gap="16"
     data-masonry-columns="3"
     data-masonry-transition="0.3s">
  <div class="card">Card 1</div>
  <div class="card" data-masonry-span="2">Spans 2 columns</div>
  <div class="card" data-masonry-lane="0">Pinned to column 0</div>
  <div class="card" data-aspect-ratio="16/9">Card 4</div>
</div>

<script src="https://unpkg.com/tiny-masonry/masonry.min.js"></script>
```

### Supported Container Attributes:
- `data-masonry`: JSON options string or empty for defaults.
- `data-masonry-gap="16"`: Gap in px.
- `data-masonry-columns="3"`: Fixed column count.
- `data-masonry-breakpoints="600,900,1200"`: Comma separated widths.
- `data-masonry-overscan="800"`: Virtual scroll overscan in px.
- `data-masonry-transition="0.35s"`: Transition duration.
- `data-masonry-stagger="20"`: Stagger in ms.
- `data-masonry-fallback="320"`: Fallback height in px.
- `data-masonry-item-sel=".item"`: Item selector.
- `data-masonry-fit-width="true"`: Fit width flag.

### Supported Child Item Attributes:
- `data-masonry-span="2"`: Spans across multiple adjacent columns.
- `data-masonry-lane="0"`: Pinned to specific column index (0-based).
- `data-aspect-ratio="16/9"`: Explicit aspect ratio string or float.

## Public API Methods

```javascript
const grid = Masonry.create('#container', options);

// Append new items (array of HTMLElements)
grid.addItems(newElements);

// Prepend items to top
grid.prepend(newElements);

// Remove item by element reference or key
grid.removeItem(element);

// Filter items by CSS selector or boolean predicate function
grid.filter('.active');
grid.filter(el => el.dataset.category === 'art');
grid.filter(null); // Reset filter

// Sort items by attribute name or comparator function
grid.sort('data-date');
grid.sort((a, b) => Number(a.dataset.rank) - Number(b.dataset.rank));
grid.sort(null); // Reset original order

// Fixed obstacles
grid.stamp('.banner-ad');
grid.unstamp('.banner-ad');

// Manually recalculate layout (e.g. after dynamic DOM mutations)
grid.refresh(); // alias: grid.layout()

// Re-query child elements
grid.reloadItems();

// Temporarily hide or reveal elements
grid.hide(elements);
grid.reveal(elements);

// Teardown: removes listeners, observers, and restores original item styles
grid.destroy();
```

## Static Methods

```javascript
// Retrieve existing instance attached to an element
const instance = Masonry.data('#container');

// Re-run autoInit on document
Masonry.initAll();

// Pure layout computation function (useful for SSR or canvas)
const layout = Masonry.layoutMasonry(items, containerWidth, colHeights, options);
```

## Events

```javascript
// Triggered whenever grid finishes measuring and placing items
grid.on('layoutComplete', ({ colCount, colWidth, totalHeight }) => {
  console.log(`Layout ready: ${colCount} cols, height: ${totalHeight}px`);
});

// Triggered when container width changes and column count updates
grid.on('resize', ({ colCount, colWidth }) => {
  console.log(`Resized to ${colCount} columns`);
});
```

## Integration Recipes for Agents

### 1. Vanilla JavaScript Infinite Scroll Recipe

```javascript
const grid = Masonry.create('#grid', {
  gap: 16,
  columnsCountBreakPoints: { 0: 1, 600: 2, 900: 3, 1200: 4 }
});

window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
    loadMoreCards();
  }
});

function loadMoreCards() {
  const fragment = document.createDocumentFragment();
  const newCards = [];
  for (let i = 0; i < 10; i++) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.height = `${Math.floor(Math.random() * 200) + 150}px`;
    card.textContent = 'Card ' + Date.now();
    fragment.appendChild(card);
    newCards.push(card);
  }
  document.querySelector('#grid').appendChild(fragment);
  grid.addItems(newCards);
}
```

### 2. React Hook Recipe

```jsx
import { useEffect, useRef } from 'react';
import Masonry from 'tiny-masonry';

export function MasonryGrid({ children, options }) {
  const containerRef = useRef(null);
  const gridInstanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    gridInstanceRef.current = Masonry.create(containerRef.current, {
      gap: 16,
      virtualRender: false, // Recommended false in React if items hold state
      ...options
    });

    return () => {
      if (gridInstanceRef.current) {
        gridInstanceRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (gridInstanceRef.current) {
      gridInstanceRef.current.reloadItems();
      gridInstanceRef.current.refresh();
    }
  }, [children]);

  return (
    <div ref={containerRef} className="masonry-container">
      {children}
    </div>
  );
}
```

## Agent Rules & Guidelines

1. Always set `box-sizing: border-box` on cards and containers.
2. Never put CSS `margin` on masonry child cards. Use the `gap` configuration instead.
3. If cards have images loaded asynchronously, set explicit `width` and `height` attributes or use `data-aspect-ratio="16/9"` on the card to avoid layout jumps before images finish downloading.
4. When destroying and recreating grids dynamically, always call `grid.destroy()` first to remove ResizeObserver and scroll listeners.
5. In React/Vue/Svelte, set `virtualRender: false` unless handling plain stateless media items, to prevent component unmounting when scrolled out of view.

