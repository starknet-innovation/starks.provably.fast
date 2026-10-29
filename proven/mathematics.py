"""The mathematics track: pinned targets, the record of contributions, and what the site shows.

mathematics/targets.json pins T1 to T3 (statements, Lean declarations, baselines, sources).
mathematics/records.jsonl is append-only: one row per contribution (an idea, a lemma, a
counterexample, a proof sketch, a proof, a formalization, a review of another row, or a source),
with who made it, what it builds on, and its reviews. Contributions are posted on provably.fast
(MATHEMATICS threads and the mathematics research graph); maintainers record them here, with the
thread they were posted in. A target's status follows from the rows:

- open: nothing below applies;
- claimed: a proof or counterexample row that settles the target (it claims the pinned statement,
  or its negation) is posted and not yet accepted;
- solved / refuted: such a row accepted with at least one review that holds, by someone other
  than its authors. Other accepted rows are partial progress: credited, and the target stays open;
- Lean-checked is shown beside solved: an accepted formalization row of the target's pinned Lean
  declaration (a milestone declaration does not count), with a holding review.

    python3 -m proven.mathematics check                 # validate both files
    python3 -m proven.mathematics board                 # writes results/mathematics.json
    python3 -m proven.mathematics record --target T1 --kind idea --title "..." --who NAME \\
        [--agent --runs NAME] [--thread bt1_...] [--url URL] [--builds-on DKT26,M-0002,rgr1_...] [--settles]
    python3 -m proven.mathematics review M-0003 --by NAME --verdict holds|fails|partial --url URL
    python3 -m proven.mathematics reviewing M-0003 --by NAME     # who is reading it now (the queue shows it)
    python3 -m proven.mathematics accept M-0003         # or: refute / withdraw, with --reason "..."

Every row carries a queue state the site and the thread pages show: posted (waiting for a reader),
under review by whom since when, accepted, or declined with its reason. An accepted row credits
its authors, its reviewers, and the authors of every record it builds on.

Standard library only; no network.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = ROOT / "mathematics" / "targets.json"
RECORDS = ROOT / "mathematics" / "records.jsonl"
OUT = ROOT / "results" / "mathematics.json"

KINDS = ("idea", "lemma", "counterexample", "proof-sketch", "proof", "formalization", "review", "source")
STATUSES = ("posted", "accepted", "refuted", "withdrawn")
VERDICTS = ("holds", "fails", "partial")
RECORD_ID = re.compile(r"^M-\d{4}$")
# A provably.fast thread, and a record in the mathematics research graph.
THREAD_ID = re.compile(r"^bt1_[0-9a-f]{24}$")
GRAPH_RECORD = re.compile(r"^rgr1_[0-9a-f]{64}$")


class RecordError(ValueError):
    pass


def load_targets(path: Path = TARGETS) -> dict:
    return json.loads(path.read_text())


def load_records(path: Path = RECORDS) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def authors(row: dict) -> set[str]:
    return {who["name"].lower() for who in row.get("who", [])}


def holding_review(row: dict) -> bool:
    """At least one review that holds, by someone who is not an author of the row."""
    mine = authors(row)
    return any(r.get("verdict") == "holds" and r.get("by", "").lower() not in mine
               for r in row.get("reviews", []))


def validate(targets: dict, records: list[dict]) -> None:
    ids = [t["id"] for t in targets["targets"]]
    if len(set(ids)) != len(ids):
        raise RecordError("target ids must be unique")
    known_targets = set(ids) | {"other"}
    lean_names = {name for t in targets["targets"] for name in t["lean"] + t.get("milestones", [])}
    sources = set(targets["sources"])
    for target in targets["targets"]:
        for source in target["baseline"]["sources"]:
            if source not in sources:
                raise RecordError(f"{target['id']}: unknown baseline source {source}")
    seen: set[str] = set()
    for row in records:
        rid = row.get("id", "")
        if not RECORD_ID.match(rid) or rid in seen:
            raise RecordError(f"record id {rid!r} must look like M-0001 and be unique")
        if row.get("target") not in known_targets:
            raise RecordError(f"{rid}: unknown target {row.get('target')!r}")
        if row.get("kind") not in KINDS:
            raise RecordError(f"{rid}: kind must be one of {', '.join(KINDS)}")
        if row.get("status") not in STATUSES:
            raise RecordError(f"{rid}: status must be one of {', '.join(STATUSES)}")
        if not row.get("title") or not row.get("who"):
            raise RecordError(f"{rid}: a title and at least one contributor are required")
        for who in row["who"]:
            if not who.get("name"):
                raise RecordError(f"{rid}: every contributor needs a name")
            if who.get("agent") and not who.get("runs"):
                raise RecordError(f"{rid}: an agent says who runs it")
        if row.get("thread") is not None and not THREAD_ID.match(str(row["thread"])):
            raise RecordError(f"{rid}: thread {row['thread']!r} is not a provably.fast thread id")
        for ref in row.get("builds_on", []):
            if not (ref in sources or ref in seen or THREAD_ID.match(ref) or GRAPH_RECORD.match(ref)):
                raise RecordError(f"{rid}: builds_on {ref!r} is not a source, an earlier record, a thread or a graph record")
        for review in row.get("reviews", []):
            if review.get("verdict") not in VERDICTS or not review.get("by"):
                raise RecordError(f"{rid}: a review needs a reviewer and a verdict in {', '.join(VERDICTS)}")
        count = row.get("count")
        if count is not None and not (isinstance(count, dict) and set(count) == {"n", "value"}
                                      and all(isinstance(count[k], int) and count[k] > 0 for k in ("n", "value"))):
            raise RecordError(f"{rid}: a count is {{\"n\": N, \"value\": V}}, the bad challenges a construction reaches at n = N")
        for reader in row.get("reviewing", []):
            if not reader.get("by") or not reader.get("since"):
                raise RecordError(f"{rid}: a reviewing entry names who reads it and since when")
        if row.get("reason") is not None and not isinstance(row["reason"], str):
            raise RecordError(f"{rid}: a reason is a sentence")
        if row.get("settles") and row["kind"] not in ("proof", "counterexample"):
            raise RecordError(f"{rid}: only a proof or a counterexample settles a target")
        if row["kind"] == "formalization" and row.get("lean") and row["lean"] not in lean_names:
            raise RecordError(f"{rid}: {row['lean']} is not a pinned Lean declaration")
        if row["status"] == "accepted" and row["kind"] in ("proof", "counterexample", "formalization") \
                and not holding_review(row):
            raise RecordError(f"{rid}: an accepted {row['kind']} needs a holding review by a non-author")
        seen.add(rid)


def target_status(target: dict, records: list[dict]) -> dict:
    mine = [r for r in records if r["target"] == target["id"] and r["status"] != "withdrawn"]
    settling = [r for r in mine if r.get("settles")]
    solved = [r for r in settling if r["kind"] == "proof" and r["status"] == "accepted" and holding_review(r)]
    refuted = [r for r in settling if r["kind"] == "counterexample" and r["status"] == "accepted"
               and holding_review(r)]
    lean = [r for r in mine if r["kind"] == "formalization" and r["status"] == "accepted"
            and r.get("lean") in target["lean"] and holding_review(r)]
    pending = [r for r in settling if r["status"] == "posted"]
    if solved:
        status, by = "solved", solved[0]["id"]
    elif refuted:
        status, by = "refuted", refuted[0]["id"]
    elif pending:
        status, by = "claimed", pending[0]["id"]
    else:
        status, by = "open", None
    return {"status": status, "by": by, "lean_checked": bool(lean) and status == "solved",
            "contributions": len(mine)}


def _day(iso: str | None) -> str:
    """2026-10-27 -> 27 Oct, for the queue's words."""
    if not iso:
        return ""
    try:
        return datetime.strptime(iso[:10], "%Y-%m-%d").strftime("%-d %b")
    except ValueError:
        return iso


