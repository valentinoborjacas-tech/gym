/* Facturas → Google Sheets  (app para el celular) */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const LS = {
    get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const state = {
    image: null,      // base64 sin prefijo
    mimeType: 'image/jpeg',
    previewUrl: '',
    fields: JSON.parse(LS.get('fields', 'null') || 'null'),
    sheetUrl: LS.get('sheetUrl'),
    history: [],
  };

  /* ---------------- Navegación ---------------- */
  const screens = ['home', 'loading', 'review', 'done', 'settings'];
  function show(name) {
    screens.forEach((s) => $('screen-' + s).classList.toggle('hidden', s !== name));
    $('btnBack').classList.toggle('hidden', name === 'home' || name === 'loading');
    $('btnSettings').classList.toggle('hidden', name === 'settings');
    state.current = name;
    window.scrollTo(0, 0);
  }

  function toast(msg, ms = 2800) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), ms);
  }

  /* ---------------- API (Apps Script) ---------------- */
  async function api(payload) {
    const url = LS.get('apiUrl');
    const token = LS.get('apiToken');
    if (!url || !token) {
      show('settings');
      throw new Error('Primero configura la URL y el token.');
    }
    let res;
    try {
      // text/plain evita el "preflight" CORS que Apps Script no soporta
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, token }),
        redirect: 'follow',
      });
    } catch {
      throw new Error('No se pudo conectar con el script. Revisa tu internet y que la URL esté completa (copiada desde "Implementar → Gestionar implementaciones").');
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      if (res.status === 404 || /no se encontr|not found|unable to open/i.test(text)) {
        throw new Error('La URL no existe (404). Copia otra vez la URL de la implementación; no uses la del editor.');
      }
      if (/accounts\.google|ServiceLogin|sign in|iniciar sesi/i.test(text)) {
        throw new Error('El script pide iniciar sesión. En Apps Script: Implementar → Gestionar implementaciones → ✏️ → "Ejecutar como: Yo" y "Quién tiene acceso: Cualquier persona" → Versión nueva → Implementar.');
      }
      if (/authoriz|autoriz|permis/i.test(text)) {
        throw new Error('Falta autorizar el script. En el editor ejecuta configurarInicial y acepta los permisos.');
      }
      throw new Error(`Respuesta inesperada del script (código ${res.status}). Abre la URL en Safari para ver qué muestra.`);
    }
    if (!data.ok && !data.duplicate) throw new Error(data.error || 'Error desconocido');
    return data;
  }

  async function loadConfig() {
    const data = await api({ action: 'config' });
    state.fields = data.fields;
    state.sheetUrl = data.sheetUrl;
    LS.set('fields', JSON.stringify(data.fields));
    LS.set('sheetUrl', data.sheetUrl);
    updateLinks();
    return data;
  }

  /* ---------------- Imagen ---------------- */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => reject(new Error('No se pudo abrir la imagen'));
      img.src = url;
    });
  }

  // Reduce la foto (máx. 2000px) para que suba rápido y la IA la lea bien
  async function compress(file) {
    const { img, url } = await loadImage(file);
    const MAX = 2000;
    let { naturalWidth: w, naturalHeight: h } = img;
    const scale = Math.min(1, MAX / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { dataUrl, base64: dataUrl.split(',')[1] };
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permite elegir la misma foto otra vez
    if (!file) return;
    try {
      const { dataUrl, base64 } = await compress(file);
      state.image = base64;
      state.previewUrl = dataUrl;
      await extract();
    } catch (err) {
      show('home');
      toast('⚠️ ' + err.message, 4000);
    }
  }

  async function extract() {
    $('loadingPreview').src = state.previewUrl;
    $('loadingText').textContent = 'Leyendo la factura…';
    show('loading');
    const slow = setTimeout(() => {
      $('loadingText').textContent = 'Gemini está lento, probando otro modelo… (puede tardar hasta 1 minuto)';
    }, 12000);
    try {
      const res = await api({ action: 'extract', image: state.image, mimeType: state.mimeType });
      clearTimeout(slow);
      if (res.fields) {
        state.fields = res.fields;
        LS.set('fields', JSON.stringify(res.fields));
      }
      renderForm(res.data || {}, res.dudosos || []);
      $('reviewPreview').src = state.previewUrl;
      setNotice(
        (res.dudosos || []).length
          ? 'warn' : '',
        (res.dudosos || []).length
          ? 'Revisa los campos marcados en amarillo: la IA no estaba segura.' : ''
      );
      show('review');
      validate();
    } catch (err) {
      clearTimeout(slow);
      // Si falla la lectura, igual dejamos llenar a mano
      if (state.fields) {
        renderForm({}, []);
        $('reviewPreview').src = state.previewUrl;
        setNotice('error', 'No se pudo leer automáticamente: ' + err.message + ' Puedes llenarlo a mano o volver a intentar.');
        show('review');
      } else {
        show('home');
        toast('⚠️ ' + err.message, 5000);
      }
    }
  }

  /* ---------------- Formulario ---------------- */
  function renderForm(data, dudosos) {
    const form = $('form');
    form.innerHTML = '';
    (state.fields || []).forEach((f) => {
      const wrap = document.createElement('label');
      wrap.className = 'field' + (dudosos.includes(f.key) ? ' doubt' : '');
      wrap.dataset.key = f.key;

      const lbl = document.createElement('span');
      lbl.textContent = f.label;
      wrap.appendChild(lbl);

      let input;
      if (f.type === 'select') {
        input = document.createElement('select');
        const empty = new Option('— Seleccionar —', '');
        input.appendChild(empty);
        const opts = [...(f.options || [])];
        const v = data[f.key];
        if (v && !opts.includes(v)) opts.push(v);
        opts.forEach((o) => input.appendChild(new Option(o, o)));
      } else if (f.type === 'textarea') {
        input = document.createElement('textarea');
      } else {
        input = document.createElement('input');
        if (f.type === 'date') input.type = 'date';
        else if (f.type === 'number') { input.type = 'text'; input.inputMode = 'decimal'; input.placeholder = '0.00'; }
        else { input.type = 'text'; if (f.inputmode) input.inputMode = f.inputmode; }
      }
      input.name = f.key;
      input.value = data[f.key] ?? '';
      input.addEventListener('input', () => { wrap.classList.remove('doubt'); validate(); });
      input.addEventListener('change', validate);
      wrap.appendChild(input);

      const hint = document.createElement('div');
      hint.className = 'hint';
      wrap.appendChild(hint);

      form.appendChild(wrap);
    });
  }

  function getFormData() {
    const out = {};
    new FormData($('form')).forEach((v, k) => { out[k] = String(v).trim(); });
    return out;
  }

  const num = (s) => {
    if (s === '' || s == null) return NaN;
    return parseFloat(String(s).replace(/[^\d.,-]/g, '').replace(',', '.'));
  };

  function setHint(key, msg) {
    const el = document.querySelector(`.field[data-key="${key}"] .hint`);
    if (el) el.textContent = msg || '';
  }

  // Avisos suaves (no bloquean): RUC, sumas, fecha
  function validate() {
    const d = getFormData();
    ['ruc_emisor', 'subtotal', 'igv', 'total', 'fecha_emision', 'ruc_cliente'].forEach((k) => setHint(k, ''));

    if ('ruc_emisor' in d && d.ruc_emisor && !/^\d{11}$/.test(d.ruc_emisor)) {
      setHint('ruc_emisor', 'El RUC debería tener 11 dígitos.');
    }
    if ('ruc_cliente' in d && d.ruc_cliente && !/^(\d{8}|\d{11})$/.test(d.ruc_cliente)) {
      setHint('ruc_cliente', 'Debería ser DNI (8) o RUC (11 dígitos).');
    }
    const s = num(d.subtotal), i = num(d.igv), t = num(d.total);
    ['subtotal', 'igv', 'total'].forEach((k) => {
      if (k in d && d[k] && isNaN(num(d[k]))) setHint(k, 'No es un número válido.');
    });
    if (!isNaN(s) && !isNaN(i) && !isNaN(t) && Math.abs(s + i - t) > 0.05) {
      setHint('total', `Subtotal + IGV = ${(s + i).toFixed(2)}, no coincide con el total.`);
    }
    if (d.fecha_emision) {
      const f = new Date(d.fecha_emision + 'T12:00:00');
      if (f > new Date()) setHint('fecha_emision', 'La fecha está en el futuro.');
    }
  }

  function setNotice(type, msg) {
    const n = $('notice');
    n.className = 'notice' + (type ? ' ' + type : '');
    n.textContent = msg;
    n.classList.toggle('hidden', !msg);
  }

  async function save(force = false) {
    const d = getFormData();
    if (!d.total && !d.numero && !d.razon_social) {
      setNotice('error', 'El formulario está vacío. Llena al menos los datos principales.');
      return;
    }
    const btn = $('btnSave');
    btn.disabled = true;
    btn.textContent = 'Subiendo…';
    try {
      const res = await api({ action: 'save', data: d, image: state.image, mimeType: state.mimeType, force });
      if (res.duplicate) {
        if (confirm(res.error + '\n\n¿Quieres registrarla de todas formas?')) {
          btn.disabled = false;
          return save(true);
        }
        setNotice('warn', res.error);
        return;
      }
      const count = Number(LS.get('count', '0')) + 1;
      LS.set('count', String(count));
      $('doneText').textContent = `¡Factura registrada en la fila ${res.row}!`;
      state.image = null;
      show('done');
      updateLinks();
    } catch (err) {
      setNotice('error', 'No se pudo subir: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ Subir a Sheets';
    }
  }

  /* ---------------- Ajustes ---------------- */
  function openSettings() {
    $('cfgUrl').value = LS.get('apiUrl');
    $('cfgToken').value = LS.get('apiToken');
    $('settingsMsg').textContent = '';
    show('settings');
  }

  async function saveSettings() {
    // Limpia espacios, saltos de línea y comillas que a veces se pegan al copiar
    const url = $('cfgUrl').value.replace(/\s+/g, '').replace(/[?#].*$/, '');
    const token = $('cfgToken').value.replace(/[\s"'“”]+/g, '');
    $('cfgUrl').value = url;
    $('cfgToken').value = token;
    const msg = $('settingsMsg');
    if (/\/dev$/.test(url)) {
      msg.textContent = '⚠️ Esa es la URL de prueba (/dev). Usa la de "Implementar → Gestionar implementaciones", que termina en /exec.';
      return;
    }
    if (/\/edit|\/home\/projects|docs\.google\.com/.test(url)) {
      msg.textContent = '⚠️ Esa es la URL del editor o de la hoja. Necesitas la URL de la "Aplicación web" (termina en /exec).';
      return;
    }
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
      msg.textContent = '⚠️ La URL debe empezar con https://script.google.com/ y terminar en /exec';
      return;
    }
    if (!token) { msg.textContent = '⚠️ Falta el token.'; return; }
    LS.set('apiUrl', url);
    LS.set('apiToken', token);
    msg.textContent = 'Probando conexión…';
    try {
      await loadConfig();
      msg.textContent = '✅ ¡Conectado!';
      setTimeout(() => show('home'), 800);
    } catch (err) {
      msg.textContent = '❌ ' + err.message;
    }
  }

  function updateLinks() {
    const url = state.sheetUrl;
    ['linkSheet', 'linkSheetDone'].forEach((id) => {
      const a = $(id);
      if (url) { a.href = url; a.classList.remove('hidden'); }
      else a.classList.add('hidden');
    });
    const c = Number(LS.get('count', '0'));
    $('statCount').textContent = c ? `${c} factura${c === 1 ? '' : 's'} registrada${c === 1 ? '' : 's'} desde este celular` : '';
  }

  /* ---------------- Eventos ---------------- */
  $('inputCamera').addEventListener('change', onFile);
  $('inputGallery').addEventListener('change', onFile);
  $('btnSave').addEventListener('click', (e) => { e.preventDefault(); save(); });
  $('btnRetry').addEventListener('click', (e) => { e.preventDefault(); extract(); });
  $('btnDiscard').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('¿Descartar esta factura?')) { state.image = null; show('home'); }
  });
  $('btnAnother').addEventListener('click', () => $('inputCamera').click());
  $('btnSettings').addEventListener('click', openSettings);
  $('btnSaveSettings').addEventListener('click', saveSettings);
  $('btnBack').addEventListener('click', () => {
    if (state.current === 'review' && !confirm('¿Salir sin guardar esta factura?')) return;
    show('home');
  });
  $('form').addEventListener('submit', (e) => e.preventDefault());

  $('reviewPreview').addEventListener('click', () => {
    $('lightbox').querySelector('img').src = state.previewUrl;
    $('lightbox').classList.remove('hidden');
  });
  $('lightbox').addEventListener('click', () => $('lightbox').classList.add('hidden'));

  /* ---------------- Inicio ---------------- */
  updateLinks();
  if (!LS.get('apiUrl') || !LS.get('apiToken')) openSettings();
  else {
    show('home');
    loadConfig().catch(() => {}); // refresca campos en segundo plano
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
