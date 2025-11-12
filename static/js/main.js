// === Estado de la app ===
let characters = [];
let globalLastAction = null;

// === Elementos del DOM ===
const boardBody = document.getElementById("boardBody");
const searchNameInput = document.getElementById("searchName");
const cityFilterSelect = document.getElementById("cityFilter");
const totalCountSpan = document.getElementById("totalCount");
const addForm = document.getElementById("addCharacterForm");
const globalTimer = document.getElementById("globalTimer");
const nextRoundTime = document.getElementById("nextRoundTime");
const countdownDisplay = document.getElementById("countdownDisplay");
const riskWarning = document.getElementById("riskWarning");
const liveClock = document.getElementById("liveClock");

let currentStatusFilter = "all";

// ===== Firebase =====
function getDB() {
    if (typeof firebase === "undefined") {
        console.error("Firebase no está cargado.");
        return null;
    }
    try {
        return firebase.database();
    } catch (e) {
        console.error("Firebase no inicializado:", e);
        return null;
    }
}

// ===== Helpers =====
function normalizeCities(citiesObj = {}) {
    const normalized = {};
    CITIES.forEach(city => normalized[city] = !!citiesObj[city]);
    return normalized;
}

function isCharacterComplete(char) {
    return CITIES.every(city => char.cities[city]);
}

function countDoneCities(char) {
    return CITIES.reduce((acc, city) => acc + (char.cities[city] ? 1 : 0), 0);
}

function sortCharacters(list) {
    const incompletos = [], completos = [];
    list.forEach(char => isCharacterComplete(char) ? completos.push(char) : incompletos.push(char));
    incompletos.sort((a, b) => countDoneCities(b) - countDoneCities(a) || a.name.localeCompare(b.name));
    completos.sort((a, b) => a.name.localeCompare(b.name));
    return incompletos.concat(completos);
}

function applyFilters(list) {
    const searchText = (searchNameInput?.value || "").trim().toLowerCase();
    return list.filter(char => {
        if (searchText && !char.name.toLowerCase().includes(searchText)) return false;
        const complete = isCharacterComplete(char);
        if (currentStatusFilter === "pending" && complete) return false;
        if (currentStatusFilter === "complete" && !complete) return false;
        return true;
    });
}

function updateTotalCount() {
    totalCountSpan.textContent = `Total: ${characters.length}`;
}

function updateCityColumnsVisibility() {
    const selectedCity = cityFilterSelect.value;
    document.querySelectorAll("th.city-col, #boardBody td[data-city]").forEach(el => {
        const city = el.dataset.city;
        el.style.display = (selectedCity === "all" || selectedCity === city) ? "" : "none";
    });
}

