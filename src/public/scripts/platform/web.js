/*
  The web versions of loading the data.
*/

import * as doT from '../dot.js';
import {DOMParser} from '../../../private/xml-dom-parser/dom-parser.js';

const templatePath = {};

var loadTemplate = (path) => {
  // Always return the memory cached asset, before hitting the cache and before the network as a fallback
  if(path in templatePath) {
    console.log(`loading ${path} from cache`)
    return templatePath[path].clone().body;
  }

  return caches.match(new Request(path))
    .then(response => {
      return response || fetch(new Request(path))
    })
    .then(response => { 
      // Cache in memory.
      templatePath[path] = response.clone();
      return response.body;
    });
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
  console.log(`loading template ${path}`);
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

var fetch = eval('self.fetch');
var WritableStream = eval('self.WritableStream');
var ReadableStream = eval('self.ReadableStream');
var Request = eval('self.Request');
var Response = eval('self.Response');
var caches = eval('self.caches');

const parseUrl = request => { 
  return new URL(request.url).searchParams.get("url");
};

const paths = {
  assetPath: '/assets/',
  dataPath: '/data/'
};

const cacheStorage = {};

export {
  compileTemplate,
  loadTemplate,
  loadData,
  streamToString,
  DOMParser,
  WritableStream,
  ReadableStream,
  Request,
  Response,
  fetch,
  caches, cacheStorage,
  parseUrl,
  paths
};