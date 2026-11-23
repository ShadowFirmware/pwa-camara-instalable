'use strict';

/* =========================================================
 * Referencias a la interfaz
 * ========================================================= */
const btnInstalar = document.getElementById('btn-instalar');
const btnPrepararCamara = document.getElementById('btn-preparar-camara');
const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');
const btnCancelarPermiso = document.getElementById('btn-cancelar-permiso');
const btnAlternarCamara = document.getElementById('btn-alternar-camara');
const btnApagarCamara = document.getElementById('btn-apagar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');
const avisoLente = document.getElementById('aviso-lente');
const visorVideo = document.getElementById('visor-camara');
const visorContenedor = document.querySelector('.visor');
const visorVacio = document.getElementById('visor-vacio');
const mensajeEstado = document.getElementById('mensaje-estado');

function actualizarMensajeEstado(texto) {
  mensajeEstado.textContent = texto;
}

/* =========================================================
 * Fase 1: Registro del Service Worker
 * ========================================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((registro) => {
        console.log('[App] Service Worker registrado en:', registro.scope);
      })
      .catch((error) => {
        console.error('[App] Error al registrar el Service Worker:', error);
      });
  });
}

/* =========================================================
 * Fase 1: Instalación personalizada (beforeinstallprompt)
 * ========================================================= */
let eventoInstalacionDiferido = null;

window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;

  // Muestra el botón personalizado de instalación en la UI
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) {
    return;
  }

  eventoInstalacionDiferido.prompt();

  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        console.log('[App] El usuario aceptó la instalación');
        btnInstalar.hidden = true;
      } else {
        console.log('[App] El usuario rechazó la instalación');
      }
    })
    .catch((error) => {
      console.error('[App] Error durante la instalación:', error);
    })
    .finally(() => {
      // El evento solo puede usarse una vez
      eventoInstalacionDiferido = null;
    });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
  actualizarMensajeEstado('Aplicación instalada correctamente.');
});

/* =========================================================
 * Fase 2: Control de cámara
 * ========================================================= */
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal

function nombreLente(modo) {
  return modo === 'environment' ? 'Trasera' : 'Frontal';
}

function actualizarControles(camaraEncendida) {
  btnAlternarCamara.disabled = !camaraEncendida;
  btnApagarCamara.disabled = !camaraEncendida;
  btnPrepararCamara.disabled = camaraEncendida;
  visorVacio.hidden = camaraEncendida;
  visorContenedor.classList.toggle('frontal', camaraEncendida && modoCamaraActual === 'user');
}

// Fragmento C: liberar el sensor antes de cualquier cambio
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

// Fragmento D: encendido con promesas y diagnóstico de errores
function iniciarCamara(modo) {
  detenerCamaraActiva();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Tu navegador no admite acceso a cámara o la página no se sirve por HTTPS.');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  actualizarMensajeEstado(`Encendiendo cámara ${nombreLente(modo).toLowerCase()}...`);
  btnAlternarCamara.disabled = true;

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      actualizarControles(true);
      actualizarMensajeEstado(`Cámara activa (${nombreLente(modo)})`);
    })
    .catch((error) => {
      visorVideo.srcObject = null;
      actualizarControles(false);

      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    });
}

/* =========================================================
 * Fragmento E: Flujo de Pre-Permiso (UX ética)
 * ========================================================= */

// Paso 1: el usuario expresa su intención -> mostramos el aviso explicativo
btnPrepararCamara.addEventListener('click', () => {
  avisoLente.textContent = nombreLente(modoCamaraActual).toLowerCase();
  avisoPermiso.hidden = false;
  avisoPermiso.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Paso 2: el usuario lee el motivo y confirma -> recién aquí se pide el permiso nativo
btnConfirmarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

// Alternativa: el usuario decide no continuar (no se toca el permiso nativo)
btnCancelarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado('No se encendió la cámara. Puedes solicitarla cuando quieras.');
});

/* =========================================================
 * Desafío 2: Alternancia de lentes y apagado
 * ========================================================= */
btnAlternarCamara.addEventListener('click', () => {
  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';
  iniciarCamara(modoCamaraActual);
});

btnApagarCamara.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarControles(false);
  actualizarMensajeEstado('Cámara apagada. El sensor fue liberado.');
});

// Liberar el sensor si la página se oculta o se cierra
window.addEventListener('pagehide', detenerCamaraActiva);
