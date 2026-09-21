import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load():
    return json.loads((ROOT / "data.json").read_text())


def test_artifact_shape():
    data = load()
    assert len(data["matches"]) == 796
    assert data["stats"]["files"] == 1243
    assert set(data["maps"]) == {"AmbroseValley", "GrandRift", "Lockdown"}
    assert set(data["heatmapsByDate"]) == {"2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13", "2026-02-14"}


def test_map_projection_bounds():
    data = load()
    for match in data["matches"]:
        cfg = data["maps"][match["map"]]
        for player in match["players"]:
            for _, x, z in player["path"]:
                u = (x - cfg["origin"][0]) / cfg["scale"]
                v = (z - cfg["origin"][1]) / cfg["scale"]
                assert -0.1 <= u <= 1.1
                assert -0.1 <= v <= 1.1


def test_events_and_paths_are_separated():
    data = load()
    valid_events = {"Kill", "Killed", "BotKill", "BotKilled", "KilledByStorm", "Loot"}
    assert data["stats"]["traffic"] == 73059
    assert all(e[3] in valid_events for m in data["matches"] for p in m["players"] for e in p["events"])
