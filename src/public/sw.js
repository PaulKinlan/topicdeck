/* VERSION: 0.0.91 */
import { handler as root } from './scripts/routes/root.js';
import { handler as proxy } from './scripts/routes/proxy.js';
import { getCompiledTemplate } from './scripts/platform/common.js';
import { WorkboxSW } from './scripts/workbox-sw.js';
import { router } from './scripts/router.js';

const assetPath = '/assets/';
const dataPath = '/data/';

const workbox = new WorkboxSW({clientsClaim: true, skipWaiting: true});
// This should pre-cache all of the required assets determined at buildtime.
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

