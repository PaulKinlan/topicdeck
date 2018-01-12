import { loadData, fetch, caches, parseUrl, getProxyUrl, paths, Response } from '../platform/common.js';

const proxyHandler = (request) => {
  /* 
    Go out to the networks.
  */ 
  const url = parseUrl(request); // The URL we want to fetch.

  let config = loadData(`${paths.dataPath}config.json`).then(r => r.json());

  return config.then(c => {
    if(c.columns.map(col => col.feedUrl).indexOf(url) < 0 && url.endsWith('/all.rss') == false) {
      // The request to proxy is not in the list of configured urls
      return new Response("Proxy feed not configured", {status: "401"});
    }
    // Always hit the network, and update the cache so offline (and the streming) renders are ok.
    return caches.match(request).then(response => {
      let network = fetch(getProxyUrl(request)).then(networkResponse => {    
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
  });
};

export const handler = proxyHandler;