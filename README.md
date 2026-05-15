# Ganoderma Sentinel — Dr. Palm Prototype

A commercial workflow prototype for targeted BSR (Basal Stem Rot) disease audit demos. Covers the full field-to-report pipeline: estate compartment mapping, drone pre-screening, TLS tree scan, UM IP deep-learning classification, and a complete audit report.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 or later |
| npm | 9 or later |

> Check your versions: `node -v` and `npm -v`

You also need a **Mapbox access token**. Get one free at [mapbox.com](https://account.mapbox.com/auth/signup/).

---

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/oyz13085/deep-tech.git
cd deep-tech/palmscan
```

**2. Install dependencies**

```bash
npm install
```

**3. Add your Mapbox token**

Create a file named `.env.local` in the `palmscan` folder:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

Replace `pk.your_token_here` with your actual Mapbox public token.

**4. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Demo workflow

The app guides you through a fixed pitch flow:

1. **Estate Scan** — Draw compartment boundaries on the map, run a Drone Scan to flag infected areas, then enter a flagged compartment and run a Tree Scan to classify individual palms through the UM IP pipeline.

2. **Complete Audit Report** — After the Tree Scan finishes, the report unlocks. It shows yield at risk, a live map of affected palms, and a prioritised action plan.

All scan data is stored in your browser's `localStorage` — no backend required.

---

## Build for production

```bash
npm run build
```

Output goes to the `dist/` folder. Serve it with any static host (Netlify, Vercel, GitHub Pages, etc.).

---

## Tech stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite 7](https://vitejs.dev) — dev server and bundler
- [Tailwind CSS 3](https://tailwindcss.com) — utility-first styling
- [Mapbox GL JS 3](https://docs.mapbox.com/mapbox-gl-js/) + [@mapbox/mapbox-gl-draw](https://github.com/mapbox/mapbox-gl-draw) — interactive maps
- [Framer Motion](https://www.framer.com/motion/) — animations
- [Recharts](https://recharts.org) — classification pie chart
- [Lucide React](https://lucide.dev) — icons
- [Figtree](https://fonts.google.com/specimen/Figtree) — typeface (Google Fonts)
