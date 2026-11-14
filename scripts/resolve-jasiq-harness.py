#!/usr/bin/env python3
"""JASIQ: verify/fetch one owner-reviewed private Harness commit (Git + stdlib).

Run from any directory: python scripts/resolve-jasiq-harness.py
Requires JASIQ_HARNESS_EXPECTED_SHA (full 40-character Git SHA).
For draft UAT only set JASIQ_HARNESS_REF to the reviewed draft feature branch.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys

ORIGIN = "https://github.com/jasiqlabs/jasiq-harness.git"
REQUIRED = (
    "AGENTS.md",
    "jasiq-asdlc/VERSION",
    "jasiq-asdlc/workflow-manifest.yaml",
    "jasiq-asdlc/tools/resolve_product.py",
    "jasiq-asdlc/tools/install_agent_skills.py",
    "docs/V2_GUIDE.md",
    "standards/ENGINEERING_STANDARD.md",
    "standards/DATABASE_STANDARD.md",
    "standards/BACKGROUND_WORK_STANDARD.md",
    "standards/MOBILE_STORE_STANDARD.md",
    ".agents/skills/jasiq-hld/SKILL.md",
    ".agents/skills/jasiq-database/SKILL.md",
    "jasiq-asdlc/tools/db_guard.py",
    "jasiq-asdlc/tools/mobile_store_guard.py",
    ".agents/skills/jasiq-dev/SKILL.md",
)


def git(*args, cwd=None):
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    p = subprocess.run(["git", *args], cwd=cwd, env=env,
                       capture_output=True, text=True, timeout=60, check=False)
    if p.returncode:
        raise RuntimeError("BLOCKED_HARNESS_UNAVAILABLE: Git checkout/authentication failed")
    return p.stdout.strip()


def main():
    try:
        product = pathlib.Path(__file__).resolve().parent.parent
        harness = pathlib.Path(os.environ.get("JASIQ_HARNESS_DIR",
                              str(product.parent / "jasiq-harness"))).resolve()
        sha = os.environ.get("JASIQ_HARNESS_EXPECTED_SHA", "").strip().lower()
        ref = os.environ.get("JASIQ_HARNESS_REF", "main").strip()
        if not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise RuntimeError("BLOCKED_HARNESS_UNPINNED: require full owner-reviewed JASIQ_HARNESS_EXPECTED_SHA")
        if not re.fullmatch(r"[A-Za-z0-9_./-]+", ref) or ".." in ref:
            raise RuntimeError("BLOCKED_HARNESS_REF: invalid requested Git ref")
        if harness == product or product in harness.parents or harness in product.parents:
            raise RuntimeError("BLOCKED_HARNESS_PATH: Harness must be a sibling repository")
        if not harness.exists():
            harness.parent.mkdir(parents=True, exist_ok=True)
            git("clone", "--depth", "1", "--single-branch", "--branch", ref, ORIGIN, str(harness))
        if not harness.is_dir() or pathlib.Path(git("-C", str(harness), "rev-parse", "--show-toplevel")).resolve() != harness:
            raise RuntimeError("BLOCKED_HARNESS_PATH: not a Harness checkout root")
        remote = git("-C", str(harness), "remote", "get-url", "origin").removesuffix(".git").rstrip("/")
        if remote not in ("https://github.com/jasiqlabs/jasiq-harness",
                          "git@github.com:jasiqlabs/jasiq-harness",
                          "ssh://git@github.com/jasiqlabs/jasiq-harness"):
            raise RuntimeError("BLOCKED_HARNESS_ORIGIN: unexpected GitHub repository")
        actual = git("-C", str(harness), "rev-parse", "HEAD").lower()
        if actual != sha:
            raise RuntimeError("BLOCKED_HARNESS_REVISION_MISMATCH: checkout differs from approved SHA; do not auto-update")
        if git("-C", str(harness), "status", "--porcelain"):
            raise RuntimeError("BLOCKED_HARNESS_DIRTY: unreviewed local Harness modifications")
        for path in REQUIRED:
            if not (harness / path).is_file():
                raise RuntimeError("BLOCKED_HARNESS_VERSION: missing v2 file: " + path)
        version = (harness / "jasiq-asdlc" / "VERSION").read_text(encoding="utf-8").strip()
        if not version.startswith("2.0.0"):
            raise RuntimeError("BLOCKED_HARNESS_VERSION: incompatible framework revision")
        print(json.dumps({"status": "PASS", "harness_dir": str(harness),
                          "harness_sha": actual, "version": version,
                          "installer": str(harness / "jasiq-asdlc/tools/install_agent_skills.py")}, indent=2))
        return 0
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        print(json.dumps({"status": "BLOCKED", "reason": str(exc)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
