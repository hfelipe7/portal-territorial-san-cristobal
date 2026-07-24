import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.SIGEP_ADMIN_CONFIG || {};
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

let supabase;
let requests = [];
let dialogContext = null;

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

function showMessage(message, type = "info") {
  const box = $("#admin-message");
  box.textContent = message;
  box.className = `message ${type}`;
  box.hidden = false;
}

function clearMessage() {
  $("#admin-message").hidden = true;
}

function isConfigured() {
  return config.supabaseUrl && !config.supabaseUrl.includes("PROJECT_REF") && config.publishableKey && !config.publishableKey.includes("YOUR_");
}

function formatDate(value) {
  if (!value) return "No registrada";
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function snapshotValue(request, path, fallback = null) {
  let current = request.identidad_snapshot;
  for (const key of path) current = current?.[key];
  return current ?? fallback;
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
  $("#requests-list").innerHTML = '<div class="empty">Cargando solicitudes...</div>';

  const { data, error } = await supabase
    .from("captacion_solicitudes_territoriales")
    .select(`
      public_id, cedula_enmascarada, nombre_completo, identidad_snapshot,
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
  $("#filter-state").innerHTML = '<option value="">Todos</option>' + states.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(stateLabels[value] || value)}</option>`).join("");
  $("#filter-level").innerHTML = '<option value="">Todos</option>' + levels.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value.replaceAll("_", " "))}</option>`).join("");
}

function renderMetrics() {
  const count = (...states) => requests.filter((item) => states.includes(item.estado)).length;
  $("#metric-pending").textContent = count("PENDIENTE", "REABIERTA", "REQUIERE_CORRECCION");
  $("#metric-review").textContent = count("EN_REVISION");
  $("#metric-approved").textContent = count("APROBADA");
  $("#metric-rejected").textContent = count("RECHAZADA", "ANULADA", "DUPLICADA");
  $("#metric-closed").textContent = count("CERRADA_POR_OCUPACION");
}

function filteredRequests() {
  const text = $("#filter-text").value.trim().toLowerCase();
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
      && (!state || item.estado === state)
      && (!level || item.nivel_solicitado === level)
      && (!territory || territoryHaystack.includes(territory))
      && (!cargo || String(item.cargo_nombre_snapshot || "").toLowerCase().includes(cargo))
      && (!date || createdDate >= date);
  });
}

function competingCount(item) {
  return requests.filter((candidate) => candidate.id_registro === item.id_registro && ["PENDIENTE", "EN_REVISION", "REQUIERE_CORRECCION", "REABIERTA"].includes(candidate.estado)).length;
}

function actionButton(label, action, className = "secondary") {
  return `<button class="${className}" type="button" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
}

function allowedActions(item) {
  const actions = [];
  if (["PENDIENTE", "REABIERTA", "REQUIERE_CORRECCION"].includes(item.estado)) actions.push(actionButton("Tomar en revisión", "TOMAR_REVISION"));
  if (["PENDIENTE", "EN_REVISION", "REABIERTA"].includes(item.estado)) actions.push(actionButton("Requerir corrección", "REQUERIR_CORRECCION", "warning"));
  if (["PENDIENTE", "EN_REVISION", "REQUIERE_CORRECCION", "REABIERTA"].includes(item.estado)) {
    actions.push(actionButton("Aprobar", "APROBAR", "primary"));
    actions.push(actionButton("Rechazar", "RECHAZAR", "danger"));
    actions.push(actionButton("Marcar duplicada", "MARCAR_DUPLICADA"));
  }
  if (["RECHAZADA", "REQUIERE_CORRECCION", "DUPLICADA", "ANULADA"].includes(item.estado)) actions.push(actionButton("Reabrir", "REABRIR"));
  if (!["APROBADA", "CERRADA_POR_OCUPACION", "ANULADA"].includes(item.estado)) actions.push(actionButton("Anular", "ANULAR", "danger"));
  return actions.join("");
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
    const historicRecinto = snapshotValue(item, ["recinto_padron", "nombre"], null);
    const currentRecinto = snapshotValue(item, ["recinto_vigente", "nombre"], item.nombre_recinto_snapshot);
    const equivalenceNotice = snapshotValue(item, ["aviso_recinto"], null);
    const demarcation = item.distrito_municipal_snapshot || item.municipio_snapshot || item.provincia_snapshot;
    return `
      <article class="request-card" data-public-id="${escapeHtml(item.public_id)}">
        <div class="request-header">
          <div>
            <h3>${escapeHtml(item.nombre_completo)}</h3>
            <p>${escapeHtml(item.cedula_enmascarada)} · ${escapeHtml(item.telefono_celular)}</p>
          </div>
          <span class="state-badge state-${escapeHtml(item.estado)}">${escapeHtml(stateLabels[item.estado] || item.estado)}</span>
        </div>
        <div class="request-grid">
          <div class="detail"><span>Nivel</span><strong>${escapeHtml(item.nivel_solicitado.replaceAll("_", " "))}</strong></div>
          <div class="detail"><span>Demarcación</span><strong>${escapeHtml(demarcation || "No indicada")}</strong></div>
          <div class="detail"><span>Región / zona</span><strong>${escapeHtml([item.region_snapshot && `Región ${item.region_snapshot}`, item.zona_snapshot && `Zona ${item.zona_snapshot}`].filter(Boolean).join(" · ") || "No aplica")}</strong></div>
          <div class="detail"><span>Cargo</span><strong>${escapeHtml(item.cargo_nombre_snapshot)}</strong></div>
          <div class="detail"><span>Estructura</span><strong>${escapeHtml(item.estructura_nombre_snapshot)}</strong></div>
          <div class="detail"><span>Recinto histórico</span><strong>${escapeHtml(historicRecinto || "No indicado")}</strong></div>
          <div class="detail"><span>Recinto vigente</span><strong>${escapeHtml(currentRecinto || "No confirmado")}</strong></div>
          <div class="detail"><span>Solicitudes abiertas para la ficha</span><strong>${competingCount(item)}</strong></div>
          <div class="detail"><span>Recibida</span><strong>${escapeHtml(formatDate(item.creado_en))}</strong></div>
          <div class="detail"><span>Referencia</span><strong>${escapeHtml(item.public_id)}</strong></div>
        </div>
        ${equivalenceNotice ? `<div class="request-note">${escapeHtml(equivalenceNotice)}</div>` : ""}
        ${item.motivo_revision ? `<div class="request-note"><strong>Motivo:</strong> ${escapeHtml(item.motivo_revision)}</div>` : ""}
        <div class="request-actions">${allowedActions(item)}</div>
      </article>`;
  }).join("");

  target.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => openActionDialog(button.closest(".request-card").dataset.publicId, button.dataset.action));
  });
}

