// Lógica del formulario de tarjeta (ver card.html).
(function () {
  var params = new URLSearchParams(location.search);
  var orderId = params.get('orderId');
  var crc = Number(params.get('crc'));
  var usd = Number(params.get('usd'));
  var dark = params.get('theme') === 'dark';
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');

  function post(msg) {
    var text = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage(text, '*');
  }
  function setState(text) {
    var el = document.getElementById('state');
    el.textContent = text;
    el.hidden = !text;
  }
  function fail(code, text) {
    setState(text);
    document.getElementById('form').hidden = true;
    post({ type: 'unavailable', code: code, message: text });
  }

  if (!orderId) return fail('NO_ORDER', 'Falta la orden de pago.');

  if (crc > 0) {
    document.getElementById('crc').textContent = '₡' + crc.toLocaleString('es-CR');
    if (usd > 0) document.getElementById('usd').textContent = 'Se cobrarán $' + usd.toFixed(2) + ' USD';
    document.getElementById('amount').hidden = false;
  }

  fetch('/api/v1/paypal/config')
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg.success) throw new Error('config');
      var s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?components=card-fields&intent=capture&currency=USD&client-id='
        + encodeURIComponent(cfg.clientId);
      s.onload = init;
      s.onerror = function () { fail('SDK', 'No se pudo cargar PayPal. Revisa tu conexión.'); };
      document.head.appendChild(s);
    })
    .catch(function () { fail('CONFIG', 'El pago con tarjeta no está configurado en el servidor.'); });

  function init() {
    var fieldStyle = {
      'input': {
          'color': dark ? '#FFFFFF' : '#1C1C1E', 'font-size': '16px', 'padding': '10px 0',
          'background': 'transparent', 'border': 'none', 'box-shadow': 'none'
        },
        'input:focus': { 'border': 'none', 'box-shadow': 'none' },
      'input::placeholder': { 'color': dark ? '#6E6E73' : '#AEAEB2' },
      '.invalid': { 'color': dark ? '#FF8A84' : '#C4261D' }
    };

    var cardFields = window.paypal.CardFields({
      style: fieldStyle,
      createOrder: function () { return orderId; },
      onApprove: function (data) {
        document.getElementById('form').hidden = true;
        document.getElementById('amount').hidden = true;
        setState('Pago aprobado. Estamos confirmándolo…');
        post({ type: 'approved', orderID: data.orderID || orderId });
      },
      onError: function (err) {
        setBusy(false);
        showMsg('No se pudo procesar la tarjeta. Revisa los datos e inténtalo de nuevo.');
        post({ type: 'error', message: String(err && err.message || err) });
      }
    });

    if (!cardFields.isEligible()) {
      return fail('NOT_ELIGIBLE', 'El pago con tarjeta no está habilitado para esta cuenta de PayPal. Usa la opción PayPal, que también acepta tarjeta.');
    }

    cardFields.NumberField({ placeholder: '0000 0000 0000 0000' }).render('#card-number');
    cardFields.NameField({ placeholder: 'Como aparece en la tarjeta' }).render('#card-name');
    cardFields.ExpiryField({ placeholder: 'MM/AA' }).render('#card-expiry');
    cardFields.CVVField({ placeholder: '123' }).render('#card-cvv');

    setState('');
    document.getElementById('form').hidden = false;
    var pay = document.getElementById('pay');
    pay.disabled = false;
    post({ type: 'ready' });

    pay.addEventListener('click', function () {
      showMsg('');
      cardFields.getState().then(function (state) {
        var f = state.fields;
        var map = { cardNumberField: 'f-number', cardNameField: 'f-name', cardExpiryField: 'f-expiry', cardCvvField: 'f-cvv' };
        var valid = true;
        Object.keys(map).forEach(function (k) {
          var ok = f[k] ? f[k].isValid : true;
          document.getElementById(map[k]).classList.toggle('has-error', !ok);
          if (!ok) valid = false;
        });
        if (!valid) return showMsg('Revisa los campos marcados.');
        setBusy(true);
        cardFields.submit().catch(function () {
          setBusy(false);
          showMsg('La tarjeta fue rechazada. Prueba con otra o usa PayPal.');
        });
      });
    });
  }

  function setBusy(busy) {
    var pay = document.getElementById('pay');
    pay.disabled = busy;
    pay.textContent = busy ? 'Procesando…' : 'Pagar';
  }
  function showMsg(text) { document.getElementById('msg').textContent = text; }
})();
