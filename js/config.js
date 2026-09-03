window.APP_CONFIG = {
  APP_NAME: "InnovaData · Carpetas Territoriales San Cristóbal",
  SUPABASE_URL: "https://duvtqrgmnqbcuqdafttf.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_lckjja0pcANcQh07xrlS7Q_G9W0CAVP",
  LOGIN_FUNCTION: "login-territorial",
  ADMIN_FUNCTION: "admin-users"
};

// SIGEP PRM SC — Acta Zonal de impresión.
// Carga desacoplada y solo lectura: si este módulo falla, el portal continúa funcionando.
if (window.location.pathname.toLowerCase().endsWith("/portal.html")) {
  const loader = document.createElement("script");
  loader.type = "module";
  loader.src = "js/zona-impresion.js?v=ACTA_ZONAL_PDF_V2_5_1_IDENTITY_SAFE";
  loader.dataset.sigepZonaImpresion = "true";
  document.head.appendChild(loader);
}

// SIGEP PRM SC — Actas Municipal y Distrital de impresión.
// Módulo desacoplado y SOLO LECTURA. No modifica portal.js, permisos, RLS ni datos.
if (window.location.pathname.toLowerCase().endsWith("/portal.html")) {
  const loader = document.createElement("script");
  loader.type = "module";
  loader.src = "js/municipio-distrito-actas.js?v=ACTAS_MUNICIPAL_DISTRITAL_PDF_V1_0_0_IDENTITY_SAFE";
  loader.dataset.sigepMunicipioDistritoActas = "true";
  document.head.appendChild(loader);
}
