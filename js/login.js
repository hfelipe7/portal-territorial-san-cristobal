import {
  supabase,
  appName,
  configReady,
  loginFunctionUrl,
  invokePublicFunction,
  saveLoginContext
} from "./client.js?v=LOGIN_NO_SELECTOR_V2_2";

const SESSION_STORAGE_KEY = "portal-territorial-sc-auth";
const SESSION_CONFIRM_TIMEOUT_MS = 45000;
const SESSION_POLL_MS = 250;

const els = {
  appName: document.querySelector("[data-app-name]"),
  form: document.querySelector("#login-form"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  message: document.querySelector("#message"),
  submit: document.querySelector("#submit-button"),
  togglePassword: document.querySelector("#toggle-password"),
  turnstileWrap: document.querySelector("#turnstile-wrap"),
  turnstileWidget: document.querySelector("#turnstile-widget")
};

if (els.appName) els.appName.textContent = appName;

let turnstileToken = "";
let turnstileWidgetId = null;

const turnstileSiteKey = String(
  window.APP_CONFIG?.TURNSTILE_SITE_KEY || ""
).trim();

function showMessage(text, type = "error") {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  els.message.hidden = false;
}

function hideMessage() {
  els.message.hidden = true;
}

function setBusy(busy, label = "VERIFICANDO…") {
  els.submit.disabled = busy;
  els.username.disabled = busy;
  els.password.disabled = busy;

  const span = els.submit.querySelector("span");
  if (span) {
    span.textContent = busy ? label : "INICIAR SESIÓN";
  }
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function storedSessionMatches(expectedAccessToken) {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    return (
      typeof parsed?.access_token === "string" &&
      parsed.access_token === expectedAccessToken
    );
  } catch {
    return false;
  }
}

/*
 * No se usa getSession() en la pantalla de login.
 * Así evitamos competir por el lock interno de Supabase Auth antes de setSession().
 *
 * La sesión se considera establecida cuando:
 *   1) setSession() termina correctamente; o
 *   2) el access_token esperado aparece realmente persistido en Local Storage.
 *
 * El watchdog de 45 s solo cubre un bloqueo real y no un retraso normal corto.
 */
async function establishSession(accessToken, refreshToken) {
  let sdkError = null;

  const sdkPromise = supabase.auth
    .setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
    .then(({ data, error }) => {
      if (error) {
        sdkError = error;
        return { ok: false, error };
      }

      return {
        ok: Boolean(data?.session),
        data
      };
    })
    .catch((error) => {
      sdkError = error;
      return { ok: false, error };
    });

  const start = Date.now();

  while (Date.now() - start < SESSION_CONFIRM_TIMEOUT_MS) {
    if (storedSessionMatches(accessToken)) {
      return { ok: true, source: "storage" };
    }

    const sdkResult = await Promise.race([
      sdkPromise,
      sleep(SESSION_POLL_MS).then(() => null)
    ]);

    if (sdkResult) {
      if (sdkResult.ok) {
        return { ok: true, source: "sdk" };
      }

      if (storedSessionMatches(accessToken)) {
        return { ok: true, source: "storage" };
      }

      throw (
        sdkResult.error ||
        new Error("No se pudo establecer la sesión.")
      );
    }
  }

  if (storedSessionMatches(accessToken)) {
    return { ok: true, source: "storage" };
  }

  throw (
    sdkError ||
    new Error(
      "No fue posible confirmar la sesión. Inténtelo nuevamente."
    )
  );
}

function resetTurnstile() {
  turnstileToken = "";

  if (
    turnstileWidgetId !== null &&
    window.turnstile?.reset
  ) {
    try {
      window.turnstile.reset(turnstileWidgetId);
    } catch {
      // El widget no debe romper el formulario.
    }
  }
}

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[data-sigep-turnstile="true"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              "No se pudo cargar la verificación de seguridad."
            )
          ),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.sigepTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          "No se pudo cargar la verificación de seguridad."
        )
      );

    document.head.appendChild(script);
  });
}

async function initializeTurnstile() {
  if (
    !turnstileSiteKey ||
    !els.turnstileWrap ||
    !els.turnstileWidget
  ) {
    return;
  }

  try {
    await loadTurnstileScript();

    if (!window.turnstile?.render) {
      throw new Error("Turnstile no está disponible.");
    }

    els.turnstileWrap.hidden = false;
    els.turnstileWrap.style.display = "flex";

    turnstileWidgetId = window.turnstile.render(
      els.turnstileWidget,
      {
        sitekey: turnstileSiteKey,
        action: "login",
        theme: "auto",
        callback(token) {
          turnstileToken = String(token || "");
          hideMessage();
        },
        "expired-callback"() {
          turnstileToken = "";
        },
        "error-callback"() {
          turnstileToken = "";
          showMessage(
            "No se pudo completar la verificación de seguridad."
          );
        }
      }
    );
  } catch (error) {
    showMessage(
      error?.message ||
      "No se pudo cargar la verificación de seguridad."
    );
  }
}

/*
 * No hacemos preflight con getSession() en index.html.
 * portal.html valida la sesión de forma autoritativa después del acceso.
 */
if (!configReady) {
  showMessage("Falta configurar js/config.js.");
  els.submit.disabled = true;
}

els.togglePassword.addEventListener("click", () => {
  const isPassword = els.password.type === "password";
  els.password.type = isPassword ? "text" : "password";
  els.togglePassword.textContent = isPassword ? "Ocultar" : "Ver";
  els.togglePassword.setAttribute(
    "aria-label",
    isPassword ? "Ocultar contraseña" : "Mostrar contraseña"
  );
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (els.submit.disabled) return;

  hideMessage();

  const username = els.username.value.trim();
  const password = els.password.value;

  if (!username || !password) {
    showMessage("Complete usuario y contraseña.");
    return;
  }

  if (navigator.onLine === false) {
    showMessage("El dispositivo no tiene conexión a Internet.");
    return;
  }

  if (turnstileSiteKey && !turnstileToken) {
    showMessage("Complete la verificación de seguridad.");
    return;
  }

  setBusy(true, "VERIFICANDO CREDENCIALES…");

  try {
    const result = await invokePublicFunction(
      loginFunctionUrl,
      {
        action: "login",
        usuario: username,
        contrasena: password,
        turnstile_token: turnstileToken || null
      }
    );

    const accessToken = result.session?.access_token;
    const refreshToken = result.session?.refresh_token;

    if (!accessToken || !refreshToken) {
      throw new Error(
        "El servidor no devolvió una sesión válida."
      );
    }

    setBusy(true, "ESTABLECIENDO SESIÓN…");

    await establishSession(accessToken, refreshToken);

    saveLoginContext(
      result.profile,
      result.territorio_inicial
    );

    setBusy(true, "ENTRANDO AL PORTAL…");

    await sleep(180);

    window.location.replace(
      result.profile?.debe_cambiar_contrasena
        ? "cambiar-contrasena.html?obligatorio=1"
        : "portal.html"
    );
  } catch (error) {
    showMessage(
      error?.message ||
      "No se pudo iniciar sesión."
    );

    resetTurnstile();
    setBusy(false);
  }
});

void initializeTurnstile();
