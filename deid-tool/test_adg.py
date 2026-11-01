#!/usr/bin/env python3
"""
Asset Data Group tool-suite tests (standard library only).

    cd deid-tool && python3 -m unittest test_adg -v

Covers the de-identification building blocks, an end-to-end "no raw PII leaks"
integration check, the evaluation rubric, and the streaming scanner. No third-party
dependencies; spaCy-dependent behavior is not required for any test to pass.
"""

import csv
import os
import subprocess
import sys
import tempfile
import unittest
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import deid
import dsstats
from evaluate import evaluate_dataset

SALT = b"unit-test-salt16"


class DeidUnits(unittest.TestCase):
    def test_mask_email_hides_local_and_domain(self):
        out = deid.mask_email("john.smith@acme-corp.com")
        self.assertNotIn("john", out)
        self.assertNotIn("smith", out)
        self.assertNotIn("acme", out)
        self.assertTrue(out.startswith("j***@"))

    def test_mask_tail_keeps_only_last_digits(self):
        self.assertNotIn("919", deid.mask_tail("919-555-0142"))
        self.assertTrue(deid.mask_tail("919-555-0142").endswith("0142"))

    def test_generalize_date_to_year(self):
        self.assertEqual(deid.generalize_date("2024-06-15", "year"), "2024")
        self.assertEqual(deid.generalize_date("6/15/2024", "year"), "2024")

    def test_generalize_zip_truncates_and_restricts(self):
        self.assertEqual(deid.generalize_zip("27601"), "276")
        self.assertEqual(deid.generalize_zip("03687"), "000")  # 036 is a restricted prefix

    def test_token_is_stable_and_one_way(self):
        a = deid.token("ACCT-889201", SALT, "acct")
        self.assertEqual(a, deid.token("ACCT-889201", SALT, "acct"))      # stable within a run
        self.assertNotEqual(a, deid.token("ACCT-000000", SALT, "acct"))   # different input -> different token
        self.assertNotIn("889201", a)                                     # not reversible to the input

    def test_luhn(self):
        self.assertTrue(deid.luhn_ok("4111111111111111"))
        self.assertFalse(deid.luhn_ok("4111111111111112"))

    def test_scrub_text_redacts_patterned_pii(self):
        c = Counter()
        out = deid.scrub_text("email a@b.com call 919-555-0101 ssn 123-45-6789", SALT, c)
        self.assertNotIn("a@b.com", out)
        self.assertNotIn("919-555-0101", out)
        self.assertNotIn("123-45-6789", out)
        self.assertIn("[EMAIL]", out)
        self.assertIn("[SSN]", out)

    def test_cross_column_scrub_removes_known_identifiers(self):
        plan = {"customer_name": {"type": "name", "action": "hash"},
                "account_no": {"type": "account", "action": "hash"},
                "notes": {"type": "freetext", "action": "scrub_text"}}
        row = {"customer_name": "Maria Lopez", "account_no": "ACCT-889202", "notes": "Maria approved; bill ACCT-889202."}
        known = deid.build_known(row, plan)
        out = deid.scrub_text(row["notes"], SALT, Counter(), None, known)
        self.assertNotIn("Maria", out)
        self.assertNotIn("ACCT-889202", out)


class NoPiiLeak(unittest.TestCase):
    """End-to-end: run deid.py on a file with known PII and confirm none of it survives."""

    def test_pipeline_removes_all_known_pii(self):
        pii = {
            "email": "jane.roe@example.com", "ssn": "123-45-6789",
            "phone": "919-555-0101", "name": "Jane Roe", "card": "4111 1111 1111 1111",
        }
        d = tempfile.mkdtemp(prefix="adgtest_")
        src = os.path.join(d, "in.csv")
        out = os.path.join(d, "clean.csv")
        with open(src, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["id", "customer_name", "email", "ssn", "phone", "service_date", "notes"])
            w.writerow(["1", pii["name"], pii["email"], pii["ssn"], pii["phone"], "2024-06-15",
                        "Call %s at %s or %s. SSN %s. Card %s." % (pii["name"], pii["phone"], pii["email"], pii["ssn"], pii["card"])])
        r = subprocess.run([sys.executable, "deid.py", "-i", src, "-o", out], cwd=HERE, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(out, encoding="utf-8") as f:
            cleaned = f.read()
        for label, value in pii.items():
            self.assertNotIn(value, cleaned, "raw %s leaked into cleaned output" % label)
        # first name alone (cross-column token) should also be gone
        self.assertNotIn("Jane", cleaned)


class Evaluation(unittest.TestCase):
    def test_rubric_bounds_and_shape(self):
        stats = {"records": 500000, "n_columns": 18,
                 "columns": [{"fill": 95} for _ in range(18)], "temporal": [["d", 2015, 2024]]}
        res = evaluate_dataset(stats, None, {"uniqueness": "high", "rights": "owns", "demand": "high"})
        self.assertTrue(0 <= res["overall"] <= 100)
        self.assertIn(res["tier"], ("A", "B", "C"))
        self.assertTrue(res["valueBand"].startswith("$"))
        self.assertEqual(len(res["factors"]), 8)

    def test_higher_inputs_score_higher(self):
        stats = {"records": 10000, "n_columns": 10, "columns": [{"fill": 80} for _ in range(10)], "temporal": []}
        lo = evaluate_dataset(stats, None, {"uniqueness": "low", "rights": "unclear", "demand": "low"})["overall"]
        hi = evaluate_dataset(stats, None, {"uniqueness": "high", "rights": "owns", "demand": "high"})["overall"]
        self.assertGreater(hi, lo)


class Scanner(unittest.TestCase):
    def test_scan_counts_and_types(self):
        d = tempfile.mkdtemp(prefix="adgtest_")
        p = os.path.join(d, "s.csv")
        with open(p, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["id", "year", "amount", "cat"])
            for i in range(50):
                w.writerow([i, 2020 + (i % 5), "%d.50" % (100 + i), "A" if i % 2 else "B"])
        stats, sample = dsstats.scan(p)
        self.assertEqual(stats["records"], 50)
        self.assertEqual(stats["n_columns"], 4)
        self.assertLessEqual(len(sample), 8)
        by = {c["name"]: c for c in stats["columns"]}
        self.assertEqual(by["year"]["type"], "year")
        self.assertEqual(by["amount"]["type"], "number")
        self.assertEqual(by["cat"]["type"], "categorical")
        self.assertEqual(by["cat"]["distinct"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
