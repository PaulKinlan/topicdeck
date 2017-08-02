const doT = require('../dot.js');
const fs = require('fs');
const fetch = require('node-fetch');
const Response = fetch.Response;
const TextDecoder = require('text-encoding').TextDecoder;
const Readable = require('stream').Readable;

const ReadableStream = require('../../../private/streams/readable-stream.js').ReadableStream;
const WritableStream = require('../../../private/streams/writable-stream.js').WritableStream;
const TransformStream = require('../../../private/streams/transform-stream.js').TransformStream;

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
      stream.on('error', (error) => controller.abort(error))
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

module.exports = {
  compileTemplate: compileTemplate,
  FromWhatWGReadableStream: FromWhatWGReadableStream,
  loadTemplate: loadTemplate,
  loadData: loadData,
  responseToExpressStream: responseToExpressStream,
  streamToString: streamToString,
  sendStream: sendStream
};