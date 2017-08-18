const swBuild = require('workbox-build');

swBuild.injectManifest({
  globDirectory: './public/assets/templates/',
  globPatterns: ['*.html'],
  swSrc: './private/build/sw.js',
  swDest: './public/sw.js',
  modifyUrlPrefix: {'': '/assets/templates/'}
})
.then(() => {
  console.log('Build Manifest generated.');
});