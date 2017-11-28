import { fetch, caches, parseUrl } from '../platform/common.js';

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
};

export const handler = proxyHandler;