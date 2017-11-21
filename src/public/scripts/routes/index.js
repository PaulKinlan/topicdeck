const routes = {};

if (typeof module !== 'undefined' && module.exports) {
  const rootHandler = require('./root.js');
  const proxyHandler = require('./proxy.js');
  
  module.exports = {
     root: rootHandler.handler,
     proxy: proxyHandler.handler
   }
}