#!/bin/zsh
set -e
ROOT=/Users/kunal/Downloads/Agentic/Formance
SITE=$ROOT/site
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
rm -rf "$SITE"; mkdir -p "$SITE"

# 1) Download every distinct base asset (no query) -> guarantees one file per asset.
echo "[1/5] Downloading $(wc -l < /tmp/all_assets.txt | tr -d ' ') base assets..."
ok=0; fail=0
while IFS= read -r url; do
  rel="${url#https://}"
  mkdir -p "$SITE/$(dirname "$rel")"
  if [ ! -s "$SITE/$rel" ]; then
    curl -sfL --retry 3 -A "$UA" "$url" -o "$SITE/$rel" && ok=$((ok+1)) || { fail=$((fail+1)); echo "  FAIL $url"; }
  fi
done < /tmp/all_assets.txt
echo "    assets ok=$ok fail=$fail"

# 2) Copy JS animation modules (union) with host->local rewrite
echo "[2/5] Copying + rewriting animation modules (.mjs)..."
mcount=0
find "$ROOT/capture" "$ROOT/mirror" -name '*.mjs' -path '*sites*' | while read -r f; do
  rel="${f#*framerusercontent.com/}"
  dst="$SITE/framerusercontent.com/$rel"
  [ -f "$dst" ] && continue
  mkdir -p "$(dirname "$dst")"
  sed -e 's#https://framerusercontent\.com/#/framerusercontent.com/#g' \
      -e 's#https://formance\.framer\.website/#/formance.framer.website/#g' "$f" > "$dst"
done
mcount=$(find "$SITE/framerusercontent.com" -name '*.mjs' | wc -l | tr -d ' ')
echo "    modules: $mcount"

# 3) Copy Google fonts
echo "[3/5] Copying gstatic fonts..."
cp -R "$ROOT/mirror/fonts.gstatic.com" "$SITE/" 2>/dev/null || true

# 4) Copy rendered (hydrated) HTML pages with host->local rewrite
echo "[4/5] Copying + rewriting rendered HTML pages..."
find "$ROOT/capture/formance.framer.website" -name '*.html' | while read -r f; do
  rel="${f#$ROOT/capture/}"
  dst="$SITE/$rel"
  mkdir -p "$(dirname "$dst")"
  sed -e 's#https://framerusercontent\.com/#/framerusercontent.com/#g' \
      -e 's#https://formance\.framer\.website/#/formance.framer.website/#g' "$f" > "$dst"
done
hcount=$(find "$SITE/formance.framer.website" -name '*.html' | wc -l | tr -d ' ')
echo "    html pages: $hcount"

# 5) Root index -> redirect to home
cat > "$SITE/index.html" <<'HTML'
<!doctype html><meta charset=utf-8>
<title>Formance — offline archive</title>
<meta http-equiv="refresh" content="0; url=/formance.framer.website/index.html">
<a href="/formance.framer.website/index.html">Open Formance archive</a>
HTML

echo "[5/5] DONE"
echo "Total files: $(find "$SITE" -type f | wc -l | tr -d ' ')  Size: $(du -sh "$SITE" | cut -f1)"
