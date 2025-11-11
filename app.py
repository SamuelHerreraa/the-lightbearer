from flask import (
    Flask,
    render_template,
    jsonify,
    request,
    session,
    redirect,
    url_for
)
import json
import os
import threading

app = Flask(__name__)

# ===== CONFIG BÁSICA =====
# Cámbialo por algo más largo si quieres (solo local, pero igual recomendado).
app.secret_key = "lightbearer_super_secret_key"

DATA_FILE = os.path.join("data", "characters.json")
LOCK = threading.Lock()

DEFAULT_CITIES = [
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
]

# Admin hardcode local
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "lightbearer"  # cámbialo si quieres


# ===== UTIL =====

def is_admin():
    return session.get("is_admin") is True


def ensure_data_file():
    if not os.path.exists("data"):
        os.makedirs("data")

    if not os.path.exists(DATA_FILE):
        data = {
            "cities": DEFAULT_CITIES,
            "characters": []
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


def load_data():
    ensure_data_file()
    with LOCK:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)


def save_data(data):
    with LOCK:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


# ===== RUTAS HTML =====

@app.route("/")
def index():
    data = load_data()
    return render_template(
        "index.html",
        cities=data["cities"],
        is_admin=is_admin()
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    # Si ya es admin, directo al tablero
    if is_admin():
        return redirect(url_for("index"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = (request.form.get("password") or "").strip()

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["is_admin"] = True
            return redirect(url_for("index"))
        else:
            return render_template(
                "login.html",
                error="Usuario o contraseña incorrectos."
            ), 401

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


# ===== API PERSONAJES (GET libre, mutaciones solo admin) =====

@app.route("/api/characters", methods=["GET"])
def get_characters():
    data = load_data()
    return jsonify(data["characters"])


@app.route("/api/characters", methods=["POST"])
def create_character():
    if not is_admin():
        return jsonify({"error": "No autorizado."}), 403

    payload = request.get_json(force=True)

    name = (payload.get("name") or "").strip()
    level = payload.get("level")

    if not name:
        return jsonify({"error": "El nombre es obligatorio."}), 400

    try:
        level = int(level)
    except (TypeError, ValueError):
        level = 0

    data = load_data()
    cities = data["cities"]

    if data["characters"]:
        new_id = max(c["id"] for c in data["characters"]) + 1
    else:
        new_id = 1

    city_status = {city: False for city in cities}

    new_char = {
        "id": new_id,
        "name": name,
        "level": level,
        "cities": city_status
    }

    data["characters"].append(new_char)
    save_data(data)

    return jsonify(new_char), 201


@app.route("/api/characters/<int:char_id>", methods=["PUT"])
def update_character(char_id):
    if not is_admin():
        return jsonify({"error": "No autorizado."}), 403

    payload = request.get_json(force=True)
    name = (payload.get("name") or "").strip()
    level = payload.get("level")

    data = load_data()
    chars = data["characters"]

    for c in chars:
        if c["id"] == char_id:
            if name:
                c["name"] = name
            try:
                c["level"] = int(level)
            except (TypeError, ValueError):
                pass

            save_data(data)
            return jsonify(c)

    return jsonify({"error": "Personaje no encontrado."}), 404


@app.route("/api/characters/<int:char_id>", methods=["DELETE"])
def delete_character(char_id):
    if not is_admin():
        return jsonify({"error": "No autorizado."}), 403

    data = load_data()
    chars = data["characters"]
    new_chars = [c for c in chars if c["id"] != char_id]

    if len(new_chars) == len(chars):
        return jsonify({"error": "Personaje no encontrado."}), 404

    data["characters"] = new_chars
    save_data(data)
    return jsonify({"success": True})


@app.route("/api/characters/<int:char_id>/toggle", methods=["PATCH"])
def toggle_city(char_id):
    if not is_admin():
        return jsonify({"error": "No autorizado."}), 403

    payload = request.get_json(force=True)
    city = payload.get("city")
    done = payload.get("done")

    if city is None or done is None:
        return jsonify({"error": "city y done son requeridos."}), 400

    data = load_data()
    cities = data["cities"]

    if city not in cities:
        return jsonify({"error": "Ciudad inválida."}), 400

    for c in data["characters"]:
        if c["id"] == char_id:
            c["cities"][city] = bool(done)
            save_data(data)
            return jsonify(c)

    return jsonify({"error": "Personaje no encontrado."}), 404


if __name__ == "__main__":
    ensure_data_file()
    app.run(host="127.0.0.1", port=5000, debug=True)
