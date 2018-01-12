const swBuild = require('workbox-build');

swBuild.injectManifest({
  globDirectory: './src/public/',
  globPatterns: ['assets/templates/*.html', 'assets/templates/*.json','scripts/client.js', 'styles/main.css'],
  swSrc: './dist/server/public/sw.js',
  swDest: './dist/server/public/sw.js',
  modifyUrlPrefix: {'': '/'}
})
.then(() => {
  console.log('Build Manifest generated.');
});