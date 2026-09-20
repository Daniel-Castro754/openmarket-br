# Open-source frontend blueprint

Status: research + first pilot  
Updated: 2026-09-20

## Goal

Adopt proven open-source frontend building blocks without turning OpenMarket BR into a generic dashboard template. Keep the product's own visual language, provenance rules and URL-reproducible research flows.

The frontend baseline before this pilot is intentionally small: Next.js 16, React 19 and React DOM. Dependencies should only be added when they replace real custom code or unlock a concrete feature.

## Decision matrix

| Area | OSS source | Decision | Why |
| --- | --- | --- | --- |
| Fundamental and macro charts | Recharts | Adopt | React-native, composable, MIT, supports React 19 |
| Screener / assets / documents tables | TanStack Table | Pilot | Headless; preserves OpenMarket styling and server-driven query state |
| Large table virtualization | TanStack Virtual | Later | Useful when row counts justify it |
| Tooltips / popovers / selects | Radix Primitives | Next | Accessible behavior without imposing visual design |
| Market price / OHLC / volume | TradingView Lightweight Charts | Later | Purpose-built financial time-series renderer |
| Resizable research workspace | react-resizable-panels | Later | Good fit for a future terminal/workstation mode |
| Dashboard patterns | Tremor Raw | Reference only | Strong examples, but Tailwind should not be introduced only for Tremor |
| Financial UI patterns | OpenBB Design System | Reference only | Useful domain patterns; do not inherit its whole stack |
| Complex macro visualizations | Apache ECharts | Conditional | Add only when Recharts becomes limiting |
| Pivot/OLAP exploration | Perspective | Not now | Powerful but too heavy for current product needs |

## Exact open-source code worth studying

### Recharts

Repository: https://github.com/recharts/recharts  
License: MIT  
Stable release researched: 3.10.1

Useful patterns:
- `www/src/docs/exampleComponents/ReferenceLine/ReferenceLineExample.tsx`
- `storybook/stories/API/cartesian/ReferenceLine.stories.tsx`
- composed line/area/bar primitives and synchronized tooltips

OpenMarket use:
- Macroeconomia sparklines
- Performance & Risk
- Indicator history
- Fundamental history
- Company comparison charts

Pilot in this branch:
- replaces hand-written macro SVG polylines with a Recharts sparkline
- replaces hand-written performance/drawdown SVG polylines with Recharts line/area charts
- adds real axes, synchronized hover, reference lines and tooltips

### TanStack Table

Repository: https://github.com/TanStack/table  
License: MIT  
React package researched: 9.2.4

Useful patterns:
- `examples/react/column-pinning/src/main.tsx`
- `examples/react/sorting/src/main.tsx`

OpenMarket use:
- Screener first
- Lists/asset tables second
- Document Hub third

Important integration rule:
OpenMarket already performs filtering, sorting and pagination in the backend and stores the research query in the URL. TanStack must be used in manual/server-driven mode; the library should own table behavior and state primitives, not duplicate business filtering in the browser.

Pilot status:
- Screener rendering migrated to TanStack Table
- server remains the source of truth for sorting, filtering and pagination
- Ticker and Empresa are pinned during horizontal scroll
- column visibility remains serializable back to the URL
- sortable headers now use TanStack sorting state/APIs
- current Data Passport links are preserved

Next capabilities:
- grouping where it improves analysis
- optional column resizing after visual validation
- TanStack Virtual only when row counts justify it

### Radix Primitives

Repository: https://github.com/radix-ui/primitives  
License: MIT

OpenBB's design system confirms a useful financial pattern built on Radix:
- `packages/ui/src/atoms/Tooltip.tsx`
- `packages/ui/src/atoms/Popover.tsx`
- `packages/ui/src/atoms/Select.tsx`

OpenMarket use:
- chart help / methodology tooltips
- column chooser popover
- Data Passport explanatory popovers
- accessible selects and dialogs

Decision:
Use Radix directly. OpenBB remains a design reference rather than a dependency.

### Tremor Raw

Repository: https://github.com/tremorlabs/tremor  
License: Apache-2.0

