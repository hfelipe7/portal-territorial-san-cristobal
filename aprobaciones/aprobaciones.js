// SIGEP PRM SC — APROBACIONES BUILD: APROBACIONES_DASHBOARD_TERRITORIAL_V1_6
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

window.__SIGEP_APROBACIONES_BUILD__ = "APROBACIONES_DASHBOARD_TERRITORIAL_V1_6";

const config = window.SIGEP_ADMIN_CONFIG || {};
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const PAGE_SIZE = 20;
const OPEN_STATES = new Set([
  "PENDIENTE",
  "EN_REVISION",
  "REQUIERE_CORRECCION",
  "REABIERTA"
]);

const STATE_DEFS = [
  { value: "PENDIENTE", label: "Pendientes", group: "Trabajo" },
  { value: "EN_REVISION", label: "En revisión", group: "Trabajo" },
  { value: "REQUIERE_CORRECCION", label: "Requiere corrección", group: "Seguimiento" },
  { value: "REABIERTA", label: "Reabiertas", group: "Trabajo" },
  { value: "APROBADA", label: "Aprobadas", group: "Histórico" },
  { value: "RECHAZADA", label: "Rechazadas", group: "Histórico" },
  { value: "CERRADA_POR_OCUPACION", label: "Cerradas por ocupación", group: "Histórico" },
  { value: "DUPLICADA", label: "Duplicadas", group: "Histórico" },
  { value: "ANULADA", label: "Anuladas", group: "Histórico" }
];

const STATE_LABELS = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  REQUIERE_CORRECCION: "Requiere corrección",
  REABIERTA: "Reabierta",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CERRADA_POR_OCUPACION: "Cerrada por ocupación",
  DUPLICADA: "Duplicada",
  ANULADA: "Anulada"
};
const TYPE_DEFS = [
  { value: "NUEVO_CARGO", label: "Solicitudes de cargo" },
  { value: "ACTUALIZACION_DATOS", label: "Actualizaciones de datos" },
  { value: "CORRECCION_FICHA", label: "Correcciones de ficha" }
];
const TYPE_LABELS = {
  NUEVO_CARGO: "Solicitud de cargo",
  ACTUALIZACION_DATOS: "Actualización de datos",
  CORRECCION_FICHA: "Corrección de ficha"
};

const FIELD_LABELS = {
  telefono_celular: "Teléfono celular",
  telefono_celular_2: "Segundo teléfono celular",
  telefono_casa: "Teléfono residencial",
  telefono_otro: "Otro teléfono",
  whassapp: "WhatsApp",
  direccion: "Dirección",
  correo_eletronico: "Correo electrónico",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
  observacion: "Observación",
  nombre_completo: "Nombre",
  cedula: "Cédula",
  estructura_codigo: "Estructura",
  cargo_codigo: "Cargo",
  nivel: "Nivel",
  territorio: "Ubicación territorial"
};

const BLOCK_MESSAGES = {
  ESTADO_NO_APROBABLE: "La solicitud no está disponible para esta acción.",
  ESTADO_NO_RESOLUBLE: "La corrección no está disponible para resolución.",
  VINCULACION_INCONSISTENTE: "Los datos actuales no coinciden con la solicitud. Revise el detalle.",
  FICHA_OCUPADA: "La ficha relacionada ya se encuentra ocupada.",
  FICHA_NO_ENCONTRADA: "La ficha relacionada ya no está disponible.",
  FICHA_NO_CORRESPONDE_A_IDENTIDAD: "La ficha actual no corresponde a la identidad de la solicitud.",
  SIN_CAMBIOS: "La solicitud no contiene cambios disponibles.",
  CAMBIO_POSTERIOR_DETECTADO: "La ficha cambió después del envío. Actualice y revise antes de continuar.",
  TIPO_SOLICITUD_INVALIDO: "El tipo de solicitud no está disponible para esta acción."
};

let supabase;
let approvalContext = null;
let dashboardSummary = null;
let requests = [];
let listPayload = null;
let currentOffset = 0;
let selectedDetail = null;
let actionContext = null;
const detailCache = new Map();
const scopeNameCache = new Map();

