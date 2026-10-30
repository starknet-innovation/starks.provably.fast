"""The Harbor environments: generated tasks, the count grader against the kit, and the templates."""
from __future__ import annotations

import importlib.util
import json
import random
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARBOR = ROOT / "harbor"
COUNT = HARBOR / "templates" / "count"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


kit = load("kit_certify", ROOT / "kit" / "certify.py")
baseline = load("count_baseline", COUNT / "environment" / "baseline.py")
HAVE_NUMPY = importlib.util.find_spec("numpy") is not None
grade = load("count_grade", COUNT / "tests" / "grade.py") if HAVE_NUMPY else None


def task_for(inst: dict) -> dict:
    n = len(inst["domain"])
    return {"p": inst["p"], "n": n, "k": inst["k"], "A": inst["A"], "floor": 9 * n // 4,
            "goal_per_n": 16, "max_listed": 24 * n}


class Generated(unittest.TestCase):
    def test_tasks_are_up_to_date(self):
        res = subprocess.run([sys.executable, str(HARBOR / "build.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)

    def test_registry_lists_every_task_directory(self):
        registry = json.loads((HARBOR / "registry.json").read_text())[0]
        listed = sorted(t["name"] for t in registry["tasks"])
        self.assertEqual(listed, sorted(p.name for p in (HARBOR / "tasks").iterdir()))
        for t in registry["tasks"]:
            for name in ("instruction.md", "task.toml", "environment/Dockerfile", "solution/solve.sh", "tests/test.sh"):
                self.assertTrue((HARBOR / t["path"] / name).is_file(), f"{t['name']}: {name}")

    def test_lean_tasks_pin_the_challenge_templates(self):
        index = json.loads((ROOT / "lean" / "challenges" / "index.json").read_text())
        pinned = (ROOT / "lean" / "MCAChallenge.lean").read_text()
        for target, spec in index["targets"].items():
            template = (ROOT / "lean" / "challenges" / spec["template"]).read_text()
            self.assertRegex(pinned, rf"(?m)^def {re.escape(target)}\b")
            self.assertIn(f"MCAChallenge.{target}.{{u}}", template)
            self.assertRegex(template, r"(?m)^theorem solution\.\{u\}")
            for hole in spec["holes"]:
                self.assertRegex(template, rf"(?m)^(?:noncomputable )?def {re.escape(hole)} : .* := sorry$")
            task = next(p for p in (HARBOR / "tasks").iterdir() if p.name.startswith("lean-")
                        and json.loads((p / "tests" / "task.json").read_text())["challenge"] == target)
            self.assertEqual((task / "tests" / "Challenge.lean").read_text(), template)
            self.assertEqual(json.loads((task / "tests" / "task.json").read_text())["comparator"]["definition_names"], spec["holes"])

    def test_lean_controls_share_the_challenge_statement(self):
        controls = HARBOR / "controls"
        challenge = (controls / "Control.lean").read_text()
        statement = challenge[challenge.index("theorem solution"):challenge.index(":= sorry", challenge.index("theorem solution"))]
        for name in ("ok", "choice"):
            self.assertIn(statement, (controls / "solutions" / f"{name}.lean").read_text(), name)
        self.assertNotIn(statement, (controls / "solutions" / "weak.lean").read_text())
        config = json.loads((controls / "config.json").read_text())
        self.assertEqual((config["theorem_names"], config["definition_names"]), (["solution"], ["C"]))

    def test_only_the_lean_verifier_gets_net_admin(self):
        # grade.py's iptables rule needs NET_ADMIN. Harbor reads tests/docker-compose.yaml for the
        # separate verifier alone; an environment/docker-compose.yaml would also reach the agent,
        # whose root could then lift the no-network policy of the namespace it shares.
        for task in sorted((HARBOR / "tasks").iterdir()):
            self.assertFalse((task / "environment" / "docker-compose.yaml").exists(), task.name)
            compose = task / "tests" / "docker-compose.yaml"
            if not task.name.startswith("lean-"):
                self.assertFalse(compose.exists(), task.name)
                continue
            text = compose.read_text()
            self.assertRegex(text, r"(?m)^    cap_add:\n      - NET_ADMIN$", task.name)
            self.assertRegex(text, r"(?m)^      context: \.\./environment$", task.name)
            self.assertRegex(text, r"(?m)^      - \./:/tests:ro$", task.name)
            self.assertEqual(text.count("cap_add"), 1, task.name)

    def test_public_prose_has_no_em_dash(self):
        for path in [*HARBOR.rglob("*.md"), *HARBOR.rglob("*.toml")]:
            self.assertNotIn("—", path.read_text(), path)


class Floor(unittest.TestCase):
    def test_kit_certifies_four_times_n_minus_A_plus_one(self):
        inst = baseline.build(5)
        bad, failures = kit.check(inst)
        self.assertEqual(failures, [])
        self.assertEqual(len(bad), 4 * (32 - 20 + 1))
        self.assertEqual(len(inst["challenges"]), 52)

    def test_kit_refuses_a_witness_above_k(self):
        inst = baseline.build(5)
        inst["challenges"] = [{"z": 1, "witness": list(range(inst["k"] + 1))}]
        bad, failures = kit.check(inst)
        self.assertEqual(bad, set())
        self.assertEqual(len(failures), 1)


@unittest.skipUnless(HAVE_NUMPY, "numpy is not installed; the grader runs in the task image")
class Grader(unittest.TestCase):
    def certify_both(self, inst):
        task = task_for(inst)
        dom, f, g, chal = grade.validate(inst, task)
        fast = grade.certify(dom, f, g, chal, task["k"], task["A"], task["p"])
        slow = kit.check(inst)
        return fast, slow

    def test_agrees_with_the_kit_on_the_floor(self):
        (bad, failures), (kbad, kfail) = self.certify_both(baseline.build(5))
        self.assertEqual(bad, kbad)
        self.assertEqual(len(bad), 52)
        self.assertEqual(failures, [])

    def test_agrees_with_the_kit_on_random_challenges(self):
        rng = random.Random(7)
        inst = baseline.build(5, seed=3)
        n, k, p = 32, inst["k"], inst["p"]
        chal = []
        for ch in inst["challenges"][:6]:          # true challenges, witness in another order
            chal.append({"z": ch["z"], "witness": rng.sample(ch["witness"], k)})
        for ch in inst["challenges"][:4]:          # a witness touching a point outside S
            chal.append({"z": ch["z"], "witness": rng.sample(range(n), k)})
        for _ in range(12):                        # random challenges
            chal.append({"z": rng.randrange(p), "witness": rng.sample(range(n), k)})
        inst["challenges"] = chal
        (bad, failures), (kbad, kfail) = self.certify_both(inst)
        self.assertEqual(bad, kbad)
        self.assertEqual(sorted(z for z, _ in failures), sorted(z for z, _ in kfail))
        self.assertGreaterEqual(len(bad), 6)

    def test_arithmetic_next_to_the_prime(self):
        # Values at p - 1 everywhere: no product may overflow int64 and the two checkers must agree.
        inst = baseline.build(4, seed=5)
        p, n = inst["p"], 16
        inst["f"] = [p - 1] * n
        inst["g"] = [p - 1 - (i % 3) for i in range(n)]
        inst["challenges"] = [{"z": p - 1, "witness": list(range(inst["k"]))},
                              {"z": p - 2, "witness": list(range(1, inst["k"] + 1))}]
        (bad, failures), (kbad, kfail) = self.certify_both(inst)
        self.assertEqual(bad, kbad)
        self.assertEqual(len(failures), len(kfail))

    def test_rejects_a_tampered_instance(self):
        inst = baseline.build(4)
        task = task_for(inst)
        cases = {
            "p": dict(p=inst["p"] + 2), "k": dict(k=inst["k"] - 1), "A": dict(A=inst["A"] - 1),
            "domain": dict(domain=[3 if x == inst["domain"][1] else x for x in inst["domain"]]),
            "short f": dict(f=inst["f"][:-1]),
            "witness size": dict(challenges=[{"z": 1, "witness": list(range(inst["k"] + 1))}]),
            "witness repeat": dict(challenges=[{"z": 1, "witness": [0] * inst["k"]}]),
            "composite witness entry": dict(challenges=[{"z": 1, "witness": [[0]] + list(range(1, inst["k"]))}]),
            "string z": dict(challenges=[{"z": "1", "witness": list(range(inst["k"]))}]),
            "bool z": dict(challenges=[{"z": True, "witness": list(range(inst["k"]))}]),
            "too many": dict(challenges=[{"z": 1, "witness": list(range(inst["k"]))}] * (24 * 16 + 1)),
        }
        for name, change in cases.items():
            with self.assertRaises(grade.Rejected, msg=name):
                grade.validate({**inst, **change}, task)

    def test_main_writes_the_reward_only_above_sixteen_n(self):
        inst = baseline.build(5)
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / "tests").mkdir(); (tmp / "artifacts").mkdir()
            (tmp / "tests" / "task.json").write_text(json.dumps(task_for(inst)))
            (tmp / "artifacts" / "instance.json").write_text(json.dumps(inst))
            grade.TESTS, grade.VERIFIER_DIR, grade.INSTANCE = tmp / "tests", tmp / "verifier", tmp / "artifacts" / "instance.json"
            self.assertEqual(grade.main(), 0)
            reward = json.loads((tmp / "verifier" / "reward.json").read_text())
            self.assertEqual(reward["certified_bad"], 52)
            self.assertEqual((reward["over_floor"], reward["beats_floor"], reward["above_goal"]), (52 - 72, 0, 0))
            self.assertEqual(reward["reward"], 0.0)
            # a second bad challenge per point would beat the floor
            inst["challenges"] += [{"z": (c["z"] + 1) % inst["p"], "witness": c["witness"]} for c in inst["challenges"]]
            (tmp / "artifacts" / "instance.json").write_text(json.dumps(inst))
            grade.main()
            again = json.loads((tmp / "verifier" / "reward.json").read_text())
            self.assertEqual(again["certified_bad"], 52)
            details = json.loads((tmp / "verifier" / "grading.json").read_text())
            self.assertEqual(details["failed"], 52)
            # tampering with the domain scores 0 with a reason
            inst["domain"][0] = 5
            (tmp / "artifacts" / "instance.json").write_text(json.dumps(inst))
            grade.main()
            self.assertEqual(json.loads((tmp / "verifier" / "reward.json").read_text())["reward"], 0.0)
            self.assertIn("rejected", json.loads((tmp / "verifier" / "grading.json").read_text())["reason"])


if __name__ == "__main__":
    unittest.main()


SHARED = HARBOR / "templates" / "shared"
exceptional = load("exceptional_lib", SHARED / "exceptional.py") if HAVE_NUMPY else None


@unittest.skipUnless(HAVE_NUMPY, "numpy is not installed; the verifiers run in the task image")
class UpperBoundFamilies(unittest.TestCase):
    """Rules v2: the exceptional set from the definition, anchors, and the ray classes."""

    def small_pair(self, seed: int):
        # F_97 has the 8th roots of unity (8 divides 96); k = 4, A = 5: C(8, 5) = 56 subsets.
        p, n, k, A = 97, 8, 4, 5
        zeta = pow(5, (p - 1) // n, p)
        self.assertEqual(pow(zeta, n, p), 1)
        self.assertNotEqual(pow(zeta, n // 2, p), 1)
        dom = [pow(zeta, i, p) for i in range(n)]
        rng = random.Random(seed)
        f = [rng.randrange(p) for _ in range(n)]
        g = [rng.randrange(p) for _ in range(n)]
        return {"p": p, "k": k, "A": A, "domain": dom, "f": f, "g": g}

    def brute_force(self, inst):
        """E(f, g) by trying every z of the field with every k-subset as a witness: the definition alone."""
        import itertools
        p, k, n = inst["p"], inst["k"], len(inst["domain"])
        chal = [{"z": z, "witness": list(w)} for z in range(p) for w in itertools.combinations(range(n), k)]
        bad, _ = kit.check({**inst, "challenges": chal})
        return set(bad)

    def test_exceptional_set_matches_the_definition_on_small_fields(self):
        for seed in range(4):
            inst = self.small_pair(seed)
            E, how, witness = exceptional.exceptional_set(kit, inst)
            self.assertEqual(E, self.brute_force(inst), f"seed {seed}")
            self.assertEqual(how["subsets"], 56)
            self.assertEqual(set(witness), E)
            for z, w in witness.items():
                T = exceptional.agreement_set(kit, inst["p"], inst["k"], inst["domain"], inst["f"], inst["g"], z, w)
                self.assertGreaterEqual(len(T), inst["A"])

    def test_a_planted_pair_has_a_known_exceptional_challenge(self):
        inst = self.small_pair(11)
        p, k, A, dom = inst["p"], inst["k"], inst["A"], inst["domain"]
        # Make f + 7 g agree with a cubic on five points: f = P - 7 g there.
        P = [3, 1, 4, 1]
        on = [0, 1, 2, 3, 4]
        for i in on:
            inst["f"][i] = (kit.evaluate(P, dom[i], p) - 7 * inst["g"][i]) % p
        E, _, witness = exceptional.exceptional_set(kit, inst)
        self.assertIn(7, E)
        self.assertEqual(E, self.brute_force(inst))

    def test_fibre_alignment_counts_whole_fibres_plus_one_punctured(self):
        p, n, h = 97, 8, 2
        zeta = pow(5, (p - 1) // n, p)
        dom = [pow(zeta, i, p) for i in range(n)]
        # Fibres of x -> x^2: {i, i + 4}. T = two whole fibres plus one point: anchor 5 >= A - 1 = 5.
        verdict = exceptional.fibre_aligned(p, dom, [0, 4, 1, 5, 2], h, 6)
        self.assertEqual((verdict["aligned"], verdict["full_fibres"], verdict["largest_partial"], verdict["anchor"]), (True, 2, 1, 5))
        # Five points from five different fibres: no anchor beyond one fibre point each.
        self.assertFalse(exceptional.fibre_aligned(p, dom, [0, 1, 2, 3, 6], h, 6)["aligned"])
        # h = 1: every set is a union of fibres.
        self.assertTrue(exceptional.fibre_aligned(p, dom, [0, 1, 2, 3, 6], 1, 6)["aligned"])

    def test_ray_classes_of_a_tiny_family_match_a_direct_count(self):
        p = 97
        modulus, size = 8, 4
        zeta = pow(5, (p - 1) // modulus, p)
        base, s = (0, 3), 5
        counted = exceptional.ray_classes(p, zeta, base, s, size=size, modulus=modulus)
        import itertools
        direct = {y: set() for y in base}
        free = [j for j in range(modulus) if j not in base]
        for T in itertools.combinations(free, size - len(base)):
            if (sum(base) + sum(T)) % modulus != s:
                continue
            for y in base:
                prod = 1
                for j in T:
                    prod = prod * (pow(zeta, y, p) - pow(zeta, j, p)) % p
                direct[y].add(prod)
        self.assertEqual(counted, {y: len(v) for y, v in direct.items()})
        self.assertGreater(sum(counted.values()), 0)

    def test_count_reward_pays_only_above_sixteen_n(self):
        src = (COUNT / "tests" / "grade.py").read_text()
        self.assertIn("reward = 1.0 if certified > goal else 0.0", src)
        self.assertNotIn("min(1.0, certified / goal)", src)

    def test_every_family_is_generated_with_the_shared_library(self):
        for name in ("exceptional-set-n32-a20", "exceptional-set-n32-a18", "refute-fibre-alignment-m8",
                     "refute-fibre-alignment-m9", "refute-fibre-alignment-m10", "cap-classes-level32"):
            task = HARBOR / "tasks" / name
            for where in ("environment", "tests"):
                self.assertEqual((task / where / "exceptional.py").read_text(), (SHARED / "exceptional.py").read_text(), name)
                self.assertEqual((task / where / "certify.py").read_text(), (ROOT / "kit" / "certify.py").read_text(), name)
            self.assertTrue((task / "tests" / "grade.py").exists())
        manifest = json.loads((HARBOR / "manifest.json").read_text())
        kinds = {t["kind"] for t in manifest["tasks"]}
        self.assertEqual(kinds, {"count", "exceptional-set", "refute-fibre-alignment", "cap-verification", "lean"})
        cap = next(t for t in manifest["tasks"] if t["kind"] == "cap-verification")
        self.assertEqual(cap["posted_maximum"]["classes"], 385196)
