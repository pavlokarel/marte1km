import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const stage = document.querySelector('.stage');
const status = document.querySelector('#cinemaStatus');
const planetButton = document.querySelector('#planetButton');
const buyPanel = document.querySelector('#buyPanel');
const closePanel = document.querySelector('#closePanel');
const modal = document.querySelector('#modal');
const certificateStep = document.querySelector('#certificateStep');
const paymentStep = document.querySelector('#paymentStep');
const paymentTotal = document.querySelector('#paymentTotal');
const closeModal = document.querySelector('#closeModal');
const authModal = document.querySelector('#authModal');
const closeAuth = document.querySelector('#closeAuth');
const loginButton = document.querySelector('#loginButton');
const registerButton = document.querySelector('#registerButton');
const authLoginTab = document.querySelector('#authLoginTab');
const authRegisterTab = document.querySelector('#authRegisterTab');
const authTitle = document.querySelector('#authTitle');
const authCopy = document.querySelector('#authCopy');
const authForm = document.querySelector('#authForm');
const authEmail = document.querySelector('#authEmail');
const authNickname = document.querySelector('#authNickname');
const nicknameField = document.querySelector('#nicknameField');
const authPassword = document.querySelector('#authPassword');
const authConsentField = document.querySelector('#authConsentField');
const authConsent = document.querySelector('#authConsent');
const authSubmit = document.querySelector('#authSubmit');
const authStatus = document.querySelector('#authStatus');
const forgotPasswordButton = document.querySelector('#forgotPasswordButton');
const accountDashboard = document.querySelector('#accountDashboard');
const accountNickname = document.querySelector('#accountNickname');
const accountEmail = document.querySelector('#accountEmail');
const accountKm = document.querySelector('#accountKm');
const accountOrders = document.querySelector('#accountOrders');
const accountTotal = document.querySelector('#accountTotal');
const accountOrdersList = document.querySelector('#accountOrdersList');
const accountLogout = document.querySelector('#accountLogout');
let authMode = 'login';
const quantity = document.querySelector('#quantity');
const total = document.querySelector('#total');
const quoteLine = document.querySelector('#quoteLine');
const quoteSubtotal = document.querySelector('#quoteSubtotal');
const quoteGrandTotal = document.querySelector('#quoteGrandTotal');
const terraformYears = document.querySelector('#terraformYears');
const terraformYearsValue = document.querySelector('#terraformYearsValue');
const terraformCurrentValue = document.querySelector('#terraformCurrentValue');
const terraformFutureValue = document.querySelector('#terraformFutureValue');
const terraformGrowth = document.querySelector('#terraformGrowth');
const terraformMetrics = document.querySelector('.terraform-metrics');
const terraformChartLine = document.querySelector('#terraformChartLine');
const terraformChartArea = document.querySelector('#terraformChartArea');
const terraformChartDots = document.querySelector('#terraformChartDots');
const terraformChartEnd = document.querySelector('#terraformChartEnd');
const terraformChartYears = document.querySelector('#terraformChartYears');
let terraformHasRendered = false;
const remainingPercent = document.querySelector('#remainingPercent');
const remainingMeter = document.querySelector('#remainingMeter');
const surfaceSummary = document.querySelector('#surfaceSummary');
const MARS_SURFACE_KM2 = 144800000;
const telemetryTick = document.querySelector('#telemetryTick');
const missionStartTime = performance.now();
const certificateQuantity = document.querySelector('#certificateQuantity');
const surfaceCoordinates = document.querySelector('#surfaceCoordinates');
const coordinateCenter = document.querySelector('#coordinateCenter');
const coordinateBounds = document.querySelector('#coordinateBounds');
const coordinateReadout = document.querySelector('#coordinateReadout');
const weatherHud = document.querySelector('#weatherHud');
const weatherReadoutPanel = document.querySelector('#weatherReadoutPanel');
const LOT_LAT = 18.532400;
const LOT_LON = 226.120900;
const satelliteViewer = document.querySelector('#satelliteViewer');
const satelliteStage = document.querySelector('#satelliteStage');
const satelliteImage = document.querySelector('#satelliteImage');
const satelliteSelection = document.querySelector('#satelliteSelection');
const satelliteCoordinates = document.querySelector('#satelliteCoordinates');
const satelliteCraterName = document.querySelector('#satelliteCraterName');
const satelliteCraterInfo = document.querySelector('#satelliteCraterInfo');
let satelliteScale = 1;
let satellitePanX = 0;
let satellitePanY = 0;
let satelliteDragging = false;
let satelliteStartX = 0;
let satelliteStartY = 0;
let satelliteOriginX = 0;
let satelliteOriginY = 0;
let pageLockY = 0;
function lockPage() {
  pageLockY = window.scrollY;
  document.documentElement.classList.add('page-locked');
  document.body.classList.add('page-locked');
  document.body.style.top = `-${pageLockY}px`;
}
function unlockPage() {
  document.documentElement.classList.remove('page-locked');
  document.body.classList.remove('page-locked');
  document.body.style.top = '';
  window.scrollTo(0, pageLockY);
}
let audioContext;
function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  const forgot = mode === 'forgot';
  authTitle.textContent = registering ? 'Crea il tuo account' : forgot ? 'Recupera la password' : 'Accedi alla tua missione';
  authCopy.textContent = registering ? 'Salva nickname, certificati e codici missione in un unico profilo.' : forgot ? 'Inserisci la tua email: se è associata a un account riceverai un link sicuro.' : 'Ritrova certificati, codici missione e ordini associati alla tua email.';
  authLoginTab.classList.toggle('is-active', !registering);
  authRegisterTab.classList.toggle('is-active', registering);
  authLoginTab.hidden = forgot; authRegisterTab.hidden = forgot;
  nicknameField.hidden = !registering;
  authConsentField.hidden = !registering;
  authPassword.parentElement.hidden = forgot;
  forgotPasswordButton.hidden = registering || forgot;
  authNickname.required = registering;
  authConsent.required = registering;
  authPassword.required = !forgot;
  authPassword.autocomplete = registering ? 'new-password' : 'current-password';
  authSubmit.innerHTML = `${registering ? 'Registrati' : forgot ? 'Invia link' : 'Accedi'} <span>↗</span>`;
  authStatus.textContent = '';
  authStatus.dataset.kind = '';
}
function openAuth(mode = 'login') {
  setAuthMode(mode);
  authModal.hidden = false;
  document.body.classList.add('page-locked');
  authEmail.focus();
}
function closeAuthModal() {
  authModal.hidden = true;
  document.body.classList.remove('page-locked');
  authForm.reset();
  setAuthMode('login');
}
async function demoPasswordHash(password) { const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)); return [...new Uint8Array(data)].map(value => value.toString(16).padStart(2, '0')).join(''); }
function readDemoAccount() { try { return JSON.parse(localStorage.getItem('marte_demo_account') || 'null'); } catch { return null; } }
function readDemoPurchases(email) { try { return JSON.parse(localStorage.getItem(`marte_demo_purchases_${email}`) || '[]'); } catch { return []; } }
function showAccountDashboard(user) {
  const purchases = readDemoPurchases(user.email);
  accountNickname.textContent = user.nickname || 'Esploratore'; accountEmail.textContent = user.email;
  accountKm.textContent = purchases.reduce((sum, item) => sum + Number(item.km || 0), 0);
  accountOrders.textContent = purchases.length;
  accountTotal.textContent = `${purchases.reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2).replace('.', ',')} €`;
  accountOrdersList.innerHTML = purchases.length ? purchases.map(item => `<div class="account-order-row"><span><strong>${item.km} km²</strong><small>${item.date} · ${item.status || 'In attesa'}</small></span><b>${Number(item.total).toFixed(2).replace('.', ',')} €</b></div>`).join('') : '<p class="empty-orders">Nessun acquisto ancora. Il tuo primo settore ti aspetta su Marte.</p>';
  authForm.hidden = true; document.querySelector('.auth-tabs').hidden = true; authCopy.hidden = true; accountDashboard.hidden = false;
  fetch('/api/account/summary', { credentials: 'include', headers: { Accept: 'application/json' } }).then(response => response.ok ? response.json() : null).then(summary => {
    if (!summary?.purchases) return;
    accountKm.textContent = summary.totals.km; accountOrders.textContent = summary.totals.orders; accountTotal.textContent = `${Number(summary.totals.amount).toFixed(2).replace('.', ',')} €`;
    accountOrdersList.innerHTML = summary.purchases.length ? summary.purchases.map(item => `<div class="account-order-row"><span><strong>${item.km} km²</strong><small>${item.date} · ${item.status}</small></span><b>${Number(item.total).toFixed(2).replace('.', ',')} €</b></div>`).join('') : '<p class="empty-orders">Nessun acquisto ancora. Il tuo primo settore ti aspetta su Marte.</p>';
  }).catch(() => {});
}
function resetAccountDashboard() { authForm.hidden = false; document.querySelector('.auth-tabs').hidden = false; authCopy.hidden = false; accountDashboard.hidden = true; }
accountLogout?.addEventListener('click', () => { localStorage.removeItem('marte_demo_session'); resetAccountDashboard(); setAuthMode('login'); authStatus.textContent = 'Sessione chiusa.'; });
loginButton?.addEventListener('click', () => openAuth('login'));
registerButton?.addEventListener('click', () => openAuth('register'));
closeAuth?.addEventListener('click', closeAuthModal);
authLoginTab?.addEventListener('click', () => setAuthMode('login'));
authRegisterTab?.addEventListener('click', () => setAuthMode('register'));
forgotPasswordButton?.addEventListener('click', () => setAuthMode('forgot'));
authModal?.addEventListener('click', (event) => { if (event.target === authModal) closeAuthModal(); });
authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (authMode !== 'forgot' && password.length < 8) || (authMode === 'register' && (!authNickname.value.trim() || !authConsent.checked))) {
    authStatus.textContent = 'Controlla email, password e consenso Privacy.';
    authStatus.dataset.kind = 'error';
    return;
  }
  authSubmit.disabled = true;
  authStatus.textContent = authMode === 'register' ? 'Creo il profilo missione…' : authMode === 'forgot' ? 'Preparo il recupero…' : 'Verifico le credenziali…';
  try {
    const endpoint = authMode === 'forgot' ? 'forgot-password' : authMode;
    const payload = authMode === 'forgot' ? { email } : { email, password, nickname: authNickname.value.trim() };
    const response = await fetch('/api/auth/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Operazione non disponibile');
    if (authMode === 'forgot') { authStatus.textContent = data.message || 'Controlla la tua email per continuare.'; authStatus.dataset.kind = 'success'; authSubmit.disabled = false; return; }
    const user = data.user || { email, nickname: authNickname.value.trim() || email.split('@')[0] };
    if (authMode === 'register' && data.verification_required) { authStatus.textContent = data.message || 'Account creato. Controlla la tua email per attivarlo.'; authStatus.dataset.kind = 'success'; authSubmit.disabled = false; return; }
    authStatus.textContent = `Bentornato, ${user.nickname || 'esploratore'}.`;
    authStatus.dataset.kind = 'success';
    showAccountDashboard(user);
  } catch (error) {
    if (error instanceof TypeError || /Failed to fetch|Unexpected token|Operazione non disponibile/i.test(error.message)) {
      if (authMode === 'forgot') { authStatus.textContent = 'Anteprima: il link di recupero verrà inviato quando collegheremo il servizio email.'; authStatus.dataset.kind = 'success'; authSubmit.disabled = false; return; }
      const existing = readDemoAccount();
      const hash = await demoPasswordHash(password);
      if (authMode === 'register') { localStorage.setItem('marte_demo_account', JSON.stringify({ email, nickname: authNickname.value.trim(), passwordHash: hash })); localStorage.setItem('marte_demo_session', email); showAccountDashboard({ email, nickname: authNickname.value.trim() }); authStatus.textContent = 'Account demo creato. Ora puoi vedere il tuo riepilogo.'; authStatus.dataset.kind = 'success'; }
      else if (existing && existing.email === email && existing.passwordHash === hash) { localStorage.setItem('marte_demo_session', email); showAccountDashboard(existing); authStatus.textContent = 'Accesso effettuato.'; authStatus.dataset.kind = 'success'; }
      else { authStatus.textContent = 'In questa anteprima crea prima un account oppure usa il backend attivo.'; authStatus.dataset.kind = 'error'; }
    } else { authStatus.textContent = error.message; authStatus.dataset.kind = 'error'; }
  } finally { authSubmit.disabled = false; }
});

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playApproachSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const oscillator = ctx.createOscillator();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(75, now);
  oscillator.frequency.exponentialRampToValueAtTime(460, now + 0.95);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, now);
  filter.frequency.exponentialRampToValueAtTime(2200, now + 0.9);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.18);
  oscillator.connect(filter).connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 1.2);
}

function playPanelSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [[440, 0, 0.2], [660, 0.08, 0.3], [880, 0.17, 0.38]].forEach(([frequency, delay, duration]) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.055, now + delay + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + 0.02);
  });
}

let selected = 1;
let approached = false;
let isApproaching = false;
let autoRotate = true;
const homePosition = new THREE.Vector3(0, 0, 0);
const homeRotation = new THREE.Euler(0, 0, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0, 6.2);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
planetButton.appendChild(renderer.domElement);

const texture = new THREE.TextureLoader().load('mars-texture.jpg');
texture.colorSpace = THREE.SRGBColorSpace;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.generateMipmaps = true;
const mars = new THREE.Mesh(
  new THREE.SphereGeometry(1.72, 128, 96),
  new THREE.MeshStandardMaterial({ map: texture, roughness: 0.91, metalness: 0, bumpMap: texture, bumpScale: 0.072, emissive: 0x35120b, emissiveMap: texture, emissiveIntensity: 0.22 })
);
scene.add(mars);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.77, 96, 64),
  new THREE.MeshPhongMaterial({ color: 0xd56c4e, transparent: true, opacity: 0.095, side: THREE.BackSide, blending: THREE.AdditiveBlending })
);
scene.add(atmosphere);

// Area simbolica sulla superficie: cresce in proporzione alla radice dei km² scelti.
const plotGroup = new THREE.Group();
const plotNormal = new THREE.Vector3(0.28, 0.18, 0.94).normalize();
plotGroup.position.copy(plotNormal.clone().multiplyScalar(1.735));
plotGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plotNormal);
const plotSurface = new THREE.Mesh(
  new THREE.PlaneGeometry(0.16, 0.16),
  new THREE.MeshBasicMaterial({ color: 0x72e7f5, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
const plotBorder = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.16, 0.16)),
  new THREE.LineBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })
);
plotGroup.add(plotSurface, plotBorder);
plotGroup.visible = false;
mars.add(plotGroup);
scene.add(new THREE.AmbientLight(0x8b5142, 0.62));
scene.add(new THREE.HemisphereLight(0xffd5ba, 0x160b0b, 1.7));
const frontFill = new THREE.DirectionalLight(0xffb08b, 2.6);
frontFill.position.set(0, 0, 6);
scene.add(frontFill);
const sun = new THREE.DirectionalLight(0xffe0c5, 4.2);
sun.position.set(-4, 2.5, 5);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x8e2f29, 1.35);
rim.position.set(4, -2, -4);
scene.add(rim);

