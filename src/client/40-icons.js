    // ---------------------------------------------------------------- icons
    function IconSearch() {
      return h('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', className: 'sd-search-icon' },
        h('circle', { cx: 11, cy: 11, r: 7 }),
        h('line', { x1: 16.5, y1: 16.5, x2: 21, y2: 21 }),
      )
    }

    function IconRefresh() {
      return h('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M20 11a8 8 0 1 0-2.3 6.3' }),
        h('path', { d: 'M20 5v6h-6' }),
      )
    }

    function GuideIcon(props) {
      const size = (props && props.size) || 16
      return h('svg', { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true },
        h('rect', { x: 4, y: 4, width: 56, height: 56, rx: 14, fill: 'currentColor', opacity: 0.12 }),
        h('rect', { x: 12, y: 14, width: 16, height: 11, rx: 3, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 33, y: 14, width: 19, height: 11, rx: 3, fill: 'currentColor' }),
        h('rect', { x: 12, y: 30, width: 19, height: 11, rx: 3, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 35, y: 30, width: 17, height: 11, rx: 3, fill: 'currentColor', opacity: 0.3 }),
        h('circle', { cx: 46, cy: 47, r: 7, fill: 'none', stroke: 'currentColor', strokeWidth: 3.4 }),
      )
    }

