from flask import Flask, render_template, request, redirect, url_for, session
import os

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "lightbearer_dev_secret")

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
    return render_template(
        "index.html",
        cities=CITIES,
        is_admin=is_admin()
    )

@app.route("/login", methods=["GET", "POST"])
def login():
    if is_admin():
        return redirect(url_for("index"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = (request.form.get("password") or "").strip()

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["is_admin"] = True
            return redirect(url_for("index"))
        else:
            return render_template("login.html", error="Usuario o contraseña incorrectos."), 401

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))