// Piccola nube di polvere per dare profondità al momento dell’avvicinamento.
const dustPositions = new Float32Array(260 * 3);
for (let i = 0; i < dustPositions.length; i += 3) {
  const radius = 2.1 + Math.random() * 1.25;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  dustPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
  dustPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
  dustPositions[i + 2] = radius * Math.cos(phi);
}
const dust = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dustPositions, 3)),
  new THREE.PointsMaterial({ color: 0xf0a277, size: 0.018, transparent: true, opacity: 0.35, sizeAttenuation: true })
);
scene.add(dust);

// Sabbia marziana ambientale: particelle lontane, lente e leggere sullo sfondo.
const backgroundDustPositions = new Float32Array(520 * 3);
const backgroundDustColors = new Float32Array(520 * 3);
for (let i = 0; i < backgroundDustPositions.length; i += 3) {
  backgroundDustPositions[i] = (Math.random() - 0.5) * 11;
  backgroundDustPositions[i + 1] = (Math.random() - 0.5) * 7;
  backgroundDustPositions[i + 2] = -1.8 - Math.random() * 5.8;
  const warm = Math.random() > 0.28;
  backgroundDustColors[i] = warm ? 1.0 : 0.42;
  backgroundDustColors[i + 1] = warm ? 0.38 + Math.random() * 0.22 : 0.72;
  backgroundDustColors[i + 2] = warm ? 0.18 + Math.random() * 0.14 : 0.9;
}
const backgroundDustGeometry = new THREE.BufferGeometry();
backgroundDustGeometry.setAttribute('position', new THREE.BufferAttribute(backgroundDustPositions, 3));
backgroundDustGeometry.setAttribute('color', new THREE.BufferAttribute(backgroundDustColors, 3));
const backgroundDust = new THREE.Points(
  backgroundDustGeometry,
  new THREE.PointsMaterial({ size: 0.026, vertexColors: true, transparent: true, opacity: 0.38, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false })
);
backgroundDust.renderOrder = -2;
scene.add(backgroundDust);

