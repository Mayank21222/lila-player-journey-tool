"""Build a compact browser-friendly artifact from the supplied Parquet files."""
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
import json
import math
import shutil

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "player_data"
OUT = ROOT / "data.json"
MAPS = {
    "AmbroseValley": {"label": "Ambrose Valley", "scale": 900, "origin": [-370, -473], "image": "minimaps/AmbroseValley_Minimap.png"},
    "GrandRift": {"label": "Grand Rift", "scale": 581, "origin": [-290, -290], "image": "minimaps/GrandRift_Minimap.png"},
    "Lockdown": {"label": "Lockdown", "scale": 1000, "origin": [-500, -500], "image": "minimaps/Lockdown_Minimap.jpg"},
}
EVENTS = {"Kill", "Killed", "BotKill", "BotKilled", "KilledByStorm", "Loot"}
PATH_EVENTS = {"Position", "BotPosition"}
GRID = 56


def text(value):
    return value.decode("utf-8") if isinstance(value, bytes) else str(value)


def make_grid():
    return [[0 for _ in range(GRID)] for _ in range(GRID)]


def make_heatmap_set():
    return {"traffic": make_grid(), "kills": make_grid(), "deaths": make_grid()}


def grid_add(grid, map_name, x, z):
    cfg = MAPS[map_name]
    u = (x - cfg["origin"][0]) / cfg["scale"]
    v = (z - cfg["origin"][1]) / cfg["scale"]
    col = max(0, min(GRID - 1, int(u * GRID)))
    row = max(0, min(GRID - 1, int((1 - v) * GRID)))
    grid[row][col] += 1


def main():
    matches = {}
    heat = {name: make_heatmap_set() for name in MAPS}
    heat_by_date = {}
    totals = Counter()
    files = 0

    for day_dir in sorted(DATA_ROOT.glob("February_*")):
        if not day_dir.is_dir():
            continue
        date = day_dir.name.replace("February_", "2026-02-")
        heat_by_date.setdefault(date, {name: make_heatmap_set() for name in MAPS})
        for file in sorted(day_dir.iterdir()):
            if not file.is_file() or file.name.startswith("."):
                continue
            table = pq.read_table(file).to_pydict()
            if not table["user_id"]:
                continue
            files += 1
            user_id = text(table["user_id"][0])
            match_id = text(table["match_id"][0])
            map_id = text(table["map_id"][0])
            human = "-" in user_id
            match = matches.setdefault(match_id, {"id": match_id, "date": date, "dates": [], "map": map_id, "players": {}})
            if date not in match["dates"]:
                match["dates"].append(date)
            player = match["players"].setdefault(user_id, {"id": user_id, "human": human, "path": [], "events": []})
            for x, z, ts, raw_event in zip(table["x"], table["z"], table["ts"], table["event"]):
                event = text(raw_event)
                # Timestamps are stored as dates in 1970; only elapsed milliseconds matter.
                # Arrow may return a timezone-naive datetime. Treat telemetry timestamps
                # as UTC explicitly so builds behave identically on every machine.
                ms = int((ts.replace(tzinfo=timezone.utc) - datetime(1970, 1, 1, tzinfo=timezone.utc)).total_seconds() * 1000)
                point = [ms, round(float(x), 2), round(float(z), 2)]
                if event in PATH_EVENTS:
                    player["path"].append(point)
                    grid_add(heat[map_id]["traffic"], map_id, float(x), float(z))
                    grid_add(heat_by_date[date][map_id]["traffic"], map_id, float(x), float(z))
                    totals["traffic"] += 1
                elif event in EVENTS:
                    player["events"].append([ms, round(float(x), 2), round(float(z), 2), event])
                    totals[event] += 1
                    if event in {"Kill", "BotKill"}:
                        grid_add(heat[map_id]["kills"], map_id, float(x), float(z))
                        grid_add(heat_by_date[date][map_id]["kills"], map_id, float(x), float(z))
                    if event in {"Killed", "BotKilled", "KilledByStorm"}:
                        grid_add(heat[map_id]["deaths"], map_id, float(x), float(z))
                        grid_add(heat_by_date[date][map_id]["deaths"], map_id, float(x), float(z))

    compact_matches = []
    for match in matches.values():
        players = list(match["players"].values())
        players.sort(key=lambda p: (not p["human"], p["id"]))
        all_times = [p["path"][0][0] for p in players if p["path"]] + [e[0] for p in players for e in p["events"]]
        match["start"] = min(all_times) if all_times else 0
        match["end"] = max(all_times) if all_times else 0
        match["duration"] = max(0, match["end"] - match["start"])
        match["dates"].sort()
        match["players"] = players
        match["playerCount"] = len(players)
        match["eventCount"] = sum(len(p["events"]) for p in players)
        compact_matches.append(match)
    compact_matches.sort(key=lambda m: (m["date"], m["map"], m["id"]))

    result = {"version": 1, "maps": MAPS, "matches": compact_matches, "heatmaps": heat, "heatmapsByDate": heat_by_date, "stats": {"files": files, "matches": len(compact_matches), **totals}}
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(result, separators=(",", ":")))
    # Keep the images beside the static app so the artifact deploys as-is.
    target = ROOT / "minimaps"
    target.mkdir(exist_ok=True)
    for image in (DATA_ROOT / "minimaps").iterdir():
        if image.is_file():
            shutil.copy2(image, target / image.name)
    print(f"Built {OUT} — {len(compact_matches)} matches, {files} files, {OUT.stat().st_size / 1_000_000:.1f} MB")


if __name__ == "__main__":
    main()
