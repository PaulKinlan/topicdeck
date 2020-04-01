import {
  fetch, caches, getProxyUrl, getProxyHeaders, proxyShouldHitNetwork
} from '../platform/common.js';

const proxyHandler = (request, paths) => {
  // Always hit the network, and update the cache so offline (and the streaming) renders are ok.
  return caches.match(request).then((response) => {
    const proxyUrl = getProxyUrl(request);
    if (proxyShouldHitNetwork === false) return response;
    return fetch(proxyUrl, getProxyHeaders(request)).then(fetchResponse => {
      if (fetchResponse.ok) {
        // Update the cache, but return the network response
        return caches.open('data')
            .then(cache => (cache) ? cache.put(request, fetchResponse.clone()) : undefined)
            .then(_ => fetchResponse);
      }
    });
  }).catch(error => {
    console.log('Proxy Fetch Error', error);
    throw error;
  });
};

export const handler = proxyHandler;
