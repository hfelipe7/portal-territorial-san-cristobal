import {
  supabase,
  appName,
  configReady,
  adminFunctionUrl,
  invokeAuthenticatedFunction,
  getSavedLoginContext,
  clearLoginContext,
  cleanText,
  escapeHtml,
  formatDate
} from "./client.js";

const EDITABLE_FIELDS = [
  ["nombre_completo", "Nombre completo", "text"],
  ["cedula", "Cédula", "text"],
  ["telefono_celular", "Teléfono celular", "tel"],
  ["telefono_celular_2", "Teléfono celular 2", "tel"],
  ["telefono_casa", "Teléfono de casa", "tel"],
  ["telefono_otro", "Otro teléfono", "tel"],
  ["direccion", "Dirección", "textarea"],
  ["whassapp", "WhatsApp", "tel"],
  ["correo_eletronico", "Correo electrónico", "email"],
  ["instagram", "Instagram", "text"],
  ["facebook", "Facebook", "text"],
  ["x", "X", "text"],
  ["tiktok", "TikTok", "text"]
];

const REGIONAL_CARGO_CODES = new Set([
  "CARGO_01", "CARGO_02", "CARGO_03", "CARGO_04",
  "CARGO_05", "CARGO_06", "CARGO_07", "CARGO_08",
  "CARGO_09", "CARGO_10", "CARGO_11", "CARGO_12",
  "CARGO_25", "CARGO_26", "CARGO_27", "CARGO_28",
  "CARGO_34", "CARGO_35",
  "REG_CARGO_01", "REG_CARGO_02", "REG_CARGO_03"
]);

const REGIONAL_VISUAL_ORDER = new Map([
  ["CARGO_01", 1], ["CARGO_02", 2], ["CARGO_03", 3], ["CARGO_04", 4],
  ["CARGO_05", 5], ["CARGO_06", 6], ["CARGO_07", 7], ["CARGO_08", 8],
  ["CARGO_09", 9], ["CARGO_10", 10], ["CARGO_11", 11], ["CARGO_12", 12],
  ["CARGO_25", 13], ["CARGO_28", 14], ["CARGO_34", 15], ["CARGO_35", 16],
  ["CARGO_26", 17], ["CARGO_27", 18],
  ["REG_CARGO_01", 19], ["REG_CARGO_02", 20], ["REG_CARGO_03", 21]
]);

const state = {
  user: null,
  profile: null,
  isAdmin: false,
  territories: [],
  assignments: new Map(),
  structures: [],
  selectedTerritory: "",
  selectedStructure: null,
  records: [],
  zonalAuthorities: [],
  selectedRecord: null,
  users: [],
  allAssignments: [],
  allRegionalAssignments: [],
  assignableTerritories: [],
  regionalStructures: [],
  regionalAssignments: [],
  selectedPermissionType: "TERRITORIAL",
  selectedUserId: null,
  passwordUserId: null,
  auditRows: []
};

const els = {
  appName: document.querySelector("[data-app-name]"),
  userName: document.querySelector("#user-name"),
  userRole: document.querySelector("#user-role"),
  signOut: document.querySelector("#sign-out"),
  changePassword: document.querySelector("#change-password"),
  globalMessage: document.querySelector("#global-message"),
  welcomeTitle: document.querySelector("#welcome-title"),
  welcomeSubtitle: document.querySelector("#welcome-subtitle"),
  metricStructures: document.querySelector("#metric-structures"),
  metricFilled: document.querySelector("#metric-filled"),
  metricTotal: document.querySelector("#metric-total"),
  mainTabs: document.querySelector("#main-tabs"),
  structuresTab: document.querySelector('[data-tab="structures"]'),
  summaryTab: document.querySelector('[data-tab="summary"]'),
  usersTab: document.querySelector('[data-tab="users"]'),
  auditTab: document.querySelector('[data-tab="audit"]'),
  structuresPanel: document.querySelector("#structures-panel"),
  summaryPanel: document.querySelector("#summary-panel"),
  usersPanel: document.querySelector("#users-panel"),
  auditPanel: document.querySelector("#audit-panel"),
  territorySelect: document.querySelector("#territory-select"),
  structureSearch: document.querySelector("#structure-search"),
  structureCount: document.querySelector("#structure-count"),
  structureList: document.querySelector("#structure-list"),
  territorialHeader: document.querySelector("#territorial-header"),
  cargoToolbarText: document.querySelector("#cargo-toolbar-text"),
  recordSearch: document.querySelector("#record-search"),
  recordsGrid: document.querySelector("#records-grid"),
  summaryTitle: document.querySelector("#summary-title"),
  summaryContext: document.querySelector("#summary-context"),
  summaryHeader: document.querySelector("#summary-header"),
  summaryBody: document.querySelector("#summary-body"),
  printSummary: document.querySelector("#print-summary"),
  exportSummary: document.querySelector("#export-summary"),
  recordModal: document.querySelector("#record-modal"),
  recordForm: document.querySelector("#record-form"),
  recordModalTitle: document.querySelector("#record-modal-title"),
  recordModalContext: document.querySelector("#record-modal-context"),
  recordProtectedFields: document.querySelector("#record-protected-fields"),
  recordEditableFields: document.querySelector("#record-editable-fields"),
  recordMessage: document.querySelector("#record-message"),
  closeRecordModal: document.querySelector("#close-record-modal"),
  cancelRecord: document.querySelector("#cancel-record"),
  saveRecord: document.querySelector("#save-record"),
  territoryCoverage: document.querySelector("#territory-coverage"),
  refreshUsers: document.querySelector("#refresh-users"),
  createUserForm: document.querySelector("#create-user-form"),
  assignmentType: document.querySelector("#assignment-type"),
  territoryFieldLabel: document.querySelector("#territory-field-label"),
  regionField: document.querySelector("#region-field"),
  regionSelect: document.querySelector("#region-select"),
  createUserMessage: document.querySelector("#create-user-message"),
  createUserButton: document.querySelector("#create-user-button"),
  userSearch: document.querySelector("#user-search"),
  usersCount: document.querySelector("#users-count"),
  usersBody: document.querySelector("#users-body"),
  permissionsModal: document.querySelector("#permissions-modal"),
  permissionsTitle: document.querySelector("#permissions-title"),
  permissionsDescription: document.querySelector("#permissions-description"),
  permissionsBody: document.querySelector("#permissions-body"),
  permissionsMessage: document.querySelector("#permissions-message"),
  closePermissions: document.querySelector("#close-permissions"),
  cancelPermissions: document.querySelector("#cancel-permissions"),
  savePermissions: document.querySelector("#save-permissions"),
  passwordModal: document.querySelector("#password-modal"),
  passwordForm: document.querySelector("#password-form"),
  passwordTitle: document.querySelector("#password-title"),
  passwordContext: document.querySelector("#password-context"),
  adminNewPassword: document.querySelector("#admin-new-password"),
  passwordMessage: document.querySelector("#password-message"),
  closePasswordModal: document.querySelector("#close-password-modal"),
  cancelPassword: document.querySelector("#cancel-password"),
  savePassword: document.querySelector("#save-password"),
  refreshAudit: document.querySelector("#refresh-audit"),
  auditBody: document.querySelector("#audit-body"),
  auditDetailModal: document.querySelector("#audit-detail-modal"),
  auditDetailContent: document.querySelector("#audit-detail-content"),
  closeAuditDetail: document.querySelector("#close-audit-detail")
};

els.appName.textContent = appName;