// Campo stellare profondo e molto ampio: aggiunge scala senza trasformarsi in rumore.
const deepSpacePositions = new Float32Array(700 * 3);
for (let i = 0; i < deepSpacePositions.length; i += 3) {
  deepSpacePositions[i] = (Math.random() - 0.5) * 24;
  deepSpacePositions[i + 1] = (Math.random() - 0.5) * 15;
  deepSpacePositions[i + 2] = -5 - Math.random() * 10;
}
const deepSpace = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(deepSpacePositions, 3)),
  new THREE.PointsMaterial({ color: 0x9ebdff, size: 0.012, transparent: true, opacity: 0.42, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false })
);
deepSpace.renderOrder = -4;
scene.add(deepSpace);

// Due piani di profondità: polvere dietro Marte e scie luminose in primo piano.
function createCosmicLayer(count, zMin, zMax, color, size, opacity, renderOrder) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
    positions[i * 3 + 2] = zMin + Math.random() * (zMax - zMin);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  points.renderOrder = renderOrder;
  scene.add(points);
  return points;
}
const cosmicDustBack = createCosmicLayer(170, -4.5, -1.9, 0xa9c9ff, 0.018, 0.42, -3);
const cosmicDustFront = createCosmicLayer(95, 1.9, 4.2, 0xffc7a4, 0.022, 0.58, 3);

