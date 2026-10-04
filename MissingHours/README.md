# Jerry & the Missing Hours

A self-contained first case, **The Midnight Greenhouse**. Investigate six locations, read eleven evidence records, and establish three supported deductions to reveal a larger mystery.

Uses the shared Revision 6 Jerry model in `../shared/jerry/`. No generated replacement character or changes to the other games.

## Run

Requires Node 22+.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

`npm test` checks the deduction rules. `npm run build` produces a self-contained `dist/` with relative asset paths; `npm run preview` serves the build.

## Play

Choose a numbered scene marker or a location in the list. Jerry walks over and adds its findings to the notebook. On the deduction board, choose a claim and attach the requested number of essential records. Read buttons reopen records, and Ask Jerry supplies a hint. There is no timer or penalty. Progress is held for the current visit only; reloading restarts the case.

The game uses mouse, touch or keyboard (Tab, Enter, Space and Escape). If WebGL initialization fails, the location list remains playable. Jerry loading failures are shown visibly. Google Fonts are optional; local fallback fonts work offline. The game has no remote data service, sound or save system.

This prototype is local and is not yet included in the existing GitHub Pages workflow.
