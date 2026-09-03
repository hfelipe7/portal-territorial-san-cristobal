// SIGEP PRM SC - ACTAS MUNICIPAL / DISTRITAL - PDF VISUAL V1.0.0
// SOLO LECTURA.
// Este modulo NO ejecuta INSERT, UPDATE, DELETE ni RPC de escritura.
// Lee v_fichas_portal respetando la sesion/RLS existente y superpone unicamente:
// NOMBRE, CEDULA (11 digitos) y CELULAR sobre el PDF aprobado.
//
// Integridad: cada persona permanece en la misma fila devuelta por v_fichas_portal.
// No se hace una segunda consulta ni se emparejan personas entre filas por orden_cargo.

import { supabase } from "./client.js";

const BUILD = "ACTAS_MUNICIPAL_DISTRITAL_PDF_V1_0_0_IDENTITY_SAFE";
const SOURCE_VIEW = "v_fichas_portal";
const SOURCE_W = 1190;
const SOURCE_H = 1684;
const PAGE_COUNT = 9; // portada + paginas 1-8 del acta

const ACTA_TYPES = {
  MUNICIPAL: {
    key: "MUNICIPAL",
    level: "MUNICIPIO",
    tabLabel: "Acta Municipal",
    title: "Acta constitutiva municipal",
    documentLabel: "Acta Municipal",
    assetBase: "assets/acta-municipal"
  },
  DISTRITAL: {
    key: "DISTRITAL",
    level: "DISTRITO MUNICIPAL",
    tabLabel: "Acta Distrital",
    title: "Acta constitutiva distrital",
    documentLabel: "Acta Distrital",
    assetBase: "assets/acta-distrital"
  }
};

// Catalogo congelado del PDF aprobado. Se usa solo para validacion fail-closed:
// si el cargo de una ficha deja de coincidir con el cargo impreso, se bloquea la impresion.
const EXPECTED_CARGOS = [
  "Presidente(a)",
  "1er. Vice-Presidente(a)",
  "2do. Vice-Presidente(a)",
  "3er. Vice-Presidente(a)",
  "Secretario(a) General",
  "1er. Sub-Secretario(a) General",
  "2do. Sub-Secretario(a) General",
  "3er. Sub-Secretario(a) General",
  "Secretario(a) de Organización",
  "Secretario(a) de Electoral",
  "Secretario(a) de Educación y Doctrina",
  "Secretario de Transformación Digital e innovación",
  "Secretario(a) de Finanzas",
  "Fiscal Adjunto",
  "Delegado Político ante la Junta Electoral (No Aplica para Distritos Municipales)",
  "Delegado Técnico ante la Junta Electoral (No Aplica para Distritos Municipales)",
  "Presidente de la Comisión de Ética y Disciplina",
  "Vicepresidente de la Comisión de Ética y Disciplina",
  "Secretario de la Comisión de Ético y Disciplina",
  "Miembro de la Comisión de Ético y Disciplina",
  "Miembro de la Comisión de Ético y Disciplina",
  "Alcalde Municipal o Director de Distrito Municipal del Partido",
  "Secretario de Asuntos Municipales",
  "Secretario de Comunicación",
  "Secretario de Frentes Sectoriales",
  "Secretario de Sociedad Civil",
  "Secretario Técnico y de Políticas Públicas",
  "Secretario de Actas y Correspondencias",
  "Secretario de Medio Ambiente y Recursos Naturales",
  "Secretario de Asuntos Económicos",
  "Secretario de la Seguridad Social",
  "Director Legal",
  "Presidente de Consejo de Regidores o de la Junta Municipal del Partido",
  "Presidenta del Frente de las Mujeres",
  "Presidente del Frente de la Juventud",
  "Presidente de la Sindical",
  "Presidente del Frente Agropecuario",
  "Presidente del Frente Barrial y Comunal",
  "Presidente del Frente de Abogados",
  "Presidente del Frente de Contadores Públicos",
  "Presidente del Frente de Cooperativismos y Economía Social",
  "Presidente del Frente de Deportes",
  "Presidente del Frente de Empresarios y Comerciantes",
  "Presidente del Frente de Micros, Pequeños y Medianos Empresarios",
  "Presidente del Frente de Profesionales",
  "Presidente del Frente de Cultos",
  "Presidente del Frente de Salud",
  "Presidente del Frente de Seguridad Social",
  "Presidente del Frente de Técnicos",
  "Presidente del Frente del Frente Eléctricos",
  "Presidente del Frente del Frente Magisterial",
  "Presidente del Frente de Robles Modernos",
  "Director del Departamento Administrativo",
  "Director del Departamento de Contraloría y Presupuesto",
  "Director del Departamento de Transporte",
  "Director del Departamento de Relaciones Públicas y Protocolo",
  "Director del Departamento de Prensa"
];

