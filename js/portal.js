// SIGEP PRM SC — PORTAL BUILD: ZONAS45_SELECTOR_OFICIAL_V1_9
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

window.__SIGEP_PORTAL_BUILD__ = "ZONAS45_SELECTOR_OFICIAL_V1_9";
console.info("SIGEP Portal build:", window.__SIGEP_PORTAL_BUILD__);

// Clasificación oficial zonal: aplica a todas las estructuras de nivel ZONA.
// La ficha física y los datos personales permanecen intactos; solo cambia la clasificación oficial.
const ZONAL_SELECTOR_VIEW =
  "v_sigep_zona_fichas_clasificadas_v1";

const ZONAL_SELECTOR_RPC =
  "sigep_zona_asignar_cargo_v1";

const ZONAL_SELECTOR_CATALOG_TABLE =
  "sigep_zona_cargos_v1";

let zonalSelectorCatalog = [];

const EDITABLE_FIELDS = [
  ["cedula", "Cédula", "cedula"],
  ["nombre_completo", "Nombre completo", "readonly"],
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

const PROVINCIAL_SECTIONS = [
  { code: "A_COMITE_PROVINCIAL", letter: "A", title: "Comité Provincial", subtitle: "Dirección del Comité Provincial", reference: "Artículos 103, 104 y 105" },
  { code: "B_MIEMBROS_EX_OFICIO", letter: "B", title: "Miembros Provinciales Ex Oficio", subtitle: "Integración automática desde municipios y distritos municipales", reference: "Artículo 104" },
  { code: "C_CLED_PROVINCIAL", letter: "C", title: "Comisión Local de Ética y Disciplina Provincial", subtitle: "Comisión Local de Ética y Disciplina", reference: "Artículo 60" },
  { code: "D_CARGOS_FUNCIONALES", letter: "D", title: "Cargos Funcionales Provinciales", subtitle: "Actas, correspondencia y fiscalía disciplinaria", reference: "Artículos 61 y 176" },
  { code: "E_COMISION_EJECUTIVA", letter: "E", title: "Comisión Ejecutiva Provincial", subtitle: "Comisión Ejecutiva del organismo territorial", reference: "Artículos 95, 96 y 97" },
  { code: "F_REPRESENTACION_SENATORIAL", letter: "F", title: "Representación Electiva Provincial", subtitle: "Senador, Diputados, Alcaldes Municipales y Directores de Distrito Municipal", reference: "Representación electiva provincial" },
  { code: "G_MIEMBRO_NO_ESTATUTARIO", letter: "G", title: "Miembros — No Estatutaria", subtitle: "Preservación de fichas históricas y cargos no clasificados", reference: "Sección de preservación de datos" }
];

const PROVINCIAL_SECTION_BY_CODE = new Map(
  PROVINCIAL_SECTIONS.map((section, index) => [section.code, { ...section, order: index + 1 }])
);

const PROVINCIAL_CONFORMATIONS = [
  { value: "ESTRUCTURA_COMPLETA", label: "Estructura provincial completa" },
  { value: "COMITE_PROVINCIAL", label: "Comité Provincial — artículo 104" },
  { value: "COMISION_EJECUTIVA", label: "Comisión Ejecutiva Provincial — artículos 95 y 96" },
  { value: "CLED_PROVINCIAL", label: "CLED Provincial — artículo 60" },
  { value: "REPRESENTACION_ELECTIVA", label: "Representación Electiva Provincial" },
  { value: "NO_ESTATUTARIOS", label: "Miembros no estatutarios" }
];

const PROVINCIAL_EDITABLE_FIELDS = [
  ["comentario", "Comentario", "textarea"]
];

const PROVINCIAL_ELECTIVE_DEPUTY_FIELDS = [
  ["comentario", "Comentario", "textarea"],
  ["periodo_electoral", "Periodo electoral", "text"]
];

const PROVINCIAL_ELECTIVE_GROUPS = [
  { code: "SENADOR", title: "Senador", subtitle: "1 posición", expected: 1 },
  { code: "DIPUTADOS", title: "Diputados(as)", subtitle: "10 posiciones · Circunscripción 1: 4 · Circunscripción 2: 3 · Circunscripción 3: 3", expected: 10 },
  { code: "ALCALDES", title: "Alcaldes Municipales", subtitle: "8 posiciones", expected: 8 },
  { code: "DIRECTORES", title: "Directores(as) de Distrito Municipal", subtitle: "9 posiciones", expected: 9 }
];

const CIRCUNSCRIPTION_SECTIONS = [
  { code: "A_DIRECCION_CIRCUNSCRIPCION", letter: "A", title: "Dirección de la Circunscripción", subtitle: "Presidente(a) y Secretario(a) General", reference: "Artículo 106", order: 1 },
  { code: "B_MIEMBROS_EX_OFICIO", letter: "B", title: "Miembros Ex Oficio", subtitle: "Presidentes municipales y distritales correspondientes", reference: "Artículo 106", order: 2 },
  { code: "C_COMISION_OPERATIVA_NO_ESTATUTARIA", letter: "C", title: "Comisión Operativa — No Estatutaria", subtitle: "Estructura institucional de apoyo operativo", reference: "Configuración institucional SIGEP", order: 3 },
  { code: "D_AUTORIDADES_ELECTAS", letter: "D", title: "Autoridades Electas", subtitle: "Diputados, alcaldes, directores distritales, regidores y vocales", reference: "Representación electiva", order: 4 },
  { code: "E_MIEMBROS_NO_ESTATUTARIOS", letter: "E", title: "Miembros — No Estatutaria", subtitle: "Preservación de fichas actuales no clasificadas", reference: "Sección de preservación de datos", order: 5 }
];

const CIRCUNSCRIPTION_SECTION_BY_CODE = new Map(
  CIRCUNSCRIPTION_SECTIONS.map((section) => [section.code, section])
);

const CIRCUNSCRIPTION_SUBSECTIONS = [
  { code: "D1_DIPUTADOS_CIRCUNSCRIPCION", label: "D.1", title: "Diputados(as) de la Circunscripción", subtitle: "Fichas adicionales propias de la circunscripción", order: 1 },
  { code: "D2_ALCALDES_DIRECTORES", label: "D.2", title: "Alcaldes Municipales y Directores(as) de Distrito Municipal del Partido", subtitle: "Relaciones automáticas desde municipios y distritos municipales", order: 2 },
  { code: "D3_REGIDORES_VOCALES", label: "D.3", title: "Regidores(as) y Vocales del Partido", subtitle: "Relaciones automáticas futuras con identificación del rol de bloque", order: 3 }
];

const CIRCUNSCRIPTION_SUBSECTION_BY_CODE = new Map(
  CIRCUNSCRIPTION_SUBSECTIONS.map((subsection) => [subsection.code, subsection])
);

const CIRCUNSCRIPTION_CONFORMATIONS = [
  { value: "ESTRUCTURA_COMPLETA", label: "Estructura de Circunscripción completa" },
  { value: "COMITE_ART_106", label: "Comité de Circunscripción — artículo 106" },
  { value: "DIRECCION_ART_106", label: "Dirección de Circunscripción — artículo 106" },
  { value: "COMISION_OPERATIVA", label: "Comisión Operativa completa — no estatutaria" },
  { value: "AUTORIDADES_ELECTAS", label: "Autoridades Electas" },
  { value: "DIPUTADOS", label: "Diputados(as) de la Circunscripción" },
  { value: "ALCALDES_DIRECTORES", label: "Alcaldes y Directores Distritales del Partido" },
  { value: "REGIDORES_VOCALES", label: "Regidores(as) y Vocales del Partido" },
  { value: "EX_OFICIO", label: "Miembros Ex Oficio — artículo 106" },
  { value: "MIEMBROS_NO_ESTATUTARIOS", label: "Miembros no estatutarios" }
];

const CIRCUNSCRIPTION_EDITABLE_FIELDS = [
  ["comentario", "Comentario", "textarea"]
];

const CIRCUNSCRIPTION_DEPUTY_FIELDS = [
  ["periodo_electoral", "Periodo electoral", "text"]
];

const CIRCUNSCRIPTION_DEPUTY_CAPACITY = new Map([[1, 4], [2, 3], [3, 3]]);

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
  provincialFilters: {
    sections: new Set(PROVINCIAL_SECTIONS.map((section) => section.code)),
    conformation: "ESTRUCTURA_COMPLETA"
  },
  provincialPrint: {
    active: false,
    sections: new Set(PROVINCIAL_SECTIONS.map((section) => section.code)),
    conformation: "ESTRUCTURA_COMPLETA",
    identifySections: true
  },
  circunscriptionFilters: {
    sections: new Set(CIRCUNSCRIPTION_SECTIONS.map((section) => section.code)),
    conformation: "ESTRUCTURA_COMPLETA"
  },
  circunscriptionPrint: {
    active: false,
    sections: new Set(CIRCUNSCRIPTION_SECTIONS.map((section) => section.code)),
    conformation: "ESTRUCTURA_COMPLETA",
    identifySections: true
  },
  circunscriptionBackend: {
    version: null,
    diagnostic: null
  },
  users: [],
  allAssignments: [],
  allRegionalAssignments: [],
  allPrincipals: [],
  assignableTerritories: [],
  regionalStructures: [],
  regionalAssignments: [],
  approvalContext: null,
  canApprove: false,
  selectedPermissionType: "ACUMULATIVO",
  selectedUserId: null,
  passwordUserId: null,
  auditRows: [],
  identityLookup: {
    sequence: 0,
    originalCedula: "",
    originalName: "",
    verifiedCedula: "",
    verifiedName: "",
    userChangedCedula: false,
    timer: null
  }
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
  approvalsTab: document.querySelector("#approvals-tab"),
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

function installProvincialInterface() {
  const toolbar = document.querySelector("#structures-panel .content-toolbar");
  if (toolbar && !document.querySelector("#provincial-controls")) {
    toolbar.insertAdjacentHTML("afterend", `
      <section id="provincial-controls" class="provincial-controls no-print" hidden>
        <div class="provincial-controls-head">
          <div>
            <span class="provincial-kicker">Organización provincial</span>
            <h3>Filtrar secciones y conformación</h3>
            <p>La sección indica dónde pertenece la ficha; la conformación permite ver el Comité, la Comisión Ejecutiva, la CLED o la estructura completa.</p>
          </div>
          <div class="provincial-filter-actions">
            <button id="provincial-select-all" class="button ghost small" type="button">Todas</button>
            <button id="provincial-select-none" class="button ghost small" type="button">Ninguna</button>
          </div>
        </div>
        <div id="provincial-section-filters" class="provincial-section-filters">
          ${PROVINCIAL_SECTIONS.map((section) => `
            <label class="provincial-check">
              <input type="checkbox" value="${section.code}" checked>
              <span><strong>${section.letter}. ${section.title}</strong><small>${section.subtitle}</small></span>
            </label>
          `).join("")}
        </div>
        <label class="field compact provincial-conformation-field">
          <span>Conformación</span>
          <select id="provincial-conformation-filter">
            ${PROVINCIAL_CONFORMATIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
          </select>
        </label>
      </section>
    `);
  }

  if (!document.querySelector("#provincial-print-modal")) {
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="provincial-print-modal" class="provincial-print-modal">
        <header class="modal-header">
          <div>
            <p class="eyebrow blue">Configurar impresión</p>
            <h2>Seleccionar secciones provinciales</h2>
            <p>Puede imprimir todas las secciones o únicamente las que marque.</p>
          </div>
          <button id="close-provincial-print" class="close-button" type="button" aria-label="Cerrar">×</button>
        </header>
        <div class="modal-content">
          <div class="provincial-print-actions">
            <button id="print-select-all" class="button ghost small" type="button">Seleccionar todas</button>
            <button id="print-select-none" class="button ghost small" type="button">Desmarcar todas</button>
          </div>
          <div id="provincial-print-sections" class="provincial-section-filters print-choices">
            ${PROVINCIAL_SECTIONS.map((section) => `
              <label class="provincial-check">
                <input type="checkbox" value="${section.code}" checked>
                <span><strong>${section.letter}. ${section.title}</strong><small>${section.reference}</small></span>
              </label>
            `).join("")}
          </div>
          <label class="field compact">
            <span>Conformación a imprimir</span>
            <select id="provincial-print-conformation">
              ${PROVINCIAL_CONFORMATIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
            </select>
          </label>
          <label class="provincial-toggle">
            <input id="provincial-print-identify" type="checkbox" checked>
            <span>Identificar las secciones con título, subtítulo y artículo</span>
          </label>
          <div id="provincial-print-count" class="message info">0 fichas seleccionadas.</div>
        </div>
        <footer class="modal-actions">
          <button id="cancel-provincial-print" class="button ghost" type="button">Cancelar</button>
          <button id="confirm-provincial-print" class="button" type="button">Imprimir selección</button>
        </footer>
      </dialog>
    `);
  }

  Object.assign(els, {
    provincialControls: document.querySelector("#provincial-controls"),
    provincialSectionFilters: document.querySelector("#provincial-section-filters"),
    provincialConformationFilter: document.querySelector("#provincial-conformation-filter"),
    provincialSelectAll: document.querySelector("#provincial-select-all"),
    provincialSelectNone: document.querySelector("#provincial-select-none"),
    provincialPrintModal: document.querySelector("#provincial-print-modal"),
    provincialPrintSections: document.querySelector("#provincial-print-sections"),
    provincialPrintConformation: document.querySelector("#provincial-print-conformation"),
    provincialPrintIdentify: document.querySelector("#provincial-print-identify"),
    provincialPrintCount: document.querySelector("#provincial-print-count"),
    printSelectAll: document.querySelector("#print-select-all"),
    printSelectNone: document.querySelector("#print-select-none"),
    confirmProvincialPrint: document.querySelector("#confirm-provincial-print"),
    closeProvincialPrint: document.querySelector("#close-provincial-print"),
    cancelProvincialPrint: document.querySelector("#cancel-provincial-print")
  });
}

function installCircunscriptionInterface() {
  if (!document.querySelector("#circunscription-inline-styles")) {
    const style = document.createElement("style");
    style.id = "circunscription-inline-styles";
    style.textContent = `
      .circ-subsection-heading{grid-column:1/-1;display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:.9rem 1rem;border:1px solid #d9e4f2;border-radius:14px;background:#f8fbff;margin-top:.35rem}
      .circ-subsection-heading h4{margin:.1rem 0 .25rem;font-size:1rem}.circ-subsection-heading p{margin:0;color:#5d6d82;font-size:.86rem}
      .circ-subsection-label{display:inline-block;font-size:.72rem;font-weight:800;letter-spacing:.08em;color:#0b5cab;text-transform:uppercase}
      .circ-admin-slots{margin-top:1rem;padding-top:1rem;border-top:1px solid #dfe7f1}.circ-admin-slots[hidden]{display:none}
      .circ-slot-actions{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:.7rem}.circ-slot-actions .button{min-width:145px}
      .circ-relation-origin{display:block;margin:.35rem 0 .15rem;color:#5d6d82;font-size:.82rem}
      .circ-role-badge,.circ-authority-badge{display:inline-flex;align-items:center;width:max-content;border-radius:999px;padding:.25rem .55rem;font-size:.72rem;font-weight:800;margin:.2rem 0 .45rem}
      .circ-role-badge{background:#f2eaff;color:#6437a5}.circ-authority-badge{background:#e9f6ef;color:#137345}
      .circ-placeholder{grid-column:1/-1}.circ-automatic-card{border-style:dashed}.circ-controls-note{margin:.35rem 0 0;color:#5d6d82;font-size:.86rem}
    `;
    document.head.appendChild(style);
  }

  const toolbar = document.querySelector("#structures-panel .content-toolbar");
  if (toolbar && !document.querySelector("#circunscription-controls")) {
    toolbar.insertAdjacentHTML("afterend", `
      <section id="circunscription-controls" class="provincial-controls no-print" hidden>
        <div class="provincial-controls-head">
          <div>
            <span class="provincial-kicker">Organización de circunscripción</span>
            <h3>Filtrar secciones y conformación</h3>
            <p>La dirección y el comité del artículo 106 se distinguen de la comisión operativa y las autoridades electas.</p>
          </div>
          <div class="provincial-filter-actions">
            <button id="circunscription-select-all" class="button ghost small" type="button">Todas</button>
            <button id="circunscription-select-none" class="button ghost small" type="button">Ninguna</button>
          </div>
        </div>
        <div id="circunscription-section-filters" class="provincial-section-filters">
          ${CIRCUNSCRIPTION_SECTIONS.map((section) => `
            <label class="provincial-check">
              <input type="checkbox" value="${section.code}" checked>
              <span><strong>${section.letter}. ${section.title}</strong><small>${section.subtitle}</small></span>
            </label>
          `).join("")}
        </div>
        <label class="field compact provincial-conformation-field">
          <span>Conformación</span>
          <select id="circunscription-conformation-filter">
            ${CIRCUNSCRIPTION_CONFORMATIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
          </select>
        </label>
        <div id="circunscription-deputy-admin" class="circ-admin-slots" hidden>
          <strong>Administrar cupos de diputados</strong>
          <p class="circ-controls-note">Los cupos son técnicos y solo se muestran cuando el administrador los habilita. Un cupo ocupado no puede retirarse.</p>
          <div id="circunscription-deputy-slots" class="circ-slot-actions"></div>
        </div>
      </section>
    `);
  }

  if (!document.querySelector("#circunscription-print-modal")) {
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="circunscription-print-modal" class="provincial-print-modal">
        <header class="modal-header">
          <div>
            <p class="eyebrow blue">Configurar impresión</p>
            <h2>Seleccionar secciones de la circunscripción</h2>
            <p>Puede imprimir todas las secciones, una conformación o únicamente las que marque.</p>
          </div>
          <button id="close-circunscription-print" class="close-button" type="button" aria-label="Cerrar">×</button>
        </header>
        <div class="modal-content">
          <div class="provincial-print-actions">
            <button id="circ-print-select-all" class="button ghost small" type="button">Seleccionar todas</button>
            <button id="circ-print-select-none" class="button ghost small" type="button">Desmarcar todas</button>
          </div>
          <div id="circunscription-print-sections" class="provincial-section-filters print-choices">
            ${CIRCUNSCRIPTION_SECTIONS.map((section) => `
              <label class="provincial-check">
                <input type="checkbox" value="${section.code}" checked>
                <span><strong>${section.letter}. ${section.title}</strong><small>${section.reference}</small></span>
              </label>
            `).join("")}
          </div>
          <label class="field compact">
            <span>Conformación a imprimir</span>
            <select id="circunscription-print-conformation">
              ${CIRCUNSCRIPTION_CONFORMATIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
            </select>
          </label>
          <label class="provincial-toggle">
            <input id="circunscription-print-identify" type="checkbox" checked>
            <span>Identificar secciones y subsecciones con sus fundamentos</span>
          </label>
          <div id="circunscription-print-count" class="message info">0 fichas seleccionadas.</div>
        </div>
        <footer class="modal-actions">
          <button id="cancel-circunscription-print" class="button ghost" type="button">Cancelar</button>
          <button id="confirm-circunscription-print" class="button" type="button">Imprimir selección</button>
        </footer>
      </dialog>
    `);
  }

  Object.assign(els, {
    circunscriptionControls: document.querySelector("#circunscription-controls"),
    circunscriptionSectionFilters: document.querySelector("#circunscription-section-filters"),
    circunscriptionConformationFilter: document.querySelector("#circunscription-conformation-filter"),
    circunscriptionSelectAll: document.querySelector("#circunscription-select-all"),
    circunscriptionSelectNone: document.querySelector("#circunscription-select-none"),
    circunscriptionDeputyAdmin: document.querySelector("#circunscription-deputy-admin"),
    circunscriptionDeputySlots: document.querySelector("#circunscription-deputy-slots"),
    circunscriptionPrintModal: document.querySelector("#circunscription-print-modal"),
    circunscriptionPrintSections: document.querySelector("#circunscription-print-sections"),
    circunscriptionPrintConformation: document.querySelector("#circunscription-print-conformation"),
    circunscriptionPrintIdentify: document.querySelector("#circunscription-print-identify"),
    circunscriptionPrintCount: document.querySelector("#circunscription-print-count"),
    circPrintSelectAll: document.querySelector("#circ-print-select-all"),
    circPrintSelectNone: document.querySelector("#circ-print-select-none"),
    confirmCircunscriptionPrint: document.querySelector("#confirm-circunscription-print"),
    closeCircunscriptionPrint: document.querySelector("#close-circunscription-print"),
    cancelCircunscriptionPrint: document.querySelector("#cancel-circunscription-print")
  });

  if (els.assignmentType && !els.assignmentType.querySelector('option[value="CIRCUNSCRIPCION"]')) {
    const option = document.createElement("option");
    option.value = "CIRCUNSCRIPCION";
    option.textContent = "CIRCUNSCRIPCIÓN";
    const regionalOption = els.assignmentType.querySelector('option[value="REGIONAL"]');
    els.assignmentType.insertBefore(option, regionalOption || null);
  }
}


function installAuthorizationInterface() {
  if (els.usersTab) {
    els.usersTab.textContent = "Usuarios, autorizaciones y aprobaciones";
  }

  const usersPanelTitle = document.querySelector("#users-panel .section-title h2");
  const usersPanelDescription = document.querySelector("#users-panel .section-title .muted");
  if (usersPanelTitle) usersPanelTitle.textContent = "Usuarios, autorizaciones y aprobaciones";
  if (usersPanelDescription) {
    usersPanelDescription.textContent =
      "Administre el alcance principal, las autorizaciones adicionales y la capacidad de aprobar solicitudes por territorio o región.";
  }

  const createCardTitle = document.querySelector("#create-user-form")?.closest(".form-card")?.querySelector("h3");
  if (createCardTitle) createCardTitle.textContent = "Crear usuario y alcance principal";

  const checkRow = document.querySelector("#create-user-form .check-row");
  if (checkRow && !checkRow.querySelector('input[name="puede_aprobar"]')) {
    checkRow.insertAdjacentHTML(
      "beforeend",
      '<label><input name="puede_aprobar" type="checkbox"> Puede aprobar solicitudes</label>'
    );
  }

  if (els.permissionsDescription) {
    els.permissionsDescription.textContent =
      "Seleccione el alcance principal y configure VER, EDITAR y APROBAR para cada autorización. Las adicionales se mostrarán en rojo.";
  }

  if (els.savePermissions) {
    els.savePermissions.textContent = "Guardar autorizaciones";
  }

  const permissionHead = document.querySelector("#permissions-modal .permissions-table thead tr");
  if (permissionHead) {
    permissionHead.innerHTML = `
      <th>Territorio o región</th>
      <th>Principal</th>
      <th>Ver</th>
      <th>Editar</th>
      <th>Aprobar</th>
    `;
  }
}

function installZonalSelectorStyles() {
  if (document.querySelector("#zonal-selector-styles")) return;

  const style = document.createElement("style");
  style.id = "zonal-selector-styles";
  style.textContent = `
    .zonal-selector-card{position:relative}
    .zonal-selector-wrap{margin:.75rem 0 .7rem;padding:.7rem;border:1px solid #dbe7f2;border-radius:12px;background:#f8fbff}
    .zonal-selector-label{display:block;margin:0 0 .35rem;color:#0b4f8a;font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
    .zonal-selector-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;align-items:center}
    .zonal-selector-select{width:100%;min-width:0;padding:.55rem .65rem;border:1px solid #cddbeb;border-radius:9px;background:#fff;font-size:.82rem}
    .zonal-selector-select:disabled{background:#eef2f6;color:#647180}
    .zonal-selector-assign{white-space:nowrap}
    .zonal-selector-note{display:block;margin-top:.35rem;color:#65717c;font-size:.72rem;line-height:1.35}
    @media (max-width:700px){
      .zonal-selector-row{grid-template-columns:1fr}
      .zonal-selector-assign{width:100%}
    }
  `;
  document.head.appendChild(style);
}

function normalizeRpcPayload(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function authorizationKey(type, territoryCode, region = "") {
  return `${String(type || "").toUpperCase()}|${territoryCode || ""}|${region || ""}`;
}

function principalForUser(userId) {
  return state.allPrincipals.find(
    (item) => item.usuario_id === userId && item.activo !== false
  ) || null;
}

function userAuthorizationRows(userId) {
  const territorial = state.allAssignments
    .filter((item) => item.usuario_id === userId && item.activo !== false && item.puede_ver)
    .map((item) => ({
      tipo_alcance: "TERRITORIO",
      territorio_codigo: item.territorio_codigo,
      region: null,
      puede_ver: item.puede_ver === true,
      puede_editar: item.puede_editar === true,
      puede_aprobar: item.puede_aprobar === true
    }));

  const regional = state.allRegionalAssignments
    .filter((item) => item.usuario_id === userId && item.activo !== false && item.puede_ver)
    .map((item) => ({
      tipo_alcance: "REGION",
      territorio_codigo: item.territorio_codigo,
      region: item.region,
      puede_ver: item.puede_ver === true,
      puede_editar: item.puede_editar === true,
      puede_aprobar: item.puede_aprobar === true
    }));

  return [...territorial, ...regional];
}

function capabilityLabel(item) {
  const labels = ["ver"];
  if (item.puede_editar) labels.push("editar");
  if (item.puede_aprobar) labels.push("aprobar");
  return labels.join(" · ");
}

function scopeDisplayName(scope, territoryByCode) {
  const territory =
    territoryByCode.get(scope.territorio_codigo)?.nombre ||
    scope.territorio_codigo;

  return scope.tipo_alcance === "REGION"
    ? `${territory} · Región ${scope.region}`
    : territory;
}

installProvincialInterface();
installCircunscriptionInterface();
installAuthorizationInterface();
installZonalSelectorStyles();
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

function cedulaDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatCedulaDisplay(value) {
  const original = String(value ?? "").trim();
  const digits = cedulaDigits(original);

  // No deformar silenciosamente valores históricos inválidos.
  if (digits.length !== 11) return original;

  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

function formatCedulaInput(value) {
  const digits = cedulaDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

function getRecordIdentityInputs() {
  const cedulaInput = els.recordForm.elements.namedItem("cedula");
  const nombreInput = els.recordForm.elements.namedItem("nombre_completo");

  return {
    cedulaInput: cedulaInput instanceof HTMLInputElement ? cedulaInput : null,
    nombreInput: nombreInput instanceof HTMLInputElement ? nombreInput : null
  };
}

async function resolveRecordNameByCedula({ silent = false, force = false } = {}) {
  if (!state.selectedRecord || !canEditRecord(state.selectedRecord)) return null;

  if (
    isCircunscriptionStructure() &&
    state.selectedRecord?.subseccion_codigo === "D1_DIPUTADOS_CIRCUNSCRIPCION"
  ) return null;

  const { cedulaInput, nombreInput } = getRecordIdentityInputs();
  if (!cedulaInput || !nombreInput) return null;

  const digits = cedulaDigits(cedulaInput.value).slice(0, 11);

  if (digits.length !== 11) {
    state.identityLookup.verifiedCedula = "";
    state.identityLookup.verifiedName = "";

    if (state.identityLookup.userChangedCedula) {
      nombreInput.value = "";
    }

    return null;
  }

  if (
    !force &&
    state.identityLookup.verifiedCedula === digits &&
    state.identityLookup.verifiedName
  ) {
    return {
      ok: true,
      cedula_normalizada: digits,
      cedula_formateada: formatCedulaDisplay(digits),
      nombre_completo: state.identityLookup.verifiedName
    };
  }

  const requestSequence = ++state.identityLookup.sequence;
  const previousName = nombreInput.value;
  nombreInput.placeholder = "Consultando nombre oficial…";

  try {
    const identityRpc =
      isProvincialStructure() &&
      state.selectedRecord?.es_relacion_electiva === true
        ? "sigep_portal_buscar_nombre_representacion_electiva_provincia"
        : "sigep_portal_buscar_nombre_por_cedula";

    const { data, error } = await supabase.rpc(
      identityRpc,
      {
        p_id_registro: state.selectedRecord.id_registro,
        p_cedula: digits
      }
    );

    if (requestSequence !== state.identityLookup.sequence) return null;
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.ok || !row?.nombre_completo) {
      state.identityLookup.verifiedCedula = "";
      state.identityLookup.verifiedName = "";

      nombreInput.value = state.identityLookup.userChangedCedula
        ? ""
        : state.identityLookup.originalName;

      if (!silent) {
        showLocalMessage(
          els.recordMessage,
          row?.mensaje || "No fue posible localizar la cédula.",
          "error"
        );
      }

      return null;
    }

    state.identityLookup.verifiedCedula = row.cedula_normalizada;
    state.identityLookup.verifiedName = row.nombre_completo;

    cedulaInput.value =
      row.cedula_formateada || formatCedulaInput(row.cedula_normalizada);
    nombreInput.value = row.nombre_completo;

    if (!silent) {
      showLocalMessage(
        els.recordMessage,
        "Nombre oficial localizado por la cédula.",
        "success"
      );
    }

    return row;
  } catch (error) {
    if (requestSequence !== state.identityLookup.sequence) return null;

    state.identityLookup.verifiedCedula = "";
    state.identityLookup.verifiedName = "";

    nombreInput.value = state.identityLookup.userChangedCedula
      ? ""
      : previousName || state.identityLookup.originalName;

    if (!silent) {
      showLocalMessage(
        els.recordMessage,
        error?.message || "No fue posible consultar el nombre oficial.",
        "error"
      );
    }

    return null;
  } finally {
    nombreInput.placeholder = "";
  }
}

function bindRecordIdentityLookup() {
  const { cedulaInput, nombreInput } = getRecordIdentityInputs();
  if (!cedulaInput || !nombreInput) return;

  nombreInput.readOnly = true;
  nombreInput.disabled = true;
  nombreInput.setAttribute("aria-readonly", "true");
  nombreInput.setAttribute("aria-disabled", "true");
  nombreInput.title = "El nombre se obtiene automáticamente desde la base maestra.";

  if (!canEditRecord(state.selectedRecord)) return;

  cedulaInput.inputMode = "numeric";
  cedulaInput.maxLength = 13;
  cedulaInput.autocomplete = "off";

  cedulaInput.addEventListener("input", () => {
    cedulaInput.value = formatCedulaInput(cedulaInput.value);

    const digits = cedulaDigits(cedulaInput.value);
    const originalDigits = cedulaDigits(state.identityLookup.originalCedula);

    state.identityLookup.userChangedCedula = digits !== originalDigits;
    state.identityLookup.verifiedCedula = "";
    state.identityLookup.verifiedName = "";

    if (state.identityLookup.userChangedCedula) {
      nombreInput.value = "";
    } else {
      nombreInput.value = state.identityLookup.originalName;
    }

    hideLocalMessage(els.recordMessage);
    window.clearTimeout(state.identityLookup.timer);

    if (digits.length === 11) {
      state.identityLookup.timer = window.setTimeout(() => {
        resolveRecordNameByCedula({ silent: false });
      }, 280);
    }
  });

  cedulaInput.addEventListener("blur", () => {
    const digits = cedulaDigits(cedulaInput.value);
    if (digits.length === 11) {
      resolveRecordNameByCedula({ silent: true });
    }
  });
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

function isZonalStructure(item = state.selectedStructure) {
  return String(item?.nivel_estructura || "").trim().toUpperCase() === "ZONA";
}

function isZonalSelectorEnabled(item = state.selectedStructure) {
  return isZonalStructure(item);
}

// Posición física de la tarjeta. El selector nunca cambia este valor.
function zonalPhysicalOrder(record) {
  return Number(
    record?.posicion_visual_base ??
    record?.orden_visible ??
    record?.orden_cargo ??
    0
  );
}

// Se mantiene como alias del orden físico para no alterar la cuadrícula.
function zonalVisualOrder(record) {
  return zonalPhysicalOrder(record);
}

// Número oficial mostrado para todas las Zonas.
function zonalDisplayNumber(record) {
  if (isZonalSelectorEnabled()) {
    const officialNumber = Number(record?.numero_ficha_oficial);
    if (Number.isFinite(officialNumber) && officialNumber > 0) {
      return officialNumber;
    }
  }
  return zonalPhysicalOrder(record);
}

function zonalDisplayCargo(record) {
  if (isZonalSelectorEnabled()) {
    return (
      record?.cargo_mostrado ||
      record?.cargo_selector_nombre ||
      record?.cargo_visible ||
      record?.cargo ||
      ""
    );
  }
  return record?.cargo_visible || record?.cargo || "";
}

function normalizeZonalSelectorRecord(record) {
  return {
    ...record,
    seccion_codigo:
      record?.seccion_codigo_clasificada ||
      record?.seccion_codigo,
    seccion_titulo:
      record?.seccion_titulo_clasificada ||
      record?.seccion_titulo,
    seccion_orden: Number(
      record?.seccion_orden_clasificada ??
      record?.seccion_orden ??
      99
    )
  };
}

function zonalAssignedCargoOwners() {
  const owners = new Map();
  if (!isZonalSelectorEnabled()) return owners;

  for (const record of state.records) {
    const code = String(record?.cargo_selector_codigo || "").trim();
    if (code && code !== "MIEMBRO") {
      owners.set(code, record.id_registro);
    }
  }

  return owners;
}

function zonalSelectorOptions(record) {
  const owners = zonalAssignedCargoOwners();
  const currentCode = String(record?.cargo_selector_codigo || "MIEMBRO");

  return zonalSelectorCatalog.map((item) => {
    const code = String(item.cargo_selector_codigo || "");
    const owner = owners.get(code);
    const occupiedByOther =
      item.repetible !== true &&
      owner &&
      owner !== record.id_registro;

    const label = item.numero_ficha == null
      ? item.cargo_nombre
      : `${String(item.numero_ficha).padStart(2, "0")} — ${item.cargo_nombre}`;

    return `
      <option
        value="${escapeHtml(code)}"
        ${code === currentCode ? "selected" : ""}
        ${occupiedByOther ? "disabled" : ""}
      >${escapeHtml(label)}${occupiedByOther ? " · ocupado" : ""}</option>
    `;
  }).join("");
}

function isProvincialStructure(item = state.selectedStructure) {
  return String(item?.nivel_estructura || "").trim().toUpperCase() === "PROVINCIA";
}

function isCircunscriptionStructure(item = state.selectedStructure) {
  return String(item?.nivel_estructura || "").trim().toUpperCase() === "CIRCUNSCRIPCION";
}

function provincialDiagnostic(records) {
  const bySection = {};
  for (const section of PROVINCIAL_SECTIONS) bySection[section.code] = 0;
  for (const record of records || []) {
    bySection[record.seccion_codigo] = (bySection[record.seccion_codigo] || 0) + 1;
  }
  const result = {
    build: window.__SIGEP_PORTAL_BUILD__,
    total: (records || []).length,
    fichasProvinciales: (records || []).filter((r) =>
      !r.es_relacion_ex_oficio &&
      !r.es_ficha_adicional &&
      r.es_relacion_electiva !== true
    ).length,
    relacionesExOficio: (records || []).filter((r) => r.es_relacion_ex_oficio === true).length,
    relacionesElectivas: (records || []).filter((r) => r.es_relacion_electiva === true).length,
    fichasAdicionales: (records || []).filter((r) => r.es_ficha_adicional === true).length,
    ocupadas: (records || []).filter((r) => r.nombre_completo).length,
    porSeccion: bySection
  };
  window.__SIGEP_PROVINCIA_DIAGNOSTICO__ = result;
  console.info("SIGEP Provincia diagnóstico verificable:", result);
  return result;
}

async function loadProvincialRecords(structureCode) {
  const { data: rawPayload, error } = await supabase.rpc(
    "sigep_portal_listar_estructura_provincial",
    { p_estructura_codigo: structureCode }
  );

  // No usar la vista directa como fallback. La vista puede devolver solo las
  // relaciones ex oficio bajo RLS y ocultar silenciosamente las fichas A/C/D/E/G.
  if (error) {
    throw new Error(`RPC_PROVINCIAL_FALLIDA: ${error.message}`);
  }

  let payload = rawPayload;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      throw new Error("RPC_PROVINCIAL_INVALIDA: el backend devolvió JSON no interpretable.");
    }
  }

  // Compatibilidad defensiva si PostgREST envolviera el objeto en un arreglo.
  if (Array.isArray(payload) && payload.length === 1 && payload[0]?.registros) {
    payload = payload[0];
  }

  if (!payload || payload.ok !== true) {
    throw new Error(
      payload?.mensaje ||
      payload?.codigo_resultado ||
      "RPC_PROVINCIAL_RECHAZADA: el backend no autorizó la lectura."
    );
  }

  const rows = Array.isArray(payload.registros) ? payload.registros : [];
  if (!rows.length) {
    throw new Error(
      "RPC_PROVINCIAL_SIN_FILAS: la función respondió correctamente, pero no devolvió fichas."
    );
  }

  const backendTotal = Number(payload.conteos?.total_visible ?? rows.length);
  if (backendTotal !== rows.length) {
    throw new Error(
      `RPC_PROVINCIAL_INCONSISTENTE: backend=${backendTotal}, navegador=${rows.length}.`
    );
  }

  const diagnostic = provincialDiagnostic(rows);
  diagnostic.rpcVersion = payload.version || null;
  diagnostic.backendCounts = payload.conteos || null;
  diagnostic.structureCode = structureCode;
  window.__SIGEP_PROVINCIA_DIAGNOSTICO__ = diagnostic;

  console.info("SIGEP Provincia RPC cargada:", {
    build: window.__SIGEP_PORTAL_BUILD__,
    rpcVersion: diagnostic.rpcVersion,
    total: rows.length,
    porSeccion: diagnostic.porSeccion
  });

  return rows;
}

function circunscriptionDiagnostic(records, payload = {}) {
  const bySection = {};
  for (const section of CIRCUNSCRIPTION_SECTIONS) bySection[section.code] = 0;
  for (const record of records || []) {
    bySection[record.seccion_codigo] = (bySection[record.seccion_codigo] || 0) + 1;
  }
  const result = {
    build: window.__SIGEP_PORTAL_BUILD__,
    rpcVersion: payload.version || null,
    structureCode: payload.estructura?.estructura_codigo || state.selectedStructure?.estructura_codigo || null,
    total: (records || []).length,
    propias: (records || []).filter((r) => !r.es_relacion_automatica && !r.es_ficha_adicional).length,
    relacionesAutomaticas: (records || []).filter((r) => r.es_relacion_automatica === true).length,
    diputadosActivos: (records || []).filter((r) => r.subseccion_codigo === "D1_DIPUTADOS_CIRCUNSCRIPCION").length,
    ocupadas: (records || []).filter((r) => r.nombre_completo).length,
    porSeccion: bySection,
    backend: payload.diagnostico || null
  };
  window.__SIGEP_CIRCUNSCRIPCION_DIAGNOSTICO__ = result;
  state.circunscriptionBackend.version = result.rpcVersion;
  state.circunscriptionBackend.diagnostic = result;
  console.info("SIGEP Circunscripción diagnóstico verificable:", result);
  return result;
}

async function loadCircunscriptionRecords(structureCode) {
  const { data: rawPayload, error } = await supabase.rpc(
    "sigep_portal_listar_estructura_circunscripcion",
    { p_estructura_codigo: structureCode }
  );

  if (error) throw new Error(`RPC_CIRCUNSCRIPCION_FALLIDA: ${error.message}`);

  let payload = rawPayload;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); }
    catch { throw new Error("RPC_CIRCUNSCRIPCION_INVALIDA: el backend devolvió JSON no interpretable."); }
  }
  if (Array.isArray(payload) && payload.length === 1 && payload[0]?.rows) payload = payload[0];
  if (!payload || payload.ok !== true) {
    throw new Error(payload?.mensaje || payload?.codigo_resultado || "RPC_CIRCUNSCRIPCION_RECHAZADA: el backend no autorizó la lectura.");
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const backendTotal = Number(payload.diagnostico?.total_visible ?? rows.length);
  if (backendTotal !== rows.length) {
    throw new Error(`RPC_CIRCUNSCRIPCION_INCONSISTENTE: backend=${backendTotal}, navegador=${rows.length}.`);
  }
  circunscriptionDiagnostic(rows, payload);
  return rows;
}

function editableFieldsForSelectedStructure(record = state.selectedRecord) {
  const fields = [...EDITABLE_FIELDS];

  if (isProvincialStructure()) {
    if (record?.es_relacion_electiva === true) {
      if (record?.tipo_relacion_electiva === "DIPUTADO_CIRCUNSCRIPCION") {
        fields.push(...PROVINCIAL_ELECTIVE_DEPUTY_FIELDS);
      }
    } else {
      fields.push(...PROVINCIAL_EDITABLE_FIELDS);
    }
  }

  if (isCircunscriptionStructure()) {
    fields.push(...CIRCUNSCRIPTION_EDITABLE_FIELDS);
    if (record?.subseccion_codigo === "D1_DIPUTADOS_CIRCUNSCRIPCION") {
      fields.push(...CIRCUNSCRIPTION_DEPUTY_FIELDS);
    }
  }

  return fields;
}

function provincialSection(record) {
  return PROVINCIAL_SECTION_BY_CODE.get(record?.seccion_codigo) || {
    code: record?.seccion_codigo || "SIN_SECCION",
    letter: record?.seccion_letra || "?",
    title: record?.seccion_titulo || "Sin sección",
    subtitle: record?.seccion_subtitulo || "Clasificación pendiente",
    reference: record?.referencia_normativa || "",
    order: Number(record?.seccion_orden || 99)
  };
}

function matchesProvincialConformation(record, conformation) {
  switch (conformation) {
    case "COMITE_PROVINCIAL":
      return record.integra_comite_provincial === true;
    case "COMISION_EJECUTIVA":
      return record.integra_comision_ejecutiva === true;
    case "CLED_PROVINCIAL":
      return record.integra_cled === true;
    case "REPRESENTACION_ELECTIVA":
      return record.seccion_codigo === "F_REPRESENTACION_SENATORIAL";
    case "NO_ESTATUTARIOS":
      return record.seccion_codigo === "G_MIEMBRO_NO_ESTATUTARIO";
    default:
      return true;
  }
}

function provincialFilterState({ forPrint = false } = {}) {
  if (forPrint && state.provincialPrint.active) {
    return {
      sections: state.provincialPrint.sections,
      conformation: state.provincialPrint.conformation
    };
  }
  return state.provincialFilters;
}

function provincialFilteredRecords(records = state.records, options = {}) {
  const { sections, conformation } = provincialFilterState(options);
  return [...records]
    .filter((record) => sections.has(record.seccion_codigo))
    .filter((record) => matchesProvincialConformation(record, conformation))
    .sort((a, b) => {
      const sectionDiff = Number(a.seccion_orden || 99) - Number(b.seccion_orden || 99);
      if (sectionDiff) return sectionDiff;
      const orderDiff = Number(a.orden_en_seccion || a.orden_cargo || 0) - Number(b.orden_en_seccion || b.orden_cargo || 0);
      if (orderDiff) return orderDiff;
      return String(a.id_registro || "").localeCompare(String(b.id_registro || ""));
    });
}

function circunscriptionSection(record) {
  return CIRCUNSCRIPTION_SECTION_BY_CODE.get(record?.seccion_codigo) || {
    code: record?.seccion_codigo || "SIN_SECCION",
    letter: record?.seccion_letra || "?",
    title: record?.seccion_titulo || "Sin sección",
    subtitle: record?.seccion_subtitulo || "Clasificación pendiente",
    reference: record?.referencia_normativa || "",
    order: Number(record?.seccion_orden || 99)
  };
}

function matchesCircunscriptionConformation(record, conformation) {
  switch (conformation) {
    case "COMITE_ART_106": return record.integra_comite_art_106 === true;
    case "DIRECCION_ART_106": return record.seccion_codigo === "A_DIRECCION_CIRCUNSCRIPCION";
    case "COMISION_OPERATIVA": return record.integra_comision_operativa === true;
    case "AUTORIDADES_ELECTAS": return record.seccion_codigo === "D_AUTORIDADES_ELECTAS";
    case "DIPUTADOS": return record.subseccion_codigo === "D1_DIPUTADOS_CIRCUNSCRIPCION";
    case "ALCALDES_DIRECTORES": return record.subseccion_codigo === "D2_ALCALDES_DIRECTORES";
    case "REGIDORES_VOCALES": return record.subseccion_codigo === "D3_REGIDORES_VOCALES";
    case "EX_OFICIO": return record.seccion_codigo === "B_MIEMBROS_EX_OFICIO";
    case "MIEMBROS_NO_ESTATUTARIOS": return record.seccion_codigo === "E_MIEMBROS_NO_ESTATUTARIOS";
    default: return true;
  }
}

function circunscriptionFilterState({ forPrint = false } = {}) {
  if (forPrint && state.circunscriptionPrint.active) {
    return { sections: state.circunscriptionPrint.sections, conformation: state.circunscriptionPrint.conformation };
  }
  return state.circunscriptionFilters;
}

function circunscriptionFilteredRecords(records = state.records, options = {}) {
  const { sections, conformation } = circunscriptionFilterState(options);
  return [...records]
    .filter((record) => sections.has(record.seccion_codigo))
    .filter((record) => matchesCircunscriptionConformation(record, conformation))
    .sort((a, b) => {
      const sectionDiff = Number(a.seccion_orden || 99) - Number(b.seccion_orden || 99);
      if (sectionDiff) return sectionDiff;
      const subsectionDiff = Number(a.subseccion_orden || 0) - Number(b.subseccion_orden || 0);
      if (subsectionDiff) return subsectionDiff;
      const orderDiff = Number(a.orden_en_seccion || a.orden_cargo || 0) - Number(b.orden_en_seccion || b.orden_cargo || 0);
      if (orderDiff) return orderDiff;
      return String(a.id_registro || "").localeCompare(String(b.id_registro || ""));
    });
}

function updateProvincialControlsVisibility() {
  if (els.provincialControls) els.provincialControls.hidden = !isProvincialStructure();
  if (els.circunscriptionControls) els.circunscriptionControls.hidden = !isCircunscriptionStructure();
  renderCircunscriptionDeputyAdmin();
}

function rerenderProvincialViews() {
  renderRecordCards();
  renderSummary();
  updateMetrics();
}

function selectedCheckboxValues(container) {
  return new Set(
    [...container.querySelectorAll('input[type="checkbox"]:checked')]
      .map((input) => input.value)
  );
}

function regionalVisualOrder(record) {
  return REGIONAL_VISUAL_ORDER.get(record.cargo_codigo) ?? record.orden_cargo;
}

function visibleStructureRecords(records = state.records) {
  if (isProvincialStructure()) return provincialFilteredRecords(records);
  if (isCircunscriptionStructure()) return circunscriptionFilteredRecords(records);

  if (isZonalStructure()) {
    return [...records].sort(
      (a, b) => zonalVisualOrder(a) - zonalVisualOrder(b)
    );
  }

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

  // Los permisos regionales permiten editar únicamente la estructura REGIÓN
  // asignada y las ZONAS que pertenecen a esa misma región. No afectan otros niveles.
  const selectedLevel = String(
    state.selectedStructure?.nivel_estructura || ""
  ).trim().toUpperCase();

  if (!["REGION", "ZONA"].includes(selectedLevel)) return false;

  const structureRegionNumber = normalizedRegionNumber(
    state.selectedStructure?.region
  );
  if (structureRegionNumber === null) return false;

  return state.regionalAssignments.some((assignment) =>
    assignment.territorio_codigo === state.selectedTerritory &&
    normalizedRegionNumber(assignment.region) === structureRegionNumber &&
    assignment.activo === true &&
    assignment.puede_ver === true &&
    assignment.puede_editar === true
  );
}

function canEditRecord(record = state.selectedRecord) {
  if (!record) return false;

  if (isCircunscriptionStructure()) {
    return (
      canEditSelectedTerritory() &&
      record.editable === true &&
      record.es_relacion_automatica !== true
    );
  }

  if (isProvincialStructure()) {
    if (record.es_relacion_ex_oficio === true) return false;

    if (record.es_relacion_electiva === true) {
      return (
        canEditSelectedTerritory() &&
        record.editable === true &&
        record.cupo_habilitado !== false
      );
    }

    return canEditSelectedTerritory() && record.editable !== false;
  }

  return canEditSelectedTerritory();
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

  const { data: approvalContextData, error: approvalContextError } =
    await supabase.rpc("sigep_aprobaciones_contexto_actual");

  const approvalContext = approvalContextError
    ? null
    : normalizeRpcPayload(approvalContextData);

  state.approvalContext = approvalContext;
  state.canApprove =
    state.isAdmin ||
    approvalContext?.puede_aprobar_alguno === true;

  els.userName.textContent = profile.nombre_completo || profile.usuario_login;
  els.userRole.textContent = state.isAdmin
    ? "Administrador provincial"
    : state.canApprove
      ? `Usuario territorial · aprobador · ${profile.usuario_login}`
      : `Usuario territorial · ${profile.usuario_login}`;

  els.usersTab.hidden = !state.isAdmin;
  els.auditTab.hidden = !state.isAdmin;
  els.approvalsTab.hidden = !state.canApprove;
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
        .select("usuario_id,territorio_codigo,puede_ver,puede_editar,puede_aprobar,activo")
        .eq("usuario_id", state.user.id)
        .eq("activo", true),
      supabase
        .from("usuario_regiones")
        .select("usuario_id,territorio_codigo,region,puede_ver,puede_editar,puede_aprobar,activo")
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
  updateProvincialControlsVisibility();
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

function resetProvincialFiltersToCompleteView() {
  state.provincialFilters.sections = new Set(
    PROVINCIAL_SECTIONS.map((section) => section.code)
  );
  state.provincialFilters.conformation = "ESTRUCTURA_COMPLETA";

  if (els.provincialSectionFilters) {
    for (const input of els.provincialSectionFilters.querySelectorAll('input[type="checkbox"]')) {
      input.checked = true;
    }
  }
  if (els.provincialConformationFilter) {
    els.provincialConformationFilter.value = "ESTRUCTURA_COMPLETA";
  }
}

function resetCircunscriptionFiltersToCompleteView() {
  state.circunscriptionFilters.sections = new Set(
    CIRCUNSCRIPTION_SECTIONS.map((section) => section.code)
  );
  state.circunscriptionFilters.conformation = "ESTRUCTURA_COMPLETA";
  if (els.circunscriptionSectionFilters) {
    for (const input of els.circunscriptionSectionFilters.querySelectorAll('input[type="checkbox"]')) input.checked = true;
  }
  if (els.circunscriptionConformationFilter) els.circunscriptionConformationFilter.value = "ESTRUCTURA_COMPLETA";
}

async function selectStructure(structureCode) {
  const structure = state.structures.find((item) => item.estructura_codigo === structureCode);
  if (!structure) return;

  state.selectedStructure = structure;
  if (!isZonalStructure(structure)) zonalSelectorCatalog = [];
  if (isProvincialStructure(structure)) resetProvincialFiltersToCompleteView();
  if (isCircunscriptionStructure(structure)) resetCircunscriptionFiltersToCompleteView();
  renderStructureList();
  renderTerritorialHeader();
  els.recordsGrid.innerHTML = `<div class="loading full-span">Cargando ${isRegionalStructure(structure) ? "la estructura regional" : "los cargos"}…</div>`;

  let data = [];
  try {
    if (isProvincialStructure(structure)) {
      data = await loadProvincialRecords(structureCode);
    } else if (isCircunscriptionStructure(structure)) {
      data = await loadCircunscriptionRecords(structureCode);
    } else if (isZonalStructure(structure)) {
      const [recordsResult, catalogResult] = await Promise.all([
        supabase
          .from(ZONAL_SELECTOR_VIEW)
          .select("*")
          .eq("estructura_codigo", structureCode)
          .order("posicion_visual_base"),
        supabase
          .from(ZONAL_SELECTOR_CATALOG_TABLE)
          .select("cargo_selector_codigo,numero_ficha,cargo_nombre,repetible,activo")
          .eq("activo", true)
      ]);

      if (recordsResult.error) throw recordsResult.error;
      if (catalogResult.error) throw catalogResult.error;

      zonalSelectorCatalog = [...(catalogResult.data || [])]
        .sort((a, b) => {
          if (a.numero_ficha == null) return 1;
          if (b.numero_ficha == null) return -1;
          return Number(a.numero_ficha) - Number(b.numero_ficha);
        });

      data = (recordsResult.data || []).map(normalizeZonalSelectorRecord);
    } else {
      const result = await supabase
        .from("v_fichas_portal")
        .select("*")
        .eq("estructura_codigo", structureCode)
        .order("orden_cargo");
      if (result.error) throw result.error;
      data = result.data || [];
    }
  } catch (error) {
    state.records = [];
    const scopeLabel = isProvincialStructure(structure) ? "provinciales" : (isCircunscriptionStructure(structure) ? "de circunscripción" : "territoriales");
    els.recordsGrid.innerHTML = `
      <div class="empty-card full-span provincial-load-error">
        <strong>No se pudieron cargar las fichas ${scopeLabel}</strong>
        <span>${escapeHtml(error.message || "Error de lectura territorial.")}</span>
        <span>Los datos base permanecen preservados; este error corresponde a la ruta de lectura del portal.</span>
      </div>`;
    els.cargoToolbarText.textContent = `Error verificable de lectura ${scopeLabel}. Revise el mensaje mostrado.`;
    throw error;
  }

  state.records = data;
  if (isProvincialStructure(structure) && state.records.length !== 118) {
    console.warn(
      `SIGEP Provincia: se esperaban 118 elementos vigentes y llegaron ${state.records.length}.`,
      window.__SIGEP_PROVINCIA_DIAGNOSTICO__
    );
  }

  if (isZonalStructure(structure) && state.records.length !== 45) {
    console.warn(
      `SIGEP Zona: se esperaban 45 posiciones operativas y llegaron ${state.records.length}.`,
      structure.estructura_codigo
    );
  }

  await loadZonalAuthorities(structure);
  updateProvincialControlsVisibility();

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
    [
      record.cargo,
      record.cargo_visible,
      record.cargo_original,
      record.cargo_mostrado,
      record.cargo_selector_nombre,
      record.numero_ficha_oficial,
      record.nombre_completo,
      record.cedula,
      formatCedulaDisplay(record.cedula),
      record.comentario,
      record.seccion_titulo,
      record.origen_estructura_nombre,
      record.origen_territorio_codigo,
      record.tipo_autoridad,
      record.periodo_electoral,
      record.rol_bloque
    ].some((value) => String(value || "").toLowerCase().includes(term))
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
        <span>${escapeHtml(record?.cedula ? `Cédula: ${formatCedulaDisplay(record.cedula)}` : "Sin cédula registrada")}</span>
      </div>
      <div class="readonly-note">Solo lectura desde la región</div>
      <button class="button ghost small open-zone no-print" type="button" data-zone-code="${escapeHtml(zone.estructura_codigo)}">Abrir zona para editar</button>
    </article>
  `;
}


function provincialElectiveGroupCode(record) {
  if (
    record?.cargo_codigo === "SIGEP_PROV_SENADOR_01" ||
    record?.tipo_relacion_electiva === "SENADOR_PROVINCIA"
  ) return "SENADOR";

  if (record?.tipo_relacion_electiva === "DIPUTADO_CIRCUNSCRIPCION") {
    return "DIPUTADOS";
  }

  if (record?.tipo_relacion_electiva === "ALCALDE_MUNICIPAL") {
    return "ALCALDES";
  }

  if (record?.tipo_relacion_electiva === "DIRECTOR_DISTRITAL") {
    return "DIRECTORES";
  }

  return "OTROS";
}

function provincialElectiveOrigin(record) {
  return [
    record?.origen_nivel_estructura,
    record?.origen_estructura_nombre || record?.origen_territorio_codigo
  ].filter(Boolean).join(" · ");
}

function renderProvincialRecordCard(record) {
  const complete = Boolean(record.nombre_completo && record.cedula);
  const isExOfficio = record.es_relacion_ex_oficio === true;
  const isElective = record.es_relacion_electiva === true;
  const isDisabledDeputy =
    record.tipo_relacion_electiva === "DIPUTADO_CIRCUNSCRIPCION" &&
    record.cupo_habilitado === false;
  const editable = canEditRecord(record);

  const origin = isExOfficio || isElective
    ? provincialElectiveOrigin(record)
    : "";

  const comment = record.comentario
    ? `<p class="record-comment"><strong>Comentario:</strong> ${escapeHtml(record.comentario)}</p>`
    : "";

  let badge = "";
  if (isExOfficio) {
    badge = '<span class="relation-badge">Relación ex oficio</span>';
  } else if (isElective) {
    badge = '<span class="relation-badge">Representación electiva</span>';
  } else if (record.es_ficha_adicional === true) {
    badge = '<span class="relation-badge">Ficha adicional</span>';
  }

  let note = "";
  if (isExOfficio) {
    note = `Ficha vinculada automáticamente${origin ? ` desde ${escapeHtml(origin)}` : ""}. No se duplica ni se edita desde Provincia.`;
  } else if (isDisabledDeputy) {
    note = "Cupo de Diputado configurado pero no habilitado. Puede consultarse desde Provincia; la habilitación del cupo conserva su control administrativo vigente.";
  } else if (isElective) {
    note = `Ficha vinculada · actualización compartida${origin ? ` · Origen: ${escapeHtml(origin)}` : ""}. Los cambios se escriben en la misma ficha física y se reflejan en ambos niveles.`;
  }

  let action = "";
  if (isExOfficio) {
    action = `<div class="readonly-note">${note}</div>`;
  } else {
    let label = editable ? "Abrir y editar ficha" : "Consultar ficha";

    if (record.es_ficha_adicional === true && !record.nombre_completo) {
      label = editable ? "Agregar senador" : "Consultar ficha";
    }

    if (
      isElective &&
      record.tipo_relacion_electiva === "DIPUTADO_CIRCUNSCRIPCION" &&
      !record.nombre_completo &&
      !isDisabledDeputy
    ) {
      label = editable ? "Completar diputado" : "Consultar ficha";
    }

    action = `
      ${note ? `<div class="readonly-note">${note}</div>` : ""}
      <button
        class="button ${editable ? "" : "ghost"} small open-record"
        type="button"
        data-record-id="${escapeHtml(record.id_registro)}">
        ${label}
      </button>
    `;
  }

  return `
    <article class="record-card provincial-record-card ${(isExOfficio || isElective) ? "linked-record" : ""}">
      <div class="record-card-top">
        <span class="cargo-number">${String(record.orden_en_seccion || record.orden_cargo || "").padStart(2, "0")}</span>
        <span class="status-dot ${complete ? "complete" : ""}" title="${complete ? "Datos básicos completos" : "Datos básicos pendientes"}"></span>
      </div>
      ${badge}
      <h4>${escapeHtml(record.cargo)}</h4>
      <div class="record-person ${record.nombre_completo ? "" : "empty"}">
        <strong>${escapeHtml(record.nombre_completo || (isDisabledDeputy ? "Cupo no habilitado" : "Pendiente de completar"))}</strong>
        <span>${escapeHtml(record.cedula ? `Cédula: ${formatCedulaDisplay(record.cedula)}` : "Sin cédula registrada")}</span>
      </div>
      ${comment}
      ${action}
    </article>
  `;
}

function renderProvincialElectiveSectionCards(sectionRecords) {
  const grouped = new Map();

  for (const record of sectionRecords) {
    const code = provincialElectiveGroupCode(record);
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code).push(record);
  }

  return PROVINCIAL_ELECTIVE_GROUPS.map((group) => {
    const groupRecords = (grouped.get(group.code) || [])
      .sort((a, b) =>
        Number(a.orden_en_seccion || a.orden_cargo || 0) -
        Number(b.orden_en_seccion || b.orden_cargo || 0)
      );

    return `
      <div class="regional-section-heading full-span">
        <div>
          <span class="regional-section-kicker">Sección F · Representación electiva</span>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.subtitle)}</p>
        </div>
        <span class="regional-section-badge">
          ${groupRecords.length} de ${group.expected}
        </span>
      </div>
      ${groupRecords.map(renderProvincialRecordCard).join("")}
    `;
  }).join("");
}

function renderProvincialElectiveSummaryRows(sectionRecords) {
  const grouped = new Map();

  for (const record of sectionRecords) {
    const code = provincialElectiveGroupCode(record);
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code).push(record);
  }

  return PROVINCIAL_ELECTIVE_GROUPS.map((group) => {
    const groupRecords = (grouped.get(group.code) || [])
      .sort((a, b) =>
        Number(a.orden_en_seccion || a.orden_cargo || 0) -
        Number(b.orden_en_seccion || b.orden_cargo || 0)
      );

    const heading = `
      <tr class="summary-section-row">
        <td colspan="4">
          <strong>${escapeHtml(group.title)}</strong>
          <span>${groupRecords.length} de ${group.expected} posiciones</span>
        </td>
      </tr>
    `;

    const rows = groupRecords.map((record) => {
      const origin = provincialElectiveOrigin(record);
      const disabled = record.cupo_habilitado === false;
      const detail = [
        disabled ? "Cupo no habilitado" : "",
        record.es_relacion_electiva === true ? "Ficha vinculada · actualización compartida" : "",
        origin,
        record.periodo_electoral ? `Periodo ${record.periodo_electoral}` : ""
      ].filter(Boolean).join(" · ");

      return `
        <tr class="${record.es_relacion_electiva === true ? "zonal-summary-row" : ""}">
          <td>${escapeHtml(record.orden_en_seccion || record.orden_cargo || "")}</td>
          <td>
            <strong>${escapeHtml(record.cargo)}</strong>
            ${detail ? `<small class="summary-detail">${escapeHtml(detail)}</small>` : ""}
          </td>
          <td>${escapeHtml(record.nombre_completo || "")}</td>
          <td>${escapeHtml(formatCedulaDisplay(record.cedula || ""))}</td>
        </tr>
      `;
    }).join("");

    return heading + rows;
  }).join("");
}

function renderProvincialRecordCards() {
  const records = filteredRecords();
  const totalVisible = provincialFilteredRecords().length;
  const searchActive = Boolean(els.recordSearch.value.trim());
  const canEditProvince = canEditSelectedTerritory();

  els.cargoToolbarText.textContent =
    `${records.length} de ${totalVisible} fichas o relaciones mostradas · ` +
    `${canEditProvince ? "Edición provincial habilitada según ficha y permisos" : "Solo lectura"}. ` +
    "La Sección F comparte la misma ficha física con Circunscripción, Municipio o Distrito Municipal; no duplica datos.";

  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.seccion_codigo)) grouped.set(record.seccion_codigo, []);
    grouped.get(record.seccion_codigo).push(record);
  }

  const currentFilters = provincialFilterState();
  const selectedSections = currentFilters.sections;

  const html = PROVINCIAL_SECTIONS
    .filter((section) => selectedSections.has(section.code))
    .map((section) => {
      const sectionRecords = grouped.get(section.code) || [];

      if (!sectionRecords.length && searchActive) return "";
      if (!sectionRecords.length) return "";

      const cards =
        section.code === "F_REPRESENTACION_SENATORIAL"
          ? renderProvincialElectiveSectionCards(sectionRecords)
          : sectionRecords.map(renderProvincialRecordCard).join("");

      return `
        <div class="provincial-section-heading full-span" data-section-code="${section.code}">
          <div>
            <span class="provincial-section-kicker">Sección ${section.letter}</span>
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.subtitle)} · ${escapeHtml(section.reference)}</p>
          </div>
          <span class="provincial-section-count">
            ${sectionRecords.length} ficha${sectionRecords.length === 1 ? "" : "s"}
          </span>
        </div>
        ${cards}
      `;
    }).join("");

  els.recordsGrid.innerHTML =
    html ||
    '<div class="empty-card full-span"><strong>No se encontraron fichas</strong><span>Ajuste los filtros o el texto de búsqueda.</span></div>';
}

function circunscriptionConformationIncludesSection(sectionCode, conformation) {
  switch (conformation) {
    case "COMITE_ART_106": return ["A_DIRECCION_CIRCUNSCRIPCION", "B_MIEMBROS_EX_OFICIO"].includes(sectionCode);
    case "DIRECCION_ART_106": return sectionCode === "A_DIRECCION_CIRCUNSCRIPCION";
    case "COMISION_OPERATIVA": return ["A_DIRECCION_CIRCUNSCRIPCION", "C_COMISION_OPERATIVA_NO_ESTATUTARIA"].includes(sectionCode);
    case "AUTORIDADES_ELECTAS":
    case "DIPUTADOS":
    case "ALCALDES_DIRECTORES":
    case "REGIDORES_VOCALES": return sectionCode === "D_AUTORIDADES_ELECTAS";
    case "EX_OFICIO": return sectionCode === "B_MIEMBROS_EX_OFICIO";
    case "MIEMBROS_NO_ESTATUTARIOS": return sectionCode === "E_MIEMBROS_NO_ESTATUTARIOS";
    default: return true;
  }
}

function circunscriptionVisibleSubsections(conformation) {
  if (conformation === "DIPUTADOS") return new Set(["D1_DIPUTADOS_CIRCUNSCRIPCION"]);
  if (conformation === "ALCALDES_DIRECTORES") return new Set(["D2_ALCALDES_DIRECTORES"]);
  if (conformation === "REGIDORES_VOCALES") return new Set(["D3_REGIDORES_VOCALES"]);
  return new Set(CIRCUNSCRIPTION_SUBSECTIONS.map((item) => item.code));
}

function circunscriptionDisplayCargo(record) {
  if (record.subseccion_codigo === "D2_ALCALDES_DIRECTORES") {
    return record.tipo_autoridad === "ALCALDE"
      ? "Alcalde Municipal del Partido"
      : "Director(a) de Distrito Municipal del Partido";
  }
  return record.cargo;
}

function circunscriptionRecordCard(record) {
  const complete = Boolean(record.nombre_completo && record.cedula);
  const automatic = record.es_relacion_automatica === true;
  const origin = automatic
    ? [record.origen_nivel_estructura, record.origen_estructura_nombre || record.origen_territorio_codigo].filter(Boolean).join(" · ")
    : "";
  const comment = record.comentario
    ? `<p class="record-comment"><strong>Comentario:</strong> ${escapeHtml(record.comentario)}</p>`
    : "";
  const authorityBadge = record.tipo_autoridad
    ? `<span class="circ-authority-badge">${escapeHtml(record.tipo_autoridad === "DIRECTOR_DISTRITAL" ? "Director distrital" : record.tipo_autoridad)}</span>`
    : "";
  const roleBadge = record.rol_bloque
    ? `<span class="circ-role-badge">${escapeHtml(record.rol_bloque === "VOCERO" ? "Vocero del bloque" : record.rol_bloque)}</span>`
    : "";
  const period = record.periodo_electoral
    ? `<span class="circ-relation-origin">Periodo electoral: ${escapeHtml(record.periodo_electoral)}</span>`
    : "";
  const editable = canEditRecord(record);
  let action = "";
  if (automatic) {
    action = `<div class="readonly-note">Relación automática${origin ? ` desde ${escapeHtml(origin)}` : ""}. Se edita únicamente en el territorio de origen.</div>`;
  } else {
    const label = record.subseccion_codigo === "D1_DIPUTADOS_CIRCUNSCRIPCION" && !record.nombre_completo
      ? "Completar diputado"
      : (editable ? "Abrir y editar ficha" : "Consultar ficha");
    action = `<button class="button ${editable ? "" : "ghost"} small open-record" type="button" data-record-id="${escapeHtml(record.id_registro)}">${label}</button>`;
  }

  const relationBadge = automatic
    ? `<span class="relation-badge">${record.seccion_codigo === "B_MIEMBROS_EX_OFICIO" ? "Miembro ex oficio" : "Relación automática"}</span>`
    : (record.es_ficha_adicional ? '<span class="relation-badge">Ficha adicional</span>' : "");

  return `
    <article class="record-card provincial-record-card ${automatic ? "linked-record circ-automatic-card" : ""}">
      <div class="record-card-top">
        <span class="cargo-number">${String(record.orden_en_seccion || record.orden_cargo || "").padStart(2, "0")}</span>
        <span class="status-dot ${complete ? "complete" : ""}" title="${complete ? "Datos básicos completos" : "Datos básicos pendientes"}"></span>
      </div>
      ${relationBadge}
      ${authorityBadge}${roleBadge}
      <h4>${escapeHtml(circunscriptionDisplayCargo(record))}</h4>
      ${origin ? `<span class="circ-relation-origin">${escapeHtml(origin)}</span>` : ""}
      <div class="record-person ${record.nombre_completo ? "" : "empty"}">
        <strong>${escapeHtml(record.nombre_completo || "Pendiente de completar")}</strong>
        <span>${escapeHtml(record.cedula ? `Cédula: ${formatCedulaDisplay(record.cedula)}` : "Sin cédula registrada")}</span>
      </div>
      ${period}${comment}${action}
    </article>
  `;
}

function renderCircunscriptionRecordCards() {
  const records = filteredRecords();
  const totalVisible = circunscriptionFilteredRecords().length;
  const searchActive = Boolean(els.recordSearch.value.trim());
  const currentFilters = circunscriptionFilterState();
  const canEditAny = canEditSelectedTerritory();
  els.cargoToolbarText.textContent = `${records.length} de ${totalVisible} fichas o relaciones mostradas · ${canEditAny ? "Edición permitida únicamente en fichas propias" : "Solo lectura"}. Las relaciones B, D.2 y D.3 no se editan desde la circunscripción.`;

  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.seccion_codigo)) grouped.set(record.seccion_codigo, []);
    grouped.get(record.seccion_codigo).push(record);
  }

  const html = CIRCUNSCRIPTION_SECTIONS
    .filter((section) => currentFilters.sections.has(section.code))
    .filter((section) => circunscriptionConformationIncludesSection(section.code, currentFilters.conformation))
    .map((section) => {
      const sectionRecords = grouped.get(section.code) || [];
      if (section.code !== "D_AUTORIDADES_ELECTAS" && !sectionRecords.length && searchActive) return "";

      let body = "";
      if (section.code === "D_AUTORIDADES_ELECTAS") {
        const visibleSubsections = circunscriptionVisibleSubsections(currentFilters.conformation);
        body = CIRCUNSCRIPTION_SUBSECTIONS
          .filter((subsection) => visibleSubsections.has(subsection.code))
          .map((subsection) => {
            const subsectionRecords = sectionRecords.filter((record) => record.subseccion_codigo === subsection.code);
            if (!subsectionRecords.length && searchActive) return "";
            let placeholder = "";
            if (!subsectionRecords.length && subsection.code === "D1_DIPUTADOS_CIRCUNSCRIPCION") {
              placeholder = '<div class="empty-card circ-placeholder"><strong>No hay cupos de diputados habilitados</strong><span>El administrador provincial puede habilitar los cupos técnicos desde el panel superior.</span></div>';
            } else if (!subsectionRecords.length && subsection.code === "D3_REGIDORES_VOCALES") {
              placeholder = '<div class="empty-card circ-placeholder"><strong>Subsección preparada</strong><span>Se poblará automáticamente cuando existan fichas individuales de regidores y vocales en municipios y distritos. La ficha podrá identificar al vocero, vicevocero o secretario del bloque.</span></div>';
            } else if (!subsectionRecords.length) {
              placeholder = '<div class="empty-card circ-placeholder"><strong>Sin autoridades relacionadas</strong><span>No existen registros visibles para esta subsección.</span></div>';
            }
            return `
              <div class="circ-subsection-heading">
                <div><span class="circ-subsection-label">${subsection.label}</span><h4>${escapeHtml(subsection.title)}</h4><p>${escapeHtml(subsection.subtitle)}</p></div>
                <span class="provincial-section-count">${subsectionRecords.length}</span>
              </div>
              ${subsectionRecords.map(circunscriptionRecordCard).join("") || placeholder}
            `;
          }).join("");
      } else {
        body = sectionRecords.map(circunscriptionRecordCard).join("");
        if (!body && !searchActive) body = '<div class="empty-card full-span"><strong>Sin fichas visibles</strong><span>La sección permanece configurada.</span></div>';
      }

      if (!body) return "";
      return `
        <div class="provincial-section-heading full-span" data-section-code="${section.code}">
          <div><span class="provincial-section-kicker">Sección ${section.letter}</span><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.subtitle)} · ${escapeHtml(section.reference)}</p></div>
          <span class="provincial-section-count">${sectionRecords.length} elemento${sectionRecords.length === 1 ? "" : "s"}</span>
        </div>
        ${body}
      `;
    }).join("");

  els.recordsGrid.innerHTML = html || '<div class="empty-card full-span"><strong>No se encontraron fichas</strong><span>Ajuste los filtros o el texto de búsqueda.</span></div>';
  renderCircunscriptionDeputyAdmin();
}

function renderZonalRecordCards() {
  const records = filteredRecords();
  const searchActive = Boolean(els.recordSearch.value.trim());
  const canEdit = canEditSelectedTerritory();

  // La vista zonal final deja únicamente el título “Tarjetas de cargos”.
  els.cargoToolbarText.textContent = "";
  els.cargoToolbarText.hidden = true;

  const grouped = new Map();

  for (const record of records) {
    if (!grouped.has(record.seccion_codigo)) {
      grouped.set(record.seccion_codigo, []);
    }
    grouped.get(record.seccion_codigo).push(record);
  }

  const sections = [
    {
      code: "Z_DIRECCION_ZONAL",
      title: "Dirección Zonal",
      subtitle: "12 cargos de dirección",
      expected: 12
    },
    {
      code: "Z_MIEMBROS",
      title: "Miembros",
      subtitle: "33 fichas clasificables",
      expected: 33
    }
  ];

  const html = sections.map((section) => {
    const sectionRecords = (grouped.get(section.code) || [])
      .sort((a, b) => zonalVisualOrder(a) - zonalVisualOrder(b));

    if (!sectionRecords.length && searchActive) {
      return "";
    }

    const cards = sectionRecords.map((record) => {
      const complete = Boolean(record.nombre_completo && record.cedula);
      const selectorEnabled =
        record.selector_habilitado === true &&
        section.code === "Z_MIEMBROS";

      const selector = selectorEnabled
        ? `
          <div class="zonal-selector-wrap no-print">
            <span class="zonal-selector-label">Cargo oficial</span>
            <div class="zonal-selector-row">
              <select
                class="zonal-selector-select"
                data-zonal-selector-record-id="${escapeHtml(record.id_registro)}"
                ${canEdit ? "" : "disabled"}
                aria-label="Seleccionar cargo oficial">
                ${zonalSelectorOptions(record)}
              </select>
              <button
                class="button small zonal-selector-assign"
                type="button"
                data-zonal-selector-record-id="${escapeHtml(record.id_registro)}"
                ${canEdit ? "" : "disabled"}>
                Asignar
              </button>
            </div>
            <small class="zonal-selector-note">
              La persona y sus datos permanecen en esta misma ficha. Solo cambia la clasificación oficial.
            </small>
          </div>
        `
        : "";

      return `
        <article class="record-card ${selectorEnabled ? "zonal-selector-card" : ""}">
          <div class="record-card-top">
            <span class="cargo-number">${String(zonalDisplayNumber(record)).padStart(2, "0")}</span>
            <span
              class="status-dot ${complete ? "complete" : ""}"
              title="${complete ? "Datos básicos completos" : "Datos básicos pendientes"}">
            </span>
          </div>


          <h4>${escapeHtml(zonalDisplayCargo(record))}</h4>

          <div class="record-person ${record.nombre_completo ? "" : "empty"}">
            <strong>${escapeHtml(record.nombre_completo || "Pendiente de completar")}</strong>
            <span>${escapeHtml(
              record.cedula
                ? `Cédula: ${formatCedulaDisplay(record.cedula)}`
                : "Sin cédula registrada"
            )}</span>
          </div>

          ${selector}

          <button
            class="button ${canEdit ? "" : "ghost"} small open-record"
            type="button"
            data-record-id="${escapeHtml(record.id_registro)}">
            ${canEdit ? "Abrir y editar ficha" : "Consultar ficha"}
          </button>
        </article>
      `;
    }).join("");

    return `
      <div class="regional-section-heading full-span">
        <div>
          <span class="regional-section-kicker">Estructura zonal</span>
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.subtitle)}</p>
        </div>
        <span class="regional-section-badge">
          ${sectionRecords.length} de ${section.expected}
        </span>
      </div>

      ${cards || `
        <div class="empty-card full-span">
          <strong>Sin coincidencias en esta sección</strong>
          <span>Quite o cambie el texto de búsqueda.</span>
        </div>
      `}
    `;
  }).join("");

  els.recordsGrid.innerHTML = html || `
    <div class="empty-card full-span">
      <strong>No se encontraron fichas</strong>
      <span>Ajuste el texto de búsqueda.</span>
    </div>
  `;
}

function renderRecordCards() {
  if (!state.selectedStructure) {
    els.cargoToolbarText.hidden = false;
    els.recordsGrid.innerHTML = '<div class="empty-card full-span"><strong>Seleccione una estructura</strong><span>Luego podrá abrir y editar cada ficha autorizada.</span></div>';
    els.cargoToolbarText.textContent = "Seleccione una estructura para consultar sus cargos.";
    return;
  }

  els.cargoToolbarText.hidden = isZonalStructure();

  if (isProvincialStructure()) {
    renderProvincialRecordCards();
    return;
  }
  if (isCircunscriptionStructure()) {
    renderCircunscriptionRecordCards();
    return;
  }

  if (isZonalStructure()) {
    renderZonalRecordCards();
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
          <span>${escapeHtml(record.cedula ? `Cédula: ${formatCedulaDisplay(record.cedula)}` : "Sin cédula registrada")}</span>
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
    return [
      zone.estructura_nombre,
      president?.nombre_completo,
      secretary?.nombre_completo,
      president?.cedula,
      secretary?.cedula,
      formatCedulaDisplay(president?.cedula),
      formatCedulaDisplay(secretary?.cedula)
    ].some((value) => String(value || "").toLowerCase().includes(term));
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
  if (isProvincialStructure()) {
    els.metricFilled.textContent = String(records.filter((record) => record.nombre_completo).length);
    els.metricTotal.textContent = String(records.length);
    return;
  }
  const zonalRecords = isRegionalStructure()
    ? state.zonalAuthorities.flatMap((item) => [item.president, item.secretary]).filter(Boolean)
    : [];
  const filled = [...records, ...zonalRecords].filter((record) => record.nombre_completo).length;
  els.metricFilled.textContent = String(filled);
  els.metricTotal.textContent = String(records.length + zonalRecords.length);
}

function renderProvincialSummary() {
  const item = state.selectedStructure;
  const forPrint = state.provincialPrint.active;
  const records = provincialFilteredRecords(state.records, { forPrint });
  const identifySections = forPrint ? state.provincialPrint.identifySections : true;
  const filterState = provincialFilterState({ forPrint });
  const conformationLabel =
    PROVINCIAL_CONFORMATIONS.find((entry) => entry.value === filterState.conformation)?.label ||
    "Estructura provincial completa";

  els.summaryTitle.textContent = item.estructura_nombre;
  els.summaryContext.textContent = `${records.length} fichas o relaciones · ${conformationLabel}.`;
  els.summaryHeader.innerHTML =
    `<strong>${escapeHtml(item.nivel_estructura)} · ${escapeHtml(item.estructura_nombre)}</strong>` +
    `<span>${escapeHtml(contextLine(item))}</span>`;

  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.seccion_codigo)) grouped.set(record.seccion_codigo, []);
    grouped.get(record.seccion_codigo).push(record);
  }

  const rows = PROVINCIAL_SECTIONS
    .filter((section) => filterState.sections.has(section.code))
    .map((section) => {
      const sectionRecords = grouped.get(section.code) || [];
      if (!sectionRecords.length) return "";

      const heading = identifySections ? `
        <tr class="summary-section-row provincial-summary-section">
          <td colspan="4">
            <strong>${section.letter}. ${escapeHtml(section.title)}</strong>
            <span>${escapeHtml(section.subtitle)} · ${escapeHtml(section.reference)}</span>
          </td>
        </tr>
      ` : "";

      if (section.code === "F_REPRESENTACION_SENATORIAL") {
        return heading + renderProvincialElectiveSummaryRows(sectionRecords);
      }

      const dataRows = sectionRecords.map((record) => {
        const detail = record.es_relacion_ex_oficio
          ? `Miembro ex oficio · ${record.origen_estructura_nombre || record.origen_territorio_codigo || "estructura de origen"}`
          : record.comentario || "";

        return `
          <tr class="${record.es_relacion_ex_oficio ? "zonal-summary-row" : ""}">
            <td>${escapeHtml(record.orden_en_seccion || record.orden_cargo || "")}</td>
            <td>
              <strong>${escapeHtml(record.cargo)}</strong>
              ${detail ? `<small class="summary-detail">${escapeHtml(detail)}</small>` : ""}
            </td>
            <td>${escapeHtml(record.nombre_completo || "")}</td>
            <td>${escapeHtml(formatCedulaDisplay(record.cedula || ""))}</td>
          </tr>
        `;
      }).join("");

      return heading + dataRows;
    }).join("");

  els.summaryBody.innerHTML =
    rows ||
    '<tr><td colspan="4" class="loading">No hay fichas en la selección.</td></tr>';
}

function renderCircunscriptionSummary() {
  const item = state.selectedStructure;
  const forPrint = state.circunscriptionPrint.active;
  const records = circunscriptionFilteredRecords(state.records, { forPrint });
  const identifySections = forPrint ? state.circunscriptionPrint.identifySections : true;
  const filterState = circunscriptionFilterState({ forPrint });
  const conformationLabel = CIRCUNSCRIPTION_CONFORMATIONS.find((entry) => entry.value === filterState.conformation)?.label || "Estructura de Circunscripción completa";

  els.summaryTitle.textContent = item.estructura_nombre;
  els.summaryContext.textContent = `${records.length} fichas o relaciones · ${conformationLabel}.`;
  els.summaryHeader.innerHTML = `<strong>${escapeHtml(item.nivel_estructura)} · ${escapeHtml(item.estructura_nombre)}</strong><span>${escapeHtml(contextLine(item))}</span>`;

  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.seccion_codigo)) grouped.set(record.seccion_codigo, []);
    grouped.get(record.seccion_codigo).push(record);
  }

  const rows = CIRCUNSCRIPTION_SECTIONS
    .filter((section) => filterState.sections.has(section.code))
    .map((section) => {
      const sectionRecords = grouped.get(section.code) || [];
      if (!sectionRecords.length && section.code !== "D_AUTORIDADES_ELECTAS") return "";
      const heading = identifySections ? `
        <tr class="summary-section-row provincial-summary-section"><td colspan="4"><strong>${section.letter}. ${escapeHtml(section.title)}</strong><span>${escapeHtml(section.subtitle)} · ${escapeHtml(section.reference)}</span></td></tr>
      ` : "";

      if (section.code === "D_AUTORIDADES_ELECTAS") {
        const visibleSubsections = circunscriptionVisibleSubsections(filterState.conformation);
        const subsectionRows = CIRCUNSCRIPTION_SUBSECTIONS
          .filter((subsection) => visibleSubsections.has(subsection.code))
          .map((subsection) => {
            const subset = sectionRecords.filter((record) => record.subseccion_codigo === subsection.code);
            const subheading = identifySections ? `<tr class="summary-section-row"><td colspan="4"><strong>${subsection.label}. ${escapeHtml(subsection.title)}</strong><span>${escapeHtml(subsection.subtitle)}</span></td></tr>` : "";
            const dataRows = subset.map((record) => {
              const origin = record.es_relacion_automatica ? (record.origen_estructura_nombre || record.origen_territorio_codigo || "Relación automática") : "";
              const detail = [origin, record.periodo_electoral ? `Periodo ${record.periodo_electoral}` : "", record.rol_bloque || "", record.comentario || ""].filter(Boolean).join(" · ");
              return `<tr class="${record.es_relacion_automatica ? "zonal-summary-row" : ""}"><td>${escapeHtml(record.orden_en_seccion || record.orden_cargo || "")}</td><td><strong>${escapeHtml(circunscriptionDisplayCargo(record))}</strong>${detail ? `<small class="summary-detail">${escapeHtml(detail)}</small>` : ""}</td><td>${escapeHtml(record.nombre_completo || "")}</td><td>${escapeHtml(formatCedulaDisplay(record.cedula || ""))}</td></tr>`;
            }).join("");
            if (!subset.length && subsection.code === "D3_REGIDORES_VOCALES") {
              return subheading + '<tr><td colspan="4" class="loading">Subsección preparada; pendiente del inventario individual de regidores y vocales.</td></tr>';
            }
            return subheading + dataRows;
          }).join("");
        return heading + subsectionRows;
      }

      const dataRows = sectionRecords.map((record) => {
        const origin = record.es_relacion_automatica ? (record.origen_estructura_nombre || record.origen_territorio_codigo || "Relación automática") : "";
        const detail = [origin, record.comentario || ""].filter(Boolean).join(" · ");
        return `<tr class="${record.es_relacion_automatica ? "zonal-summary-row" : ""}"><td>${escapeHtml(record.orden_en_seccion || record.orden_cargo || "")}</td><td><strong>${escapeHtml(circunscriptionDisplayCargo(record))}</strong>${detail ? `<small class="summary-detail">${escapeHtml(detail)}</small>` : ""}</td><td>${escapeHtml(record.nombre_completo || "")}</td><td>${escapeHtml(formatCedulaDisplay(record.cedula || ""))}</td></tr>`;
      }).join("");
      return heading + dataRows;
    }).join("");

  els.summaryBody.innerHTML = rows || '<tr><td colspan="4" class="loading">No hay fichas en la selección.</td></tr>';
}

function renderZonalSummary() {
  const item = state.selectedStructure;
  const records = visibleStructureRecords();

  els.summaryTitle.textContent = item.estructura_nombre;
  els.summaryContext.textContent =
    "45 posiciones operativas · 12 Dirección Zonal + 33 fichas clasificables · vista resumida para revisión o impresión.";
  els.summaryHeader.innerHTML =
    `<strong>${escapeHtml(item.nivel_estructura)} · ${escapeHtml(item.estructura_nombre)}</strong>` +
    `<span>${escapeHtml(contextLine(item))}</span>`;

  const grouped = new Map();

  for (const record of records) {
    if (!grouped.has(record.seccion_codigo)) {
      grouped.set(record.seccion_codigo, []);
    }
    grouped.get(record.seccion_codigo).push(record);
  }

  const sections = [
    {
      code: "Z_DIRECCION_ZONAL",
      title: "DIRECCIÓN ZONAL",
      expected: 12
    },
    {
      code: "Z_MIEMBROS",
      title: "MIEMBROS",
      expected: 33
    }
  ];

  els.summaryBody.innerHTML = sections.map((section) => {
    const sectionRecords = (grouped.get(section.code) || [])
      .sort((a, b) => zonalVisualOrder(a) - zonalVisualOrder(b));

    const heading = `
      <tr class="summary-section-row">
        <td colspan="4">
          <strong>${escapeHtml(section.title)}</strong>
          <span>${sectionRecords.length} de ${section.expected} posiciones</span>
        </td>
      </tr>
    `;

    const rows = sectionRecords.map((record) => `
      <tr>
        <td>${escapeHtml(zonalDisplayNumber(record))}</td>
        <td><strong>${escapeHtml(zonalDisplayCargo(record))}</strong></td>
        <td>${escapeHtml(record.nombre_completo || "")}</td>
        <td>${escapeHtml(formatCedulaDisplay(record.cedula || ""))}</td>
      </tr>
    `).join("");

    return heading + rows;
  }).join("");
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

  if (isProvincialStructure()) {
    renderProvincialSummary();
    return;
  }
  if (isCircunscriptionStructure()) {
    renderCircunscriptionSummary();
    return;
  }

  if (isZonalStructure()) {
    renderZonalSummary();
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
      <td>${escapeHtml(formatCedulaDisplay(record.cedula || ""))}</td>
    </tr>
  `).join("");

  const zonalRows = authorityRows.length ? `
    <tr class="summary-section-row"><td colspan="4"><strong>Presidentes y secretarios generales de las zonas · solo lectura en esta vista</strong></td></tr>
    ${authorityRows.map(({ order, cargo, record }) => `
      <tr class="zonal-summary-row">
        <td>${order}</td>
        <td><strong>${escapeHtml(cargo)}</strong></td>
        <td>${escapeHtml(record?.nombre_completo || "VACANTE / SIN NOMBRE")}</td>
        <td>${escapeHtml(record?.cedula ? formatCedulaDisplay(record.cedula) : "SIN CÉDULA REGISTRADA")}</td>
      </tr>
    `).join("")}
  ` : "";

  els.summaryBody.innerHTML = regionalRows + zonalRows;
}

