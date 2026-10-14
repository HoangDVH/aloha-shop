"""Patch known shop blocks, preserving certificates and API routes."""
import re
import sys


def prepare(text, port, assets):
    if port not in (3002, 3003) or not re.fullmatch(r"/[A-Za-z0-9_./-]+", assets):
        raise ValueError("Unsafe upstream or static path")
    text, count = re.subn(
        r"(upstream\s+nextjs_shop_upstream\s*\{\s*server\s+127\.0\.0\.1:)(3002|3003)(;)",
        lambda m: m[1] + str(port) + m[3], text)
    if count != 1:
        raise ValueError("Expected exactly one shop upstream")
    start = text.index("    location / {")
    end = text.index("\n    }", start)
    block = text[start:end]
    block = re.sub(r"(?m)^\s*(?:proxy_cache(?:_[a-z_]+)?|proxy_ignore_headers|add_header X-Cache-Status)\s+[^;]+;", "", block)
    block = re.sub(r'(?m)^\s*add_header Cache-Control[^;]+;', '', block)
    block = re.sub(r'(?m)^\s*proxy_hide_header (?:Cache-Control|Expires);', '', block)
    block += '\n        proxy_cache off;\n        proxy_hide_header Cache-Control;\n        proxy_hide_header Expires;\n        add_header Cache-Control "private, no-store" always;'
    text = text[:start] + block + text[end:]
    text = re.sub(r"\n    # Aloha retained assets\n    location \^~ /_next/static/ \{[^}]+\}\n", "\n", text)
    if re.search(r"location\s+[^\n]*?/_next/static/", text):
        raise ValueError("Unmanaged static location; review before deploying")
    static = f'''\n    # Aloha retained assets
    location ^~ /_next/static/ {{
        alias {assets}/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }}
'''
    start = text.index("    location / {")
    return text[:start] + static + text[start:]


if __name__ == "__main__":
    from pathlib import Path
    Path(sys.argv[2]).write_text(prepare(Path(sys.argv[1]).read_text(), int(sys.argv[3]), sys.argv[4]))
