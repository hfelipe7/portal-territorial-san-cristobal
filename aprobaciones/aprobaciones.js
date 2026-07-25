import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

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
let dialogContext = null;
let selectedDetail = null;
const detailCache = new Map();

const OPEN_STATES = new Set(["PENDIENTE", "EN_REVISION", "REQUIERE_CORRECCION", "REABIERTA"]);
const EXECUTABLE_STATES = new Set(["PENDIENTE", "EN_REVISION", "REABIERTA"]);

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

const blockageLabels = {
  ESTADO_NO_APROBABLE: "El estado actual no permite aprobar esta solicitud.",
  ESTADO_NO_RESOLUBLE: "El estado actual no permite resolver esta corrección.",
  VINCULACION_INCONSISTENTE: "La solicitud ya no coincide con la ficha, estructura o cargo actuales.",
  FICHA_OCUPADA: "La ficha seleccionada ya está ocupada.",
  FICHA_NO_CORRESPONDE_A_IDENTIDAD: "La ficha ya no corresponde a la misma cédula.",
  SIN_CAMBIOS: "La solicitud no contiene campos para actualizar.",
  CAMBIO_POSTERIOR_DETECTADO: "La ficha cambió después del envío. No se sobrescribirá la información posterior.",
  FICHA_NO_ENCONTRADA: "La ficha vinculada ya no existe.",
  TIPO_SOLICITUD_INVALIDO: "El tipo de solicitud no es válido.",
  SESION_REQUERIDA: "Debe iniciar sesión nuevamente.",
  NO_AUTORIZADO: "La cuenta no tiene autorización administrativa."
};

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

function isConfigured() {
  return config.supabaseUrl
    && !config.supabaseUrl.includes("PROJECT_REF")
    && config.publishableKey
    && !config.publishableKey.includes("YOUR_");
}

