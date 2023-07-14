import axios from 'axios';
import { showAlert } from './alerts';

const stripe = Stripe(
  'pk_test_51NTnOWKjtgLnrj6BLIxxRlstUkO9r9YZdO3YpdCYxLt6vW8zPWapw0JzPx0WbCXRfAxJjSTyQsYWCuuKHnRODlru00Mj1LMO5Z'
);

const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);
    // await stripe.redirectToCheckout({
    //   sessionId:session.data.session.i
    // })
    // console.log(session.data.session.url);
    const stripeUrl = session.data.session.url;
    window.location.href = stripeUrl;
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
export { bookTour };
