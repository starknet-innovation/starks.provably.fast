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


class LeadPostTests(unittest.TestCase):
    def test_lead_rows_link_the_post_by_the_rows_author(self):
        lead = {"record_id": "rgr1_" + "a" * 64, "record_type": "LEAD", "title": "T3 lemma: x", "created_at": "2026-11-07T00:00:00Z",
                "author": {"contributor": "github-1"}, "parents": []}
        posts = {lead["record_id"]: [{"post_id": "bp1_" + "b" * 24, "thread_id": "bt1_" + "c" * 24, "login": "someone"},
                                     {"post_id": "bp1_" + "d" * 24, "thread_id": "bt1_" + "e" * 24, "login": "alice"}]}
        rows = m.lead_rows([], [lead], "2026-11-01", {"github-1": "alice"}, posts)
        self.assertEqual(rows[0]["thread"], "bt1_" + "e" * 24)
        self.assertTrue(rows[0]["url"].endswith("#bp1_" + "d" * 24))
        self.assertIsNone(m.lead_rows([], [lead], "2026-11-01", {"github-1": "alice"}, None)[0]["thread"])



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

    def test_a_row_may_name_its_own_lead(self):
        lead = "rgr1_" + "a" * 64
        m.validate(m.load_targets(), [row("M-0030", "lemma", lead=lead)])
        board = m.summary(m.load_targets(), [row("M-0030", "lemma", lead=lead)], now="2026-11-02T00:00:00+00:00")
        self.assertEqual(board["contributions"][0]["lead"], lead)
        with self.assertRaises(m.RecordError):
            m.validate(m.load_targets(), [row("M-0030", "lemma", lead="bt1_000000000000000000000001")])

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

    def test_an_accepted_row_pays_authors_reviewers_and_what_it_builds_on(self):
        base = row("M-0001", "lemma", who="alice", status="accepted", reviews=[{"by": "bob (Claude Code agent): checked", "verdict": "holds"}])
        built = row("M-0002", "lemma", who="carol", status="accepted", builds_on=["M-0001"], bound="upper",
                    reviews=[{"by": "challenge maintainers (same operator, not independent)", "verdict": "holds"}])
        pending = row("M-0003", "lemma", who="dave", builds_on=["M-0001"])
        lines = m.ledger([base, built, pending])
        paid = {(l["who"], l["rule"], l["row"]): (l["points"], l["pending"]) for l in lines}
        self.assertEqual(paid[("alice", "result", "M-0001")], (50, False))
        self.assertEqual(paid[("bob", "review", "M-0001")], (10, False))       # a fifth of 50
        self.assertEqual(paid[("carol", "upper", "M-0002")], (100, False))
        self.assertEqual(paid[("alice", "built_on", "M-0002")], (20, False))   # a fifth of 100
        self.assertEqual(paid[("dave", "result", "M-0003")], (50, True))       # posted: pending
        self.assertEqual(paid[("alice", "built_on", "M-0003")], (10, True))
        self.assertFalse(any(l["who"].startswith("challenge") for l in lines), "the maintainers' own checks pay nobody")
        board = m.summary(m.load_targets(), [base, built, pending], now="2026-10-29T00:00:00+00:00")
        by_id = {r["id"]: r for r in board["contributions"]}
        self.assertEqual((by_id["M-0002"]["points"], by_id["M-0002"]["advances"]), (100, "upper"))
        self.assertEqual(by_id["M-0002"]["credits"], ["alice"])
        self.assertEqual(by_id["M-0003"]["queue"]["state"], "posted")
        alice = next(p for p in board["people"] if p["name"] == "alice")
        self.assertEqual(alice["points"], {"total": 70, "pending": 10})
        self.assertEqual(board["points"]["advances"]["statement"], 1000)
        self.assertEqual(len(board["points"]["ledger"]), len(lines))

    def test_a_review_of_a_waiting_row_pays_half_at_once(self):
        waiting = row("M-0004", "lemma", who="erin", bound="upper", reviews=[{"by": "frank (outside operator): replayed the census", "verdict": "partial", "date": "2026-11-01"}])
        lines = [(l["who"], l["points"], l["pending"], l["date"]) for l in m.ledger([waiting]) if l["rule"] == "review"]
        self.assertEqual(lines, [("frank", 10, False, "2026-11-01"), ("frank", 10, True, "2026-10-08")])

    def test_graph_leads_become_posted_rows(self):
        lead = lambda n, title, who="github-1", parents=(), at="2026-11-02T10:00:00Z": {"record_id": "rgr1_" + str(n) * 64, "record_type": "LEAD", "title": title,
            "author": {"contributor": who}, "parents": [{"record_id": p} for p in parents], "created_at": at}
        records = [row("M-0001", "lemma", lead="rgr1_" + "1" * 64)]
        rows = m.lead_rows(records, [lead(1, "already recorded"), lead(2, "T3 upper bound: a cap on the lift", parents=["rgr1_" + "1" * 64]),
                                     lead(3, "T1/T3 review: replayed four files", who="github-2"), lead(4, "old", at="2026-10-01T00:00:00Z"),
                                     lead(5, "T2 negative: a search finds nothing")], "2026-11-01", {"github-1": "alice"})
        self.assertEqual([(r["id"], r["target"], r["kind"], r.get("bound"), r["who"][0]["name"], r["builds_on"]) for r in rows],
                         [("M-0002", "T3", "lemma", "upper", "alice", ["rgr1_" + "1" * 64]), ("M-0003", "T3", "review", None, "github-2", []),
                          ("M-0004", "T2", "idea", None, "alice", [])])
        m.validate(m.load_targets(), records + rows)

    def test_what_a_row_advances_sets_its_points(self):
        self.assertEqual(m.row_points(row("M-0001", "proof", settles=True)), (1000, "statement"))
        self.assertEqual(m.row_points(row("M-0001", "counterexample", advances="refutes")), (500, "refutes"))
        self.assertEqual(m.row_points(row("M-0001", "lemma", advances="port", bonus=["week"])), (300, "port"))
        self.assertEqual(m.row_points(row("M-0001", "formalization", advances="port", bonus=["lean"])), (225, "port"))
        # A declined row pays only the review that found its error.
        declined = row("M-0002", "lemma", who="erin", status="refuted", reviews=[{"by": "frank: found the gap", "verdict": "fails", "date": "2026-10-09"}])
        self.assertEqual([(l["who"], l["points"], l["rule"]) for l in m.ledger([declined])], [("frank", 50, "error")])
        with self.assertRaises(m.RecordError):
            m.validate(m.load_targets(), [row("M-0001", "lemma", advances="everything")])
        with self.assertRaises(m.RecordError):
            m.validate(m.load_targets(), [row("M-0001", "lemma", bonus=["friday"])])


