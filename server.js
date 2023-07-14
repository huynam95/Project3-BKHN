const mongoose = require('mongoose');
const dotenv = require('dotenv');

// this should be before everything (synchronous)
process.on('uncaughtException', (err) => {
  console.log('uncaught exception 💥 shutting down...');
  console.log(err.name, err.message);
  // server.close(() => {
  // }); // not necessary: as the errors are synchronous like console.log(x) inside server.js or app.js
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);
mongoose
  // .connect(process.env.DATABASE_LOCAL, {
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  // .then((con) => {
  .then(() => {
    // console.log(con.connections);
    console.log('DB connection successful.');
  });

// console.log(app.get('env'));
// console.log(process.env);

//start server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`app running on port ${port}...`);
});

// asynchronous
process.on('unhandledRejection', (err) => {
  console.log('unhandled rejection 💥 shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. shutting down gracefully.');
  server.close(() => {
    console.log('process terminated!');
  });
});

// for npm run debug: use chrome://inspect
