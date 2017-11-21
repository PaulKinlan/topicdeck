import * as node from './node.js';
import * as web from './web.js';

let templates = {};

function getCompiledTemplate(template) {
  if(template in templates) return Promise.resolve(templates[template]);
  return compileTemplate(template).then(templateFunction => templates[template] = templateFunction);
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
  var ReadableStream = require('../../../private/streams/readable-stream.js').ReadableStream;
  var WritableStream = require('../../../private/streams/writable-stream.js').WritableStream;
}

module.exports = {
  ConcatStream: ConcatStream,
  getCompiledTemplate: getCompiledTemplate,
  compileTemplate: (typeof module !== 'undefined' && module.exports) ? node.compileTemplate : web.compileTemplate,
  streamToString :(typeof module !== 'undefined' && module.exports) ? node.streamToString : web.streamToString
}