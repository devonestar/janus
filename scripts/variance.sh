#!/usr/bin/env bash
# Janus output variance measurement (addresses U-8 per Option F eval).
#
# Runs `janus eval <fixture> --samples 3` N times on identical input,
# records each run's decision_status + best_path name + rejected_paths
# to a JSONL log, then summarizes jitter.
#
# Usage:
#   scripts/variance.sh [N] [fixture]
#     N       - iterations (default 10)
#     fixture - path to markdown (default fixtures/smoke.md)
#
# Output:
#   .janus-variance/run-<ts>.jsonl  — one JSON object per iteration
#   .janus-variance/run-<ts>.summary.txt — human-readable jitter summary
#
# Gate criterion (per Janus eval of Option F):
#   jitter > 1 disagreement per 10 runs → Reviewer must pin --samples 1
#   or use --backend mock for gate decisions.

set -u

N="${1:-10}"
FIXTURE="${2:-fixtures/smoke.md}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR=".janus-variance"
LOG="$OUT_DIR/run-$TS.jsonl"
SUMMARY="$OUT_DIR/run-$TS.summary.txt"

mkdir -p "$OUT_DIR"

echo "variance: N=$N fixture=$FIXTURE log=$LOG" >&2

for i in $(seq 1 "$N"); do
  RAW_FILE="$OUT_DIR/run-$TS-iter-$i.raw.json"
  T0=$(date +%s)
  set +e
  janus eval "$FIXTURE" --samples 3 --format json >"$RAW_FILE" 2>/dev/null
  EXIT=$?
  set -e
  T1=$(date +%s)
  DUR=$((T1 - T0))

  LINE=$(EXIT=$EXIT DUR=$DUR I=$i RAW=$RAW_FILE node -e '
    const fs=require("fs");
    const i=+process.env.I, dur=+process.env.DUR, exit=+process.env.EXIT;
    let status="error", best="null", rejected="";
    try {
      const j=JSON.parse(fs.readFileSync(process.env.RAW,"utf8"));
      status=j.decision_status||"parse_error";
      best=j.best_path&&j.best_path.name?j.best_path.name:"null";
      rejected=(j.rejected_paths||[]).map(r=>r.name).sort().join("|");
    } catch(e) {
      if (exit===3) status="cli_error";
      else status="parse_error";
    }
    process.stdout.write(JSON.stringify({i,dur_s:dur,exit,status,best,rejected})+"\n");
  ')
  echo "$LINE" | tee -a "$LOG" >&2
done

echo "--- summary ---" >&2
node -e '
const fs=require("fs");
const lines=fs.readFileSync(process.argv[1],"utf8").trim().split(/\n+/).filter(Boolean);
const rows=lines.map(l=>JSON.parse(l));
const byStatus={};
for(const r of rows) byStatus[r.status]=(byStatus[r.status]||0)+1;
const byBest={};
for(const r of rows) byBest[r.best]=(byBest[r.best]||0)+1;
const byRejected={};
for(const r of rows) byRejected[r.rejected]=(byRejected[r.rejected]||0)+1;
const statuses=Object.keys(byStatus);
const bests=Object.keys(byBest);
const rejs=Object.keys(byRejected);
const out=[];
out.push(`samples: ${rows.length}`);
out.push(`decision_status agreement: ${statuses.length===1?"unanimous ("+statuses[0]+")":"split: "+JSON.stringify(byStatus)}`);
out.push(`best_path agreement:       ${bests.length===1?"unanimous":"split ("+bests.length+" distinct names): "+JSON.stringify(byBest)}`);
out.push(`rejected_paths agreement:  ${rejs.length===1?"unanimous":"split ("+rejs.length+" distinct sets): "+JSON.stringify(byRejected)}`);
out.push(`avg duration: ${(rows.reduce((a,b)=>a+b.dur_s,0)/rows.length).toFixed(1)}s`);
const disagreements=(statuses.length>1?1:0)+(bests.length>1?1:0)+(rejs.length>1?1:0);
out.push(`disagreement dimensions: ${disagreements}/3`);
out.push(`gate verdict per Janus criterion (>1 per 10 → use --samples 1 or mock):`);
out.push(`  ${disagreements>1?"FAIL — pin --samples 1 or --backend mock for Reviewer":"PASS — claude backend at --samples 3 is stable enough"}`);
console.log(out.join("\n"));
' "$LOG" | tee "$SUMMARY" >&2

echo "log: $LOG"
echo "summary: $SUMMARY"
