export const loadRazorpayCheckout = () => new Promise((resolve) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }

  const existingScript = document.querySelector('script[data-razorpay-checkout="true"]');
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(true), { once: true });
    existingScript.addEventListener('error', () => resolve(false), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.dataset.razorpayCheckout = 'true';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export const openRazorpayCheckout = async ({
  bookingId,
  orderId,
  amount,
  currency,
  key,
  prefill,
  notes,
  description,
  onPaymentSuccess,
  onPaymentFailure,
}) => (
  new Promise((resolve, reject) => {
    const razorpay = new window.Razorpay({
      key,
      amount,
      currency,
      name: 'Sigmora',
      description,
      order_id: orderId,
      prefill,
      notes,
      retry: {
        enabled: true,
        max_count: 2,
      },
      remember_customer: true,
      theme: {
        color: '#0f766e',
      },
      handler: async (response) => {
        try {
          if (onPaymentSuccess) {
            await onPaymentSuccess(response);
          }
          resolve({ paid: true, bookingId });
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => resolve({ paid: false, dismissed: true, bookingId }),
      },
    });

    razorpay.on('payment.failed', async (event) => {
      try {
        if (onPaymentFailure) {
          await onPaymentFailure(event);
        }
      } catch (error) {
        console.error(error);
      }

      reject(new Error(event?.error?.description || 'Payment failed'));
    });

    razorpay.open();
  })
);