class RulesV2(unittest.TestCase):
    def test_targets_carry_the_cells_caps_and_statements(self):
        t = m.load_targets()
        self.assertEqual(t["rules"]["version"], 6.3)
        self.assertEqual(t["rules"]["scoring"]["since_sequence"], 6821)
        self.assertEqual(len(t["rules"]["claim_board"]), 36)
        self.assertEqual([p["id"] for p in t["rules"]["problems"]], ["problem-1-n32-ceiling", "problem-2-lemma-R", "problem-3-list-stwo", "problem-3a-L1", "problem-3b-interleaved", "problem-3c-charp", "problem-5-stwo-constants", "problem-4-curve-stwo"])
        self.assertIn("port-LIST32", [c["id"] for c in t["rules"]["claim_board"]])
        self.assertEqual(len(t["rules"]["void_reviews"]["post_ids"]), 42)
        self.assertIn("lift-lemma-R", [c["id"] for c in t["rules"]["claim_board"]])
        self.assertIn("Lemma R", t["rules"]["prize"])
        self.assertIn("core-free", t["rules"]["problem"])
        self.assertEqual([port["id"] for port in t["rules"]["ports"]][:2], ["port-D-codeword-pairs", "port-C-isolated-cover"])
        self.assertIn("E(f, g) <= C n", t["rules"]["goal"])
        self.assertNotIn("quadratic", t["statements"][1]["title"].lower())
        states = {c["id"]: c["state"] for c in t["cells"]}
        self.assertEqual(states["rung0"], "refutation-only")
        self.assertEqual(states["pool32"], "closed")
        self.assertEqual(states["circle-pool"], "open")
        self.assertEqual([s["id"] for s in t["statements"]], ["aligned-or-small-residual", "circle-quadratic", "fibre-alignment"])
        self.assertIn("refuted", t["statements"][2]["title"])
        board = m.summary(t, [], now="2026-10-30T00:00:00+00:00")
        self.assertEqual([c["id"] for c in board["cells"]][:2], ["rung0", "pool32"])
        self.assertIn("296,263", next(b for b in board["upper_bounds"] if b["kind"] == "proven bound on E")["value"])

    def test_upper_bounds_and_combinations_pay_double(self):
        base1 = row("M-0001", "lemma", who="alice", status="accepted")
        base2 = row("M-0002", "lemma", who="bob", status="accepted")
        cap = row("M-0003", "lemma", who="carol", status="accepted", bound="upper",
                  reviews=[{"by": "dave (Claude Code agent): reran the class count", "verdict": "holds"}])
        combo = row("M-0004", "lemma", who="erin", status="accepted", builds_on=["M-0001", "M-0002"], combines=["M-0001", "M-0002"])
        total = {}
        for l in m.ledger([base1, base2, cap, combo], m.load_targets()["rules"]):
            total[l["who"]] = total.get(l["who"], 0) + l["points"]
        self.assertEqual(total, {"alice": 60, "bob": 60, "carol": 100, "dave": 20, "erin": 100})
        with self.assertRaises(m.RecordError):
            m.validate(m.load_targets(), [row("M-0005", "lemma", combines=["M-0001"])])
        with self.assertRaises(m.RecordError):
            m.validate(m.load_targets(), [row("M-0005", "lemma", bound="sideways")])