def queue_state(row: dict) -> dict:
    """Where a row stands, in the words the site and the thread pages show."""
    if row["status"] == "accepted":
        return {"state": "accepted", "label": "accepted", "since": row.get("accepted_on") or row.get("date")}
    if row["status"] in ("refuted", "withdrawn"):
        word = "declined" if row["status"] == "refuted" else "withdrawn"
        reason = row.get("reason")
        return {"state": word, "label": f"{word}: {reason}" if reason else word, "reason": reason}
    reading = row.get("reviewing", [])
    if reading:
        names = ", ".join(r["by"] for r in reading)
        since = min(r["since"] for r in reading)
        return {"state": "reviewing", "label": f"under review by {names} since {_day(since)}", "by": [r["by"] for r in reading], "since": since}
    reviews = row.get("reviews", [])
    if reviews:
        verdicts = sorted({r.get("verdict", "") for r in reviews})
        return {"state": "reviewed", "label": "reviewed: " + ", ".join(verdicts) + ", awaiting a decision", "since": reviews[-1].get("date")}
    if row.get("count"):
        return {"state": "certified", "label": "certified count, awaiting entry", "since": row.get("date")}
    return {"state": "posted", "label": "posted, awaiting a reviewer", "since": row.get("date")}


def credits(records: list[dict]) -> dict[str, dict]:
    """What each accepted row pays out: its authors (made), its reviewers (reviewed) and the authors
    of the records it builds on (built on). By name."""
    by_id = {row["id"]: row for row in records}
    out: dict[str, dict] = {}

    def pay(name: str, kind: str, rid: str) -> None:
        bucket = out.setdefault(name, {"made": [], "reviewed": [], "built_on": []})[kind]
        if rid not in bucket:
            bucket.append(rid)

    for row in records:
        if row["status"] != "accepted":
            continue
        for who in row["who"]:
            pay(who["name"], "made", row["id"])
        for review in row.get("reviews", []):
            name = reviewer_name(review.get("by", ""))
            if name and name.lower() not in authors(row):
                pay(name, "reviewed", row["id"])
        for ref in row.get("builds_on", []):
            base = by_id.get(ref)
            if base is None or base["status"] == "withdrawn":
                continue
            for who in base["who"]:
                if who["name"].lower() not in authors(row):
                    pay(who["name"], "built_on", row["id"])
    return out


