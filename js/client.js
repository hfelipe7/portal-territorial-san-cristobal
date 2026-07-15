import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.APP_CONFIG || {};
const url = String(config.SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = String(config.SUPABASE_PUBLISHABLE_KEY || "").trim();

const missing =
  !url ||
  !publishableKey ||
  publishableKey.includes("PEGA_AQUI") ||
  !url.includes("supabase.co");

export const supabase = createClient(url || "https://invalid.supabase.co", publishableKey || "invalid", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "portal-territorial-sc-auth"
  }
});

export const appName = config.APP_NAME || "Portal Territorial San Cristóbal";
export const configReady = !missing;
export const supabaseUrl = url;
export const publishable = publishableKey;
export const loginFunctionUrl = `${url}/functions/v1/${config.LOGIN_FUNCTION || "login-territorial"}`;
export const adminFunctionUrl = `${url}/functions/v1/${config.ADMIN_FUNCTION || "admin-users"}`;

export function pageUrl(fileName) {
  const base = window.location.pathname.replace(/[^/]*$/, "");
  return `${window.location.origin}${base}${fileName}`;
}

export function saveLoginContext(profile, territoryCode) {
  sessionStorage.setItem("portal_profile", JSON.stringify(profile || {}));
  sessionStorage.setItem("portal_initial_territory", String(territoryCode || ""));
}

export function getSavedLoginContext() {
  let profile = null;
  try {
    profile = JSON.parse(sessionStorage.getItem("portal_profile") || "null");
  } catch {
    profile = null;
  }

  return {
    profile,
    territoryCode: sessionStorage.getItem("portal_initial_territory") || ""
  };
}

export function clearLoginContext() {
  sessionStorage.removeItem("portal_profile");
  sessionStorage.removeItem("portal_initial_territory");
}

export async function invokePublicFunction(urlToCall, body) {
  const response = await fetch(urlToCall, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishable
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`);
  }
  return data;
}

export async function invokeAuthenticatedFunction(urlToCall, body) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("La sesión expiró. Inicie sesión nuevamente.");

  const response = await fetch(urlToCall, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishable,
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`);
  }
  return data;
}

export function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
