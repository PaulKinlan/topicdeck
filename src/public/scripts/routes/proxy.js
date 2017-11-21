import * as platform from '../platform';

const proxyHandler = (dataPath, assetPath, request) => {
  /* 
    Go out to the networks.
  */ 
  const url = parseUrl(request);
    
  // Always hit the network, and update the cache so subsequent renders are ok.
  return fetch(url).then(networkResponse => {    
    if(networkResponse.ok)
      return caches.open('data')
           .then(cache => (!!cache) ? cache.put(request, networkResponse.clone()) : undefined)
           .then(_ => networkResponse);
    return networkResponse;
  }).catch(error => {
    console.log("Fetch Error", error);
    throw error;
  });
}

if (typeof module !== 'undefined' && module.exports) {
  var fetch = require('node-fetch');
  var Request = fetch.Request;
  var Response = fetch.Response;
  
  var parseUrl = request => request.query.url;
  
  // Really need a Cache API on the server.....
  caches = new (function() {
    this.open = () => {
      return Promise.resolve(undefined);
    };
  });
  
}
else { 
  var parseUrl = request => request.url; //new URL(request.url).searchParams.get('url');
}

module.exports = {
  handler: proxyHandler
}