function showMessage(text, type = "error", duration = 5200) {
  els.globalMessage.textContent = text;
  els.globalMessage.className = `message floating-message ${type}`;
  els.globalMessage.hidden = false;
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => {
    els.globalMessage.hidden = true;
  }, duration);
}

function showLocalMessage(element, text, type = "error") {
  element.textContent = text;
  element.className = `message ${type}`;
  element.hidden = false;
}

function hideLocalMessage(element) {
  element.hidden = true;
}

function structureSubtitle(item) {
  const parts = [];
  if (item.region) parts.push(`Región ${item.region}`);
  if (item.zona) parts.push(`Zona ${item.zona}`);
  if (item.descripcion_recinto) parts.push(item.descripcion_recinto);
  if (!parts.length && item.distrito_municipal) parts.push(item.distrito_municipal);
  if (!parts.length && item.municipio) parts.push(item.municipio);
  if (!parts.length && item.circunscripcion) parts.push(`Circunscripción ${item.circunscripcion}`);
  return parts.join(" · ") || item.nivel_estructura;
}

function contextLine(item) {
  if (!item) return "";
  return [
    item.provincia && `Provincia ${item.provincia}`,
    item.circunscripcion && `Circunscripción ${item.circunscripcion}`,
    item.municipio && `Municipio ${item.municipio}`,
    item.distrito_municipal && `Distrito Municipal ${item.distrito_municipal}`,
    item.region && `Región ${item.region}`,
    item.zona && `Zona ${item.zona}`,
    item.codigo_recinto && `Recinto ${item.codigo_recinto}`,
    item.descripcion_recinto
  ].filter(Boolean).join(" · ");
}

function normalizedRegionNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function isRegionalStructure(item = state.selectedStructure) {
  return String(item?.nivel_estructura || "").trim().toUpperCase() === "REGION";
}

function regionalVisualOrder(record) {
  return REGIONAL_VISUAL_ORDER.get(record.cargo_codigo) ?? record.orden_cargo;
}

function visibleStructureRecords(records = state.records) {
  if (!isRegionalStructure()) return records;
  return records
    .filter((record) => REGIONAL_CARGO_CODES.has(record.cargo_codigo))
    .sort((a, b) => regionalVisualOrder(a) - regionalVisualOrder(b));
}

function canEditSelectedTerritory() {
  if (state.isAdmin) return true;

  const territorialPermission =
    state.assignments.get(state.selectedTerritory)?.puede_editar === true;

  if (territorialPermission) return true;

  const structureRegion = String(state.selectedStructure?.region || "").trim();
  if (!structureRegion) return false;

  return state.regionalAssignments.some((assignment) =>
    assignment.territorio_codigo === state.selectedTerritory &&
    assignment.region === structureRegion &&
    assignment.activo === true &&
    assignment.puede_ver === true &&
    assignment.puede_editar === true
  );
}

function setActiveTab(name) {
  for (const button of els.mainTabs.querySelectorAll("button[data-tab]")) {
    button.classList.toggle("active", button.dataset.tab === name);
  }

  els.structuresPanel.hidden = name !== "structures";
  els.summaryPanel.hidden = name !== "summary";
  els.usersPanel.hidden = name !== "users";
  els.auditPanel.hidden = name !== "audit";
}

async function requireSession() {
  if (!configReady) {
    document.body.innerHTML = '<main class="standalone-card">Falta configurar <strong>js/config.js</strong>.</main>';
    return false;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    clearLoginContext();
    window.location.replace("index.html");
    return false;
  }

  state.user = data.user;

  const { data: profile, error: profileError } = await supabase
    .from("perfiles")
    .select("id,usuario_login,correo_auth,nombre_completo,rol,activo,debe_cambiar_contrasena,ultimo_acceso")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    showMessage("No se encontró el perfil del usuario.");
    return false;
  }

  if (!profile.activo) {
    await supabase.auth.signOut();
    clearLoginContext();
    window.location.replace("index.html");
    return false;
  }

  if (profile.debe_cambiar_contrasena) {
    window.location.replace("cambiar-contrasena.html?obligatorio=1");
    return false;
  }

  state.profile = profile;
  state.isAdmin = profile.rol === "ADMINISTRADOR";
  els.userName.textContent = profile.nombre_completo || profile.usuario_login;
  els.userRole.textContent = state.isAdmin ? "Administrador provincial" : `Usuario territorial · ${profile.usuario_login}`;
  els.usersTab.hidden = !state.isAdmin;
  els.auditTab.hidden = !state.isAdmin;
  return true;
}

async function loadTerritories() {
  const { data: territories, error } = await supabase
    .from("territorios")
    .select("codigo,tipo,nombre,provincia,circunscripcion,municipio,distrito_municipal,asignable,activo,orden")
    .eq("activo", true)
    .order("orden");

  if (error) throw error;
  state.territories = territories || [];

  const [territorialAssignmentsResult, regionalAssignmentsResult] =
    await Promise.all([
      supabase
        .from("usuario_territorios")
        .select("usuario_id,territorio_codigo,puede_ver,puede_editar,activo")
        .eq("usuario_id", state.user.id)
        .eq("activo", true),
      supabase
        .from("usuario_regiones")
        .select("usuario_id,territorio_codigo,region,puede_ver,puede_editar,activo")
        .eq("usuario_id", state.user.id)
        .eq("activo", true)
    ]);

  if (territorialAssignmentsResult.error && !state.isAdmin) {
    throw territorialAssignmentsResult.error;
  }

  if (regionalAssignmentsResult.error && !state.isAdmin) {
    throw regionalAssignmentsResult.error;
  }

  const assignments = territorialAssignmentsResult.data || [];
  state.regionalAssignments = regionalAssignmentsResult.data || [];

  state.assignments = new Map(
    assignments.map((item) => [item.territorio_codigo, item])
  );

  if (state.isAdmin) {
    for (const territory of state.territories) {
      state.assignments.set(territory.codigo, {
        territorio_codigo: territory.codigo,
        puede_ver: true,
        puede_editar: true,
        activo: true
      });
    }
  }

  els.territorySelect.innerHTML = state.territories.map((territory) =>
    `<option value="${escapeHtml(territory.codigo)}">${escapeHtml(territory.nombre)}</option>`
  ).join("");

  const loginContext = getSavedLoginContext();
  let preferred = loginContext.territoryCode;
  if (preferred === "ADMIN_GENERAL") preferred = "PROVINCIA_SC";
  if (!state.territories.some((item) => item.codigo === preferred)) {
    preferred = state.territories[0]?.codigo || "";
  }

  state.selectedTerritory = preferred;
  els.territorySelect.value = preferred;
}

async function loadStructures() {
  state.selectedStructure = null;
  state.records = [];
  state.zonalAuthorities = [];
  renderTerritorialHeader();
  renderRecordCards();
  renderSummary();

  if (!state.selectedTerritory) {
    state.structures = [];
    renderStructureList();
    return;
  }

  els.structureList.innerHTML = '<div class="loading">Cargando estructuras…</div>';

  const { data, error } = await supabase
    .from("estructuras")
    .select("estructura_codigo,territorio_codigo,estructura_nombre,nivel_estructura,provincia,circunscripcion,municipio,distrito_municipal,codigo_recinto,descripcion_recinto,region,zona,orden_global,orden_en_territorio,activo")
    .eq("territorio_codigo", state.selectedTerritory)
    .eq("activo", true)
    .order("orden_en_territorio");

  if (error) throw error;

  state.structures = data || [];
  els.metricStructures.textContent = String(state.structures.length);
  const territory = state.territories.find((item) => item.codigo === state.selectedTerritory);
  els.welcomeTitle.textContent = territory?.nombre || "Estructuras territoriales";
  els.welcomeSubtitle.textContent = state.structures.length
    ? `${state.structures.length} estructura${state.structures.length === 1 ? "" : "s"} disponible${state.structures.length === 1 ? "" : "s"} en este acceso.`
    : "No hay estructuras disponibles para este territorio.";

  renderStructureList();

  if (state.structures[0]) {
    await selectStructure(state.structures[0].estructura_codigo);
  }
}

