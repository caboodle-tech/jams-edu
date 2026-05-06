--- Previous Div-based rendering for JamsEDU fenced blocks lives in `jamsedu-blocks.archived.lua`.
--- Those blocks are stripped out of Quarto intermediate markdown before the fragment Pandoc pass and merged back in JS
--- (`#extractJamsEduBlocksFromQuartoIntermediateMarkdown` in `src/jamsedu.js`). This file stays as an empty filter so
--- existing `--lua-filter` wiring keeps working.
return {}
