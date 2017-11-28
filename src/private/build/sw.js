/* VERSION: 0.0.91 */

import { handler as root } from './scripts/routes/root.js';
import { handler as proxy } from './scripts/routes/proxy.js';

const assetPath = '/assets/';
const dataPath = '/data/';

const workbox = new WorkboxSW({clientsClaim: true, skipWaiting: true});

// your custom service worker logic here
workbox.precache([]);

getCompiledTemplate(`${assetPath}templates/body.html`);

/*
  Router logic.
*/

// The proxy server '/proxy'
router.get(`${self.location.origin}/proxy`, (e) => {
  e.respondWith(proxy(dataPath, assetPath, e.request));
}, {urlMatchProperty: 'href'});

// The root '/'
router.get(`${self.location.origin}/$`, (e) => {
  e.respondWith(root(dataPath, assetPath));
}, {urlMatchProperty: 'href'});

