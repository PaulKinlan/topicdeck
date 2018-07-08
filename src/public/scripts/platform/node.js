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

import * as doT from '../dot.js';

const fs = require('fs');
const TextDecoder = require('text-encoding').TextDecoder;
const DOMParser = require('xmldom-alpha').DOMParser;
const ReadableStream = require('./private/streams/readable-stream.js').ReadableStream;
const WritableStream = require('./private/streams/writable-stream.js').WritableStream;
const {FromWhatWGReadableStream} = require('fromwhatwgreadablestream');
const fetch = require('node-fetch');
const stringToStream = require('string-to-stream');
const Request = fetch.Request;
const Response = fetch.Response;

/*
  This file is basically me futzing about with Streams between Node and WhatWG
*/
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
      if (done) {
        const decoder = new TextDecoder();
        return resolve(decoder.decode(buffer));
      }

      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;

      return pull();
    }, e => reject(e));
  }

  pull();

  return promise;
}

const sendStream = (stream, last, res) => {
  if (stream == null || typeof(stream) === 'string') {
    if (last) {
      res.end();
    }
    return Promise.resolve();
  }

  stream.on('data', (data) => {
    res.write(data);
  });

  return new Promise((resolve, reject)=> {
    stream.on('end', () => {
      if (last) {
        res.end();
      }
      resolve();
    });

    stream.on('error', () => {
      res.end();
      reject();
    });
  });
};

const nodeReadStreamToWhatWGReadableStream = (stream) => {
  return new ReadableStream({
    start(controller) {
      stream.on('data', data => {
        controller.enqueue(data);
      });
      stream.on('error', error => {
        console.log(error);
        controller.abort(error);
      });
      stream.on('end', () => {
        controller.close();
      });
    }
  });
};

const loadTemplate = (path) => {
  return Promise.resolve(nodeReadStreamToWhatWGReadableStream(fs.createReadStream(path)));
};

const loadData = (path) => {
  return Promise.resolve(new Response(fs.createReadStream(path)));
};

function compileTemplate(path) {
  return loadTemplate(path)
      .then(stream => streamToString(stream))
      .then(template => {
        const f = doT.compile(template, {node: true, evaluate: /\$\$(([^\$]+|\\.)+)\$\$/g});
        return (data) => nodeReadStreamToWhatWGReadableStream(f(data));
      });
}

const responseToExpressStream = (expressResponse, fetchResponseStream) => {
  const stream = new FromWhatWGReadableStream({}, fetchResponseStream);
  stream.pipe(expressResponse, {end: true});
};

// Need a better interface to a memory store.
// The server can host multiple origins cache.
const cacheStorage = {};

const caches = new (function() {
  this.open = (cacheName) => {
    return Promise.resolve({
      'match': this.match,
      'put': () => null
    });
  };

  this.has = (cacheName) => {
    return Promise.resolve(true);
  };

  this.match = (request, options) => {
    const url = parseUrl(request);
    
    if (url in cacheStorage) {
      const cachedResponse = cacheStorage[url];
      const cachedResponseStream = stringToStream(cachedResponse);
      return Promise.resolve(new Response(cachedResponseStream, {status: '200', contentType: 'text/xml'}));
    } else {
      return Promise.resolve(undefined);
    }
  };
});

const parseUrl = request => {
  let url;
  if (request instanceof URL === false) {
    url = new URL(request.url);
  } else {
    url = request.searchParams.get('url');
  }
  return url;
};

const getProxyUrl = request => {
  let url;
  if (request instanceof URL === false) {
    url = new URL(request.url);
  } else {
    url = request.searchParams.get('url');
  }
  return url;
};

const getProxyHeaders = request => {
  return {
    'X-Forwarded-For': request.ips
  };
};

const paths = {
  assetPath: 'public/assets/',
  dataPath: 'configs/'
};

const proxyShouldHitNetwork = false;

export {
  compileTemplate, FromWhatWGReadableStream, loadTemplate,
  loadData, responseToExpressStream, streamToString, sendStream,
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
