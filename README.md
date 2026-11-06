<p align="center">
  <img src="https://raw.githubusercontent.com/dqev/tiny-masonry/main/tiny-masonry.png" alt="tiny-masonry" width="280">
</p>

# tiny-masonry

Zero-dependency, fast, lightweight masonry grid layout library for modern browsers and Node.js.

AI Agent context: [https://unpkg.com/tiny-masonry/masonry.md](https://unpkg.com/tiny-masonry/masonry.md)

## Installation

```bash
npm install tiny-masonry
```

Or direct script tag:

```html
<script src="https://unpkg.com/tiny-masonry/masonry.min.js"></script>
```

## Quick Start

### 1. HTML Auto Init

Add `data-masonry` to your container:

```html
<div data-masonry data-masonry-gap="16" data-masonry-columns="3">
  <div>Card 1</div>
  <div>Card 2</div>
  <div>Card 3</div>
</div>

<script src="masonry.min.js"></script>
```

### 2. JavaScript API

```html
<div id="grid">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
</div>

<script src="masonry.min.js"></script>
<script>
  const grid = Masonry.create('#grid', {
    gap: 16,
    columnsCountBreakPoints: { 0: 1, 600: 2, 900: 3, 1200: 4 }
  });
</script>
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `gap` | number | 12 | Pixel gap between items |
| `columnsCountBreakPoints` | object | `{ 0: 1, 540: 2, 900: 3, 1200: 4 }` | Column count by container width |
| `gutterBreakPoints` | object | null | Gap size by container width |
| `breakpoints` | array | `[540, 900, 1200, 1600]` | Min-widths adding columns |
| `virtualRender` | boolean | true | Only keeps viewport items in DOM |
| `overscan` | number | 800 | Pixels above and below viewport |
| `fallbackHeight` | number | 320 | Height used before item measurement |
| `autoDetect` | boolean | true | Auto-detect image and video aspect ratio |
| `itemSelector` | string | null | CSS selector to filter children |
| `transitionDuration` | string/number | `'0.35s'` | CSS transition time (0 disables) |
| `stagger` | number | 0 | Stagger delay between items in ms |
| `horizontalOrder` | boolean | false | Fill left to right before shortest column |
| `originLeft` | boolean | true | false for RTL layout |
| `originTop` | boolean | true | false for bottom to top layout |
| `fitWidth` | boolean | false | Shrink container to used columns |
| `stamp` | string/element | null | Elements that cards flow around |
| `onLayout` | function | null | Callback after layout completes |

## Methods

```javascript
// Add items to the end
grid.addItems(arrayOfElements);

// Add items to the beginning
grid.prepend(arrayOfElements);

// Remove item by element or selector
grid.removeItem(element);

// Filter items (by function or selector)
grid.filter('.active');
grid.filter(el => el.dataset.category === 'news');
grid.filter(null); // reset

// Sort items (by attribute or comparator)
grid.sort('data-order');
grid.sort((a, b) => a.dataset.rank - b.dataset.rank);
grid.sort(null); // reset

// Fixed obstacle elements
grid.stamp('.banner');
grid.unstamp('.banner');

// Refresh layout
grid.refresh();

// Destroy instance and restore DOM
grid.destroy();
```

## Events

```javascript
grid.on('layoutComplete', (info) => {
  console.log(info.colCount, info.totalHeight);
});

grid.on('resize', (info) => {
  console.log(info.colCount);
});
```

## Item HTML Attributes

- `data-masonry-span="2"`: Item spans multiple columns.
- `data-masonry-lane="0"`: Pin item to a specific 0-indexed column.
- `data-aspect-ratio="16/9"`: Set explicit aspect ratio to prevent layout shifts.

## License

MIT
