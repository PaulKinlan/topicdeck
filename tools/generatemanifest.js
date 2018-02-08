const swBuild = require('workbox-build');
const patterns = ['assets/templates/*.html',
  'assets/templates/*.json',
  'scripts/client.js',
  'styles/main.css'];
const config = {
  globDirectory: './dist/server/public/',
  globPatterns: patterns,
  swSrc: './dist/server/public/sw.js',
  swDest: './dist/server/public/sw.js',
  modifyUrlPrefix: {'': '/'}
};

swBuild.injectManifest(config).then(() => {
  console.log('Build Manifest generated.');
});
