#!/usr/bin/env bash
# Zet de handleiding om naar public/handleiding.pdf (Chrome doet het zetwerk: webfonts,
# achtergronden en @page). Daarna de PDF committen; ze wordt mee uitgerold.
set -euo pipefail
MAP="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$MAP/../../public/handleiding.pdf" "file://$MAP/handleiding.html" 2>/dev/null
ls -la "$MAP/../../public/handleiding.pdf"
