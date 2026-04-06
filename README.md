# README — 3D Bouquet Creator

## About the project

An interactive 3D bouquet creator embedded in the website of **Galeria Kwiatowa u Ani** flower shop (Bydgoszcz, Poland). Users compose a bouquet from 3D flower models and export the result as a QR code to bring into the shop.

Live site: https://www.galeriakwiatowauani.pl/

---

## Project structure

```
generator/
├── index.html          # Creator page
├── style.css           # Styles
└── js/
    ├── main.js         # App initialization + loading screen
    ├── config.js       # Config: flower types, scene, camera
    ├── scene.js        # Three.js scene, lighting, floor
    ├── camera.js       # Camera controls (mouse + touch)
    ├── flowers.js      # Flower management + URL / QR encoding
    ├── collision.js    # Flower placement algorithm
    ├── modelLoader.js  # GLB model loading and cache
    ├── Raycaster.js    # Raycasting, selection, 3D gizmos
    └── ui.js           # User interface
```

---

## Features

### Adding flowers
- **➕** — adds a single flower into a free spot (circle packing)
- **💐** — fills the bouquet with the selected flower type

### Flower editor (click any flower)
- **Position** — XYZ arrows for moving
- **Rotation** — XYZ rings for rotating
- **Scale** — XYZ cubes for scaling
- **Replace** — swap for a different flower type
- **Delete** — remove the flower from the scene

### QR code / shareable link
The bouquet state is encoded in the URL as a binary format with optional GZIP compression (pako library). The QR code can be saved and shown at the flower shop.

---

## Available flower types

| Name | Model |
|---|---|
| Red Rose | `rose.glb` |
| White Rose | `biala_roza.glb` |
| Tea Rose | `herbaciana_roza.glb` |
| Pink Rose | `rozowa_roza.glb` |
| Yellow Rose | `zolta_roza.glb` |
| Purple Rose | `fioletowa_roza.glb` |
| Tulip | `tulipan.glb` |
| Carnation | `gozdzik.glb` |
| Eustoma | `eustoma.glb` |
| Iris | `Irys.glb` |
| Gerbera | `Gerbera.glb` |
| Chrysanthemum | `Chryzantema.glb` |

GLB models are stored in the `generator/models/` directory.

---

## Technologies

- **Three.js r128** — 3D rendering
- **GLTFLoader** — GLB model loading (lazy-loaded via skypack CDN)
- **pako 2.1** — GZIP compression for URLs with large bouquets
- **qrcodejs** — QR code generation

---

## Placement algorithm (collision.js)

Flowers are arranged using **circle packing** to form a round bouquet shape:

1. Center — the first flower always placed at the origin
2. Concentric rings — subsequent flowers fill outward rings; the angular offset uses the golden ratio (φ ≈ 0.618) for a natural look
3. Random fallback — if rings are full, Poisson-like random sampling is used
4. Each flower is registered as a circle whose radius is derived from the model's bounding box

---

## URL format (version 2)

Each flower is binary-encoded as:

```
[flags 1B][typeIndex 1B][x 2B][z 2B]
  + optional: [y 2B] [rotX rotY rotZ × 2B each] [scaleX scaleY scaleZ × 1B each]
```

Bit flags indicate which optional fields are present (`bit0` = y, `bit1` = rotation, `bit2` = scale). The full buffer is encoded as URL-safe base64 (`-` instead of `+`, `_` instead of `/`). With more than 10 flowers, GZIP compression is applied (parameter `c=`); otherwise uncompressed (parameter `b=`).

---

## Loading from URL

The app detects `b=` or `c=` parameters in the URL and:

1. Parses which flower types are needed
2. Preloads **only those models** (saves time for large bouquets)
3. Loads remaining models in the background after 1s (available for the editor)
