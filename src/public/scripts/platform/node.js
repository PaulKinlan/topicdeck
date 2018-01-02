import * as doT from '../dot.js';


const fs = require('fs');
const TextDecoder = require('text-encoding').TextDecoder;
const TextEncoder = require('text-encoding').TextEncoder;
const Readable = require('stream').Readable;
const DOMParser = require('xmldom-alpha').DOMParser;
const ReadableStream = require('./private/streams/readable-stream.js').ReadableStream;
const WritableStream = require('./private/streams/writable-stream.js').WritableStream;
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

const sendStream = (stream, last, res) => {
  stream.on('data', (data) => {
    res.write(data);
  });
  
  return new Promise((resolve, reject)=> {
    stream.on('end', () => {
      if(last) { res.end(); }
      resolve();
    });
    
    stream.on('error', () => {
      res.end();
      reject();
    })
  });
};

const nodeReadStreamToWhatWGReadableStream = (stream) => {
    
  return new ReadableStream({
    start(controller) {
      stream.on('data', data => {
        controller.enqueue(data)
      });
      stream.on('error', error => { console.log(error); controller.abort(error); });
      stream.on('end', () => {
        controller.close();
      })
    }
  });
};

class FromWhatWGReadableStream extends Readable {
  constructor(options, whatwgStream) {
    super(options);
    const streamReader = whatwgStream.getReader();
    const outStream = this;
    
    function pump() {
      return streamReader.read().then(({ value, done }) => {
        if (done) {
          outStream.push(null);
          return;
        }
      
        outStream.push(value.toString());
        return pump();
      });
    }
    
    pump();
  }
  
  _read(size) {
    
  }
}

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
  stream.pipe(expressResponse, {end:true});
};

// Need a better interface to a memory store.
const cacheStorage = {};

const caches = new (function() {
  this.open = (cacheName) => {
    return Promise.resolve(undefined);
  };

  this.has = (cacheName) => {
    return Promise.resolve(true);
  };

  this.match = (request, options) => {
    const url = parseUrl(request);
    if(url in cacheStorage) {
      const cachedResponse = cacheStorage[url];
      const cachedResponseStream = stringToStream(cachedResponse);
      return Promise.resolve(new Response(cachedResponseStream, { status: "200", contentType: "text/xml" }));
    }
    else {
      return Promise.resolve(undefined);
    }
  };
});

var parseUrl = request => request.query.url;

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
  parseUrl
};