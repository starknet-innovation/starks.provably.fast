"""The mathematics track: pinned targets, the record of contributions, and what the site shows.

mathematics/targets.json pins T1 to T3 (statements, Lean declarations, baselines, sources).
mathematics/records.jsonl is append-only: one row per contribution (an idea, a lemma, a
counterexample, a proof sketch, a proof, a formalization, a review of another row, or a source),
with who made it, its own graph lead (`lead`), what it builds on, and its reviews. Contributions are posted on provably.fast
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
        [--agent --runs NAME] [--thread bt1_...] [--url URL] --builds-on rgr1_...[,DKT26,M-0002] [--settles]
    python3 -m proven.mathematics review M-0003 --by NAME --verdict holds|fails|partial --url URL
    python3 -m proven.mathematics reviewing M-0003 --by NAME     # who is reading it now (the queue shows it)
    python3 -m proven.mathematics accept M-0003         # or: refute / withdraw, with --reason "..."
    python3 -m proven.mathematics leads --graph graph.json --since 2026-11-02 [--profiles profiles.json]

Every row carries a queue state the site and the thread pages show: posted (waiting for a reader),
under review by whom since when, accepted, or declined with its reason.

Points: an accepted row pays its authors by what it advances (ADVANCES), its reviewers a fifth of
that and the authors of the records it builds on another fifth; a posted row shows the same points
as pending. `record` and `accept` take --advances and --bonus. The board writes every line to
results/mathematics.json (points.ledger); certified counts are added live on the site.

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
# From this row on, a contribution builds on at least one graph record, so every result on the board
# is on the graph too. Earlier rows predate the rule; a source or a review has no lead of its own.
GRAPH_REQUIRED_FROM = 22
# Points, from 3 November 2026: what an accepted row pays its authors, by what it advances. A row that
# settles a target or proves a ranked statement 1,000; one that refutes a ranked statement 500; a
# port of a ranked statement 150; an upper bound, or a count above a posted one, 100; any other
# result 50. Its outside reviewers (three at most) share a fifth of it, and so do the authors of the
# accepted records it builds on. A review that finds the error in a declined row pays 50. The week's
# contribution counts double and a Lean-checked proof one and a half times; so does nothing else.
ADVANCES = {"statement": 1000, "refutes": 500, "port": 150, "upper": 100, "breaks": 100, "result": 50}
BONUSES = {"week": 2.0, "lean": 1.5}
SHARE = 0.2
ERROR_FOUND = 50
# Counts are certified on the bulletin, not recorded here, so the site adds them live: raising a
# listed cell's best known count at n >= 256 pays 25, once per cell, person and day; any other count
# (a repeat, a copy, a closed cell, rung 0 below 16 n) pays nothing.
COUNT_RAISE, COUNT_MIN_N = 25, 256


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
        if row.get("lead") is not None and not GRAPH_RECORD.match(str(row["lead"])):
            raise RecordError(f"{rid}: lead {row['lead']!r} is not a graph record (rgr1_...)")
        if int(rid[2:]) >= GRAPH_REQUIRED_FROM and row["kind"] not in ("source", "review") \
                and not row.get("lead") and not any(GRAPH_RECORD.match(ref) for ref in row.get("builds_on", [])):
            raise RecordError(f"{rid}: no lead and builds_on names no graph record (rgr1_...); propose its lead first")
        for review in row.get("reviews", []):
            if review.get("verdict") not in VERDICTS or not review.get("by"):
                raise RecordError(f"{rid}: a review needs a reviewer and a verdict in {', '.join(VERDICTS)}")
        count = row.get("count")
        if count is not None and not (isinstance(count, dict) and set(count) == {"n", "value"}
                                      and all(isinstance(count[k], int) and count[k] > 0 for k in ("n", "value"))):
            raise RecordError(f"{rid}: a count is {{\"n\": N, \"value\": V}}, the bad challenges a construction reaches at n = N")
        if row.get("bound") is not None and row["bound"] not in ("upper", "lower"):
            raise RecordError(f"{rid}: bound is upper or lower")
        for ref in row.get("combines", []):
            if ref not in row.get("builds_on", []):
                raise RecordError(f"{rid}: combines {ref!r} must also be in builds_on")
        for reader in row.get("reviewing", []):
            if not reader.get("by") or not reader.get("since"):
                raise RecordError(f"{rid}: a reviewing entry names who reads it and since when")
        if row.get("reason") is not None and not isinstance(row["reason"], str):
            raise RecordError(f"{rid}: a reason is a sentence")
        if row.get("advances") is not None and row["advances"] not in ADVANCES:
            raise RecordError(f"{rid}: advances is one of {', '.join(ADVANCES)}")
        if not set(row.get("bonus", [])) <= set(BONUSES):
            raise RecordError(f"{rid}: a bonus is one of {', '.join(BONUSES)}")
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


def row_points(row: dict, rules: dict | None = None) -> tuple[int, str]:
    """What a row pays its authors when accepted, and the rule that says so."""
    rule = "statement" if row.get("settles") else row.get("advances") or ("upper" if row.get("bound") == "upper" else "result")
    value = float(ADVANCES[rule])
    for bonus in row.get("bonus", []):
        value *= BONUSES[bonus]
    # Rules v2: a row that combines two or more earlier records counts double.
    if len(row.get("combines", [])) >= 2:
        value *= (rules or {}).get("combination_bonus", 2)
    return round(value), rule


def ledger(records: list[dict], rules: dict | None = None) -> list[dict]:
    """Every point the record pays, a line each: who, how many, by which rule, for which row, when,
    and whether it is still pending (the row is posted and not yet accepted)."""
    by_id = {row["id"]: row for row in records}
    lines: list[dict] = []

    def pay(name: str, points: float, rule: str, row: dict, when: str | None, pending: bool, of: str | None = None) -> None:
        if points >= 1:
            lines.append({"who": name, "points": round(points), "rule": rule, "row": row["id"],
                          **({"of": of} if of else {}), **({"lean": True} if "lean" in row.get("bonus", []) else {}), "date": when, "pending": pending})

    for row in records:
        if row["status"] == "withdrawn" or row["kind"] == "source":
            continue
        if row["status"] == "refuted":
            for review in row.get("reviews", []):
                name = reviewer_name(review.get("by", ""))
                if review.get("verdict") == "fails" and name and name.lower() not in authors(row):
                    pay(name, ERROR_FOUND, "error", row, review.get("date") or row.get("date"), False)
            continue
        value, rule = row_points(row, rules)
        pending = row["status"] != "accepted"
        when = row.get("accepted_on") or row.get("date") if not pending else row.get("date")
        names = [w["name"] for w in row["who"]]
        for name in names:
            pay(name, value / len(names), rule, row, when, pending)
        # Outside reviews (holds or partial, three at most) share a fifth: half of it at once while the
        # row waits, since reviewing is the bottleneck, and all of it once the row is accepted.
        reviews = [r for r in row.get("reviews", []) if r.get("verdict") in ("holds", "partial")]
        reviewers = [name for name in dict.fromkeys(reviewer_name(r.get("by", "")) for r in reviews) if name and name.lower() not in authors(row)][:3]
        for name in reviewers:
            amount = SHARE * value / len(reviewers)
            if pending:
                posted = next((r.get("date") for r in reviews if reviewer_name(r.get("by", "")) == name), None) or when
                pay(name, amount / 2, "review", row, posted, False)
                pay(name, amount / 2, "review", row, when, True)
            else:
                pay(name, amount, "review", row, when, False)
        cited = [by_id[ref] for ref in row.get("builds_on", []) if ref in by_id and by_id[ref]["status"] == "accepted"]
        for base in cited:
            heirs = [w["name"] for w in base["who"] if w["name"].lower() not in authors(row)]
            for name in heirs:
                pay(name, SHARE * value / len(cited) / len(heirs), "built_on", row, when, pending, of=base["id"])
    return lines


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
    lines = ledger(records, targets.get("rules"))
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
    for line in lines:
        entry = people.setdefault(line["who"], {"name": line["who"], "agent": False, "runs": None, "contributions": 0, "kinds": []})
        points = entry.setdefault("points", {"total": 0, "pending": 0})
        points["pending" if line["pending"] else "total"] += line["points"]
    for entry in people.values():
        entry.setdefault("points", {"total": 0, "pending": 0})
    public = [{key: row.get(key) for key in ("id", "target", "kind", "title", "status", "date", "url", "thread", "lead", "builds_on", "count", "bound", "combines", "bonus")}
              | {"who": [w["name"] for w in row["who"]], "reviewed": holding_review(row),
                 "points": row_points(row, targets.get("rules"))[0], "advances": row_points(row, targets.get("rules"))[1],
                 "reviews": [{"by": r.get("by"), "verdict": r.get("verdict")} for r in row.get("reviews", [])],
                 "queue": queue_state(row),
                 "credits": sorted({w["name"] for ref in row.get("builds_on", []) for w in next((r for r in records if r["id"] == ref), {"who": []})["who"]}
                                   - {w["name"] for w in row["who"]}) if row["status"] == "accepted" else []}
              for row in records if row["status"] != "withdrawn"]
    return {
        "schema": "proven-mathematics/0",
        "generated": now or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lean": targets["lean"],
        # Rules v2: the cells and their record rules, the posted caps, and the statements to prove.
        "rules": targets.get("rules"), "cells": targets.get("cells", []),
        "upper_bounds": targets.get("upper_bounds", []), "statements": targets.get("statements", []),
        "targets": [{"id": t["id"], "title": t["title"], "level": t["level"], "lean": t["lean"],
                     **target_status(t, records)} for t in targets["targets"]],
        "contributions": sorted(public, key=lambda r: (r.get("date") or "", r["id"]), reverse=True),
        "people": sorted(people.values(), key=lambda p: (-p["contributions"], p["name"].lower())),
        "points": {"advances": ADVANCES, "bonuses": BONUSES, "share": SHARE, "error_found": ERROR_FOUND,
                   "count_raise": COUNT_RAISE, "count_min_n": COUNT_MIN_N, "ledger": lines},
    }


def next_id(records: list[dict]) -> str:
    numbers = [int(r["id"][2:]) for r in records if RECORD_ID.match(r.get("id", ""))]
    return f"M-{max(numbers, default=0) + 1:04d}"


def append(row: dict, path: Path = RECORDS) -> None:
    with path.open("a") as handle:
        handle.write(json.dumps(row, sort_keys=True, ensure_ascii=False) + "\n")


def rewrite(records: list[dict], path: Path = RECORDS) -> None:
    path.write_text("".join(json.dumps(r, sort_keys=True, ensure_ascii=False) + "\n" for r in records))


def lead_rows(records: list[dict], leads: list[dict], since: str, logins: dict[str, str] | None = None) -> list[dict]:
    """A posted row for every graph LEAD since `since` that no row names (as its lead or in builds_on),
    its target, kind and bound read from its title. `leads` are the graph route's records; `logins`
    maps a graph contributor (github-..., hosted-agent-...) to a login."""
    known = {ref for row in records for ref in row.get("builds_on", [])} | {row["lead"] for row in records if row.get("lead")}
    number = max((int(row["id"][2:]) for row in records), default=0)
    out: list[dict] = []
    for lead in sorted(leads, key=lambda r: r.get("created_at", "")):
        if lead.get("record_type") != "LEAD" or lead["record_id"] in known or str(lead.get("created_at", ""))[:10] < since:
            continue
        title = str(lead.get("title", "")).strip()
        who = (lead.get("author") or {}).get("contributor", "")
        if not title or not who:
            continue
        number += 1
        row = {"id": f"M-{number:04d}", "target": lead_target(title), "kind": lead_kind(title), "title": title,
               "who": [{"name": (logins or {}).get(who, who)}], "lead": lead["record_id"],
               "builds_on": [p["record_id"] for p in lead.get("parents", []) if GRAPH_RECORD.match(str(p.get("record_id", "")))],
               "thread": None, "url": None, "date": str(lead["created_at"])[:10], "status": "posted", "reviews": []}
        bound = lead_bound(title)
        if bound:
            row["bound"] = bound
        out.append(row)
    return out


def lead_target(title: str) -> str:
    found = re.match(r"^(T[123])(/T[123])?\b", title)
    if found:
        return "T3" if found.group(2) else found.group(1)
    for target, words in (("T3", r"\bT3\b|Circle|rung|level-16|nonaligned"), ("T2", r"\bT2\b"), ("T1", r"\bT1\b")):
        if re.search(words, title):
            return target
    return "other"


def lead_kind(title: str) -> str:
    low = title.lower()
    if "review" in low or "reproduction" in low:
        return "review"
    if "formalization" in low or "kernel-checked" in low or low.startswith("lean"):
        return "formalization"
    if "counterexample" in low or "refute" in low:
        return "counterexample"
    if re.search(r"negative|experiment|data point|data for|note:|model:|application|screen|reading|census", low) \
            and not re.search(r"lemma|theorem|bound", low):
        return "idea"
    return "lemma"


def lead_bound(title: str) -> str | None:
    low = title.lower()
    if "upper bound" in low or " cap" in low or "capped" in low or "ceiling" in low:
        return "upper"
    if "lower bound" in low or "counts" in low or "construction" in low or "nonaligned" in low or "bad challenges" in low:
        return "lower"
    return None


def classify(row: dict, args: argparse.Namespace) -> None:
    """--advances and --bonus, when given, say what a row is worth."""
    if getattr(args, "advances", None):
        row["advances"] = args.advances
    bonus = [b.strip() for b in (getattr(args, "bonus", "") or "").split(",") if b.strip()]
    if bonus:
        row["bonus"] = bonus


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
    rec.add_argument("--lead", help="the row's own graph record (rgr1_...)")
    rec.add_argument("--builds-on", default="")
    rec.add_argument("--settles", action="store_true",
                     help="the row claims the target's pinned statement (a proof) or its negation")
    rec.add_argument("--bound", choices=("upper", "lower"), help="rules v2: which bound the row moves")
    rec.add_argument("--combines", default="", help="rules v2: the earlier records (also in --builds-on) it combines")
    for command in (rec,):
        command.add_argument("--advances", choices=tuple(ADVANCES), help="what it advances, for its points")
        command.add_argument("--bonus", default="", help=f"comma-separated: {', '.join(BONUSES)}")
    rev = sub.add_parser("review")
    rev.add_argument("record")
    rev.add_argument("--by", required=True)
    rev.add_argument("--verdict", required=True, choices=VERDICTS)
    rev.add_argument("--url")
    reading = sub.add_parser("reviewing", help="note who is reading a record now; the queue shows it")
    reading.add_argument("record")
    reading.add_argument("--by", required=True)
    reading.add_argument("--done", action="store_true", help="remove the reader instead")
    leads = sub.add_parser("leads", help="append a posted row for every graph lead since a date that no row names")
    leads.add_argument("--graph", required=True, help="the graph route's records, a JSON array or one record per line")
    leads.add_argument("--since", required=True, help="YYYY-MM-DD")
    leads.add_argument("--profiles", help="the profiles route's JSON, to name people by login")
    for name in ("accept", "refute", "withdraw"):
        decision = sub.add_parser(name)
        decision.add_argument("record")
        decision.add_argument("--reason", help="one sentence the queue shows (declined: ...)")
        if name == "accept":
            decision.add_argument("--advances", choices=tuple(ADVANCES), help="what it advances, for its points")
            decision.add_argument("--bonus", default="", help=f"comma-separated: {', '.join(BONUSES)}")
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
            if args.lead:
                row["lead"] = args.lead
            if args.settles:
                row["settles"] = True
            if args.bound:
                row["bound"] = args.bound
            if args.combines.strip():
                row["combines"] = [r.strip() for r in args.combines.split(",") if r.strip()]
            classify(row, args)
            validate(targets, records + [row])
            append(row)
            print(row["id"])
        elif args.command == "leads":
            text = Path(args.graph).read_text()
            graph = json.loads(text) if text.lstrip().startswith("[") else [json.loads(line) for line in text.splitlines() if line.strip()]
            logins: dict[str, str] = {}
            if args.profiles:
                for identity in json.loads(Path(args.profiles).read_text()).get("identities", []):
                    for actor in identity.get("actor_ids", []) + [identity.get("bulletin_actor")]:
                        if actor and identity.get("login"):
                            logins[actor] = identity["login"]
            rows = lead_rows(records, graph, args.since, logins)
            validate(targets, records + rows)
            for row in rows:
                append(row)
            print(f"{len(rows)} rows appended" + (": " + ", ".join(r["id"] for r in rows) if rows else ""))
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
                classify(row, args)
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
