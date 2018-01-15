/* VERSION: 0.0.91 */
import { handler as root } from './scripts/routes/root.js';
import { handler as proxy } from './scripts/routes/proxy.js';
import { handler as all } from './scripts/routes/all.js';

import { getCompiledTemplate, paths, generateCSPPolicy, generateIncrementalNonce } from './scripts/platform/common.js';
import { WorkboxSW } from './scripts/workbox-sw.js';
import { router } from './scripts/router.js';


const workbox = new WorkboxSW({ skipWaiting: true, precacheChannelName: 'install-cache-channel'});
// This should pre-cache all of the required assets determined at buildtime.
workbox.precache([]);

getCompiledTemplate(`${paths.assetPath}templates/head.html`);

const setHeader = (response, header, value) => {
  response.headers.set(header, value)
  return response;
};
const generator = generateIncrementalNonce('service-worker');

/*
  Router logic.
*/

// The proxy server '/proxy'

router.get(`${self.location.origin}/proxy`, (e) => {
  let response = proxy(e.request);

  e.respondWith(response);
}, {urlMatchProperty: 'href'});

// The proxy server '/all'
router.get(`${self.location.origin}/all$`, (e) => {
  let nonce = {
    analytics: generator(),
    inlinedcss: generator(),
    style: generator()
  };

  let response = all(nonce).then(r => setHeader(r, 'Content-Security-Policy', generateCSPPolicy(nonce)));;
  e.respondWith(response);
}, {urlMatchProperty: 'href'});

// The root '/'
router.get(`${self.location.origin}/$`, (e) => {
  let nonce = {
    analytics: generator(),
    inlinedcss: generator(),
    style: generator()
  };

  let response = root(nonce).then(r => setHeader(r, 'Content-Security-Policy', generateCSPPolicy(nonce)));
  e.respondWith(response);
}, {urlMatchProperty: 'href'});