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

function streamToString(stream) {
  const reader = stream.getReader();
  let buffer = new Uint8Array();
  let resolve;
  let reject; 

  const promise = new Promise((res, rej) => {
    resolve=res;
    reject=rej;
  });

  function pull() {
    return reader.read().then(({value, done}) => {
      if(done) {          
        const decoder = new TextDecoder();
        return resolve(decoder.decode(buffer));
      }

      let newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;

      return pull();
    }, e => reject(e));
  }

  pull();

  return promise;
}

module.exports = {
  compileTemplate: compileTemplate,
  loadTemplate: loadTemplate,
  loadData: loadData,
  streamToString: streamToString
};