// Geometria del mismo formato aprobado, renderizado a 1190x1684.
// Las paginas 7, 8 y 9 comparten la misma reticula de fichas.
const PAGE_GEOMETRY = {
  2: {
    left: 80, nameRight: 528,
    cedula: [538,570,602,634,666,698,731,764,796,828,861,872],
    phoneRight: 1094,
    slots: [[1,1401]]
  },
  3: {
    left: 90, nameRight: 535,
    cedula: [546,578,610,643,676,708,741,774,806,839,871,883],
    phoneRight: 1104,
    slots: [[2,196],[3,382],[4,568],[5,754],[6,938],[7,1120],[8,1289],[9,1441]]
  },
  4: {
    left: 111, nameRight: 532,
    cedula: [544,574,604,634,664,696,726,758,788,818,849,870],
    phoneRight: 1077,
    slots: [[10,200],[11,377],[12,555],[13,732],[14,905],[15,1061],[16,1203],[17,1330],[18,1455]]
  },
  5: {
    left: 100, nameRight: 524,
    cedula: [534,566,599,632,666,698,731,764,798,830,862,872],
    phoneRight: 1088,
    slots: [[19,197],[20,363],[21,530],[22,696],[23,862],[24,1028],[25,1188],[26,1330],[27,1452]]
  },
  6: {
    left: 98, nameRight: 524,
    cedula: [534,567,600,632,664,695,726,758,789,820,850,886],
    phoneRight: 1092,
    slots: [[28,200],[29,381],[30,562],[31,743],[32,919],[33,1064],[34,1199],[35,1330],[36,1452]]
  },
  7: {
    left: 91, nameRight: 514,
    cedula: [526,558,592,628,662,696,731,765,800,834,868,884],
    phoneRight: 1100,
    slots: [[37,199],[38,370],[39,541],[40,712],[41,881],[42,1037],[43,1181],[44,1312],[45,1444]]
  },
  8: {
    left: 91, nameRight: 514,
    cedula: [526,558,592,628,662,696,731,765,800,834,868,884],
    phoneRight: 1100,
    slots: [[46,199],[47,370],[48,541],[49,712],[50,881],[51,1037],[52,1181],[53,1312],[54,1444]]
  },
  9: {
    left: 91, nameRight: 514,
    cedula: [526,558,592,628,662,696,731,765,800,834,868,884],
    phoneRight: 1100,
    slots: [[55,199],[56,370],[57,541]]
  }
};

