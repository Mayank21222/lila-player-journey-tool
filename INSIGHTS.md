# Gameplay insights

These observations are computed from all 89,104 event rows in the supplied five-day package (1,243 source journey files; 1,242 unique player/match combinations because one match is split across two date folders).

## 1. Ambrose Valley is the dominant level-design surface

**Evidence:** 837 of 1,243 player-journey files are from Ambrose Valley (67.3%), compared with 295 Lockdown and 111 Grand Rift. It also contains 48,754 movement rows; the exact event counts are preserved in the generated artifact.

**Action:** Prioritize Ambrose Valley for route readability, traffic-flow checks, and heatmap-driven iteration. A level designer changing its lanes or extraction approach is likely to affect the largest share of observed journeys.

**Why it matters:** A representative dashboard should default to this map while still making the smaller maps easy to compare.

## 2. Looting is a major movement-context signal

**Evidence:** There are 12,885 `Loot` events, far more than the 45 human/bot kill events visible in the raw event taxonomy. Loot locations therefore provide a denser proxy for points of interest and player intent than combat markers alone.

**Action:** Compare loot clusters against traffic and storm-death cells. If a high-loot area has low through-traffic, improve approach routes or sightline readability; if it is over-concentrated, redistribute rewards and measure whether traffic spreads.

**Why it matters:** Combat-only analysis would miss most of the navigational story in this dataset.

## 3. Bot combat dominates the recorded combat signal

**Evidence:** The dataset contains 2,415 `BotKill` and 700 `BotKilled` events, but only 3 `Kill` and 3 `Killed` events. That is 99.8% of kill-side combat records involving bots.

**Action:** Keep human-vs-bot combat visually distinct in future analyses and avoid interpreting the kill heatmap as a pure PvP danger map. Level designers should inspect whether bot encounters are intentional pressure or accidental funneling.

**Why it matters:** Treating every kill as equivalent would lead to incorrect conclusions about player-versus-player hotspots and map balance.