function formatDate(value) {
  if (!value) return "No registrada";
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function itemType(item) {
  return item?.tipo_solicitud || "NUEVO_CARGO";
}

function snapshotValue(request, path, fallback = null) {
  let current = request.identidad_snapshot;
  for (const key of path) current = current?.[key];
  return current ?? fallback;
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

function rawDisplayValue(row, baseName) {
  const maskedName = `${baseName}_enmascarado`;
  if (Object.prototype.hasOwnProperty.call(row, maskedName)) return row[maskedName];
  return row[baseName];
}

function requestedFieldNames(item) {
  const changes = item.cambios_solicitados;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  return Object.keys(changes).map((key) => fieldLabels[key] || key);
}

function typeDescription(type) {
  if (type === "ACTUALIZACION_DATOS") return "Modifica únicamente los campos de contacto, redes u observación que fueron solicitados.";
  if (type === "CORRECCION_FICHA") return "Reporta un posible error de identidad, cargo, nivel, estructura o ubicación para revisión humana.";
  return "Solicita ocupar una ficha vacante en una estructura territorial.";
}

async function verifyAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return false;

  const { data, error } = await supabase
    .from("perfiles")
    .select("id,nombre_completo,rol,activo")
    .eq("id", session.user.id)
    .single();

  if (error || !data || data.rol !== "ADMINISTRADOR" || data.activo !== true) {
    await supabase.auth.signOut();
    showMessage("La cuenta autenticada no tiene autorización administrativa activa.", "error");
    return false;
  }

  $("#session-user").textContent = data.nombre_completo || session.user.email || "Administrador";
  return true;
}

async function refreshRequests() {
  clearMessage();
  detailCache.clear();
  $("#requests-list").innerHTML = '<div class="empty">Cargando solicitudes...</div>';

  const { data, error } = await supabase
    .from("captacion_solicitudes_territoriales")
    .select(`
      public_id, cedula_enmascarada, nombre_completo, identidad_snapshot,
      tipo_solicitud, datos_actuales_snapshot, cambios_solicitados, descripcion_correccion,
      nivel_solicitado, estructura_codigo, id_registro, cargo_codigo,
      cargo_nombre_snapshot, territorio_codigo_snapshot, estructura_nombre_snapshot,
      provincia_snapshot, circunscripcion_snapshot, municipio_snapshot,
      distrito_municipal_snapshot, region_snapshot, zona_snapshot,
      codigo_recinto_snapshot, nombre_recinto_snapshot, telefono_celular,
      estado, motivo_revision, observacion_administrativa,
      registro_actualizado_id, revisado_en, aprobado_en, rechazado_en,
      cerrado_en, creado_en, actualizado_en
    `)
    .order("creado_en", { ascending: false })
    .limit(1000);

  if (error) {
    showMessage(`No fue posible cargar las solicitudes: ${error.message}`, "error");
    $("#requests-list").innerHTML = "";
    return;
  }

  requests = data || [];
  populateFilters();
  renderMetrics();
  renderRequests();
}

function populateFilters() {
  const states = [...new Set(requests.map((item) => item.estado).filter(Boolean))].sort();
  const levels = [...new Set(requests.map((item) => item.nivel_solicitado).filter(Boolean))].sort();
  const types = [...new Set(requests.map(itemType))].sort();

  $("#filter-state").innerHTML = '<option value="">Todos</option>'
    + states.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(stateLabels[value] || value)}</option>`).join("");
  $("#filter-level").innerHTML = '<option value="">Todos</option>'
    + levels.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value.replaceAll("_", " "))}</option>`).join("");
  $("#filter-type").innerHTML = '<option value="">Todos</option>'
    + types.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(typeLabels[value] || value)}</option>`).join("");
}

function renderMetrics() {
  const countState = (...states) => requests.filter((item) => states.includes(item.estado)).length;
  const countType = (type) => requests.filter((item) => itemType(item) === type).length;

  $("#metric-pending").textContent = countState("PENDIENTE", "REABIERTA", "REQUIERE_CORRECCION");
  $("#metric-review").textContent = countState("EN_REVISION");
  $("#metric-approved").textContent = countState("APROBADA");
  $("#metric-rejected").textContent = countState("RECHAZADA", "ANULADA", "DUPLICADA");
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
    const textHaystack = `${item.nombre_completo || ""} ${item.cedula_enmascarada || ""}`.toLowerCase();
    const territoryHaystack = `${item.territorio_codigo_snapshot || ""} ${item.estructura_nombre_snapshot || ""} ${item.municipio_snapshot || ""} ${item.distrito_municipal_snapshot || ""} ${item.region_snapshot || ""} ${item.zona_snapshot || ""}`.toLowerCase();
    const createdDate = item.creado_en ? item.creado_en.slice(0, 10) : "";
    return (!text || textHaystack.includes(text))
      && (!type || itemType(item) === type)
      && (!state || item.estado === state)
      && (!level || item.nivel_solicitado === level)
      && (!territory || territoryHaystack.includes(territory))
      && (!cargo || String(item.cargo_nombre_snapshot || "").toLowerCase().includes(cargo))
      && (!date || createdDate >= date);
  });
}

function competingCount(item) {
  if (itemType(item) !== "NUEVO_CARGO") return 0;
  return requests.filter((candidate) =>
    itemType(candidate) === "NUEVO_CARGO"
    && candidate.id_registro === item.id_registro
    && OPEN_STATES.has(candidate.estado)
  ).length;
}

function actionButton(label, action, className = "secondary") {
  return `<button class="${escapeHtml(className)}" type="button" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
}

