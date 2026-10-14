import datetime as dt
import hashlib
import json
import os
import pathlib
import tempfile
import unittest
from retention_plan import plan

class RetentionPlanTest(unittest.TestCase):
    def test_backup_evidence_hold_receipt_and_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root/"demo.dump").write_bytes(b"Synthetic backup")
            (root/"receipt.json").write_text("Synthetic receipt")
            (root/"unclassified.sql").write_text("Synthetic old data")
            os.symlink(root/"demo.dump", root/"link.dump")
            entry = {"path": "demo.dump", "category": "daily_database_backup", "hold": False,
                     "creationVerified": True, "restoreEvidence": "test-restore", "createdAt": "2026-01-01T00:00:00Z",
                     "sha256": hashlib.sha256(b"Synthetic backup").hexdigest()}
            catalog = {"version": 1, "files": [entry, {"path": "receipt.json", "category": "deletion_receipt"}]}
            now = dt.datetime(2026, 1, 31, tzinfo=dt.timezone.utc)
            report = plan(root, catalog, "backups", now)
            self.assertFalse(report["automaticDeletion"])
            self.assertEqual(sum(i["decision"] == "review_expiry" for i in report["items"]), 1)
            self.assertNotIn("demo.dump", json.dumps(report))
            entry["hold"] = True
            self.assertFalse(any(i["decision"] == "review_expiry" for i in plan(root,catalog,"backups",now)["items"]))
            entry["hold"] = False; entry["sha256"] = "a"*64
            self.assertTrue(any(i["reason"] == "BACKUP_DIGEST_MISMATCH" for i in plan(root,catalog,"backups",now)["items"]))
            catalog["files"].append({"path": "../escape"})
            with self.assertRaises(ValueError): plan(root,catalog,"backups",now)
            self.assertEqual((root/"demo.dump").read_bytes(), b"Synthetic backup")

    def test_active_log_and_verified_rotation_clock(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root/"socialbot-backend-out.log").write_text("Synthetic active")
            archive = "socialbot-backend-out.log-20260101-000000.gz"
            (root/archive).write_text("Synthetic archive")
            (root/"other-app.log-20260101-000000.gz").write_text("Other project")
            now = dt.datetime(2026,1,15,tzinfo=dt.timezone.utc)
            catalog = {"version":1,"files":[]}
            self.assertFalse(any(i["decision"] == "review_expiry" for i in plan(root,catalog,"pm2",now)["items"]))
            catalog["files"] = [{"path":archive,"category":"operational_log","clockVerified":True,"rotatedAt":"2026-01-01T00:00:00Z"}]
            report = plan(root,catalog,"pm2",now)
            self.assertEqual(sum(i["decision"] == "review_expiry" for i in report["items"]),1)
            self.assertTrue(any(i["reason"] == "ACTIVE_LOG_NEVER_EXPIRE_BY_MTIME" for i in report["items"]))
            self.assertTrue((root/archive).exists())

if __name__ == "__main__": unittest.main()
