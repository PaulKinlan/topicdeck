//#ifset _NODE
import * as common from './node.js'
//#else
import * as common from './web.js'
//#endif

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

export { ConcatStream, getCompiledTemplate };
export const compileTemplate = common.compileTemplate;
export const streamToString = common.streamToString;
export const loadData = common.loadData;
export const loadTemplate = common.loadTemplate;
export const CommonDOMParser = common.DOMParser;
export const ReadableStream = common.ReadableStream;
export const WritableStream = common.WritableStream;
export const fetch =  common.fetch;
export const Request = common.Request;
export const Response = common.Response;
export const caches = common.caches;
export const cacheStorage = common.cacheStorage;
export const parseUrl = common.parseUrl;
export const getProxyUrl = common.getProxyUrl;
export const paths = common.paths;