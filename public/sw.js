/* VERSION: 0.0.91 */
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
workbox.precache([
  {
    "url": "/assets/templates/body.html",
    "revision": "0ab652c4d6e840b974aa068cb5bd3d1f"
  },
  {
    "url": "/assets/templates/foot.html",
    "revision": "cec363093e60b87f646fe8904a5d4cd5"
  },
  {
    "url": "/assets/templates/head.html",
    "revision": "eaeeb7ab9f1f93d8222fd2073a4ab526"
  },
  {
    "url": "/assets/templates/item.html",
    "revision": "d8be335f33f782caed1dccf42c4df564"
  }
]);

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

