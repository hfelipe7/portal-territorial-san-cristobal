// SIGEP PRM SC — ACTA ZONAL A4 · PDF VISUAL V2.3
// SOLO LECTURA.
// Este módulo NO ejecuta INSERT, UPDATE, DELETE ni RPC de escritura.
// Lee la misma vista zonal utilizada por el portal y superpone únicamente:
// NOMBRE, CÉDULA (11 dígitos) y CELULAR sobre las páginas del PDF aprobado.

import { supabase } from "./client.js";

const BUILD = "ACTA_ZONAL_A4_PDF_V2_3";
const ZONAL_VIEW = "v_sigep_zona_fichas_clasificadas_v1";
const RECORDS_TABLE = "registros";
const SOURCE_W = 1190;
const SOURCE_H = 1684;
const PAGE_COUNT = 7; // portada + páginas 1–6 del acta
const ASSET_BASE = "assets/zona-impresion";

// Geometría tomada directamente del PDF "zona impresion" aprobado.
// Las posiciones se expresan en píxeles del render 1190×1684 y luego se convierten a %.
const PAGE_GEOMETRY = {
  2: {
    left: 80, nameRight: 528,
    cedula: [538,570,602,634,666,698,731,764,796,828,861,872],
    phoneRight: 1094,
    slots: [[1, 1401]]
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
  }
};

