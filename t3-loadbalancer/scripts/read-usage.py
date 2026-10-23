#!/usr/bin/env python3 -I
"""Print the latest Claude 5-hour / weekly usage per T3 provider instance as JSON.

Source: T3 writes every Claude `rate_limit_event` to
~/.t3/userdata/logs/provider/events.*.log. Each line is
`[<UTC ISO ts>] NTIVE: {json}`; the instance id is inside providerSessionId
(`provider-instance:<id>:`). `utilization` is a 0-1 fraction USED.

Usage: read-usage.py [--hours N]   (default: look back 12h)
"""
import datetime, glob, json, os, re, sys, time

hours = float(sys.argv[sys.argv.index("--hours") + 1]) if "--hours" in sys.argv else 12
now = time.time()
latest = {}  # instance -> {window: (ts, utilization, resetsAt, status, overage)}
for path in glob.glob(os.path.expanduser("~/.t3/userdata/logs/provider/events.*.log")):
    if os.path.getmtime(path) < now - hours * 3600:
        continue
    with open(path, errors="ignore") as fh:
        for line in fh:
            if "rate_limit_event" not in line:
                continue
            m = re.match(r"\[(\d{4}-\d\d-\d\dT[\d:.]+Z)\]\s*(.*)", line)
            if not m:
                continue
            try:
                d = json.loads(m.group(2)[m.group(2).find("{"):])
                info = d["event"]["payload"]["rate_limit_info"]
            except Exception:
                continue
            inst = re.search(r"provider-instance:([^:]+):", d.get("providerSessionId", ""))
            if not inst:
                continue
            for name, w in (info.get("unifiedWindows") or {}).items():
                if "utilization" not in w:
                    continue
                cur = latest.setdefault(inst.group(1), {}).get(name)
                if cur is None or m.group(1) > cur[0]:
                    latest[inst.group(1)][name] = (
                        m.group(1), w["utilization"], w.get("resetsAt"),
                        info.get("status"), info.get("isUsingOverage"),
                    )

out = {"now": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "instances": {}}
for inst, wins in latest.items():
    rec = {}
    for name, (ts, util, resets, status, overage) in wins.items():
        reset_passed = bool(resets) and resets < now
        age = now - datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
        rec[name] = {
            # a window that has already reset is back to ~0% used
            "remaining_pct": 100.0 if reset_passed else round((1 - util) * 100, 1),
            "reading_used_pct": round(util * 100, 1),
            "resets_at_local": datetime.datetime.fromtimestamp(resets).strftime("%Y-%m-%d %H:%M") if resets else None,
            "reset_passed": reset_passed,
            "reading_age_min": round(age / 60, 1),
            "status": status,
            "is_using_overage": overage,
        }
    out["instances"][inst] = rec
print(json.dumps(out, indent=2))
