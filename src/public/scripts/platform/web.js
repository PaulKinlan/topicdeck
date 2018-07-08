/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
  The web versions of loading the data.
*/

import * as doT from '../dot.js';
//#ifset _SERVICEWORKER
import { DOMParser } from '../../../private/xml-dom-parser/dom-parser.js';
//#else
let DOMParser = eval('window.DOMParser');
//#endif
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

var configCache = {};
var loadData = (path) => {
  // The config will never update when you are on the page and it's not multi-tenency.
  if(path in configCache) {
    return Promise.resolve(configCache[path].then(r => r.clone()));
  }

  const request = new Request(path);
   // Always return the cached asset, before hitting the network as a fallback
  const response = caches.open('data').then((cache) => {
    return cache.match(request.clone()).then(cacheResponse => {
      const networkResource = fetch(path).then((networkResponse) => {
        cache.put(path, networkResponse.clone());
        return networkResponse;
      })
      .catch(error => new Response("Not found.", {status: "404"}));
      
      return cacheResponse || networkResource;
    })    
  });

  configCache[path] = response.then(r => r.clone());
  return response;
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

const getProxyUrl = request => request.url;

const getProxyHeaders = request => {
  return {};
};

const paths = {
  assetPath: '/assets/',
  dataPath: '/data/'
};

const cacheStorage = {};

const proxyShouldHitNetwork = true;

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
  getProxyUrl,
  getProxyHeaders,
  proxyShouldHitNetwork,
  paths
};