function normalizePayload(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function rpcRow(value) {
  const normalized = normalizePayload(value);
  return Array.isArray(normalized) ? normalized[0] : normalized;
}

function isConfigured() {
  return Boolean(
    config.supabaseUrl &&
    !config.supabaseUrl.includes("PROJECT_REF") &&
    config.publishableKey &&
    !config.publishableKey.includes("YOUR_")
  );
}

function showMessage(message, type = "info") {
  const box = $("#admin-message");
  box.textContent = message;
  box.className = `message ${type}`;
  box.hidden = false;
}

function clearMessage() {
  $("#admin-message").hidden = true;
}

function showDetailMessage(message, type = "info") {
  const box = $("#detail-message");
  box.textContent = message;
  box.className = `message ${type}`;
  box.hidden = false;
}

function clearDetailMessage() {
  $("#detail-message").hidden = true;
}

function setTechnicalDiagnostic(context, detail) {
  const panel = $("#technical-panel");
  const content = $("#technical-content");
  if (!approvalContext?.es_admin) {
    panel.hidden = true;
    content.textContent = "";
    return;
  }
  panel.hidden = false;
  content.textContent = `${context}\n${typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}`;
}

function clearTechnicalDiagnostic() {
  const panel = $("#technical-panel");
  panel.hidden = true;
  $("#technical-content").textContent = "";
}

function showOperationalError(fallback, technicalDetail = null) {
  showMessage(fallback, "error");
  if (technicalDetail) setTechnicalDiagnostic("Detalle de diagnóstico", technicalDetail);
}

function friendlyResultMessage(result, fallback) {
  const code = result?.codigo_resultado;
  const known = {
    NO_AUTORIZADO: "No tiene autorización para realizar esta acción.",
    SIN_ALCANCES_DE_APROBACION: "No tiene territorios disponibles para gestionar aprobaciones.",
    SOLICITUD_NO_ENCONTRADA: "La solicitud ya no está disponible.",
    ESTADO_NO_APROBABLE: "La solicitud cambió y debe actualizar la pantalla.",
    TRANSICION_NO_PERMITIDA: "La solicitud cambió y debe actualizar la pantalla.",
    CAMBIO_POSTERIOR_DETECTADO: "La ficha cambió después del envío. Revise el detalle nuevamente.",
    CARGO_OCUPADO: "La ficha ya se encuentra ocupada.",
    FICHA_NO_ENCONTRADA: "La ficha relacionada ya no está disponible.",
    VINCULACION_INCONSISTENTE: "Los datos actuales no coinciden con la solicitud. Revise el detalle."
  };
  return known[code] || fallback;
}

function formatDate(value) {
  if (!value) return "No registrada";
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") {
    return '<span class="value-empty">Vacío / no registrado</span>';
  }
  if (typeof value === "object") return escapeHtml(JSON.stringify(value));
  return escapeHtml(value);
}

function itemType(item) {
  return item?.tipo_solicitud || "NUEVO_CARGO";
}

function requestedFieldNames(item) {
  const changes = item?.cambios_solicitados;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  return Object.keys(changes).map((key) => FIELD_LABELS[key] || key);
}

function scopeFromKey(key) {
  if (!key) return null;
  const [type, territory, region] = key.split("|");
  if (type === "REGION" && territory && region) {
    return { type, territory, region, key };
  }
  if (type === "TERRITORIO" && territory) {
    return { type, territory, region: null, key };
  }
  return null;
}

function scopeNameByKey(key) {
  return dashboardSummary?.alcances?.find((scope) => scope.alcance_clave === key)?.alcance_nombre || scopeNameCache.get(key) || "Todos mis territorios";
}

function routeState() {
  const hash = window.location.hash || "#/dashboard";
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length || parts[0] === "dashboard") return { view: "dashboard" };

  if (parts[0] === "solicitudes") {
    return { view: "queue" };
  }

  if (parts[0] === "cola" && parts[1]) {
    return { view: "queue", state: parts[1] };
  }

  if (parts[0] === "tipo" && parts[1]) {
    return { view: "queue", type: parts[1] };
  }

  if (parts[0] === "alcance" && parts[1] && parts[2]) {
    const scope = {
      type: parts[1],
      territory: parts[2],
      region: null
    };
    let index = 3;
    if (scope.type === "REGION") {
      scope.region = parts[3] || null;
      index = 4;
    }
    const state = parts[index] === "cola" ? parts[index + 1] : null;
    return { view: "queue", scope, state };
  }

  return { view: "dashboard" };
}

function navigateToDashboard() {
  window.location.hash = "#/dashboard";
}

function navigateToState(state) {
  window.location.hash = `#/cola/${encodeURIComponent(state)}`;
}

function navigateToType(type) {
  window.location.hash = `#/tipo/${encodeURIComponent(type)}`;
}

function navigateToScope(scope, state = null) {
  const base = scope.tipo_alcance === "REGION"
    ? `#/alcance/REGION/${encodeURIComponent(scope.territorio_codigo)}/${encodeURIComponent(scope.region)}`
    : `#/alcance/TERRITORIO/${encodeURIComponent(scope.territorio_codigo)}`;
  window.location.hash = state ? `${base}/cola/${encodeURIComponent(state)}` : base;
}