function cardActions(item) {
  const actions = [actionButton("Ver detalle y comparar", "VER_DETALLE", "primary")];
  const type = itemType(item);

  if (["PENDIENTE", "REABIERTA", "REQUIERE_CORRECCION"].includes(item.estado)) {
    actions.push(actionButton("Tomar en revisión", "TOMAR_REVISION"));
  }
  if (["PENDIENTE", "EN_REVISION", "REABIERTA"].includes(item.estado)) {
    actions.push(actionButton(type === "CORRECCION_FICHA" ? "Requerir aclaración" : "Requerir corrección", "REQUERIR_CORRECCION", "warning"));
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
        <div class="field-chip-list">${fields.map((field) => `<span class="field-chip">${escapeHtml(field)}</span>`).join("") || '<span class="value-empty">Sin campos identificados</span>'}</div>
      </div>`;
  }
  if (type === "CORRECCION_FICHA") {
    return `
      <div class="request-summary">
        <strong>Descripción reportada</strong>
        <p>${escapeHtml(item.descripcion_correccion || "No se registró una descripción.")}</p>
      </div>`;
  }
  return `
    <div class="request-summary">
      <strong>Ocupación solicitada</strong>
      <p>La ficha solo se ocupará después de la aprobación administrativa.</p>
    </div>`;
}

function renderRequests() {
  const list = filteredRequests();
  $("#results-count").textContent = `${list.length} resultado${list.length === 1 ? "" : "s"}`;
  const target = $("#requests-list");

  if (list.length === 0) {
    target.innerHTML = '<div class="empty">No hay solicitudes que coincidan con los filtros.</div>';
    return;
  }

  target.innerHTML = list.map((item) => {
    const type = itemType(item);
    const historicRecinto = snapshotValue(item, ["recinto_padron", "nombre"], null);
    const currentRecinto = snapshotValue(item, ["recinto_vigente", "nombre"], item.nombre_recinto_snapshot);
    const equivalenceNotice = snapshotValue(item, ["aviso_recinto"], null);
    const demarcation = item.distrito_municipal_snapshot || item.municipio_snapshot || item.provincia_snapshot;
    const thirdDetail = type === "NUEVO_CARGO"
      ? `<div class="detail"><span>Solicitudes abiertas para la ficha</span><strong>${competingCount(item)}</strong></div>`
      : `<div class="detail"><span>Ficha vinculada</span><strong>${escapeHtml(item.id_registro || "No indicada")}</strong></div>`;

    return `
      <article class="request-card type-card-${escapeHtml(type)}" data-public-id="${escapeHtml(item.public_id)}">
        <div class="request-header">
          <div>
            <h3>${escapeHtml(item.nombre_completo)}</h3>
            <p>${escapeHtml(item.cedula_enmascarada)} · ${escapeHtml(item.telefono_celular)}</p>
          </div>
          <div class="badge-stack">
            <span class="type-badge type-${escapeHtml(type)}">${escapeHtml(typeLabels[type] || type)}</span>
            <span class="state-badge state-${escapeHtml(item.estado)}">${escapeHtml(stateLabels[item.estado] || item.estado)}</span>
          </div>
        </div>
        <div class="request-grid">
          <div class="detail"><span>Nivel</span><strong>${escapeHtml((item.nivel_solicitado || "").replaceAll("_", " ") || "No indicado")}</strong></div>
          <div class="detail"><span>Demarcación</span><strong>${escapeHtml(demarcation || "No indicada")}</strong></div>
          <div class="detail"><span>Región / zona</span><strong>${escapeHtml([item.region_snapshot && `Región ${item.region_snapshot}`, item.zona_snapshot && `Zona ${item.zona_snapshot}`].filter(Boolean).join(" · ") || "No aplica")}</strong></div>
          <div class="detail"><span>Cargo</span><strong>${escapeHtml(item.cargo_nombre_snapshot)}</strong></div>
          <div class="detail"><span>Estructura</span><strong>${escapeHtml(item.estructura_nombre_snapshot)}</strong></div>
          <div class="detail"><span>Recinto histórico</span><strong>${escapeHtml(historicRecinto || "No indicado")}</strong></div>
          <div class="detail"><span>Recinto vigente</span><strong>${escapeHtml(currentRecinto || "No confirmado")}</strong></div>
          ${thirdDetail}
          <div class="detail"><span>Recibida</span><strong>${escapeHtml(formatDate(item.creado_en))}</strong></div>
          <div class="detail"><span>Referencia</span><strong>${escapeHtml(item.public_id)}</strong></div>
        </div>
        ${requestSummary(item)}
        ${equivalenceNotice ? `<div class="request-note">${escapeHtml(equivalenceNotice)}</div>` : ""}
        ${item.motivo_revision ? `<div class="request-note"><strong>Motivo:</strong> ${escapeHtml(item.motivo_revision)}</div>` : ""}
        <div class="request-actions">${cardActions(item)}</div>
      </article>`;
  }).join("");

  target.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleActionClick(
      button.closest(".request-card").dataset.publicId,
      button.dataset.action
    ));
  });
}

function actionDescription(item, action) {
  const type = itemType(item);
  const descriptions = {
    APROBAR_NUEVO_CARGO: ["Aprobar solicitud de cargo", "Ocupará la ficha seleccionada con el nombre, la cédula y el teléfono aprobados."],
    APROBAR_ACTUALIZACION: ["Aprobar actualización de datos", "Reemplazará únicamente los campos mostrados como solicitados. Los demás datos permanecerán intactos."],
    RESOLVER_SIN_CAMBIO: ["Validar sin cambio", "Cerrará el reporte indicando que la ficha fue revisada y no requería modificación."],
    RESOLVER_CON_CAMBIO: ["Confirmar resuelta con cambio", "Cerrará el reporte únicamente si el sistema detecta que la ficha ya fue modificada en el portal territorial."],
    TOMAR_REVISION: ["Tomar en revisión", "La solicitud quedará identificada como en revisión administrativa."],
    REQUERIR_CORRECCION: [type === "CORRECCION_FICHA" ? "Requerir aclaración" : "Requerir corrección", "Indique claramente qué información o evidencia debe completar la persona."],
    RECHAZAR: ["Rechazar solicitud", "Indique el motivo del rechazo."],
    REABRIR: ["Reabrir solicitud", "La solicitud volverá a la cola activa para continuar su revisión."],
    ANULAR: ["Anular solicitud", "La solicitud quedará cerrada sin aplicar cambios a la ficha."],
    MARCAR_DUPLICADA: ["Marcar como duplicada", "Use esta opción cuando el envío repite otra solicitud existente."]
  };
  return descriptions[action] || ["Acción administrativa", "Confirme la acción seleccionada."];
}

function reasonRequired(action) {
  return [
    "REQUERIR_CORRECCION",
    "RECHAZAR",
    "ANULAR",
    "MARCAR_DUPLICADA",
    "RESOLVER_SIN_CAMBIO",
    "RESOLVER_CON_CAMBIO"
  ].includes(action);
}

function mainDetailAction(item, detail) {
  if (!EXECUTABLE_STATES.has(item.estado) || !detail?.puede_ejecutar_accion_principal) return "";
  const type = itemType(item);
  if (type === "ACTUALIZACION_DATOS") return actionButton("Aprobar únicamente estos cambios", "APROBAR_ACTUALIZACION", "primary");
  if (type === "CORRECCION_FICHA") {
    return [
      actionButton("Validar sin cambio", "RESOLVER_SIN_CAMBIO", "success"),
      actionButton("Confirmar resuelta con cambio", "RESOLVER_CON_CAMBIO", "primary")
    ].join("");
  }
  return actionButton("Aprobar nuevo cargo", "APROBAR_NUEVO_CARGO", "primary");
}

function detailActions(item, detail) {
  const actions = [mainDetailAction(item, detail)];
  if (itemType(item) === "CORRECCION_FICHA") {
    actions.push(actionButton("Abrir portal territorial", "ABRIR_PORTAL", "secondary"));
  }
  if (["PENDIENTE", "REABIERTA", "REQUIERE_CORRECCION"].includes(item.estado)) {
    actions.push(actionButton("Tomar en revisión", "TOMAR_REVISION"));
  }
  if (["PENDIENTE", "EN_REVISION", "REABIERTA"].includes(item.estado)) {
    actions.push(actionButton(itemType(item) === "CORRECCION_FICHA" ? "Requerir aclaración" : "Requerir corrección", "REQUERIR_CORRECCION", "warning"));
  }
  if (OPEN_STATES.has(item.estado)) actions.push(actionButton("Rechazar", "RECHAZAR", "danger"));
  return actions.filter(Boolean).join("");
}

function comparisonTable(type, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '<div class="empty">No se recibieron campos comparables.</div>';
  }

  const rowHtml = rows.map((row) => {
    const conflict = row.cambio_posterior === true;
    const sent = rawDisplayValue(row, "valor_al_enviar");
    const current = rawDisplayValue(row, "valor_actual");
    const requested = rawDisplayValue(row, "valor_solicitado");
    const status = conflict
      ? '<span class="change-badge change-conflict">Cambió después del envío</span>'
      : row.se_modificara
        ? '<span class="change-badge change-ok">Se aplicará al aprobar</span>'
        : '<span class="change-badge change-ok">Sin conflicto</span>';
    const fieldCell = `<td><strong>${escapeHtml(row.etiqueta || fieldLabels[row.campo] || row.campo)}</strong><br><small>${escapeHtml(row.campo || "")}</small></td>`;

    if (type === "ACTUALIZACION_DATOS") {
      return `<tr class="${conflict ? "has-conflict" : ""}">${fieldCell}<td>${displayValue(sent)}</td><td>${displayValue(current)}</td><td>${displayValue(requested)}</td><td>${status}</td></tr>`;
    }
    if (type === "CORRECCION_FICHA") {
      return `<tr class="${conflict ? "has-conflict" : ""}">${fieldCell}<td>${displayValue(sent)}</td><td>${displayValue(current)}</td><td>${status}</td></tr>`;
    }
    return `<tr class="${conflict ? "has-conflict" : ""}">${fieldCell}<td>${displayValue(current)}</td><td>${displayValue(requested)}</td><td>${status}</td></tr>`;
  }).join("");

  const headers = type === "ACTUALIZACION_DATOS"
    ? ["Campo", "Al enviar", "Actual", "Solicitado", "Control"]
    : type === "CORRECCION_FICHA"
      ? ["Campo", "Al reportar", "Actual", "Control"]
      : ["Campo", "Ficha actual", "Solicitado", "Control"];

  return `
    <div class="comparison-wrap">
      <table class="comparison-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>`;
}

function renderDetail(result, item) {
  const type = result.tipo_solicitud || itemType(item);
  const solicitud = result.solicitud || {};
  const ficha = result.ficha_actual || {};
  const blockMessage = result.bloqueo_codigo
    ? blockageLabels[result.bloqueo_codigo] || result.bloqueo_codigo
    : null;

  $("#detail-title").textContent = typeLabels[type] || type;
  $("#detail-subtitle").textContent = `${item.nombre_completo} · ${item.cedula_enmascarada} · ${stateLabels[item.estado] || item.estado}`;

  $("#detail-content").innerHTML = `
    <section class="detail-section">
      <h3>Vinculación de la solicitud</h3>
      <div class="detail-summary-grid">
        <div class="detail"><span>Persona</span><strong>${escapeHtml(solicitud.nombre_completo || item.nombre_completo)}</strong></div>
        <div class="detail"><span>Cédula</span><strong>${escapeHtml(solicitud.cedula_enmascarada || item.cedula_enmascarada)}</strong></div>
        <div class="detail"><span>Teléfono de contacto</span><strong>${escapeHtml(solicitud.telefono_contacto || item.telefono_celular || "No indicado")}</strong></div>
        <div class="detail"><span>Nivel</span><strong>${escapeHtml(solicitud.nivel || item.nivel_solicitado || "No indicado")}</strong></div>
        <div class="detail"><span>Estructura solicitada</span><strong>${escapeHtml(solicitud.estructura_nombre || item.estructura_nombre_snapshot || "No indicada")}</strong></div>
        <div class="detail"><span>Cargo</span><strong>${escapeHtml(solicitud.cargo || item.cargo_nombre_snapshot || "No indicado")}</strong></div>
        <div class="detail"><span>Ficha vinculada</span><strong>${escapeHtml(ficha.id_registro || item.id_registro || "No encontrada")}</strong></div>
        <div class="detail"><span>Estructura actual</span><strong>${escapeHtml(ficha.estructura_nombre || "No encontrada")}</strong></div>
        <div class="detail"><span>Recibida</span><strong>${escapeHtml(formatDate(solicitud.creado_en || item.creado_en))}</strong></div>
      </div>
    </section>

    ${type === "CORRECCION_FICHA" ? `
      <section class="detail-section">
        <h3>Problema reportado</h3>
        <div class="request-note">${escapeHtml(solicitud.descripcion_correccion || item.descripcion_correccion || "No se registró una descripción.")}</div>
        <p>La corrección estructural no se aplica automáticamente. Revise la ficha en el portal territorial y luego cierre el reporte con el resultado correspondiente.</p>
      </section>` : ""}

    ${blockMessage ? `
      <section class="detail-section">
        <div class="request-note error-note"><strong>Acción principal bloqueada:</strong> ${escapeHtml(blockMessage)}</div>
      </section>` : ""}

    <section class="detail-section">
      <h3>${type === "ACTUALIZACION_DATOS" ? "Campos que se reemplazarán" : "Comparación de la ficha"}</h3>
      <p>${escapeHtml(typeDescription(type))}</p>
      ${comparisonTable(type, result.comparacion_campos || [])}
    </section>
  `;

  $("#detail-actions").innerHTML = detailActions(item, result);
  $("#detail-actions").querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleActionClick(item.public_id, button.dataset.action));
  });
}

