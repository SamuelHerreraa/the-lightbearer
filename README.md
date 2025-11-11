# The Lightbearer - Control de Antorchas

Tablero web para organizar el evento **The Lightbearer** de Tibia con tu team.

- Vista general de personajes vs ciudades/antorchas.
- Checkboxes por ciudad para marcar progreso.
- Filtro por nombre, ciudad y estado (Todos / Pendientes / Completados).
- Modo **Admin** con CRUD completo.
- Modo **Espectador** (solo lectura) sin riesgo de que alguien mueva nada.
- Datos guardados en `data/characters.json` (solo para entorno local / un solo server).

---

## 🧩 Tecnologías

- Python + Flask
- HTML + CSS + JS vanilla
- Gunicorn (para producción tipo Render)
- JSON como almacenamiento ligero

---

## 🚀 Ejecutar localmente

Requisitos: Python 3.10+ instalado.

```bash
git clone https://github.com/SamuelHerreraa/the-lightbearer.git
cd the-lightbearer

pip install -r requirements.txt
