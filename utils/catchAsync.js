module.exports = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

// module.exports = (fn) => {
//   return (req, res, next) => {
//     fn(req, res, next).catch(next);
//   };
// };
// So let's deconstruct it:

// We know that route handlers/middleware in Express need to take in a function and that function gets called with the (req, res, next) arguments and we want to make it async, so we can do:

// app.get('/myroute', async (req, res, next) => {
//     ...
// })
// So that works and I can do this for every route. However, now I'll have to handle each error inside of the async function using try/catch everywhere and I'll have to do that for every route. How can I clean this up? Well since async functions return Promises, I know I can add a .catch() block to it, but I need to be able to pass next to the catch block. The only way to do that is with closures:

// const myFunc = async (req, res, next) => {
//     ...
// })

// app.get('/myroute', (req, res, next) => {
//     myFunc(req, res, next).catch(next)
// })
// Now when an error occurs, our .catch() block will catch it and call next() with the error. The next problem is that I need to generalize this so I can pass in any function I want so we wrap it in yet another function:

// const catchAsync = fn => {
//     return (req, res, next) => {
//         fn(req, res, next).catch(next)
//     }
// }
