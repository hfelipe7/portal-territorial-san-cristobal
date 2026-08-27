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
  loader.src = "js/zona-impresion.js?v=ACTA_ZONAL_A4_PDF_V2_1";
  loader.dataset.sigepZonaImpresion = "true";
  document.head.appendChild(loader);
}