function actionDescription(action) {
  const descriptions = {
    APROBAR: ["Aprobar solicitud", "Actualizará la ficha existente y cerrará las solicitudes competidoras."],
    TOMAR_REVISION: ["Tomar en revisión", "La solicitud quedará asignada a revisión administrativa."],
    REQUERIR_CORRECCION: ["Requerir corrección", "Indique claramente qué información debe corregirse."],
    RECHAZAR: ["Rechazar solicitud", "Indique el motivo del rechazo."],
    REABRIR: ["Reabrir solicitud", "La ficha debe continuar disponible."],
    ANULAR: ["Anular solicitud", "La solicitud quedará cerrada sin ocupar la ficha."],
    MARCAR_DUPLICADA: ["Marcar como duplicada", "Use esta opción cuando el envío repite otra solicitud."]
  };
  return descriptions[action] || ["Acción administrativa", "Confirme la acción seleccionada."];
}

function openActionDialog(publicId, action) {
  const [title, description] = actionDescription(action);
  dialogContext = { publicId, action };
  $("#dialog-title").textContent = title;
  $("#dialog-description").textContent = description;
  $("#dialog-reason").value = "";
  $("#dialog-reason").required = ["REQUERIR_CORRECCION", "RECHAZAR", "ANULAR", "MARCAR_DUPLICADA"].includes(action);
  $("#action-dialog").showModal();
}

async function executeAction(publicId, action, reason) {
  clearMessage();
  const rpcName = action === "APROBAR" ? "sigep_captacion_aprobar_solicitud" : "sigep_captacion_cambiar_estado_solicitud";
  const params = action === "APROBAR"
    ? { p_solicitud_public_id: publicId, p_observacion: reason || null }
    : { p_solicitud_public_id: publicId, p_accion: action, p_motivo: reason || null, p_observacion: reason || null };

  const { data, error } = await supabase.rpc(rpcName, params);
  if (error) {
    showMessage(error.message, "error");
    return;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.ok) {
    showMessage(result?.mensaje || "La operación no pudo completarse.", "error");
    return;
  }
  showMessage(result.mensaje || "Operación completada.", "success");
  await refreshRequests();
}

function bindFilters() {
  ["#filter-text", "#filter-state", "#filter-level", "#filter-territory", "#filter-cargo", "#filter-date"].forEach((selector) => {
    $(selector).addEventListener("input", renderRequests);
    $(selector).addEventListener("change", renderRequests);
  });
  $("#clear-filters").addEventListener("click", () => {
    ["#filter-text", "#filter-state", "#filter-level", "#filter-territory", "#filter-cargo", "#filter-date"].forEach((selector) => { $(selector).value = ""; });
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
    showMessage("Complete admin/config.js con la URL de Supabase y la clave publicable.", "error");
    return;
  }
  supabase = createClient(config.supabaseUrl, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
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

  $("#action-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.submitter?.value !== "confirm") return $("#action-dialog").close();
    const reason = $("#dialog-reason").value.trim();
    if ($("#dialog-reason").required && !reason) return;
    const context = dialogContext;
    $("#action-dialog").close();
    if (context) await executeAction(context.publicId, context.action, reason);
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) await enterDashboard();
}

initialize();
