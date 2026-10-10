#!/usr/bin/env bash
# Checks docs/best-practices-audit.md: one row per checklist line plus the six
# 2026-10-09 rules, a status and evidence on every row, a fix and size on every
# fail, at most 10 ranked stories each with a runnable check, and every
# file:line it cites exists. Run from the repo root. Needs no network.
# Set PWA_CHECKLIST to the vault's checklist.md to also compare the row count
# with the live checklist (default: ~/millwright-vault if present).
set -u
doc=docs/best-practices-audit.md
checklist=${PWA_CHECKLIST:-$HOME/millwright-vault/seats/builder/pwa-best-practices/checklist.md}
fail=0
bad() { echo "FAIL: $*"; fail=1; }

[ -f "$doc" ] || { echo "FAIL: $doc does not exist"; exit 1; }

# Checklist rows are | C01 | ... and the new rules | R1 | ...
crows=$(grep -cE '^\| C[0-9]{2} \|' "$doc")
rrows=$(grep -cE '^\| R[0-9] \|' "$doc")
stated=$(sed -n 's/^Checklist lines: \([0-9]*\).*/\1/p' "$doc" | head -1)
[ -n "$stated" ] || bad "the doc must state 'Checklist lines: N'"
[ "$crows" = "${stated:-x}" ] || bad "checklist rows $crows, doc says ${stated:-nothing}"
if [ -f "$checklist" ]; then
  live=$(grep -c '^\[ \]' "$checklist")
  [ "$crows" = "$live" ] || bad "checklist rows $crows, live checklist has $live"
fi
[ "$rrows" = 6 ] || bad "expected 6 rule rows (R1-R6), found $rrows"

# Every row: 5 columns, status pass|fail|n/a, non-empty evidence, fail has a size.
while IFS= read -r line; do
  line=${line//\\|/§}  # a \| inside a cell is not a column break
  id=$(echo "$line" | awk -F'|' '{gsub(/ /,"",$2); print $2}')
  status=$(echo "$line" | awk -F'|' '{gsub(/^ +| +$/,"",$4); print $4}')
  evidence=$(echo "$line" | awk -F'|' '{gsub(/^ +| +$/,"",$5); print $5}')
  fix=$(echo "$line" | awk -F'|' '{gsub(/^ +| +$/,"",$6); print $6}')
  case "$status" in pass|fail|n/a) ;; *) bad "$id: status '$status' is not pass, fail or n/a" ;; esac
  [ -n "$evidence" ] || bad "$id: no evidence"
  if [ "$status" = fail ]; then
    echo "$fix" | grep -qE '\((XS|S|M|L)\)' || bad "$id: fail row has no fix with a size (XS, S, M or L)"
  fi
done < <(grep -E '^\| (C[0-9]{2}|R[0-9]) \|' "$doc")

# Ranked stories: at most 10, each with a Check: line.
ranked=$(grep -cE '^[0-9]+\. \*\*' "$doc")
[ "$ranked" -ge 1 ] && [ "$ranked" -le 10 ] || bad "ranked list has $ranked items (need 1 to 10)"
checks=$(grep -cE "^ +Check: " "$doc")
[ "$checks" = "$ranked" ] || bad "$ranked ranked items but $checks 'Check:' lines"

# Every cited file:line (in backticks) exists.
cites=0
while IFS= read -r cite; do
  cites=$((cites + 1))
  file=${cite%%:*}
  rest=${cite#*:}
  first=${rest%%-*}
  last=${rest##*-}
  if [ ! -f "$file" ]; then bad "cite $cite: no file $file"; continue; fi
  n=$(wc -l < "$file")
  if [ "$first" -lt 1 ] || [ "$last" -gt "$((n + 1))" ] || [ "$first" -gt "$last" ]; then
    bad "cite $cite: $file has $n lines"
  fi
done < <(grep -oE '`[A-Za-z0-9_./-]+\.[A-Za-z]+:[0-9]+(-[0-9]+)?`' "$doc" | tr -d '`' | sort -u)
[ "$cites" -gt 0 ] || bad "no file:line cites found"

if [ "$fail" = 0 ]; then
  echo "OK: $crows checklist rows, $rrows rule rows, $ranked ranked stories, $cites distinct cites exist"
fi
exit "$fail"
