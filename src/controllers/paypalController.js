const Booking = require('../models/Bookings');

// Generate an OAuth 2.0 access token for PayPal
const generateAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const appSecret = process.env.PAYPAL_SECRET;
  const baseUrl = process.env.PAYPAL_API_BASE;

  if (!clientId || !appSecret) {
    throw new Error('MISSING_API_CREDENTIALS');
  }

  const auth = Buffer.from(`${clientId}:${appSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('PayPal Auth Error:', data);
    throw new Error('Failed to generate Access Token');
  }
  return data.access_token;
};

// @desc    Create a PayPal order for a booking
// @route   POST /api/v1/paypal/create-order
// @access  Private (Passenger)
exports.createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const booking = await Booking.findById(bookingId).populate('ride_id');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Ensure the booking belongs to the current user
    if (booking.passenger_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    // Ensure it is not already paid
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking is already paid' });
    }

    const amount = booking.offered_amount || 0;
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking amount' });
    }

    const accessToken = await generateAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE;

    // Use a custom scheme to return to the app, but since we are using WebView, 
    // we can use dummy URLs and just intercept them in WebView.
    const returnUrl = `https://saferide.app/paypal/success?bookingId=${bookingId}`;
    const cancelUrl = `https://saferide.app/paypal/cancel?bookingId=${bookingId}`;

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: bookingId.toString(),
          amount: {
            currency_code: 'USD',
            value: amount.toFixed(2), // Convert to string format e.g. "5.00"
          },
          description: `SafeRide Trip - Booking ${bookingId}`,
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'SafeRide',
      },
    };

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('PayPal Create Order Error:', data);
      return res.status(500).json({ success: false, message: 'Failed to create PayPal order' });
    }

    // Find the approval URL
    const approveLink = data.links.find(link => link.rel === 'approve');
    
    if (!approveLink) {
      return res.status(500).json({ success: false, message: 'No approve link found from PayPal' });
    }

    res.status(200).json({
      success: true,
      orderId: data.id,
      approvalUrl: approveLink.href,
    });
  } catch (error) {
    console.error('createOrder Error:', error);
    next(error);
  }
};

// @desc    Capture a PayPal order after user approves
// @route   POST /api/v1/paypal/capture-order
// @access  Private (Passenger)
exports.captureOrder = async (req, res, next) => {
  try {
    const { orderId, bookingId } = req.body;

    if (!orderId || !bookingId) {
      return res.status(400).json({ success: false, message: 'Order ID and Booking ID are required' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Capture the payment with PayPal
    const accessToken = await generateAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE;

    const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (data.status === 'COMPLETED') {
      // PayPal está en sandbox y la orden no especifica `payee`, así que
      // ni en sandbox ni en producción llegaría dinero al conductor (todo
      // iría a la cuenta de SafeRide). Para no marcar como pagado algo
      // que el conductor no recibió, dejamos el booking en `pending` y
      // delegamos la confirmación final al conductor desde su pantalla
      // de PaymentVerification (allá se hace el PATCH a payment_status).
      return res.status(200).json({
        success: true,
        message: 'Payment captured successfully (awaiting driver confirmation)',
        data: data,
      });
    } else {
      console.error('PayPal Capture Error:', data);
      return res.status(400).json({
        success: false,
        message: 'Payment not completed or failed',
        data: data,
      });
    }
  } catch (error) {
    console.error('captureOrder Error:', error);
    next(error);
  }
};