function createShootingStars(count, zMin, zMax, color, renderOrder) {
  const positions = new Float32Array(count * 6);
  const speeds = [];
  for (let i = 0; i < count; i += 1) {
    const x = -6 + Math.random() * 12;
    const y = -3.4 + Math.random() * 6.8;
    const z = zMin + Math.random() * (zMax - zMin);
    const length = 0.12 + Math.random() * 0.34;
    const drift = 0.012 + Math.random() * 0.018;
    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x - length;
    positions[i * 6 + 4] = y + length * 0.22;
    positions[i * 6 + 5] = z;
    speeds.push({ speed: drift, length, phase: Math.random() * Math.PI * 2 });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: renderOrder < 0 }));
  stars.renderOrder = renderOrder;
  scene.add(stars);
  return { stars, positions, speeds, count };
}
const shootingStarsBack = createShootingStars(6, -3.6, -2.0, 0x9ebdff, -2);
const shootingStarsFront = createShootingStars(3, 2.0, 4.0, 0xffb36b, 4);

function animateCosmicLayer(points, amount) {
  points.rotation.y += amount;
  points.rotation.x = Math.sin(performance.now() * 0.00009) * 0.018;
}
function animateShootingStars(layer, amount) {
  const { positions, speeds, count } = layer;
  for (let i = 0; i < count; i += 1) {
    const base = i * 6;
    const speed = speeds[i].speed * amount;
    positions[base] += speed;
    positions[base + 3] += speed;
    positions[base + 1] -= speed * 0.18;
    positions[base + 4] -= speed * 0.18;
    if (positions[base] > 6.3) {
      const y = -3.4 + Math.random() * 6.8;
      const z = layer.stars.renderOrder < 0 ? -3.6 + Math.random() * 1.6 : 2 + Math.random() * 2;
      positions[base] = -6.3;
      positions[base + 1] = y;
      positions[base + 2] = z;
      positions[base + 3] = -6.3 - speeds[i].length;
      positions[base + 4] = y + speeds[i].length * 0.22;
      positions[base + 5] = z;
    }
  }
  layer.stars.geometry.attributes.position.needsUpdate = true;
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.minPolarAngle = 0.55;
controls.maxPolarAngle = 2.6;

let downX = 0;
let downY = 0;
let didDrag = false;
renderer.domElement.addEventListener('pointerdown', (event) => {
  autoRotate = false;
  downX = event.clientX;
  downY = event.clientY;
  didDrag = false;
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (Math.hypot(event.clientX - downX, event.clientY - downY) > 7) didDrag = true;
});
renderer.domElement.addEventListener('pointerup', () => {
  if (!didDrag) {
    movePlanetTowardViewer();
    return;
  }
  autoRotate = true;
});
renderer.domElement.addEventListener('pointercancel', () => {
  if (didDrag) autoRotate = true;
});
planetButton.addEventListener('keydown', (event) => {
  autoRotate = false;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); movePlanetTowardViewer(); }
});

function renderSatellite() {
  if (!satelliteImage) return;
  satelliteImage.style.transform = `translate(calc(-50% + ${satellitePanX}px), calc(-50% + ${satellitePanY}px)) scale(${satelliteScale})`;
  if (satelliteSelection) satelliteSelection.style.width = `${Math.min(34, 10 + Math.sqrt(selected) * 2.2)}%`;
  if (satelliteCoordinates) satelliteCoordinates.textContent = `${LOT_LAT.toFixed(6)}° N · ${LOT_LON.toFixed(6)}° E · ${selected} km²`;
}
function openSatelliteView() {
  satellitePanX = 0;
  satellitePanY = 0;
  satelliteScale = 1;
  updateCoordinates();
  renderSatellite();
  satelliteViewer.hidden = false;
  document.body.classList.add('satellite-open');
}
function closeSatelliteView() {
  satelliteViewer.hidden = true;
  document.body.classList.remove('satellite-open');
}

function updateTelemetry() {
  if (!telemetryTick) return;
  const elapsed = Math.floor((performance.now() - missionStartTime) / 1000);
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  telemetryTick.textContent = `${hours}:${minutes}:${seconds}`;
}
setInterval(updateTelemetry, 1000);
updateTelemetry();

// Parallasse leggera: muove solo lo spazio, mentre Marte resta stabile e protagonista.
let spacePointerX = 0;
let spacePointerY = 0;
let spaceTargetX = 0;
let spaceTargetY = 0;
stage.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const rect = stage.getBoundingClientRect();
  spaceTargetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  spaceTargetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
});
stage.addEventListener('pointerleave', () => { spaceTargetX = 0; spaceTargetY = 0; });
function animateSpaceParallax() {
  spacePointerX += (spaceTargetX - spacePointerX) * 0.045;
  spacePointerY += (spaceTargetY - spacePointerY) * 0.045;
  stage.style.setProperty('--space-x', `${(spacePointerX * 14).toFixed(2)}px`);
  stage.style.setProperty('--space-y', `${(spacePointerY * 10).toFixed(2)}px`);
}


