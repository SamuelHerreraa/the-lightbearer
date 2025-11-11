import json
import os

DATA_FILE = os.path.join("data", "characters.json")

# Lista nombre, nivel
NAMES_LEVELS = [
    ("Relentless Viktor", 404),
    ("Gsix Financiero", 394),
    ("Gthree Financiero", 392),
    ("Gseven Financiero", 387),
    ("Di Chaotic", 377),
    ("Lill Roy", 372),
    ("Di Gelao", 370),
    ("Di Punho", 369),
    ("Thel Faer", 349),
    ("Srsaurio", 342),
    ("Deon Wessane", 333),
    ("Drant Nith", 322),
    ("Lerum Tama", 314),
    ("Pette Zahott", 308),
    ("Piedrera", 299),
    ("Sacred Raged", 298),
    ("Clubekk", 295),
    ("Mercedesu Benzu", 291),
    ("Misthics", 282),
    ("Choco Perikin", 277),
    ("Dzenon", 275),
    ("Viktor Financiero", 275),
    ("Sroudners", 263),
    ("Rubber Majorana", 260),
    ("Di Fogo", 259),
    ("Ghost Financiero", 259),
    ("Exisoo", 252),
    ("Di Ice", 249),
    ("Venancio Masters", 247),
    ("Yabito", 246),
    ("Wicked Hueviny", 239),
    ("Di Sudden", 237),
    ("Neo Kyrox", 237),
    ("Art samurai", 235),
    ("Fredl samurai", 215),
    ("Gfour Financiero", 210),
    ("Brato Hawk", 206),
    ("Dion Ice", 201),
    ("Axzor Renegado", 200),
    ("Solan Drus", 200),
    ("Bakoren", 188),
    ("Lowkeyzada", 184),
    ("Forfundog", 183),
    ("Kyryto Von Maton", 172),
]

# Cargar JSON existente
if not os.path.exists(DATA_FILE):
    raise SystemExit(f"No se encontró {DATA_FILE}. Asegúrate de correr primero app.py una vez.")

with open(DATA_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

cities = data.get("cities", [
    "Yalahar",
    "Hellgate",
    "Ankrahmun",
    "Darashia",
    "Edron",
    "Kazordoon",
    "Goroma",
    "Svargrond",
    "Forbbiden Island",
    "POH"
])

characters = data.get("characters", [])
existing_names = {c["name"] for c in characters}
next_id = max((c.get("id", 0) for c in characters), default=0) + 1

added = 0
for name, level in NAMES_LEVELS:
    if name in existing_names:
        # Si ya existe, lo saltamos (evitamos duplicados)
        continue

    char = {
        "id": next_id,
        "name": name,
        "level": level,
        "cities": {city: False for city in cities}
    }
    characters.append(char)
    existing_names.add(name)
    next_id += 1
    added += 1

data["characters"] = characters

with open(DATA_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Listo. Agregados {added} personajes.")
