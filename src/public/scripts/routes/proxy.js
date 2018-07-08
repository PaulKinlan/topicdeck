import {
  loadData, fetch, caches, parseUrl, getProxyUrl, getProxyHeaders, Response, proxyShouldHitNetwork
} from '../platform/common.js';

const proxyHandler = (request, paths) => {
  const config = loadData(`${paths.dataPath}config.json`).then(r => r.json());

  /*
    Go out to the networks.
  */
  const url = parseUrl(request); // The URL we want to fetch.

  console.log('proxy', url);
  return config.then(c => {
    if (c.columns.map(col => col.feedUrl).indexOf(url) < 0 && url.endsWith('/all.rss') == false) {
      // The proxyRequest to proxy is not in the list of configured urls
      return new Response('Proxy feed not configured', {status: '401'});
    }
    // Always hit the network, and update the cache so offline (and the streming) renders are ok.
    return caches.match(request).then((response) => {
      const proxyUrl = getProxyUrl(request);
      console.log('proxyShouldHitNetwork', proxyShouldHitNetwork);
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
  });
};

export const handler = proxyHandler;