const state = {
  installed: false,
  structureCode: "",
  actaType: null,
  records: [],
  rendering: false,
  resizeObserver: null
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatPhone(value) {
  let d = digits(value);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  if (d.length !== 10) return "";
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
}

function activeStructureButton() {
  return document.querySelector("#structure-list .structure-item.active[data-structure-code]");
}

function currentStructureCode() {
  return activeStructureButton()?.dataset?.structureCode || "";
}

function currentStructureLabel() {
  const active = activeStructureButton();
  const strong = active?.querySelector("strong")?.textContent?.trim();
  return strong || active?.textContent?.trim() || "Estructura";
}

function currentCommitteeFieldLabel() {
  const active = activeStructureButton();
  const small = active?.querySelector("small")?.textContent?.trim();
  if (small) return small.toUpperCase();

  return currentStructureLabel()
    .replace(/^\s*Estructura\s+Municipal\s+de\s+/i, "")
    .replace(/^\s*Estructura\s+Distrital\s+de\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function currentActaType() {
  const code = currentStructureCode().toUpperCase();
  if (code.startsWith("EST_MUN_")) return ACTA_TYPES.MUNICIPAL;
  if (code.startsWith("EST_DM_")) return ACTA_TYPES.DISTRITAL;

  // Fallback visual. No concede acceso: solo decide si mostrar la pestaña.
  const header = normalizeText(document.querySelector("#territorial-header")?.textContent);
  if (header.includes("NIVEL DISTRITO MUNICIPAL")) return ACTA_TYPES.DISTRITAL;
  if (header.includes("NIVEL MUNICIPIO")) return ACTA_TYPES.MUNICIPAL;
  return null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return "";
}

function recordName(record) {
  return String(firstNonEmpty(
    record?.nombre_completo,
    record?.nombre,
    record?.nombres_apellidos,
    record?.nombre_y_apellidos
  ) || "").trim();
}

function recordCedula(record) {
  return String(firstNonEmpty(
    record?.cedula,
    record?.cedula_persona,
    record?.documento_identidad
  ) || "").trim();
}

function recordPhone(record) {
  return String(firstNonEmpty(
    record?.telefono_celular,
    record?.celular,
    record?.telefono,
    record?.telefono_1
  ) || "").trim();
}

function expectedCargoCode(order) {
  return `CARGO_${String(order).padStart(2, "0")}`;
}

function auditRows(rows, structureCode) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length !== 57) {
    throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: ${structureCode} devolvio ${list.length} fichas; se esperaban 57.`);
  }

  const ids = new Set();
  const orders = new Set();
  const cargoCodes = new Set();
  const titleMismatches = [];

  for (const row of list) {
    const id = String(row?.id_registro || "").trim();
    if (!id) throw new Error("ACTA_TERRITORIAL_INTEGRIDAD: se recibio una ficha sin id_registro.");
    if (ids.has(id)) throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: id_registro duplicado ${id}.`);
    ids.add(id);

    if (String(row?.estructura_codigo || "").trim() !== structureCode) {
      throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: la ficha ${id} pertenece a otra estructura.`);
    }

    const order = Number(row?.orden_cargo);
    if (!Number.isInteger(order) || order < 1 || order > 57) {
      throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: orden_cargo invalido para ${id}: ${row?.orden_cargo}.`);
    }
    if (orders.has(order)) throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: orden_cargo duplicado ${order}.`);
    orders.add(order);

    const cargoCode = String(row?.cargo_codigo || "").trim().toUpperCase();
    const expectedCode = expectedCargoCode(order);
    if (cargoCode !== expectedCode) {
      throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: ficha ${order} usa ${cargoCode || "SIN_CODIGO"}; se esperaba ${expectedCode}.`);
    }
    if (cargoCodes.has(cargoCode)) throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: cargo_codigo duplicado ${cargoCode}.`);
    cargoCodes.add(cargoCode);

    const expectedTitle = EXPECTED_CARGOS[order - 1];
    const actualTitle = String(row?.cargo || "").trim();
    if (expectedTitle && normalizeText(actualTitle) !== normalizeText(expectedTitle)) {
      titleMismatches.push(`${order}: "${actualTitle}" != "${expectedTitle}"`);
    }
  }

  for (let n = 1; n <= 57; n += 1) {
    if (!orders.has(n)) throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: falta la ficha ${n}.`);
    if (!cargoCodes.has(expectedCargoCode(n))) {
      throw new Error(`ACTA_TERRITORIAL_INTEGRIDAD: falta ${expectedCargoCode(n)}.`);
    }
  }

  if (titleMismatches.length) {
    throw new Error(
      `ACTA_TERRITORIAL_INTEGRIDAD: el catalogo del portal ya no coincide con el PDF aprobado. ${titleMismatches.slice(0,3).join(" | ")}${titleMismatches.length > 3 ? " | ..." : ""}`
    );
  }

  return list;
}

