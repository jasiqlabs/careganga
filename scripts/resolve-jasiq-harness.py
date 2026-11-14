#!/usr/bin/env python3
"""CareGanga: fail-closed, latest-main JASIQ Harness bootstrap (Git + stdlib).

At the START of every PRD, HLD, Planning, DLD/UIUX, Development, Handoff and
QA/Release stage, run:
    python3 scripts/resolve-jasiq-harness.py

The pinned commit is deliberately stored here, reviewed in the product branch.
Every invocation checks the *current remote main*; a newly published upstream
commit blocks the stage until an agent reviews the diff and updates this pin.
Never silently adopt a moving revision mid-stage.

If the reviewed pin is current but a CLEAN local sibling Harness checkout is
behind, run with --sync to fetch and detach at exactly that reviewed SHA.
This script does not create product approvals or run the Harness stage resolver.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import subprocess
import sys

ORIGIN = "https://github.com/jasiqlabs/jasiq-harness.git"
PINNED_MAIN_SHA = "3713f13f2ea658a0cc42f8fbf98b4cc5b5b990fd"
REQUIRED = (
    "AGENTS.md",
    "jasiq-asdlc/VERSION",
    "jasiq-asdlc/workflow-manifest.yaml",
    "jasiq-asdlc/tools/resolve_product.py",
    "jasiq-asdlc/tools/install_agent_skills.py",
    "jasiq-asdlc/tools/db_guard.py",
    "jasiq-asdlc/tools/mobile_store_guard.py",
    "docs/V2_GUIDE.md",
    "standards/ENGINEERING_STANDARD.md",
    "standards/DATABASE_STANDARD.md",
    "standards/BACKGROUND_WORK_STANDARD.md",
    "standards/MOBILE_STORE_STANDARD.md",
    ".agents/skills/jasiq-hld/SKILL.md",
    ".agents/skills/jasiq-database/SKILL.md",
    ".agents/skills/jasiq-dev/SKILL.md",
)


def git(*args: str) -> str:
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    try:
        result = subprocess.run(
            ["git", *args], env=env, capture_output=True,
            text=True, timeout=60, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError("BLOCKED_HARNESS_GIT_UNAVAILABLE") from exc
    if result.returncode:
        raise RuntimeError("BLOCKED_HARNESS_GIT_FAILED: " + " ".join(args[:2]))
    return result.stdout.strip()


def latest_main_sha() -> str:
    response = git("ls-remote", ORIGIN, "refs/heads/main")
    line = response.splitlines()
    if len(line) != 1:
        raise RuntimeError("BLOCKED_HARNESS_MAIN_UNRESOLVED")
    pieces = line[0].split()
    if len(pieces) != 2 or pieces[1] != "refs/heads/main":
        raise RuntimeError("BLOCKED_HARNESS_MAIN_UNVERIFIED")
    latest = pieces[0].lower()
    if not re.fullmatch(r"[0-9a-f]{40}", latest):
        raise RuntimeError("BLOCKED_HARNESS_MAIN_INVALID_SHA")
    return latest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sync", action="store_true",
        help="Safely update a clean local Harness checkout to the reviewed, current main SHA.",
    )
    args = parser.parse_args()
    try:
        product = pathlib.Path(__file__).resolve().parent.parent
        harness = pathlib.Path(
            os.environ.get("JASIQ_HARNESS_DIR", str(product.parent / "jasiq-harness"))
        ).resolve()
        sha = PINNED_MAIN_SHA
        supplied = os.environ.get("JASIQ_HARNESS_EXPECTED_SHA", "").strip().lower()
        if supplied and supplied != sha:
            raise RuntimeError("BLOCKED_HARNESS_ENV_PIN_MISMATCH: use the product-reviewed script pin")
        if os.environ.get("JASIQ_HARNESS_REF", "main").strip() != "main":
            raise RuntimeError("BLOCKED_HARNESS_NON_MAIN_REF: normal stages require current main")
        if not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise RuntimeError("BLOCKED_HARNESS_PIN_INVALID")
        if harness == product or product in harness.parents or harness in product.parents:
            raise RuntimeError("BLOCKED_HARNESS_PATH: Harness must be a sibling repository")

        # Mandatory upstream freshness check, even when an old local pin is clean.
        remote_sha = latest_main_sha()
        if remote_sha != sha:
            raise RuntimeError(
                "BLOCKED_HARNESS_STALE_PIN: remote main=" + remote_sha
                + " product reviewed=" + sha
                + "; review upstream diff and update PINNED_MAIN_SHA in a product commit first"
            )

        if not harness.exists():
            harness.parent.mkdir(parents=True, exist_ok=True)
            git("clone", "--depth", "1", "--single-branch", "--branch", "main",
                ORIGIN, str(harness))
        if not harness.is_dir():
            raise RuntimeError("BLOCKED_HARNESS_PATH: invalid checkout directory")
        root = pathlib.Path(git("-C", str(harness), "rev-parse", "--show-toplevel")).resolve()
        if root != harness:
            raise RuntimeError("BLOCKED_HARNESS_PATH: not a Harness checkout root")
        origin = git("-C", str(harness), "remote", "get-url", "origin")
        origin = origin.removesuffix(".git").rstrip("/")
        if origin not in (
            "https://github.com/jasiqlabs/jasiq-harness",
            "git@github.com:jasiqlabs/jasiq-harness",
            "ssh://git@github.com/jasiqlabs/jasiq-harness",
        ):
            raise RuntimeError("BLOCKED_HARNESS_ORIGIN: wrong repository")
        if git("-C", str(harness), "status", "--porcelain"):
            raise RuntimeError("BLOCKED_HARNESS_DIRTY: preserve local changes; no automatic checkout")

        actual = git("-C", str(harness), "rev-parse", "HEAD").lower()
        if actual != sha and args.sync:
            # Only update a clean checkout to the EXACT previously reviewed latest SHA.
            git("-C", str(harness), "fetch", "--no-tags", "origin", "main")
            fetched = git("-C", str(harness), "rev-parse", "FETCH_HEAD").lower()
            if fetched != sha:
                raise RuntimeError("BLOCKED_HARNESS_REMOTE_MOVED: recheck/review new main")
            git("-C", str(harness), "checkout", "--detach", sha)
            actual = git("-C", str(harness), "rev-parse", "HEAD").lower()
        if actual != sha:
            raise RuntimeError(
                "BLOCKED_HARNESS_LOCAL_STALE: checkout=" + actual
                + " expected=" + sha + "; run with --sync on a clean checkout"
            )
        if git("-C", str(harness), "status", "--porcelain"):
            raise RuntimeError("BLOCKED_HARNESS_DIRTY_AFTER_SYNC")
        for relpath in REQUIRED:
            if not (harness / relpath).is_file():
                raise RuntimeError("BLOCKED_HARNESS_MISSING_STANDARD: " + relpath)
        version = (harness / "jasiq-asdlc" / "VERSION").read_text(encoding="utf-8").strip()
        if not version.startswith("2.0.0"):
            raise RuntimeError("BLOCKED_HARNESS_UNSUPPORTED_VERSION")
        print(json.dumps({
            "status": "PASS",
            "verified_remote_ref": "main",
            "remote_main_sha": remote_sha,
            "reviewed_product_pin": sha,
            "local_harness_sha": actual,
            "harness_dir": str(harness),
            "version": version,
            "next": "Run pinned resolve_product.py for the requested stage and verify approvals.",
        }, indent=2))
        return 0
    except (OSError, RuntimeError) as exc:
        print(json.dumps({"status": "BLOCKED", "reason": str(exc)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
