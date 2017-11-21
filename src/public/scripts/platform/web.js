/*
  The web versions of loading the data.
*/

var loadTemplate = (path) => {
  // Always return the cached asset, before hitting the network as a fallback
  return caches.match(new Request(path))
    .then(response => {
      return response || fetch(new Request(path))
    })
    .then(response => response.body);
};

var loadData = (path) => {
  const request = new Request(path);
   // Always return the cached asset, before hitting the network as a fallback
  return caches.open('data').then((cache) => {
    return cache.match(request.clone()).then(response => {
      const networkResource = fetch(path).then((networkResponse) => {
        cache.put(path, networkResponse.clone());
        return networkResponse;
      })
      .catch(error => {});
      
      return response || networkResource;
    })    
  })
}

function compileTemplate(path) {
  return loadTemplate(path)
    .then(stream => streamToString(stream))
    .then(template => doT.compile(template, {node: false, evaluate: /\$\$(([^\$]+|\\.)+)\$\$/g}));
}