Useful files:
- `src/components/LineChart/LineChart.tsx`
- `src/components/SparkChart/SparkChart.tsx`
- `src/components/Card/Card.tsx`

Observation:
Tremor's current chart components are themselves built on Recharts. That supports choosing Recharts as OpenMarket's general analytical chart engine.

Decision:
Study component composition, legend, tooltip and chart-header conventions. Do not install Tremor or Tailwind solely for these components.

### TradingView Lightweight Charts

Repository: https://github.com/tradingview/lightweight-charts  
License: Apache-2.0  
Stable release researched: 5.2.1

OpenMarket use:
- persisted B3 COTAHIST price history
- eventual OHLC/candlestick data
- volume
- event markers on price charts
- crosshair-centric market analysis

Do not use it for ordinary annual fundamentals where Recharts is simpler.

License note:
If distributed in the product, preserve the Apache-2.0 obligations and the attribution/NOTICE requirements documented by the project.

### react-resizable-panels

Repository: https://github.com/bvaughn/react-resizable-panels  
Stable release researched: 4.13.1

OpenMarket use:
A future optional workstation layout such as:

```
Price / performance | Fundamentals
--------------------+--------------
Events              | Documents
```

Do not add until the individual panels are already strong on their own.

## Current OpenMarket components to migrate

### 1. Performance & Risk

Current:
- manual SVG coordinate calculation
- manual `polyline`
- no axis values
- no hover inspection

Target:
- Recharts `LineChart` for normalized price
- Recharts `AreaChart` for drawdown
- reference line at base 100 / zero drawdown
- synchronized hover
- date/value tooltip
- visible axes

Status: pilot implemented in this branch.

### 2. Macroeconomia

Current:
- manual sparkline string builder
- static SVG

Target:
- compact Recharts sparkline
- hover date/value
- maintain dense row layout

Status: pilot implemented in this branch.

### 3. Indicator history

Current:
- custom chart rendering in the indicator workspace

Target:
- reusable OpenMarket chart shell backed by Recharts
- bar/line modes
- explicit zero baseline where relevant
- methodology/source adjacent to chart
- no decorative chart cards

### 4. Financial statements

Current:
- custom horizontal bars in `components/financial-bar-chart.tsx`

Target:
- keep the useful provenance and filing metadata
- migrate rendering to a shared Recharts primitive only when negative/positive baselines, comparison and tooltip inspection add value
- do not remove provenance for a prettier graph

### 5. Screener

Current:
- custom table behavior
- server-side sorting/pagination/filtering already correct
- query and columns reproducible in URL

Target:
- TanStack Table in manual server mode
- pin Ticker and Empresa
- column visibility managed through the table model
- preserve URL serialization
- keep backend as source of truth
- add TanStack Virtual only when the universe is large enough to justify it

### 6. Company comparison

Current:
- semantic comparison table driven by Indicator Registry

Target:
- retain table as primary evidence surface
- add optional small-multiple Recharts view for a selected metric
- no automatic "winner" styling
- period and frequency always visible

### 7. Document Hub / Events

Target primitives:
- Radix Popover / Tooltip / Select for filters and explanatory controls
- TanStack Table only where tabular exploration improves navigation
- timeline remains a timeline; do not force every surface into a data grid

## Implementation order

1. Recharts pilot: Macro + Performance & Risk.
2. Review visual result and bundle impact.
3. Shared chart primitives: tooltip, axis formatting, empty/loading states.
4. Indicator history migration.
5. TanStack Table pilot in Screener, preserving backend/URL semantics. **Implemented in the stacked Screener branch.**
6. Radix primitives for column picker and provenance help.
7. Recharts small multiples in Compare.
8. Lightweight Charts for persisted market-price history.
9. Only then evaluate resizable workstation layout.

## Guardrails

- Do not install a full dashboard/template framework.
- Do not introduce Tailwind solely to consume an OSS component library.
- Prefer headless primitives.
- Keep data provenance visible.
- Keep server-side query behavior where it already exists.
- A chart must improve interpretation; tables remain primary for precise values.
- Never hide missing data by interpolation or placeholder values.
- Every new dependency must have a concrete OpenMarket use before being added.
