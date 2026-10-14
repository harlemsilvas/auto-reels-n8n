#!/usr/bin/env python3
"""Read-only retention/access plan. No chmod, unlink, rotation or service calls."""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re
import stat

PM2 = re.compile(r"^socialbot-(backend|worker)-(out|error)\.log(?:-(\d{8}-\d{6})(?:\.gz)?)?$")

def timestamp(value):
    result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("TIMEZONE_REQUIRED")
    return result.astimezone(dt.timezone.utc)

def path_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()

def plan(root, catalog, kind, now):
    root = pathlib.Path(root).absolute()
    if root.is_symlink() or root.resolve() != root or not root.is_dir():
        raise ValueError("UNSAFE_ROOT")
    if catalog.get("version") != 1 or not isinstance(catalog.get("files"), list):
        raise ValueError("INVALID_CATALOG")
    known = {}
    for entry in catalog["files"]:
        name = entry.get("path")
        if not isinstance(name, str) or "\\" in name or any(p in ("", ".", "..") for p in name.split("/")) or name.startswith("/") or name in known:
            raise ValueError("INVALID_CATALOG_PATH")
        known[name] = entry
    items = []

    def walk(directory):
        for file in sorted(directory.iterdir()):
            name = file.relative_to(root).as_posix()
            s = file.lstat()
            base = {"pathHash": path_hash(name), "mode": oct(stat.S_IMODE(s.st_mode)), "sizeBytes": s.st_size}
            if file.is_symlink() or not (stat.S_ISDIR(s.st_mode) or stat.S_ISREG(s.st_mode)):
                items.append({**base, "decision": "protected", "reason": "UNSAFE_ENTRY"})
                continue
            base["desiredMode"] = "0o700" if stat.S_ISDIR(s.st_mode) else "0o600"
            base["accessReview"] = stat.S_IMODE(s.st_mode) != int(base["desiredMode"], 8)
            if stat.S_ISDIR(s.st_mode):
                items.append({**base, "decision": "preserve", "reason": "DIRECTORY"})
                walk(file)
                continue
            decision, reason = "protected", "UNCLASSIFIED"
            if kind == "pm2":
                match = PM2.fullmatch(name)
                if match and not match.group(3):
                    decision, reason = "preserve", "ACTIVE_LOG_NEVER_EXPIRE_BY_MTIME"
                elif match:
                    # dateext reflects server-local time; require explicit UTC rotation evidence.
                    entry = known.get(name, {})
                    if entry.get("category") == "operational_log" and entry.get("clockVerified") is True:
                        created = timestamp(entry["rotatedAt"])
                        if created > now:
                            raise ValueError("FUTURE_ROTATION")
                        decision, reason = ("review_expiry", "ARCHIVE_OLDER_THAN_14_DAYS") if now-created >= dt.timedelta(days=14) else ("preserve", "WITHIN_RETENTION")
                    else:
                        reason = "ROTATION_CLOCK_AND_CATEGORY_REQUIRED"
            else:
                entry = known.get(name, {})
                if entry.get("category") == "daily_database_backup":
                    if entry.get("hold") is not False:
                        reason = "HOLD_OR_HOLD_REVIEW_REQUIRED"
                    elif entry.get("creationVerified") is not True or not entry.get("restoreEvidence"):
                        reason = "CREATION_AND_RESTORE_EVIDENCE_REQUIRED"
                    else:
                        created = timestamp(entry["createdAt"])
                        if created > now:
                            raise ValueError("FUTURE_BACKUP")
                        expected = entry.get("sha256", "")
                        if not re.fullmatch(r"[a-f0-9]{64}", expected):
                            raise ValueError("BACKUP_DIGEST_REQUIRED")
                        with file.open("rb") as handle:
                            actual = hashlib.file_digest(handle, "sha256").hexdigest()
                        if actual != expected:
                            reason = "BACKUP_DIGEST_MISMATCH"
                        else:
                            decision, reason = ("review_expiry", "DAILY_BACKUP_OLDER_THAN_30_DAYS") if now-created >= dt.timedelta(days=30) else ("preserve", "WITHIN_RETENTION")
                elif entry.get("category") == "deletion_receipt":
                    reason = "RECEIPT_REQUIRED_FOR_RELEVANT_BACKUPS"
            items.append({**base, "decision": decision, "reason": reason})

    walk(root)
    return {"version": 1, "observedAt": now.isoformat(), "kind": kind, "automaticDeletion": False,
            "missingCatalogEntries": sum(not (root/name).exists() for name in known),
            "rootAccessReview": stat.S_IMODE(root.stat().st_mode) != 0o700,
            "limitations": "Non-atomic local inspection; does not authorize deletion or prove owner/ACL/admin exclusivity",
            "items": items}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--catalog", help="Reviewed JSON catalog; omission protects all unclassified files")
    parser.add_argument("--kind", choices=["backups", "pm2"], required=True)
    args = parser.parse_args()
    catalog = {"version": 1, "files": []}
    if args.catalog:
        source = pathlib.Path(args.catalog).absolute()
        if source.is_symlink() or source.resolve() != source or source.stat().st_size > 2_000_000:
            raise ValueError("UNSAFE_CATALOG")
        catalog = json.loads(source.read_text())
    report = plan(args.root, catalog, args.kind, dt.datetime.now(dt.timezone.utc))
    print(json.dumps(report))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError):
        raise SystemExit("RETENTION_PLAN_FAILED: verify catalog, paths and evidence; no changes applied")
