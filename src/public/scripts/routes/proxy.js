import { fetch, caches, parseUrl } from '../platform/common.js';

const proxyHandler = (request) => {
  /* 
    Go out to the networks.
  */ 
  const url = parseUrl(request);
    
  // Always hit the network, and update the cache so offline (and the streming) renders are ok.
  return caches.match(request).then(response => {
    
    let network = fetch(url).then(networkResponse => {    
      if(networkResponse.ok) {
        return caches.open('data')
             .then(cache => (!!cache) ? cache.put(request, networkResponse.clone()) : undefined)
             .then(_ => networkResponse);
      }
    });

    if(response === undefined) {
      // If there is no match in the cache, just go to the network
      return network;
    }
    // Otherwise, just race the two... response should win.
    return Promise.race([response, network]);
  }).catch(error => {
    console.log("Proxy Fetch Error", error);
    throw error;
  });
};

export const handler = proxyHandler;