function openRecord(recordId) {
  const record = state.records.find((item) =>
    item.id_registro === recordId &&
    item.es_relacion_ex_oficio !== true &&
    (
      item.es_relacion_automatica !== true ||
      (
        isProvincialStructure() &&
        item.es_relacion_electiva === true
      )
    )
  );

  if (!record) {
    showMessage(
      "Esta relación se consulta aquí, pero no es editable desde este nivel.",
      "info"
    );
    return;
  }
  state.selectedRecord = record;
  hideLocalMessage(els.recordMessage);

  els.recordModalTitle.textContent = isZonalStructure()
    ? zonalDisplayCargo(record)
    : record.cargo;
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
    ["Sección",
      record.seccion_titulo
        ? (
            isZonalStructure()
              ? record.seccion_titulo
              : `${record.seccion_letra}. ${record.seccion_titulo}`
          )
        : null
    ],
    ["Subsección", record.subseccion_titulo ? `${record.subseccion_etiqueta || ""} ${record.subseccion_titulo}`.trim() : null],
    ["Base normativa", record.referencia_normativa],
    ["Cargo", isZonalStructure() ? zonalDisplayCargo(record) : circunscriptionDisplayCargo(record)],
    ["Número de ficha oficial", isZonalStructure() ? zonalDisplayNumber(record) : null],
    ["Posición visible", isZonalStructure() ? zonalPhysicalOrder(record) : null],
    ["Posición física preservada", isZonalStructure() ? record.orden_original : null],
    ["Territorio de origen", record.origen_estructura_nombre || record.origen_territorio_codigo],
    ["Tipo de autoridad", record.tipo_autoridad],
    ["Rol dentro del bloque", record.rol_bloque],
    ["Edición compartida",
      isProvincialStructure() && record.es_relacion_electiva === true
        ? "Provincia ↔ nivel de origen"
        : null
    ],
    ["Cupo habilitado",
      isProvincialStructure() &&
      record.tipo_relacion_electiva === "DIPUTADO_CIRCUNSCRIPCION"
        ? (record.cupo_habilitado === true ? "Sí" : "No")
        : null
    ],
    ["Tipo de ficha", record.es_ficha_adicional === true ? "Ficha adicional" : null],
    ["Cargo original preservado",
      isZonalStructure() &&
      record.cargo_original &&
      record.cargo_original !== zonalDisplayCargo(record)
        ? record.cargo_original
        : null
    ],
    ["Cargo histórico",
      !isZonalStructure() &&
      record.cargo_original &&
      record.cargo_original !== record.cargo
        ? record.cargo_original
        : null
    ]
  ].filter(([, value]) => value);

  els.recordProtectedFields.innerHTML = protectedFields.map(([label, value]) => `
    <div class="protected-item"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>
  `).join("");

  const recordEditable = canEditRecord(record);
  els.recordEditableFields.innerHTML = editableFieldsForSelectedStructure(record).map(([name, label, type]) => {
    const rawValue = record[name] || "";
    const value = name === "cedula"
      ? formatCedulaDisplay(rawValue)
      : rawValue;
    const full = type === "textarea" ? "full" : "";
    let input = "";

    if (type === "textarea") {
      input = `<textarea name="${name}" ${recordEditable ? "" : "disabled"}>${escapeHtml(value)}</textarea>`;
    } else if (type === "readonly" || name === "nombre_completo") {
      input = `<input
        name="${name}"
        type="text"
        value="${escapeHtml(value)}"
        readonly
        disabled
        aria-readonly="true"
        aria-disabled="true"
        tabindex="-1"
        autocomplete="off"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
        title="El nombre se obtiene automáticamente desde la base maestra."
        ${recordEditable ? "" : "disabled"}
      >`;
    } else if (type === "cedula" || name === "cedula") {
      input = `<input
        name="${name}"
        type="text"
        inputmode="numeric"
        maxlength="13"
        autocomplete="off"
        value="${escapeHtml(value)}"
        ${recordEditable ? "" : "disabled"}
      >`;
    } else {
      input = `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${recordEditable ? "" : "disabled"}>`;
    }

    return `<label class="field ${full}"><span>${escapeHtml(label)}</span>${input}</label>`;
  }).join("");

  state.identityLookup.sequence += 1;
  window.clearTimeout(state.identityLookup.timer);
  state.identityLookup.originalCedula = record.cedula || "";
  state.identityLookup.originalName = record.nombre_completo || "";
  state.identityLookup.verifiedCedula = "";
  state.identityLookup.verifiedName = "";
  state.identityLookup.userChangedCedula = false;

  bindRecordIdentityLookup();

  els.saveRecord.hidden = !recordEditable;
  els.recordModal.showModal();

  if (
    recordEditable &&
    record.subseccion_codigo !== "D1_DIPUTADOS_CIRCUNSCRIPCION" &&
    (
      record.es_ficha_adicional !== true ||
      record.es_relacion_electiva === true
    ) &&
    cedulaDigits(record.cedula).length === 11
  ) {
    resolveRecordNameByCedula({ silent: true });
  }
}

