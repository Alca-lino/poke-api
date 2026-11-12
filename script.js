const API_BASE = "https://pokeapi.co/api/v2";
const STORAGE_KEY = "pokedeck_lanes_v1";
const DEFAULT_LANES = ["fire", "water", "electric"];
const ITEMS_PER_LANE = 10;
const SUGGESTIONS = ["fire", "water", "grass", "ghost", "dragon", "steel", "psychic", "fairy"];

let lanes = loadSavedLanes();

// Referencias del DOM
const lanesContainer = document.getElementById("lanes-container");
const addModal = document.getElementById("add-modal");
const addLaneForm = document.getElementById("add-lane-form");
const typeInput = document.getElementById("type-input");
const formError = document.getElementById("form-error");
const quickTagsContainer = document.getElementById("quick-tags");
const detailModal = document.getElementById("detail-modal");

function loadSavedLanes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [...DEFAULT_LANES];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_LANES];
    } catch {
        return [...DEFAULT_LANES];
    }
}

function saveLanes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lanes));
}

function pickRandomSample(list, count) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
}

// Renderiza la estructura base de todos los carriles
function renderBoard() {
    lanesContainer.innerHTML = "";

    lanes.forEach((typeName) => {
        const laneEl = document.createElement("section");
        laneEl.className = "lane";
        laneEl.dataset.type = typeName;

        laneEl.innerHTML = `
      <div class="lane-header">
        <span class="lane-title">/type/${typeName}</span>
        <div class="lane-actions">
          <button type="button" class="btn-text btn-refresh">Actualizar</button>
          <button type="button" class="btn-text danger btn-delete">Eliminar</button>
        </div>
      </div>
      <div class="lane-feed"></div>
    `;

        laneEl.querySelector(".btn-refresh").addEventListener("click", () => {
            fetchLaneData(typeName, laneEl.querySelector(".lane-feed"));
        });

        laneEl.querySelector(".btn-delete").addEventListener("click", () => {
            removeLane(typeName);
        });

        lanesContainer.appendChild(laneEl);
        fetchLaneData(typeName, laneEl.querySelector(".lane-feed"));
    });

    // Botón final para añadir nuevo carril
    const addSlotBtn = document.createElement("button");
    addSlotBtn.type = "button";
    addSlotBtn.className = "add-lane-slot";
    addSlotBtn.textContent = "+ Añadir carril";
    addSlotBtn.addEventListener("click", openAddModal);
    lanesContainer.appendChild(addSlotBtn);
}

// Consulta la PokéAPI para un carril específico
async function fetchLaneData(typeName, feedEl) {
    feedEl.innerHTML = Array.from({ length: 6 })
        .map(() => `<div class="skeleton"></div>`)
        .join("");

    try {
        const response = await fetch(`${API_BASE}/type/${encodeURIComponent(typeName)}`);
        if (!response.ok) {
            throw new Error("No se pudo cargar el tipo desde PokéAPI.");
        }

        const typeData = await response.json();
        const entries = typeData.pokemon || [];

        if (entries.length === 0) {
            feedEl.innerHTML = `<p class="lane-message">No hay Pokémon registrados para este tipo.</p>`;
            return;
        }

        const sample = pickRandomSample(entries, ITEMS_PER_LANE);
        const pokemonList = await Promise.all(
            sample.map(async (item) => {
                const res = await fetch(item.pokemon.url);
                if (!res.ok) return null;
                return res.json();
            })
        );

        const validPokemon = pokemonList.filter(Boolean);
        feedEl.innerHTML = "";

        validPokemon.forEach((poke) => {
            feedEl.appendChild(createPokemonCard(poke));
        });
    } catch (error) {
        feedEl.innerHTML = `<p class="lane-message">${error.message}</p>`;
    }
}

function createPokemonCard(poke) {
    const totalStats = poke.stats.reduce((acc, s) => acc + s.base_stat, 0);
    const typesText = poke.types.map((t) => t.type.name).join(" · ");
    const abilityText = poke.abilities[0] ? poke.abilities[0].ability.name.replace("-", " ") : "none";
    const sprite =
        poke.sprites.front_default ||
        poke.sprites.other?.["official-artwork"]?.front_default ||
        "";

    const card = document.createElement("button");
    card.type = "button";
    card.className = "poke-card";
    card.innerHTML = `
    <div class="vote-col" title="Suma de estadísticas base">
      <span class="vote-arrow">▲</span>
      <span class="vote-count">${totalStats}</span>
    </div>
    <img class="poke-sprite" src="${sprite}" alt="${poke.name}" loading="lazy" />
    <div class="poke-info">
      <div class="poke-name">${poke.name}</div>
      <div class="poke-meta">#${String(poke.id).padStart(3, "0")} · ${typesText} · ${abilityText}</div>
    </div>
  `;

    card.addEventListener("click", () => openDetailModal(poke));
    return card;
}

