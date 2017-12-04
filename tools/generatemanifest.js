const swBuild = require('workbox-build');

swBuild.injectManifest({
  globDirectory: './src/public/assets/templates/',
  globPatterns: ['*.html'],
  swSrc: './dist/server/public/sw.js',
  swDest: './dist/server/public/sw.js',
  modifyUrlPrefix: {'': '/assets/templates/'}
})
.then(() => {
  console.log('Build Manifest generated.');
});