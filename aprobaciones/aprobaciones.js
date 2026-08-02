// SIGEP PRM SC — APROBACIONES BUILD: AUTORIZACIONES_TERRITORIALES_V1_5
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

window.__SIGEP_APROBACIONES_BUILD__ = "AUTORIZACIONES_TERRITORIALES_V1_5";

const config = window.SIGEP_ADMIN_CONFIG || {};
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

let supabase;
let requests = [];
let approvalContext = null;
let selectedDetail = null;
let actionContext = null;
const detailCache = new Map();

const OPEN_STATES = new Set([
  "PENDIENTE",
  "EN_REVISION",
  "REQUIERE_CORRECCION",
  "REABIERTA"
]);

const stateLabels = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  REQUIERE_CORRECCION: "Requiere corrección",
  REABIERTA: "Reabierta",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  DUPLICADA: "Duplicada",
  CERRADA_POR_OCUPACION: "Cerrada por ocupación",
  ANULADA: "Anulada"
};

const typeLabels = {
  NUEVO_CARGO: "Solicitud de cargo",
  ACTUALIZACION_DATOS: "Actualización de datos",
  CORRECCION_FICHA: "Corrección de ficha"
};

const fieldLabels = {
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
  if (typeof value === "object") {
    return escapeHtml(JSON.stringify(value));
  }
  return escapeHtml(value);
}

function itemType(item) {
  return item?.tipo_solicitud || "NUEVO_CARGO";
}

function requestedFieldNames(item) {
  const changes = item?.cambios_solicitados;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return [];
  }
  return Object.keys(changes).map((key) => fieldLabels[key] || key);
}

function principalLabel() {
  const principal = approvalContext?.principal;
  if (!principal) return "Sin alcance principal identificado";
  if (principal.tipo_alcance === "REGION") {
    return `${principal.territorio_nombre || principal.territorio_codigo} · Región ${principal.region}`;
  }
  return principal.territorio_nombre || principal.territorio_codigo;
}

function renderScopeSummary() {
  const container = $("#scope-summary");
  if (!container) return;

  if (approvalContext?.es_admin) {
    container.innerHTML = `
      <article class="scope-summary-card principal">
        <span>Capacidad</span>
        <strong>Administración provincial completa</strong>
        <small>Puede consultar y gestionar todas las solicitudes.</small>
      </article>
    `;
    return;
  }

  const territorial = approvalContext?.autorizaciones_territoriales || [];
  const regional = approvalContext?.autorizaciones_regionales || [];
  const approvalScopes = [...territorial, ...regional].filter(
    (scope) => scope.puede_aprobar
  );

  container.innerHTML = `
    <article class="scope-summary-card principal">
      <span>Alcance principal</span>
      <strong>${escapeHtml(principalLabel())}</strong>
      <small>Las solicitudes de este alcance se muestran con identificación normal.</small>
    </article>
    <article class="scope-summary-card additional">
      <span>Autorizaciones adicionales / transitorias</span>
      <strong>${Math.max(0, approvalScopes.length - 1)}</strong>
      <small>Las solicitudes gestionadas por un alcance adicional se resaltan en rojo.</small>
    </article>
  `;
}

async function verifyAccess() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return false;

  const { data, error } = await supabase.rpc(
    "sigep_aprobaciones_contexto_actual"
  );

  if (error) {
    showMessage(`No fue posible verificar el acceso: ${error.message}`, "error");
    return false;
  }

  const payload = normalizePayload(data);
  if (
    !payload ||
    payload.ok !== true ||
    payload.puede_aprobar_alguno !== true
  ) {
    showMessage(
      payload?.mensaje ||
      "La cuenta no tiene autorización activa para gestionar aprobaciones.",
      "error"
    );
    return false;
  }

  approvalContext = payload;
  $("#session-user").textContent =
    payload.perfil?.nombre_completo ||
    payload.perfil?.usuario_login ||
    session.user.email ||
    "Usuario autorizado";

  renderScopeSummary();
  return true;
}

