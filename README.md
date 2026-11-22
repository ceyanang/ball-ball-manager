# Ball Ball Manager 🏀

A small basketball franchise sim that runs in your browser. It has 30 parody teams, procedurally drawn players, and a 40-game season with playoffs. There are box scores, standings, and league leaders. Everything runs on your device with plain algorithms (no AI, no server), so it's free and works offline.

## Play locally

```bash
npm install
npm run dev
```

Then open the URL it prints (it ends in `/ball-ball-manager/`).

## Tests

```bash
npm test
```

## Put it online for free (GitHub Pages)

1. In the repo on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Merge to `main` (or run the "Deploy to GitHub Pages" workflow by hand from the Actions tab).
3. The game will be at `https://<your-username>.github.io/ball-ball-manager/`.

## Install it like an app

Open the site, then:
- **Phone:** use "Add to Home Screen".
- **Desktop Chrome/Edge:** click the install icon in the address bar.

After the first load it works offline.

## Saves

Saves live in your browser. Use **Saves → Export current league** to back one up as a file, and **Import a save file** to bring it back or move it to another device.