function filteredStructures() {
  const term = els.structureSearch.value.trim().toLowerCase();
  if (!term) return state.structures;
  return state.structures.filter((item) =>
    [item.estructura_nombre, item.nivel_estructura, item.region, item.zona, item.descripcion_recinto, item.municipio, item.distrito_municipal]
      .some((value) => String(value || "").toLowerCase().includes(term))
  );
}

function renderStructureList() {
  const list = filteredStructures();
  els.structureCount.textContent = String(list.length);

  if (!list.length) {
    els.structureList.innerHTML = '<div class="empty-card"><strong>Sin resultados</strong><span>Pruebe con otra búsqueda.</span></div>';
    return;
  }

  els.structureList.innerHTML = list.map((item) => `
    <button class="structure-item ${state.selectedStructure?.estructura_codigo === item.estructura_codigo ? "active" : ""}"
      type="button" data-structure-code="${escapeHtml(item.estructura_codigo)}">
      <span class="structure-number">${String(item.orden_en_territorio).padStart(2, "0")}</span>
      <span class="structure-copy">
        <strong>${escapeHtml(item.estructura_nombre)}</strong>
        <small>${escapeHtml(structureSubtitle(item))}</small>
      </span>
      <span class="structure-arrow">›</span>
    </button>
  `).join("");
}

async function loadZonalAuthorities(regionStructure) {
  state.zonalAuthorities = [];
  if (!isRegionalStructure(regionStructure)) return;

  const regionNumber = normalizedRegionNumber(regionStructure.region);
  if (regionNumber === null) return;

  const zoneStructures = state.structures.filter((item) =>
    String(item.nivel_estructura || "").trim().toUpperCase() === "ZONA" &&
    normalizedRegionNumber(item.region) === regionNumber
  );

  if (!zoneStructures.length) return;

  const zoneCodes = zoneStructures.map((item) => item.estructura_codigo);
  const { data, error } = await supabase
    .from("v_fichas_portal")
    .select("*")
    .in("estructura_codigo", zoneCodes)
    .in("cargo_codigo", ["CARGO_01", "CARGO_05"])
    .order("estructura_codigo")
    .order("orden_cargo");

  if (error) throw error;

  const recordsByZone = new Map();
  for (const record of data || []) {
    if (!recordsByZone.has(record.estructura_codigo)) {
      recordsByZone.set(record.estructura_codigo, new Map());
    }
    recordsByZone.get(record.estructura_codigo).set(record.cargo_codigo, record);
  }

  state.zonalAuthorities = zoneStructures
    .sort((a, b) => (a.orden_en_territorio || 0) - (b.orden_en_territorio || 0))
    .map((zone) => ({
      zone,
      president: recordsByZone.get(zone.estructura_codigo)?.get("CARGO_01") || null,
      secretary: recordsByZone.get(zone.estructura_codigo)?.get("CARGO_05") || null
    }));
}

async function selectStructure(structureCode) {
  const structure = state.structures.find((item) => item.estructura_codigo === structureCode);
  if (!structure) return;

  state.selectedStructure = structure;
  renderStructureList();
  renderTerritorialHeader();
  els.recordsGrid.innerHTML = `<div class="loading full-span">Cargando ${isRegionalStructure(structure) ? "la estructura regional" : "los cargos"}…</div>`;

  const { data, error } = await supabase
    .from("v_fichas_portal")
    .select("*")
    .eq("estructura_codigo", structureCode)
    .order("orden_cargo");

  if (error) throw error;
  state.records = data || [];
  await loadZonalAuthorities(structure);

  renderRecordCards();
  renderSummary();
  updateMetrics();
}

function renderTerritorialHeader() {
  const item = state.selectedStructure;
  if (!item) {
    els.territorialHeader.className = "territorial-header empty-state";
    els.territorialHeader.innerHTML = `
      <div><p class="eyebrow blue">Encabezado territorial</p><h2>Seleccione una estructura</h2><p>Los datos territoriales protegidos aparecerán aquí.</p></div>
    `;
    return;
  }

  const tags = [
    ["Nivel", item.nivel_estructura],
    ["Provincia", item.provincia],
    ["Circunscripción", item.circunscripcion],
    ["Municipio", item.municipio],
    ["Distrito Municipal", item.distrito_municipal],
    ["Región", item.region],
    ["Zona", item.zona],
    ["Código de recinto", item.codigo_recinto],
    ["Recinto", item.descripcion_recinto]
  ].filter(([, value]) => value);

  els.territorialHeader.className = "territorial-header";
  els.territorialHeader.innerHTML = `
    <div>
      <p class="eyebrow">Encabezado territorial</p>
      <h2>${escapeHtml(item.estructura_nombre)}</h2>
      <p>${escapeHtml(contextLine(item))}</p>
      <div class="header-tags">
        ${tags.map(([label, value]) => `<span class="header-tag"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`).join("")}
      </div>
    </div>
  `;
}

function filteredRecords() {
  const baseRecords = visibleStructureRecords();
  const term = els.recordSearch.value.trim().toLowerCase();
  if (!term) return baseRecords;
  return baseRecords.filter((record) =>
    [record.cargo, record.nombre_completo, record.cedula]
      .some((value) => String(value || "").toLowerCase().includes(term))
  );
}

function renderReadOnlyAuthorityCard(record, zone, label, visualNumber) {
  const complete = Boolean(record?.nombre_completo && record?.cedula);
  return `
    <article class="record-card zonal-authority-card">
      <div class="record-card-top">
        <span class="cargo-number">${escapeHtml(visualNumber)}</span>
        <span class="status-dot ${complete ? "complete" : ""}" title="${complete ? "Datos básicos completos" : "Datos básicos pendientes"}"></span>
      </div>
      <p class="zonal-source-label">${escapeHtml(zone.estructura_nombre)}</p>
      <h4>${escapeHtml(label)}</h4>
      <div class="record-person ${record?.nombre_completo ? "" : "empty"}">
        <strong>${escapeHtml(record?.nombre_completo || "Vacante / sin nombre")}</strong>
        <span>${escapeHtml(record?.cedula ? `Cédula: ${record.cedula}` : "Sin cédula registrada")}</span>
      </div>
      <div class="readonly-note">Solo lectura desde la región</div>
      <button class="button ghost small open-zone no-print" type="button" data-zone-code="${escapeHtml(zone.estructura_codigo)}">Abrir zona para editar</button>
    </article>
  `;
}