async function refreshRequests() {
  clearMessage();
  detailCache.clear();
  $("#requests-list").innerHTML =
    '<div class="empty">Cargando solicitudes autorizadas...</div>';

  const { data, error } = await supabase.rpc(
    "sigep_aprobaciones_listar_solicitudes",
    { p_limite: 1000 }
  );

  if (error) {
    showMessage(
      `No fue posible cargar las solicitudes: ${error.message}`,
      "error"
    );
    $("#requests-list").innerHTML = "";
    return;
  }

  const payload = normalizePayload(data);
  if (!payload || payload.ok !== true) {
    showMessage(
      payload?.mensaje ||
      payload?.codigo_resultado ||
      "No fue posible cargar las solicitudes autorizadas.",
      "error"
    );
    $("#requests-list").innerHTML = "";
    return;
  }

  requests = payload.solicitudes || [];
  populateFilters();
  renderMetrics();
  renderRequests();
}

function populateFilters() {
  const states = [
    ...new Set(requests.map((item) => item.estado).filter(Boolean))
  ].sort();
  const levels = [
    ...new Set(requests.map((item) => item.nivel_solicitado).filter(Boolean))
  ].sort();
  const types = [...new Set(requests.map(itemType))].sort();

  $("#filter-state").innerHTML =
    '<option value="">Todos</option>' +
    states.map(
      (value) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(
          stateLabels[value] || value
        )}</option>`
    ).join("");

  $("#filter-level").innerHTML =
    '<option value="">Todos</option>' +
    levels.map(
      (value) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(
          value.replaceAll("_", " ")
        )}</option>`
    ).join("");

  $("#filter-type").innerHTML =
    '<option value="">Todos</option>' +
    types.map(
      (value) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(
          typeLabels[value] || value
        )}</option>`
    ).join("");
}

function renderMetrics() {
  const countState = (...states) =>
    requests.filter((item) => states.includes(item.estado)).length;
  const countType = (type) =>
    requests.filter((item) => itemType(item) === type).length;

  $("#metric-pending").textContent = countState(
    "PENDIENTE",
    "REABIERTA",
    "REQUIERE_CORRECCION"
  );
  $("#metric-review").textContent = countState("EN_REVISION");
  $("#metric-approved").textContent = countState("APROBADA");
  $("#metric-rejected").textContent = countState(
    "RECHAZADA",
    "ANULADA",
    "DUPLICADA"
  );
  $("#metric-closed").textContent = countState("CERRADA_POR_OCUPACION");
  $("#metric-type-new").textContent = countType("NUEVO_CARGO");
  $("#metric-type-update").textContent = countType("ACTUALIZACION_DATOS");
  $("#metric-type-correction").textContent = countType("CORRECCION_FICHA");
}

function filteredRequests() {
  const text = $("#filter-text").value.trim().toLowerCase();
  const type = $("#filter-type").value;
  const state = $("#filter-state").value;
  const level = $("#filter-level").value;
  const territory = $("#filter-territory").value.trim().toLowerCase();
  const cargo = $("#filter-cargo").value.trim().toLowerCase();
  const date = $("#filter-date").value;

  return requests.filter((item) => {
    const textHaystack =
      `${item.nombre_completo || ""} ${item.cedula_enmascarada || ""}`.toLowerCase();
    const territoryHaystack =
      `${item.territorio_codigo_snapshot || ""} ${item.alcance_nombre || ""} ` +
      `${item.estructura_nombre_snapshot || ""} ${item.municipio_snapshot || ""} ` +
      `${item.distrito_municipal_snapshot || ""} ${item.region_snapshot || ""} ` +
      `${item.zona_snapshot || ""}`.toLowerCase();
    const createdDate = item.creado_en
      ? item.creado_en.slice(0, 10)
      : "";

    return (
      (!text || textHaystack.includes(text)) &&
      (!type || itemType(item) === type) &&
      (!state || item.estado === state) &&
      (!level || item.nivel_solicitado === level) &&
      (!territory || territoryHaystack.includes(territory)) &&
      (!cargo ||
        String(item.cargo_nombre_snapshot || "")
          .toLowerCase()
          .includes(cargo)) &&
      (!date || createdDate >= date)
    );
  });
}

function competingCount(item) {
  if (itemType(item) !== "NUEVO_CARGO") return 0;
  return requests.filter(
    (candidate) =>
      itemType(candidate) === "NUEVO_CARGO" &&
      candidate.id_registro === item.id_registro &&
      OPEN_STATES.has(candidate.estado)
  ).length;
}

function actionButton(label, action, className = "secondary") {
  return `<button class="${escapeHtml(className)}" type="button" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
}

