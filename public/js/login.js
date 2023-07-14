/* eslint-disable */
import { showAlert } from './alerts';

// consuming login api with axios
export const login = async (email, password) => {
  // alert(`${email} / ${password}`);
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: {
        email,
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'logged in successfully.');
      window.setTimeout(() => {
        location.assign('/');
      }, 600);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout',
    });

    if (res.data.status === 'success') {
      showAlert('success', 'logged out successfully!');
      location.reload(true); // 'true' will force the reload from the server, not from the browser cache
    }
    if (window.location.pathname === '/me') location.assign('/');
  } catch (err) {
    showAlert('error', err);
  }
};
