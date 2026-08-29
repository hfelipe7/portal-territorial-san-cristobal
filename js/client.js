import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.APP_CONFIG || {};
const url = String(config.SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = String(config.SUPABASE_PUBLISHABLE_KEY || "").trim();

const missing =
  !url ||
  !publishableKey ||
  publishableKey.includes("PEGA_AQUI") ||
  !url.includes("supabase.co");

export const supabase = createClient(
  url || "https://invalid.supabase.co",
  publishableKey || "invalid",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "portal-territorial-sc-auth"
    }
  }
);

export const appName =
  config.APP_NAME ||
  "Portal Territorial San Cristóbal";

export const configReady = !missing;
export const supabaseUrl = url;
export const publishable = publishableKey;
export const loginFunctionUrl =
  `${url}/functions/v1/${config.LOGIN_FUNCTION || "login-territorial"}`;
export const adminFunctionUrl =
  `${url}/functions/v1/${config.ADMIN_FUNCTION || "admin-users"}`;

export const NETWORK_TIMEOUT_MS = 20000;
export const AUTH_TIMEOUT_MS = 12000;

export function pageUrl(fileName) {
  const base =
    window.location.pathname.replace(/[^/]*$/, "");

  return `${window.location.origin}${base}${fileName}`;
}

export function saveLoginContext(
  profile,
  territoryCode
) {
  sessionStorage.setItem(
    "portal_profile",
    JSON.stringify(profile || {})
  );

  sessionStorage.setItem(
    "portal_initial_territory",
    String(territoryCode || "")
  );
}

export function getSavedLoginContext() {
  let profile = null;

  try {
    profile = JSON.parse(
      sessionStorage.getItem("portal_profile") ||
      "null"
    );
  } catch {
    profile = null;
  }

  return {
    profile,
    territoryCode:
      sessionStorage.getItem(
        "portal_initial_territory"
      ) || ""
  };
}

export function clearLoginContext() {
  sessionStorage.removeItem("portal_profile");
  sessionStorage.removeItem(
    "portal_initial_territory"
  );
}

export function withTimeout(
  promise,
  timeoutMs,
  message
) {
  let timer;

  const timeout = new Promise(
    (_, reject) => {
      timer = window.setTimeout(
        () => reject(
          new Error(
            message ||
            "La operación tardó demasiado. Inténtelo nuevamente."
          )
        ),
        timeoutMs
      );
    }
  );

  return Promise.race([
    promise,
    timeout
  ]).finally(() => {
    if (timer) {
      window.clearTimeout(timer);
    }
  });
}

async function fetchJson(
  urlToCall,
  options,
  timeoutMs = NETWORK_TIMEOUT_MS
) {
  const controller =
    new AbortController();

  const timer =
    window.setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const response = await fetch(
      urlToCall,
      {
        ...options,
        signal: controller.signal
      }
    );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        `Error HTTP ${response.status}`
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "La verificación tardó demasiado. Revise su conexión e inténtelo nuevamente."
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "No se pudo conectar con el servidor. Revise su conexión e inténtelo nuevamente."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function invokePublicFunction(
  urlToCall,
  body,
  timeoutMs = NETWORK_TIMEOUT_MS
) {
  return fetchJson(
    urlToCall,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishable
      },
      body: JSON.stringify(body)
    },
    timeoutMs
  );
}

export async function invokeAuthenticatedFunction(
  urlToCall,
  body,
  timeoutMs = NETWORK_TIMEOUT_MS
) {
  const {
    data: sessionData,
    error: sessionError
  } = await withTimeout(
    supabase.auth.getSession(),
    AUTH_TIMEOUT_MS,
    "La sesión tardó demasiado en responder. Recargue la página e inténtelo nuevamente."
  );

  if (sessionError) {
    throw sessionError;
  }

  const accessToken =
    sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "La sesión expiró. Inicie sesión nuevamente."
    );
  }

  return fetchJson(
    urlToCall,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        apikey: publishable,
        Authorization:
          `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    },
    timeoutMs
  );
}

export function cleanText(value) {
  const text =
    String(value ?? "").trim();

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

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "es-DO",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}