async function verifyAccess() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    showOperationalError("No fue posible recuperar la sesión.", sessionError);
    return "ERROR";
  }

  const session = sessionData.session;
  if (!session) return "NO_SESSION";

  const { data, error } = await supabase.rpc("sigep_aprobaciones_contexto_actual");
  if (error) {
    showOperationalError("No fue posible verificar el acceso.", error);
    return "ERROR";
  }

  const payload = normalizePayload(data);
  if (!payload || payload.ok !== true || payload.puede_aprobar_alguno !== true) {
    approvalContext = payload || null;
    showOperationalError("La cuenta no tiene autorización activa para gestionar aprobaciones.", payload);
    $("#session-user").textContent =
      payload?.perfil?.nombre_completo ||
      payload?.perfil?.usuario_login ||
      session.user.email ||
      "Usuario";
    return "NO_PERMISSION";
  }

  approvalContext = payload;
  $("#session-user").textContent =
    payload.perfil?.nombre_completo ||
    payload.perfil?.usuario_login ||
    session.user.email ||
    "Usuario autorizado";
  return "AUTHORIZED";
}

async function loadDashboardSummary() {
  const { data, error } = await supabase.rpc("sigep_aprobaciones_dashboard_resumen");
  if (error) throw error;
  const payload = normalizePayload(data);
  if (!payload || payload.ok !== true) {
    const failure = new Error("No fue posible cargar el dashboard.");
    failure.userMessage = friendlyResultMessage(payload, "No fue posible cargar el dashboard.");
    failure.payload = payload;
    throw failure;
  }
  dashboardSummary = payload;
  for (const scope of payload.alcances || []) {
    scopeNameCache.set(scope.alcance_clave, scope.alcance_nombre);
  }
  renderDashboard();
  populateScopeFilter();
}

function renderDashboard() {
  const stateCounts = dashboardSummary?.por_estado || {};
  const typeCounts = dashboardSummary?.por_tipo || {};
  const scopes = dashboardSummary?.alcances || [];

  $("#dashboard-total").textContent = `${dashboardSummary?.total || 0} solicitudes`;

  $("#state-dashboard").innerHTML = STATE_DEFS.map((state) => `
    <button class="dashboard-card" type="button" data-dashboard-state="${escapeHtml(state.value)}" data-state="${escapeHtml(state.value)}">
      <span>${escapeHtml(state.group)}</span>
      <strong>${Number(stateCounts[state.value] || 0)}</strong>
      <small>${escapeHtml(state.label)}</small>
    </button>
  `).join("");

  if (!scopes.length) {
    $("#scope-dashboard").innerHTML = '<div class="empty">No hay solicitudes disponibles en sus territorios autorizados.</div>';
  } else {
    $("#scope-dashboard").innerHTML = scopes.map((scope) => `
      <button class="scope-card ${scope.es_principal ? "principal" : ""}" type="button" data-scope-key="${escapeHtml(scope.alcance_clave)}">
        <div class="scope-card-header">
          <div>
            <h3>${escapeHtml(scope.alcance_nombre)}</h3>
            <p>${scope.tipo_alcance === "REGION" ? "Subterritorio regional" : "Territorio autorizado"}</p>
          </div>
          ${scope.es_principal ? '<span class="scope-badge">Principal</span>' : ""}
        </div>
        <div class="scope-counts">
          <div><span>Pendientes</span><strong>${Number(scope.por_estado?.PENDIENTE || 0)}</strong></div>
          <div><span>Abiertas</span><strong>${Number(scope.abiertas || 0)}</strong></div>
          <div><span>Total</span><strong>${Number(scope.total || 0)}</strong></div>
        </div>
      </button>
    `).join("");
  }

  $("#type-dashboard").innerHTML = TYPE_DEFS.map((type) => `
    <button class="type-card ${escapeHtml(type.value)}" type="button" data-dashboard-type="${escapeHtml(type.value)}">
      <span>${escapeHtml(type.label)}</span>
      <strong>${Number(typeCounts[type.value] || 0)}</strong>
    </button>
  `).join("");
}

function populateScopeFilter() {
  const select = $("#filter-scope");
  const scopes = [...(dashboardSummary?.alcances || [])];
  const route = routeState();
  if (route.scope) {
    const routeKey = route.scope.type === "REGION"
      ? `REGION|${route.scope.territory}|${route.scope.region}`
      : `TERRITORIO|${route.scope.territory}`;
    if (!scopes.some((scope) => scope.alcance_clave === routeKey)) {
      scopes.push({
        alcance_clave: routeKey,
        alcance_nombre: scopeNameCache.get(routeKey) || route.scope.territory,
        es_principal: false
      });
    }
  }
  select.innerHTML = '<option value="">Todos mis territorios</option>' + scopes.map((scope) => `
    <option value="${escapeHtml(scope.alcance_clave)}">${escapeHtml(scope.alcance_nombre)}${scope.es_principal ? " · Principal" : ""}</option>
  `).join("");
}

