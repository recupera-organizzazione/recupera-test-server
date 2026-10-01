const storageKeys = { session: 'recupera_test_session' };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = { session: readSession(), recoveryAccessToken: null, config: {}, slots: [], appointments: [], waiting: [], notifications: [], authMode: 'login' };
let toastTimer;

function readSession() {
  try { return JSON.parse(localStorage.getItem(storageKeys.session) || 'null'); }
  catch { return null; }
}
function saveSession(session) {
  state.session = session;
  if (session) localStorage.setItem(storageKeys.session, JSON.stringify(session));
  else localStorage.removeItem(storageKeys.session);
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function notify(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}
function formatDate(value, withTime = true) {
  const options = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
  return value ? new Intl.DateTimeFormat('it-IT', options).format(new Date(value)) : 'Data non indicata';
}
function currentRole() { return state.session?.user?.app_metadata?.role || 'patient'; }
function isStaff() { return ['operator', 'admin'].includes(currentRole()); }

async function authRequest(path, body) {
  const { supabaseUrl, supabaseAnonKey } = state.config;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Accesso temporaneamente non disponibile. Riprova più tardi.');
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.msg || data.message || data.error_description || 'Autenticazione non riuscita.');
    error.code = data.code || data.error_code || data.error || '';
    throw error;
  }
  return data;
}
function authErrorMessage(error) {
  const code = String(error.code || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) return 'Conferma il tuo indirizzo email dal link che ti abbiamo inviato, poi accedi.';
  if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) return 'Email o password non corrispondono. Controlla l’indirizzo oppure recupera la password.';
  if (code.includes('user_already_exists') || message.includes('user already registered')) return 'Esiste già un account con questa email. Accedi o recupera la password.';
  if (code.includes('over_email_send_rate_limit') || message.includes('rate limit')) return 'Hai richiesto troppe email in poco tempo. Attendi qualche minuto e riprova.';
  if (message === 'failed to fetch') return 'Connessione non disponibile. Controlla la rete e riprova.';
  return error.message || 'Non è stato possibile completare la richiesta.';
}
async function updateRecoveredPassword(password) {
  const { supabaseUrl, supabaseAnonKey } = state.config;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${state.recoveryAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.msg || data.message || 'Non è stato possibile aggiornare la password.');
    error.code = data.code || data.error_code || '';
    throw error;
  }
  return data;
}
async function refreshSession() {
  if (!state.session?.refresh_token) return false;
  try {
    const next = await authRequest('token?grant_type=refresh_token', { refresh_token: state.session.refresh_token });
    saveSession(next);
    return true;
  } catch {
    saveSession(null);
    showAuth();
    return false;
  }
}
async function apiRequest(path, options = {}, mayRefresh = true) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${state.session.access_token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && mayRefresh && await refreshSession()) return apiRequest(path, options, false);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'La richiesta non è riuscita.');
  return data;
}
function setApiStatus(online, text) {
  const status = $('.api-state');
  status.classList.toggle('online', online);
  status.classList.toggle('offline', !online);
  $('#apiStatus').textContent = text;
  $('#footerStatus').textContent = online ? 'Disponibile' : 'Momentaneamente non disponibile';
}
async function checkApi() {
  try {
    const response = await fetch('health');
    const data = await response.json();
    setApiStatus(response.ok && data.status === 'ok', response.ok ? 'Servizio disponibile' : 'Riprova tra poco');
  } catch { setApiStatus(false, 'Riprova tra poco'); }
}
function showAuth() {
  $('#authView').classList.remove('hidden');
  $('#workspace').classList.add('hidden');
  $('#logoutButton').classList.add('hidden');
}
function showWorkspace() {
  $('#authView').classList.add('hidden');
  $('#workspace').classList.remove('hidden');
  $('#logoutButton').classList.remove('hidden');
  const user = state.session?.user || {};
  const firstName = user.user_metadata?.first_name || '';
  const lastName = user.user_metadata?.last_name || '';
  $('#userEmail').textContent = user.user_metadata?.full_name || [firstName, lastName].filter(Boolean).join(' ') || user.email || 'Utente';
  $('#userAvatar').textContent = (firstName || user.email || 'R').charAt(0).toUpperCase();
  $('#userRole').textContent = ({ patient: 'Paziente', operator: 'Operatore', admin: 'Amministratore', regional_admin: 'Amministratore regionale' })[currentRole()] || 'Utente';
  $$('.patient-only').forEach(node => node.classList.toggle('hidden', isStaff()));
  $$('.staff-only').forEach(node => node.classList.toggle('hidden', !isStaff()));
  $('#todayDate').textContent = new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(new Date());
  setView('overview');
  loadDashboard();
}
function setView(name) {
  if (['appointments', 'waiting'].includes(name) && isStaff()) return;
  if (name === 'staff' && !isStaff()) return;
  $$('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.view === name));
  $$('.view-panel').forEach(node => node.classList.toggle('hidden', node.dataset.panel !== name));
  const titles = {
    overview: ['IL TUO SPAZIO', 'Panoramica'],
    appointments: ['IL TUO PERCORSO', 'Appuntamenti'],
    waiting: ['RICHIESTE ATTIVE', 'Lista d’attesa'],
    staff: ['GESTIONE OPERATIVA', 'Gestione slot']
  };
  $('#pageEyebrow').textContent = titles[name][0];
  $('#pageTitle').textContent = titles[name][1];
}
async function loadDashboard() {
  if (!state.session?.access_token) return;
  try {
    const calls = [apiRequest('api/slots')];
    if (!isStaff()) calls.push(apiRequest('api/appointments/me'), apiRequest('api/waitlist/me'), apiRequest('api/notifications/me'));
    const result = await Promise.all(calls);
    state.slots = result[0].items || [];
    if (!isStaff()) {
      state.appointments = result[1].items || [];
      state.waiting = result[2].items || [];
      state.notifications = result[3].items || [];
    }
    renderDashboard();
    setApiStatus(true, 'Servizio disponibile');
  } catch (error) {
    notify(error.message, true);
    if (/token|autentic/i.test(error.message)) saveSession(null);
    if (!state.session) showAuth();
  }
}
function emptyState(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }
function slotRow(slot, staff = false) {
  const endTime = new Intl.DateTimeFormat('it-IT', { timeStyle: 'short' }).format(new Date(slot.endAt));
  const patientField = staff ? `<input class="patient-id-input" data-patient-for="${escapeHtml(slot.id)}" aria-label="ID paziente" placeholder="ID paziente">` : '';
  return `<article class="list-row"><div class="row-main"><strong>${escapeHtml(slot.specialtyId)}</strong><span>${escapeHtml(slot.facilityId)}${slot.professionalId ? ` · ${escapeHtml(slot.professionalId)}` : ''}</span></div><div class="row-detail">${escapeHtml(formatDate(slot.startAt))}<br>fino alle ${escapeHtml(endTime)}</div><div class="row-actions">${patientField}<button class="button button-primary" type="button" data-book="${escapeHtml(slot.id)}">Prenota</button></div></article>`;
}
function renderDashboard() {
  const activeAppointments = state.appointments.filter(item => item.status === 'booked').length;
  const activeWaitlist = state.waiting.filter(item => item.status === 'waiting').length;
  $('#appointmentCount').textContent = activeAppointments;
  $('#waitingCount').textContent = activeWaitlist;
  $('#slotCount').textContent = state.slots.length;
  $('#slotListCount').textContent = state.slots.length;
  $('#slotList').innerHTML = state.slots.length ? state.slots.map(slot => slotRow(slot)).join('') : emptyState('Nessuno slot disponibile al momento.');
  $('#staffSlotList').innerHTML = state.slots.length ? state.slots.map(slot => slotRow(slot, true)).join('') : emptyState('Non ci sono slot disponibili.');
  $('#appointmentList').innerHTML = state.appointments.length ? state.appointments.map(item => `<article class="list-row"><div class="row-main"><strong>${escapeHtml(item.specialtyId)}</strong><span>${escapeHtml(item.facilityId)}</span></div><div class="row-detail">${escapeHtml(formatDate(item.startAt))}<br>${escapeHtml(item.status === 'booked' ? 'Confermato' : 'Annullato')}</div><div class="row-actions">${item.status === 'booked' ? `<button class="button button-danger" type="button" data-cancel="${escapeHtml(item.id)}">Annulla</button>` : ''}</div></article>`).join('') : emptyState('Non hai ancora appuntamenti.');
  $('#waitingList').innerHTML = state.waiting.length ? state.waiting.map(item => `<article class="list-row"><div class="row-main"><strong>${escapeHtml(item.specialtyId)}</strong><span>${escapeHtml((item.facilityIds || []).join(', ') || 'Qualsiasi sede')}</span></div><div class="row-detail">${escapeHtml(item.status === 'waiting' ? 'In attesa' : item.status === 'matched' ? 'Abbinata' : 'Ritirata')}<br>Inserita il ${escapeHtml(formatDate(item.createdAt, false))}</div><div class="row-actions">${item.status === 'waiting' ? `<button class="button button-danger" type="button" data-withdraw="${escapeHtml(item.id)}">Ritira</button>` : ''}</div></article>`).join('') : emptyState('La lista d’attesa è vuota.');
  $('#notificationList').innerHTML = state.notifications.length ? state.notifications.slice(0, 4).map(item => `<article class="list-row"><div class="row-main"><strong>${escapeHtml(item.type === 'waitlist_match' ? 'È disponibile un appuntamento' : item.type)}</strong><span>${escapeHtml(item.status === 'pending' ? 'Da inviare' : item.status)}</span></div><div class="row-detail">${escapeHtml(formatDate(item.createdAt))}</div><span class="row-id">${escapeHtml(item.slotId.slice(0, 8))}</span></article>`).join('') : emptyState('Nessuna notifica recente.');
}
function valuesFrom(form) { return Object.fromEntries(new FormData(form).entries()); }
function toIso(value) { return value ? new Date(value).toISOString() : undefined; }
async function createWaitlist(form) {
  const values = valuesFrom(form);
  const body = {
    specialtyId: values.specialtyId.trim(),
    facilityIds: values.facilityIds.split(',').map(value => value.trim()).filter(Boolean),
    earliestDate: toIso(values.earliestDate),
    latestDate: toIso(values.latestDate)
  };
  for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];
  await apiRequest('api/waitlist', { method: 'POST', body: JSON.stringify(body) });
  form.reset();
  notify('Richiesta aggiunta alla lista d’attesa.');
  await loadDashboard();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === 'signup';
  const recovery = mode === 'recovery';
  const update = mode === 'update';
  $('#nameFields').classList.toggle('hidden', !signup);
  $('#firstName').required = signup;
  $('#lastName').required = signup;
  $('#emailField').classList.toggle('hidden', update);
  $('#email').required = !update;
  $('#passwordField').classList.toggle('hidden', recovery);
  $('#password').required = !recovery;
  $('#confirmPasswordField').classList.toggle('hidden', !update);
  $('#passwordConfirm').required = update;
  $('#forgotPasswordButton').classList.toggle('hidden', mode !== 'login');
  $('.auth-switch').classList.toggle('hidden', update);
  $('#authTitle').textContent = ({ login: 'Bentornato', signup: 'Crea il tuo account', recovery: 'Recupera password', update: 'Scegli una nuova password' })[mode];
  $('#authSubmit').innerHTML = ({ login: 'Accedi <span aria-hidden="true">→</span>', signup: 'Crea account <span aria-hidden="true">→</span>', recovery: 'Invia link <span aria-hidden="true">→</span>', update: 'Salva password <span aria-hidden="true">→</span>' })[mode];
  $('#authModeLabel').textContent = mode === 'login' ? 'Non hai un account?' : 'Hai già un account?';
  $('#authModeButton').textContent = mode === 'login' ? 'Crea account' : 'Accedi';
  $('#password').autocomplete = signup || update ? 'new-password' : 'current-password';
}
$('#authModeButton').addEventListener('click', () => setAuthMode(state.authMode === 'login' ? 'signup' : 'login'));
$('#forgotPasswordButton').addEventListener('click', () => {
  $('#password').value = '';
  setAuthMode('recovery');
});
$('#authForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#authSubmit');
  button.disabled = true;
  try {
    const email = $('#email').value.trim();
    if (state.authMode === 'recovery') {
      await authRequest(`recover?redirect_to=${encodeURIComponent(window.location.origin)}`, { email });
      notify('Se l’indirizzo è registrato, riceverai un link per reimpostare la password.');
      setAuthMode('login');
      return;
    }
    if (state.authMode === 'update') {
      const password = $('#password').value;
      if (password !== $('#passwordConfirm').value) throw new Error('Le password non coincidono.');
      await updateRecoveredPassword(password);
      state.recoveryAccessToken = null;
      window.history.replaceState({}, document.title, window.location.pathname);
      $('#password').value = '';
      $('#passwordConfirm').value = '';
      setAuthMode('login');
      $('#configStatus').textContent = 'Password aggiornata. Accedi con la nuova password.';
      notify('Password aggiornata. Ora puoi accedere.');
      return;
    }
    const endpoint = state.authMode === 'login' ? 'token?grant_type=password' : 'signup';
    const body = { email, password: $('#password').value };
    if (state.authMode === 'signup') {
      const firstName = $('#firstName').value.trim();
      const lastName = $('#lastName').value.trim();
      body.data = { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}` };
    }
    const result = await authRequest(endpoint, body);
    if (!result.access_token) {
      const alreadyExists = result.user?.identities?.length === 0;
      if (alreadyExists) {
        notify('Esiste già un account con questa email. Accedi o recupera la password.', true);
        setAuthMode('login');
        return;
      }
      notify('Account creato. Controlla la tua email per completare la registrazione.');
      setAuthMode('login');
      $('#password').value = '';
      return;
    }
    saveSession(result);
    showWorkspace();
  } catch (error) { notify(authErrorMessage(error), true); }
  finally { button.disabled = !state.config.supabaseAnonKey; }
});
$('#logoutButton').addEventListener('click', () => { saveSession(null); showAuth(); notify('Sessione terminata.'); });
$$('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('#refreshButton').addEventListener('click', loadDashboard);
$('#quickWaitlistForm').addEventListener('submit', event => { event.preventDefault(); createWaitlist(event.currentTarget).catch(error => notify(error.message, true)); });
$('#waitlistForm').addEventListener('submit', event => { event.preventDefault(); createWaitlist(event.currentTarget).catch(error => notify(error.message, true)); });
$('#slotForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = valuesFrom(form);
  try {
    await apiRequest('api/slots', { method: 'POST', body: JSON.stringify({
      specialtyId: values.specialtyId.trim(), facilityId: values.facilityId.trim(),
      professionalId: values.professionalId.trim() || undefined,
      startAt: toIso(values.startAt), endAt: toIso(values.endAt)
    }) });
    form.reset();
    notify('Slot creato.');
    await loadDashboard();
  } catch (error) { notify(error.message, true); }
});
document.addEventListener('click', async event => {
  const book = event.target.closest('[data-book]');
  const cancel = event.target.closest('[data-cancel]');
  const withdraw = event.target.closest('[data-withdraw]');
  try {
    if (book) {
      const body = {};
      if (isStaff()) {
        const input = document.querySelector(`[data-patient-for="${CSS.escape(book.dataset.book)}"]`);
        body.patientId = input?.value.trim();
        if (!body.patientId) throw new Error('Inserisci l’ID Supabase del paziente.');
      }
      await apiRequest(`api/slots/${encodeURIComponent(book.dataset.book)}/book`, { method: 'POST', body: JSON.stringify(body) });
      notify('Appuntamento prenotato.');
      await loadDashboard();
    } else if (cancel) {
      await apiRequest(`api/appointments/${encodeURIComponent(cancel.dataset.cancel)}/cancel`, { method: 'POST', body: '{}' });
      notify('Appuntamento annullato.');
      await loadDashboard();
    } else if (withdraw) {
      await apiRequest(`api/waitlist/${encodeURIComponent(withdraw.dataset.withdraw)}`, { method: 'DELETE' });
      notify('Richiesta ritirata.');
      await loadDashboard();
    }
  } catch (error) { notify(error.message, true); }
});

async function initialize() {
  checkApi();
  try {
    const response = await fetch('client-config');
    if (!response.ok) throw new Error('Configurazione non disponibile.');
    state.config = await response.json();
    const ready = Boolean(state.config.supabaseUrl && state.config.supabaseAnonKey);
    $('#configStatus').textContent = ready
      ? 'Accedi o crea un account per continuare.'
      : 'Accesso temporaneamente non disponibile. Riprova più tardi.';
    $('#configStatus').classList.toggle('error', !ready);
    $('#authSubmit').disabled = !ready;
    const recoveryParams = new URLSearchParams(window.location.hash.slice(1));
    const recoveryToken = recoveryParams.get('access_token');
    if (recoveryParams.get('type') === 'recovery' && recoveryToken) {
      state.recoveryAccessToken = recoveryToken;
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthMode('update');
      $('#configStatus').textContent = 'Scegli una nuova password per il tuo account.';
      showAuth();
      return;
    }
  } catch {
    $('#configStatus').textContent = 'Accesso temporaneamente non disponibile. Riprova più tardi.';
    $('#configStatus').classList.add('error');
    $('#authSubmit').disabled = true;
  }
  if (state.session?.access_token) showWorkspace();
  else showAuth();
}
initialize();