async function saveRecord(event) {
  event.preventDefault();
  if (!state.selectedRecord || !canEditRecord(state.selectedRecord)) return;

  hideLocalMessage(els.recordMessage);
  els.saveRecord.disabled = true;
  els.saveRecord.textContent = "Guardando…";

  const formData = new FormData(els.recordForm);
  const campos = {};

  // El navegador no envía nombre_completo. El backend es la única autoridad
  // para fijar el nombre según la cédula.
  for (const [name] of editableFieldsForSelectedStructure(state.selectedRecord)) {
    if (name === "cedula" || name === "nombre_completo") continue;
    campos[name] = cleanText(formData.get(name));
  }

  try {
    let updateRpc;

    if (
      isProvincialStructure() &&
      state.selectedRecord.es_relacion_electiva === true
    ) {
      updateRpc = "sigep_portal_actualizar_representacion_electiva_provincia";

    } else if (isCircunscriptionStructure()) {
      updateRpc = state.selectedRecord.subseccion_codigo === "D1_DIPUTADOS_CIRCUNSCRIPCION"
        ? "sigep_portal_actualizar_diputado_circunscripcion"
        : "sigep_portal_actualizar_ficha_circunscripcion";

    } else if (state.selectedRecord.es_ficha_adicional === true) {
      updateRpc = "sigep_portal_actualizar_ficha_adicional";

    } else {
      updateRpc = isProvincialStructure()
        ? "sigep_portal_actualizar_ficha_provincia"
        : "sigep_portal_actualizar_ficha";
    }

    const { data, error } = await supabase.rpc(
      updateRpc,
      {
        p_id_registro: state.selectedRecord.id_registro,
        p_cedula: cleanText(formData.get("cedula")),
        p_campos: campos
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.ok || !result?.registro) {
      throw new Error(
        result?.mensaje || "El backend no pudo actualizar la ficha."
      );
    }

    const updatedRecord = result.registro;
    const index = state.records.findIndex(
      (item) => item.id_registro === updatedRecord.id_registro
    );

    if (index >= 0) {
      state.records[index] = {
        ...state.records[index],
        ...updatedRecord
      };
      state.selectedRecord = state.records[index];
    }

    renderRecordCards();
    renderSummary();
    updateMetrics();

    showLocalMessage(
      els.recordMessage,
      "Ficha actualizada correctamente.",
      "success"
    );
    showMessage(
      isProvincialStructure() && state.selectedRecord?.es_relacion_electiva === true
        ? "La misma ficha física fue actualizada desde Provincia; el cambio se reflejará también en su nivel de origen."
        : "El backend validó la cédula, fijó el nombre oficial y registró los cambios.",
      "success"
    );

    setTimeout(() => els.recordModal.close(), 650);
  } catch (error) {
    showLocalMessage(
      els.recordMessage,
      error.message || "No se pudo guardar la ficha."
    );
  } finally {
    els.saveRecord.disabled = false;
    els.saveRecord.textContent = "Guardar cambios";
  }
}

async function assignZonalCargo(recordId, cargoCode, button = null) {
  if (!isZonalSelectorEnabled()) {
    throw new Error("La clasificación oficial solo está disponible para estructuras de nivel Zona.");
  }

  if (!canEditSelectedTerritory()) {
    throw new Error("No tiene permiso para editar esta Zona.");
  }

  const record = state.records.find((item) => item.id_registro === recordId);
  if (!record || record.selector_habilitado !== true) {
    throw new Error("La ficha seleccionada no admite clasificación oficial.");
  }

  const code = String(cargoCode || "").trim().toUpperCase();
  const catalogItem = zonalSelectorCatalog.find(
    (item) => String(item.cargo_selector_codigo || "").toUpperCase() === code
  );

  if (!catalogItem) {
    throw new Error("Seleccione un cargo válido del catálogo.");
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Asignando…";
  }

  try {
    const { data, error } = await supabase.rpc(
      ZONAL_SELECTOR_RPC,
      {
        p_id_registro: recordId,
        p_cargo_selector_codigo: code
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const status = String(result?.estado || "").toUpperCase();

    if (!["OK", "SIN_CAMBIOS"].includes(status)) {
      throw new Error(result?.mensaje || "El backend no pudo asignar el cargo.");
    }

    showMessage(
      status === "SIN_CAMBIOS"
        ? "La ficha ya tenía ese cargo asignado."
        : "Cargo oficial asignado. La persona y sus datos permanecen en la misma ficha.",
      "success",
      6500
    );

    const structureCode = state.selectedStructure?.estructura_codigo;
    if (structureCode && isZonalStructure()) {
      await selectStructure(structureCode);
    }

    return result;
  } catch (error) {
    const message = String(error?.message || "No se pudo asignar el cargo.");

    if (message.includes("CARGO_YA_ASIGNADO")) {
      throw new Error("Ese cargo ya está asignado a otra ficha de esta Zona.");
    }
    if (message.includes("SIN_PERMISO_PARA_EDITAR_ZONA")) {
      throw new Error("No tiene permiso para editar esta Zona.");
    }
    if (message.includes("NUMERO_OFICIAL_OCUPADO_POR_OTRO_CARGO")) {
      throw new Error("El número oficial está reservado por otro cargo ya clasificado.");
    }

    throw error;
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = "Asignar";
    }
  }
}

function exportSummaryCsv() {
  const records = isProvincialStructure()
    ? provincialFilteredRecords()
    : (isCircunscriptionStructure() ? circunscriptionFilteredRecords() : visibleStructureRecords());
  if (!state.selectedStructure || !records.length) {
    showMessage("Seleccione una estructura antes de exportar.");
    return;
  }

  const provincial = isProvincialStructure();
  const circunscription = isCircunscriptionStructure();
  const zonal = isZonalStructure();
  const organized = provincial || circunscription;

  const rows = zonal
    ? [
        ["SECCION", "ORDEN", "CARGO", "NOMBRE COMPLETO", "CEDULA"],
        ...records.map((record) => [
          record.seccion_titulo || "",
          zonalDisplayNumber(record),
          zonalDisplayCargo(record),
          record.nombre_completo || "",
          formatCedulaDisplay(record.cedula || "")
        ])
      ]
    : organized
    ? [
        ["SECCION", "SUBSECCION", "ORDEN", "CARGO", "NOMBRE COMPLETO", "CEDULA", "ORIGEN", "PERIODO", "ROL BLOQUE", "COMENTARIO"],
        ...records.map((record) => [
          `${record.seccion_letra}. ${record.seccion_titulo}`,
          record.subseccion_etiqueta ? `${record.subseccion_etiqueta}. ${record.subseccion_titulo}` : "",
          record.orden_en_seccion || record.orden_cargo,
          circunscription ? circunscriptionDisplayCargo(record) : record.cargo,
          record.nombre_completo || "",
          formatCedulaDisplay(record.cedula || ""),
          record.es_relacion_electiva === true
            ? `FICHA VINCULADA · ${record.origen_estructura_nombre || record.origen_territorio_codigo || "NIVEL DE ORIGEN"}`
            : ((record.es_relacion_ex_oficio || record.es_relacion_automatica)
                ? (record.origen_estructura_nombre || record.origen_territorio_codigo || "RELACION AUTOMATICA")
                : (record.es_ficha_adicional
                    ? "FICHA ADICIONAL"
                    : (provincial ? "FICHA PROVINCIAL" : "FICHA DE CIRCUNSCRIPCION"))),
          record.periodo_electoral || "",
          record.rol_bloque || "",
          record.comentario || ""
        ])
      ]
    : [
        ["ORDEN", "CARGO", "NOMBRE COMPLETO", "CEDULA", "ORIGEN"],
        ...records.map((record) => [
          isRegionalStructure() ? regionalVisualOrder(record) : record.orden_cargo,
          record.cargo, record.nombre_completo || "", formatCedulaDisplay(record.cedula || ""),
          isRegionalStructure() ? "DIRECCION REGIONAL" : "ESTRUCTURA"
        ])
      ];

  if (isRegionalStructure()) {
    state.zonalAuthorities.forEach(({ zone, president, secretary }, index) => {
      rows.push([22 + index * 2, `${zone.estructura_nombre} · Presidente(a) zonal`, president?.nombre_completo || "VACANTE / SIN NOMBRE", formatCedulaDisplay(president?.cedula || ""), "ZONA · SOLO LECTURA"]);
      rows.push([23 + index * 2, `${zone.estructura_nombre} · Secretario(a) General zonal`, secretary?.nombre_completo || "VACANTE / SIN NOMBRE", formatCedulaDisplay(secretary?.cedula || ""), "ZONA · SOLO LECTURA"]);
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

  const availableTerritories = assignmentType === "REGIONAL"
    ? state.assignableTerritories.filter((item) => getRegionalMunicipalityCodes().has(item.codigo))
    : (assignmentType === "CIRCUNSCRIPCION"
      ? state.assignableTerritories.filter((item) => String(item.tipo || "").trim().toUpperCase() === "CIRCUNSCRIPCION")
      : state.assignableTerritories);

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
  const isCircunscription = assignmentType === "CIRCUNSCRIPCION";

  els.regionField.hidden = !isRegional;
  els.regionSelect.required = isRegional;
  els.territoryFieldLabel.textContent = isRegional
    ? "Municipio inicial"
    : (isCircunscription ? "Circunscripción" : "Territorio inicial");

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
    '<tr><td colspan="5" class="loading">Cargando usuarios y autorizaciones…</td></tr>';

  const { data, error } = await supabase.rpc(
    "sigep_admin_listar_autorizaciones_usuarios"
  );

  if (error) throw error;

  const payload = normalizeRpcPayload(data);
  if (!payload || payload.ok !== true) {
    throw new Error(
      payload?.mensaje ||
      payload?.codigo_resultado ||
      "No fue posible cargar las autorizaciones."
    );
  }

  state.assignableTerritories = payload.territorios || [];
  state.users = payload.usuarios || [];
  state.allAssignments = payload.asignaciones_territoriales || [];
  state.allRegionalAssignments = payload.asignaciones_regionales || [];
  state.regionalStructures = payload.regiones || [];
  state.allPrincipals = payload.alcances_principales || [];

  updateCreateUserAssignmentFields();
  renderCoverage();
  renderUsers();
}

function renderCoverage() {
  const ordinaryUsers = state.users.filter((user) => user.rol === "USUARIO");
  const activeUsers = ordinaryUsers.filter((user) => user.activo);
  const withAdditional = ordinaryUsers.filter((user) => {
    const principal = principalForUser(user.id);
    if (!principal) return false;
    const principalKey = authorizationKey(
      principal.tipo_alcance,
      principal.territorio_codigo,
      principal.region || ""
    );
    return userAuthorizationRows(user.id).some(
      (scope) =>
        authorizationKey(
          scope.tipo_alcance,
          scope.territorio_codigo,
          scope.region || ""
        ) !== principalKey
    );
  }).length;

  const approvers = ordinaryUsers.filter((user) =>
    userAuthorizationRows(user.id).some((scope) => scope.puede_aprobar)
  ).length;

  const inactiveWithAccess = ordinaryUsers.filter(
    (user) => !user.activo && userAuthorizationRows(user.id).length > 0
  ).length;

  const territoryByCode = new Map(
    state.assignableTerritories.map((item) => [item.codigo, item])
  );

  const summary = `
    <section class="authorization-summary-grid">
      <article class="authorization-summary-card">
        <span>Usuarios activos</span><strong>${activeUsers.length}</strong>
      </article>
      <article class="authorization-summary-card warning">
        <span>Con asignaciones adicionales</span><strong>${withAdditional}</strong>
      </article>
      <article class="authorization-summary-card">
        <span>Con capacidad de aprobar</span><strong>${approvers}</strong>
      </article>
      <article class="authorization-summary-card ${inactiveWithAccess ? "danger" : ""}">
        <span>Inactivos con autorizaciones</span><strong>${inactiveWithAccess}</strong>
      </article>
    </section>
  `;

  const coverage = state.assignableTerritories.map((territory) => {
    const assignedUsers = ordinaryUsers.filter((user) =>
      state.allAssignments.some(
        (assignment) =>
          assignment.usuario_id === user.id &&
          assignment.territorio_codigo === territory.codigo &&
          assignment.activo !== false &&
          assignment.puede_ver === true
      )
    );

    const approvalUsers = assignedUsers.filter((user) =>
      state.allAssignments.some(
        (assignment) =>
          assignment.usuario_id === user.id &&
          assignment.territorio_codigo === territory.codigo &&
          assignment.activo !== false &&
          assignment.puede_aprobar === true
      )
    );

    const principals = assignedUsers.filter((user) => {
      const principal = principalForUser(user.id);
      return (
        principal?.tipo_alcance === "TERRITORIO" &&
        principal.territorio_codigo === territory.codigo
      );
    });

    return `
      <article class="coverage-card">
        <strong>${escapeHtml(territory.nombre)}</strong>
        <span>${assignedUsers.length} usuario${assignedUsers.length === 1 ? "" : "s"} · ${principals.length} principal${principals.length === 1 ? "" : "es"} · ${approvalUsers.length} aprobador${approvalUsers.length === 1 ? "" : "es"}</span>
        <div class="coverage-user-list">
          ${assignedUsers.map((user) => `
            <small>${escapeHtml(user.nombre_completo || user.usuario_login)}</small>
          `).join("") || '<small class="muted">Sin usuario asignado</small>'}
        </div>
      </article>
    `;
  }).join("");

  els.territoryCoverage.innerHTML = summary + `
    <section class="authorization-coverage-section">
      <div class="authorization-section-title">
        <h3>Cobertura por territorio</h3>
        <p>La región se administra dentro de “Administrar autorizaciones” de cada usuario.</p>
      </div>
      <div class="coverage-grid">${coverage}</div>
    </section>
  `;
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

  els.usersBody.innerHTML = users.map((user) => {
    const isSelf = user.id === state.user.id;
    const scopes = userAuthorizationRows(user.id);
    const principal = principalForUser(user.id);
    const principalKey = principal
      ? authorizationKey(
          principal.tipo_alcance,
          principal.territorio_codigo,
          principal.region || ""
        )
      : null;

    const principalScope = scopes.find(
      (scope) =>
        authorizationKey(
          scope.tipo_alcance,
          scope.territorio_codigo,
          scope.region || ""
        ) === principalKey
    );

    const additionalScopes = scopes.filter(
      (scope) =>
        authorizationKey(
          scope.tipo_alcance,
          scope.territorio_codigo,
          scope.region || ""
        ) !== principalKey
    );

    const principalChip = principalScope
      ? `
        <span class="territory-chip authorization-principal">
          <b>Principal</b> · ${escapeHtml(scopeDisplayName(principalScope, territoryByCode))}
          · ${escapeHtml(capabilityLabel(principalScope))}
        </span>
      `
      : user.rol === "ADMINISTRADOR"
        ? '<span class="territory-chip authorization-principal">Administración general</span>'
        : '<span class="territory-chip authorization-missing">Sin alcance principal</span>';

    const additionalChips = additionalScopes.map(
      (scope) => `
        <span class="territory-chip authorization-additional">
          ⚠ Adicional / transitoria · ${escapeHtml(
            scopeDisplayName(scope, territoryByCode)
          )} · ${escapeHtml(capabilityLabel(scope))}
        </span>
      `
    ).join("");

    const approvalCount = scopes.filter((scope) => scope.puede_aprobar).length;

    return `
      <tr class="${additionalScopes.length ? "user-has-additional" : ""}">
        <td class="user-name-cell">
          <strong>${escapeHtml(user.nombre_completo || user.usuario_login)}</strong>
          <small>@${escapeHtml(user.usuario_login)}${
            user.debe_cambiar_contrasena
              ? " · cambio de contraseña pendiente"
              : ""
          }</small>
          ${additionalScopes.length
            ? `<small class="authorization-alert-text">⚠ ${additionalScopes.length} autorización${additionalScopes.length === 1 ? "" : "es"} adicional${additionalScopes.length === 1 ? "" : "es"} para revisión.</small>`
            : ""}
        </td>
        <td>
          <select class="role-select user-role-select" data-user-id="${user.id}" ${
            isSelf ? "disabled" : ""
          }>
            <option value="USUARIO" ${user.rol === "USUARIO" ? "selected" : ""}>USUARIO</option>
            <option value="ADMINISTRADOR" ${user.rol === "ADMINISTRADOR" ? "selected" : ""}>ADMINISTRADOR</option>
          </select>
          ${approvalCount
            ? `<small class="approval-capability">${approvalCount} alcance${approvalCount === 1 ? "" : "s"} con aprobación</small>`
            : ""}
        </td>
        <td>
          <div class="territory-chips">
            ${principalChip}
            ${additionalChips}
          </div>
        </td>
        <td>
          <span class="status ${user.activo ? "active" : "inactive"}">${
            user.activo ? "Activo" : "Inactivo"
          }</span>
          <small class="muted">${
            user.ultimo_acceso
              ? `Último acceso: ${escapeHtml(formatDate(user.ultimo_acceso))}`
              : "Sin acceso registrado"
          }</small>
        </td>
        <td>
          <div class="actions">
            <button class="button ghost small user-permissions" data-user-id="${user.id}" type="button" ${
              user.rol === "ADMINISTRADOR" ? "disabled" : ""
            }>Administrar autorizaciones</button>
            <button class="button ghost small user-password" data-user-id="${user.id}" type="button">Contraseña</button>
            <button class="button secondary small user-toggle" data-user-id="${user.id}" data-active="${user.activo}" type="button" ${
              isSelf ? "disabled" : ""
            }>${user.activo ? "Desactivar" : "Activar"}</button>
            <button class="button danger small user-delete" data-user-id="${user.id}" type="button" ${
              isSelf ? "disabled" : ""
            }>Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
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
  const canApprove = formData.get("puede_aprobar") === "on";
  const region = String(formData.get("region") || "");
  const userLogin = String(formData.get("usuario_login") || "").trim();

  try {
    const payload = {
      action: "create_user",
      usuario_login: userLogin,
      nombre_completo: String(
        formData.get("nombre_completo") || ""
      ).trim(),
      contrasena: String(formData.get("contrasena") || ""),
      tipo_asignacion:
        assignmentType === "CIRCUNSCRIPCION"
          ? "TERRITORIAL"
          : assignmentType
    };

    if (assignmentType === "REGIONAL") {
      payload.territorio_codigo = territoryCode;
      payload.region = region;
      payload.puede_ver = true;
      payload.puede_editar = canEdit;
    } else {
      payload.territorios = territoryCode
        ? [{
            territorio_codigo: territoryCode,
            puede_ver: true,
            puede_editar: canEdit
          }]
        : [];
    }

    const result = await invokeAuthenticatedFunction(
      adminFunctionUrl,
      payload
    );

    let createdUserId =
      result?.usuario?.id ||
      result?.usuario?.usuario_id ||
      result?.usuario_id ||
      null;

    if (!createdUserId) {
      const { data: createdProfile, error: createdProfileError } =
        await supabase
          .from("perfiles")
          .select("id")
          .eq("usuario_login_normalizado", userLogin.toLowerCase())
          .single();

      if (createdProfileError) throw createdProfileError;
      createdUserId = createdProfile?.id;
    }

    if (!createdUserId) {
      throw new Error(
        "El usuario fue creado, pero no fue posible registrar su alcance principal."
      );
    }

    const authorization = assignmentType === "REGIONAL"
      ? {
          tipo_alcance: "REGION",
          territorio_codigo: territoryCode,
          region,
          puede_ver: true,
          puede_editar: canEdit,
          puede_aprobar: canApprove
        }
      : {
          tipo_alcance: "TERRITORIO",
          territorio_codigo: territoryCode,
          region: null,
          puede_ver: true,
          puede_editar: canEdit,
          puede_aprobar: canApprove
        };

    const principal = {
      tipo_alcance: authorization.tipo_alcance,
      territorio_codigo: authorization.territorio_codigo,
      region: authorization.region
    };

    const { data: authorizationResult, error: authorizationError } =
      await supabase.rpc(
        "sigep_admin_guardar_autorizaciones_usuario",
        {
          p_usuario_id: createdUserId,
          p_autorizaciones: [authorization],
          p_principal: principal,
          p_motivo: "Asignación inicial al crear el usuario."
        }
      );

    if (authorizationError) throw authorizationError;

    const authorizationPayload = normalizeRpcPayload(authorizationResult);
    if (!authorizationPayload || authorizationPayload.ok !== true) {
      throw new Error(
        authorizationPayload?.mensaje ||
        "No fue posible guardar el alcance inicial."
      );
    }

    const selectedTerritoryName =
      state.assignableTerritories.find(
        (item) => item.codigo === territoryCode
      )?.nombre || territoryCode;

    const assignmentMessage = assignmentType === "REGIONAL"
      ? ` como responsable de la Región ${region}`
      : ` para ${selectedTerritoryName}`;

    showLocalMessage(
      els.createUserMessage,
      `Usuario ${result.usuario.usuario_login} creado correctamente${assignmentMessage}.`,
      "success"
    );

    els.createUserForm.reset();
    els.assignmentType.value = "TERRITORIAL";
    els.createUserForm.elements.puede_ver.checked = true;
    els.createUserForm.elements.puede_editar.checked = true;
    if (els.createUserForm.elements.puede_aprobar) {
      els.createUserForm.elements.puede_aprobar.checked = false;
    }
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
  state.selectedPermissionType = "ACUMULATIVO";
  hideLocalMessage(els.permissionsMessage);

  els.permissionsTitle.textContent = `Autorizaciones de ${
    user.nombre_completo || user.usuario_login
  }`;
  els.permissionsDescription.textContent =
    "Marque un único alcance principal. Todo alcance activo distinto del principal será identificado en rojo como adicional o transitorio.";

  const territoryByCode = new Map(
    state.assignableTerritories.map((item) => [item.codigo, item])
  );

  const assignmentMap = new Map(
    state.allAssignments
      .filter((item) => item.usuario_id === userId)
      .map((item) => [
        authorizationKey("TERRITORIO", item.territorio_codigo, ""),
        item
      ])
  );

  const regionalAssignmentMap = new Map(
    state.allRegionalAssignments
      .filter((item) => item.usuario_id === userId)
      .map((item) => [
        authorizationKey("REGION", item.territorio_codigo, item.region),
        item
      ])
  );

  const principal = principalForUser(userId);
  const principalKey = principal
    ? authorizationKey(
        principal.tipo_alcance,
        principal.territorio_codigo,
        principal.region || ""
      )
    : null;

  const territoryGroups = [
    ["PROVINCIA", "Provincia"],
    ["CIRCUNSCRIPCION", "Circunscripciones"],
    ["MUNICIPIO", "Municipios"],
    ["DISTRITO MUNICIPAL", "Distritos municipales"]
  ];

  const territorialHtml = territoryGroups.map(([type, title]) => {
    const territories = state.assignableTerritories.filter(
      (item) => String(item.tipo || "").trim().toUpperCase() === type
    );

    if (!territories.length) return "";

    return `
      <tr class="permission-section-row">
        <td colspan="5"><strong>${escapeHtml(title)}</strong></td>
      </tr>
      ${territories.map((territory) => {
        const key = authorizationKey("TERRITORIO", territory.codigo, "");
        const assignment = assignmentMap.get(key);
        const canView = assignment?.puede_ver === true;
        const canEdit = assignment?.puede_editar === true;
        const canApprove = assignment?.puede_aprobar === true;
        const isPrincipal = key === principalKey;
        const isAdditional = canView && !isPrincipal;

        return `
          <tr
            class="permission-row ${isAdditional ? "is-additional" : ""}"
            data-scope-type="TERRITORIO"
            data-territory-code="${escapeHtml(territory.codigo)}"
            data-region=""
          >
            <td>
              <strong>${escapeHtml(territory.nombre)}</strong>
              <small class="${isAdditional ? "authorization-alert-text" : "muted"}">
                ${isPrincipal
                  ? "Alcance principal"
                  : isAdditional
                    ? "⚠ Autorización adicional / transitoria"
                    : escapeHtml(territory.tipo)}
              </small>
            </td>
            <td><input class="permission-primary" name="principal-scope" type="radio" ${isPrincipal ? "checked" : ""}></td>
            <td><input class="permission-view" type="checkbox" ${canView ? "checked" : ""}></td>
            <td><input class="permission-edit" type="checkbox" ${canEdit ? "checked" : ""} ${canView ? "" : "disabled"}></td>
            <td><input class="permission-approve" type="checkbox" ${canApprove ? "checked" : ""} ${canView ? "" : "disabled"}></td>
          </tr>
        `;
      }).join("")}
    `;
  }).join("");

  const regionalHtml = state.regionalStructures.length
    ? `
      <tr class="permission-section-row">
        <td colspan="5"><strong>Regiones</strong></td>
      </tr>
      ${state.regionalStructures.map((regionStructure) => {
        const key = authorizationKey(
          "REGION",
          regionStructure.territorio_codigo,
          regionStructure.region
        );
        const assignment = regionalAssignmentMap.get(key);
        const canView = assignment?.puede_ver === true;
        const canEdit = assignment?.puede_editar === true;
        const canApprove = assignment?.puede_aprobar === true;
        const isPrincipal = key === principalKey;
        const isAdditional = canView && !isPrincipal;
        const territoryName =
          territoryByCode.get(regionStructure.territorio_codigo)?.nombre ||
          regionStructure.municipio ||
          regionStructure.territorio_codigo;

        return `
          <tr
            class="permission-row ${isAdditional ? "is-additional" : ""}"
            data-scope-type="REGION"
            data-territory-code="${escapeHtml(regionStructure.territorio_codigo)}"
            data-region="${escapeHtml(regionStructure.region)}"
          >
            <td>
              <strong>${escapeHtml(territoryName)} · Región ${escapeHtml(regionStructure.region)}</strong>
              <small class="${isAdditional ? "authorization-alert-text" : "muted"}">
                ${isPrincipal
                  ? "Alcance principal"
                  : isAdditional
                    ? "⚠ Autorización adicional / transitoria"
                    : "Asignación regional"}
              </small>
            </td>
            <td><input class="permission-primary" name="principal-scope" type="radio" ${isPrincipal ? "checked" : ""}></td>
            <td><input class="permission-view" type="checkbox" ${canView ? "checked" : ""}></td>
            <td><input class="permission-edit" type="checkbox" ${canEdit ? "checked" : ""} ${canView ? "" : "disabled"}></td>
            <td><input class="permission-approve" type="checkbox" ${canApprove ? "checked" : ""} ${canView ? "" : "disabled"}></td>
          </tr>
        `;
      }).join("")}
    `
    : "";

  els.permissionsBody.innerHTML = territorialHtml + regionalHtml;
  els.permissionsModal.showModal();
}

async function savePermissions() {
  if (!state.selectedUserId) return;

  hideLocalMessage(els.permissionsMessage);
  els.savePermissions.disabled = true;
  els.savePermissions.textContent = "Guardando…";

  const rows = [
    ...els.permissionsBody.querySelectorAll("tr.permission-row")
  ];

  try {
    const principalRow = rows.find(
      (row) => row.querySelector(".permission-primary")?.checked
    );

    if (!principalRow) {
      throw new Error("Seleccione un alcance principal.");
    }

    const authorizations = rows.map((row) => {
      const view = row.querySelector(".permission-view")?.checked === true;
      const edit = row.querySelector(".permission-edit")?.checked === true;
      const approve =
        row.querySelector(".permission-approve")?.checked === true;
      const principal =
        row.querySelector(".permission-primary")?.checked === true;

      return {
        tipo_alcance: row.dataset.scopeType,
        territorio_codigo: row.dataset.territoryCode,
        region: row.dataset.region || null,
        puede_ver: view || edit || approve || principal,
        puede_editar: edit,
        puede_aprobar: approve
      };
    }).filter((item) => item.puede_ver);

    const principal = {
      tipo_alcance: principalRow.dataset.scopeType,
      territorio_codigo: principalRow.dataset.territoryCode,
      region: principalRow.dataset.region || null
    };

    const { data, error } = await supabase.rpc(
      "sigep_admin_guardar_autorizaciones_usuario",
      {
        p_usuario_id: state.selectedUserId,
        p_autorizaciones: authorizations,
        p_principal: principal,
        p_motivo:
          "Actualización desde Usuarios, autorizaciones y aprobaciones."
      }
    );

    if (error) throw error;

    const payload = normalizeRpcPayload(data);
    if (!payload || payload.ok !== true) {
      throw new Error(
        payload?.mensaje ||
        payload?.codigo_resultado ||
        "No se pudieron guardar las autorizaciones."
      );
    }

    showLocalMessage(
      els.permissionsMessage,
      "Autorizaciones actualizadas y registradas en auditoría.",
      "success"
    );

    await loadAdminData();
    setTimeout(() => els.permissionsModal.close(), 700);
  } catch (error) {
    showLocalMessage(
      els.permissionsMessage,
      error.message || "No se pudieron guardar las autorizaciones."
    );
  } finally {
    els.savePermissions.disabled = false;
    els.savePermissions.textContent = "Guardar autorizaciones";
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

function updateProvincialPrintCount() {
  if (!els.provincialPrintSections || !els.provincialPrintCount) return;
  const sections = selectedCheckboxValues(els.provincialPrintSections);
  const conformation = els.provincialPrintConformation.value;
  const count = state.records
    .filter((record) => sections.has(record.seccion_codigo))
    .filter((record) => matchesProvincialConformation(record, conformation))
    .length;
  els.provincialPrintCount.textContent = `${count} elemento${count === 1 ? "" : "s"} seleccionado${count === 1 ? "" : "s"}.`;
  els.confirmProvincialPrint.disabled = count === 0;
}

function openProvincialPrintOptions() {
  for (const input of els.provincialPrintSections.querySelectorAll('input[type="checkbox"]')) {
    input.checked = state.provincialFilters.sections.has(input.value);
  }
  els.provincialPrintConformation.value = state.provincialFilters.conformation;
  els.provincialPrintIdentify.checked = true;
  updateProvincialPrintCount();
  els.provincialPrintModal.showModal();
}

function executeProvincialPrint() {
  const sections = selectedCheckboxValues(els.provincialPrintSections);
  if (!sections.size) {
    showMessage("Seleccione al menos una sección para imprimir.");
    return;
  }
  state.provincialPrint = {
    active: true,
    sections,
    conformation: els.provincialPrintConformation.value,
    identifySections: els.provincialPrintIdentify.checked
  };
  renderSummary();
  els.provincialPrintModal.close();
  window.setTimeout(() => window.print(), 120);
}

function updateCircunscriptionPrintCount() {
  if (!els.circunscriptionPrintSections || !els.circunscriptionPrintCount) return;
  const sections = selectedCheckboxValues(els.circunscriptionPrintSections);
  const conformation = els.circunscriptionPrintConformation.value;
  const count = state.records
    .filter((record) => sections.has(record.seccion_codigo))
    .filter((record) => matchesCircunscriptionConformation(record, conformation))
    .length;
  els.circunscriptionPrintCount.textContent = `${count} elemento${count === 1 ? "" : "s"} seleccionado${count === 1 ? "" : "s"}.`;
  els.confirmCircunscriptionPrint.disabled = count === 0 && conformation !== "REGIDORES_VOCALES";
}

function openCircunscriptionPrintOptions() {
  for (const input of els.circunscriptionPrintSections.querySelectorAll('input[type="checkbox"]')) {
    input.checked = state.circunscriptionFilters.sections.has(input.value);
  }
  els.circunscriptionPrintConformation.value = state.circunscriptionFilters.conformation;
  els.circunscriptionPrintIdentify.checked = true;
  updateCircunscriptionPrintCount();
  els.circunscriptionPrintModal.showModal();
}

function executeCircunscriptionPrint() {
  const sections = selectedCheckboxValues(els.circunscriptionPrintSections);
  if (!sections.size) { showMessage("Seleccione al menos una sección para imprimir."); return; }
  state.circunscriptionPrint = {
    active: true,
    sections,
    conformation: els.circunscriptionPrintConformation.value,
    identifySections: els.circunscriptionPrintIdentify.checked
  };
  renderSummary();
  els.circunscriptionPrintModal.close();
  window.setTimeout(() => window.print(), 120);
}

function circunscriptionNumber() {
  const digits = String(state.selectedStructure?.circunscripcion || "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function renderCircunscriptionDeputyAdmin() {
  if (!els.circunscriptionDeputyAdmin || !els.circunscriptionDeputySlots) return;
  const visible = state.isAdmin && isCircunscriptionStructure();
  els.circunscriptionDeputyAdmin.hidden = !visible;
  if (!visible) return;

  const number = circunscriptionNumber();
  const capacity = CIRCUNSCRIPTION_DEPUTY_CAPACITY.get(number) || 0;
  const activeByOrder = new Map(
    state.records
      .filter((record) => record.subseccion_codigo === "D1_DIPUTADOS_CIRCUNSCRIPCION")
      .map((record) => [Number(record.orden_en_seccion || record.orden_cargo), record])
  );

  els.circunscriptionDeputySlots.innerHTML = Array.from({ length: capacity }, (_, index) => {
    const order = index + 1;
    const record = activeByOrder.get(order);
    const active = Boolean(record);
    const occupied = Boolean(record?.nombre_completo || record?.cedula);
    return `<button class="button ${active ? "secondary" : "ghost"} small" type="button" data-circ-deputy-order="${order}" data-circ-deputy-enable="${active ? "false" : "true"}" ${occupied ? "disabled" : ""}>Cupo ${order} · ${active ? (occupied ? "Ocupado" : "Retirar") : "Habilitar"}</button>`;
  }).join("");
}

async function toggleCircunscriptionDeputySlot(order, enable) {
  if (!state.isAdmin || !isCircunscriptionStructure()) return;
  const { data, error } = await supabase.rpc("sigep_admin_habilitar_diputado_circunscripcion", {
    p_estructura_codigo: state.selectedStructure.estructura_codigo,
    p_orden: Number(order),
    p_habilitar: Boolean(enable)
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.ok) throw new Error(result?.mensaje || "No se pudo actualizar el cupo de diputado.");
  showMessage(result.mensaje || "Cupo de diputado actualizado.", "success");
  await selectStructure(state.selectedStructure.estructura_codigo);
}

function bindCircunscriptionInterface() {
  els.circunscriptionSectionFilters?.addEventListener("change", () => {
    state.circunscriptionFilters.sections = selectedCheckboxValues(els.circunscriptionSectionFilters);
    renderRecordCards(); renderSummary(); updateMetrics();
  });
  els.circunscriptionConformationFilter?.addEventListener("change", () => {
    state.circunscriptionFilters.conformation = els.circunscriptionConformationFilter.value;
    for (const input of els.circunscriptionSectionFilters.querySelectorAll('input[type="checkbox"]')) input.checked = true;
    state.circunscriptionFilters.sections = new Set(CIRCUNSCRIPTION_SECTIONS.map((section) => section.code));
    renderRecordCards(); renderSummary(); updateMetrics();
  });
  els.circunscriptionSelectAll?.addEventListener("click", () => {
    for (const input of els.circunscriptionSectionFilters.querySelectorAll('input[type="checkbox"]')) input.checked = true;
    state.circunscriptionFilters.sections = new Set(CIRCUNSCRIPTION_SECTIONS.map((section) => section.code));
    state.circunscriptionFilters.conformation = "ESTRUCTURA_COMPLETA";
    els.circunscriptionConformationFilter.value = "ESTRUCTURA_COMPLETA";
    renderRecordCards(); renderSummary(); updateMetrics();
  });
  els.circunscriptionSelectNone?.addEventListener("click", () => {
    for (const input of els.circunscriptionSectionFilters.querySelectorAll('input[type="checkbox"]')) input.checked = false;
    state.circunscriptionFilters.sections = new Set();
    state.circunscriptionFilters.conformation = "ESTRUCTURA_COMPLETA";
    els.circunscriptionConformationFilter.value = "ESTRUCTURA_COMPLETA";
    renderRecordCards(); renderSummary(); updateMetrics();
  });
  els.circunscriptionPrintSections?.addEventListener("change", updateCircunscriptionPrintCount);
  els.circunscriptionPrintConformation?.addEventListener("change", updateCircunscriptionPrintCount);
  els.circPrintSelectAll?.addEventListener("click", () => { for (const input of els.circunscriptionPrintSections.querySelectorAll('input[type="checkbox"]')) input.checked = true; updateCircunscriptionPrintCount(); });
  els.circPrintSelectNone?.addEventListener("click", () => { for (const input of els.circunscriptionPrintSections.querySelectorAll('input[type="checkbox"]')) input.checked = false; updateCircunscriptionPrintCount(); });
  els.confirmCircunscriptionPrint?.addEventListener("click", executeCircunscriptionPrint);
  els.closeCircunscriptionPrint?.addEventListener("click", () => els.circunscriptionPrintModal.close());
  els.cancelCircunscriptionPrint?.addEventListener("click", () => els.circunscriptionPrintModal.close());
  els.circunscriptionDeputySlots?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-circ-deputy-order]");
    if (!button) return;
    button.disabled = true;
    try { await toggleCircunscriptionDeputySlot(button.dataset.circDeputyOrder, button.dataset.circDeputyEnable === "true"); }
    catch (error) { showMessage(error.message || "No se pudo actualizar el cupo de diputado."); renderCircunscriptionDeputyAdmin(); }
  });
  window.addEventListener("afterprint", () => {
    if (!state.circunscriptionPrint.active) return;
    state.circunscriptionPrint.active = false;
    renderSummary();
  });
}

function bindProvincialInterface() {
  els.provincialSectionFilters?.addEventListener("change", () => {
    state.provincialFilters.sections = selectedCheckboxValues(els.provincialSectionFilters);
    rerenderProvincialViews();
  });
  els.provincialConformationFilter?.addEventListener("change", () => {
    state.provincialFilters.conformation = els.provincialConformationFilter.value;
    // Una conformación debe mostrar todos sus integrantes aunque antes se hubiera
    // seleccionado una sola sección. Luego el usuario puede volver a refinar.
    for (const input of els.provincialSectionFilters.querySelectorAll('input[type="checkbox"]')) input.checked = true;
    state.provincialFilters.sections = new Set(PROVINCIAL_SECTIONS.map((section) => section.code));
    rerenderProvincialViews();
  });
  els.provincialSelectAll?.addEventListener("click", () => {
    for (const input of els.provincialSectionFilters.querySelectorAll('input[type="checkbox"]')) input.checked = true;
    state.provincialFilters.sections = new Set(PROVINCIAL_SECTIONS.map((section) => section.code));
    state.provincialFilters.conformation = "ESTRUCTURA_COMPLETA";
    els.provincialConformationFilter.value = "ESTRUCTURA_COMPLETA";
    rerenderProvincialViews();
  });
  els.provincialSelectNone?.addEventListener("click", () => {
    for (const input of els.provincialSectionFilters.querySelectorAll('input[type="checkbox"]')) input.checked = false;
    state.provincialFilters.sections = new Set();
    state.provincialFilters.conformation = "ESTRUCTURA_COMPLETA";
    els.provincialConformationFilter.value = "ESTRUCTURA_COMPLETA";
    rerenderProvincialViews();
  });

  els.provincialPrintSections?.addEventListener("change", updateProvincialPrintCount);
  els.provincialPrintConformation?.addEventListener("change", updateProvincialPrintCount);
  els.printSelectAll?.addEventListener("click", () => {
    for (const input of els.provincialPrintSections.querySelectorAll('input[type="checkbox"]')) input.checked = true;
    updateProvincialPrintCount();
  });
  els.printSelectNone?.addEventListener("click", () => {
    for (const input of els.provincialPrintSections.querySelectorAll('input[type="checkbox"]')) input.checked = false;
    updateProvincialPrintCount();
  });
  els.confirmProvincialPrint?.addEventListener("click", executeProvincialPrint);
  els.closeProvincialPrint?.addEventListener("click", () => els.provincialPrintModal.close());
  els.cancelProvincialPrint?.addEventListener("click", () => els.provincialPrintModal.close());

  window.addEventListener("afterprint", () => {
    if (!state.provincialPrint.active) return;
    state.provincialPrint.active = false;
    renderSummary();
  });
}

bindProvincialInterface();
bindCircunscriptionInterface();

els.approvalsTab.addEventListener("click", () => {
  if (!state.canApprove || els.approvalsTab.hidden) return;

  window.location.assign("aprobaciones/aprobaciones.html");
});

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
  const assignButton = event.target.closest(".zonal-selector-assign[data-zonal-selector-record-id]");
  if (assignButton) {
    const recordId = assignButton.dataset.zonalSelectorRecordId;
    const selector = els.recordsGrid.querySelector(
      `.zonal-selector-select[data-zonal-selector-record-id="${CSS.escape(recordId)}"]`
    );

    if (!selector) {
      showMessage("No se encontró el selector de esta ficha.");
      return;
    }

    try {
      await assignZonalCargo(recordId, selector.value, assignButton);
    } catch (error) {
      showMessage(error.message || "No se pudo asignar el cargo.");
    }
    return;
  }

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
els.printSummary.addEventListener("click", () => {
  if (isProvincialStructure()) {
    openProvincialPrintOptions();
  } else if (isCircunscriptionStructure()) {
    openCircunscriptionPrintOptions();
  } else {
    window.print();
  }
});
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
  const row = event.target.closest("tr.permission-row");
  if (!row) return;

  const principal = row.querySelector(".permission-primary");
  const view = row.querySelector(".permission-view");
  const edit = row.querySelector(".permission-edit");
  const approve = row.querySelector(".permission-approve");

  if (event.target === view) {
    edit.disabled = !view.checked;
    approve.disabled = !view.checked;

    if (!view.checked) {
      edit.checked = false;
      approve.checked = false;
      if (principal.checked) principal.checked = false;
    }
  }

  if (event.target === edit && edit.checked) {
    view.checked = true;
    edit.disabled = false;
    approve.disabled = false;
  }

  if (event.target === approve && approve.checked) {
    view.checked = true;
    edit.disabled = false;
    approve.disabled = false;
  }

  if (event.target === principal && principal.checked) {
    view.checked = true;
    edit.disabled = false;
    approve.disabled = false;
  }

  for (const permissionRow of els.permissionsBody.querySelectorAll(
    "tr.permission-row"
  )) {
    const rowPrincipal =
      permissionRow.querySelector(".permission-primary")?.checked === true;
    const rowView =
      permissionRow.querySelector(".permission-view")?.checked === true;

    permissionRow.classList.toggle(
      "is-additional",
      rowView && !rowPrincipal
    );

    const note = permissionRow.querySelector("td:first-child small");
    if (note) {
      note.className =
        rowView && !rowPrincipal
          ? "authorization-alert-text"
          : "muted";
      note.textContent = rowPrincipal
        ? "Alcance principal"
        : rowView
          ? "⚠ Autorización adicional / transitoria"
          : permissionRow.dataset.scopeType === "REGION"
            ? "Asignación regional"
            : "Sin autorización";
    }
  }
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