function removeLane(typeName) {
    lanes = lanes.filter((t) => t !== typeName);
    saveLanes();
    renderBoard();
}

// Gestión del modal para añadir carril
function openAddModal() {
    formError.classList.add("hidden");
    formError.textContent = "";
    typeInput.value = "";
    addModal.classList.remove("hidden");
    typeInput.focus();
}

function closeAddModal() {
    addModal.classList.add("hidden");
}

function showFormError(msg) {
    formError.textContent = msg;
    formError.classList.remove("hidden");
}

addLaneForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const normalized = typeInput.value.trim().toLowerCase();

    if (!normalized) {
        showFormError("Escribe el nombre de un tipo.");
        return;
    }

    if (lanes.includes(normalized)) {
        showFormError("Ese carril ya está abierto en el tablero.");
        return;
    }

    const submitBtn = document.getElementById("btn-submit-lane");
    submitBtn.disabled = true;
    submitBtn.textContent = "Verificando...";
    formError.classList.add("hidden");

    try {
        const res = await fetch(`${API_BASE}/type/${encodeURIComponent(normalized)}`);
        if (!res.ok) {
            throw new Error(`El tipo "${normalized}" no existe en PokéAPI.`);
        }

        lanes.push(normalized);
        saveLanes();
        closeAddModal();
        renderBoard();
    } catch (err) {
        showFormError(err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Añadir";
    }
});

// Modal de detalle
function openDetailModal(poke) {
    document.getElementById("detail-id").textContent = `#${String(poke.id).padStart(3, "0")}`;
    document.getElementById("detail-name").textContent = poke.name;

    const artwork =
        poke.sprites.other?.["official-artwork"]?.front_default ||
        poke.sprites.front_default ||
        "";
    const imgEl = document.getElementById("detail-img");
    imgEl.src = artwork;
    imgEl.alt = poke.name;

    const typesContainer = document.getElementById("detail-types");
    typesContainer.innerHTML = poke.types
        .map((t) => `<span class="badge">${t.type.name}</span>`)
        .join("");

    const heightM = (poke.height / 10).toFixed(1);
    const weightKg = (poke.weight / 10).toFixed(1);
    document.getElementById("detail-physical").textContent = `Altura: ${heightM} m · Peso: ${weightKg} kg`;

    const abilities = poke.abilities.map((a) => a.ability.name.replace("-", " ")).join(", ");
    document.getElementById("detail-abilities").textContent = `Habilidades: ${abilities}`;

    const statsContainer = document.getElementById("detail-stats");
    statsContainer.innerHTML = poke.stats
        .map((s) => {
            const label = s.stat.name.replace("-", " ");
            const pct = Math.min(100, Math.round((s.base_stat / 200) * 100));
            return `
        <div class="stat-row">
          <span class="stat-label">${label}</span>
          <span class="stat-val">${s.base_stat}</span>
          <div class="stat-track">
            <div class="stat-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
        })
        .join("");

    document.getElementById("detail-json-link").href = `${API_BASE}/pokemon/${poke.id}`;
    detailModal.classList.remove("hidden");
}

function closeDetailModal() {
    detailModal.classList.add("hidden");
}

// Etiquetas rápidas en el modal de añadir carril
function renderQuickTags() {
    quickTagsContainer.innerHTML = "";
    SUGGESTIONS.forEach((tag) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tag-btn";
        btn.textContent = tag;
        btn.addEventListener("click", () => {
            typeInput.value = tag;
            typeInput.focus();
        });
        quickTagsContainer.appendChild(btn);
    });
}

// Eventos de cierre de modales
document.getElementById("btn-open-modal").addEventListener("click", openAddModal);
document.getElementById("btn-close-modal").addEventListener("click", closeAddModal);
document.getElementById("btn-cancel-modal").addEventListener("click", closeAddModal);
document.getElementById("btn-close-detail").addEventListener("click", closeDetailModal);
document.getElementById("btn-ok-detail").addEventListener("click", closeDetailModal);

addModal.addEventListener("click", (e) => {
    if (e.target === addModal) closeAddModal();
});

detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) closeDetailModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeAddModal();
        closeDetailModal();
    }
});

// Inicialización
renderQuickTags();
renderBoard();