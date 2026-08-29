import {
  supabase,
  appName,
  configReady,
  loginFunctionUrl,
  invokePublicFunction,
  saveLoginContext,
  withTimeout,
  AUTH_TIMEOUT_MS
} from "./client.js?v=LOGIN_NO_SELECTOR_V2_0";

const els = {
  appName:
    document.querySelector(
      "[data-app-name]"
    ),
  form:
    document.querySelector(
      "#login-form"
    ),
  username:
    document.querySelector(
      "#username"
    ),
  password:
    document.querySelector(
      "#password"
    ),
  message:
    document.querySelector(
      "#message"
    ),
  submit:
    document.querySelector(
      "#submit-button"
    ),
  togglePassword:
    document.querySelector(
      "#toggle-password"
    ),
  turnstileWrap:
    document.querySelector(
      "#turnstile-wrap"
    ),
  turnstileWidget:
    document.querySelector(
      "#turnstile-widget"
    )
};

if (els.appName) {
  els.appName.textContent =
    appName;
}

let turnstileToken = "";
let turnstileWidgetId = null;

const turnstileSiteKey =
  String(
    window.APP_CONFIG
      ?.TURNSTILE_SITE_KEY ||
    ""
  ).trim();

function showMessage(
  text,
  type = "error"
) {
  els.message.textContent = text;
  els.message.className =
    `message ${type}`;
  els.message.hidden = false;
}

function hideMessage() {
  els.message.hidden = true;
}

function setBusy(busy) {
  els.submit.disabled = busy;
  els.username.disabled = busy;
  els.password.disabled = busy;

  const label =
    els.submit.querySelector("span");

  if (label) {
    label.textContent =
      busy
        ? "VERIFICANDO…"
        : "INICIAR SESIÓN";
  }
}

function resetTurnstile() {
  turnstileToken = "";

  if (
    turnstileWidgetId !== null &&
    window.turnstile?.reset
  ) {
    try {
      window.turnstile.reset(
        turnstileWidgetId
      );
    } catch {
      // La ausencia del widget no debe romper el formulario.
    }
  }
}

function loadTurnstileScript() {
  return new Promise(
    (resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }

      const existing =
        document.querySelector(
          'script[data-sigep-turnstile="true"]'
        );

      if (existing) {
        existing.addEventListener(
          "load",
          () => resolve(),
          { once: true }
        );

        existing.addEventListener(
          "error",
          () => reject(
            new Error(
              "No se pudo cargar la verificación de seguridad."
            )
          ),
          { once: true }
        );

        return;
      }

      const script =
        document.createElement(
          "script"
        );

      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

      script.async = true;
      script.defer = true;
      script.dataset.sigepTurnstile =
        "true";

      script.onload =
        () => resolve();

      script.onerror =
        () => reject(
          new Error(
            "No se pudo cargar la verificación de seguridad."
          )
        );

      document.head.appendChild(
        script
      );
    }
  );
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

    if (
      !window.turnstile?.render
    ) {
      throw new Error(
        "Turnstile no está disponible."
      );
    }

    els.turnstileWrap.hidden =
      false;
    els.turnstileWrap.style.display =
      "flex";

    turnstileWidgetId =
      window.turnstile.render(
        els.turnstileWidget,
        {
          sitekey:
            turnstileSiteKey,
          action: "login",
          theme: "auto",
          callback(token) {
            turnstileToken =
              String(token || "");
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
 * No se usa top-level await.
 * Una sesión previa no puede bloquear el formulario de acceso.
 */
async function checkExistingSession() {
  if (!configReady) {
    showMessage(
      "Falta configurar js/config.js."
    );
    els.submit.disabled = true;
    return;
  }

  try {
    const {
      data,
      error
    } = await withTimeout(
      supabase.auth.getSession(),
      AUTH_TIMEOUT_MS,
      "La validación de una sesión previa tardó demasiado."
    );

    if (error) {
      throw error;
    }

    if (data.session) {
      window.location.replace(
        "portal.html"
      );
    }
  } catch (error) {
    console.warn(
      "Session preflight skipped:",
      error
    );

    // No bloquear el login por una sesión previa dañada.
  }
}

els.togglePassword.addEventListener(
  "click",
  () => {
    const isPassword =
      els.password.type ===
      "password";

    els.password.type =
      isPassword
        ? "text"
        : "password";

    els.togglePassword.textContent =
      isPassword
        ? "Ocultar"
        : "Ver";

    els.togglePassword.setAttribute(
      "aria-label",
      isPassword
        ? "Ocultar contraseña"
        : "Mostrar contraseña"
    );
  }
);

els.form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (els.submit.disabled) {
      return;
    }

    hideMessage();

    const username =
      els.username.value
        .trim();

    const password =
      els.password.value;

    if (!username || !password) {
      showMessage(
        "Complete usuario y contraseña."
      );
      return;
    }

    if (
      navigator.onLine === false
    ) {
      showMessage(
        "El dispositivo no tiene conexión a Internet."
      );
      return;
    }

    if (
      turnstileSiteKey &&
      !turnstileToken
    ) {
      showMessage(
        "Complete la verificación de seguridad."
      );
      return;
    }

    setBusy(true);

    try {
      const result =
        await invokePublicFunction(
          loginFunctionUrl,
          {
            action: "login",
            usuario: username,
            contrasena: password,
            turnstile_token:
              turnstileToken || null
          }
        );

      const accessToken =
        result.session
          ?.access_token;

      const refreshToken =
        result.session
          ?.refresh_token;

      if (
        !accessToken ||
        !refreshToken
      ) {
        throw new Error(
          "El servidor no devolvió una sesión válida."
        );
      }

      const {
        error
      } = await withTimeout(
        supabase.auth.setSession({
          access_token:
            accessToken,
          refresh_token:
            refreshToken
        }),
        AUTH_TIMEOUT_MS,
        "La sesión tardó demasiado en guardarse. Inténtelo nuevamente."
      );

      if (error) {
        throw error;
      }

      saveLoginContext(
        result.profile,
        result.territorio_inicial
      );

      window.location.replace(
        result.profile
          ?.debe_cambiar_contrasena
          ? "cambiar-contrasena.html?obligatorio=1"
          : "portal.html"
      );
    } catch (error) {
      showMessage(
        error?.message ||
        "No se pudo iniciar sesión."
      );

      resetTurnstile();
    } finally {
      setBusy(false);
    }
  }
);

void checkExistingSession();
void initializeTurnstile();
