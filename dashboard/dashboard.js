// SIGEP PRM SC — DASHBOARD TERRITORIAL BUILD: DASHBOARD_TERRITORIAL_V1_0_3

import {
  supabase,
  configReady,
  escapeHtml
} from "../js/client.js";

window.__SIGEP_DASHBOARD_BUILD__ = "DASHBOARD_TERRITORIAL_V1_0_3";

const PUBLIC_RPC = "sigep_dashboard_publico_resumen_v1";
const DETAIL_RPC = "sigep_dashboard_detalle_estructura_v1";

const LEVEL_ORDER = [
  "PROVINCIA",
  "CIRCUNSCRIPCION",
  "MUNICIPIO",
  "DISTRITO MUNICIPAL",
  "REGION",
  "ZONA"
];

const LEVEL_LABELS = {
  PROVINCIA: "Provincia",
  CIRCUNSCRIPCION: "Circunscripción",
  MUNICIPIO: "Municipio",
  "DISTRITO MUNICIPAL": "Distrito Municipal",
  REGION: "Región",
  ZONA: "Zona"
};

const state = {
  payload: null,
  structures: [],
  levelSummaries: [],
  selectedLevel: "PROVINCIA",
  selectedTerritory: "",
  selectedRegion: "",
  selectedStructureCode: "",
  selectedStructure: null,
  session: null,
  detailRows: [],
  detailLoadedFor: ""
};

const els = {
  dataStatus: document.querySelector("#dataStatus"),
  levelSelect: document.querySelector("#levelSelect"),
  territoryControl: document.querySelector("#territoryControl"),
  territorySelect: document.querySelector("#territorySelect"),
  regionControl: document.querySelector("#regionControl"),
  regionSelect: document.querySelector("#regionSelect"),
  structureSelect: document.querySelector("#structureSelect"),
  resetFiltersButton: document.querySelector("#resetFiltersButton"),
  activePath: document.querySelector("#activePath"),

  kpiGlobal: document.querySelector("#kpiGlobal"),
  kpiAverage: document.querySelector("#kpiAverage"),
  kpiQuality: document.querySelector("#kpiQuality"),
  kpiEmpty: document.querySelector("#kpiEmpty"),

  selectedLevelLabel: document.querySelector("#selectedLevelLabel"),
  selectedStructureTitle: document.querySelector("#selectedStructureTitle"),
  selectedStructureMeta: document.querySelector("#selectedStructureMeta"),
  selectedState: document.querySelector("#selectedState"),
  selectedPercent: document.querySelector("#selectedPercent"),
  selectedMessage: document.querySelector("#selectedMessage"),
  progressRing: document.querySelector("#progressRing"),

  selectedNameQuality: document.querySelector("#selectedNameQuality"),
  selectedCedulaQuality: document.querySelector("#selectedCedulaQuality"),
  selectedPhoneQuality: document.querySelector("#selectedPhoneQuality"),
  selectedCompleteQuality: document.querySelector("#selectedCompleteQuality"),

  comparisonTitle: document.querySelector("#comparisonTitle"),
  comparisonList: document.querySelector("#comparisonList"),
  sectionCards: document.querySelector("#sectionCards"),

  qualityNameValue: document.querySelector("#qualityNameValue"),
  qualityCedulaValue: document.querySelector("#qualityCedulaValue"),
  qualityPhoneValue: document.querySelector("#qualityPhoneValue"),
  qualityCompleteValue: document.querySelector("#qualityCompleteValue"),

  qualityNameBar: document.querySelector("#qualityNameBar"),
  qualityCedulaBar: document.querySelector("#qualityCedulaBar"),
  qualityPhoneBar: document.querySelector("#qualityPhoneBar"),
  qualityCompleteBar: document.querySelector("#qualityCompleteBar"),

  sessionChip: document.querySelector("#sessionChip"),
  detailAccessTitle: document.querySelector("#detailAccessTitle"),
  loadDetailButton: document.querySelector("#loadDetailButton"),
  loginLink: document.querySelector("#loginLink"),
  detailWorkspace: document.querySelector("#detailWorkspace"),
  detailSearch: document.querySelector("#detailSearch"),
  detailStatusFilter: document.querySelector("#detailStatusFilter"),
  detailMissingFilter: document.querySelector("#detailMissingFilter"),
  detailTableBody: document.querySelector("#detailTableBody"),
  detailEmpty: document.querySelector("#detailEmpty"),
  toastRegion: document.querySelector("#toastRegion")
};

