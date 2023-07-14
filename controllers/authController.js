const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Email = require('../utils/email');

// synchronous JWT sign
// const signToken = (id) =>
//   jwt.sign({ id }, process.env.JWT_SECRET, {
//     expiresIn: process.env.JWT_EXPIRES_IN,
//   });

// asynchronous JWT sign
// function signToken(id) {
//   return new Promise((resolve, reject) => {
//     jwt.sign(
//       {
//         id,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: process.env.JWT_EXPIRES_IN,
//       },
//       (err, token) => {
//         if (err) reject(err);
//         else {
//           resolve(token);
//         }
//       }
//     );
//   });
// }

// asynchronous JWT sign using built in npm utils promisify
async function signToken(id) {
  // this is just a shorthand syntax about the second () , that means: call the function what is returned from promisify() immediately
  return await promisify(jwt.sign)({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

const createSendToken = catchAsync(async (user, statusCode, res) => {
  const token = await signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true, // can't manipulate or delete the cookie in any way
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);

  // remove password from the output created by User.create()
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
});
exports.signup = catchAsync(async (req, res, next) => {
  // this CREATE procedure is crucial to prevent unwanted admin access
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,

    // this is a vulnerability as anyone can act as an admin, restrictToOnlyUser middleware is safeguarding this vulnerability by allowing only users
    role: req.body.role,
  });

  let url = `${req.protocol}://localhost:3000/me`;
  if (process.env.NODE_ENV === 'production') {
    url = `${req.protocol}://${req.get('host')}/me`;
  }

  await new Email(newUser, url).sendWelcome();

  // JWT_SECRET should be at least 32 characters for better security
  // head over to jwt.io to verify token
  await createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // check if email and password exist
  if (!email || !password) {
    return next(new AppError('please provide email and password', 400));
  }
  // check if user exists and password is correct
  const user = await User.findOne({ email }).select('+password');

  // by combining it'll be difficult for the attacker to guess which field is incorrect
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('incorrect email or password', 401));
  }
  // send token to client if everything's ok
  await createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'dummytoken', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // get token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('you are not logged in. please log in.', 401));
  }
  // token verification

  // this is just a shorthand syntax about the second () , that means: call the function what is returned from promisify() immediately
  //with .then() clause

  // const verify = promisify(jwt.verify);
  // verify(token, process.env.JWT_SECRET).then().catch()
  // or with try-catch

  // try {
  //     await verify(verify(token, process.env.JWT_SECRET))
  // }catch(e){....}

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('the user belonging to the token no longer exists', 401)
    );
  }
  // check if user changed password after the token had been issued
  if (currentUser.passwordChangedAfter(decoded.iat)) {
    return next(
      new AppError('recently changed password. please log in again.', 401)
    );
  }

  // grant access to protected route
  // req travels from middleware to middleware
  req.user = currentUser;
  // there's a logged in user; to automatically use it in the frontend templates
  // The res.locals property is an object that contains response local variables scoped to the request and because of this, it is only available to the view(s) rendered during that request/response cycle (if any)
  res.locals.user = currentUser;
  next();
});

// only for rendered pages, no need to catch errors instead skip to the next middleware
exports.isLoggedIn = async (req, res, next) => {
  try {
    // get token and check if it's there
    if (req.cookies.jwt) {
      // verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      // check if user changed password after the token had been issued
      if (currentUser.passwordChangedAfter(decoded.iat)) {
        return next();
      }

      // there's a logged in user; to automatically use it in the frontend templates
      res.locals.user = currentUser;
      return next();
    }
  } catch (err) {
    // there's no logged in user
    return next();
  }
  next();
};

exports.restrictTo =
  (...roles) =>
  // middleware functions can not have parameters. restrictTo() is a wrapper function which returns the middleware function right away
  (req, res, next) => {
    // roles = ['admin', 'lead-guide']
    if (!roles.includes(req.user.role)) {
      // true if role = 'user'
      return next(
        new AppError(
          'do not have sufficient permission to perfom this action',
          403
        )
      );
    }
    next();
  };

exports.restrictToOnlyUser = (req, res, next) => {
  const onlyUser = ['user', undefined];

  if (!onlyUser.includes(req.body.role))
    return next(new AppError('only users are allowed', 400));

  req.body.role = 'user';
  next();
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const userForgotPassword = await User.findOne({ email: req.body.email });

  if (!userForgotPassword)
    return next(new AppError('There is no user with email address.', 404));

  // 2) Generate the random reset token
  const resetToken = userForgotPassword.createPasswordResetToken();
  await userForgotPassword.save({ validateBeforeSave: false });

  try {
    // 3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetpassword/${resetToken}}`;
    console.log(resetURL);

    await new Email(userForgotPassword, resetURL).sendPasswordReset();
  } catch (err) {
    userForgotPassword.passwordResetToken = undefined;
    userForgotPassword.passwordResetExpires = undefined;
    await userForgotPassword.save({ validateBeforeSave: false });

    console.log(err);

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }

  res.status(200).json({
    status: 'success',
    message: 'Token sent to email!',
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // if token is not expired, and user exists, set the new password
  if (!user) {
    return next(new AppError('invalid/expired token', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // update changedPasswordAt property for the user
  // log the user in, send JWT
  await createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // check if POSTed password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('current password is wrong', 401));
  }

  // update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  // User.findByIdAndUpdate will not let custom validator and two pre SAVE middlewares work
  await user.save();

  // log user in, send JWT
  await createSendToken(user, 200, res);
});