REVIEWER = re.compile(r"^([A-Za-z0-9][\w.-]*)")


def reviewer_name(by: str) -> str:
    """A review's "by" starts with the reviewer's name and may go on to say what they checked. The
    maintainers' own checks ("challenge maintainers (same operator, ...)") credit nobody."""
    if "same operator" in by.lower() or by.lower().startswith(("challenge maintainers", "provably.fast")):
        return ""
    found = REVIEWER.match(by.strip())
    return found.group(1) if found else ""


def summary(targets: dict, records: list[dict], now: str | None = None) -> dict:
    validate(targets, records)
    people: dict[str, dict] = {}
    paid = credits(records)
    for row in records:
        if row["status"] == "withdrawn":
            continue
        for who in row["who"]:
            entry = people.setdefault(who["name"], {"name": who["name"], "agent": bool(who.get("agent")),
                                                    "runs": who.get("runs"), "contributions": 0, "kinds": []})
            entry["contributions"] += 1
            if row["kind"] not in entry["kinds"]:
                entry["kinds"].append(row["kind"])
        for review in row.get("reviews", []):
            entry = people.setdefault(review["by"], {"name": review["by"], "agent": False, "runs": None,
                                                      "contributions": 0, "kinds": []})
            entry["contributions"] += 1
            if "review" not in entry["kinds"]:
                entry["kinds"].append("review")
    for name, entry in people.items():
        entry["credits"] = paid.get(name, {"made": [], "reviewed": [], "built_on": []})
    for name, credit in paid.items():
        if name not in people:
            people[name] = {"name": name, "agent": False, "runs": None, "contributions": 0, "kinds": [], "credits": credit}
    public = [{key: row.get(key) for key in ("id", "target", "kind", "title", "status", "date", "url", "thread", "builds_on", "count")}
              | {"who": [w["name"] for w in row["who"]], "reviewed": holding_review(row),
                 "reviews": [{"by": r.get("by"), "verdict": r.get("verdict")} for r in row.get("reviews", [])],
                 "queue": queue_state(row),
                 "credits": sorted({w["name"] for ref in row.get("builds_on", []) for w in next((r for r in records if r["id"] == ref), {"who": []})["who"]}
                                   - {w["name"] for w in row["who"]}) if row["status"] == "accepted" else []}
              for row in records if row["status"] != "withdrawn"]
    return {
        "schema": "proven-mathematics/0",
        "generated": now or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lean": targets["lean"],
        "targets": [{"id": t["id"], "title": t["title"], "level": t["level"], "lean": t["lean"],
                     **target_status(t, records)} for t in targets["targets"]],
        "contributions": sorted(public, key=lambda r: (r.get("date") or "", r["id"]), reverse=True),
        "people": sorted(people.values(), key=lambda p: (-p["contributions"], p["name"].lower())),
    }


def next_id(records: list[dict]) -> str:
    numbers = [int(r["id"][2:]) for r in records if RECORD_ID.match(r.get("id", ""))]
    return f"M-{max(numbers, default=0) + 1:04d}"


