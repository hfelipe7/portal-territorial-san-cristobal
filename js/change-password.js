import {
  supabase,
  appName,
  configReady,
  getSavedLoginContext,
  saveLoginContext
} from "./client.js";

const els = {
  appName: document.querySelector("[data-app-name]"),
  form: document.querySelector("#change-password-form"),
  password: document.querySelector("#new-password"),
  confirm: document.querySelector("#confirm-password"),
  message: document.querySelector("#message"),
  submit: document.querySelector("#submit-button"),
  cancel: document.querySelector("#cancel-button"),
  instruction: document.querySelector("#password-instruction")
};

els.appName.textContent = appName;
const mandatory = new URLSearchParams(window.location.search).get("obligatorio") === "1";
if (mandatory) {
  els.instruction.textContent = "Por seguridad, debe crear una contraseña personal antes de continuar.";
  els.cancel.hidden = true;
}

function showMessage(text, type = "error") {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
  els.message.hidden = false;
}

if (!configReady) {
  showMessage("Falta configurar js/config.js.");
  els.submit.disabled = true;
} else {
  const { data } = await supabase.auth.getSession();
  if (!data.session) window.location.replace("index.html");
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.message.hidden = true;

  if (els.password.value.length < 8) {
    showMessage("La contraseña debe tener al menos 8 caracteres.");
    return;
  }
  if (els.password.value !== els.confirm.value) {
    showMessage("Las contraseñas no coinciden.");
    return;
  }

  els.submit.disabled = true;
  els.submit.textContent = "Guardando…";

  try {
    const { error } = await supabase.auth.updateUser({ password: els.password.value });
    if (error) throw error;

    const { error: rpcError } = await supabase.rpc("confirmar_cambio_contrasena");
    if (rpcError) throw rpcError;

    const context = getSavedLoginContext();
    if (context.profile) {
      context.profile.debe_cambiar_contrasena = false;
      saveLoginContext(context.profile, context.territoryCode);
    }

    showMessage("Contraseña actualizada correctamente.", "success");
    setTimeout(() => window.location.replace("portal.html"), 900);
  } catch (error) {
    showMessage(error.message || "No se pudo actualizar la contraseña.");
  } finally {
    els.submit.disabled = false;
    els.submit.textContent = "Guardar contraseña";
  }
});

els.cancel.addEventListener("click", () => window.location.replace("portal.html"));
