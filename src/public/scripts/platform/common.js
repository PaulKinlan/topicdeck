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

function generateCSPPolicy(nonce) {
  return `default-src 'self'; script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com 'nonce-script-${nonce.analytics}' 'unsafe-eval'; connect-src 'self'; img-src 'self' data: https://www.google-analytics.com; style-src 'self' 'nonce-style-${nonce.style}' 'nonce-style-${nonce.inlinedcss}';`; 
};

function generateIncrementalNonce(source) {
  let val = 0;
  let max = Math.pow(10, 3); // Date + pow 3 gets us close to max number;

  const generate = () => {
    let now = max * +new Date();
    if(val >= max) val = 0;
    else val++;
    return (source !== undefined ? source : '') + (now + val).toString();
  }

  return generate;
};

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

export { ConcatStream, getCompiledTemplate, generateCSPPolicy, generateIncrementalNonce };
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
export const getProxyHeaders = common.getProxyHeaders;
export const paths = common.paths;