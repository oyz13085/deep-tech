# PalmScan — Dr. Palm Prototype

A commercial workflow prototype for targeted BSR (Basal Stem Rot) disease audit demos. Covers the full field-to-report pipeline: estate compartment mapping, drone pre-screening, TLS tree scan, deep-learning classification, and a complete audit report.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 or later |
| npm | 9 or later |

You also need a **Mapbox access token** — get one free at [mapbox.com](https://account.mapbox.com/auth/signup/).

---

## Local setup

```bash
git clone https://github.com/oyz13085/deep-tech.git
cd deep-tech/palmscan
npm install
```

Create `.env.local` in the `palmscan` folder:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Demo workflow

1. **Estate Scan** — Draw compartment boundaries on the map and run a Drone Scan to flag infected areas.
2. **TLS Scan** — Enter a flagged compartment and classify individual palms through the deep-learning pipeline.
3. **Audit Report** — View yield at risk, a live map of affected palms, and a prioritised action plan.

Scan data is stored in `localStorage` — no backend required.

---

## Deployment

Set the following environment variable in your hosting provider:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

Build command: `npm run build` | Output directory: `dist`

---

## Tech stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite 7](https://vitejs.dev)
- [Tailwind CSS 3](https://tailwindcss.com)
- [Mapbox GL JS 3](https://docs.mapbox.com/mapbox-gl-js/) + [mapbox-gl-draw](https://github.com/mapbox/mapbox-gl-draw)
- [Framer Motion](https://www.framer.com/motion/)
- [Recharts](https://recharts.org)
- [Lucide React](https://lucide.dev)
