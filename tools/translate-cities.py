import concurrent.futures
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CITIES_FILE = ROOT / "public" / "cities.json"
CACHE_FILE = ROOT / "tools" / "city-name-ja.json"


def title_name(value):
    return " ".join(
        word[:1].upper() + word[1:].lower()
        for word in value.strip().split()
    )


def translate(name):
    query = urllib.parse.urlencode({
        "client": "gtx",
        "sl": "en",
        "tl": "ja",
        "dt": "t",
        "q": name,
    })
    url = "https://translate.googleapis.com/translate_a/single?" + query

    for attempt in range(3):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(request, timeout=15) as response:
                data = json.load(response)
            translated = "".join(part[0] for part in data[0] if part and part[0])
            if translated:
                return translated
        except Exception:
            if attempt < 2:
                time.sleep(1 + attempt)
    return name


cities = json.loads(CITIES_FILE.read_text(encoding="utf-8"))
names = sorted({city["name"] for city in cities})
cache = json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}

pending = [name for name in names if name not in cache]
print(f"{len(names)} unique names; {len(pending)} to translate")

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    future_map = {
        executor.submit(translate, name): name
        for name in pending
    }
    completed = 0
    for future in concurrent.futures.as_completed(future_map):
        name = future_map[future]
        cache[name] = future.result()
        completed += 1
        if completed % 100 == 0:
            CACHE_FILE.write_text(
                json.dumps(cache, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"translated {completed}/{len(pending)}")

CACHE_FILE.write_text(
    json.dumps(cache, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

for city in cities:
    city["name"] = cache.get(city["name"], city["name"])

CITIES_FILE.write_text(
    json.dumps(cities, ensure_ascii=False),
    encoding="utf-8",
)
print(f"updated {CITIES_FILE}")