async function openDetail(publicId, forceReload = false) {
  const item = requests.find((request) => request.public_id === publicId);
  if (!item) return;

  selectedDetail = { publicId, item, result: null };
  clearDetailMessage();
  $("#detail-title").textContent = typeLabels[itemType(item)] || itemType(item);
  $("#detail-subtitle").textContent = `${item.nombre_completo} · ${item.cedula_enmascarada}`;
  $("#detail-content").innerHTML = '<div class="loading-block">Calculando vinculación y comparación de campos...</div>';
  $("#detail-actions").innerHTML = "";
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();

  let result = forceReload ? null : detailCache.get(publicId);
  if (!result) {
    const { data, error } = await supabase.rpc("sigep_captacion_detallar_solicitud", {
      p_solicitud_public_id: publicId
    });
    if (error) {
      showDetailMessage(error.message, "error");
      $("#detail-content").innerHTML = "";
      return;
    }
    result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) {
      showDetailMessage(result?.mensaje || "No fue posible calcular el detalle.", "error");
      $("#detail-content").innerHTML = "";
      return;
    }
    detailCache.set(publicId, result);
  }

  selectedDetail.result = result;
  renderDetail(result, item);
}

function openActionDialog(publicId, action) {
  const item = requests.find((request) => request.public_id === publicId);
  if (!item) return;
  const [title, description] = actionDescription(item, action);
  dialogContext = { publicId, action, item };
  $("#dialog-title").textContent = title;
  $("#dialog-description").textContent = description;
  $("#dialog-reason").value = "";
  $("#dialog-reason").required = reasonRequired(action);
  $("#dialog-warning").hidden = true;

  if (["APROBAR_ACTUALIZACION", "APROBAR_NUEVO_CARGO", "RESOLVER_CON_CAMBIO"].includes(action)) {
    $("#dialog-warning").textContent = action === "APROBAR_ACTUALIZACION"
      ? "Confirme que revisó cada fila de la comparación. Solo se reemplazarán los campos solicitados."
      : action === "RESOLVER_CON_CAMBIO"
        ? "La ficha debe haber sido corregida previamente en el portal territorial. Esta acción no modifica la ficha."
        : "La aprobación ocupará la ficha territorial seleccionada.";
    $("#dialog-warning").hidden = false;
  }

  $("#action-dialog").showModal();
}

