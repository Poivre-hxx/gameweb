# Sprites Directory

This directory contains sprite images for game elements.

## Requirements

- **Format**: PNG
- **Size**: 32x32 pixels (square)
- **Naming**: Use lowercase with underscores, e.g., `ground.png`, `player.png`

## Usage

Add the `sprite` field to your mapping in `map.json`:

```json
"mapping": {
  "B": {
    "name": "ground",
    "sprite": "/sprites/ground.png",
    "color": "#c84c0c",
    "collision": "fixed",
    "layer": "terrain"
  }
}
```

If the sprite file doesn't exist or fails to load, the game will fall back to rendering a colored rectangle using the `color` field.