function updateWeather() {
  const t = Date.now() / 1000;
  const temperature = -58 - Math.abs(LOT_LAT) * 0.35 + 7 * Math.sin(t / 90 + LOT_LON);
  const pressure = 610 - Math.abs(LOT_LAT) * 1.15 + 9 * Math.cos(t / 120 + LOT_LON);
  const weather = `${temperature.toFixed(1)} °C · ${Math.round(pressure)} Pa`;
  if (weatherHud) weatherHud.innerHTML = `<b>SIMULAZIONE LIVE</b> · ${weather}`;
  if (weatherReadoutPanel) weatherReadoutPanel.innerHTML = `<span>SIMULAZIONE LIVE</span> ${weather}`;
}
setInterval(updateWeather, 2000);
updateWeather();
updateQuote();
updateSurfaceAvailability();
updateTerraformSimulator();
terraformYears?.addEventListener('input', updateTerraformSimulator);

satelliteViewer.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) event.stopPropagation();
});
satelliteViewer.addEventListener('dblclick', (event) => event.preventDefault());

document.querySelector('#openSatellite')?.addEventListener('click', openSatelliteView);
document.querySelector('#closeSatellite').addEventListener('click', closeSatelliteView);
document.querySelector('#satelliteZoomIn').addEventListener('click', () => { satelliteScale = Math.min(4, satelliteScale + 0.25); renderSatellite(); });
document.querySelector('#satelliteZoomOut').addEventListener('click', () => { satelliteScale = Math.max(0.75, satelliteScale - 0.25); renderSatellite(); });
document.querySelector('#satelliteReset').addEventListener('click', () => { satelliteScale = 1; satellitePanX = 0; satellitePanY = 0; renderSatellite(); });
satelliteStage.addEventListener('pointerdown', (event) => { if (event.target.closest('.crater-pin')) return; satelliteDragging = true; satelliteStage.classList.add('is-dragging'); satelliteStartX = event.clientX; satelliteStartY = event.clientY; satelliteOriginX = satellitePanX; satelliteOriginY = satellitePanY; satelliteStage.setPointerCapture(event.pointerId); });
satelliteStage.addEventListener('pointermove', (event) => { if (!satelliteDragging) return; satellitePanX = satelliteOriginX + event.clientX - satelliteStartX; satellitePanY = satelliteOriginY + event.clientY - satelliteStartY; renderSatellite(); });
satelliteStage.addEventListener('pointerup', () => { satelliteDragging = false; satelliteStage.classList.remove('is-dragging'); });
satelliteStage.addEventListener('pointercancel', () => { satelliteDragging = false; satelliteStage.classList.remove('is-dragging'); });
satelliteStage.addEventListener('wheel', (event) => { event.preventDefault(); satelliteScale = Math.max(0.75, Math.min(4, satelliteScale + (event.deltaY < 0 ? 0.18 : -0.18))); renderSatellite(); }, { passive: false });
document.addEventListener('touchmove', (event) => { if (event.target.closest('#planetButton') || (document.body.classList.contains('page-locked') && !event.target.closest('#buyPanel'))) event.preventDefault(); }, { passive: false });
document.querySelectorAll('.crater-pin').forEach((pin) => pin.addEventListener('click', () => { satelliteCraterName.textContent = pin.dataset.crater; satelliteCraterInfo.textContent = 'Punto d’interesse selezionato · trascina per continuare l’esplorazione'; }));

function updateCoordinates() {
  const sideKm = Math.sqrt(selected);
  const latHalf = sideKm / (2 * 59.3);
  const lonHalf = sideKm / (2 * (59.3 * Math.cos(LOT_LAT * Math.PI / 180)));
  const minLat = (LOT_LAT - latHalf).toFixed(6);
  const maxLat = (LOT_LAT + latHalf).toFixed(6);
  const minLon = (LOT_LON - lonHalf).toFixed(6);
  const maxLon = (LOT_LON + lonHalf).toFixed(6);
  const center = `${LOT_LAT.toFixed(6)}° N · ${LOT_LON.toFixed(6)}° E`;
  const bounds = `N ${minLat}°–${maxLat}° · E ${minLon}°–${maxLon}°`;
  if (coordinateCenter) coordinateCenter.textContent = center;
  if (coordinateBounds) coordinateBounds.textContent = bounds;
  if (coordinateReadout) coordinateReadout.textContent = center;
}

function plotScaleForQuantity() {
  return 0.68 * Math.sqrt(selected);
}
function updatePlotSize() {
  const size = plotScaleForQuantity();
  plotGroup.scale.setScalar(size);
  const readout = document.querySelector('#plotReadout strong');
  if (readout) readout.textContent = `${selected} km²`;
}