function populateStateFilter() {
  $("#filter-state").innerHTML = '<option value="">Todos</option>' + STATE_DEFS.map((state) => `
    <option value="${escapeHtml(state.value)}">${escapeHtml(state.label)}</option>
  `).join("");
}

function seedFiltersFromRoute(route) {
  $("#filter-text").value = "";
  $("#filter-type").value = route.type || "";
  $("#filter-state").value = route.state || "";
  $("#filter-level").value = "";
  $("#filter-cargo").value = "";
  $("#filter-date-from").value = "";
  $("#filter-date-to").value = "";

  if (route.scope) {
    const key = route.scope.type === "REGION"
      ? `REGION|${route.scope.territory}|${route.scope.region}`
      : `TERRITORIO|${route.scope.territory}`;
    $("#filter-scope").value = key;
  } else {
    $("#filter-scope").value = "";
  }
}

function currentFilterParams() {
  const scope = scopeFromKey($("#filter-scope").value);
  return {
    p_estado: $("#filter-state").value || null,
    p_tipo: $("#filter-type").value || null,
    p_nivel: $("#filter-level").value || null,
    p_tipo_alcance: scope?.type || null,
    p_territorio_codigo: scope?.territory || null,
    p_region: scope?.region || null,
    p_busqueda: $("#filter-text").value.trim() || null,
    p_cargo: $("#filter-cargo").value.trim() || null,
    p_fecha_desde: $("#filter-date-from").value || null,
    p_fecha_hasta: $("#filter-date-to").value || null,
    p_limite: PAGE_SIZE,
    p_offset: currentOffset
  };
}

function updateQueueHeading() {
  const state = $("#filter-state").value;
  const type = $("#filter-type").value;
  const scopeKey = $("#filter-scope").value;
  const parts = [];
  if (scopeKey) parts.push(scopeNameByKey(scopeKey));
  if (state) parts.push(STATE_DEFS.find((item) => item.value === state)?.label || state);
  if (type) parts.push(TYPE_LABELS[type] || type);

  $("#queue-title").textContent = parts.length ? parts.join(" · ") : "Todas las solicitudes autorizadas";
  $("#queue-context").textContent = scopeKey
    ? "Cola correspondiente al territorio o subterritorio seleccionado."
    : "Vista consolidada de todos los alcances donde puede gestionar solicitudes.";
  $("#queue-breadcrumb").textContent = parts.length ? parts.join(" / ") : "Todas las solicitudes";
}

async function loadQueue() {
  clearMessage();
  clearTechnicalDiagnostic();
  detailCache.clear();
  updateQueueHeading();
  $("#requests-list").innerHTML = '<div class="empty">Cargando solicitudes...</div>';

  const params = currentFilterParams();
  const { data, error } = await supabase.rpc("sigep_aprobaciones_listar_solicitudes_v2", params);
  if (error) {
    requests = [];
    listPayload = null;
    $("#requests-list").innerHTML = "";
    showOperationalError("No fue posible cargar las solicitudes. Intente nuevamente.", error);
    return;
  }

  const payload = normalizePayload(data);
  if (!payload || payload.ok !== true) {
    requests = [];
    listPayload = payload;
    $("#requests-list").innerHTML = "";
    showOperationalError(friendlyResultMessage(payload, "No fue posible cargar las solicitudes."), payload);
    return;
  }

  listPayload = payload;
  requests = payload.solicitudes || [];
  renderRequests();
  renderPagination();
}