function cardActions(item) {
  const actions = [
    actionButton("Ver detalle y comparar", "VER_DETALLE", "primary")
  ];

  if (["PENDIENTE", "REABIERTA", "REQUIERE_CORRECCION"].includes(item.estado)) {
    actions.push(actionButton("Tomar en revisión", "TOMAR_REVISION"));
  }

  if (["PENDIENTE", "EN_REVISION", "REABIERTA"].includes(item.estado)) {
    actions.push(
      actionButton("Requerir corrección", "REQUERIR_CORRECCION", "warning")
    );
  }

  if (OPEN_STATES.has(item.estado)) {
    actions.push(actionButton("Rechazar", "RECHAZAR", "danger"));
    actions.push(actionButton("Marcar duplicada", "MARCAR_DUPLICADA"));
  }

  if (
    ["RECHAZADA", "REQUIERE_CORRECCION", "DUPLICADA", "ANULADA"].includes(
      item.estado
    )
  ) {
    actions.push(actionButton("Reabrir", "REABRIR"));
  }

  if (
    !["APROBADA", "CERRADA_POR_OCUPACION", "ANULADA"].includes(item.estado)
  ) {
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
          ${fields.map(
            (field) => `<span class="field-chip">${escapeHtml(field)}</span>`
          ).join("") || '<span class="value-empty">Sin campos identificados</span>'}
        </div>
      </div>
    `;
  }

  if (type === "CORRECCION_FICHA") {
    return `
      <div class="request-summary">
        <strong>Corrección reportada</strong>
        <p>${escapeHtml(
          item.descripcion_correccion || "Sin descripción adicional."
        )}</p>
      </div>
    `;
  }

  const competing = competingCount(item);
  return `
    <div class="request-summary">
      <strong>${competing} solicitud${competing === 1 ? "" : "es"} abierta${competing === 1 ? "" : "s"} para esta ficha</strong>
    </div>
  `;
}

function renderRequests() {
  const filtered = filteredRequests();
  $("#results-count").textContent =
    `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    $("#requests-list").innerHTML =
      '<div class="empty">No hay solicitudes que coincidan con los filtros y alcances autorizados.</div>';
    return;
  }

  $("#requests-list").innerHTML = filtered.map((item) => {
    const additional = item.es_asignacion_adicional === true;
    const scopeName =
      item.alcance_nombre ||
      item.territorio_codigo_actual ||
      item.territorio_codigo_snapshot ||
      item.estructura_nombre_snapshot ||
      "Alcance autorizado";

    return `
      <article class="request-card type-card-${escapeHtml(itemType(item))} ${additional ? "request-additional-scope" : ""}" data-public-id="${escapeHtml(item.public_id)}">
        ${additional
          ? `<div class="scope-alert">⚠ AUTORIZACIÓN ADICIONAL / TRANSITORIA · ${escapeHtml(scopeName)}</div>`
          : `<div class="scope-principal">Alcance principal · ${escapeHtml(scopeName)}</div>`}
        <div class="request-header">
          <div>
            <h3>${escapeHtml(item.nombre_completo)}</h3>
            <p>${escapeHtml(item.cedula_enmascarada || "")}</p>
          </div>
          <div class="badge-stack">
            <span class="type-badge type-${escapeHtml(itemType(item))}">${escapeHtml(typeLabels[itemType(item)] || itemType(item))}</span>
            <span class="state-badge state-${escapeHtml(item.estado)}">${escapeHtml(stateLabels[item.estado] || item.estado)}</span>
          </div>
        </div>
        <div class="request-grid">
          <div class="detail"><span>Nivel</span><strong>${escapeHtml(item.nivel_solicitado)}</strong></div>
          <div class="detail"><span>Estructura</span><strong>${escapeHtml(item.estructura_nombre_snapshot || item.estructura_codigo)}</strong></div>
          <div class="detail"><span>Cargo</span><strong>${escapeHtml(item.cargo_nombre_snapshot)}</strong></div>
          <div class="detail"><span>Recibida</span><strong>${escapeHtml(formatDate(item.creado_en))}</strong></div>
        </div>
        ${requestSummary(item)}
        ${item.motivo_revision
          ? `<div class="request-note">${escapeHtml(item.motivo_revision)}</div>`
          : ""}
        <div class="request-actions">${cardActions(item)}</div>
      </article>
    `;
  }).join("");
}