function renderRecordCards() {
  if (!state.selectedStructure) {
    els.recordsGrid.innerHTML = '<div class="empty-card full-span"><strong>Seleccione una estructura</strong><span>Luego podrá abrir y editar cada ficha autorizada.</span></div>';
    els.cargoToolbarText.textContent = "Seleccione una estructura para consultar sus cargos.";
    return;
  }

  const records = filteredRecords();
  const regional = isRegionalStructure();
  const totalVisible = visibleStructureRecords().length;
  els.cargoToolbarText.textContent = regional
    ? `${records.length} de ${totalVisible} cargos regionales mostrados · ${canEditSelectedTerritory() ? "Edición permitida" : "Solo lectura"}. Las autoridades zonales se muestran debajo y se editan únicamente desde su zona.`
    : `${records.length} de ${state.records.length} cargos mostrados · ${canEditSelectedTerritory() ? "Edición permitida" : "Solo lectura"}.`;

  const regionalCards = records.map((record) => {
    const complete = Boolean(record.nombre_completo && record.cedula);
    const displayOrder = regional ? regionalVisualOrder(record) : record.orden_cargo;
    return `
      <article class="record-card">
        <div class="record-card-top">
          <span class="cargo-number">${String(displayOrder).padStart(2, "0")}</span>
          <span class="status-dot ${complete ? "complete" : ""}" title="${complete ? "Datos básicos completos" : "Datos básicos pendientes"}"></span>
        </div>
        <h4>${escapeHtml(record.cargo)}</h4>
        <div class="record-person ${record.nombre_completo ? "" : "empty"}">
          <strong>${escapeHtml(record.nombre_completo || "Pendiente de completar")}</strong>
          <span>${escapeHtml(record.cedula ? `Cédula: ${record.cedula}` : "Sin cédula registrada")}</span>
        </div>
        <button class="button ${canEditSelectedTerritory() ? "" : "ghost"} small open-record" type="button" data-record-id="${escapeHtml(record.id_registro)}">
          ${canEditSelectedTerritory() ? "Abrir y editar ficha" : "Consultar ficha"}
        </button>
      </article>
    `;
  }).join("");

  if (!regional) {
    els.recordsGrid.innerHTML = regionalCards || '<div class="empty-card full-span"><strong>No se encontraron cargos</strong><span>Quite o cambie el texto de búsqueda.</span></div>';
    return;
  }

  const term = els.recordSearch.value.trim().toLowerCase();
  const authorities = state.zonalAuthorities.filter(({ zone, president, secretary }) => {
    if (!term) return true;
    return [zone.estructura_nombre, president?.nombre_completo, secretary?.nombre_completo, president?.cedula, secretary?.cedula]
      .some((value) => String(value || "").toLowerCase().includes(term));
  });

  const authorityCards = authorities.map(({ zone, president, secretary }, index) => {
    const base = 22 + index * 2;
    return [
      renderReadOnlyAuthorityCard(president, zone, "Presidente(a) zonal", String(base).padStart(2, "0")),
      renderReadOnlyAuthorityCard(secretary, zone, "Secretario(a) General zonal", String(base + 1).padStart(2, "0"))
    ].join("");
  }).join("");

  els.recordsGrid.innerHTML = `
    <div class="regional-section-heading full-span">
      <div><span class="regional-section-kicker">Dirección regional</span><h3>21 cargos regionales</h3></div>
      <span class="regional-section-badge">Editables según permisos</span>
    </div>
    ${regionalCards || '<div class="empty-card full-span"><strong>No se encontraron cargos regionales</strong></div>'}
    <div class="regional-section-heading full-span zonal-heading">
      <div><span class="regional-section-kicker">Miembros del órgano regional</span><h3>Presidentes y secretarios generales de las zonas</h3></div>
      <span class="regional-section-badge readonly">Solo lectura aquí</span>
    </div>
    ${authorityCards || '<div class="empty-card full-span"><strong>No hay autoridades zonales visibles</strong><span>Revise la relación de las zonas con esta región.</span></div>'}
  `;
}

function updateMetrics() {
  const records = visibleStructureRecords();
  const zonalRecords = isRegionalStructure()
    ? state.zonalAuthorities.flatMap((item) => [item.president, item.secretary]).filter(Boolean)
    : [];
  const filled = [...records, ...zonalRecords].filter((record) => record.nombre_completo).length;
  els.metricFilled.textContent = String(filled);
  els.metricTotal.textContent = String(records.length + zonalRecords.length);
}

function renderSummary() {
  const item = state.selectedStructure;
  if (!item) {
    els.summaryTitle.textContent = "Resumen de estructura";
    els.summaryContext.textContent = "Muestra únicamente cargo, nombre y cédula.";
    els.summaryHeader.innerHTML = "";
    els.summaryBody.innerHTML = '<tr><td colspan="4" class="loading">Seleccione una estructura.</td></tr>';
    return;
  }

  const records = visibleStructureRecords();
  const regional = isRegionalStructure();
  const authorityRows = regional
    ? state.zonalAuthorities.flatMap(({ zone, president, secretary }, index) => [
        { order: 22 + index * 2, cargo: `${zone.estructura_nombre} · Presidente(a) zonal`, record: president },
        { order: 23 + index * 2, cargo: `${zone.estructura_nombre} · Secretario(a) General zonal`, record: secretary }
      ])
    : [];

  els.summaryTitle.textContent = item.estructura_nombre;
  els.summaryContext.textContent = regional
    ? `${records.length} cargos regionales + ${authorityRows.length} autoridades zonales · vista completa para revisión o impresión.`
    : `${records.length} cargos · vista resumida para revisión o impresión.`;
  els.summaryHeader.innerHTML = `<strong>${escapeHtml(item.nivel_estructura)} · ${escapeHtml(item.estructura_nombre)}</strong><span>${escapeHtml(contextLine(item))}</span>`;

  const regionalRows = records.map((record) => `
    <tr>
      <td>${regional ? regionalVisualOrder(record) : record.orden_cargo}</td>
      <td><strong>${escapeHtml(record.cargo)}</strong></td>
      <td>${escapeHtml(record.nombre_completo || "")}</td>
      <td>${escapeHtml(record.cedula || "")}</td>
    </tr>
  `).join("");

  const zonalRows = authorityRows.length ? `
    <tr class="summary-section-row"><td colspan="4"><strong>Presidentes y secretarios generales de las zonas · solo lectura en esta vista</strong></td></tr>
    ${authorityRows.map(({ order, cargo, record }) => `
      <tr class="zonal-summary-row">
        <td>${order}</td>
        <td><strong>${escapeHtml(cargo)}</strong></td>
        <td>${escapeHtml(record?.nombre_completo || "VACANTE / SIN NOMBRE")}</td>
        <td>${escapeHtml(record?.cedula || "")}</td>
      </tr>
    `).join("")}
  ` : "";

  els.summaryBody.innerHTML = regionalRows + zonalRows;
}

function openRecord(recordId) {
  const record = state.records.find((item) => item.id_registro === recordId);
  if (!record) return;
  state.selectedRecord = record;
  hideLocalMessage(els.recordMessage);

  els.recordModalTitle.textContent = record.cargo;
  els.recordModalContext.textContent = contextLine(record);

  const protectedFields = [
    ["Nivel", record.nivel_estructura],
    ["Provincia", record.provincia],
    ["Circunscripción", record.circunscripcion],
    ["Municipio", record.municipio],
    ["Distrito Municipal", record.distrito_municipal],
    ["Región", record.region],
    ["Zona", record.zona],
    ["Código de recinto", record.codigo_recinto],
    ["Descripción de recinto", record.descripcion_recinto],
    ["Cargo", record.cargo]
  ].filter(([, value]) => value);

  els.recordProtectedFields.innerHTML = protectedFields.map(([label, value]) => `
    <div class="protected-item"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>
  `).join("");

  els.recordEditableFields.innerHTML = EDITABLE_FIELDS.map(([name, label, type]) => {
    const value = record[name] || "";
    const full = type === "textarea" ? "full" : "";
    const input = type === "textarea"
      ? `<textarea name="${name}" ${canEditSelectedTerritory() ? "" : "disabled"}>${escapeHtml(value)}</textarea>`
      : `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${canEditSelectedTerritory() ? "" : "disabled"}>`;
    return `<label class="field ${full}"><span>${escapeHtml(label)}</span>${input}</label>`;
  }).join("");

  els.saveRecord.hidden = !canEditSelectedTerritory();
  els.recordModal.showModal();
}

