# Architecture

## What was built and why

The tool is a static HTML/CSS/JavaScript application backed by a small Python preprocessing script. This keeps the deployed experience fast and easy to share: the browser downloads one compact JSON artifact, while Parquet remains the authoritative source used during the build. Canvas is used for paths, markers, and heatmaps because it can draw tens of thousands of points without creating a large DOM tree. No runtime framework, server, database, or secret is required.

## Data flow

`player_data/February_*/**` → `scripts/build_data.py` → `data.json` + `minimaps/*` → browser filters → Canvas overlay.

The build groups rows by `match_id` and player, decodes `event` bytes, keeps movement paths and discrete events separately, and pre-aggregates three 56×56 heatmap grids per map and per date. The UI only draws the selected match's paths/events; overview mode uses the date-aware precomputed grid. The generated artifact currently contains 796 matches, 1,243 source files, 1,242 player/match journeys, 89,104 rows, and 73,059 movement points.

## Coordinate mapping

For every `(x, z)` point, the app calculates:

```text
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * image_width
pixel_y = (1 - v) * image_height
```

The README describes a conceptual 1024×1024 map, but the supplied assets are 4320×4320, 2160×2158, and 9000×9000. The implementation uses each asset's actual displayed dimensions, preserving correct alignment without distortion.

## Assumptions

- A UUID-shaped `user_id` is human; a numeric ID is a bot, matching the dataset README.
- `x` and `z` are the 2D map axes; `y` is elevation and is intentionally not plotted.
- Match-relative playback starts at the earliest event in that match. The 1970 timestamp date component is not meaningful. Because the supplied compact timestamp ranges are sub-10,000 source units, the browser maps those units to seconds for a usable real-time playback axis; otherwise it would render a multi-minute match as a fraction of a second.
- `BotKill`/`BotKilled` are included in kill/death overlays even though they describe human–bot combat.

## Trade-offs

| Decision | Choice | Reason |
|---|---|---|
| Data loading | Build-time JSON | Faster first interaction and no client-side Parquet dependency |
| Rendering | Canvas overlay | Efficient paths/markers and simple layering over native map images |
| Heatmap | 56×56 pre-aggregation | Small payload with useful spatial signal |
| Interaction controls | Custom combobox menus | Consistent keyboard/focus/selection behavior across browsers |
| Playback | `requestAnimationFrame` plus elapsed-time scaling | Exact speed multipliers and smooth interpolated paths |
| Map navigation | CSS transform with pointer capture | Zoom, wheel zoom, and bounded drag-to-pan without changing coordinates |
| Deployment | Static hosting | No server, database, or runtime secrets required |

## Visual layers

The Canvas is composited above the minimap image in this order:

1. The active heatmap grid: yellow-green traffic, orange kills, or red deaths.
2. Foreground movement paths: neon cyan human paths and electric blue bot paths, each with a dark separation stroke and glow.
3. Discrete event markers: orange kills, red deaths, magenta storm deaths, and purple loot.

This separation keeps route geometry readable even when a path crosses a dense heatmap region.

## Interaction model

Filters update the active scope together and reset invalid dependent selections. Selecting exactly one match reveals its playback timeline and player options; overview mode deliberately leaves playback disabled. Custom menus close on outside click or Escape. When the map is zoomed above 100%, pointer capture keeps drag-to-pan stable, and panning is bounded so the map cannot be lost outside the viewport.


