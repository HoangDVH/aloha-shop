import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("release_nginx", Path(__file__).parents[1] / "scripts/release-nginx.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
FIXTURE = '''upstream nextjs_shop_upstream {
    server 127.0.0.1:3002;
    keepalive 32;
}
server {
    ssl_certificate /cert.pem;
    location /api/shop/ { proxy_pass http://127.0.0.1:3001/api/shop/; }
    location / {
        proxy_pass http://nextjs_shop_upstream;
        proxy_cache_bypass $http_upgrade;
        proxy_cache NEXT_10S_CACHE;
        proxy_cache_valid 200 10s;
        proxy_cache_use_stale error timeout updating;
        proxy_ignore_headers Cache-Control Expires;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
'''

class ReleaseNginxTests(unittest.TestCase):
    def test_switch_and_cache(self):
        output = module.prepare(FIXTURE, 3003, "/root/aloha-shop-releases/static")
        self.assertIn("127.0.0.1:3003;", output)
        self.assertIn("ssl_certificate /cert.pem;", output)
        self.assertIn("http://127.0.0.1:3001/api/shop/;", output)
        self.assertNotIn("proxy_ignore_headers", output)
        self.assertNotIn("NEXT_10S_CACHE", output)
        self.assertIn("proxy_cache off;", output)
        self.assertIn("proxy_hide_header Cache-Control;", output)
        self.assertIn("immutable", output)
        again = module.prepare(output, 3002, "/root/aloha-shop-releases/static")
        self.assertEqual(again.count("location ^~ /_next/static/"), 1)
        self.assertEqual(again.count('add_header Cache-Control "private, no-store"'), 1)

    def test_unknown_config_and_unsafe_paths_fail_closed(self):
        for text, port, assets in [(FIXTURE, 4000, "/safe"), (FIXTURE, 3002, "/unsafe;"), ("server {}", 3002, "/safe"), (FIXTURE.replace("3002", "4000"), 3002, "/safe")]:
            with self.assertRaises(ValueError):
                module.prepare(text, port, assets)

if __name__ == "__main__":
    unittest.main()
