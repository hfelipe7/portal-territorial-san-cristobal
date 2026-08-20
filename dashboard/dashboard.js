// SIGEP PRM SC — DASHBOARD TERRITORIAL BUILD: DASHBOARD_TERRITORIAL_V1_0_5R1

import {
  supabase,
  configReady,
  escapeHtml
} from "../js/client.js";

window.__SIGEP_DASHBOARD_BUILD__ = "DASHBOARD_TERRITORIAL_V1_0_5R1";

const PUBLIC_RPC = "sigep_dashboard_publico_resumen_v1";
const DETAIL_RPC = "sigep_dashboard_publico_faltantes_v1";

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
  detailRows: [],
  detailLoadedFor: "",
  detailRequestId: 0
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
  kpiGlobalLabel: document.querySelector("#kpiGlobalLabel"),
  kpiAverageLabel: document.querySelector("#kpiAverageLabel"),
  kpiEmptyLabel: document.querySelector("#kpiEmptyLabel"),
  kpiGlobalNote: document.querySelector("#kpiGlobalNote"),
  kpiAverageNote: document.querySelector("#kpiAverageNote"),
  kpiEmptyNote: document.querySelector("#kpiEmptyNote"),

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

  detailSearch: document.querySelector("#detailSearch"),
  detailMissingFilter: document.querySelector("#detailMissingFilter"),
  detailCount: document.querySelector("#detailCount"),
  detailLoading: document.querySelector("#detailLoading"),
  detailTableScroll: document.querySelector("#detailTableScroll"),
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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeRegion(value) {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  const number = Number(digits);
  return Number.isFinite(number) ? String(number) : digits;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
    return clean(item.estructura_nombre) ||
      `Circunscripción ${clean(item.circunscripcion)}`;
  }

  if (item.nivel === "MUNICIPIO") {
    return clean(item.municipio) || clean(item.estructura_nombre);
  }

  if (item.nivel === "DISTRITO MUNICIPAL") {
    return clean(item.distrito_municipal) || clean(item.estructura_nombre);
  }

  if (item.nivel === "REGION") {
    const region = normalizeRegion(item.region);
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
    return `Región ${normalizeRegion(item.region).padStart(2, "0")}`;
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

  if (
    item.nivel === "REGION" ||
    item.nivel === "ZONA" ||
    item.nivel === "MUNICIPIO" ||
    item.nivel === "DISTRITO MUNICIPAL"
  ) {
    parts.push(territoryLabel(item));
  }

  if (
    item.nivel === "ZONA" &&
    normalizeRegion(item.region) !== "0" &&
    clean(item.region)
  ) {
    parts.push(`Región ${normalizeRegion(item.region).padStart(2, "0")}`);
  }

  if (item.nivel === "ZONA" && clean(item.recinto)) {
    parts.push(clean(item.recinto));
  }

  return parts.length
    ? parts.join(" · ")
    : clean(item.provincia) || "San Cristóbal";
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
  window.setTimeout(() => element.remove(), 4200);
}

function clearSelect(select) {
  select.innerHTML = "";
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

  if (
    ["PROVINCIA", "CIRCUNSCRIPCION", "MUNICIPIO", "DISTRITO MUNICIPAL"]
      .includes(level)
  ) {
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
    .filter(
      (item) =>
        !state.selectedTerritory ||
        clean(item.territorio_codigo) === state.selectedTerritory
    );

  const regions = uniqueBy(
    items.map((item) => {
      const normalized = normalizeRegion(item.region);
      return {
        value: normalized,
        label:
          normalized === "0" || !normalized
            ? "Sin región formal"
            : `Región ${normalized.padStart(2, "0")}`
      };
    }),
    (entry) => entry.value
  );

  return sortNatural(regions, (entry) =>
    !entry.value || entry.value === "0" ? "999" : entry.value
  );
}

function candidateStructures() {
  let items = structuresForLevel(state.selectedLevel);

  if (
    ["REGION", "ZONA"].includes(state.selectedLevel) &&
    state.selectedTerritory
  ) {
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
    if (item.nivel === "ZONA") {
      return `${clean(item.zona)} ${clean(item.recinto)}`;
    }
    if (item.nivel === "REGION") {
      return normalizeRegion(item.region).padStart(4, "0");
    }
    if (item.nivel === "CIRCUNSCRIPCION") {
      return clean(item.circunscripcion);
    }
    return structureDisplayName(item);
  });
}

