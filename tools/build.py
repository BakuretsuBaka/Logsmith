#!/usr/bin/env python3
"""Baut dist/Logsmith-<version>-firefox.zip und -chromium.zip aus dem Repo."""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["LICENSE", "background.js", "content.js", "content.css", "guard.js", "manifest.json", "popup.html", "popup.js"]
ICONS = sorted(f for f in os.listdir(os.path.join(ROOT, "icons")) if f.endswith(".png") or f == "icon.svg")

with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
    base = json.load(f)
version = base["version"]

firefox = json.loads(json.dumps(base))
firefox["background"].pop("service_worker", None)

chromium = json.loads(json.dumps(base))
chromium.pop("browser_specific_settings", None)
chromium["background"].pop("scripts", None)

out = os.path.join(ROOT, "dist")
os.makedirs(out, exist_ok=True)
for name, manifest in (("firefox", firefox), ("chromium", chromium)):
    path = os.path.join(out, f"Logsmith-{version}-{name}.zip")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in FILES + ["icons/" + i for i in ICONS]:
            if rel == "manifest.json":
                z.writestr(rel, json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
            else:
                z.write(os.path.join(ROOT, rel), rel)
    print(path)