async function saveRecord(event) {
  event.preventDefault();
  if (!state.selectedRecord || !canEditSelectedTerritory()) return;
  hideLocalMessage(els.recordMessage);
  els.saveRecord.disabled = true;
  els.saveRecord.textContent = "Guardando…";

  const formData = new FormData(els.recordForm);
  const updates = {};
  for (const [name] of EDITABLE_FIELDS) {
    updates[name] = cleanText(formData.get(name));
  }

  try {
    const { data, error } = await supabase
      .from("registros")
      .update(updates)
      .eq("id_registro", state.selectedRecord.id_registro)
      .select("id_registro,nombre_completo,cedula,telefono_celular,telefono_celular_2,telefono_casa,telefono_otro,direccion,whassapp,correo_eletronico,instagram,facebook,x,tiktok,actualizado_en")
      .single();

    if (error) throw error;

    const index = state.records.findIndex((item) => item.id_registro === data.id_registro);
    if (index >= 0) state.records[index] = { ...state.records[index], ...data };
    state.selectedRecord = state.records[index];

    renderRecordCards();
    renderSummary();
    updateMetrics();
    showLocalMessage(els.recordMessage, "Ficha actualizada correctamente.", "success");
    showMessage("Los cambios fueron guardados y registrados en auditoría.", "success");
    setTimeout(() => els.recordModal.close(), 650);
  } catch (error) {
    showLocalMessage(els.recordMessage, error.message || "No se pudo guardar la ficha.");
  } finally {
    els.saveRecord.disabled = false;
    els.saveRecord.textContent = "Guardar cambios";
  }
}

function exportSummaryCsv() {
  const records = visibleStructureRecords();
  if (!state.selectedStructure || !records.length) {
    showMessage("Seleccione una estructura antes de exportar.");
    return;
  }

  const rows = [
    ["ORDEN", "CARGO", "NOMBRE COMPLETO", "CEDULA", "ORIGEN"],
    ...records.map((record) => [
      isRegionalStructure() ? regionalVisualOrder(record) : record.orden_cargo,
      record.cargo, record.nombre_completo || "", record.cedula || "",
      isRegionalStructure() ? "DIRECCION REGIONAL" : "ESTRUCTURA"
    ])
  ];

  if (isRegionalStructure()) {
    state.zonalAuthorities.forEach(({ zone, president, secretary }, index) => {
      rows.push([22 + index * 2, `${zone.estructura_nombre} · Presidente(a) zonal`, president?.nombre_completo || "VACANTE / SIN NOMBRE", president?.cedula || "", "ZONA · SOLO LECTURA"]);
      rows.push([23 + index * 2, `${zone.estructura_nombre} · Secretario(a) General zonal`, secretary?.nombre_completo || "VACANTE / SIN NOMBRE", secretary?.cedula || "", "ZONA · SOLO LECTURA"]);
    });
  }

  const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.selectedStructure.estructura_codigo}_resumen.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}


function getRegionalMunicipalityCodes() {
  return new Set(
    state.regionalStructures.map((item) => item.territorio_codigo)
  );
}

function populateCreateUserTerritories() {
  const territoryField = els.createUserForm.elements.territorio_codigo;
  const assignmentType = els.assignmentType?.value || "TERRITORIAL";

  const availableTerritories =
    assignmentType === "REGIONAL"
      ? state.assignableTerritories.filter((item) =>
          getRegionalMunicipalityCodes().has(item.codigo)
        )
      : state.assignableTerritories;

  territoryField.innerHTML =
    '<option value="">Seleccione un territorio</option>' +
    availableTerritories
      .map(
        (item) =>
          `<option value="${escapeHtml(item.codigo)}">${escapeHtml(item.nombre)}</option>`
      )
      .join("");
}

function populateCreateUserRegions() {
  const territoryCode =
    els.createUserForm.elements.territorio_codigo.value || "";

  const regions = state.regionalStructures
    .filter((item) => item.territorio_codigo === territoryCode)
    .sort((a, b) => String(a.region).localeCompare(String(b.region)));

  els.regionSelect.innerHTML =
    '<option value="">Seleccione una región</option>' +
    regions
      .map(
        (item) =>
          `<option value="${escapeHtml(item.region)}">${escapeHtml(
            item.estructura_nombre || `Región ${item.region}`
          )}</option>`
      )
      .join("");
}

function updateCreateUserAssignmentFields() {
  const assignmentType = els.assignmentType?.value || "TERRITORIAL";
  const isRegional = assignmentType === "REGIONAL";

  els.regionField.hidden = !isRegional;
  els.regionSelect.required = isRegional;
  els.territoryFieldLabel.textContent = isRegional
    ? "Municipio inicial"
    : "Territorio inicial";

  populateCreateUserTerritories();
  populateCreateUserRegions();
}

function getUserAssignmentType(userId) {
  const hasRegional = state.allRegionalAssignments.some(
    (item) => item.usuario_id === userId && item.activo
  );

  return hasRegional ? "REGIONAL" : "TERRITORIAL";
}

async function loadAdminData() {
  if (!state.isAdmin) return;
  els.usersBody.innerHTML =
    '<tr><td colspan="5" class="loading">Cargando usuarios…</td></tr>';

  const [
    territoriesResult,
    usersResult,
    assignmentsResult,
    regionalAssignmentsResult,
    regionalStructuresResult
  ] = await Promise.all([
    supabase
      .from("territorios")
      .select("codigo,nombre,tipo,orden")
      .eq("asignable", true)
      .eq("activo", true)
      .order("orden"),
    supabase
      .from("perfiles")
      .select(
        "id,usuario_login,nombre_completo,rol,activo,debe_cambiar_contrasena,ultimo_acceso,creado_en"
      )
      .order("creado_en"),
    supabase
      .from("usuario_territorios")
      .select(
        "id,usuario_id,territorio_codigo,puede_ver,puede_editar,activo"
      )
      .eq("activo", true),
    supabase
      .from("usuario_regiones")
      .select(
        "id,usuario_id,territorio_codigo,region,puede_ver,puede_editar,activo"
      )
      .eq("activo", true),
    supabase
      .from("estructuras")
      .select(
        "estructura_codigo,territorio_codigo,estructura_nombre,municipio,region,orden_en_territorio,activo"
      )
      .eq("nivel_estructura", "REGION")
      .eq("activo", true)
      .order("territorio_codigo")
      .order("region")
  ]);

  if (territoriesResult.error) throw territoriesResult.error;
  if (usersResult.error) throw usersResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (regionalAssignmentsResult.error) {
    throw regionalAssignmentsResult.error;
  }
  if (regionalStructuresResult.error) {
    throw regionalStructuresResult.error;
  }

  state.assignableTerritories = territoriesResult.data || [];
  state.users = usersResult.data || [];
  state.allAssignments = assignmentsResult.data || [];
  state.allRegionalAssignments = regionalAssignmentsResult.data || [];
  state.regionalStructures = regionalStructuresResult.data || [];

  updateCreateUserAssignmentFields();
  renderCoverage();
  renderUsers();
}

function renderCoverage() {
  const userById = new Map(state.users.map((user) => [user.id, user]));
  els.territoryCoverage.innerHTML = state.assignableTerritories.map((territory) => {
    const count = new Set(
      state.allAssignments
        .filter((assignment) => assignment.territorio_codigo === territory.codigo && assignment.puede_ver && userById.get(assignment.usuario_id)?.activo && userById.get(assignment.usuario_id)?.rol === "USUARIO")
        .map((assignment) => assignment.usuario_id)
    ).size;
    const complete = count >= 2;
    const width = Math.min(100, (count / 2) * 100);
    return `
      <article class="coverage-card ${complete ? "" : "warning"}">
        <strong>${escapeHtml(territory.nombre)}</strong>
        <span>${count} de 2 usuarios activos</span>
        <div class="coverage-progress"><i style="width:${width}%"></i></div>
      </article>
    `;
  }).join("");
}