function syncFilterVisibility() {
  const level = state.selectedLevel;
  els.territoryControl.hidden = level === "PROVINCIA";
  els.regionControl.hidden = level !== "ZONA";
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

  if (!options.some((entry) => entry.value === state.selectedTerritory)) {
    state.selectedTerritory = options[0].value;
  }

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

  if (!options.some((entry) => entry.value === state.selectedRegion)) {
    state.selectedRegion = options[0].value;
  }

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
    ["CIRCUNSCRIPCION", "MUNICIPIO", "DISTRITO MUNICIPAL"]
      .includes(state.selectedLevel)
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

  if (
    !items.some(
      (item) => item.estructura_codigo === state.selectedStructureCode
    )
  ) {
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

function resetDetail() {
  state.detailRows = [];
  state.detailLoadedFor = "";
  state.detailRequestId += 1;

  els.detailTableBody.innerHTML = "";
  els.detailCount.textContent = "—";
  els.detailLoading.hidden = false;
  els.detailLoading.textContent =
    state.selectedStructureCode
      ? "Cargando cargos de la estructura seleccionada…"
      : "Seleccione una estructura.";
  els.detailTableScroll.hidden = true;
  els.detailEmpty.hidden = true;
  els.detailSearch.value = "";
  els.detailMissingFilter.value = "TODOS";
}

function refreshFilters() {
  syncFilterVisibility();
  populateTerritories();
  populateRegions();
  populateStructures();
  resetDetail();
  renderAll();
  void loadSelectedDetail();
}

function contextualKpiScope() {
  const level = state.selectedLevel;
  let items = structuresForLevel(level);

  if (level === "PROVINCIA") {
    return state.selectedStructure ? [state.selectedStructure] : items;
  }

  if (
    ["CIRCUNSCRIPCION", "MUNICIPIO", "DISTRITO MUNICIPAL"].includes(level)
  ) {
    const selected =
      state.selectedStructure ||
      items.find(
        (item) => item.estructura_codigo === state.selectedTerritory
      );
    return selected ? [selected] : items;
  }

  if (level === "REGION" && state.selectedTerritory) {
    return items.filter(
      (item) => clean(item.territorio_codigo) === state.selectedTerritory
    );
  }

  if (level === "ZONA") {
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

  return items;
}

function averageMetric(items, getter) {
  const values = items
    .map((item) => Number(getter(item)))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function contextualKpiLabels(items) {
  const level = state.selectedLevel;
  const count = items.length;

  if (level === "ZONA") {
    const regionIsFormal =
      state.selectedRegion !== "" && state.selectedRegion !== "0";

    els.kpiGlobalLabel.textContent =
      regionIsFormal ? "Avance de la región" : "Avance del territorio";
    els.kpiAverageLabel.textContent = "Promedio de sus zonas";
    els.kpiEmptyLabel.textContent = "Zonas sin información";

    els.kpiGlobalNote.textContent = regionIsFormal
      ? "Calculado con las zonas de la región seleccionada"
      : "Calculado con las zonas del territorio seleccionado";
    els.kpiAverageNote.textContent =
      `${count} zona${count === 1 ? "" : "s"} en el contexto actual`;
    els.kpiEmptyNote.textContent =
      "Porcentaje de zonas del contexto sin información";
    return;
  }

  if (level === "REGION") {
    els.kpiGlobalLabel.textContent = "Avance del territorio";
    els.kpiAverageLabel.textContent = "Promedio de sus regiones";
    els.kpiEmptyLabel.textContent = "Regiones sin información";
    els.kpiGlobalNote.textContent =
      "Calculado con las regiones del territorio seleccionado";
    els.kpiAverageNote.textContent =
      `${count} región${count === 1 ? "" : "es"} en el contexto actual`;
    els.kpiEmptyNote.textContent =
      "Porcentaje de regiones del contexto sin información";
    return;
  }

  els.kpiGlobalLabel.textContent = "Avance de la estructura";
  els.kpiAverageLabel.textContent = "Promedio territorial";
  els.kpiEmptyLabel.textContent = "Estructuras sin información";
  els.kpiGlobalNote.textContent = "Estructura seleccionada";
  els.kpiAverageNote.textContent = "Contexto territorial actual";
  els.kpiEmptyNote.textContent = "Según la selección actual";
}

function renderLevelKpis() {
  const items = contextualKpiScope();
  contextualKpiLabels(items);

  if (!items.length) {
    els.kpiGlobal.textContent = "—";
    els.kpiAverage.textContent = "—";
    els.kpiQuality.textContent = "—";
    els.kpiEmpty.textContent = "—";
    return;
  }

  const advance = averageMetric(items, (item) => item.porcentaje_avance);
  const quality = averageMetric(
    items,
    (item) => item?.calidad_datos?.porcentaje_datos_completos
  );

  const emptyPercent =
    100 *
    items.filter((item) => clampPercent(item.porcentaje_avance) === 0).length /
    items.length;

  els.kpiGlobal.textContent = advance == null ? "—" : percent(advance);
  els.kpiAverage.textContent = advance == null ? "—" : percent(advance);
  els.kpiQuality.textContent = quality == null ? "—" : percent(quality);
  els.kpiEmpty.textContent = percent(emptyPercent);
}

function messageForStructure(item) {
  const value = clampPercent(item?.porcentaje_avance);

  if (value === 0) {
    return "Esta estructura no tiene información registrada. El desglose inferior permite identificar qué secciones aún están vacías.";
  }
  if (value === 100) {
    return "La estructura tiene todas sus posiciones operativas ocupadas. Revisa también la calidad de nombre, cédula y teléfono principal.";
  }
  if (value >= 75) {
    return "La estructura está en una etapa avanzada. Las secciones y los indicadores de calidad muestran dónde concentrar la actualización pendiente.";
  }
  if (value >= 25) {
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
  const value = clampPercent(item.porcentaje_avance);
  const status = clean(item.estado) || "SIN INFORMACIÓN REGISTRADA";

  els.selectedLevelLabel.textContent = levelLabel(item.nivel);
  els.selectedStructureTitle.textContent = structureDisplayName(item);
  els.selectedStructureMeta.textContent = structureMeta(item);
  els.selectedState.textContent = status;
  els.selectedState.className = `state-badge ${stateClass(status)}`;
  els.selectedPercent.textContent = percent(value);
  els.progressRing.style.setProperty("--progress", `${value * 3.6}deg`);
  els.progressRing.setAttribute(
    "aria-label",
    `${structureDisplayName(item)}: ${percent(value)} de avance`
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

function activateComparisonStructure(code) {
  if (!code) return;

  state.selectedStructureCode = code;
  els.structureSelect.value = code;
  state.selectedStructure =
    state.structures.find((item) => item.estructura_codigo === code) || null;

  resetDetail();
  renderAll();
  void loadSelectedDetail();
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
    els.comparisonTitle.textContent =
      `${levelLabel(state.selectedLevel)} · comparación`;
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
    const value = clampPercent(item.porcentaje_avance);
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
          <span style="width:${value}%"></span>
        </span>
        <strong class="comparison-percent">
          ${escapeHtml(percent(value))}
        </strong>
      </div>
    `;
  }).join("");

  els.comparisonList.querySelectorAll(".comparison-row").forEach((row) => {
    const activate = () =>
      activateComparisonStructure(row.dataset.structureCode);

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
  const sections = Array.isArray(state.selectedStructure?.secciones)
    ? state.selectedStructure.secciones
    : [];

  if (!state.selectedStructureCode) {
    els.sectionCards.innerHTML = `
      <article class="empty-placeholder branded-panel">
        Seleccione una estructura.
      </article>
    `;
    return;
  }

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
    const value = clampPercent(section.porcentaje_avance);
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
          <strong class="section-percent">${escapeHtml(percent(value))}</strong>
        </div>
        <div class="bar-track" aria-hidden="true">
          <span style="width:${value}%"></span>
        </div>
        <span class="section-card-state">${escapeHtml(status)}</span>
        ${subsectionMarkup}
      </article>
    `;
  }).join("");
}

function setBar(element, value) {
  element.style.width = `${clampPercent(value)}%`;
}

function renderQuality() {
  const quality = selectedQuality(state.selectedStructure);

  els.qualityNameValue.textContent = percent(quality.name);
  els.qualityCedulaValue.textContent = percent(quality.cedula);
  els.qualityPhoneValue.textContent = percent(quality.phone);
  els.qualityCompleteValue.textContent = percent(quality.complete);

  setBar(els.qualityNameBar, quality.name);
  setBar(els.qualityCedulaBar, quality.cedula);
  setBar(els.qualityPhoneBar, quality.phone);
  setBar(els.qualityCompleteBar, quality.complete);
}

function renderActivePath() {
  const item = state.selectedStructure;

  if (!item) {
    els.activePath.innerHTML = "";
    return;
  }

  const chips = ["San Cristóbal", levelLabel(item.nivel)];

  if (clean(item.circunscripcion)) {
    chips.push(`Circ. ${clean(item.circunscripcion)}`);
  }

  if (
    ["MUNICIPIO", "DISTRITO MUNICIPAL", "REGION", "ZONA"]
      .includes(item.nivel)
  ) {
    chips.push(territoryLabel(item));
  }

  if (
    item.nivel === "ZONA" &&
    normalizeRegion(item.region) !== "0" &&
    clean(item.region)
  ) {
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


function detailRowsFiltered() {
  const query = normalizeText(els.detailSearch.value);
  const missing = els.detailMissingFilter.value;

  return state.detailRows.filter((row) => {
    if (
      missing !== "TODOS" &&
      !row.campos_faltantes.includes(missing)
    ) {
      return false;
    }

    if (query && !normalizeText(row.cargo).includes(query)) {
      return false;
    }

    return true;
  });
}

function statusMarkup(value) {
  const status = value === "COMPLETO" ? "COMPLETO" : "VACÍO";
  return `
    <span class="field-status" data-status="${status}">
      ${escapeHtml(status)}
    </span>
  `;
}

function renderDetailTable() {
  const rows = detailRowsFiltered();

  els.detailCount.textContent = String(state.detailRows.length);

  if (state.detailLoadedFor !== state.selectedStructureCode) {
    els.detailLoading.hidden = false;
    els.detailTableScroll.hidden = true;
    els.detailEmpty.hidden = true;
    return;
  }

  els.detailLoading.hidden = true;
  els.detailTableScroll.hidden = rows.length === 0;
  els.detailEmpty.hidden = rows.length !== 0;

  els.detailTableBody.innerHTML = rows.map((row) => `
    <tr>
      <td data-label="# ficha" class="detail-number">
        ${escapeHtml(row.numero_ficha ?? "—")}
      </td>
      <td data-label="Cargo" class="detail-cargo">
        ${escapeHtml(row.cargo)}
      </td>
      <td data-label="Nombre">${statusMarkup(row.nombre)}</td>
      <td data-label="Cédula">${statusMarkup(row.cedula)}</td>
      <td data-label="Teléfono">${statusMarkup(row.telefono)}</td>
    </tr>
  `).join("");
}

async function loadSelectedDetail() {
  const structureCode = state.selectedStructureCode;

  if (!structureCode) {
    resetDetail();
    renderSections();
    renderDetailTable();
    return;
  }

  const requestId = ++state.detailRequestId;
  state.detailRows = [];
  state.detailLoadedFor = "";

  els.detailLoading.hidden = false;
  els.detailLoading.textContent =
    "Cargando cargos de la estructura seleccionada…";
  els.detailTableScroll.hidden = true;
  els.detailEmpty.hidden = true;
  els.detailCount.textContent = "—";
  renderSections();

  try {
    const { data, error } = await supabase.rpc(
      DETAIL_RPC,
      { p_estructura_codigo: structureCode }
    );

    if (requestId !== state.detailRequestId) return;
    if (error) throw error;

    const payload = parseJson(data);

    if (!payload || payload.ok !== true) {
      throw new Error(
        payload?.mensaje ||
        "La RPC pública de fichas pendientes no devolvió un resultado válido."
      );
    }

    if (
      payload.solo_lectura !== true ||
      payload.contiene_datos_personales !== false ||
      payload.permite_escritura !== false
    ) {
      throw new Error(
        "El detalle no confirmó el contrato de privacidad y solo lectura."
      );
    }

    state.detailRows = Array.isArray(payload.registros)
      ? payload.registros.map((row) => ({
          numero_ficha: Number.isFinite(Number(row?.numero_ficha))
            ? Number(row.numero_ficha)
            : null,
          cargo: clean(row?.cargo) || "—",
          campos_faltantes: Array.isArray(row?.campos_faltantes)
            ? row.campos_faltantes
            : [],
          nombre: clean(row?.nombre).toUpperCase() === "COMPLETO"
            ? "COMPLETO"
            : "VACÍO",
          cedula: clean(row?.cedula).toUpperCase() === "COMPLETO"
            ? "COMPLETO"
            : "VACÍO",
          telefono: clean(row?.telefono).toUpperCase() === "COMPLETO"
            ? "COMPLETO"
            : "VACÍO"
        }))
      : [];

    state.detailLoadedFor = structureCode;

    renderSections();
    renderDetailTable();
  } catch (error) {
    if (requestId !== state.detailRequestId) return;

    console.error("SIGEP Dashboard public detail error:", error);

    state.detailRows = [];
    state.detailLoadedFor = structureCode;

    els.detailLoading.hidden = false;
    els.detailLoading.textContent =
      "No fue posible cargar el detalle de esta estructura.";
    els.detailTableScroll.hidden = true;
    els.detailEmpty.hidden = true;
    els.detailCount.textContent = "—";

    renderSections();

    toast(
      error?.message ||
      "No fue posible cargar el detalle público.",
      "error"
    );
  }
}

function renderAll() {
  renderLevelKpis();
  renderSelectedStructure();
  renderComparison();
  renderSections();
  renderQuality();
  renderActivePath();
  renderDetailTable();
}

async function loadPublicDashboard() {
  if (!configReady) {
    setStatus("error", "Configuración Supabase incompleta");
    throw new Error("La configuración de Supabase no está disponible.");
  }

  setStatus("", "Cargando datos SIGEP…");

  const { data, error } = await supabase.rpc(PUBLIC_RPC);
  if (error) throw error;

  const payload = parseJson(data);

  if (
    !payload ||
    payload.ok !== true ||
    payload.solo_lectura !== true ||
    payload.contiene_datos_personales !== false
  ) {
    throw new Error(
      payload?.mensaje ||
      "La RPC pública del dashboard no devolvió un resultado válido y seguro."
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

  setStatus("ready", "Datos SIGEP disponibles · solo lectura");

  state.selectedLevel = "PROVINCIA";
  els.levelSelect.value = state.selectedLevel;

  refreshFilters();
}

function selectCurrentStructureAndLoad() {
  state.selectedStructureCode = els.structureSelect.value;
  state.selectedStructure =
    state.structures.find(
      (item) => item.estructura_codigo === state.selectedStructureCode
    ) || null;

  resetDetail();
  renderAll();
  void loadSelectedDetail();
}

function bindEvents() {
  els.levelSelect.addEventListener("change", () => {
    state.selectedLevel = els.levelSelect.value;
    state.selectedTerritory = "";
    state.selectedRegion = "";
    state.selectedStructureCode = "";
    state.selectedStructure = null;
    refreshFilters();
  });

  els.territorySelect.addEventListener("change", () => {
    state.selectedTerritory = els.territorySelect.value;
    state.selectedRegion = "";
    state.selectedStructureCode = "";
    state.selectedStructure = null;

    populateRegions();
    populateStructures();
    resetDetail();
    renderAll();
    void loadSelectedDetail();
  });

  els.regionSelect.addEventListener("change", () => {
    state.selectedRegion = els.regionSelect.value;
    state.selectedStructureCode = "";
    state.selectedStructure = null;

    populateStructures();
    resetDetail();
    renderAll();
    void loadSelectedDetail();
  });

  els.structureSelect.addEventListener(
    "change",
    selectCurrentStructureAndLoad
  );

  els.resetFiltersButton.addEventListener("click", () => {
    state.selectedLevel = "PROVINCIA";
    state.selectedTerritory = "";
    state.selectedRegion = "";
    state.selectedStructureCode = "";
    state.selectedStructure = null;
    els.levelSelect.value = state.selectedLevel;
    refreshFilters();
  });

  els.detailSearch.addEventListener("input", renderDetailTable);
  els.detailMissingFilter.addEventListener("change", renderDetailTable);
}

async function init() {
  bindEvents();

  try {
    await loadPublicDashboard();
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

    els.detailLoading.hidden = false;
    els.detailLoading.textContent =
      "El detalle no está disponible hasta que cargue el backend público.";
  }
}

init();
