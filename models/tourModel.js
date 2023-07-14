//schema
const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel'); // for embedding only
// const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'a tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'a tour must have less than or equal to 40 characters.'],
      minlength: [10, 'a tour must have more than or equal to 10 characters.'],
      // validate: [validator.isAlpha, 'tour name must only contain characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'a tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'a tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'a tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'difficulty is either: easy, medium, difficult.',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'rating must be above 1.0'],
      max: [5, 'rating must be below 5'],
      set: (val) => Math.round(val * 10) / 10, // 4.66666, 46.666, 47, 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'a tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // 'this' only points to current doc on NEW document creation
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price.',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'a tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'a tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },

    // embedding
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // guides: Array, // for embedding

    // child referencing
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        // The name of the ref has to match the name of the model when mongoose.model was called. Mongoose then knows to query that model when you populate it.
        ref: 'User', // no need to import userModel.js
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// single field index: mongodb engine will create index of price to do faster processing. related to .explain() and preview of "executionStats"
// tourSchema.index({ price: 1 }); // commenting out will not delete index from the DB, delete explicitly

tourSchema.index({ slug: 1 });

// compound index (also supports single field index)
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ startLocation: '2dsphere' });
//virtual property
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; // 'this' keyword is absent in arrow functions
});

// virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// document middleware: runs before .save() and .create()
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// embedding/denormalization
// problem: tour guide's updating email or changing role from guide to lead-guide; we need to check if any tour has that user as a guide and update the tour's embedded data beacuse it'll not be automatically changed along with the user
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   // guidesPromises is an array full of promises, we need to run them concurrently
//   this.guides = await Promise.all(guidesPromises);
// });

// tourSchema.pre('save', (next) => {
//   console.log('document will be saved...');
//   next();
// });

// tourSchema.post('save', (doc, next) => {
//   console.log(doc);
//   next();
// });

// query middleware
tourSchema.pre(/^find/, function (next) {
  //regular expression: all queries that start with 'find'
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  // 'this' points to current query
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

// tourSchema.post(/^find/, function (docs, next) {
//   console.log(`query took ${Date.now() - this.start} milliseconds`);
//   next();
// });

// aggregation middleware
tourSchema.pre('aggregate', function (next) {
  // unshift: add  another match at the beginning of the aggregation array
  if (!(Object.keys(this.pipeline()[0])[0] === '$geoNear')) {
    this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
  }
  next();
});

//model
const Tour = mongoose.model('Tour', tourSchema);
module.exports = Tour;
