# app.py
from __future__ import annotations

import os
import json
from datetime import datetime

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    jsonify,
    abort,
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "lightbearer_dev_secret")

CITIES = [
    "Yalahar",
    "Hellgate",
    "Ankrahmun",
    "Darashia",
    "Edron",
    "Kazordoon",
    "Goroma",
    "Svargrond",
    "Forbidden Island",
    "POH",
]

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "lightbearer")

# ---------- FIREBASE ----------
db = None
try:
    import firebase_admin
    from firebase_admin import credentials, firestore

    if "FIREBASE_SERVICE_ACCOUNT" in os.environ:
        service_info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
        cred = credentials.Certificate(service_info)
        firebase_admin.initialize_app(cred)
    else:
        # esto puede fallar si no hay credenciales por defecto
        firebase_admin.initialize_app()

    db = firestore.client()
except Exception as e:
    print("⚠️  Firebase NO inicializado:", e)
    db = None


def is_admin() -> bool:
    return session.get("is_admin", False)


def _character_doc(char_id: str):
    return db.collection("characters").document(char_id)


def _normalize_character(doc_snapshot):
    data = doc_snapshot.to_dict()
    data["id"] = doc_snapshot.id
    return data


def _safe_get_all_characters():
    """Devuelve [] si firestore no está o si falla la consulta."""
    if db is None:
        return []
    try:
        docs = db.collection("characters").order_by("created_at").stream()
        return [_normalize_character(d) for d in docs]
    except Exception as e:
        # muy importante: no matamos la request
        print("⚠️  No pude leer Firestore:", e)
        return []


# ---------- RUTAS ----------

@app.route("/")
def index():
    characters = _safe_get_all_characters()
    return render_template(
        "index.html",
        cities=CITIES,
        characters=characters,
        is_admin=is_admin(),
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = (request.form.get("password") or "").strip()
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["is_admin"] = True
            return redirect(url_for("index"))
        return render_template("login.html", error="Credenciales incorrectas"), 401

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


# ---------- API ----------

@app.route("/api/characters", methods=["GET"])
def api_list_characters():
    characters = _safe_get_all_characters()
    return jsonify({"characters": characters})


@app.route("/api/characters", methods=["POST"])
def api_create_character():
    if not is_admin():
        abort(403)

    if db is None:
        return jsonify({"error": "firebase not configured"}), 500

    payload = request.get_json(force=True, silent=False)
    name = (payload.get("name") or "").strip()
    level = int(payload.get("level") or 0)

    if not name:
        return jsonify({"error": "name is required"}), 400

    cities_data = {city: False for city in CITIES}

    doc_ref = db.collection("characters").document()
    doc_ref.set(
        {
            "name": name,
            "level": level,
            "cities": cities_data,
            "created_at": datetime.utcnow(),
        }
    )

    saved = doc_ref.get()
    return jsonify(_normalize_character(saved)), 201


@app.route("/api/characters/<string:char_id>", methods=["PATCH"])
def api_update_character(char_id: str):
    if not is_admin():
        abort(403)
    if db is None:
        return jsonify({"error": "firebase not configured"}), 500

    payload = request.get_json(force=True, silent=False)
    doc_ref = _character_doc(char_id)
    snap = doc_ref.get()
    if not snap.exists:
        return jsonify({"error": "character not found"}), 404

    updates = {}
    if "name" in payload:
        updates["name"] = (payload["name"] or "").strip()
    if "level" in payload:
        updates["level"] = int(payload["level"])

    if "cities" in payload and isinstance(payload["cities"], dict):
        current = snap.to_dict().get("cities", {})
        for city in CITIES:
            if city in payload["cities"]:
                current[city] = bool(payload["cities"][city])
        updates["cities"] = current

    if updates:
        doc_ref.update(updates)

    snap = doc_ref.get()
    return jsonify(_normalize_character(snap))


@app.route("/api/characters/<string:char_id>", methods=["DELETE"])
def api_delete_character(char_id: str):
    if not is_admin():
        abort(403)
    if db is None:
        return jsonify({"error": "firebase not configured"}), 500

    doc_ref = _character_doc(char_id)
    snap = doc_ref.get()
    if not snap.exists:
        return jsonify({"error": "character not found"}), 404

    doc_ref.delete()
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