function movePlanetTowardViewer() {
  if (isApproaching) return;
  if (approached) { openBuyPanel(); return; }
  isApproaching = true;
  playApproachSound();
  plotGroup.visible = true;
  surfaceCoordinates.hidden = false;
  updateCoordinates();
  plotGroup.scale.setScalar(0.01);
  stage.classList.add('cinematic');
  status.innerHTML = '<span class="hint-dot"></span> Avvicinamento in corso';
  controls.enabled = false;
  const startPosition = mars.position.clone();
  const towardViewer = camera.position.clone().normalize();
  const endPosition = towardViewer.multiplyScalar(0.72);
  const startRotation = mars.rotation.clone();
  const startTime = performance.now();
  const duration = 1180;
  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    mars.position.lerpVectors(startPosition, endPosition, eased);
    mars.rotation.y = startRotation.y + eased * 0.7;
    mars.rotation.x = startRotation.x + eased * 0.08;
    atmosphere.position.copy(mars.position);
    atmosphere.rotation.copy(mars.rotation);
    dust.position.copy(mars.position);
    dust.rotation.y = eased * 0.28;
    plotGroup.scale.setScalar(0.01 + eased * plotScaleForQuantity());
    stage.classList.add('selection-active');
    sun.intensity = 3.4 + eased * 0.9;
    if (progress < 1) requestAnimationFrame(step);
    else {
      approached = true;
      isApproaching = false;
      status.innerHTML = '<span class="hint-dot"></span> Il tuo pezzo di Marte';
      controls.target.copy(mars.position);
      controls.enabled = true;
      openBuyPanel();
    }
  }
  requestAnimationFrame(step);
}

function returnPlanetToOrbit() {
  if (!approached || isApproaching) return;
  isApproaching = true;
  stage.classList.add('returning');
  status.innerHTML = '<span class="hint-dot"></span> Ritorno in orbita';
  controls.enabled = false;
  const startPosition = mars.position.clone();
  const startRotation = mars.rotation.clone();
  const startTime = performance.now();
  const duration = 1050;
  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    mars.position.lerpVectors(startPosition, homePosition, eased);
    mars.rotation.x = THREE.MathUtils.lerp(startRotation.x, homeRotation.x, eased);
    mars.rotation.y = THREE.MathUtils.lerp(startRotation.y, homeRotation.y, eased);
    atmosphere.position.copy(mars.position);
    atmosphere.rotation.copy(mars.rotation);
    dust.position.copy(mars.position);
    dust.rotation.y = (1 - eased) * 0.28;
    plotGroup.scale.setScalar((1 - eased) * plotScaleForQuantity());
    sun.intensity = 4.3 - eased * 0.9;
    if (progress < 1) requestAnimationFrame(step);
    else {
      approached = false;
      plotGroup.visible = false;
      surfaceCoordinates.hidden = true;
      isApproaching = false;
      stage.classList.remove('cinematic', 'returning', 'selection-active');
      status.innerHTML = '<span class="hint-dot"></span> Clicca sul pianeta';
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      unlockPage();
    }
  }
  requestAnimationFrame(step);
}

