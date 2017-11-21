if (typeof module !== 'undefined' && module.exports) {
  var doT = require('../dot.js');
  let node = require('./node.js');
  var loadTemplate = node.loadTemplate;
  var streamToString = node.streamToString;
  var compileTemplate = node.compileTemplate;
  var ReadableStream = require('../../../private/streams/readable-stream.js').ReadableStream;
  var WritableStream = require('../../../private/streams/writable-stream.js').WritableStream;
  var TransformStream = require('../../../private/streams/transform-stream.js').TransformStream;
}

let templates = {};

function getCompiledTemplate(template) {
  if(template in templates) return Promise.resolve(templates[template]);
  return compileTemplate(template).then(templateFunction => templates[template] = templateFunction);
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

var ConcatStream = function() {
  let readableController;
  this.readable = new ReadableStream({
    start(controller) {
      readableController = controller;
    },
    abort(reason) {
      this.writable.abort(reason);
    }
  });
  this.writable = new WritableStream({
    write(chunks) {
      readableController.enqueue(chunks);
    },
    close() {
      readableController.close();
    },
    abort(reason) {
      readableController.error(new Error(reason));
    }
  })
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ConcatStream: ConcatStream,
    getCompiledTemplate: getCompiledTemplate,
    compileTemplate: compileTemplate
  }
}