async function handleActionClick(publicId, action) {
  if (action === "VER_DETALLE") return openDetail(publicId);
  if (action === "ABRIR_PORTAL") {
    window.open("../portal.html", "_blank", "noopener");
    showDetailMessage("Se abrió el portal territorial. Use la estructura y el cargo mostrados en este detalle para localizar la ficha.", "info");
    return;
  }
  openActionDialog(publicId, action);
}

async function executeAction(publicId, action, reason) {
  clearMessage();
  clearDetailMessage();

  let rpcName;
  let params;

  if (action === "APROBAR_NUEVO_CARGO") {
    rpcName = "sigep_captacion_aprobar_solicitud";
    params = { p_solicitud_public_id: publicId, p_observacion: reason || null };
  } else if (action === "APROBAR_ACTUALIZACION") {
    rpcName = "sigep_captacion_aprobar_actualizacion_datos";
    params = { p_solicitud_public_id: publicId, p_observacion: reason || null };
  } else if (["RESOLVER_SIN_CAMBIO", "RESOLVER_CON_CAMBIO"].includes(action)) {
    rpcName = "sigep_captacion_resolver_correccion_ficha";
    params = {
      p_solicitud_public_id: publicId,
      p_resultado: action === "RESOLVER_CON_CAMBIO" ? "RESUELTA_CON_CAMBIO" : "VALIDADA_SIN_CAMBIO",
      p_observacion: reason
    };
  } else {
    rpcName = "sigep_captacion_cambiar_estado_solicitud";
    params = {
      p_solicitud_public_id: publicId,
      p_accion: action,
      p_motivo: reason || null,
      p_observacion: reason || null
    };
  }

  const { data, error } = await supabase.rpc(rpcName, params);
  if (error) {
    const message = error.message || "La operación no pudo completarse.";
    showMessage(message, "error");
    if ($("#detail-dialog").open) showDetailMessage(message, "error");
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.ok) {
    const message = result?.mensaje || "La operación no pudo completarse.";
    showMessage(message, "error");
    if ($("#detail-dialog").open) {
      showDetailMessage(message, "error");
      await openDetail(publicId, true);
    }
    return;
  }

  showMessage(result.mensaje || "Operación completada.", "success");
  if ($("#detail-dialog").open) $("#detail-dialog").close();
  selectedDetail = null;
  await refreshRequests();
}

