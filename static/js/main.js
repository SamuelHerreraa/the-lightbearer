let characters = [];

const boardBody = document.getElementById("boardBody");
const searchNameInput = document.getElementById("searchName");
const cityFilterSelect = document.getElementById("cityFilter");
const totalCountSpan = document.getElementById("totalCount");

let currentStatusFilter = "all"; // all | pending | complete


// ===== Helpers =====

function isCharacterComplete(char) {
    return CITIES.every(city => char.cities[city]);
}

function countDoneCities(char) {
    return CITIES.reduce((acc, city) => acc + (char.cities[city] ? 1 : 0), 0);
}

function sortCharacters(list) {
    const totalCities = CITIES.length;
    const incompletos = [];
    const completos = [];

    list.forEach(char => {
        const done = countDoneCities(char);
        if (done === totalCities) {
            completos.push(char);   // todos completos → van al final
        } else {
            incompletos.push(char); // pendientes → se ordenan por progreso
        }
    });

    incompletos.sort((a, b) => {
        const aDone = countDoneCities(a);
        const bDone = countDoneCities(b);
        if (bDone !== aDone) {
            return bDone - aDone; // más checks arriba
        }
        return a.name.localeCompare(b.name);
    });

    completos.sort((a, b) => a.name.localeCompare(b.name));

    return incompletos.concat(completos);
}

function applyFilters(list) {
    const searchText = searchNameInput.value.trim().toLowerCase();

    return list.filter(char => {
        if (searchText && !char.name.toLowerCase().includes(searchText)) {
            return false;
        }

        const complete = isCharacterComplete(char);

        if (currentStatusFilter === "pending" && complete) {
            return false;
        }
        if (currentStatusFilter === "complete" && !complete) {
            return false;
        }

        return true;
    });
}

function updateTotalCount() {
    if (!totalCountSpan) return;
    totalCountSpan.textContent = `Total: ${characters.length}`;
}


function updateCityColumnsVisibility() {
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
        if (isCharacterComplete(char)) {
            tr.classList.add("row-complete");
        }

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
                // Solo lectura: sin eventos, sin pointer
                input.disabled = true;
                input.style.cursor = "default";
            }

            td.appendChild(input);
            tr.appendChild(td);
        });

        // Acciones solo si es admin
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

// ===== API =====

async function fetchCharacters() {
    const res = await fetch("/api/characters");
    characters = await res.json();
    renderTable();
}

async function addCharacter(ev) {
    ev.preventDefault();
    if (!IS_ADMIN) return;

    const name = document.getElementById("charName").value.trim();
    const level = document.getElementById("charLevel").value;

    if (!name) return;

    const res = await fetch("/api/characters", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name, level})
    });

    if (!res.ok) return;

    const newChar = await res.json();
    characters.push(newChar);

    document.getElementById("charName").value = "";
    document.getElementById("charLevel").value = "";

    renderTable();
}

async function editCharacter(char) {
    if (!IS_ADMIN) return;

    const newName = prompt("Nuevo nombre:", char.name);
    if (newName === null) return;

    const newLevel = prompt("Nuevo nivel:", char.level);
    if (newLevel === null) return;

    const res = await fetch(`/api/characters/${char.id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name: newName, level: newLevel})
    });

    if (!res.ok) return;

    const updated = await res.json();
    const idx = characters.findIndex(c => c.id === char.id);
    if (idx !== -1) {
        characters[idx] = updated;
        renderTable();
    }
}

async function deleteCharacter(id) {
    if (!IS_ADMIN) return;
    if (!confirm("¿Eliminar este personaje?")) return;

    const res = await fetch(`/api/characters/${id}`, {
        method: "DELETE"
    });

    if (!res.ok) return;

    characters = characters.filter(c => c.id !== id);
    renderTable();
}

async function toggleCity(charId, city, done) {
    if (!IS_ADMIN) return;

    const res = await fetch(`/api/characters/${charId}/toggle`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({city, done})
    });

    if (!res.ok) {
        await fetchCharacters(); // rollback si fallo
        return;
    }

    const updated = await res.json();
    const idx = characters.findIndex(c => c.id === charId);
    if (idx !== -1) {
        characters[idx] = updated;
        renderTable();
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

// ===== Events init =====

if (document.getElementById("addCharacterForm")) {
    document.getElementById("addCharacterForm").addEventListener("submit", addCharacter);
}

searchNameInput.addEventListener("input", renderTable);
cityFilterSelect.addEventListener("change", () => {
    renderTable();
});

window.addEventListener("DOMContentLoaded", () => {
    setupStatusFilter();
    fetchCharacters();
});
