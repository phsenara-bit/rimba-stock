#!/usr/bin/env bash
# Deploy Rimba Stock: build → tes → push GitHub → clasp push + deploy → audit.
# Butuh sekali setup:
#   1) ~/.ssh/id_ed25519_rimba terdaftar sebagai Deploy Key (write) di repo
#   2) `clasp login` sudah dijalankan (token di ~/.clasprc.json)
#   3) .clasp.json berisi scriptId
set -euo pipefail

cd "$(dirname "$0")"

DEPLOYMENT_ID="AKfycbzBz8xPOywwBcj00C5qYlPCl23p_0WiS9oNDXybzu4RiaOrByhcWmXj8o3eHnlXzZlA"
GAS_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"
SRC_GAS="${1:-build/source/google-apps-script-sync.js}"
STAMP="$(date +%Y-%m-%d\ %H:%M)"

say() { printf '\n=== %s\n' "$*"; }

say "1/5 build Code.gs dari sumber user"
python3 build/build_codegs.py "$SRC_GAS"

say "2/5 tes"
for t in test_gate_v4 test_fetch_shim test-monthly-sheets test-add-item-stock; do
  printf '%-26s ' "$t"
  node "security-tools/${t}.js" | tail -1
done
printf '%-26s ' "test_ai"
node security-tools/test_ai.js | tail -1

say "3/5 push GitHub"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git -c user.name="Hermes" -c user.email="hermes@local" \
      commit -q -m "deploy: ${STAMP}"
fi
if git remote get-url origin | grep -q '^https://'; then
  git remote set-url origin git@github.com:phsenara-bit/rimba-stock.git
fi
git push -q origin main
echo "repo ter-push: $(git log --oneline -1)"

say "4/5 clasp push + deploy versi baru (URL tetap)"
[ -f .clasp.json ] || { echo "GAGAL: .clasp.json belum ada (scriptId)"; exit 1; }
clasp push --force
clasp deploy --deploymentId "$DEPLOYMENT_ID" -d "auto ${STAMP}"
echo "deployment: $DEPLOYMENT_ID"

say "5/5 audit permukaan publik"
FAIL=0
check() { # label, url-suffix, harusnya-unauthorized(1)/online(0)
  local label="$1" suffix="$2" expect="$3" out
  out="$(curl -s -L --max-time 25 "${GAS_URL}${suffix}")"
  if [ "$expect" = "1" ]; then
    if echo "$out" | grep -q 'UNAUTHORIZED'; then printf 'PASS  %s\n' "$label"
    else printf 'FAIL  %s → %s\n' "$label" "$(echo "$out" | head -c 120)"; FAIL=1; fi
  else
    if echo "$out" | grep -q '"status":"online"'; then printf 'PASS  %s\n' "$label"
    else printf 'FAIL  %s → %s\n' "$label" "$(echo "$out" | head -c 120)"; FAIL=1; fi
  fi
}

check "ping publik"            ""                            0
check "readUsers"              "?action=readUsers"           1
check "getUsers"               "?action=getUsers"            1
check "readSheetData"          "?action=readSheetData"       1
check "getItems"               "?action=getItems"            1
check "syncMonthlyData"        "?action=syncMonthlyData"     1
check "inspectSheets"          "?action=inspectSheets"       1
check "debugSheets"            "?action=debugSheets"         1
check "askAI tanpa sesi"       "?action=askAI&q=tes"         1

say "selesai"
if [ "$FAIL" -ne 0 ]; then
  echo "ADA ROUTE YANG MASIH TERBUKA — jangan dilaporkan selesai."
  exit 2
fi
echo "Semua route publik sesuai AUDIT-V4.md."