/* VERSION: 0.0.4 */
importScripts('/scripts/router.js');
importScripts('/scripts/dot.js');
importScripts('/scripts/DOMParser.js');
importScripts('/scripts/platform/web.js');
importScripts('/scripts/platform/common.js');
importScripts('/scripts/routes/index.js');
importScripts('/scripts/routes/root.js');
importScripts('/scripts/routes/proxy.js');
importScripts('/scripts/workbox-sw.js'); // not the actual filename

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
  e.respondWith(routes['proxy'](dataPath, assetPath, e.request));
}, {urlMatchProperty: 'href'});

// The root '/'
router.get(`${self.location.origin}/$`, (e) => {
  e.respondWith(routes['root'](dataPath, assetPath));
}, {urlMatchProperty: 'href'});

