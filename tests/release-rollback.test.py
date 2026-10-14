"""Run the actual activation section with fake services; no network or live PM2."""
from pathlib import Path
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).parents[1]
BASH = os.environ.get("TEST_BASH", "C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else "bash")
ACTIVATION = (ROOT / "scripts/deploy-production.sh").read_text(encoding="utf-8").split("SWITCHED=0\n", 1)[1]

class RollbackTests(unittest.TestCase):
    def run_case(self, mode):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            (folder / "nginx.before").write_text("old")
            (folder / "nginx.after").write_text("new")
            (folder / "site").write_text("old")
            script = '''#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
RELEASE="$PWD"
RELEASE_ROOT="$PWD"
NGINX_SITE="$PWD/site"
PORT=3003
SLOT=aloha-shop-next
ID=test
SWITCHED=0
pm2() { echo "$*" >> actions; return 0; }
systemctl() { echo "$*" >> actions; return 0; }
ln() { echo "link $*" >> actions; return 0; }
mv() { echo "move $*" >> actions; return 0; }
sleep() { return 0; }
nginx() { test "$MODE" != fail-nginx; }
curl() {
  case "$MODE:$*" in
    fail-ready:*) return 1;;
    fail-api:*3001*) return 1;;
    fail-final:*https:*) return 1;;
  esac
  return 0
}
''' + ACTIVATION
            runner = folder / "run.sh"
            runner.write_text(script, encoding="utf-8", newline="\n")
            result = subprocess.run([BASH, str(runner)], env={**os.environ, "MODE": mode}, capture_output=True, text=True)
            site = (folder / "site").read_text()
            actions = (folder / "actions").read_text()
            return result, site, actions

    def test_success_switches_after_readiness(self):
        result, site, actions = self.run_case("success")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(site, "new")
        self.assertIn("reload nginx", actions)
        self.assertNotIn("api.before.json", actions)

    def test_candidate_and_nginx_failure_leave_api_untouched(self):
        for mode in ("fail-ready", "fail-nginx"):
            result, site, actions = self.run_case(mode)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(site, "old")
            self.assertNotIn("delete aloha-shop-api", actions)
            self.assertNotIn("delete aloha-shop\n", actions)

    def test_api_or_public_failure_restores_api_and_proxy(self):
        for mode in ("fail-api", "fail-final"):
            result, site, actions = self.run_case(mode)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(site, "old")
            self.assertIn("api.before.json", actions)
            if mode == "fail-final": self.assertIn("reload nginx", actions)

if __name__ == "__main__":
    unittest.main()