function resize() {
  const rect = planetButton.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(planetButton);
resize();
function animate() {
  controls.update();
  animateSpaceParallax();
  // Rotazione lenta solo nella vista iniziale: il primo gesto lascia il controllo all’utente.
  if (autoRotate && !approached && !isApproaching) mars.rotation.y += 0.0007;
  atmosphere.position.copy(mars.position);
  atmosphere.rotation.copy(mars.rotation);
  dust.position.copy(mars.position);
  dust.rotation.y += 0.00035;
  if (plotGroup.visible) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
    plotSurface.material.opacity = 0.22 + pulse * 0.18;
    plotBorder.material.opacity = 0.72 + pulse * 0.23;
  }
  backgroundDust.rotation.y += 0.000055;
  backgroundDust.rotation.x = Math.sin(performance.now() * 0.00008) * 0.025;
  backgroundDust.position.y = Math.sin(performance.now() * 0.00012) * 0.035;
  deepSpace.rotation.y += 0.000012;
  deepSpace.rotation.x = Math.sin(performance.now() * 0.000045) * 0.012;
  animateCosmicLayer(cosmicDustBack, 0.000035);
  animateCosmicLayer(cosmicDustFront, -0.000045);
  animateShootingStars(shootingStarsBack, 1);
  animateShootingStars(shootingStarsFront, 1);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

function openBuyPanel() {
  lockPage();
  controls.enabled = false;
  playPanelSound();
  buyPanel.classList.remove('is-closing', 'is-open');
  buyPanel.hidden = false;
  buyPanel.scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => buyPanel.classList.add('is-open')));
  buyPanel.querySelector('#minus').focus();
}
function closeBuyPanel() {
  if (buyPanel.hidden || buyPanel.classList.contains('is-closing')) return;
  buyPanel.classList.remove('is-open');
  buyPanel.classList.add('is-closing');
  window.setTimeout(() => {
    buyPanel.hidden = true;
    buyPanel.classList.remove('is-closing');
    returnPlanetToOrbit();
  }, 380);
}
buyPanel.addEventListener('pointerdown', (event) => event.stopPropagation());
buyPanel.addEventListener('click', (event) => event.stopPropagation());
buyPanel.addEventListener('dblclick', (event) => event.preventDefault());
closePanel.addEventListener('click', closeBuyPanel);
document.querySelector('#minus').addEventListener('click', () => updateQuantity(selected - 1));
document.querySelector('#plus').addEventListener('click', () => updateQuantity(selected + 1));
document.querySelector('#demoPurchase').addEventListener('click', () => {
  certificateQuantity.textContent = `${selected} km²`;
  if (paymentTotal) paymentTotal.textContent = `${selected} €`;
  certificateStep.hidden = true;
  paymentStep.hidden = false;
  modal.hidden = false;
});
const cardCheckoutButton = document.querySelector('#demoPayment');
cardCheckoutButton?.addEventListener('click', (event) => {
  event.preventDefault();
  window.location.assign(`checkout.html?quantity=${selected}`);
});
function closePaymentModal() {
  modal.hidden = true;
  paymentStep.hidden = true;
  certificateStep.hidden = false;
}
closeModal.addEventListener('click', closePaymentModal);
document.querySelector('#closePayment').addEventListener('click', closePaymentModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closePaymentModal(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closePaymentModal(); if (!buyPanel.hidden) closeBuyPanel(); }
});
function formatEuro(value) {
  return `${value.toFixed(2).replace('.', ',')} €`;
}
function renderTerraformChart(current, rate, years) {
  if (!terraformChartLine || !terraformChartArea) return;
  const steps = Math.min(12, Math.max(6, Math.round(years / 4) + 1));
  const maxValue = current * Math.pow(1 + rate, years);
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    const year = years * (index / (steps - 1));
    const value = current * Math.pow(1 + rate, year);
    const x = 16 + (288 * index / (steps - 1));
    const y = 105 - ((value - current) / Math.max(maxValue - current, 0.0001)) * 82;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  terraformChartLine.setAttribute('points', points.join(' '));
  terraformChartArea.setAttribute('d', `M${points[0]} L${points.slice(1).join(' L')} L304 105 L16 105 Z`);
  if (terraformChartEnd) terraformChartEnd.textContent = formatEuro(maxValue);
  if (terraformChartYears) terraformChartYears.textContent = `${years} ANNI`;
  if (terraformChartDots) {
    terraformChartDots.innerHTML = points.map((point, index) => {
      const [x, y] = point.split(',');
      return `<circle cx="${x}" cy="${y}" r="${index === points.length - 1 ? 3.5 : 2}"/>`;
    }).join('');
  }
}

function updateTerraformSimulator() {
  const years = Number(terraformYears?.value || 10);
  const rate = 0.08;
  const current = selected;
  const future = current * Math.pow(1 + rate, years);
  const growth = (future / current - 1) * 100;
  if (terraformYearsValue) terraformYearsValue.textContent = `${years} anni`;
  if (terraformCurrentValue) terraformCurrentValue.textContent = formatEuro(current);
  if (terraformFutureValue) terraformFutureValue.textContent = formatEuro(future);
  if (terraformGrowth) terraformGrowth.textContent = `+${growth.toFixed(0)}%`;
  renderTerraformChart(current, rate, years);
  if (terraformMetrics && terraformHasRendered) {
    terraformMetrics.classList.remove('is-updating');
    void terraformMetrics.offsetWidth;
    terraformMetrics.classList.add('is-updating');
    window.clearTimeout(terraformMetrics.updateTimer);
    terraformMetrics.updateTimer = window.setTimeout(() => terraformMetrics.classList.remove('is-updating'), 620);
  }
  terraformHasRendered = true;
}

function updateSurfaceAvailability() {
  const remaining = Math.max(0, MARS_SURFACE_KM2 - selected);
  const percentage = (remaining / MARS_SURFACE_KM2) * 100;
  if (remainingPercent) remainingPercent.textContent = `${percentage.toFixed(6).replace('.', ',')}%`;
  if (remainingMeter) remainingMeter.style.width = `${percentage}%`;
  if (surfaceSummary) surfaceSummary.textContent = `Superficie ancora acquistabile: ${remaining.toLocaleString('it-IT')} km² su ${MARS_SURFACE_KM2.toLocaleString('it-IT')} km²`;
}

function updateQuote() {
  const amount = `${selected} €`;
  if (quoteLine) quoteLine.textContent = `${selected} km² × 1 €`;
  if (quoteSubtotal) quoteSubtotal.textContent = amount;
  if (quoteGrandTotal) quoteGrandTotal.textContent = amount;
}

function updateQuantity(next) {
  selected = Math.max(1, Math.min(99, next));
  quantity.textContent = selected;
  total.textContent = `${selected} €`;
  updateQuote();
  updateSurfaceAvailability();
  updateTerraformSimulator();
  updatePlotSize();
  updateCoordinates();
  renderSatellite();
}
