const page = document.querySelector('.checkout-page');
const API_BASE = (page.dataset.apiBase || '/api').replace(/\/$/, '');
const PRICE_CENTS = 100;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;
const requestedQuantity = Number(new URLSearchParams(window.location.search).get('quantity'));
let quantity = Number.isInteger(requestedQuantity) ? Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, requestedQuantity)) : 1;
let cardSession = null;
let internalOrderId = null;
let hostedApprovalUrl = null;

const quantityValue = document.querySelector('#quantityValue');
const quantityOutput = document.querySelector('#quantityOutput');
const totalValue = document.querySelector('#totalValue');
const remainingValue = document.querySelector('#remainingValue');
const termsConsent = document.querySelector('#termsConsent');
const digitalConsent = document.querySelector('#digitalConsent');
const customerEmail = document.querySelector('#customerEmail');
const cardSubmitButton = document.querySelector('#cardSubmitButton');
const hostedCheckoutButton = document.querySelector('#hostedCheckoutButton');
const cardForm = document.querySelector('#cardForm');
const cardUnavailable = document.querySelector('#cardUnavailable');
const status = document.querySelector('#status');

function euro(cents) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
function selectedCents() { return quantity * PRICE_CENTS; }
function setStatus(message, kind = '') { status.textContent = message; status.dataset.kind = kind; }
function validEmail() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail?.value.trim() || ''); }
function updateButtonState() { cardSubmitButton.disabled = !(cardSession && validEmail() && termsConsent.checked && digitalConsent.checked); }
function renderQuantity() {
  quantityValue.textContent = quantity; quantityOutput.textContent = quantity; totalValue.textContent = euro(selectedCents());
  document.querySelector('#minusButton').disabled = quantity <= MIN_QUANTITY; document.querySelector('#plusButton').disabled = quantity >= MAX_QUANTITY; updateButtonState();
}
async function readCapacity() {
  try {
    const response = await fetch(`${API_BASE}/capacity`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error();
    const data = await response.json();
    remainingValue.textContent = `${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(data.remaining_eur)} disponibili`;
    if (selectedCents() > Math.round(data.remaining_eur * 100)) setStatus('La quantità selezionata supera la disponibilità annuale.', 'error');
  } catch { remainingValue.textContent = 'Non disponibile'; setStatus('Disponibilità temporaneamente non leggibile.', 'error'); }
}
async function createBackendOrder() {
  const response = await fetch(`${API_BASE}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include', body: JSON.stringify({ quantity_km2: quantity, customer_email: customerEmail.value.trim().toLowerCase() }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.order?.id || !data.order?.paypal_order_id) throw new Error(data.message || 'Impossibile creare l’ordine');
  internalOrderId = data.order.id;
  hostedApprovalUrl = data.approval_url;
  sessionStorage.setItem('marte1km_order_id', internalOrderId);
  return data.order.paypal_order_id;
}
async function captureAndWait() {
  const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(internalOrderId)}/capture`, { method: 'POST', headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'PayPal non ha accettato la cattura');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const orderResponse = await fetch(`${API_BASE}/orders/${encodeURIComponent(internalOrderId)}`, { headers: { Accept: 'application/json' } });
    const orderData = await orderResponse.json();
    const order = orderData.order;
    if (order?.status === 'PAID') { window.location.assign(`payment-success.html?order_id=${encodeURIComponent(internalOrderId)}`); return; }
    if (['CANCELLED', 'DENIED', 'REFUNDED'].includes(order?.status)) throw new Error(`Stato ordine: ${order.status}`);
    setStatus('Pagamento ricevuto da PayPal, attendo la conferma server…');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('La conferma del pagamento non è ancora arrivata. Controlla più tardi.');
}
async function submitCardPayment() {
  if (!cardSession || !termsConsent.checked || !digitalConsent.checked) return;
  cardSubmitButton.disabled = true; setStatus('Creo l’ordine e avvio la verifica della carta…');
  try {
    const paypalOrderId = await createBackendOrder();
    const result = await cardSession.submit(paypalOrderId, { billingAddress: { addressLine1: document.querySelector('#billingAddressLine1').value.trim(), adminArea1: document.querySelector('#billingAdminArea1').value.trim(), adminArea2: document.querySelector('#billingAdminArea2').value.trim(), postalCode: document.querySelector('#billingPostalCode').value.trim(), countryCode: document.querySelector('#billingCountryCode').value.trim().toUpperCase() } });
    if (result.state !== 'succeeded') throw new Error(result.data?.message || 'La carta non è stata autorizzata');
    await captureAndWait();
  } catch (error) { setStatus(error.message || 'Pagamento non completato. Puoi riprovare.', 'error'); updateButtonState(); }
}
async function loadPayPalSdk() {
  if (window.paypal?.createInstance) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = page.dataset.paypalSdkUrl || 'https://www.paypal.com/web-sdk/v6/core';
    script.onload = resolve;
    script.onerror = () => reject(new Error('SDK PayPal non caricabile'));
    document.head.appendChild(script);
  });
}
async function initCardFields() {
  try {
    await loadPayPalSdk();
    if (!window.paypal?.createInstance) throw new Error('SDK PayPal non caricato');
    const tokenResponse = await fetch(`${API_BASE}/paypal/client-token`, { headers: { Accept: 'application/json' } });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.client_token) throw new Error('Client token PayPal non disponibile');
    const sdk = await window.paypal.createInstance({ clientToken: tokenData.client_token, components: ['card-fields'], pageType: 'checkout', locale: 'it-IT' });
    const methods = await sdk.findEligibleMethods({ currencyCode: 'EUR' });
    if (!methods.isEligible('advanced_cards')) throw new Error('Card Fields non abilitati per questo conto o Paese');
    cardSession = sdk.createCardFieldsOneTimePaymentSession();
    const style = { input: { color: '#eef4ff', fontSize: '16px', fontFamily: 'ui-sans-serif, system-ui', background: 'transparent' }, ':focus': { color: '#72e7f5' }, '.invalid': { color: '#ff9f9f' } };
    for (const [type, selector, placeholder] of [['number', '#card-number-container', '1234 1234 1234 1234'], ['expiry', '#card-expiry-container', 'MM/AA'], ['cvv', '#card-cvv-container', 'CVV'], ['name', '#card-name-container', 'Nome del titolare']]) {
      document.querySelector(selector).appendChild(cardSession.createCardFieldsComponent({ type, placeholder, style }));
    }
    cardForm.hidden = false; setStatus('Campi carta PayPal pronti.'); updateButtonState();
  } catch (error) {
    cardUnavailable.hidden = false; cardUnavailable.textContent = 'Il pagamento con carta integrato non è abilitato per questo conto PayPal. Usa il checkout PayPal ospitato oppure abilita Advanced Card Payments nel conto merchant.'; cardUnavailable.dataset.kind = 'error';
    hostedCheckoutButton.hidden = false;
  }
}

document.querySelector('#minusButton').addEventListener('click', () => { quantity = Math.max(MIN_QUANTITY, quantity - 1); renderQuantity(); });
document.querySelector('#plusButton').addEventListener('click', () => { quantity = Math.min(MAX_QUANTITY, quantity + 1); renderQuantity(); });
termsConsent.addEventListener('change', updateButtonState); digitalConsent.addEventListener('change', updateButtonState); customerEmail?.addEventListener('input', updateButtonState);
cardSubmitButton.addEventListener('click', submitCardPayment);
hostedCheckoutButton.addEventListener('click', async () => { if (!validEmail()) { setStatus('Inserisci un indirizzo email valido per ricevere il certificato.', 'error'); return; } hostedCheckoutButton.disabled = true; setStatus('Preparo il checkout PayPal…'); try { await createBackendOrder(); window.location.assign(hostedApprovalUrl); } catch (error) { setStatus(error.message || 'Impossibile avviare il checkout.', 'error'); hostedCheckoutButton.disabled = false; } });
renderQuantity(); readCapacity(); initCardFields();