def append(row: dict, path: Path = RECORDS) -> None:
    with path.open("a") as handle:
        handle.write(json.dumps(row, sort_keys=True, ensure_ascii=False) + "\n")


def rewrite(records: list[dict], path: Path = RECORDS) -> None:
    path.write_text("".join(json.dumps(r, sort_keys=True, ensure_ascii=False) + "\n" for r in records))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    sub.add_parser("board")
    rec = sub.add_parser("record")
    rec.add_argument("--target", required=True)
    rec.add_argument("--kind", required=True, choices=KINDS)
    rec.add_argument("--title", required=True)
    rec.add_argument("--who", required=True, help="comma-separated names")
    rec.add_argument("--agent", action="store_true", help="the contributors are agents")
    rec.add_argument("--runs", help="who runs the agents")
    rec.add_argument("--thread", help="the provably.fast thread it was posted in (bt1_...)")
    rec.add_argument("--url")
    rec.add_argument("--lean", help="the pinned declaration a formalization proves")
    rec.add_argument("--builds-on", default="")
    rec.add_argument("--settles", action="store_true",
                     help="the row claims the target's pinned statement (a proof) or its negation")
    rev = sub.add_parser("review")
    rev.add_argument("record")
    rev.add_argument("--by", required=True)
    rev.add_argument("--verdict", required=True, choices=VERDICTS)
    rev.add_argument("--url")
    reading = sub.add_parser("reviewing", help="note who is reading a record now; the queue shows it")
    reading.add_argument("record")
    reading.add_argument("--by", required=True)
    reading.add_argument("--done", action="store_true", help="remove the reader instead")
    for name in ("accept", "refute", "withdraw"):
        decision = sub.add_parser(name)
        decision.add_argument("record")
        decision.add_argument("--reason", help="one sentence the queue shows (declined: ...)")
    args = parser.parse_args(argv)
    targets, records = load_targets(), load_records()
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        if args.command == "check":
            validate(targets, records)
            print(f"ok: {len(targets['targets'])} targets, {len(records)} records")
        elif args.command == "board":
            OUT.parent.mkdir(exist_ok=True)
            OUT.write_text(json.dumps(summary(targets, records), indent=1, ensure_ascii=False) + "\n")
            print(f"wrote {OUT.relative_to(ROOT)}")
        elif args.command == "record":
            row = {"id": next_id(records), "target": args.target, "kind": args.kind, "title": args.title,
                   "who": [{"name": n.strip(), **({"agent": True, "runs": args.runs} if args.agent else {})}
                           for n in args.who.split(",") if n.strip()],
                   "builds_on": [r.strip() for r in args.builds_on.split(",") if r.strip()],
                   "thread": args.thread, "url": args.url, "date": today, "status": "posted", "reviews": []}
            if args.lean:
                row["lean"] = args.lean
            if args.settles:
                row["settles"] = True
            validate(targets, records + [row])
            append(row)
            print(row["id"])
        elif args.command == "review":
            row = next((r for r in records if r["id"] == args.record), None)
            if row is None:
                raise RecordError(f"no record {args.record}")
            row.setdefault("reviews", []).append({"by": args.by, "verdict": args.verdict, "url": args.url, "date": today})
            validate(targets, records)
            rewrite(records)
            print(f"{args.record}: review by {args.by} ({args.verdict})")
        elif args.command == "reviewing":
            row = next((r for r in records if r["id"] == args.record), None)
            if row is None:
                raise RecordError(f"no record {args.record}")
            readers = [r for r in row.get("reviewing", []) if r["by"].lower() != args.by.lower()]
            if not args.done:
                readers.append({"by": args.by, "since": today})
            row["reviewing"] = readers
            validate(targets, records)
            rewrite(records)
            print(f"{args.record}: {queue_state(row)['label']}")
        elif args.command in ("accept", "refute", "withdraw"):
            row = next((r for r in records if r["id"] == args.record), None)
            if row is None:
                raise RecordError(f"no record {args.record}")
            row["status"] = {"accept": "accepted", "refute": "refuted", "withdraw": "withdrawn"}[args.command]
            row.pop("reviewing", None)
            if args.command == "accept":
                row["accepted_on"] = today
            if args.reason:
                row["reason"] = args.reason
            validate(targets, records)
            rewrite(records)
            print(f"{args.record}: {queue_state(row)['label']}")
    except RecordError as error:
        print(f"refused: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
