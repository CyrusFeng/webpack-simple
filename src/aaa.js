// function module(require, exports) {
//   let what = require('./eat')
//   let where = require('./run')
//   exports.name = `mayun eat${what} run ${where}`
// }
//
// let modules = {
//   0: function (require, exports) {
//     let whatObj = require('./eat.js')
//     let whereObj = require('./run.js')
//     exports.action = `mayun eat ${whatObj.what} run to ${whereObj.where}`
//   },
//   1: function (require, exports) {
//     exports.what = '火锅'
//   },
//   2: function (require, exports) {
//     exports.where = '北京'
//   },
// }
//
//
// // function exec(id) {
// //   let fn = modules[id]
// //   let exports = {}
// //   fn(require, exports)
// //
// //   function require(path) {
// //
// //   }
// // }
// //
// // exec(0)
//
//
// let modules = {
//   0: [function (require, exports) {
//     let whatObj = require('./eat')
//     let whereObj = require('./run')
//     exports.action = `mayun eat ${whatObj.what} run to ${whereObj.where}`
//   }, {
//     './eat': 1,
//     './run': 2,
//   }
//   ],
//   1: [function (require, exports) {
//     exports.what = '火锅'
//   }, {}
//   ],
//   2: [function (require, exports) {
//     exports.where = '北京'
//   }, {}
//   ],
// }
//
// function exec(id) {
//   let [fn,mapping] = modules[id]
//   let exports = {}
//   fn(require, exports)
//
//   function require(path) {
//     return exec(mapping[path])
//   }
//
//   return exports
// }
// console.log(exec(0).action)