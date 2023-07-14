/* eslint-disable */
import { showAlert } from './alerts';

const stripe = Stripe(
  'pk_test_51NPfK6FKSSyfwekjEM1kRbs1o8rx9vhOwuH1jlH5Ny2ab5PUkadDtR9g3bRCfyPUhnEHkjQayik9qe3S9p2943nJ00OvDbNEJh'
);

export const bookTour = async (tourId) => {
  try {
    // get checkout session from backend API
    const session = await axios({
      url: `/api/v1/bookings/checkout-session/${tourId}`,
    });
    // console.log(session);

    // create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
