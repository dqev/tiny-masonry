(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Masonry = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_GAP = 12;
  var DEFAULT_OVERSCAN = 800;
  var DEFAULT_FALLBACK_H = 320;
  var DEFAULT_TRANSITION = '0.35s';
  var DEFAULT_STAGGER = 0;
  var DEFAULT_BREAKPOINTS = [540, 900, 1200, 1600];
  var DEFAULT_COL_MAP = { 0: 1, 540: 2, 900: 3, 1200: 4, 1600: 5 };

  var _hasDoc = typeof document !== 'undefined';
  var _hasWin = typeof window !== 'undefined';
  var _docStyle = _hasDoc && document.documentElement ? document.documentElement.style : {};
  var TRANSFORM_PROP = typeof _docStyle.transform === 'string' ? 'transform' : 'WebkitTransform';
  var TRANSITION_PROP = typeof _docStyle.transition === 'string' ? 'transition' : 'WebkitTransition';

  function EvEmitter() {
    this._events = {};
    this._onceEvents = {};
  }

  EvEmitter.prototype = {
    on: function (name, fn) {
      if (!name || !fn) return this;
      var list = this._events[name] || (this._events[name] = []);
      if (list.indexOf(fn) === -1) list.push(fn);
      return this;
    },

    once: function (name, fn) {
      if (!name || !fn) return this;
      this.on(name, fn);
      var once = this._onceEvents[name] || (this._onceEvents[name] = {});
      once[fn] = true;
      return this;
    },

    off: function (name, fn) {
      var list = this._events[name];
      if (!list) return this;
      var idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
      return this;
    },

    emit: function (name) {
      var list = this._events[name];
      if (!list || !list.length) return this;
      var args = Array.prototype.slice.call(arguments, 1);
      var once = this._onceEvents[name] || {};
      var copy = list.slice();
      for (var i = 0; i < copy.length; i++) {
        var fn = copy[i];
        if (once[fn]) {
          this.off(name, fn);
          delete once[fn];
        }
        fn.apply(this, args);
      }
      return this;
    },

    allOff: function () {
      this._events = {};
      this._onceEvents = {};
      return this;
    }
  };

  var _keyCounter = 0;

  function assignKey(el) {
    if (!el.dataset.masonryKey) {
      el.dataset.masonryKey = 'mg-' + (++_keyCounter);
    }
    return el.dataset.masonryKey;
  }

  function makeArray(obj) {
    if (!obj) return [];
    if (typeof obj === 'string') {
      return _hasDoc ? Array.prototype.slice.call(document.querySelectorAll(obj)) : [];
    }
    if (Array.isArray(obj)) return obj;
    if (typeof obj === 'object' && typeof obj.length === 'number') {
      return Array.prototype.slice.call(obj);
    }
    return [obj];
  }

  function entryBorderBoxHeight(entry) {
    return (entry.borderBoxSize && entry.borderBoxSize[0] && entry.borderBoxSize[0].blockSize) ||
           entry.target.getBoundingClientRect().height;
  }

  function getSize(el) {
    var style = _hasWin ? getComputedStyle(el) : null;
    if (!style || style.display === 'none') {
      return { width: 0, height: 0, outerWidth: 0, outerHeight: 0 };
    }

    var w = el.offsetWidth;
    var h = el.offsetHeight;
    var mL = parseFloat(style.marginLeft) || 0;
    var mR = parseFloat(style.marginRight) || 0;
    var mT = parseFloat(style.marginTop) || 0;
    var mB = parseFloat(style.marginBottom) || 0;

    return {
      width: w,
      height: h,
      outerWidth: w + mL + mR,
      outerHeight: h + mT + mB
    };
  }

  function parseMs(val) {
    if (typeof val === 'number') return val;
    var m = String(val).match(/^([\d.]+)(ms|s)?$/);
    if (!m) return 0;
    var n = parseFloat(m[1]);
    return m[2] === 's' ? n * 1000 : n;
  }

  function resolveColumns(containerWidth, breakpoints, colMap) {
    if (colMap) {
      var keys = Object.keys(colMap).map(Number).sort(function (a, b) { return a - b; });
      var cols = colMap[keys[0]] || 1;
      for (var i = 0; i < keys.length; i++) {
        if (containerWidth >= keys[i]) cols = colMap[keys[i]];
      }
      return Math.max(1, cols);
    }
    var count = 1;
    for (var j = 0; j < breakpoints.length; j++) {
      if (containerWidth >= breakpoints[j]) count++;
    }
    return count;
  }

  function resolveGap(containerWidth, gap, gutterMap) {
    if (gutterMap) {
      var keys = Object.keys(gutterMap).map(Number).sort(function (a, b) { return a - b; });
      var g = gutterMap[keys[0]] || 0;
      for (var i = 0; i < keys.length; i++) {
        if (containerWidth >= keys[i]) g = gutterMap[keys[i]];
      }
      return g;
    }
    return gap !== undefined ? gap : DEFAULT_GAP;
  }

  function detectAspectRatio(el) {
    if (!el || !el.getAttribute) return undefined;
    var attr = el.getAttribute('data-aspect-ratio');
    if (attr) {
      var r;
      if (attr.indexOf('/') !== -1) {
        var parts = attr.split('/');
        r = parseFloat(parts[0]) / parseFloat(parts[1]);
      } else {
        r = parseFloat(attr);
      }
      if (isFinite(r) && r > 0) return r;
    }
    if (el.tagName === 'IMG' && el.naturalWidth && el.naturalHeight) return el.naturalWidth / el.naturalHeight;
    if (el.tagName === 'VIDEO' && el.videoWidth && el.videoHeight) return el.videoWidth / el.videoHeight;
    return undefined;
  }

  function waitForAspectRatio(el, timeout) {
    timeout = timeout || 4000;
    return new Promise(function (resolve) {
      var ratio = detectAspectRatio(el);
      if (ratio) return resolve(ratio);

      var done = false;
      var timer;

      function finish(r) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(r);
      }

      timer = setTimeout(function () { finish(undefined); }, timeout);

      if (el.tagName === 'IMG') {
        el.addEventListener('load', function () { finish(detectAspectRatio(el)); }, { once: true });
        el.addEventListener('error', function () { finish(undefined); }, { once: true });
        if (el.complete && el.naturalWidth) finish(detectAspectRatio(el));
      } else if (el.tagName === 'VIDEO') {
        el.addEventListener('loadedmetadata', function () { finish(detectAspectRatio(el)); }, { once: true });
        el.addEventListener('error', function () { finish(undefined); }, { once: true });
        if (el.readyState >= 1) finish(detectAspectRatio(el));
      } else {
        finish(undefined);
      }
    });
  }

  function layoutMasonry(items, containerWidth, heights, opts) {
    opts = opts || {};
    var gap = resolveGap(containerWidth, opts.gap, opts.gutterMap);
    var cols = resolveColumns(containerWidth, opts.breakpoints || DEFAULT_BREAKPOINTS, opts.colMap);
    var colW = Math.max(1, (containerWidth - gap * (cols - 1)) / cols);
    var fallH = opts.fallbackH !== undefined ? opts.fallbackH : DEFAULT_FALLBACK_H;
    var hOrd = opts.horizontalOrder || false;
    var hIdx = 0;

    var ends = [];
    for (var i = 0; i < cols; i++) ends[i] = 0;

    if (opts.stamps && opts.stamps.length) {
      opts.stamps.forEach(function (s) {
        var sc = s.width ? Math.max(0, Math.min(cols - 1, Math.floor(s.left / (colW + gap)))) : 0;
        var ec = s.width ? Math.max(0, Math.min(cols - 1, Math.floor((s.left + s.width) / (colW + gap)))) : cols - 1;
        if (ec < sc) ec = sc;
        var bottom = (s.top || 0) + (s.height || 0);
        for (var c = sc; c <= ec; c++) {
          ends[c] = Math.max(ends[c], bottom + gap);
        }
      });
    }

    var placements = [];
    var lastUsedCol = 0;

    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      if (item.hidden || item.filtered || item.ignored) continue;

      var span = Math.min(item.colSpan || 1, cols);
      var col;

      if (item.lane !== undefined && item.lane < cols) {
        col = item.lane;
      } else if (hOrd) {
        col = hIdx % cols;
        var wouldOverflow = span > 1 && col + span > cols;
        col = wouldOverflow ? 0 : col;
        hIdx = col + span;
      } else {
        col = _shortestCol(ends, cols, span);
      }

      lastUsedCol = Math.max(lastUsedCol, col + span - 1);

      var height = item.aspectRatio
        ? colW * span / item.aspectRatio
        : (heights[item.key] !== undefined ? heights[item.key] : fallH);

      var x;
      if (opts.originLeft === false) {
        x = containerWidth - (col + span) * colW - col * gap;
      } else {
        x = col * (colW + gap);
      }

      var groupY = _groupY(ends, col, span);
      var y = groupY;

      for (var c = col; c < col + span; c++) {
        ends[c] = groupY + height + gap;
      }

      var xOut = opts.percentPos ? (x / containerWidth * 100) + '%' : x;
      var wOut = opts.percentPos ? ((colW * span + gap * (span - 1)) / containerWidth * 100) + '%' : (colW * span + gap * (span - 1));

      placements.push({
        item: item,
        col: col,
        span: span,
        x: xOut,
        xPx: x,
        y: y,
        width: wOut,
        widthPx: colW * span + gap * (span - 1),
        height: height
      });
    }

    var maxEnd = Math.max.apply(null, [0].concat(ends));
    var totalH = maxEnd > 0 ? maxEnd - gap : 0;
    var fitW;

    if (opts.fitWidth) {
      fitW = placements.length > 0 ? ((lastUsedCol + 1) * colW + lastUsedCol * gap) : 0;
    }

    return {
      placements: placements,
      colCount: cols,
      colWidth: colW,
      gap: gap,
      totalHeight: totalH,
      fitWidth: fitW
    };
  }

  function _shortestCol(ends, cols, span) {
    var best = 0;
    var bestY = _groupY(ends, 0, span);
    for (var c = 1; c <= cols - span; c++) {
      var y = _groupY(ends, c, span);
      if (y < bestY) {
        best = c;
        bestY = y;
      }
    }
    return best;
  }

  function _groupY(ends, col, span) {
    var max = ends[col] || 0;
    for (var c = col + 1; c < col + span; c++) {
      if ((ends[c] || 0) > max) max = ends[c];
    }
    return max;
  }

  function MasonryInstance(container, options) {
    EvEmitter.call(this);
    options = options || {};

    this._container = container;
    this._opts = options;
    this._alive = true;

    this._gap = options.gap !== undefined ? options.gap : DEFAULT_GAP;
    this._gutterMap = options.gutterBreakPoints || null;
    this._breakpoints = options.breakpoints || DEFAULT_BREAKPOINTS;
    this._colMap = options.columnsCountBreakPoints || null;
    this._fallbackH = options.fallbackHeight !== undefined ? options.fallbackHeight : DEFAULT_FALLBACK_H;
    this._overscan = options.overscan !== undefined ? options.overscan : DEFAULT_OVERSCAN;
    this._autoDetect = options.autoDetect !== false;
    this._itemSel = options.itemSelector || null;
    this._transDur = options.transitionDuration !== undefined
      ? parseMs(options.transitionDuration)
      : parseMs(DEFAULT_TRANSITION);
    this._stagger = options.stagger !== undefined ? options.stagger : DEFAULT_STAGGER;
    this._hOrd = options.horizontalOrder || false;
    this._originLeft = options.originLeft !== false;
    this._originTop = options.originTop !== false;
    this._fitWidth = options.fitWidth || false;
    this._pctPos = options.percentPosition || false;
    this._virtual = options.virtualRender !== false;

    this._hiddenStyle = options.hiddenStyle || { opacity: 0, transform: 'scale(0.001)' };
    this._visibleStyle = options.visibleStyle || { opacity: 1, transform: 'scale(1)' };

    if (typeof options.onLayout === 'function') this.on('layoutComplete', options.onLayout);

    this._items = [];
    this._heights = {};
    this._stamps = [];
    this._stampRects = [];
    this._mounted = {};
    this._filterFn = null;
    this._sortFn = null;
    this._containerW = 0;
    this._containerTop = 0;
    this._scrollY = 0;
    this._vpH = 0;
    this._rafHandle = 0;
    this._resizeTimer = 0;
    this._lastColCount = 0;

    this._containerObs = null;
    this._itemObs = null;
    this._onScroll = null;
    this._onResize = null;

    this._init();
  }

  MasonryInstance.prototype = Object.create(EvEmitter.prototype);
  MasonryInstance.prototype.constructor = MasonryInstance;

  MasonryInstance.prototype._init = function () {
    var self = this;
    var c = this._container;

    c.style.position = 'relative';
    if (!c.style.width) c.style.width = '100%';

    var children = Array.prototype.slice.call(c.children);
    children.forEach(function (el) {
      if (self._itemSel && !el.matches(self._itemSel)) return;
      self._registerElement(el, false);
    });

    if (typeof ResizeObserver !== 'undefined') {
      self._containerObs = new ResizeObserver(function () {
        self._updateContainerMetrics();
        self._scheduleRender();
      });
      self._containerObs.observe(c);

      self._itemObs = new ResizeObserver(function (entries) {
        var changed = false;
        entries.forEach(function (entry) {
          var key = entry.target && entry.target.dataset && entry.target.dataset.masonryKey;
          if (!key) return;
          var h = entryBorderBoxHeight(entry);
          if (self._heights[key] !== h) {
            self._heights[key] = h;
            changed = true;
          }
        });
        if (changed) self._scheduleRender();
      });
    }

    if (_hasWin) {
      self._onScroll = function () { self._scheduleRender(); };
      window.addEventListener('scroll', self._onScroll, { passive: true });

      self._onResize = function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () {
          self._updateContainerMetrics();
          self._scheduleRender();
        }, 100);
      };
      window.addEventListener('resize', self._onResize);
    }

    if (this._opts.stamp) {
      this.stamp(this._opts.stamp);
    }

    self._updateContainerMetrics();
    self._scrollY = _hasWin ? (window.pageYOffset || window.scrollY || 0) : 0;
    self._vpH = _hasWin ? window.innerHeight : 0;
    self._scheduleRender();
  };

  MasonryInstance.prototype._registerElement = function (el, schedule) {
    var self = this;
    var key = assignKey(el);

    if (this._itemByKey(key)) return;

    var media = (el.tagName === 'IMG' || el.tagName === 'VIDEO')
      ? el
      : (el.querySelector('img, video') || null);

    var aspectRatio;
    if (this._autoDetect && media) {
      aspectRatio = detectAspectRatio(media);
      if (!aspectRatio) {
        waitForAspectRatio(media).then(function (ratio) {
          if (!self._alive) return;
          var item = self._itemByKey(key);
          if (item && ratio && !item.aspectRatio) {
            item.aspectRatio = ratio;
            self._scheduleRender();
          }
        });
      }
    }

    var colSpan = el.dataset.masonrySpan ? parseInt(el.dataset.masonrySpan, 10) : 1;

    var item = {
      key: key,
      el: el,
      aspectRatio: aspectRatio,
      lane: el.dataset.masonryLane !== undefined
        ? parseInt(el.dataset.masonryLane, 10)
        : undefined,
      colSpan: colSpan,
      hidden: false,
      filtered: false,
      ignored: false
    };

    var initialH = 0;
    if (el.parentNode === this._container) {
      initialH = el.offsetHeight || (el.getBoundingClientRect ? el.getBoundingClientRect().height : 0);
      this._container.removeChild(el);
    } else if (el.style && el.style.height && String(el.style.height).indexOf('px') !== -1) {
      initialH = parseFloat(el.style.height) || 0;
    }
    if (initialH > 0 && !aspectRatio) {
      this._heights[key] = initialH;
    }

    this._applyStyle(el, this._visibleStyle);
    this._items.push(item);

    if (schedule !== false) this._scheduleRender();
  };

  MasonryInstance.prototype._itemByKey = function (key) {
    for (var i = 0; i < this._items.length; i++) {
      if (this._items[i].key === key) return this._items[i];
    }
    return null;
  };

  MasonryInstance.prototype._updateContainerMetrics = function () {
    var rect = this._container.getBoundingClientRect();
    this._containerW = this._container.clientWidth;
    this._containerTop = rect.top + (_hasWin ? (window.pageYOffset || window.scrollY || 0) : 0);
    this._measureStamps();
  };

  MasonryInstance.prototype._measureStamps = function () {
    var cr = this._container.getBoundingClientRect();
    this._stampRects = this._stamps.map(function (stamp) {
      var r = stamp.getBoundingClientRect();
      var sz = getSize(stamp);
      return {
        top: r.top - cr.top,
        left: r.left - cr.left,
        width: sz.outerWidth,
        height: sz.outerHeight
      };
    });
  };

  MasonryInstance.prototype._scheduleRender = function () {
    var self = this;
    if (!_hasWin) return;
    cancelAnimationFrame(self._rafHandle);
    self._rafHandle = requestAnimationFrame(function () {
      self._scrollY = window.pageYOffset || window.scrollY || 0;
      self._vpH = window.innerHeight;
      self._render();
    });
  };

  MasonryInstance.prototype._render = function () {
    if (!this._alive) return;

    if (!this._containerW) {
      this._updateContainerMetrics();
    }

    var orderedItems = this._items.slice();
    if (this._sortFn) orderedItems.sort(this._sortFn);

    var layout = layoutMasonry(orderedItems, this._containerW, this._heights, {
      gap: this._gap,
      gutterMap: this._gutterMap,
      breakpoints: this._breakpoints,
      colMap: this._colMap,
      fallbackH: this._fallbackH,
      horizontalOrder: this._hOrd,
      originLeft: this._originLeft,
      originTop: this._originTop,
      fitWidth: this._fitWidth,
      percentPos: this._pctPos,
      stamps: this._stampRects
    });

    this._container.style.height = layout.totalHeight + 'px';
    if (this._fitWidth && layout.fitWidth !== undefined) {
      this._container.style.width = layout.fitWidth + 'px';
    }

    var scrollTop = this._scrollY;
    var cTop = this._containerTop;
    var viewStart = this._virtual ? (scrollTop - cTop - this._overscan) : -Infinity;
    var viewEnd = this._virtual ? (scrollTop - cTop + this._vpH + this._overscan) : Infinity;

    var nextMounted = {};
    var self = this;

    layout.placements.forEach(function (p, idx) {
      var item = p.item;
      var key = item.key;
      var inWindow = p.y < viewEnd && (p.y + p.height) > viewStart;

      if (!inWindow) return;

      var wrapper = self._mounted[key];

      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.dataset.masonryKey = key;
        wrapper.style.position = 'absolute';
        if (self._originTop === false) {
          wrapper.style.bottom = '0';
          wrapper.style.top = '';
        } else {
          wrapper.style.top = '0';
          wrapper.style.bottom = '';
        }
        wrapper.style[self._originLeft ? 'left' : 'right'] = '0';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.overflow = 'hidden';

        if (!item.aspectRatio && self._itemObs) {
          self._itemObs.observe(wrapper);
        }

        wrapper.appendChild(item.el);
        self._container.appendChild(wrapper);

        if (self._transDur > 0) {
          self._applyStyle(item.el, self._hiddenStyle);
          item.el.offsetHeight;
          self._applyStyle(item.el, {
            transition: TRANSITION_PROP + ' ' + (self._transDur / 1000) + 's'
              + (self._stagger > 0 ? ' ' + ((idx * self._stagger) / 1000) + 's' : '')
          });
          requestAnimationFrame(function () {
            self._applyStyle(item.el, self._visibleStyle);
          });
        }
      }

      wrapper.style.width = typeof p.width === 'string' ? p.width : (p.width + 'px');
      var translateY = self._originTop === false ? (-p.y) : p.y;
      wrapper.style[TRANSFORM_PROP] = 'translate(' + p.xPx + 'px,' + translateY + 'px)';

      if (item.aspectRatio) {
        wrapper.style.height = p.height + 'px';
      }

      nextMounted[key] = wrapper;
    });

    var prevMounted = this._mounted;
    Object.keys(prevMounted).forEach(function (key) {
      if (!nextMounted[key]) {
        var wrapper = prevMounted[key];
        if (self._itemObs) self._itemObs.unobserve(wrapper);
        if (wrapper.parentNode) {
          if (self._transDur > 0) {
            self._applyStyle(wrapper, {
              transition: 'opacity ' + (self._transDur / 1000) + 's, transform ' + (self._transDur / 1000) + 's',
              opacity: '0',
              transform: wrapper.style[TRANSFORM_PROP] + ' scale(0.001)'
            });
            setTimeout(function () {
              if (wrapper.parentNode && !nextMounted[key]) {
                wrapper.parentNode.removeChild(wrapper);
              }
            }, self._transDur);
          } else {
            wrapper.parentNode.removeChild(wrapper);
          }
        }
      }
    });
    this._mounted = nextMounted;

    if (layout.colCount !== this._lastColCount) {
      this._lastColCount = layout.colCount;
      this.emit('resize', { colCount: layout.colCount, colWidth: layout.colWidth });
    }

    this.emit('layoutComplete', {
      colCount: layout.colCount,
      colWidth: layout.colWidth,
      gap: layout.gap,
      totalHeight: layout.totalHeight,
      mountedCount: Object.keys(nextMounted).length,
      totalCount: this._items.length
    });
  };

  MasonryInstance.prototype._applyStyle = function (el, styleObj) {
    for (var prop in styleObj) {
      var supported = (prop === 'transform' ? TRANSFORM_PROP : prop === 'transition' ? TRANSITION_PROP : prop);
      el.style[supported] = styleObj[prop];
    }
  };

  MasonryInstance.prototype.addItems = function (elements) {
    var self = this;
    makeArray(elements).forEach(function (el) {
      self._registerElement(el, false);
    });
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.prepend = function (elements) {
    var self = this;
    var newItems = [];
    makeArray(elements).forEach(function (el) {
      var key = assignKey(el);
      if (self._itemByKey(key)) return;

      var media = (el.tagName === 'IMG' || el.tagName === 'VIDEO')
        ? el : (el.querySelector('img, video') || null);
      var aspectRatio = self._autoDetect && media ? detectAspectRatio(media) : undefined;
      if (self._autoDetect && media && !aspectRatio) {
        waitForAspectRatio(media).then(function (ratio) {
          if (!self._alive) return;
          var item = self._itemByKey(key);
          if (item && ratio && !item.aspectRatio) {
            item.aspectRatio = ratio;
            self._scheduleRender();
          }
        });
      }

      var item = {
        key: key,
        el: el,
        aspectRatio: aspectRatio,
        lane: el.dataset.masonryLane !== undefined ? parseInt(el.dataset.masonryLane, 10) : undefined,
        colSpan: el.dataset.masonrySpan ? parseInt(el.dataset.masonrySpan, 10) : 1,
        hidden: false,
        filtered: false,
        ignored: false
      };

      var initialH = 0;
      if (el.parentNode === self._container) {
        initialH = el.offsetHeight || (el.getBoundingClientRect ? el.getBoundingClientRect().height : 0);
        self._container.removeChild(el);
      } else if (el.style && el.style.height && String(el.style.height).indexOf('px') !== -1) {
        initialH = parseFloat(el.style.height) || 0;
      }
      if (initialH > 0 && !aspectRatio) {
        self._heights[key] = initialH;
      }

      self._applyStyle(el, self._visibleStyle);
      newItems.push(item);
    });

    this._items = newItems.concat(this._items);
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.removeItem = function (elOrKey) {
    var key = typeof elOrKey === 'string'
      ? (elOrKey.indexOf('mg-') === 0 ? elOrKey : null)
      : (elOrKey && elOrKey.dataset && elOrKey.dataset.masonryKey);

    if (!key && typeof elOrKey === 'string' && _hasDoc) {
      var elem = document.querySelector(elOrKey);
      if (elem && elem.dataset && elem.dataset.masonryKey) {
        key = elem.dataset.masonryKey;
      }
    }
    if (!key) return this;

    var wrapper = this._mounted[key];
    if (wrapper) {
      if (this._itemObs) this._itemObs.unobserve(wrapper);
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      delete this._mounted[key];
    }

    this._items = this._items.filter(function (i) { return i.key !== key; });
    delete this._heights[key];
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.remove = MasonryInstance.prototype.removeItem;

  MasonryInstance.prototype.filter = function (predicate) {
    var self = this;
    var predFn = typeof predicate === 'string'
      ? function (el) { return el.matches ? el.matches(predicate) : true; }
      : predicate;

    this._filterFn = predFn;
    this._items.forEach(function (item) {
      var shouldShow = !predFn || predFn(item.el);
      item.filtered = !shouldShow;

      if (self._transDur > 0) {
        self._applyStyle(item.el, { transition: TRANSITION_PROP + ' ' + (self._transDur / 1000) + 's' });
        self._applyStyle(item.el, shouldShow ? self._visibleStyle : self._hiddenStyle);
      } else {
        item.el.style.display = shouldShow ? '' : 'none';
      }
    });
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.sort = function (comparator) {
    if (typeof comparator === 'string') {
      var attr = comparator;
      this._sortFn = function (ia, ib) {
        var va = ia.el.getAttribute(attr) || ia.el.dataset[attr] || '';
        var vb = ib.el.getAttribute(attr) || ib.el.dataset[attr] || '';
        var na = parseFloat(va);
        var nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(va).localeCompare(String(vb));
      };
    } else if (typeof comparator === 'function') {
      this._sortFn = function (ia, ib) { return comparator(ia.el, ib.el); };
    } else {
      this._sortFn = null;
    }
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.stamp = function (elems) {
    var self = this;
    makeArray(elems).forEach(function (el) {
      if (self._stamps.indexOf(el) === -1) self._stamps.push(el);
      el.style.position = 'absolute';
    });
    this._measureStamps();
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.unstamp = function (elems) {
    var self = this;
    makeArray(elems).forEach(function (el) {
      var idx = self._stamps.indexOf(el);
      if (idx !== -1) self._stamps.splice(idx, 1);
      el.style.position = '';
    });
    this._measureStamps();
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.ignore = function (el) {
    var item = this._itemByKey(assignKey(el));
    if (item) { item.ignored = true; this._scheduleRender(); }
    return this;
  };

  MasonryInstance.prototype.unignore = function (el) {
    var item = this._itemByKey(assignKey(el));
    if (item) { item.ignored = false; this._scheduleRender(); }
    return this;
  };

  MasonryInstance.prototype.refresh = function () {
    this._updateContainerMetrics();
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.layout = MasonryInstance.prototype.refresh;

  MasonryInstance.prototype.reloadItems = function () {
    var self = this;
    var children = Array.prototype.slice.call(this._container.children);
    children.forEach(function (el) {
      if (self._itemSel && !el.matches(self._itemSel)) return;
      self._registerElement(el, false);
    });
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.reveal = function (elements) {
    var self = this;
    makeArray(elements).forEach(function (el) {
      var item = self._itemByKey(el.dataset && el.dataset.masonryKey);
      if (!item) return;
      item.hidden = false;
      if (self._transDur > 0) {
        self._applyStyle(el, { transition: TRANSITION_PROP + ' ' + (self._transDur / 1000) + 's' });
        self._applyStyle(el, self._visibleStyle);
      }
    });
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.hide = function (elements) {
    var self = this;
    makeArray(elements).forEach(function (el) {
      var item = self._itemByKey(el.dataset && el.dataset.masonryKey);
      if (!item) return;
      item.hidden = true;
      if (self._transDur > 0) {
        self._applyStyle(el, { transition: TRANSITION_PROP + ' ' + (self._transDur / 1000) + 's' });
        self._applyStyle(el, self._hiddenStyle);
      }
    });
    this._scheduleRender();
    return this;
  };

  MasonryInstance.prototype.destroy = function () {
    this._alive = false;
    if (_hasWin) {
      cancelAnimationFrame(this._rafHandle);
      clearTimeout(this._resizeTimer);
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
    }

    if (this._containerObs) this._containerObs.disconnect();
    if (this._itemObs) this._itemObs.disconnect();

    this._container.style.position = '';
    this._container.style.height = '';
    this._container.style.width = '';
    delete this._container._masonryInstance;

    var self = this;
    this._items.forEach(function (item) {
      var wrapper = self._mounted[item.key];
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      if (item.el) {
        self._applyStyle(item.el, { transition: '', transform: '', opacity: '' });
        self._container.appendChild(item.el);
      }
    });

    this._mounted = {};
    this._items = [];
    this._stamps = [];
    this.allOff();
    return this;
  };

  function autoInit() {
    if (!_hasDoc) return;
    var els = document.querySelectorAll('[data-masonry]');
    Array.prototype.forEach.call(els, function (el) {
      if (el._masonryInstance) return;

      var attr = el.getAttribute('data-masonry');
      var opts = {};
      if (attr && attr.trim().charAt(0) === '{') {
        try { opts = JSON.parse(attr); } catch (e) {}
      }

      if (el.dataset.masonryGap) opts.gap = parseInt(el.dataset.masonryGap, 10);
      if (el.dataset.masonryColumns) opts.columnsCountBreakPoints = { 0: parseInt(el.dataset.masonryColumns, 10) };
      if (el.dataset.masonryBreakpoints) opts.breakpoints = el.dataset.masonryBreakpoints.split(',').map(Number);
      if (el.dataset.masonryOverscan) opts.overscan = parseInt(el.dataset.masonryOverscan, 10);
      if (el.dataset.masonryTransition) opts.transitionDuration = el.dataset.masonryTransition;
      if (el.dataset.masonryStagger) opts.stagger = parseInt(el.dataset.masonryStagger, 10);
      if (el.dataset.masonryFallback) opts.fallbackHeight = parseInt(el.dataset.masonryFallback, 10);
      if (el.dataset.masonryItemSel) opts.itemSelector = el.dataset.masonryItemSel;
      if (el.dataset.masonryFitWidth) opts.fitWidth = el.dataset.masonryFitWidth !== 'false';

      var instance = new MasonryInstance(el, opts);
      el._masonryInstance = instance;
    });
  }

  if (_hasDoc) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      setTimeout(autoInit, 0);
    }
  }

  return {
    create: function (target, opts) {
      if (!_hasDoc) throw new Error('[Masonry] DOM environment required');
      var el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) throw new Error('[Masonry] Element not found: ' + target);
      var instance = new MasonryInstance(el, opts);
      el._masonryInstance = instance;
      return instance;
    },

    data: function (target) {
      if (!_hasDoc) return undefined;
      var el = typeof target === 'string' ? document.querySelector(target) : target;
      return el && el._masonryInstance;
    },

    layoutMasonry: layoutMasonry,
    detectAspectRatio: detectAspectRatio,
    waitForAspectRatio: waitForAspectRatio,
    initAll: autoInit,
    version: '0.0.1'
  };
});