function filteredUsers() {
  const term = els.userSearch.value.trim().toLowerCase();
  if (!term) return state.users;
  return state.users.filter((user) =>
    [user.usuario_login, user.nombre_completo, user.rol]
      .some((value) => String(value || "").toLowerCase().includes(term))
  );
}

function renderUsers() {
  const users = filteredUsers();
  const territoryByCode = new Map(
    state.assignableTerritories.map((item) => [item.codigo, item])
  );
  els.usersCount.textContent = `${users.length} usuario${
    users.length === 1 ? "" : "s"
  }`;

  if (!users.length) {
    els.usersBody.innerHTML =
      '<tr><td colspan="5" class="loading">No se encontraron usuarios.</td></tr>';
    return;
  }

  els.usersBody.innerHTML = users
    .map((user) => {
      const assignments = state.allAssignments.filter(
        (item) => item.usuario_id === user.id && item.puede_ver
      );
      const regionalAssignments = state.allRegionalAssignments.filter(
        (item) => item.usuario_id === user.id && item.puede_ver
      );
      const isSelf = user.id === state.user.id;

      const territorialChips = assignments.map(
        (assignment) =>
          `<span class="territory-chip">${escapeHtml(
            territoryByCode.get(assignment.territorio_codigo)?.nombre ||
              assignment.territorio_codigo
          )}${assignment.puede_editar ? " · edita" : ""}</span>`
      );

      const regionalChips = regionalAssignments.map((assignment) => {
        const territoryName =
          territoryByCode.get(assignment.territorio_codigo)?.nombre ||
          assignment.territorio_codigo;

        return `<span class="territory-chip">Regional · ${escapeHtml(
          territoryName
        )} · Región ${escapeHtml(assignment.region)}${
          assignment.puede_editar ? " · edita" : ""
        }</span>`;
      });

      const chips = [...territorialChips, ...regionalChips];

      return `
      <tr>
        <td class="user-name-cell">
          <strong>${escapeHtml(
            user.nombre_completo || user.usuario_login
          )}</strong>
          <small>@${escapeHtml(user.usuario_login)}${
            user.debe_cambiar_contrasena
              ? " · cambio de contraseña pendiente"
              : ""
          }</small>
        </td>
        <td>
          <select class="role-select user-role-select" data-user-id="${
            user.id
          }" ${isSelf ? "disabled" : ""}>
            <option value="USUARIO" ${
              user.rol === "USUARIO" ? "selected" : ""
            }>USUARIO</option>
            <option value="ADMINISTRADOR" ${
              user.rol === "ADMINISTRADOR" ? "selected" : ""
            }>ADMINISTRADOR</option>
          </select>
        </td>
        <td>
          <div class="territory-chips">
            ${
              chips.length
                ? chips.join("")
                : '<span class="muted">Sin territorio asignado</span>'
            }
          </div>
        </td>
        <td><span class="status ${
          user.activo ? "active" : "inactive"
        }">${user.activo ? "Activo" : "Inactivo"}</span><small class="muted">${
        user.ultimo_acceso
          ? `Último acceso: ${escapeHtml(formatDate(user.ultimo_acceso))}`
          : "Sin acceso registrado"
      }</small></td>
        <td>
          <div class="actions">
            <button class="button ghost small user-permissions" data-user-id="${
              user.id
            }" type="button" ${
        user.rol === "ADMINISTRADOR" ? "disabled" : ""
      }>Permisos</button>
            <button class="button ghost small user-password" data-user-id="${
              user.id
            }" type="button">Contraseña</button>
            <button class="button secondary small user-toggle" data-user-id="${
              user.id
            }" data-active="${user.activo}" type="button" ${
        isSelf ? "disabled" : ""
      }>${user.activo ? "Desactivar" : "Activar"}</button>
            <button class="button danger small user-delete" data-user-id="${
              user.id
            }" type="button" ${
        isSelf ? "disabled" : ""
      }>Eliminar</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

async function createUser(event) {
  event.preventDefault();
  hideLocalMessage(els.createUserMessage);
  els.createUserButton.disabled = true;
  els.createUserButton.textContent = "Creando…";

  const formData = new FormData(els.createUserForm);
  const assignmentType = String(
    formData.get("tipo_asignacion") || "TERRITORIAL"
  ).toUpperCase();
  const territoryCode = String(
    formData.get("territorio_codigo") || ""
  );
  const canEdit = formData.get("puede_editar") === "on";

  try {
    const payload = {
      action: "create_user",
      usuario_login: String(
        formData.get("usuario_login") || ""
      ).trim(),
      nombre_completo: String(
        formData.get("nombre_completo") || ""
      ).trim(),
      contrasena: String(formData.get("contrasena") || ""),
      tipo_asignacion: assignmentType
    };

    if (assignmentType === "REGIONAL") {
      payload.territorio_codigo = territoryCode;
      payload.region = String(formData.get("region") || "");
      payload.puede_ver = true;
      payload.puede_editar = canEdit;
    } else {
      payload.territorios = territoryCode
        ? [
            {
              territorio_codigo: territoryCode,
              puede_ver: true,
              puede_editar: canEdit
            }
          ]
        : [];
    }

    const result = await invokeAuthenticatedFunction(
      adminFunctionUrl,
      payload
    );

    const assignmentMessage =
      result.tipo_asignacion === "REGIONAL"
        ? ` como regional de la Región ${result.asignacion?.region || ""}`
        : "";

    showLocalMessage(
      els.createUserMessage,
      `Usuario ${result.usuario.usuario_login} creado correctamente${assignmentMessage}.`,
      "success"
    );

    els.createUserForm.reset();
    els.assignmentType.value = "TERRITORIAL";
    els.createUserForm.elements.puede_ver.checked = true;
    els.createUserForm.elements.puede_editar.checked = true;
    updateCreateUserAssignmentFields();
    await loadAdminData();
  } catch (error) {
    showLocalMessage(
      els.createUserMessage,
      error.message || "No se pudo crear el usuario."
    );
  } finally {
    els.createUserButton.disabled = false;
    els.createUserButton.textContent = "Crear usuario";
  }
}

function openPermissions(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.rol === "ADMINISTRADOR") return;

  state.selectedUserId = userId;
  state.selectedPermissionType = getUserAssignmentType(userId);
  hideLocalMessage(els.permissionsMessage);

  els.permissionsTitle.textContent = `Permisos de ${
    user.nombre_completo || user.usuario_login
  }`;

  if (state.selectedPermissionType === "REGIONAL") {
    els.permissionsDescription.textContent =
      "Seleccione las regiones que puede consultar o editar. Cada región incluye su estructura regional y sus zonas.";

    const assignmentMap = new Map(
      state.allRegionalAssignments
        .filter((item) => item.usuario_id === userId)
        .map((item) => [
          `${item.territorio_codigo}|${item.region}`,
          item
        ])
    );

    const territoryByCode = new Map(
      state.assignableTerritories.map((item) => [
        item.codigo,
        item
      ])
    );

    els.permissionsBody.innerHTML = state.regionalStructures
      .map((regionStructure) => {
        const key = `${regionStructure.territorio_codigo}|${regionStructure.region}`;
        const assignment = assignmentMap.get(key);
        const canView = assignment?.puede_ver === true;
        const canEdit = assignment?.puede_editar === true;
        const territoryName =
          territoryByCode.get(regionStructure.territorio_codigo)?.nombre ||
          regionStructure.municipio ||
          regionStructure.territorio_codigo;

        return `
          <tr
            data-territory-code="${escapeHtml(
              regionStructure.territorio_codigo
            )}"
            data-region="${escapeHtml(regionStructure.region)}"
          >
            <td>
              <strong>${escapeHtml(
                territoryName
              )} · Región ${escapeHtml(regionStructure.region)}</strong>
              <small class="muted">Asignación regional</small>
            </td>
            <td><input class="permission-view" type="checkbox" ${
              canView ? "checked" : ""
            }></td>
            <td><input class="permission-edit" type="checkbox" ${
              canEdit ? "checked" : ""
            } ${canView ? "" : "disabled"}></td>
          </tr>
        `;
      })
      .join("");
  } else {
    els.permissionsDescription.textContent =
      "Seleccione los territorios que puede consultar o editar.";

    const assignmentMap = new Map(
      state.allAssignments
        .filter((item) => item.usuario_id === userId)
        .map((item) => [item.territorio_codigo, item])
    );

    els.permissionsBody.innerHTML = state.assignableTerritories
      .map((territory) => {
        const assignment = assignmentMap.get(territory.codigo);
        const canView = assignment?.puede_ver === true;
        const canEdit = assignment?.puede_editar === true;
        return `
          <tr data-territory-code="${escapeHtml(territory.codigo)}">
            <td><strong>${escapeHtml(
              territory.nombre
            )}</strong><small class="muted">${escapeHtml(
          territory.tipo
        )}</small></td>
            <td><input class="permission-view" type="checkbox" ${
              canView ? "checked" : ""
            }></td>
            <td><input class="permission-edit" type="checkbox" ${
              canEdit ? "checked" : ""
            } ${canView ? "" : "disabled"}></td>
          </tr>
        `;
      })
      .join("");
  }

  els.permissionsModal.showModal();
}

async function savePermissions() {
  if (!state.selectedUserId) return;
  hideLocalMessage(els.permissionsMessage);
  els.savePermissions.disabled = true;
  els.savePermissions.textContent = "Guardando…";

  const rows = [
    ...els.permissionsBody.querySelectorAll(
      "tr[data-territory-code]"
    )
  ];

  try {
    if (state.selectedPermissionType === "REGIONAL") {
      const assignments = rows
        .map((row) => ({
          usuario_id: state.selectedUserId,
          territorio_codigo: row.dataset.territoryCode,
          region: row.dataset.region,
          puede_ver: row.querySelector(".permission-view").checked,
          puede_editar:
            row.querySelector(".permission-edit").checked,
          activo: true
        }))
        .filter((item) => item.puede_ver)
        .map((item) => ({
          ...item,
          puede_editar: item.puede_ver && item.puede_editar
        }));

      const { error: deleteError } = await supabase
        .from("usuario_regiones")
        .delete()
        .eq("usuario_id", state.selectedUserId);
      if (deleteError) throw deleteError;

      if (assignments.length) {
        const { error: insertError } = await supabase
          .from("usuario_regiones")
          .insert(assignments);
        if (insertError) throw insertError;
      }
    } else {
      const assignments = rows
        .map((row) => ({
          usuario_id: state.selectedUserId,
          territorio_codigo: row.dataset.territoryCode,
          puede_ver: row.querySelector(".permission-view").checked,
          puede_editar:
            row.querySelector(".permission-edit").checked,
          activo: true
        }))
        .filter((item) => item.puede_ver)
        .map((item) => ({
          ...item,
          puede_editar: item.puede_ver && item.puede_editar
        }));

      const { error: deleteError } = await supabase
        .from("usuario_territorios")
        .delete()
        .eq("usuario_id", state.selectedUserId);
      if (deleteError) throw deleteError;

      if (assignments.length) {
        const { error: insertError } = await supabase
          .from("usuario_territorios")
          .insert(assignments);
        if (insertError) throw insertError;
      }
    }

    showLocalMessage(
      els.permissionsMessage,
      "Permisos actualizados.",
      "success"
    );
    await loadAdminData();
    setTimeout(() => els.permissionsModal.close(), 650);
  } catch (error) {
    showLocalMessage(
      els.permissionsMessage,
      error.message || "No se pudieron guardar los permisos."
    );
  } finally {
    els.savePermissions.disabled = false;
    els.savePermissions.textContent = "Guardar permisos";
  }
}

function openPasswordModal(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  state.passwordUserId = userId;
  hideLocalMessage(els.passwordMessage);
  els.adminNewPassword.value = "";
  els.passwordTitle.textContent = "Restablecer contraseña";
  els.passwordContext.textContent = `${user.nombre_completo || user.usuario_login} · @${user.usuario_login}`;
  els.passwordModal.showModal();
}

async function resetPassword(event) {
  event.preventDefault();
  if (!state.passwordUserId) return;
  hideLocalMessage(els.passwordMessage);
  const password = els.adminNewPassword.value;
  if (password.length < 8) {
    showLocalMessage(els.passwordMessage, "La contraseña debe tener al menos 8 caracteres.");
    return;
  }

  els.savePassword.disabled = true;
  els.savePassword.textContent = "Restableciendo…";
  try {
    await invokeAuthenticatedFunction(adminFunctionUrl, {
      action: "reset_password",
      usuario_id: state.passwordUserId,
      contrasena: password
    });
    showLocalMessage(els.passwordMessage, "Contraseña restablecida. El usuario deberá cambiarla al entrar.", "success");
    await loadAdminData();
    setTimeout(() => els.passwordModal.close(), 700);
  } catch (error) {
    showLocalMessage(els.passwordMessage, error.message || "No se pudo restablecer la contraseña.");
  } finally {
    els.savePassword.disabled = false;
    els.savePassword.textContent = "Restablecer";
  }
}

async function setUserActive(userId, active) {
  await invokeAuthenticatedFunction(adminFunctionUrl, {
    action: "set_active",
    usuario_id: userId,
    activo: active
  });
  await loadAdminData();
  showMessage(`Usuario ${active ? "activado" : "desactivado"} correctamente.`, "success");
}

async function setUserRole(userId, role) {
  await invokeAuthenticatedFunction(adminFunctionUrl, {
    action: "set_role",
    usuario_id: userId,
    rol: role
  });
  await loadAdminData();
  showMessage("Rol actualizado correctamente.", "success");
}

async function deleteUser(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  const accepted = window.confirm(`¿Eliminar definitivamente a ${user.nombre_completo || user.usuario_login}? Esta acción no se puede deshacer.`);
  if (!accepted) return;

  await invokeAuthenticatedFunction(adminFunctionUrl, {
    action: "delete_user",
    usuario_id: userId
  });
  await loadAdminData();
  showMessage("Usuario eliminado correctamente.", "success");
}

async function loadAudit() {
  if (!state.isAdmin) return;
  els.auditBody.innerHTML = '<tr><td colspan="6" class="loading">Cargando auditoría…</td></tr>';

  const { data: rows, error } = await supabase
    .from("auditoria_registros")
    .select("id,id_registro,estructura_codigo,territorio_codigo,usuario_id,fecha,campos_modificados,datos_anteriores,datos_nuevos")
    .order("fecha", { ascending: false })
    .limit(200);
  if (error) throw error;

  const userIds = [...new Set((rows || []).map((item) => item.usuario_id).filter(Boolean))];
  const structureCodes = [...new Set((rows || []).map((item) => item.estructura_codigo).filter(Boolean))];

  const [profilesResult, structuresResult] = await Promise.all([
    userIds.length
      ? supabase.from("perfiles").select("id,usuario_login,nombre_completo").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    structureCodes.length
      ? supabase.from("estructuras").select("estructura_codigo,estructura_nombre").in("estructura_codigo", structureCodes)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (structuresResult.error) throw structuresResult.error;

  const profileMap = new Map((profilesResult.data || []).map((item) => [item.id, item]));
  const structureMap = new Map((structuresResult.data || []).map((item) => [item.estructura_codigo, item]));

  state.auditRows = (rows || []).map((row) => ({
    ...row,
    profile: profileMap.get(row.usuario_id),
    structure: structureMap.get(row.estructura_codigo)
  }));

  renderAudit();
}

function renderAudit() {
  if (!state.auditRows.length) {
    els.auditBody.innerHTML = '<tr><td colspan="6" class="loading">Todavía no hay modificaciones registradas.</td></tr>';
    return;
  }

  els.auditBody.innerHTML = state.auditRows.map((row) => `
    <tr>
      <td>${escapeHtml(formatDate(row.fecha))}</td>
      <td><strong>${escapeHtml(row.profile?.nombre_completo || row.profile?.usuario_login || "Sistema")}</strong><small class="muted">${escapeHtml(row.profile?.usuario_login || "")}</small></td>
      <td><strong>${escapeHtml(row.structure?.estructura_nombre || row.estructura_codigo)}</strong><small class="muted">${escapeHtml(row.territorio_codigo)}</small></td>
      <td>${escapeHtml(row.id_registro)}</td>
      <td>${(row.campos_modificados || []).map((field) => `<span class="territory-chip">${escapeHtml(field)}</span>`).join(" ")}</td>
      <td><button class="button ghost small audit-detail" type="button" data-audit-id="${row.id}">Ver detalle</button></td>
    </tr>
  `).join("");
}

function openAuditDetail(auditId) {
  const row = state.auditRows.find((item) => String(item.id) === String(auditId));
  if (!row) return;
  els.auditDetailContent.innerHTML = `
    <div class="audit-detail-column">
      <h3>Datos anteriores</h3>
      <pre class="audit-json">${escapeHtml(JSON.stringify(row.datos_anteriores, null, 2))}</pre>
    </div>
    <div class="audit-detail-column">
      <h3>Datos nuevos</h3>
      <pre class="audit-json">${escapeHtml(JSON.stringify(row.datos_nuevos, null, 2))}</pre>
    </div>
  `;
  els.auditDetailModal.showModal();
}

async function initialize() {
  if (!(await requireSession())) return;

  try {
    await loadTerritories();
    await loadStructures();
    if (state.isAdmin) await loadAdminData();
  } catch (error) {
    showMessage(error.message || "No se pudo cargar el portal.", "error", 9000);
  }
}

els.signOut.addEventListener("click", async () => {
  await supabase.auth.signOut();
  clearLoginContext();
  window.location.replace("index.html");
});

els.changePassword.addEventListener("click", () => window.location.assign("cambiar-contrasena.html"));

els.mainTabs.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button || button.hidden) return;
  const tab = button.dataset.tab;
  setActiveTab(tab);
  try {
    if (tab === "users") await loadAdminData();
    if (tab === "audit") await loadAudit();
  } catch (error) {
    showMessage(error.message || "No se pudo cargar la sección.");
  }
});

els.territorySelect.addEventListener("change", async () => {
  state.selectedTerritory = els.territorySelect.value;
  els.structureSearch.value = "";
  els.recordSearch.value = "";
  try {
    await loadStructures();
  } catch (error) {
    showMessage(error.message || "No se pudieron cargar las estructuras.");
  }
});

els.structureSearch.addEventListener("input", renderStructureList);
els.recordSearch.addEventListener("input", renderRecordCards);

els.structureList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-structure-code]");
  if (!button) return;
  try {
    await selectStructure(button.dataset.structureCode);
  } catch (error) {
    showMessage(error.message || "No se pudo abrir la estructura.");
  }
});

els.recordsGrid.addEventListener("click", async (event) => {
  const recordButton = event.target.closest(".open-record[data-record-id]");
  if (recordButton) {
    openRecord(recordButton.dataset.recordId);
    return;
  }

  const zoneButton = event.target.closest(".open-zone[data-zone-code]");
  if (zoneButton) {
    try {
      await selectStructure(zoneButton.dataset.zoneCode);
      document.querySelector("#territorial-header")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage(error.message || "No se pudo abrir la zona.");
    }
  }
});

els.recordForm.addEventListener("submit", saveRecord);
els.closeRecordModal.addEventListener("click", () => els.recordModal.close());
els.cancelRecord.addEventListener("click", () => els.recordModal.close());
els.printSummary.addEventListener("click", () => window.print());
els.exportSummary.addEventListener("click", exportSummaryCsv);

els.createUserForm.addEventListener("submit", createUser);

els.assignmentType.addEventListener("change", () => {
  updateCreateUserAssignmentFields();
});

els.createUserForm.elements.territorio_codigo.addEventListener(
  "change",
  () => {
    if (els.assignmentType.value === "REGIONAL") {
      populateCreateUserRegions();
    }
  }
);
els.refreshUsers.addEventListener("click", async () => {
  try { await loadAdminData(); } catch (error) { showMessage(error.message); }
});
els.userSearch.addEventListener("input", renderUsers);

els.usersBody.addEventListener("change", async (event) => {
  const select = event.target.closest(".user-role-select");
  if (!select) return;
  try {
    await setUserRole(select.dataset.userId, select.value);
  } catch (error) {
    showMessage(error.message || "No se pudo cambiar el rol.");
    await loadAdminData();
  }
});

els.usersBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-user-id]");
  if (!button) return;
  const userId = button.dataset.userId;

  try {
    if (button.classList.contains("user-permissions")) openPermissions(userId);
    if (button.classList.contains("user-password")) openPasswordModal(userId);
    if (button.classList.contains("user-toggle")) await setUserActive(userId, button.dataset.active !== "true");
    if (button.classList.contains("user-delete")) await deleteUser(userId);
  } catch (error) {
    showMessage(error.message || "No se pudo completar la acción.");
  }
});

els.permissionsBody.addEventListener("change", (event) => {
  const row = event.target.closest("tr[data-territory-code]");
  if (!row) return;
  const view = row.querySelector(".permission-view");
  const edit = row.querySelector(".permission-edit");
  if (event.target === view) {
    edit.disabled = !view.checked;
    if (!view.checked) edit.checked = false;
  }
  if (event.target === edit && edit.checked) view.checked = true;
});

els.savePermissions.addEventListener("click", savePermissions);
els.closePermissions.addEventListener("click", () => els.permissionsModal.close());
els.cancelPermissions.addEventListener("click", () => els.permissionsModal.close());
els.passwordForm.addEventListener("submit", resetPassword);
els.closePasswordModal.addEventListener("click", () => els.passwordModal.close());
els.cancelPassword.addEventListener("click", () => els.passwordModal.close());
els.refreshAudit.addEventListener("click", async () => {
  try { await loadAudit(); } catch (error) { showMessage(error.message); }
});
els.auditBody.addEventListener("click", (event) => {
  const button = event.target.closest(".audit-detail[data-audit-id]");
  if (button) openAuditDetail(button.dataset.auditId);
});
els.closeAuditDetail.addEventListener("click", () => els.auditDetailModal.close());

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    clearLoginContext();
    window.location.replace("index.html");
  }
});

await initialize();