function parseJson(value) {
  if (value == null) return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function normalizeRegion(value) {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  const number = Number(digits);
  return Number.isFinite(number) ? String(number) : digits;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, numberValue(value)));
}

function percent(value) {
  return `${clampPercent(value).toFixed(2)}%`;
}

function stateClass(value) {
  return `state-${clean(value)
    .toUpperCase()
    .replace(/[ÁÀÄÂ]/g, "A")
    .replace(/[ÉÈËÊ]/g, "E")
    .replace(/[ÍÌÏÎ]/g, "I")
    .replace(/[ÓÒÖÔ]/g, "O")
    .replace(/[ÚÙÜÛ]/g, "U")
    .replace(/Ñ/g, "N")
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")}`;
}

function uniqueBy(items, keyFn) {
  const map = new Map();

  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  }

  return [...map.values()];
}

function sortNatural(items, keyFn) {
  return [...items].sort((a, b) =>
    clean(keyFn(a)).localeCompare(clean(keyFn(b)), "es", {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function levelLabel(level) {
  return LEVEL_LABELS[level] || clean(level) || "Estructura";
}

function territoryLabel(item) {
  return (
    clean(item?.distrito_municipal) ||
    clean(item?.municipio) ||
    clean(item?.territorio_codigo) ||
    clean(item?.estructura_nombre) ||
    "Territorio"
  );
}

function structureDisplayName(item) {
  if (!item) return "—";

  if (item.nivel === "PROVINCIA") {
    return clean(item.estructura_nombre) || "Provincia de San Cristóbal";
  }

  if (item.nivel === "CIRCUNSCRIPCION") {
    return clean(item.estructura_nombre) || `Circunscripción ${clean(item.circunscripcion)}`;
  }

  if (item.nivel === "MUNICIPIO") {
    return clean(item.municipio) || clean(item.estructura_nombre);
  }

  if (item.nivel === "DISTRITO MUNICIPAL") {
    return clean(item.distrito_municipal) || clean(item.estructura_nombre);
  }

  if (item.nivel === "REGION") {
    const region = clean(item.region);
    return region
      ? `Región ${region.padStart(2, "0")} · ${territoryLabel(item)}`
      : clean(item.estructura_nombre);
  }

  if (item.nivel === "ZONA") {
    return clean(item.estructura_nombre) || `Zona ${clean(item.zona)}`;
  }

  return clean(item.estructura_nombre) || "Estructura";
}

function compactComparisonName(item) {
  if (item.nivel === "ZONA") {
    const zone = clean(item.zona);
    const venue = clean(item.recinto);
    return venue ? `Zona ${zone} · ${venue}` : `Zona ${zone}`;
  }

  if (item.nivel === "REGION") {
    return `Región ${clean(item.region).padStart(2, "0")}`;
  }

  if (item.nivel === "CIRCUNSCRIPCION") {
    return `Circunscripción ${clean(item.circunscripcion)}`;
  }

  return structureDisplayName(item);
}

function structureMeta(item) {
  if (!item) return "—";

  const parts = [];

  if (clean(item.circunscripcion)) {
    parts.push(`Circunscripción ${clean(item.circunscripcion)}`);
  }

  const territory = territoryLabel(item);
  if (
    item.nivel === "REGION" ||
    item.nivel === "ZONA" ||
    item.nivel === "MUNICIPIO" ||
    item.nivel === "DISTRITO MUNICIPAL"
  ) {
    parts.push(territory);
  }

  if (item.nivel === "ZONA" && normalizeRegion(item.region) !== "0" && clean(item.region)) {
    parts.push(`Región ${normalizeRegion(item.region).padStart(2, "0")}`);
  }

  if (item.nivel === "ZONA" && clean(item.recinto)) {
    parts.push(clean(item.recinto));
  }

  return parts.length ? parts.join(" · ") : clean(item.provincia) || "San Cristóbal";
}

function selectedQuality(item) {
  const quality = item?.calidad_datos || {};

  return {
    name: clampPercent(quality.porcentaje_nombre),
    cedula: clampPercent(quality.porcentaje_cedula),
    phone: clampPercent(quality.porcentaje_telefono),
    complete: clampPercent(quality.porcentaje_datos_completos)
  };
}

function setStatus(kind, text) {
  els.dataStatus.classList.remove("ready", "error");
  if (kind) els.dataStatus.classList.add(kind);

  els.dataStatus.innerHTML = `
    <span class="status-dot"></span>
    <span>${escapeHtml(text)}</span>
  `;
}

function toast(message, kind = "") {
  const element = document.createElement("div");
  element.className = `toast ${kind}`.trim();
  element.textContent = message;

  els.toastRegion.appendChild(element);

  window.setTimeout(() => {
    element.remove();
  }, 4200);
}

function clearSelect(select, placeholder = "") {
  select.innerHTML = "";

  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
  }
}

function addOption(select, value, label, selected = false) {
  const option = document.createElement("option");
  option.value = clean(value);
  option.textContent = clean(label);
  option.selected = selected;
  select.appendChild(option);
}

function structuresForLevel(level = state.selectedLevel) {
  return state.structures.filter((item) => item.nivel === level);
}

function territoryOptionsForLevel(level) {
  const items = structuresForLevel(level);

  if (["PROVINCIA", "CIRCUNSCRIPCION", "MUNICIPIO", "DISTRITO MUNICIPAL"].includes(level)) {
    return sortNatural(
      items.map((item) => ({
        value: item.estructura_codigo,
        label: structureDisplayName(item),
        item
      })),
      (entry) => entry.label
    );
  }

  return sortNatural(
    uniqueBy(
      items
        .filter((item) => clean(item.territorio_codigo))
        .map((item) => ({
          value: clean(item.territorio_codigo),
          label: territoryLabel(item)
        })),
      (entry) => entry.value
    ),
    (entry) => entry.label
  );
}

function regionOptionsForTerritory() {
  const items = structuresForLevel(state.selectedLevel)
    .filter((item) => !state.selectedTerritory || clean(item.territorio_codigo) === state.selectedTerritory);

  const regions = uniqueBy(
    items.map((item) => {
      const normalized = normalizeRegion(item.region);
      const label = normalized === "0" || !normalized
        ? "Sin región formal"
        : `Región ${normalized.padStart(2, "0")}`;

      return {
        value: normalized,
        label
      };
    }),
    (entry) => entry.value
  );

  return sortNatural(regions, (entry) => {
    if (!entry.value || entry.value === "0") return "999";
    return entry.value;
  });
}

function candidateStructures() {
  let items = structuresForLevel(state.selectedLevel);

  if (["REGION", "ZONA"].includes(state.selectedLevel) && state.selectedTerritory) {
    items = items.filter(
      (item) => clean(item.territorio_codigo) === state.selectedTerritory
    );
  }

  if (state.selectedLevel === "ZONA" && state.selectedRegion !== "") {
    items = items.filter(
      (item) => normalizeRegion(item.region) === state.selectedRegion
    );
  }

  return sortNatural(items, (item) => {
    if (item.nivel === "ZONA") return `${clean(item.zona)} ${clean(item.recinto)}`;
    if (item.nivel === "REGION") return normalizeRegion(item.region).padStart(4, "0");
    if (item.nivel === "CIRCUNSCRIPCION") return clean(item.circunscripcion);
    return structureDisplayName(item);
  });
}

function syncFilterVisibility() {
  const level = state.selectedLevel;
  const usesTerritory = level !== "PROVINCIA";
  const usesRegion = level === "ZONA";

  els.territoryControl.hidden = !usesTerritory;
  els.regionControl.hidden = !usesRegion;
}

function populateTerritories() {
  clearSelect(els.territorySelect);

  const options = territoryOptionsForLevel(state.selectedLevel);

  if (!options.length) {
    addOption(els.territorySelect, "", "Sin opciones");
    els.territorySelect.disabled = true;
    state.selectedTerritory = "";
    return;
  }

  els.territorySelect.disabled = false;

  const valid = options.some((entry) => entry.value === state.selectedTerritory);
  if (!valid) state.selectedTerritory = options[0].value;

  for (const entry of options) {
    addOption(
      els.territorySelect,
      entry.value,
      entry.label,
      entry.value === state.selectedTerritory
    );
  }
}

function populateRegions() {
  clearSelect(els.regionSelect);

  if (state.selectedLevel !== "ZONA") {
    state.selectedRegion = "";
    els.regionSelect.disabled = true;
    return;
  }

  const options = regionOptionsForTerritory();

  if (!options.length) {
    addOption(els.regionSelect, "", "Sin región");
    state.selectedRegion = "";
    els.regionSelect.disabled = true;
    return;
  }

  els.regionSelect.disabled = false;

  const valid = options.some((entry) => entry.value === state.selectedRegion);
  if (!valid) state.selectedRegion = options[0].value;

  for (const entry of options) {
    addOption(
      els.regionSelect,
      entry.value,
      entry.label,
      entry.value === state.selectedRegion
    );
  }
}

function populateStructures() {
  clearSelect(els.structureSelect);

  let items = candidateStructures();

  if (
    ["CIRCUNSCRIPCION", "MUNICIPIO", "DISTRITO MUNICIPAL"].includes(state.selectedLevel)
  ) {
    const selectedByTerritory = items.find(
      (item) => item.estructura_codigo === state.selectedTerritory
    );

    if (selectedByTerritory) items = [selectedByTerritory];
  }

  if (!items.length) {
    addOption(els.structureSelect, "", "Sin estructuras");
    state.selectedStructureCode = "";
    state.selectedStructure = null;
    els.structureSelect.disabled = true;
    return;
  }

  els.structureSelect.disabled = false;

  const valid = items.some(
    (item) => item.estructura_codigo === state.selectedStructureCode
  );

  if (!valid) {
    state.selectedStructureCode = items[0].estructura_codigo;
  }

  for (const item of items) {
    addOption(
      els.structureSelect,
      item.estructura_codigo,
      compactComparisonName(item),
      item.estructura_codigo === state.selectedStructureCode
    );
  }

  state.selectedStructure =
    state.structures.find(
      (item) => item.estructura_codigo === state.selectedStructureCode
    ) || items[0];
}

function refreshFilters() {
  syncFilterVisibility();
  populateTerritories();
  populateRegions();
  populateStructures();
  renderAll();
}

function levelSummary(level) {
  return (
    state.levelSummaries.find((entry) => entry.nivel === level) || null
  );
}

function renderLevelKpis() {
  const summary = levelSummary(state.selectedLevel);

  els.kpiGlobal.textContent = summary
    ? percent(summary.porcentaje_avance_global)
    : "—";

  els.kpiAverage.textContent = summary
    ? percent(summary.porcentaje_promedio_estructuras)
    : "—";

  els.kpiQuality.textContent = summary
    ? percent(summary.porcentaje_calidad_global)
    : "—";

  els.kpiEmpty.textContent = summary
    ? percent(summary.porcentaje_estructuras_sin_informacion)
    : "—";
}

function messageForStructure(item) {
  const p = clampPercent(item?.porcentaje_avance);

  if (p === 0) {
    return "Esta estructura no tiene información registrada. El desglose inferior permite identificar qué secciones aún están vacías.";
  }

  if (p === 100) {
    return "La estructura tiene todas sus posiciones operativas ocupadas. Revisa también la calidad de nombre, cédula y teléfono principal.";
  }

  if (p >= 75) {
    return "La estructura está en una etapa avanzada. Las secciones y los indicadores de calidad muestran dónde concentrar la actualización pendiente.";
  }

  if (p >= 25) {
    return "La estructura está en proceso. Utiliza el desglose por secciones para identificar los bloques con menor cobertura.";
  }

  return "La estructura está iniciada y requiere completar una parte importante de sus posiciones operativas.";
}

function renderSelectedStructure() {
  const item = state.selectedStructure;

  if (!item) {
    els.selectedStructureTitle.textContent = "Sin estructura seleccionada";
    els.selectedStructureMeta.textContent = "—";
    els.selectedState.textContent = "SIN DATOS";
    els.selectedPercent.textContent = "—";
    els.progressRing.style.setProperty("--progress", "0deg");
    return;
  }

  const quality = selectedQuality(item);
  const p = clampPercent(item.porcentaje_avance);
  const status = clean(item.estado) || "SIN INFORMACIÓN REGISTRADA";

  els.selectedLevelLabel.textContent = levelLabel(item.nivel);
  els.selectedStructureTitle.textContent = structureDisplayName(item);
  els.selectedStructureMeta.textContent = structureMeta(item);

  els.selectedState.textContent = status;
  els.selectedState.className = `state-badge ${stateClass(status)}`;

  els.selectedPercent.textContent = percent(p);
  els.progressRing.style.setProperty("--progress", `${p * 3.6}deg`);
  els.progressRing.setAttribute(
    "aria-label",
    `${structureDisplayName(item)}: ${percent(p)} de avance`
  );

  els.selectedMessage.textContent = messageForStructure(item);

  els.selectedNameQuality.textContent = percent(quality.name);
  els.selectedCedulaQuality.textContent = percent(quality.cedula);
  els.selectedPhoneQuality.textContent = percent(quality.phone);
  els.selectedCompleteQuality.textContent = percent(quality.complete);
}

function comparisonScope() {
  let items = structuresForLevel(state.selectedLevel);

  if (state.selectedLevel === "REGION" && state.selectedTerritory) {
    items = items.filter(
      (item) => clean(item.territorio_codigo) === state.selectedTerritory
    );
  }

  if (state.selectedLevel === "ZONA") {
    if (state.selectedTerritory) {
      items = items.filter(
        (item) => clean(item.territorio_codigo) === state.selectedTerritory
      );
    }

    if (state.selectedRegion !== "") {
      items = items.filter(
        (item) => normalizeRegion(item.region) === state.selectedRegion
      );
    }
  }

  return sortNatural(items, (item) => compactComparisonName(item));
}

function renderComparison() {
  const items = comparisonScope();

  if (state.selectedLevel === "ZONA") {
    const regionLabel =
      state.selectedRegion === "0" || state.selectedRegion === ""
        ? "zonas del territorio"
        : `zonas de la Región ${state.selectedRegion.padStart(2, "0")}`;

    els.comparisonTitle.textContent = `Comparación de ${regionLabel}`;
  } else if (state.selectedLevel === "REGION") {
    els.comparisonTitle.textContent = "Regiones del territorio";
  } else {
    els.comparisonTitle.textContent = `${levelLabel(state.selectedLevel)} · comparación`;
  }

  if (!items.length) {
    els.comparisonList.innerHTML = `
      <div class="empty-placeholder">
        No hay estructuras disponibles para esta selección.
      </div>
    `;
    return;
  }

  els.comparisonList.innerHTML = items.map((item) => {
    const p = clampPercent(item.porcentaje_avance);
    const active =
      item.estructura_codigo === state.selectedStructureCode ? " active" : "";

    return `
      <div
        class="comparison-row${active}"
        data-structure-code="${escapeHtml(item.estructura_codigo)}"
        role="button"
        tabindex="0"
        title="${escapeHtml(structureDisplayName(item))}"
      >
        <span class="comparison-name">
          ${escapeHtml(compactComparisonName(item))}
        </span>

        <span class="comparison-track" aria-hidden="true">
          <span style="width:${p}%"></span>
        </span>

        <strong class="comparison-percent">${escapeHtml(percent(p))}</strong>
      </div>
    `;
  }).join("");

  els.comparisonList.querySelectorAll(".comparison-row").forEach((row) => {
    const activate = () => {
      const code = row.dataset.structureCode;
      if (!code) return;

      state.selectedStructureCode = code;
      els.structureSelect.value = code;

      state.selectedStructure =
        state.structures.find(
          (item) => item.estructura_codigo === code
        ) || null;

      resetDetail();
      renderAll({ skipComparison: false });
    };

    row.addEventListener("click", activate);

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });
}

function renderSections() {
  const item = state.selectedStructure;
  const sections = Array.isArray(item?.secciones) ? item.secciones : [];

  if (!sections.length) {
    els.sectionCards.innerHTML = `
      <article class="empty-placeholder branded-panel">
        <img class="panel-brand" src="../assets/logo-stdi.png" alt="" aria-hidden="true">
        Esta estructura no tiene secciones analíticas publicadas.
      </article>
    `;
    return;
  }

  els.sectionCards.innerHTML = sections.map((section) => {
    const p = clampPercent(section.porcentaje_avance);
    const status = clean(section.estado) || "SIN INFORMACIÓN REGISTRADA";
    const subsections = Array.isArray(section.subsecciones)
      ? section.subsecciones
      : [];

    const subsectionMarkup = subsections.length
      ? `
        <div class="subsection-list">
          ${subsections.map((sub) => `
            <div class="subsection-row">
              <span>${escapeHtml(sub.titulo || "Subsección")}</span>
              <strong>${escapeHtml(percent(sub.porcentaje_avance))}</strong>
            </div>
          `).join("")}
        </div>
      `
      : "";

    return `
      <article class="section-card branded-panel">
        <img class="panel-brand" src="../assets/logo-stdi.png" alt="" aria-hidden="true">

        <div class="section-card-top">
          <h3 class="section-card-title">
            ${escapeHtml(section.titulo || "Sección")}
          </h3>

          <strong class="section-percent">
            ${escapeHtml(percent(p))}
          </strong>
        </div>

        <div class="bar-track" aria-hidden="true">
          <span style="width:${p}%"></span>
        </div>

        <span class="section-card-state">
          ${escapeHtml(status)}
        </span>

        ${subsectionMarkup}
      </article>
    `;
  }).join("");
}

function setBar(element, value) {
  element.style.width = `${clampPercent(value)}%`;
}

function renderQuality() {
  const q = selectedQuality(state.selectedStructure);

  els.qualityNameValue.textContent = percent(q.name);
  els.qualityCedulaValue.textContent = percent(q.cedula);
  els.qualityPhoneValue.textContent = percent(q.phone);
  els.qualityCompleteValue.textContent = percent(q.complete);

  setBar(els.qualityNameBar, q.name);
  setBar(els.qualityCedulaBar, q.cedula);
  setBar(els.qualityPhoneBar, q.phone);
  setBar(els.qualityCompleteBar, q.complete);
}

function renderActivePath() {
  const item = state.selectedStructure;

  if (!item) {
    els.activePath.innerHTML = "";
    return;
  }

  const chips = [
    "San Cristóbal",
    levelLabel(item.nivel)
  ];

  if (clean(item.circunscripcion)) {
    chips.push(`Circ. ${clean(item.circunscripcion)}`);
  }

  if (["MUNICIPIO", "DISTRITO MUNICIPAL", "REGION", "ZONA"].includes(item.nivel)) {
    chips.push(territoryLabel(item));
  }

  if (item.nivel === "ZONA" && normalizeRegion(item.region) !== "0" && clean(item.region)) {
    chips.push(`Región ${normalizeRegion(item.region).padStart(2, "0")}`);
  }

  if (item.nivel === "ZONA") {
    chips.push(`Zona ${clean(item.zona)}`);
  } else if (item.nivel === "REGION") {
    chips.push(`Región ${normalizeRegion(item.region).padStart(2, "0")}`);
  }

  els.activePath.innerHTML = chips.map(
    (chip) => `<span class="path-chip">${escapeHtml(chip)}</span>`
  ).join("");
}

function resetDetail() {
  state.detailRows = [];
  state.detailLoadedFor = "";
  els.detailWorkspace.hidden = true;
  els.detailTableBody.innerHTML = "";
  els.detailSearch.value = "";
  els.detailStatusFilter.value = "TODOS";
  els.detailMissingFilter.value = "TODOS";
}

function renderSession() {
  const active = Boolean(state.session?.access_token);

  els.sessionChip.classList.remove("active", "error");

  if (active) {
    els.sessionChip.classList.add("active");
    els.sessionChip.innerHTML = `
      <span class="session-dot"></span>
      <span>Sesión activa</span>
    `;

    els.detailAccessTitle.textContent = "Detalle operativo disponible";
    els.loadDetailButton.hidden = false;
    els.loginLink.hidden = true;
  } else {
    els.sessionChip.innerHTML = `
      <span class="session-dot"></span>
      <span>Sin sesión</span>
    `;

    els.detailAccessTitle.textContent = "Detalle protegido";
    els.loadDetailButton.hidden = true;
    els.loginLink.hidden = false;
  }
}

function missingLabel(value) {
  const labels = {
    nombre: "Nombre",
    cedula: "Cédula",
    telefono_principal: "Teléfono"
  };

  return labels[value] || value;
}


/*
 * Mantiene en el detalle del Dashboard la misma etiqueta visual
 * utilizada por las fichas del Portal Territorial.
 *
 * IMPORTANTE:
 * En las Zonas, las 31 posiciones de Z_MIEMBROS conservan físicamente
 * sus cargos/códigos históricos en base de datos, pero visualmente
 * corresponden a "Miembro". El Dashboard no debe mostrar el cargo
 * físico preservado en esa sección.
 */
function detailDisplayCargo(row) {
  const sectionCode = clean(row?.seccion_codigo).toUpperCase();

  if (
    state.selectedStructure?.nivel === "ZONA" &&
    sectionCode === "Z_MIEMBROS"
  ) {
    return "Miembro";
  }

  return clean(row?.cargo) || "—";
}

function detailRowsFiltered() {
  const query = normalizeText(els.detailSearch.value);
  const status = els.detailStatusFilter.value;
  const missing = els.detailMissingFilter.value;

  return state.detailRows.filter((row) => {
    if (status !== "TODOS" && clean(row.estado_ficha) !== status) {
      return false;
    }

    const missingFields = Array.isArray(row.campos_faltantes)
      ? row.campos_faltantes
      : [];

    if (missing !== "TODOS" && !missingFields.includes(missing)) {
      return false;
    }

    if (query) {
      const haystack = normalizeText([
        detailDisplayCargo(row),
        row.estado_ficha,
        row.origen,
        missingFields.join(" ")
      ].join(" "));

      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function renderDetailTable() {
  const rows = detailRowsFiltered();

  els.detailEmpty.hidden = rows.length > 0;
  els.detailTableBody.innerHTML = rows.map((row) => {
    const missing = Array.isArray(row.campos_faltantes)
      ? row.campos_faltantes
      : [];

    const missingMarkup = missing.length
      ? `
        <div class="missing-tags">
          ${missing.map((field) => `
            <span class="missing-tag">
              ${escapeHtml(missingLabel(field))}
            </span>
          `).join("")}
        </div>
      `
      : `<span class="complete-mark">Completo</span>`;

    const status = clean(row.estado_ficha) || "INCOMPLETA";

    return `
      <tr>
        <td>
          ${escapeHtml(detailDisplayCargo(row))}
          ${clean(row.origen) ? `
            <div class="muted-origin">${escapeHtml(row.origen)}</div>
          ` : ""}
        </td>

        <td>
          <span class="row-status ${escapeHtml(status)}">
            ${escapeHtml(status)}
          </span>
        </td>

        <td>${missingMarkup}</td>
      </tr>
    `;
  }).join("");
}

async function loadDetail() {
  const structureCode = state.selectedStructureCode;

  if (!structureCode) {
    toast("Selecciona una estructura primero.", "error");
    return;
  }

  if (!state.session?.access_token) {
    toast("Necesitas una sesión activa para cargar el detalle.", "error");
    return;
  }

  els.loadDetailButton.disabled = true;
  els.loadDetailButton.textContent = "Cargando…";

  try {
    const { data, error } = await supabase.rpc(
      DETAIL_RPC,
      {
        p_estructura_codigo: structureCode
      }
    );

    if (error) throw error;

    const payload = parseJson(data);

    if (!payload || payload.ok !== true) {
      throw new Error(
        payload?.mensaje ||
        "No fue posible consultar el detalle de esta estructura."
      );
    }

    state.detailRows = Array.isArray(payload.registros)
      ? payload.registros
      : [];

    state.detailLoadedFor = structureCode;

    els.detailWorkspace.hidden = false;
    renderDetailTable();

    els.detailWorkspace.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    toast("Detalle operativo cargado en modo solo lectura.");
  } catch (error) {
    console.error("SIGEP Dashboard detail error:", error);

    toast(
      error?.message ||
      "No fue posible cargar el detalle operativo.",
      "error"
    );
  } finally {
    els.loadDetailButton.disabled = false;
    els.loadDetailButton.textContent = "Cargar detalle operativo";
  }
}

function renderAll(options = {}) {
  renderLevelKpis();
  renderSelectedStructure();

  if (!options.skipComparison) {
    renderComparison();
  }

  renderSections();
  renderQuality();
  renderActivePath();

  if (
    state.detailLoadedFor &&
    state.detailLoadedFor !== state.selectedStructureCode
  ) {
    resetDetail();
  }
}

async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    state.session = data.session || null;
  } catch (error) {
    console.error("SIGEP Dashboard session error:", error);
    state.session = null;
    els.sessionChip.classList.add("error");
  }

  renderSession();
}

async function loadPublicDashboard() {
  if (!configReady) {
    setStatus("error", "Configuración Supabase incompleta");
    throw new Error(
      "La configuración de Supabase no está disponible."
    );
  }

  setStatus("", "Cargando datos SIGEP…");

  const { data, error } = await supabase.rpc(PUBLIC_RPC);

  if (error) throw error;

  const payload = parseJson(data);

  if (!payload || payload.ok !== true) {
    throw new Error(
      payload?.mensaje ||
      "La RPC pública del dashboard no devolvió un resultado válido."
    );
  }

  const structures = Array.isArray(payload.estructuras)
    ? payload.estructuras
    : [];

  const summaries = Array.isArray(payload.resumen_por_nivel)
    ? payload.resumen_por_nivel
    : [];

  if (!structures.length) {
    throw new Error("El dashboard no recibió estructuras.");
  }

  state.payload = payload;
  state.structures = structures;
  state.levelSummaries = summaries;

  setStatus(
    "ready",
    "Datos SIGEP disponibles · solo lectura"
  );

  state.selectedLevel = "PROVINCIA";
  els.levelSelect.value = state.selectedLevel;

  refreshFilters();
}

function bindEvents() {
  els.levelSelect.addEventListener("change", () => {
    state.selectedLevel = els.levelSelect.value;
    state.selectedTerritory = "";
    state.selectedRegion = "";
    state.selectedStructureCode = "";
    state.selectedStructure = null;
    resetDetail();
    refreshFilters();
  });

  els.territorySelect.addEventListener("change", () => {
    state.selectedTerritory = els.territorySelect.value;
    state.selectedRegion = "";
    state.selectedStructureCode = "";
    state.selectedStructure = null;
    resetDetail();
    populateRegions();
    populateStructures();
    renderAll();
  });

  els.regionSelect.addEventListener("change", () => {
    state.selectedRegion = els.regionSelect.value;
    state.selectedStructureCode = "";
    state.selectedStructure = null;
    resetDetail();
    populateStructures();
    renderAll();
  });

  els.structureSelect.addEventListener("change", () => {
    state.selectedStructureCode = els.structureSelect.value;
    state.selectedStructure =
      state.structures.find(
        (item) =>
          item.estructura_codigo === state.selectedStructureCode
      ) || null;

    resetDetail();
    renderAll();
  });

  els.resetFiltersButton.addEventListener("click", () => {
    state.selectedLevel = "PROVINCIA";
    state.selectedTerritory = "";
    state.selectedRegion = "";
    state.selectedStructureCode = "";
    state.selectedStructure = null;

    els.levelSelect.value = state.selectedLevel;

    resetDetail();
    refreshFilters();
  });

  els.loadDetailButton.addEventListener("click", loadDetail);

  els.detailSearch.addEventListener("input", renderDetailTable);
  els.detailStatusFilter.addEventListener("change", renderDetailTable);
  els.detailMissingFilter.addEventListener("change", renderDetailTable);

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session || null;
    renderSession();

    if (!session) {
      resetDetail();
    }
  });
}

async function init() {
  bindEvents();

  try {
    await Promise.all([
      refreshSession(),
      loadPublicDashboard()
    ]);
  } catch (error) {
    console.error("SIGEP Dashboard init error:", error);

    setStatus(
      "error",
      error?.message || "No fue posible cargar el dashboard"
    );

    els.selectedStructureTitle.textContent =
      "No fue posible cargar los indicadores";
    els.selectedStructureMeta.textContent =
      "Verifica la publicación del backend y la configuración de Supabase.";
    els.selectedMessage.textContent =
      error?.message || "Error de carga.";
  }
}

init();
