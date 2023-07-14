const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'please tell your name.'],
  },
  email: {
    type: String,
    required: [true, 'please provide your email.'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'please provide a valid email.'],
  },
  photo: { type: String, default: 'default.jpg' },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'please provide a password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'please confirm your password'],
    validate: {
      //this only works on SAVE and CREATE
      validator: function (el) {
        return el === this.password;
      },
      message: 'passwords are not the same.',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre('save', async function (next) {
  // only use this document middleware if password is modified
  if (!this.isModified('password')) return next();

  //hash the password with the cost of 12 (the more the cost is, the more cpu intensive the operation will be)
  this.password = await bcrypt.hash(this.password, 12);

  //delete passwordConfirm field (it's a required input, not required to persis in DB)
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  // sometimes passwordChangedAt is updated after sometime because of delay
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});
// instance method: available through all the user documents.
// Instance methods belong to the class prototype, which is inherited by all instances of the class. As such, they act on class instances and can be called on them.
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  // 'this' points to current document. 'this.password' isn't available because of 'select:false'

  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.passwordChangedAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // case 1: 100 < 200 true; password was changed after token had been issued
    // case 2: 300 < 200 false; password had been changed before token was issued
    return JWTTimestamp < changedTimestamp;
  }

  // false: not changed
  return false;
};
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};
const User = mongoose.model('User', userSchema);
module.exports = User;
