"""The starks export stamps every css and js link with its file's content hash (public/export.py)."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("starks_export", ROOT / "public" / "export.py")
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


class ExportStamp(unittest.TestCase):
    def test_local_and_shared_links_carry_their_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            docs = Path(tmp)
            (docs / "proven.css").write_text("a { color: red }")
            (docs / "index.html").write_text(
                '<link rel="stylesheet" href="proven.css"><link rel="stylesheet" href="kit.css?v=20261111">'
                '<script src="/auth-nav.js"></script><script src="https://cdn.example/x.js"></script><script src="gone.js"></script>')
            self.assertEqual(export.stamp(docs), 3)
            page = (docs / "index.html").read_text()
            local = hashlib.sha256(b"a { color: red }").hexdigest()[:12]
            shared = hashlib.sha256((export.SHARED / "kit.css").read_bytes()).hexdigest()[:12]
            self.assertIn(f'href="proven.css?v={local}"', page)
            self.assertIn(f'href="kit.css?v={shared}"', page)
            self.assertNotIn("20261111", page)
            self.assertIn('src="/auth-nav.js?v=', page)
            self.assertIn('src="https://cdn.example/x.js"', page)
            self.assertIn('src="gone.js"', page)

    def test_the_pages_in_the_tree_all_resolve(self):
        docs = ROOT / "public" / "docs"
        for page in docs.glob("*.html"):
            for m in export.ASSET.finditer(page.read_text()):
                rel = m.group(2).lstrip("/")
                self.assertTrue((docs / rel).is_file() or (export.SHARED / rel).is_file(), f"{page.name}: {m.group(2)} is found nowhere")


if __name__ == "__main__":
    unittest.main()
