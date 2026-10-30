"""The mathematics track's records: validation and target statuses."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

from proven import mathematics as m

ROOT = Path(__file__).resolve().parents[1]


def row(rid, kind="idea", target="T1", status="posted", who="alice", reviews=(), **extra):
    return {"id": rid, "target": target, "kind": kind, "title": f"{kind} {rid}", "status": status,
            "who": [{"name": who}], "builds_on": [], "reviews": list(reviews), "date": "2026-10-08", **extra}


class ShippedData(unittest.TestCase):
    def test_targets_and_records_validate(self):
        m.validate(m.load_targets(), m.load_records())

    def test_lean_declarations_exist_in_the_pinned_file(self):
        targets = m.load_targets()
        lean = (ROOT / targets["lean"]["file"]).read_text()
        for target in targets["targets"]:
            for name in target["lean"] + target.get("milestones", []):
                short = name.split(".", 1)[1]
                self.assertRegex(lean, rf"(?m)^def {re.escape(short)}\b", msg=name)

    def test_lean_commit_matches_the_lakefile(self):
        targets = m.load_targets()
        lakefile = (ROOT / "lean" / "lakefile.toml").read_text()
        self.assertIn(f'rev = "{targets["lean"]["commit"]}"', lakefile)

    def test_summary_lists_every_target_open_with_no_records(self):
        summary = m.summary(m.load_targets(), [], now="2026-10-08T00:00:00+00:00")
        self.assertEqual([t["id"] for t in summary["targets"]], ["T1", "T2", "T3"])
        self.assertTrue(all(t["status"] == "open" for t in summary["targets"]))


class Statuses(unittest.TestCase):
    def setUp(self):
        self.targets = m.load_targets()
        self.t1 = self.targets["targets"][0]

    def test_a_posted_proof_that_settles_is_a_claim(self):
        status = m.target_status(self.t1, [row("M-0001", "proof", settles=True)])
        self.assertEqual((status["status"], status["by"]), ("claimed", "M-0001"))
        self.assertEqual(m.target_status(self.t1, [row("M-0001", "proof")])["status"], "open")

    def test_an_accepted_proof_needs_a_holding_review_by_someone_else(self):
        self_reviewed = row("M-0001", "proof", status="accepted", reviews=[{"by": "alice", "verdict": "holds"}])
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [self_reviewed])
        reviewed = row("M-0001", "proof", status="accepted", settles=True, reviews=[{"by": "bob", "verdict": "holds"}])
        m.validate(self.targets, [reviewed])
        self.assertEqual(m.target_status(self.t1, [reviewed])["status"], "solved")

    def test_an_accepted_partial_result_leaves_the_target_open(self):
        partial = row("M-0001", "proof", status="accepted", reviews=[{"by": "bob", "verdict": "holds"}])
        m.validate(self.targets, [partial])
        self.assertEqual(m.target_status(self.t1, [partial])["status"], "open")
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [row("M-0002", "idea", settles=True)])

    def test_an_accepted_counterexample_refutes(self):
        counter = row("M-0001", "counterexample", status="accepted", settles=True,
                      reviews=[{"by": "bob", "verdict": "holds"}])
        self.assertEqual(m.target_status(self.t1, [counter])["status"], "refuted")

    def test_lean_checked_needs_a_solve_and_the_pinned_declaration(self):
        proof = row("M-0001", "proof", status="accepted", settles=True, reviews=[{"by": "bob", "verdict": "holds"}])
        lean = row("M-0002", "formalization", status="accepted", who="carol", lean="MCAChallenge.T1",
                   reviews=[{"by": "bob", "verdict": "holds"}])
        milestone = row("M-0003", "formalization", status="accepted", who="carol", lean="MCAChallenge.T1Uniform",
                        reviews=[{"by": "bob", "verdict": "holds"}])
        m.validate(self.targets, [proof, lean, milestone])
        self.assertTrue(m.target_status(self.t1, [proof, lean])["lean_checked"])
        self.assertFalse(m.target_status(self.t1, [proof, milestone])["lean_checked"])
        self.assertFalse(m.target_status(self.t1, [lean])["lean_checked"])
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [row("M-0003", "formalization", lean="MCAChallenge.Nope")])

    def test_withdrawn_rows_do_not_count(self):
        status = m.target_status(self.t1, [row("M-0001", "proof", status="withdrawn")])
        self.assertEqual(status["status"], "open")


class Validation(unittest.TestCase):
    def setUp(self):
        self.targets = m.load_targets()

    def test_count_is_a_construction_at_a_size(self):
        # A construction's count at one size reaches the site's record chart; anything else is refused.
        m.validate(self.targets, [row("M-0001", count={"n": 1024, "value": 7408})])
        for bad in ({"n": 1024}, {"n": 0, "value": 3}, {"n": 1024, "value": "7408"}, [1024, 7408]):
            with self.assertRaises(m.RecordError):
                m.validate(self.targets, [row("M-0001", count=bad)])

    def test_builds_on_must_resolve(self):
        thread, record = "bt1_" + "0a" * 12, "rgr1_" + "ab" * 32
        m.validate(self.targets, [row("M-0001", builds_on=["DKT26", thread, record]), row("M-0002", builds_on=["M-0001"])])
        for ref in ("M-0002", "Nobody99", "#7", "bt1_123", "rgr1_" + "ab" * 31):
            with self.subTest(ref=ref), self.assertRaises(m.RecordError):
                m.validate(self.targets, [row("M-0001", builds_on=[ref])])

    def test_new_rows_build_on_a_graph_record(self):
        record = "rgr1_" + "ab" * 32
        m.validate(self.targets, [row("M-0021"), row("M-0022", builds_on=[record]),
                                  row("M-0023", "source"), row("M-0024", "review", builds_on=["M-0022"])])
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [row("M-0022", builds_on=["DKT26"])])

    def test_a_row_names_the_thread_it_was_posted_in(self):
        m.validate(self.targets, [row("M-0001", thread="bt1_" + "0a" * 12)])
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [row("M-0001", thread=9)])
        summary = m.summary(self.targets, [row("M-0001", thread="bt1_" + "0a" * 12)], now="2026-10-08T00:00:00+00:00")
        self.assertEqual(summary["contributions"][0]["thread"], "bt1_" + "0a" * 12)

    def test_agents_say_who_runs_them(self):
        agent = row("M-0001")
        agent["who"] = [{"name": "some-agent", "agent": True}]
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [agent])
        agent["who"][0]["runs"] = "alice"
        m.validate(self.targets, [agent])

    def test_ids_and_kinds(self):
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [row("M-1")])
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [row("M-0001", kind="vibe")])
        with self.assertRaises(m.RecordError):
            m.validate(self.targets, [row("M-0001"), row("M-0001")])
        self.assertEqual(m.next_id([row("M-0001"), row("M-0007")]), "M-0008")


if __name__ == "__main__":
    unittest.main()


class QueueAndCredits(unittest.TestCase):
    def test_queue_states_in_the_words_the_site_shows(self):
        self.assertEqual(m.queue_state(row("M-0001"))["label"], "posted, awaiting a reviewer")
        self.assertEqual(m.queue_state(row("M-0001", count={"n": 1024, "value": 7408}))["state"], "certified")
        reading = m.queue_state(row("M-0001", reviewing=[{"by": "odinfree", "since": "2026-10-27"}]))
        self.assertEqual((reading["state"], reading["label"]), ("reviewing", "under review by odinfree since 27 Oct"))
        reviewed = m.queue_state(row("M-0001", reviews=[{"by": "bob", "verdict": "partial", "date": "2026-10-09"}]))
        self.assertEqual(reviewed["label"], "reviewed: partial, awaiting a decision")
        self.assertEqual(m.queue_state(row("M-0001", status="accepted"))["label"], "accepted")
        declined = m.queue_state(row("M-0001", status="refuted", reason="the count double-lists witnesses"))
        self.assertEqual(declined["label"], "declined: the count double-lists witnesses")

    def test_an_accepted_row_credits_authors_reviewers_and_what_it_builds_on(self):
        base = row("M-0001", "lemma", who="alice", status="accepted", reviews=[{"by": "bob (Claude Code agent): checked", "verdict": "holds"}])
        built = row("M-0002", "lemma", who="carol", status="accepted", builds_on=["M-0001"],
                    reviews=[{"by": "challenge maintainers (same operator, not independent)", "verdict": "holds"}])
        pending = row("M-0003", "lemma", who="dave", builds_on=["M-0001"])
        paid = m.credits([base, built, pending])
        self.assertEqual(paid["alice"], {"made": ["M-0001"], "reviewed": [], "built_on": ["M-0002"], "weight": 2})
        self.assertEqual(paid["bob"], {"made": [], "reviewed": ["M-0001"], "built_on": [], "weight": 1})
        self.assertEqual(paid["carol"], {"made": ["M-0002"], "reviewed": [], "built_on": [], "weight": 1})
        self.assertNotIn("dave", paid)
        self.assertNotIn("challenge", paid)
        board = m.summary(m.load_targets(), [base, built, pending], now="2026-10-29T00:00:00+00:00")
        by_id = {r["id"]: r for r in board["contributions"]}
        self.assertEqual(by_id["M-0002"]["credits"], ["alice"])
        self.assertEqual(by_id["M-0003"]["credits"], [])
        self.assertEqual(by_id["M-0003"]["queue"]["state"], "posted")
        self.assertEqual(next(p for p in board["people"] if p["name"] == "alice")["credits"]["built_on"], ["M-0002"])


class RulesV2(unittest.TestCase):
    def test_targets_carry_the_cells_caps_and_statements(self):
        t = m.load_targets()
        self.assertEqual(t["rules"]["version"], 2)
        states = {c["id"]: c["state"] for c in t["cells"]}
        self.assertEqual(states["rung0"], "refutation-only")
        self.assertEqual(states["pool32"], "closed")
        self.assertEqual(states["circle-pool"], "open")
        self.assertEqual([s["id"] for s in t["statements"]], ["aligned-or-small-residual", "circle-quadratic", "fibre-alignment"])
        self.assertIn("refuted", t["statements"][2]["title"])
        board = m.summary(t, [], now="2026-10-30T00:00:00+00:00")
        self.assertEqual([c["id"] for c in board["cells"]][:2], ["rung0", "pool32"])
        self.assertIsNone(next(b for b in board["upper_bounds"] if b["kind"] == "proven bound on E")["value"])

    def test_upper_bound_reviews_and_combinations_weigh_double(self):
        base1 = row("M-0001", "lemma", who="alice", status="accepted")
        base2 = row("M-0002", "lemma", who="bob", status="accepted")
        cap = row("M-0003", "lemma", who="carol", status="accepted", bound="upper",
                  reviews=[{"by": "dave (Claude Code agent): reran the class count", "verdict": "holds"}])
        combo = row("M-0004", "lemma", who="erin", status="accepted", builds_on=["M-0001", "M-0002"], combines=["M-0001", "M-0002"])
        paid = m.credits([base1, base2, cap, combo])
        self.assertEqual(paid["dave"]["weight"], 2)
        self.assertEqual(paid["erin"]["weight"], 2)
        self.assertEqual(paid["carol"]["weight"], 1)
        self.assertEqual(paid["alice"]["weight"], 2)   # made M-0001, built on by M-0004
        with self.assertRaises(m.RecordError):
            m.validate(m.load_targets(), [row("M-0005", "lemma", combines=["M-0001"])])
        with self.assertRaises(m.RecordError):
            m.validate(m.load_targets(), [row("M-0005", "lemma", bound="sideways")])