async function loadRecords(structureCode) {
  // Una sola consulta. Cada fila ya contiene identidad, cargo y datos de persona.
  // No existe join adicional por numero de ficha.
  const { data, error } = await supabase
    .from(SOURCE_VIEW)
    .select("*")
    .eq("estructura_codigo", structureCode)
    .order("orden_cargo");

  if (error) throw error;
  return auditRows(data || [], structureCode);
}

function printableRecordMap(records) {
  const map = new Map();
  for (const record of records) {
    // El orden solo determina DONDE se dibuja ESTA MISMA FILA.
    // Nombre/cedula/celular nunca se obtienen desde otra fila.
    map.set(Number(record.orden_cargo), record);
  }
  return map;
}

function pct(value, total) {
  return `${(Number(value) / total * 100).toFixed(6)}%`;
}

function rectStyle(x, y, w, h) {
  return `left:${pct(x,SOURCE_W)};top:${pct(y,SOURCE_H)};width:${pct(w,SOURCE_W)};height:${pct(h,SOURCE_H)};`;
}

function slotGeometry(pageNo, bandEnd) {
  const g = PAGE_GEOMETRY[pageNo];
  const y = bandEnd + 3;
  const h = pageNo <= 3 ? 31 : 28;
  return {
    name: [g.left + 7, y, g.nameRight - g.left - 14, h],
    celular: [g.cedula[g.cedula.length - 1] + 4, y, g.phoneRight - g.cedula[g.cedula.length - 1] - 8, h],
    cedula: g.cedula,
    cedulaY: [y, h]
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function overlayForRecord(pageNo, bandEnd, record) {
  if (!record) return "";

  const geom = slotGeometry(pageNo, bandEnd);
  const name = recordName(record);
  const cedula = digits(recordCedula(record));
  const phone = formatPhone(recordPhone(record));
  const parts = [];

  if (name) {
    const [x,y,w,h] = geom.name;
    parts.push(`<span class="ta-overlay ta-name" data-base-font="19.0" style="${rectStyle(x,y,w,h)}">${escapeHtml(name)}</span>`);
  }

  if (cedula.length === 11) {
    const boundaries = geom.cedula;
    const [y,h] = geom.cedulaY;
    for (let i = 0; i < 11; i += 1) {
      const x1 = boundaries[i];
      const x2 = boundaries[i + 1];
      parts.push(`<span class="ta-overlay ta-digit" data-base-font="15.2" style="${rectStyle(x1,y,x2-x1,h)}">${cedula[i]}</span>`);
    }
  }

  if (phone) {
    const [x,y,w,h] = geom.celular;
    parts.push(`<span class="ta-overlay ta-phone" data-base-font="16.2" style="${rectStyle(x,y,w,h)}">${phone}</span>`);
  }

  return parts.join("");
}

function committeeBandOverlay() {
  const text = currentCommitteeFieldLabel();
  if (!text) return "";
  const x = 271;
  const y = 329;
  const w = 820;
  const h = 35;
  return `<span class="ta-overlay ta-committee" data-base-font="17.4" style="${rectStyle(x,y,w,h)}">${escapeHtml(text)}</span>`;
}

function pageHtml(pageNo, recordMap, actaType) {
  let overlays = "";
  const geometry = PAGE_GEOMETRY[pageNo];
  if (geometry) {
    overlays = geometry.slots
      .map(([slotNo, bandEnd]) => overlayForRecord(pageNo, bandEnd, recordMap.get(slotNo)))
      .join("");
  }

  if (pageNo === 2) overlays = `${committeeBandOverlay()}${overlays}`;

  return `
    <article class="ta-pdf-page" data-pdf-page="${pageNo}">
      <img src="${actaType.assetBase}/page-${pageNo}.webp" alt="${escapeHtml(actaType.documentLabel)} - pagina ${pageNo}" draggable="false">
      <div class="ta-overlay-layer" aria-hidden="true">${overlays}</div>
    </article>
  `;
}

function buildDocument(records, actaType) {
  const recordMap = printableRecordMap(records);
  return Array.from({ length: PAGE_COUNT }, (_, index) => pageHtml(index + 1, recordMap, actaType)).join("");
}

function pageScale(page) {
  if (!page) return 1;
  const rectWidth = Number(page.getBoundingClientRect?.().width || 0);
  const clientWidth = Number(page.clientWidth || 0);
  const width = rectWidth > 1 ? rectWidth : clientWidth > 1 ? clientWidth : 0;
  if (width <= 1) return 1;
  return width / SOURCE_W;
}

function applyPageScale(page) {
  if (!page) return;
  const scale = pageScale(page);
  page.style.setProperty("--ta-scale", String(scale));

  for (const el of page.querySelectorAll(".ta-overlay")) {
    const base = Number(el.dataset.baseFont || 15);
    el.style.fontSize = `${Math.max(7.5, base * scale)}px`;
    el.style.opacity = "1";
    el.style.visibility = "visible";
  }

  for (const el of page.querySelectorAll(".ta-committee")) {
    const base = Math.max(11.5, Number(el.dataset.baseFont || 17.4) * scale);
    const min = Math.max(8.2, 9.4 * scale);
    let size = base;
    el.style.fontSize = `${size}px`;
    if (el.clientWidth > 2) {
      let guard = 0;
      while (size > min && el.scrollWidth > el.clientWidth - Math.max(6, 8 * scale) && guard < 50) {
        size -= Math.max(0.2, 0.3 * scale);
        el.style.fontSize = `${size}px`;
        guard += 1;
      }
    }
  }

  for (const el of page.querySelectorAll(".ta-name")) {
    const base = Math.max(12.2, Number(el.dataset.baseFont || 19) * scale);
    const min = Math.max(8.8, 10.6 * scale);
    let size = base;
    el.style.fontSize = `${size}px`;
    if (el.clientWidth <= 2) continue;

    let guard = 0;
    while (size > min && el.scrollWidth > el.clientWidth - Math.max(3, 5 * scale) && guard < 60) {
      size -= Math.max(0.25, 0.35 * scale);
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  }
}

function applyAllScales() {
  for (const page of document.querySelectorAll("#territorial-acta-pages .ta-pdf-page")) {
    applyPageScale(page);
  }
}

function waitForImage(img) {
  if (!img) return Promise.resolve();
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error(`No se pudo cargar ${img.getAttribute("src") || "una pagina del acta"}.`)); };
    const cleanup = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", fail);
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", fail, { once: true });
  });
}

