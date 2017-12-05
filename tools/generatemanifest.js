const swBuild = require('workbox-build');

swBuild.injectManifest({
  globDirectory: './src/public/',
  globPatterns: ['assets/templates/*.html', 'scripts/client.js'],
  swSrc: './dist/server/public/sw.js',
  swDest: './dist/server/public/sw.js',
  modifyUrlPrefix: {'': '/'}
})
.then(() => {
  console.log('Build Manifest generated.');
});