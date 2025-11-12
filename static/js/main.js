let characters = [];

const boardBody = document.getElementById("boardBody");
const searchNameInput = document.getElementById("searchName");
const cityFilterSelect = document.getElementById("cityFilter");
const totalCountSpan = document.getElementById("totalCount");
const addForm = document.getElementById("addCharacterForm");

let currentStatusFilter = "all"; // all | pending | complete

// ===== Helpers =====

function getDB() {
    if (typeof firebase === "undefined") {
        console.error("Firebase no está cargado.");
        return null;
    }
    try {
        return firebase.database();
    } catch (e) {
        console.error("Firebase no inicializado correctamente:", e);
        return null;
    }
}

function normalizeCities(citiesObj = {}) {
    const normalized = {};
    CITIES.forEach(city => {
        normalized[city] = !!citiesObj[city];
    });
    return normalized;
}

function isCharacterComplete(char) {
    return CITIES.every(city => char.cities[city]);
}

function countDoneCities(char) {
    return CITIES.reduce((acc, city) => acc + (char.cities[city] ? 1 : 0), 0);
}

function sortCharacters(list) {
    const incompletos = [];
    const completos = [];

    list.forEach(char => {
        const done = countDoneCities(char);
        if (done === CITIES.length) {
            completos.push(char);   // todos completos → bloque final
        } else {
            incompletos.push(char); // pendientes → por progreso
        }
    });

    incompletos.sort((a, b) => {
        const aDone = countDoneCities(a);
        const bDone = countDoneCities(b);
        if (bDone !== aDone) return bDone - aDone;
        return a.name.localeCompare(b.name);
    });

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
    if (!totalCountSpan) return;
    totalCountSpan.textContent = `Total: ${characters.length}`;
}

function updateCityColumnsVisibility() {
    if (!cityFilterSelect) return;
    const selectedCity = cityFilterSelect.value;
    const ths = document.querySelectorAll("th.city-col");
    const rows = document.querySelectorAll("#boardBody tr");

    ths.forEach(th => {
        const city = th.dataset.city;
        th.style.display =
            selectedCity === "all" || selectedCity === city ? "" : "none";
    });

    rows.forEach(tr => {
        CITIES.forEach(city => {
            const cell = tr.querySelector(`td[data-city="${city}"]`);
            if (!cell) return;
            cell.style.display =
                selectedCity === "all" || selectedCity === city ? "" : "none";
        });
    });
}

// ===== Render =====

function renderTable() {
    const filtered = applyFilters(characters);
    const sorted = sortCharacters(filtered);

    boardBody.innerHTML = "";

    sorted.forEach(char => {
        const tr = document.createElement("tr");
        if (isCharacterComplete(char)) tr.classList.add("row-complete");

        // Nombre
        const nameTd = document.createElement("td");
        nameTd.className = "name-cell";
        nameTd.textContent = char.name;
        tr.appendChild(nameTd);

        // Level
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
                    toggleCity(char.id, city, input.checked);
                });
            } else {
                input.disabled = true;
                input.style.cursor = "default";
            }

            td.appendChild(input);
            tr.appendChild(td);
        });

        // Acciones solo admin
        if (IS_ADMIN) {
            const actionsTd = document.createElement("td");
            actionsTd.className = "actions-cell";

            const editBtn = document.createElement("button");
            editBtn.textContent = "Editar";
            editBtn.classList.add("edit-btn");
            editBtn.addEventListener("click", () => editCharacter(char));

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Borrar";
            deleteBtn.classList.add("delete-btn");
            deleteBtn.addEventListener("click", () => deleteCharacter(char.id));

            actionsTd.appendChild(editBtn);
            actionsTd.appendChild(deleteBtn);
            tr.appendChild(actionsTd);
        }

        boardBody.appendChild(tr);
    });

    updateCityColumnsVisibility();
    updateTotalCount();
}

// ===== Firebase Sync =====

function subscribeToCharacters() {
    const db = getDB();
    if (!db) return;

    db.ref("characters").on(
        "value",
        snapshot => {
            const data = snapshot.val() || {};
            const list = [];

            Object.entries(data).forEach(([id, value]) => {
                list.push({
                    id,
                    name: value.name || "",
                    level: value.level || 0,
                    cities: normalizeCities(value.cities || {})
                });
            });

            characters = list;
            renderTable();
        },
        error => {
            console.error("Error escuchando characters en Firebase:", error);
        }
    );
}

// ===== CRUD Firebase =====

function addCharacterToDB(name, level) {
    const db = getDB();
    if (!db) return Promise.reject("DB no disponible");

    const ref = db.ref("characters").push();
    const char = {
        name,
        level: Number(level) || 0,
        cities: normalizeCities({})
    };
    return ref.set(char);
}

function updateCharacterInDB(id, updates) {
    const db = getDB();
    if (!db) return Promise.reject("DB no disponible");
    return db.ref(`characters/${id}`).update(updates);
}

function deleteCharacterFromDB(id) {
    const db = getDB();
    if (!db) return Promise.reject("DB no disponible");
    return db.ref(`characters/${id}`).remove();
}

function toggleCityInDB(id, city, done) {
    const db = getDB();
    if (!db) return Promise.reject("DB no disponible");
    return db.ref(`characters/${id}/cities/${city}`).set(!!done);
}

// ===== Handlers UI =====

async function addCharacter(ev) {
    ev.preventDefault();

    if (!IS_ADMIN) {
        console.warn("Intento de agregar sin ser admin.");
        return;
    }

    const name = document.getElementById("charName").value.trim();
    const level = document.getElementById("charLevel").value;

    if (!name) return;

    try {
        await addCharacterToDB(name, level);
        document.getElementById("charName").value = "";
        document.getElementById("charLevel").value = "";
    } catch (err) {
        console.error("Error agregando personaje en Firebase:", err);
        alert("No se pudo agregar el personaje. Revisa la consola.");
    }
}

async function editCharacter(char) {
    if (!IS_ADMIN) return;

    const newName = prompt("Nuevo nombre:", char.name);
    if (newName === null) return;

    const newLevel = prompt("Nuevo nivel:", char.level);
    if (newLevel === null) return;

    try {
        await updateCharacterInDB(char.id, {
            name: newName.trim() || char.name,
            level: Number(newLevel) || char.level
        });
    } catch (err) {
        console.error("Error editando personaje:", err);
    }
}

async function deleteCharacter(id) {
    if (!IS_ADMIN) return;
    if (!confirm("¿Eliminar este personaje?")) return;

    try {
        await deleteCharacterFromDB(id);
    } catch (err) {
        console.error("Error eliminando personaje:", err);
    }
}

async function toggleCity(id, city, done) {
    if (!IS_ADMIN) return;

    try {
        await toggleCityInDB(id, city, done);
    } catch (err) {
        console.error("Error cambiando estado de ciudad:", err);
    }
}

// ===== Status filter pills =====

function setupStatusFilter() {
    const pills = document.querySelectorAll(".status-pill");
    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentStatusFilter = pill.dataset.status || "all";
            renderTable();
        });
    });
}

// ===== Init =====

window.addEventListener("DOMContentLoaded", () => {
    if (addForm) {
        addForm.addEventListener("submit", addCharacter);
    }

    if (searchNameInput) {
        searchNameInput.addEventListener("input", renderTable);
    }

    if (cityFilterSelect) {
        cityFilterSelect.addEventListener("change", renderTable);
    }

    setupStatusFilter();
    subscribeToCharacters();
});