async function loadDetail(publicId, force = false) {
  if (!force && detailCache.has(publicId)) {
    return detailCache.get(publicId);
  }

  const { data, error } = await supabase.rpc(
    "sigep_captacion_detallar_solicitud",
    { p_solicitud_public_id: publicId }
  );

  if (error) throw error;

  const row = rpcRow(data);
  if (!row || row.ok !== true) {
    throw new Error(
      row?.mensaje ||
      row?.codigo_resultado ||
      "No fue posible calcular el detalle."
    );
  }

  detailCache.set(publicId, row);
  return row;
}

function comparisonRows(detail) {
  const rows = detail.comparacion_campos || [];
  if (!rows.length) {
    return '<tr><td colspan="4" class="value-empty">No hay campos para comparar.</td></tr>';
  }

  return rows.map((row) => {
    const conflict = row.cambio_posterior === true;
    const current =
      row.valor_actual ??
      row.valor_actual_enmascarado ??
      row.codigo_actual ??
      null;
    const requested =
      row.valor_solicitado ??
      row.valor_solicitado_enmascarado ??
      row.valor_al_enviar ??
      row.valor_al_enviar_enmascarado ??
      row.codigo_al_enviar ??
      null;

    return `
      <tr class="${conflict ? "has-conflict" : ""}">
        <td><strong>${escapeHtml(row.etiqueta || fieldLabels[row.campo] || row.campo)}</strong></td>
        <td>${displayValue(current)}</td>
        <td>${displayValue(requested)}</td>
        <td>
          <span class="change-badge ${conflict ? "change-conflict" : "change-ok"}">
            ${conflict ? "Cambio posterior detectado" : "Sin conflicto"}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

function detailActions(detail) {
  const item = requests.find(
    (request) => request.public_id === detail.solicitud_public_id
  );
  if (!item) return "";

  const type = detail.tipo_solicitud;
  const actions = [];

  if (detail.puede_ejecutar_accion_principal) {
    if (type === "NUEVO_CARGO") {
      actions.push(
        actionButton("Aprobar solicitud de cargo", "APROBAR_NUEVO", "success")
      );
    } else if (type === "ACTUALIZACION_DATOS") {
      actions.push(
        actionButton("Aprobar actualización", "APROBAR_ACTUALIZACION", "success")
      );
    } else if (type === "CORRECCION_FICHA") {
      actions.push(
        actionButton(
          "Cerrar como resuelta con cambio",
          "RESUELTA_CON_CAMBIO",
          "success"
        )
      );
      actions.push(
        actionButton(
          "Validar sin cambio",
          "VALIDADA_SIN_CAMBIO",
          "secondary"
        )
      );
    }
  }

  if (OPEN_STATES.has(item.estado)) {
    actions.push(actionButton("Rechazar", "RECHAZAR", "danger"));
  }

  return actions.join("");
}

function renderDetail(detail) {
  selectedDetail = detail;
  const request = detail.solicitud || {};
  const current = detail.ficha_actual || {};

  $("#detail-title").textContent =
    request.nombre_completo || "Detalle de solicitud";
  $("#detail-subtitle").textContent =
    `${typeLabels[detail.tipo_solicitud] || detail.tipo_solicitud} · ` +
    `${stateLabels[detail.estado_solicitud] || detail.estado_solicitud}`;

  $("#detail-content").innerHTML = `
    <section class="detail-summary-grid">
      <div class="detail"><span>Solicitante</span><strong>${escapeHtml(request.nombre_completo)}</strong></div>
      <div class="detail"><span>Cédula</span><strong>${escapeHtml(request.cedula_enmascarada)}</strong></div>
      <div class="detail"><span>Teléfono</span><strong>${escapeHtml(request.telefono_contacto || "No registrado")}</strong></div>
      <div class="detail"><span>Estructura solicitada</span><strong>${escapeHtml(request.estructura_nombre || request.estructura_codigo)}</strong></div>
      <div class="detail"><span>Cargo solicitado</span><strong>${escapeHtml(request.cargo)}</strong></div>
      <div class="detail"><span>Ficha actual</span><strong>${escapeHtml(current.id_registro || "No localizada")}</strong></div>
    </section>

    ${detail.bloqueo_codigo
      ? `<div class="request-note error-note">Bloqueo: ${escapeHtml(detail.bloqueo_codigo)}</div>`
      : ""}

    <section class="detail-section">
      <h3>Comparación antes de decidir</h3>
      <div class="comparison-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Campo</th>
              <th>Valor actual</th>
              <th>Valor solicitado / original</th>
              <th>Validación</th>
            </tr>
          </thead>
          <tbody>${comparisonRows(detail)}</tbody>
        </table>
      </div>
    </section>

    ${request.descripcion_correccion
      ? `<section class="detail-section"><h3>Descripción de la corrección</h3><p>${escapeHtml(request.descripcion_correccion)}</p></section>`
      : ""}
  `;

  $("#detail-actions").innerHTML = detailActions(detail);
}

async function openDetail(publicId) {
  clearDetailMessage();
  $("#detail-content").innerHTML =
    '<div class="loading-block">Calculando comparación...</div>';
  $("#detail-actions").innerHTML = "";
  $("#detail-dialog").showModal();

  try {
    const detail = await loadDetail(publicId);
    renderDetail(detail);
  } catch (error) {
    showDetailMessage(
      error.message || "No fue posible abrir el detalle.",
      "error"
    );
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
  $("#dialog-description").textContent =
    `${item.nombre_completo} · ${item.cargo_nombre_snapshot}`;
  $("#dialog-reason").value = "";
  $("#dialog-reason").required = requiredReason;

  const warning = $("#dialog-warning");
  if (item.es_asignacion_adicional) {
    warning.hidden = false;
    warning.className = "request-note error-note";
    warning.textContent =
      "Esta solicitud pertenece a una autorización adicional o transitoria. Confirme cuidadosamente el territorio antes de continuar.";
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
    showMessage(
      "Explique la decisión con al menos 10 caracteres.",
      "error"
    );
    return;
  }

  $("#dialog-confirm").disabled = true;
  $("#dialog-confirm").textContent = "Procesando…";

  try {
    let response;

    if (action === "APROBAR_NUEVO") {
      response = await supabase.rpc(
        "sigep_captacion_aprobar_solicitud",
        {
          p_solicitud_public_id: publicId,
          p_observacion: reason || null
        }
      );
    } else if (action === "APROBAR_ACTUALIZACION") {
      response = await supabase.rpc(
        "sigep_captacion_aprobar_actualizacion_datos",
        {
          p_solicitud_public_id: publicId,
          p_observacion: reason || null
        }
      );
    } else if (
      action === "RESUELTA_CON_CAMBIO" ||
      action === "VALIDADA_SIN_CAMBIO"
    ) {
      response = await supabase.rpc(
        "sigep_captacion_resolver_correccion_ficha",
        {
          p_solicitud_public_id: publicId,
          p_resultado: action,
          p_observacion: reason
        }
      );
    } else {
      response = await supabase.rpc(
        "sigep_captacion_cambiar_estado_solicitud",
        {
          p_solicitud_public_id: publicId,
          p_accion: action,
          p_motivo: reason || null,
          p_observacion: reason || null
        }
      );
    }

    if (response.error) throw response.error;

    const result = rpcRow(response.data);
    if (!result || result.ok !== true) {
      throw new Error(
        result?.mensaje ||
        result?.codigo_resultado ||
        "La acción no pudo completarse."
      );
    }

    $("#action-dialog").close();
    if ($("#detail-dialog").open) $("#detail-dialog").close();
    showMessage(result.mensaje || "Acción completada.", "success");
    await refreshRequests();
  } catch (error) {
    showMessage(
      error.message || "No fue posible completar la acción.",
      "error"
    );
  } finally {
    $("#dialog-confirm").disabled = false;
    $("#dialog-confirm").textContent = "Confirmar";
    actionContext = null;
  }
}

async function enterDashboard() {
  if (!(await verifyAccess())) {
    $("#login-panel").hidden = false;
    $("#dashboard").hidden = true;
    return;
  }

  $("#login-panel").hidden = true;
  $("#dashboard").hidden = false;
  $("#refresh-button").hidden = false;
  $("#logout-button").hidden = false;
  await refreshRequests();
}

async function initialize() {
  if (!isConfigured()) {
    showMessage("Falta configurar aprobaciones/config.js.", "error");
    return;
  }

  supabase = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await enterDashboard();
  }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const email = $("#email").value.trim();
  const password = $("#password").value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage(error.message || "No fue posible iniciar sesión.", "error");
    return;
  }

  await enterDashboard();
});

$("#refresh-button").addEventListener("click", refreshRequests);

$("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("../index.html");
});

$("#clear-filters").addEventListener("click", () => {
  for (const selector of [
    "#filter-text",
    "#filter-type",
    "#filter-state",
    "#filter-level",
    "#filter-territory",
    "#filter-cargo",
    "#filter-date"
  ]) {
    $(selector).value = "";
  }
  renderRequests();
});

for (const selector of [
  "#filter-text",
  "#filter-type",
  "#filter-state",
  "#filter-level",
  "#filter-territory",
  "#filter-cargo",
  "#filter-date"
]) {
  $(selector).addEventListener("input", renderRequests);
  $(selector).addEventListener("change", renderRequests);
}

$("#requests-list").addEventListener("click", (event) => {
  const card = event.target.closest("[data-public-id]");
  const button = event.target.closest("button[data-action]");
  if (!card || !button) return;

  const publicId = card.dataset.publicId;
  const action = button.dataset.action;

  if (action === "VER_DETALLE") {
    openDetail(publicId);
    return;
  }

  openActionDialog(action, publicId);
});

$("#detail-actions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !selectedDetail) return;
  openActionDialog(button.dataset.action, selectedDetail.solicitud_public_id);
});

$("#detail-close").addEventListener("click", () => {
  $("#detail-dialog").close();
});

$("#action-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  if (submitter?.value === "cancel") {
    actionContext = null;
    $("#action-dialog").close();
    return;
  }
  await executeAction();
});

initialize();