const state = {
  installed: false,
  structureCode: "",
  records: [],
  rendering: false,
  resizeObserver: null
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function physicalOrder(record) {
  return Number(
    record?.posicion_visual_base ??
    record?.orden_visible ??
    record?.orden_cargo ??
    0
  );
}

function officialNumber(record) {
  const n = Number(record?.numero_ficha_oficial);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function explicitSelectorAssignment(record) {
  return (
    record?.selector_asignado === true ||
    record?.cargo_selector_asignado === true ||
    record?.asignado_por_selector === true ||
    Boolean(record?.cargo_selector_asignacion_id)
  );
}

function isAssignedBeyondTwelve(record) {
  const n = officialNumber(record);
  if (n === null || n < 13 || n > 45) return false;

  const code = String(record?.cargo_selector_codigo || "").trim().toUpperCase();
  if (!code) return false;

  // 13–42: solo cargos realmente seleccionados, nunca una ficha MIEMBRO sin clasificar.
  if (n >= 13 && n <= 42) return code !== "MIEMBRO";

  // 43–45: son las tres posiciones oficiales de Miembro.
  // Una ficha MIEMBRO sin clasificar no trae cargo_selector_codigo; cuando el
  // selector la asigna oficialmente a 43/44/45 sí queda código MIEMBRO y número oficial.
  // También aceptamos las banderas explícitas del backend cuando estén disponibles.
  return code === "MIEMBRO" && (
    explicitSelectorAssignment(record) ||
    n !== physicalOrder(record) ||
    Boolean(record?.cargo_selector_codigo)
  );
}

function printableRecordMap(records) {
  const map = new Map();

  // Los doce cargos de Dirección Zonal siempre se vinculan por su posición física estable.
  for (const record of records) {
    const pos = physicalOrder(record);
    if (pos >= 1 && pos <= 12 && !map.has(pos)) {
      map.set(pos, record);
    }
  }

  // 13–45 se vinculan únicamente por el número oficial resultante del selector.
  for (const record of records) {
    if (!isAssignedBeyondTwelve(record)) continue;
    const n = officialNumber(record);
    if (!map.has(n)) map.set(n, record);
  }

  return map;
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
  return strong || active?.textContent?.trim() || "Zona A4";
}

function isCurrentZonaA4SanCristobal() {
  const active = activeStructureButton();
  if (!active) return false;

  const activeText = normalizeText(active.textContent);
  const headerText = normalizeText(document.querySelector("#territorial-header")?.textContent);
  const zoneMatch = /\bZONA\s*A4\b/.test(activeText) || /\bZONA\s*:?\s*A4\b/.test(headerText);
  const municipalityMatch = /MUNICIPIO\s*:?\s*SAN CRISTOBAL\b/.test(headerText);
  return zoneMatch && municipalityMatch;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function recordIdentityCandidates(record) {
  return [
    record?.registro_id,
    record?.registro_uuid,
    record?.ficha_id,
    record?.id
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value));
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

function hydrateClassificationRows(classifiedRows, personalRows) {
  const byId = new Map();
  const byPhysical = new Map();

  for (const row of personalRows || []) {
    for (const key of recordIdentityCandidates(row)) {
      if (!byId.has(key)) byId.set(key, row);
    }

    const pos = Number(
      row?.posicion_visual_base ??
      row?.orden_visible ??
      row?.orden_cargo ??
      0
    );
    if (Number.isFinite(pos) && pos > 0 && !byPhysical.has(pos)) {
      byPhysical.set(pos, row);
    }
  }

  return (classifiedRows || []).map((classified) => {
    let personal = null;

    for (const key of recordIdentityCandidates(classified)) {
      if (byId.has(key)) {
        personal = byId.get(key);
        break;
      }
    }

    if (!personal) {
      const pos = physicalOrder(classified);
      if (pos > 0) personal = byPhysical.get(pos) || null;
    }

    if (!personal) return classified;

    // La clasificación oficial manda. Los datos personales se hidratan desde
    // la ficha real sin escribir ni transformar nada en la base.
    return {
      ...personal,
      ...classified,
      nombre_completo: firstNonEmpty(
        personal?.nombre_completo,
        classified?.nombre_completo,
        personal?.nombre,
        classified?.nombre
      ),
      cedula: firstNonEmpty(
        personal?.cedula,
        classified?.cedula,
        personal?.cedula_persona,
        classified?.cedula_persona
      ),
      telefono_celular: firstNonEmpty(
        personal?.telefono_celular,
        classified?.telefono_celular,
        personal?.celular,
        classified?.celular,
        personal?.telefono,
        classified?.telefono
      )
    };
  });
}

async function loadRecords(structureCode) {
  // 1) Lee la vista de clasificación oficial (número/cargo resultante del selector).
  const classifiedQuery = await supabase
    .from(ZONAL_VIEW)
    .select("*")
    .eq("estructura_codigo", structureCode)
    .order("posicion_visual_base");

  if (classifiedQuery.error) throw classifiedQuery.error;
  const classifiedRows = classifiedQuery.data || [];

  // 2) Hidrata Nombre/Cédula/Celular desde las fichas reales.
  // Es una lectura adicional; no ejecuta INSERT/UPDATE/DELETE/RPC.
  const personalQuery = await supabase
    .from(RECORDS_TABLE)
    .select("*")
    .eq("estructura_codigo", structureCode);

  if (personalQuery.error) {
    // Si por política RLS la tabla base no está accesible directamente,
    // seguimos con la vista; los alias tolerantes de overlayForRecord aún
    // permiten usar datos personales si la vista ya los expone.
    console.warn(
      "SIGEP Acta Zonal: no fue posible hidratar desde registros; se usará la vista clasificada.",
      personalQuery.error
    );
    return classifiedRows;
  }

  return hydrateClassificationRows(classifiedRows, personalQuery.data || []);
}

function pct(value, total) {
  return `${(Number(value) / total * 100).toFixed(6)}%`;
}

function rectStyle(x, y, w, h) {
  return `left:${pct(x,SOURCE_W)};top:${pct(y,SOURCE_H)};width:${pct(w,SOURCE_W)};height:${pct(h,SOURCE_H)};`;
}

function slotGeometry(pageNo, slotNo, bandEnd) {
  const g = PAGE_GEOMETRY[pageNo];
  const y = bandEnd + 3;
  // La fila de datos tiene entre 30 y 39 px en el render de referencia.
  // 31 px mantiene el texto centrado sin invadir las líneas de la ficha.
  const h = pageNo <= 3 ? 31 : 28;
  return {
    name: [g.left + 7, y, g.nameRight - g.left - 14, h],
    celular: [g.cedula[g.cedula.length - 1] + 4, y, g.phoneRight - g.cedula[g.cedula.length - 1] - 8, h],
    cedula: g.cedula,
    cedulaY: [y, h]
  };
}

function overlayForRecord(pageNo, slotNo, bandEnd, record) {
  if (!record) return "";

  const geom = slotGeometry(pageNo, slotNo, bandEnd);
  const name = recordName(record);
  const cedula = digits(recordCedula(record));
  const phone = formatPhone(recordPhone(record));

  const parts = [];

  if (name) {
    const [x,y,w,h] = geom.name;
    parts.push(
      `<span class="za-overlay za-name" data-base-font="19.0" style="${rectStyle(x,y,w,h)}">${escapeHtml(name)}</span>`
    );
  }

  // Solo una cédula válida de 11 dígitos se distribuye en las 11 casillas.
  if (cedula.length === 11) {
    const boundaries = geom.cedula;
    const [y,h] = geom.cedulaY;
    for (let i = 0; i < 11; i += 1) {
      const x1 = boundaries[i];
      const x2 = boundaries[i + 1];
      parts.push(
        `<span class="za-overlay za-digit" data-base-font="15.2" style="${rectStyle(x1,y,x2-x1,h)}">${cedula[i]}</span>`
      );
    }
  }

  if (phone) {
    const [x,y,w,h] = geom.celular;
    parts.push(
      `<span class="za-overlay za-phone" data-base-font="16.2" style="${rectStyle(x,y,w,h)}">${phone}</span>`
    );
  }

  return parts.join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageHtml(pageNo, recordMap) {
  let overlays = "";
  const geometry = PAGE_GEOMETRY[pageNo];
  if (geometry) {
    overlays = geometry.slots
      .map(([slotNo, bandEnd]) => overlayForRecord(pageNo, slotNo, bandEnd, recordMap.get(slotNo)))
      .join("");
  }

  return `
    <article class="za-pdf-page" data-pdf-page="${pageNo}">
      <img src="${ASSET_BASE}/page-${pageNo}.webp" alt="Acta zonal · página ${pageNo}" draggable="false">
      <div class="za-overlay-layer" aria-hidden="true">${overlays}</div>
    </article>
  `;
}

function buildDocument(records) {
  const recordMap = printableRecordMap(records);
  return Array.from({ length: PAGE_COUNT }, (_, index) => pageHtml(index + 1, recordMap)).join("");
}

function pageScale(page) {
  if (!page) return 1;
  const rectWidth = Number(page.getBoundingClientRect?.().width || 0);
  const clientWidth = Number(page.clientWidth || 0);
  const width = rectWidth > 1 ? rectWidth : clientWidth > 1 ? clientWidth : 0;

  // Nunca devolver 0: cuando Chrome calcula el layout con un panel recién
  // mostrado/oculto, clientWidth puede ser temporalmente cero y antes dejaba
  // todos los textos de la superposición en 0px.
  if (width <= 1) return 1;
  return width / SOURCE_W;
}

function applyPageScale(page) {
  if (!page) return;
  const scale = pageScale(page);
  page.style.setProperty("--za-scale", String(scale));

  for (const el of page.querySelectorAll(".za-overlay")) {
    const base = Number(el.dataset.baseFont || 15);
    el.style.fontSize = `${Math.max(7.5, base * scale)}px`;
    el.style.opacity = "1";
    el.style.visibility = "visible";
  }

  // El nombre debe ocupar el campo de forma legible y reducirse SOLO si
  // realmente excede el ancho disponible.
  for (const el of page.querySelectorAll(".za-name")) {
    const base = Math.max(12.2, Number(el.dataset.baseFont || 19) * scale);
    const min = Math.max(8.8, 10.6 * scale);
    let size = base;
    el.style.fontSize = `${size}px`;

    // Si todavía no existe ancho medible (p. ej. un frame de transición),
    // conservamos el tamaño base y reintentamos en el siguiente frame.
    if (el.clientWidth <= 2) continue;

    let guard = 0;
    while (
      size > min &&
      el.scrollWidth > el.clientWidth - Math.max(3, 5 * scale) &&
      guard < 60
    ) {
      size -= Math.max(0.25, 0.35 * scale);
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  }
}

function applyAllScales() {
  for (const page of document.querySelectorAll("#zona-acta-pages .za-pdf-page")) {
    applyPageScale(page);
  }
}

function waitForImage(img) {
  if (!img) return Promise.resolve();
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error(`No se pudo cargar ${img.getAttribute("src") || "una página del acta"}.`)); };
    const cleanup = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", fail);
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", fail, { once: true });
  });
}

async function ensureCompleteActaForPrint() {
  const pages = [...document.querySelectorAll("#zona-acta-pages .za-pdf-page")];
  if (pages.length !== PAGE_COUNT) {
    throw new Error(`El acta debe contener ${PAGE_COUNT} páginas (portada + páginas 1–6). Se encontraron ${pages.length}.`);
  }

  const firstPage = pages[0];
  if (firstPage?.dataset?.pdfPage !== "1") {
    throw new Error("No se encontró la portada como primera página del acta.");
  }

  await Promise.all(pages.map((page) => waitForImage(page.querySelector("img"))));
  applyAllScales();
}

function showStatus(message, type = "info") {
  const status = document.querySelector("#zona-acta-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
  status.hidden = !message;
}

function updateToolbarStructureName() {
  const target = document.querySelector("#zona-acta-structure-name");
  if (target) target.textContent = currentStructureLabel();
}

async function renderCurrentActa({ force = false } = {}) {
  if (!isCurrentZonaA4SanCristobal()) return;
  const code = currentStructureCode();
  const pages = document.querySelector("#zona-acta-pages");
  if (!code || !pages || state.rendering) return;

  updateToolbarStructureName();

  if (!force && state.structureCode === code && state.records.length) {
    pages.innerHTML = buildDocument(state.records);
    requestAnimationFrame(applyAllScales);
    return;
  }

  state.rendering = true;
  showStatus("Cargando datos actuales de la Zona A4…", "info");

  try {
    const rows = await loadRecords(code);
    state.structureCode = code;
    state.records = rows;
    pages.innerHTML = buildDocument(rows);

    const printable = printableRecordMap(rows);
    const extras = [...printable.keys()].filter((n) => n >= 13).length;
    const invalidCedulas = [...printable.values()].filter((r) => {
      const d = digits(recordCedula(r));
      return d && d.length !== 11;
    }).length;

    requestAnimationFrame(() => {
      applyAllScales();
      window.setTimeout(applyAllScales, 80);
    });

    const printableValues = [...printable.values()];
    const namesReady = printableValues.filter((r) => recordName(r)).length;
    const phonesReady = printableValues.filter((r) => formatPhone(recordPhone(r))).length;

    let message = `Acta actualizada · 12 cargos base + ${extras} cargo${extras === 1 ? "" : "s"} asignado${extras === 1 ? "" : "s"} · ${namesReady} nombre${namesReady === 1 ? "" : "s"} listo${namesReady === 1 ? "" : "s"} para imprimir.`;
    if (phonesReady) {
      message += ` ${phonesReady} celular${phonesReady === 1 ? "" : "es"} disponible${phonesReady === 1 ? "" : "s"}.`;
    }
    if (invalidCedulas) {
      message += ` ${invalidCedulas} cédula${invalidCedulas === 1 ? "" : "s"} no se imprimió por no tener 11 dígitos.`;
    }
    showStatus(message, invalidCedulas ? "warning" : "success");
  } catch (error) {
    console.error("SIGEP Acta Zonal:", error);
    showStatus(error?.message || "No se pudo cargar el Acta Zonal.", "error");
  } finally {
    state.rendering = false;
  }
}

function installStyles() {
  if (document.querySelector("#zona-acta-pdf-styles")) return;
  const style = document.createElement("style");
  style.id = "zona-acta-pdf-styles";
  style.textContent = `
    #zona-acta-panel[hidden]{display:none!important}
    .zona-acta-toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem;padding:1rem 1.1rem;background:#fff;border:1px solid #dbe7f2;border-radius:14px}
    .zona-acta-toolbar h2{margin:.1rem 0}.zona-acta-toolbar p{margin:0;color:#65717c}.zona-acta-toolbar .za-structure-line{margin-top:.25rem;color:#0b4f8a;font-weight:750}
    .zona-acta-actions{display:flex;gap:.55rem;flex-wrap:wrap}
    #zona-acta-status{margin:.75rem 0;padding:.65rem .8rem;border-radius:10px;background:#eef5fb;color:#234c70;font-size:.84rem;font-weight:650}
    #zona-acta-status[data-type="success"]{background:#eaf7ef;color:#17633c}
    #zona-acta-status[data-type="warning"]{background:#fff7df;color:#755300}
    #zona-acta-status[data-type="error"]{background:#fff0f0;color:#8b2626}
    #zona-acta-panel.za-active{display:block!important}
    #zona-acta-pages{display:flex!important;flex-direction:column;align-items:center;gap:22px;width:100%;overflow:visible;padding:.25rem 0 1rem}
    .za-pdf-page{position:relative;display:block!important;width:210mm;max-width:100%;aspect-ratio:210/297;background:#fff;box-shadow:0 5px 20px rgba(18,39,63,.16);overflow:hidden;flex:0 0 auto;isolation:isolate}
    .za-pdf-page>img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:fill;display:block;user-select:none;pointer-events:none}
    .za-overlay-layer{position:absolute;inset:0;z-index:10!important;display:block!important;opacity:1!important;visibility:visible!important;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#000}
    .za-overlay{position:absolute;z-index:11!important;box-sizing:border-box;display:flex!important;align-items:center;white-space:nowrap;overflow:hidden;line-height:1;font-weight:700;color:#000!important;opacity:1!important;visibility:visible!important;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased}
    .za-name{justify-content:flex-start;padding:0 3px;text-transform:uppercase;font-weight:750}
    .za-digit{justify-content:center;text-align:center;font-weight:800}
    .za-phone{justify-content:center;text-align:center;font-weight:750;letter-spacing:.15px}
    @media(max-width:900px){#zona-acta-pages{align-items:flex-start;overflow-x:auto}.zona-acta-toolbar{align-items:flex-start;flex-direction:column}.za-pdf-page{width:min(210mm,calc(100vw - 34px));max-width:none}}
    @media print{
      @page{size:A4;margin:0}
      html,body{background:#fff!important}
      body.zona-acta-print{margin:0!important;padding:0!important;background:#fff!important}
      body.zona-acta-print .topbar,
      body.zona-acta-print .portal-hero,
      body.zona-acta-print #main-tabs,
      body.zona-acta-print #structures-panel,
      body.zona-acta-print #summary-panel,
      body.zona-acta-print #users-panel,
      body.zona-acta-print #audit-panel,
      body.zona-acta-print #global-message,
      body.zona-acta-print .zona-acta-toolbar,
      body.zona-acta-print #zona-acta-status{display:none!important}
      body.zona-acta-print #zona-acta-panel{display:block!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}
      body.zona-acta-print .portal-layout{display:block!important;max-width:none!important;width:auto!important;margin:0!important;padding:0!important}
      body.zona-acta-print #zona-acta-pages{display:block!important;margin:0!important;padding:0!important;overflow:visible!important}
      body.zona-acta-print .za-pdf-page{display:block!important;position:relative!important;width:210mm!important;height:297mm!important;max-width:none!important;aspect-ratio:auto!important;margin:0!important;padding:0!important;box-shadow:none!important;overflow:hidden!important;isolation:isolate!important;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body.zona-acta-print .za-pdf-page>img{z-index:1!important}
      body.zona-acta-print .za-overlay-layer{display:block!important;z-index:50!important;opacity:1!important;visibility:visible!important}
      body.zona-acta-print .za-overlay{display:flex!important;z-index:51!important;color:#000!important;opacity:1!important;visibility:visible!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body.zona-acta-print .za-pdf-page:last-child{break-after:auto;page-break-after:auto}
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
  tab.id = "zona-acta-tab";
  tab.type = "button";
  tab.dataset.tab = "zona-acta";
  tab.textContent = "Acta zonal";
  tab.hidden = true;
  summaryTab.insertAdjacentElement("afterend", tab);

  const panel = document.createElement("section");
  panel.id = "zona-acta-panel";
  panel.className = "tab-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="zona-acta-toolbar no-print">
      <div>
        <p class="eyebrow blue">Impresión oficial</p>
        <h2>Acta constitutiva zonal</h2>
        <p>Vista fiel del documento “zona impresión”. Solo se completan Nombre, Cédula y Celular.</p>
        <p class="za-structure-line" id="zona-acta-structure-name"></p>
      </div>
      <div class="zona-acta-actions">
        <button id="zona-acta-refresh" class="button ghost" type="button">Actualizar</button>
        <button id="zona-acta-print" class="button" type="button">Imprimir acta</button>
      </div>
    </div>
    <div id="zona-acta-status" hidden></div>
    <div id="zona-acta-pages" aria-live="polite"></div>
  `;
  summaryPanel.insertAdjacentElement("afterend", panel);

  tab.addEventListener("click", async (event) => {
    // El portal principal fue construido antes de esta pestaña. Evitamos que
    // su manejador genérico vuelva a ocultar el panel dinámico en escritorio.
    event.preventDefault();
    event.stopPropagation();

    for (const button of tabs.querySelectorAll("button")) {
      button.classList.toggle("active", button === tab);
    }
    for (const candidate of document.querySelectorAll(".tab-panel")) {
      candidate.hidden = candidate !== panel;
    }

    panel.hidden = false;
    panel.classList.add("za-active");
    await renderCurrentActa({ force: true });

    requestAnimationFrame(() => {
      panel.hidden = false;
      panel.classList.add("za-active");
      applyAllScales();
      window.setTimeout(applyAllScales, 120);
    });
  });

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    if (button !== tab) {
      panel.hidden = true;
      panel.classList.remove("za-active");
      tab.classList.remove("active");
    }
  });

  panel.querySelector("#zona-acta-refresh")?.addEventListener("click", () => renderCurrentActa({ force: true }));
  panel.querySelector("#zona-acta-print")?.addEventListener("click", async () => {
    try {
      await renderCurrentActa({ force: true });
      await ensureCompleteActaForPrint();
      showStatus("Documento listo para imprimir · portada + páginas 1–6.", "success");
      document.body.classList.add("zona-acta-print");

      // Dos frames garantizan que Chrome ya haya aplicado el ancho A4 antes
      // de calcular fuentes y abrir la vista previa de impresión.
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
      console.error("SIGEP Acta Zonal · impresión:", error);
      showStatus(error?.message || "No se pudo preparar el documento completo para impresión.", "error");
      document.body.classList.remove("zona-acta-print");
    }
  });

  window.addEventListener("beforeprint", applyAllScales);
  window.addEventListener("afterprint", () => document.body.classList.remove("zona-acta-print"));

  state.resizeObserver = new ResizeObserver(() => applyAllScales());
  state.resizeObserver.observe(panel);

  const refreshAvailability = () => {
    const eligible = isCurrentZonaA4SanCristobal();
    tab.hidden = !eligible;
    updateToolbarStructureName();

    if (!eligible) {
      panel.hidden = true;
      panel.classList.remove("za-active");
      state.structureCode = "";
      state.records = [];
      const pages = panel.querySelector("#zona-acta-pages");
      if (pages) pages.innerHTML = "";
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
  console.info("SIGEP módulo cargado:", BUILD);
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
