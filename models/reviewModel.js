const mongoose = require('mongoose');
const Tour = require('./tourModel');
const AppError = require('../utils/appError');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'review can not be empty'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },

    // parent referencing
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'review must belong to a tour.'],
    },

    // parent referencing
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'review must belong to a user.'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
// For a compound multikey index, each indexed document can have at most one indexed field whose value is an array.
// this doesn't work if tour and user fields are declared as arrays in schema
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// can also be used to remove duplicates
// reviewSchema.index({ tour: 1, user: 1}, { unique: true, dropDups: true })

reviewSchema.pre(/^find/, function (next) {
  // 'this' points to current query

  // this commented out code will create inefficient chain of populate when queried from tour for reviews
  // this.populate({
  //   path: 'tour',
  //   select: 'name',
  // }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });

  this.populate({
    path: 'user',
    select: 'name photo',
  });

  next();
});

reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // in statics methods, 'this' points to the current model directly (here model is Review: not created yet, see below)
  const stats = await this.aggregate([
    {
      $match: {
        tour: tourId,
      },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: stats[0].avgRating,
      ratingsQuantity: stats[0].nRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: 4.5, // default value
      ratingsQuantity: 0,
    });
  }
};

reviewSchema.pre('save', async function (next) {
  const doc = await Tour.findById(this.tour);
  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }
});

reviewSchema.post('save', async function () {
  // 'this' points to current review (document)
  // 'this.constructor' points to the current model which created the review (document)

  await this.constructor.calcAverageRatings(this.tour);

  // won't work because Review isn't created yet
  // Review.calcAverageRatings(this.tour);
});

// findByIdAndUpdate
// findByIdAndDelete
// 'findOneAnd' will work for both of the above as those are shorthands for 'findOneAnd'. both of the above don't have any middleware while 'findOneAnd' can trigger query middleware
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // 'this' inside of the middleware refers to the query so if you're running another function on the same query then it will be passed the same argument that the original query was called with.
  // 'this' points to current query, 'this.findOne()' points to the current document after the query being executed
  // can't use post middleware be645fde1aaeec9e479ab3ace0cause the query will be already executed by then
  // this.r is used to pass document (review) from pre to post middleware
  this.r = await this.findOne();
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // await this.findOne(); doesn't work here because query has aleardy been executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

// another process for update and delete
// Post middleware will get the doc as the first argument. So the post middleware will get the updated review as an argument.
// reviewSchema.post(/^findOneAnd/, async function(doc) {
//   await doc.constructor.calcAverageRatings(doc.tour);
// });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