// ===== Reloj en vivo (Monterrey) =====
function updateLiveClock() {
    const now = new Date();
    const options = { 
        timeZone: 'America/Monterrey', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    };
    const timeStr = now.toLocaleTimeString('es-MX', options); // Ej: "01:25 a. m."
    liveClock.textContent = `Monterrey: ${timeStr}`;
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

// ===== Timer Global =====
function updateGlobalTimer() {
    if (!globalLastAction) {
        globalTimer.style.display = 'none';
        return;
    }
    globalTimer.style.display = 'block';

    const now = Date.now();
    const diff = now - globalLastAction;

    // === CONFIGURACIÓN DE TIEMPO ===
    // PARA PRUEBAS: 5 minutos + 1 minuto de riesgo
    // const idealMs = 5 * 60 * 1000;           // 5 minutos
    // const riskMs = idealMs + 60 * 1000;      // +1 minuto (riesgo)

    // === PARA PRODUCCIÓN: descomenta esto ===
    const idealMs = 2 * 60 * 60 * 1000;     // 2 horas
    const riskMs = idealMs + 30 * 60 * 1000; // +30 minutos

    // === Hora ideal (HH:MM) ===
    const nextIdeal = new Date(globalLastAction + idealMs);
    const timeOptions = { timeZone: 'America/Monterrey', hour: '2-digit', minute: '2-digit', hour12: true };
    nextRoundTime.textContent = nextIdeal.toLocaleTimeString('es-MX', timeOptions);

    // === Formato HH:MM:SS para el conteo ===
    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    if (diff < idealMs) {
        const remaining = idealMs - diff;
        countdownDisplay.textContent = `Espera ${formatTime(remaining)}`;
        countdownDisplay.style.color = '#f87171';
        riskWarning.textContent = '';
    } else if (diff < riskMs) {
        const timeInRisk = diff - idealMs;
        countdownDisplay.textContent = `LISTO! Haz la siguiente`;
        countdownDisplay.style.color = '#22c55e';
        riskWarning.textContent = `Riesgo en ${formatTime(riskMs - diff)}`;
        riskWarning.style.color = '#fb923c';
    } else {
        const timeOver = diff - riskMs;
        countdownDisplay.textContent = `URGENTE! Ya pasó el límite`;
        countdownDisplay.style.color = '#ef4444';
        riskWarning.textContent = `+${formatTime(timeOver)} en riesgo`;
        riskWarning.style.color = '#dc2626';
    }
}
setInterval(updateGlobalTimer, 1000);

// ===== Render Table =====
function renderTable() {
    const filtered = applyFilters(characters);
    const sorted = sortCharacters(filtered);
    boardBody.innerHTML = "";

    // === BUSCAR EL ÚLTIMO YALAHAR MARCADO (MÁS RECIENTE) ===
    let latestLastAction = null;

    characters.forEach(char => {
        if (char.cities["Yalahar"] && char.lastAction) {
            if (!latestLastAction || char.lastAction > latestLastAction) {
                latestLastAction = char.lastAction;
            }
        }
    });

    globalLastAction = latestLastAction; // <-- ¡SIEMPRE EL MÁS NUEVO!

    // === DIBUJAR FILAS ===
    sorted.forEach(char => {
        const tr = document.createElement("tr");
        if (isCharacterComplete(char)) tr.classList.add("row-complete");

        // Nombre
        const nameTd = document.createElement("td");
        nameTd.className = "name-cell";
        nameTd.textContent = char.name;
        tr.appendChild(nameTd);

        // Nivel
        const levelTd = document.createElement("td");
        levelTd.className = "level-cell";
        levelTd.textContent = char.level || 0;
        tr.appendChild(levelTd);

        // Ciudades
        CITIES.forEach(city => {
            const td = document.createElement("td");
            td.dataset.city = city;

            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "city-checkbox";
            input.checked = !!char.cities[city];

            if (IS_ADMIN) {
                input.addEventListener("change", () => {
                    const isChecked = input.checked;

                    // === SI ES YALAHAR: REINICIAR CONTEO INMEDIATAMENTE ===
                    if (city === "Yalahar") {
                        const now = Date.now();
                        updateCharacterInDB(char.id, { lastAction: now }).then(() => {
                            globalLastAction = now;  // Forzar actualización global
                            updateGlobalTimer();     // Refrescar timer YA
                        });
                    }

                    // Marcar/desmarcar ciudad
                    toggleCityInDB(char.id, city, isChecked);
                });
            } else {
                input.disabled = true;
            }

            td.appendChild(input);
            tr.appendChild(td);
        });

        // === BOTONES ADMIN ===
        if (IS_ADMIN) {
            const actionsTd = document.createElement("td");
            actionsTd.className = "actions-cell";

            const forceBtn = document.createElement("button");
            forceBtn.textContent = "Reloj";
            forceBtn.classList.add("force-time-btn");
            forceBtn.title = "Forzar inicio de conteo";
            forceBtn.addEventListener("click", () => {
                const now = Date.now();
                updateCharacterInDB(char.id, { lastAction: now }).then(() => {
                    globalLastAction = now;
                    updateGlobalTimer();
                });
            });

            const editBtn = document.createElement("button");
            editBtn.textContent = "Editar";
            editBtn.classList.add("edit-btn");
            editBtn.addEventListener("click", () => editCharacter(char));

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Borrar";
            deleteBtn.classList.add("delete-btn");
            deleteBtn.addEventListener("click", () => deleteCharacter(char.id));

            actionsTd.appendChild(forceBtn);
            actionsTd.appendChild(editBtn);
            actionsTd.appendChild(deleteBtn);
            tr.appendChild(actionsTd);
        }

        boardBody.appendChild(tr);
    });

    // === ACTUALIZAR UI ===
    updateCityColumnsVisibility();
    updateTotalCount();
    updateGlobalTimer(); // ← Refresca con el nuevo lastAction
}

// ===== Firebase Sync =====
function subscribeToCharacters() {
    const db = getDB();
    if (!db) return;

    db.ref("characters").on("value", snapshot => {
        const data = snapshot.val() || {};
        const list = [];
        Object.entries(data).forEach(([id, value]) => {
            list.push({
                id,
                name: value.name || "",
                level: value.level || 0,
                cities: normalizeCities(value.cities || {}),
                lastAction: value.lastAction || null
            });
        });
        characters = list;
        renderTable();
    });
}

// ===== CRUD =====
function addCharacterToDB(name, level) {
    const db = getDB();
    const ref = db.ref("characters").push();
    return ref.set({
        name,
        level: Number(level) || 0,
        cities: normalizeCities({}),
        lastAction: null
    });
}

function updateCharacterInDB(id, updates) {
    const db = getDB();
    return db.ref(`characters/${id}`).update(updates);
}

function deleteCharacterFromDB(id) {
    const db = getDB();
    return db.ref(`characters/${id}`).remove();
}

function toggleCityInDB(id, city, done) {
    const db = getDB();
    return db.ref(`characters/${id}/cities/${city}`).set(!!done);
}

// ===== Handlers =====
async function addCharacter(ev) {
    ev.preventDefault();
    if (!IS_ADMIN) return;
    const name = document.getElementById("charName").value.trim();
    const level = document.getElementById("charLevel").value;
    if (!name) return;
    await addCharacterToDB(name, level);
    document.getElementById("charName").value = "";
    document.getElementById("charLevel").value = "";
}

async function editCharacter(char) {
    if (!IS_ADMIN) return;
    const newName = prompt("Nombre:", char.name);
    if (newName === null) return;
    const newLevel = prompt("Nivel:", char.level);
    if (newLevel === null) return;
    await updateCharacterInDB(char.id, { name: newName.trim() || char.name, level: Number(newLevel) || char.level });
}

async function deleteCharacter(id) {
    if (!IS_ADMIN || !confirm("¿Borrar?")) return;
    await deleteCharacterFromDB(id);
}

// ===== Init =====
window.addEventListener("DOMContentLoaded", () => {
    if (addForm) addForm.addEventListener("submit", addCharacter);
    if (searchNameInput) searchNameInput.addEventListener("input", renderTable);
    if (cityFilterSelect) cityFilterSelect.addEventListener("change", renderTable);

    document.querySelectorAll(".status-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll(".status-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentStatusFilter = pill.dataset.status;
            renderTable();
        });
    });

    subscribeToCharacters();
});