#!/usr/bin/env bash
set -euo pipefail

release="$(pwd -P)"
case "$release" in
  /var/www/releases/north-*) ;;
  *) echo "Run inside a North release directory"; exit 1 ;;
esac

corepack enable
pnpm install --frozen-lockfile
VITE_API_URL=https://api.blackpolar.org pnpm build
test -f dist/index.html

sudo -n mkdir -p /var/www/north
previous="$(readlink -f /var/www/north/current 2>/dev/null || true)"
sudo -n ln -sfn "$release/dist" /var/www/north/current.next
sudo -n mv -Tf /var/www/north/current.next /var/www/north/current

response_file="$(mktemp)"
curl --fail --silent --max-time 10 https://north.blackpolar.org/ --output "$response_file"
grep -Fq '<title>North — Black Polar</title>' "$response_file" || {
  rm -f "$response_file"
  case "$previous" in
    /var/www/releases/north-*/dist)
      sudo -n ln -sfn "$previous" /var/www/north/current.next
      sudo -n mv -Tf /var/www/north/current.next /var/www/north/current
      ;;
  esac
  echo "North was published, but the public host did not return the NORTH build. Check DNS, TLS, and nginx."
  exit 1
}
rm -f "$response_file"

echo "North is live at https://north.blackpolar.org"
