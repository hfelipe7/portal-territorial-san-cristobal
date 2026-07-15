import {
  supabase,
  appName,
  configReady,
  loginFunctionUrl,
  invokePublicFunction,
  saveLoginContext
} from "./client.js";

const els = {
  appName: document.querySelector("[data-app-name]"),
  form: document.querySelector("#login-form"),
  territory: document.querySelector("#territory"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  message: document.querySelector("#message"),
  submit: document.querySelector("#submit-button"),
  togglePassword: document.querySelector("#toggle-password")
};

if (els.appName) els.appName.textContent = appName;

function showMessage(text, type = "error") {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  els.message.hidden = false;
}

function setBusy(busy) {
  els.submit.disabled = busy;
  els.territory.disabled = busy;
  els.username.disabled = busy;
  els.password.disabled = busy;
  els.submit.querySelector("span").textContent = busy ? "VERIFICANDO…" : "INICIAR SESIÓN";
}

async function loadTerritories() {
  els.territory.innerHTML = '<option value="">Cargando territorios…</option>';
  try {
    const data = await invokePublicFunction(loginFunctionUrl, {
      action: "list_territories"
    });

    const territories = Array.isArray(data.territories) ? data.territories : [];
    els.territory.innerHTML = [
      '<option value="">Seleccione un territorio</option>',
      ...territories.map(
        (item) => `<option value="${String(item.codigo)}">${String(item.nombre)}</option>`
      )
    ].join("");
  } catch (error) {
    els.territory.innerHTML = '<option value="">No se pudieron cargar los territorios</option>';
    showMessage(error.message || "No se pudieron cargar los territorios.");
  }
}

if (!configReady) {
  showMessage("Falta colocar la Publishable Key en js/config.js.");
  els.submit.disabled = true;
} else {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    window.location.replace("portal.html");
  } else {
    await loadTerritories();
  }
}

els.togglePassword.addEventListener("click", () => {
  const isPassword = els.password.type === "password";
  els.password.type = isPassword ? "text" : "password";
  els.togglePassword.textContent = isPassword ? "Ocultar" : "Ver";
  els.togglePassword.setAttribute("aria-label", isPassword ? "Ocultar contraseña" : "Mostrar contraseña");
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.message.hidden = true;

  const territoryCode = els.territory.value;
  const username = els.username.value.trim();
  const password = els.password.value;

  if (!territoryCode || !username || !password) {
    showMessage("Complete territorio, usuario y contraseña.");
    return;
  }

  setBusy(true);

  try {
    const result = await invokePublicFunction(loginFunctionUrl, {
      action: "login",
      territorio_codigo: territoryCode,
      usuario: username,
      contrasena: password
    });

    const { error } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token
    });

    if (error) throw error;

    saveLoginContext(result.profile, result.territorio_inicial);

    window.location.replace(
      result.profile?.debe_cambiar_contrasena
        ? "cambiar-contrasena.html?obligatorio=1"
        : "portal.html"
    );
  } catch (error) {
    showMessage(error.message || "No se pudo iniciar sesión.");
  } finally {
    setBusy(false);
  }
});