function actionButton(label, action, className = "secondary") {
  return `<button class="${escapeHtml(className)}" type="button" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
}

function cardActions(item) {
  const actions = [actionButton("Ver detalle y comparar", "VER_DETALLE", "primary")];

  if (["PENDIENTE", "REABIERTA", "REQUIERE_CORRECCION"].includes(item.estado)) {
    actions.push(actionButton("Tomar en revisión", "TOMAR_REVISION"));
  }
  if (["PENDIENTE", "EN_REVISION", "REABIERTA"].includes(item.estado)) {
    actions.push(actionButton("Requerir corrección", "REQUERIR_CORRECCION", "warning"));
  }
  if (OPEN_STATES.has(item.estado)) {
    actions.push(actionButton("Rechazar", "RECHAZAR", "danger"));
    actions.push(actionButton("Marcar duplicada", "MARCAR_DUPLICADA"));
  }
  if (["RECHAZADA", "REQUIERE_CORRECCION", "DUPLICADA", "ANULADA"].includes(item.estado)) {
    actions.push(actionButton("Reabrir", "REABRIR"));
  }
  if (!["APROBADA", "CERRADA_POR_OCUPACION", "ANULADA"].includes(item.estado)) {
    actions.push(actionButton("Anular", "ANULAR", "danger"));
  }
  return actions.join("");
}

function requestSummary(item) {
  const type = itemType(item);
  if (type === "ACTUALIZACION_DATOS") {
    const fields = requestedFieldNames(item);
    return `
      <div class="request-summary">
        <strong>${fields.length} campo${fields.length === 1 ? "" : "s"} solicitado${fields.length === 1 ? "" : "s"}</strong>
        <div class="field-chip-list">
          ${fields.map((field) => `<span class="field-chip">${escapeHtml(field)}</span>`).join("") || '<span class="value-empty">Sin campos identificados</span>'}
        </div>
      </div>`;
  }
  if (type === "CORRECCION_FICHA") {
    return `
      <div class="request-summary">
        <strong>Corrección reportada</strong>
        <p>${escapeHtml(item.descripcion_correccion || "Sin descripción adicional.")}</p>
      </div>`;
  }
  return `
    <div class="request-summary">
      <strong>Solicitud para ocupar la ficha indicada</strong>
    </div>`;
}

function renderRequests() {
  const total = Number(listPayload?.total || 0);
  $("#results-count").textContent = `${total} resultado${total === 1 ? "" : "s"}`;

  if (!requests.length) {
    $("#requests-list").innerHTML = '<div class="empty">No hay solicitudes disponibles con los criterios seleccionados.</div>';
    return;
  }

  $("#requests-list").innerHTML = requests.map((item) => {
    const scopeName = item.alcance_nombre || item.estructura_nombre_snapshot || "Territorio autorizado";
    return `
      <article class="request-card type-card-${escapeHtml(itemType(item))}" data-public-id="${escapeHtml(item.public_id)}">
        <div class="scope-context ${item.es_alcance_principal ? "principal" : ""}">
          ${item.es_alcance_principal ? "Principal · " : ""}${escapeHtml(scopeName)}
        </div>
        <div class="request-header">
          <div>
            <h3>${escapeHtml(item.nombre_completo)}</h3>
            <p>${escapeHtml(item.cedula_enmascarada || "")}</p>
          </div>
          <div class="badge-stack">
            <span class="type-badge type-${escapeHtml(itemType(item))}">${escapeHtml(TYPE_LABELS[itemType(item)] || itemType(item))}</span>
            <span class="state-badge state-${escapeHtml(item.estado)}">${escapeHtml(STATE_LABELS[item.estado] || item.estado)}</span>
          </div>
        </div>
        <div class="request-grid">
          <div class="detail"><span>Nivel</span><strong>${escapeHtml(item.nivel_solicitado)}</strong></div>
          <div class="detail"><span>Estructura</span><strong>${escapeHtml(item.estructura_nombre_snapshot || item.estructura_codigo)}</strong></div>
          <div class="detail"><span>Cargo</span><strong>${escapeHtml(item.cargo_nombre_snapshot)}</strong></div>
          <div class="detail"><span>Recibida</span><strong>${escapeHtml(formatDate(item.creado_en))}</strong></div>
        </div>
        ${requestSummary(item)}
        ${item.motivo_revision ? `<div class="request-note">${escapeHtml(item.motivo_revision)}</div>` : ""}
        <div class="request-actions">${cardActions(item)}</div>
      </article>`;
  }).join("");
}

function renderPagination() {
  const total = Number(listPayload?.total || 0);
  const page = Math.floor(currentOffset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  $("#page-indicator").textContent = `Página ${page} de ${totalPages}`;
  $("#previous-page").disabled = !listPayload?.tiene_anterior;
  $("#next-page").disabled = !listPayload?.tiene_siguiente;
  $("#pagination").hidden = total <= PAGE_SIZE;
}

async function loadDetail(publicId, force = false) {
  if (!force && detailCache.has(publicId)) return detailCache.get(publicId);
  const { data, error } = await supabase.rpc("sigep_captacion_detallar_solicitud", {
    p_solicitud_public_id: publicId
  });
  if (error) throw error;
  const row = rpcRow(data);
  if (!row || row.ok !== true) {
    const failure = new Error("No fue posible calcular el detalle.");
    failure.userMessage = friendlyResultMessage(row, "No fue posible calcular el detalle.");
    failure.payload = row;
    throw failure;
  }
  detailCache.set(publicId, row);
  return row;
}

function comparisonRows(detail) {
  const rows = detail.comparacion_campos || [];
  if (!rows.length) return '<tr><td colspan="4" class="value-empty">No hay campos para comparar.</td></tr>';

  return rows.map((row) => {
    const conflict = row.cambio_posterior === true;
    const currentValue = row.valor_actual_enmascarado ?? row.valor_actual;
    const requestedValue =
      row.valor_solicitado_enmascarado ??
      row.valor_solicitado ??
      row.valor_al_enviar_enmascarado ??
      row.valor_al_enviar;
    return `
      <tr class="${conflict ? "has-conflict" : ""}">
        <td><strong>${escapeHtml(row.etiqueta || FIELD_LABELS[row.campo] || row.campo)}</strong></td>
        <td>${displayValue(currentValue)}</td>
        <td>${displayValue(requestedValue)}</td>
        <td><span class="change-badge ${conflict ? "change-conflict" : "change-ok"}">${conflict ? "Cambió después del envío" : "Sin conflicto detectado"}</span></td>
      </tr>`;
  }).join("");
}

function detailActions(detail) {
  if (!detail?.solicitud_public_id) return "";
  const actions = [];
  if (detail.puede_ejecutar_accion_principal) {
    if (detail.tipo_solicitud === "NUEVO_CARGO") {
      actions.push(actionButton("Aprobar solicitud", "APROBAR_NUEVO", "success"));
    } else if (detail.tipo_solicitud === "ACTUALIZACION_DATOS") {
      actions.push(actionButton("Aprobar actualización", "APROBAR_ACTUALIZACION", "success"));
    } else if (detail.tipo_solicitud === "CORRECCION_FICHA") {
      actions.push(actionButton("Resuelta con cambio", "RESUELTA_CON_CAMBIO", "success"));
      actions.push(actionButton("Validada sin cambio", "VALIDADA_SIN_CAMBIO"));
    }
  }
  return actions.join("");
}

function renderDetail(detail) {
  selectedDetail = detail;
  const request = detail.solicitud || {};
  const current = detail.ficha_actual || {};

  $("#detail-title").textContent = request.nombre_completo || "Detalle de solicitud";
  $("#detail-subtitle").textContent = `${TYPE_LABELS[detail.tipo_solicitud] || detail.tipo_solicitud} · ${STATE_LABELS[detail.estado_solicitud] || detail.estado_solicitud}`;

  const blockMessage = detail.bloqueo_codigo ? (BLOCK_MESSAGES[detail.bloqueo_codigo] || "La solicitud requiere una revisión adicional antes de continuar.") : null;
  if (detail.bloqueo_codigo && approvalContext?.es_admin) {
    setTechnicalDiagnostic("Código de bloqueo del detalle", detail.bloqueo_codigo);
  }

  $("#detail-content").innerHTML = `
    <section class="detail-summary-grid">
      <div class="detail"><span>Solicitante</span><strong>${escapeHtml(request.nombre_completo)}</strong></div>
      <div class="detail"><span>Cédula</span><strong>${escapeHtml(request.cedula_enmascarada)}</strong></div>
      <div class="detail"><span>Teléfono</span><strong>${escapeHtml(request.telefono_contacto || "No registrado")}</strong></div>
      <div class="detail"><span>Estructura solicitada</span><strong>${escapeHtml(request.estructura_nombre || request.estructura_codigo)}</strong></div>
      <div class="detail"><span>Cargo solicitado</span><strong>${escapeHtml(request.cargo)}</strong></div>
      <div class="detail"><span>Ficha actual</span><strong>${escapeHtml(current.id_registro || "No localizada")}</strong></div>
    </section>
    ${blockMessage ? `<div class="request-note error-note">${escapeHtml(blockMessage)}</div>` : ""}
    <section class="detail-section">
      <h3>Comparación antes de decidir</h3>
      <div class="comparison-wrap">
        <table class="comparison-table">
          <thead><tr><th>Campo</th><th>Valor actual</th><th>Valor solicitado / original</th><th>Validación</th></tr></thead>
          <tbody>${comparisonRows(detail)}</tbody>
        </table>
      </div>
    </section>
    ${request.descripcion_correccion ? `<section class="detail-section"><h3>Descripción de la corrección</h3><p>${escapeHtml(request.descripcion_correccion)}</p></section>` : ""}
  `;
  $("#detail-actions").innerHTML = detailActions(detail);
}

async function openDetail(publicId) {
  clearDetailMessage();
  $("#detail-content").innerHTML = '<div class="loading-block">Calculando comparación...</div>';
  $("#detail-actions").innerHTML = "";
  $("#detail-dialog").showModal();
  try {
    const detail = await loadDetail(publicId);
    renderDetail(detail);
  } catch (error) {
    showDetailMessage(error.userMessage || "No fue posible abrir el detalle.", "error");
    if (approvalContext?.es_admin) setTechnicalDiagnostic("Error al abrir detalle", error.payload || error);
  }
}

function openActionDialog(action, publicId) {
  const item = requests.find((request) => request.public_id === publicId);
  if (!item) return;

  const requiredReason = new Set([
    "REQUERIR_CORRECCION",
    "RECHAZAR",
    "ANULAR",
    "MARCAR_DUPLICADA",
    "RESUELTA_CON_CAMBIO",
    "VALIDADA_SIN_CAMBIO"
  ]).has(action);

  const titles = {
    TOMAR_REVISION: "Tomar solicitud en revisión",
    REQUERIR_CORRECCION: "Requerir corrección",
    RECHAZAR: "Rechazar solicitud",
    REABRIR: "Reabrir solicitud",
    ANULAR: "Anular solicitud",
    MARCAR_DUPLICADA: "Marcar solicitud duplicada",
    APROBAR_NUEVO: "Aprobar solicitud de cargo",
    APROBAR_ACTUALIZACION: "Aprobar actualización de datos",
    RESUELTA_CON_CAMBIO: "Cerrar corrección con cambio",
    VALIDADA_SIN_CAMBIO: "Validar corrección sin cambio"
  };

  actionContext = { action, publicId, requiredReason };
  $("#dialog-title").textContent = titles[action] || "Confirmar acción";
  $("#dialog-description").textContent = `${item.nombre_completo} · ${item.cargo_nombre_snapshot}`;
  $("#dialog-reason").value = "";
  $("#dialog-reason").required = requiredReason;

  const warning = $("#dialog-warning");
  const destructiveMessages = {
    RECHAZAR: "La solicitud pasará a la cola de rechazadas.",
    ANULAR: "La solicitud pasará a la cola de anuladas.",
    MARCAR_DUPLICADA: "La solicitud pasará a la cola de duplicadas."
  };
  if (destructiveMessages[action]) {
    warning.hidden = false;
    warning.className = "request-note error-note";
    warning.textContent = destructiveMessages[action];
  } else {
    warning.hidden = true;
  }

  $("#action-dialog").showModal();
}

async function executeAction() {
  if (!actionContext) return;
  const { action, publicId, requiredReason } = actionContext;
  const reason = $("#dialog-reason").value.trim();

  if (requiredReason && reason.length < 10) {
    showMessage("Explique la decisión con al menos 10 caracteres.", "error");
    return;
  }

  $("#dialog-confirm").disabled = true;
  $("#dialog-confirm").textContent = "Procesando…";

  try {
    let response;
    if (action === "APROBAR_NUEVO") {
      response = await supabase.rpc("sigep_captacion_aprobar_solicitud", {
        p_solicitud_public_id: publicId,
        p_observacion: reason || null
      });
    } else if (action === "APROBAR_ACTUALIZACION") {
      response = await supabase.rpc("sigep_captacion_aprobar_actualizacion_datos", {
        p_solicitud_public_id: publicId,
        p_observacion: reason || null
      });
    } else if (action === "RESUELTA_CON_CAMBIO" || action === "VALIDADA_SIN_CAMBIO") {
      response = await supabase.rpc("sigep_captacion_resolver_correccion_ficha", {
        p_solicitud_public_id: publicId,
        p_resultado: action,
        p_observacion: reason
      });
    } else {
      response = await supabase.rpc("sigep_captacion_cambiar_estado_solicitud", {
        p_solicitud_public_id: publicId,
        p_accion: action,
        p_motivo: reason || null,
        p_observacion: reason || null
      });
    }

    if (response.error) throw response.error;
    const result = rpcRow(response.data);
    if (!result || result.ok !== true) {
      const failure = new Error("No fue posible completar la acción.");
      failure.userMessage = friendlyResultMessage(result, "No fue posible completar la acción.");
      failure.payload = result;
      throw failure;
    }

    $("#action-dialog").close();
    if ($("#detail-dialog").open) $("#detail-dialog").close();
    showMessage("La acción se completó correctamente.", "success");
    await loadDashboardSummary();
    await renderCurrentRoute();
  } catch (error) {
    showOperationalError(error.userMessage || "No fue posible completar la acción. Intente nuevamente o contacte al administrador.", error.payload || error);
  } finally {
    $("#dialog-confirm").disabled = false;
    $("#dialog-confirm").textContent = "Confirmar";
    actionContext = null;
  }
}

async function renderCurrentRoute() {
  const route = routeState();
  if (route.view === "dashboard") {
    $("#dashboard-home").hidden = false;
    $("#queue-view").hidden = true;
    return;
  }

  $("#dashboard-home").hidden = true;
  $("#queue-view").hidden = false;
  currentOffset = 0;
  seedFiltersFromRoute(route);
  await loadQueue();
}

async function refreshAll() {
  clearMessage();
  clearTechnicalDiagnostic();
  try {
    await loadDashboardSummary();
    await renderCurrentRoute();
  } catch (error) {
    showOperationalError("No fue posible actualizar el portal de aprobaciones.", error.payload || error);
  }
}

async function enterApplication() {
  const accessStatus = await verifyAccess();
  if (accessStatus === "NO_SESSION") {
    $("#login-panel").hidden = false;
    $("#app-shell").hidden = true;
    $("#refresh-button").hidden = true;
    $("#logout-button").hidden = true;
    return;
  }
  if (accessStatus !== "AUTHORIZED") {
    $("#login-panel").hidden = true;
    $("#app-shell").hidden = true;
    $("#refresh-button").hidden = true;
    $("#logout-button").hidden = false;
    return;
  }

  $("#login-panel").hidden = true;
  $("#app-shell").hidden = false;
  $("#refresh-button").hidden = false;
  $("#logout-button").hidden = false;
  if (!window.location.hash) window.location.hash = "#/dashboard";
  await refreshAll();
}

async function initialize() {
  populateStateFilter();
  if (!isConfigured()) {
    showMessage("La configuración del módulo de aprobaciones no está disponible.", "error");
    return;
  }

  supabase = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "portal-territorial-sc-auth"
    }
  });

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showOperationalError("No fue posible recuperar la sesión.", error);
    $("#login-panel").hidden = false;
    return;
  }

  if (data.session) await enterApplication();
  else {
    $("#login-panel").hidden = false;
    $("#app-shell").hidden = true;
  }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const { error } = await supabase.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#password").value
  });
  if (error) {
    showMessage("No fue posible iniciar sesión. Verifique sus datos.", "error");
    return;
  }
  await enterApplication();
});

$("#refresh-button").addEventListener("click", refreshAll);
$("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("../index.html");
});
$("#open-all-requests").addEventListener("click", () => {
  window.location.hash = "#/solicitudes";
});
$("#back-dashboard").addEventListener("click", navigateToDashboard);

$("#state-dashboard").addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-state]");
  if (button) navigateToState(button.dataset.dashboardState);
});

$("#scope-dashboard").addEventListener("click", (event) => {
  const button = event.target.closest("[data-scope-key]");
  if (!button) return;
  const scope = dashboardSummary?.alcances?.find((item) => item.alcance_clave === button.dataset.scopeKey);
  if (scope) navigateToScope(scope);
});

$("#type-dashboard").addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-type]");
  if (button) navigateToType(button.dataset.dashboardType);
});

$("#apply-filters").addEventListener("click", async () => {
  currentOffset = 0;
  await loadQueue();
});

$("#clear-filters").addEventListener("click", async () => {
  seedFiltersFromRoute(routeState());
  currentOffset = 0;
  await loadQueue();
});

for (const selector of ["#filter-text", "#filter-cargo"]) {
  $(selector).addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      currentOffset = 0;
      await loadQueue();
    }
  });
}

$("#previous-page").addEventListener("click", async () => {
  currentOffset = Math.max(0, Number(listPayload?.anterior_offset ?? currentOffset - PAGE_SIZE));
  await loadQueue();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#next-page").addEventListener("click", async () => {
  currentOffset = Number(listPayload?.siguiente_offset ?? currentOffset + PAGE_SIZE);
  await loadQueue();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#requests-list").addEventListener("click", (event) => {
  const card = event.target.closest("[data-public-id]");
  const button = event.target.closest("button[data-action]");
  if (!card || !button) return;
  const publicId = card.dataset.publicId;
  const action = button.dataset.action;
  if (action === "VER_DETALLE") openDetail(publicId);
  else openActionDialog(action, publicId);
});

$("#detail-actions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !selectedDetail) return;
  openActionDialog(button.dataset.action, selectedDetail.solicitud_public_id);
});

$("#detail-close").addEventListener("click", () => $("#detail-dialog").close());

$("#action-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    actionContext = null;
    $("#action-dialog").close();
    return;
  }
  await executeAction();
});

window.addEventListener("hashchange", async () => {
  if (!dashboardSummary) return;
  await renderCurrentRoute();
});

initialize();