async function ensureCompleteActaForPrint() {
  const pages = [...document.querySelectorAll("#territorial-acta-pages .ta-pdf-page")];
  if (pages.length !== PAGE_COUNT) {
    throw new Error(`El acta debe contener ${PAGE_COUNT} paginas. Se encontraron ${pages.length}.`);
  }
  if (pages[0]?.dataset?.pdfPage !== "1" || pages[8]?.dataset?.pdfPage !== "9") {
    throw new Error("La secuencia de paginas del acta no esta completa.");
  }
  await Promise.all(pages.map((page) => waitForImage(page.querySelector("img"))));
  applyAllScales();
}

function showStatus(message, type = "info") {
  const status = document.querySelector("#territorial-acta-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
  status.hidden = !message;
}

function updateInterfaceLabels(actaType = currentActaType()) {
  const tab = document.querySelector("#territorial-acta-tab");
  const title = document.querySelector("#territorial-acta-title");
  const name = document.querySelector("#territorial-acta-structure-name");
  if (tab && actaType) tab.textContent = actaType.tabLabel;
  if (title && actaType) title.textContent = actaType.title;
  if (name) name.textContent = currentStructureLabel();
}

async function renderCurrentActa({ force = false } = {}) {
  const actaType = currentActaType();
  if (!actaType) return;

  const code = currentStructureCode();
  const pages = document.querySelector("#territorial-acta-pages");
  if (!code || !pages || state.rendering) return;

  updateInterfaceLabels(actaType);

  if (!force && state.structureCode === code && state.actaType?.key === actaType.key && state.records.length) {
    pages.innerHTML = buildDocument(state.records, actaType);
    requestAnimationFrame(applyAllScales);
    return;
  }

  state.rendering = true;
  showStatus(`Cargando datos actuales de ${currentStructureLabel()}...`, "info");

  try {
    const rows = await loadRecords(code);
    state.structureCode = code;
    state.actaType = actaType;
    state.records = rows;
    pages.innerHTML = buildDocument(rows, actaType);

    requestAnimationFrame(() => {
      applyAllScales();
      window.setTimeout(applyAllScales, 80);
    });

    const invalidCedulas = rows.filter((r) => {
      const d = digits(recordCedula(r));
      return d && d.length !== 11;
    }).length;
    const namesReady = rows.filter((r) => recordName(r)).length;
    const phonesReady = rows.filter((r) => formatPhone(recordPhone(r))).length;

    let message = `57 fichas verificadas - id_registro unico - CARGO_01 a CARGO_57 - orden 1 a 57 - ${namesReady} nombres listos para imprimir.`;
    if (phonesReady) message += ` ${phonesReady} celulares disponibles.`;
    if (invalidCedulas) message += ` ${invalidCedulas} cedulas no se imprimiran por no tener 11 digitos.`;
    showStatus(message, invalidCedulas ? "warning" : "success");
  } catch (error) {
    console.error("SIGEP Acta Municipal/Distrital:", error);
    pages.innerHTML = "";
    state.structureCode = "";
    state.actaType = null;
    state.records = [];
    showStatus(error?.message || "No se pudo cargar el acta.", "error");
  } finally {
    state.rendering = false;
  }
}

function installStyles() {
  if (document.querySelector("#territorial-acta-pdf-styles")) return;
  const style = document.createElement("style");
  style.id = "territorial-acta-pdf-styles";
  style.textContent = `
    #territorial-acta-panel[hidden]{display:none!important}
    .territorial-acta-toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem;padding:1rem 1.1rem;background:#fff;border:1px solid #dbe7f2;border-radius:14px}
    .territorial-acta-toolbar h2{margin:.1rem 0}.territorial-acta-toolbar p{margin:0;color:#65717c}.territorial-acta-toolbar .ta-structure-line{margin-top:.25rem;color:#0b4f8a;font-weight:750}
    .territorial-acta-actions{display:flex;gap:.55rem;flex-wrap:wrap}
    #territorial-acta-status{margin:.75rem 0;padding:.65rem .8rem;border-radius:10px;background:#eef5fb;color:#234c70;font-size:.84rem;font-weight:650}
    #territorial-acta-status[data-type="success"]{background:#eaf7ef;color:#17633c}
    #territorial-acta-status[data-type="warning"]{background:#fff7df;color:#755300}
    #territorial-acta-status[data-type="error"]{background:#fff0f0;color:#8b2626}
    #territorial-acta-panel.ta-active{display:block!important}
    #territorial-acta-pages{display:flex!important;flex-direction:column;align-items:center;gap:22px;width:100%;overflow:visible;padding:.25rem 0 1rem}
    .ta-pdf-page{position:relative;display:block!important;width:210mm;max-width:100%;aspect-ratio:210/297;background:#fff;box-shadow:0 5px 20px rgba(18,39,63,.16);overflow:hidden;flex:0 0 auto;isolation:isolate}
    .ta-pdf-page>img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:fill;display:block;user-select:none;pointer-events:none}
    .ta-overlay-layer{position:absolute;inset:0;z-index:10!important;display:block!important;opacity:1!important;visibility:visible!important;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#000}
    .ta-overlay{position:absolute;z-index:11!important;box-sizing:border-box;display:flex!important;align-items:center;white-space:nowrap;overflow:hidden;line-height:1;font-weight:700;color:#000!important;opacity:1!important;visibility:visible!important;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased}
    .ta-name{justify-content:flex-start;padding:0 3px;text-transform:uppercase;font-weight:750}
    .ta-committee{justify-content:flex-start;padding:0 10px;font-weight:800;letter-spacing:.2px;text-transform:uppercase}
    .ta-digit{justify-content:center;text-align:center;font-weight:800}
    .ta-phone{justify-content:center;text-align:center;font-weight:750;letter-spacing:.15px}
    @media(max-width:900px){#territorial-acta-pages{align-items:flex-start;overflow-x:auto}.territorial-acta-toolbar{align-items:flex-start;flex-direction:column}.ta-pdf-page{width:min(210mm,calc(100vw - 34px));max-width:none}}
    @media print{
      @page{size:A4;margin:0}
      html,body{background:#fff!important}
      body.territorial-acta-print{margin:0!important;padding:0!important;background:#fff!important}
      body.territorial-acta-print .topbar,
      body.territorial-acta-print .portal-hero,
      body.territorial-acta-print #main-tabs,
      body.territorial-acta-print .tab-panel:not(#territorial-acta-panel),
      body.territorial-acta-print #global-message,
      body.territorial-acta-print .territorial-acta-toolbar,
      body.territorial-acta-print #territorial-acta-status{display:none!important}
      body.territorial-acta-print #territorial-acta-panel{display:block!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}
      body.territorial-acta-print .portal-layout{display:block!important;max-width:none!important;width:auto!important;margin:0!important;padding:0!important}
      body.territorial-acta-print #territorial-acta-pages{display:block!important;margin:0!important;padding:0!important;overflow:visible!important}
      body.territorial-acta-print .ta-pdf-page{display:block!important;position:relative!important;width:210mm!important;height:297mm!important;max-width:none!important;aspect-ratio:auto!important;margin:0!important;padding:0!important;box-shadow:none!important;overflow:hidden!important;isolation:isolate!important;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body.territorial-acta-print .ta-pdf-page>img{z-index:1!important}
      body.territorial-acta-print .ta-overlay-layer{display:block!important;z-index:50!important;opacity:1!important;visibility:visible!important}
      body.territorial-acta-print .ta-overlay{display:flex!important;z-index:51!important;color:#000!important;opacity:1!important;visibility:visible!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body.territorial-acta-print .ta-pdf-page:last-child{break-after:auto;page-break-after:auto}
    }
  `;
  document.head.appendChild(style);
}

function installInterface() {
  if (state.installed) return;

  const tabs = document.querySelector("#main-tabs");
  const summaryTab = tabs?.querySelector('[data-tab="summary"]');
  const summaryPanel = document.querySelector("#summary-panel");
  if (!tabs || !summaryTab || !summaryPanel) return;

  installStyles();

  const tab = document.createElement("button");
  tab.id = "territorial-acta-tab";
  tab.type = "button";
  tab.dataset.tab = "territorial-acta";
  tab.textContent = "Acta Municipal";
  tab.hidden = true;
  summaryTab.insertAdjacentElement("afterend", tab);

  const panel = document.createElement("section");
  panel.id = "territorial-acta-panel";
  panel.className = "tab-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="territorial-acta-toolbar no-print">
      <div>
        <p class="eyebrow blue">Impresion oficial</p>
        <h2 id="territorial-acta-title">Acta constitutiva municipal</h2>
        <p>Documento oficial de 57 fichas. Solo se completan Nombre, Cedula y Celular.</p>
        <p class="ta-structure-line" id="territorial-acta-structure-name"></p>
      </div>
      <div class="territorial-acta-actions">
        <button id="territorial-acta-refresh" class="button ghost" type="button">Actualizar</button>
        <button id="territorial-acta-print" class="button" type="button">Imprimir acta</button>
      </div>
    </div>
    <div id="territorial-acta-status" hidden></div>
    <div id="territorial-acta-pages" aria-live="polite"></div>
  `;
  summaryPanel.insertAdjacentElement("afterend", panel);

  tab.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    for (const button of tabs.querySelectorAll("button")) {
      button.classList.toggle("active", button === tab);
    }
    for (const candidate of document.querySelectorAll(".tab-panel")) {
      candidate.hidden = candidate !== panel;
    }

    panel.hidden = false;
    panel.classList.add("ta-active");
    await renderCurrentActa({ force: true });

    requestAnimationFrame(() => {
      panel.hidden = false;
      panel.classList.add("ta-active");
      applyAllScales();
      window.setTimeout(applyAllScales, 120);
    });
  });

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    if (button !== tab) {
      panel.hidden = true;
      panel.classList.remove("ta-active");
      tab.classList.remove("active");
    }
  });

  panel.querySelector("#territorial-acta-refresh")?.addEventListener("click", () => renderCurrentActa({ force: true }));
  panel.querySelector("#territorial-acta-print")?.addEventListener("click", async () => {
    try {
      await renderCurrentActa({ force: true });
      if (!state.records.length) throw new Error("No hay un acta valida cargada para imprimir.");
      await ensureCompleteActaForPrint();
      showStatus("Documento listo para imprimir - portada + paginas 1-8 - 57 fichas verificadas.", "success");
      document.body.classList.add("territorial-acta-print");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyAllScales();
          window.setTimeout(() => {
            applyAllScales();
            window.print();
          }, 120);
        });
      });
    } catch (error) {
      console.error("SIGEP Acta Municipal/Distrital - impresion:", error);
      showStatus(error?.message || "No se pudo preparar el documento completo para impresion.", "error");
      document.body.classList.remove("territorial-acta-print");
    }
  });

  window.addEventListener("beforeprint", applyAllScales);
  window.addEventListener("afterprint", () => document.body.classList.remove("territorial-acta-print"));

  state.resizeObserver = new ResizeObserver(() => applyAllScales());
  state.resizeObserver.observe(panel);

  const refreshAvailability = () => {
    const actaType = currentActaType();
    tab.hidden = !actaType;
    updateInterfaceLabels(actaType);

    if (!actaType) {
      panel.hidden = true;
      panel.classList.remove("ta-active");
      tab.classList.remove("active");
      state.structureCode = "";
      state.actaType = null;
      state.records = [];
      const pages = panel.querySelector("#territorial-acta-pages");
      if (pages) pages.innerHTML = "";
      showStatus("");
      return;
    }

    // Si el usuario cambia de una estructura municipal/distrital a otra,
    // invalida el cache. La siguiente apertura recarga datos actuales bajo RLS.
    const code = currentStructureCode();
    if (state.structureCode && state.structureCode !== code) {
      state.structureCode = "";
      state.actaType = null;
      state.records = [];
      const pages = panel.querySelector("#territorial-acta-pages");
      if (pages) pages.innerHTML = "";
      showStatus("");
    }
  };

  const observer = new MutationObserver(() => window.setTimeout(refreshAvailability, 0));
  const structureList = document.querySelector("#structure-list");
  const territorialHeader = document.querySelector("#territorial-header");
  if (structureList) observer.observe(structureList, { subtree:true, childList:true, attributes:true, attributeFilter:["class"] });
  if (territorialHeader) observer.observe(territorialHeader, { subtree:true, childList:true, characterData:true, attributes:true });
  document.querySelector("#territory-select")?.addEventListener("change", () => window.setTimeout(refreshAvailability, 80));

  refreshAvailability();
  state.installed = true;
  console.info("SIGEP modulo cargado:", BUILD);
}

function start() {
  const attempt = () => {
    if (document.querySelector("#main-tabs") && document.querySelector("#summary-panel")) {
      installInterface();
    } else {
      window.setTimeout(attempt, 120);
    }
  };
  attempt();
}

start();
