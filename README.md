# LILA BLACK Player Journey Observatory

Interactive map telemetry viewer for the LILA Games Product Engineer assignment. The app is a static, dependency-free browser experience backed by a generated telemetry artifact.

Live deployment: https://player-tool-gamma.vercel.app

## Run locally

Requirements: Python 3 with the pinned local tooling dependencies in `requirements-dev.txt`.

```bash
python3 -m pip install -r requirements-dev.txt
npm run build:data
npm run dev
```

Open `http://localhost:4173`.

Run the automated checks with:

```bash
python3 -m pytest -q
node --check app.js
```

GitHub Actions runs both checks on every push and pull request.

`npm run build:data` reads the supplied files in `player_data/`, decodes the binary event column, builds a compact `data.json` artifact, and copies the minimaps into `minimaps/`. The browser never needs to download or parse 1,243 separate Parquet files.

## Deploy

This is a dependency-free static site after the data artifact is generated. The current deployment is live at the URL above. To redeploy:

```bash
npm run build:data
vercel --prod
```

The generated `data.json` and `minimaps/` are deployable artifacts and should be committed with the app. The raw Parquet input can remain local or be omitted from the hosted repository.

## Product behavior

- Overview mode shows aggregated traffic, kill, or death density for the active map/date scope.
- Date-scoped heatmaps use only the selected capture date; “All dates” uses the full five-day aggregate.
- Selecting a match shows human and bot movement paths plus loot, kill, death, and storm-death markers.
- Selecting a match also enables player/bot-level filtering.
- The match control is a searchable custom combobox; map, date, player, layer, and speed controls use the same accessible custom-menu interaction.
- Playback is match-relative. The app detects the supplied compact timestamp units and presents them as real-time match seconds, so `1×` advances one displayed second per real second; `0.5×`, `2×`, and `4×` scale from that baseline.
- Movement paths are interpolated between telemetry samples for smooth playback and use high-contrast neon foreground colors distinct from the heatmap layers and event markers.
- Map navigation includes 50%–300% zoom, reset, mouse-wheel zoom, keyboard shortcuts (`+`, `-`, `0`), and pointer drag-to-pan while zoomed.
- Heatmap layers use separate visual families: yellow-green traffic, orange kills, and red deaths. Path lines and event markers are identified separately in the map legend.
- Map projection uses the README's map-specific scale/origin and each minimap's actual intrinsic dimensions.

## Data and repository scope

The hosted repository should include the application source, generated `data.json`, minimaps, tests, build script, and deployment configuration. The original assignment brief (`Product Engineer- Written Test- LILA.docx`) is intentionally excluded. Raw Parquet input remains local and is excluded from deployment and version control; it can be regenerated into the committed browser artifact with `npm run build:data`.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [INSIGHTS.md](INSIGHTS.md) for implementation decisions and analysis of the supplied telemetry.
