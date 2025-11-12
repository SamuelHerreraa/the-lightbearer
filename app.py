from flask import Flask, render_template, request, redirect, url_for, session
import os
import logging  # ← NUEVO: Para logs detallados

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "lightbearer_dev_secret")

# Configura logging (nivel INFO para ver requests)
logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)

# Ciudades fijas para el tablero
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

def is_admin():
    return session.get("is_admin") is True

@app.route("/")
def index():
    app.logger.info(f"Request to / from {request.remote_addr} - User agent: {request.user_agent}")  # ← LOG REQUEST
    return render_template(
        "index.html",
        cities=CITIES,
        is_admin=is_admin()
    )

@app.route("/login", methods=["GET", "POST"])
def login():
    app.logger.info(f"Request to /login ({request.method}) from {request.remote_addr}")  # ← LOG REQUEST
    if is_admin():
        return redirect(url_for("index"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = (request.form.get("password") or "").strip()

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["is_admin"] = True
            app.logger.info(f"Admin login successful for {username}")
            return redirect(url_for("index"))
        else:
            app.logger.warning(f"Failed login attempt for {username}")
            return render_template("login.html", error="Usuario o contraseña incorrectos."), 401

    return render_template("login.html")

@app.route("/logout")
def logout():
    app.logger.info(f"Logout request from {request.remote_addr}")
    session.clear()
    return redirect(url_for("index"))

# ← CORREGIDO: Solo para desarrollo local, NO afecta Render
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # ← NUEVO: Usa puerto de Render
    app.run(host="0.0.0.0", port=port, debug=False)  # ← Cambiado: debug=False para prod