function bindFilters() {
  ["#filter-text", "#filter-type", "#filter-state", "#filter-level", "#filter-territory", "#filter-cargo", "#filter-date"].forEach((selector) => {
    $(selector).addEventListener("input", renderRequests);
    $(selector).addEventListener("change", renderRequests);
  });

  $("#clear-filters").addEventListener("click", () => {
    ["#filter-text", "#filter-type", "#filter-state", "#filter-level", "#filter-territory", "#filter-cargo", "#filter-date"].forEach((selector) => {
      $(selector).value = "";
    });
    renderRequests();
  });
}

async function enterDashboard() {
  if (!(await verifyAdmin())) return;
  $("#login-panel").hidden = true;
  $("#dashboard").hidden = false;
  $("#logout-button").hidden = false;
  $("#refresh-button").hidden = false;
  await refreshRequests();
}

async function initialize() {
  if (!isConfigured()) {
    showMessage("Complete aprobaciones/config.js con la URL de Supabase y la clave publicable.", "error");
    return;
  }

  supabase = createClient(
    config.supabaseUrl,
    config.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "portal-territorial-sc-auth"
      }
    }
  );

  bindFilters();

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return showMessage(error.message, "error");
    await enterDashboard();
  });

  $("#logout-button").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
  });

  $("#refresh-button").addEventListener("click", refreshRequests);
  $("#detail-close").addEventListener("click", () => $("#detail-dialog").close());
  $("#detail-dialog").addEventListener("close", () => {
    selectedDetail = null;
    clearDetailMessage();
  });

  $("#action-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.submitter?.value !== "confirm") return $("#action-dialog").close();
    const reason = $("#dialog-reason").value.trim();
    if ($("#dialog-reason").required && reason.length < 10) {
      $("#dialog-reason").setCustomValidity("Escriba una explicación de al menos 10 caracteres.");
      $("#dialog-reason").reportValidity();
      $("#dialog-reason").setCustomValidity("");
      return;
    }
    const context = dialogContext;
    $("#action-dialog").close();
    if (context) await executeAction(context.publicId, context.action, reason);
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) await enterDashboard();
}

initialize();
