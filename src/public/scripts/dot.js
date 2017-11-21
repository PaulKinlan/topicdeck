/**!
 *
 * Copyright 2016 Google Inc. All rights reserved.
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

(function (root, factory) {
  if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
      factory(exports);
  } else {
      factory((root.doT = {}));
  }
}(this, function (exports) {
  "use strict";

  Object.assign(exports, {
    version: "1.1.1",
    templateSettings: {
      evaluate: /\{\{(([^\}]+|\\.)+)\}\}/g,
      interpolate: /\{\{=\s*([^\}]+)\}\}/g,
      stream: /\{\{~\s*([^\}]+)\}\}/g,
      conditional: /\{\{\?(\?)?\s*([^\}]*)?\}\}/g,
      node: typeof(process) === 'object',
      varname: "it",
    }
  });

  function unescape(code) {
    return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, " ");
  }

  exports.compile = function(tmpl, c, def) {
    c = Object.assign({}, exports.templateSettings, c);
    var helpers = 
      "var P=Promise.resolve.bind(Promise);" +
      "function* f(p,a,b){yield p.then(v=>(a=v?a:b)&&'');yield* (a||(_=>[]))();};";
    var streamToGenerator;
    var streamNodeGenerator;
    var streamWGGenerator;
    
    streamNodeGenerator = 
`var sNode=rN=>{
var d=!1,l,b=[];
rN.then(rN=>{
rN.on('end',_=>{d=!0;l&&l()});
rN.on('data',c=>(l&&(v=>{var t=l;l=null;t(v)})||(d=>b.push(d)))(c));
});
return i={next:_=>({done:b.length===0&&d,value:P(b.shift()||new Promise(rN=>l=rN))}),[Symbol.iterator]:_=>i};};`;
    
   streamWGGenerator = 
`var sWhatWg=rW=>{
rW=rW.then(l=>l.getReader());
var d=!1;
return i={next:_=>({done:d,value:rW.then(rW=>rW.read()).then(v=>{d=v.done;return P(v.value)})}),[Symbol.iterator]:_=>i};
};`;
  
 /* if (c.node) {
    streamToGenerator = 'var s=sNode;';
  }
  else {
    streamToGenerator = 'var s=sWhatWg;';
  }*/
    
    streamToGenerator = `var s = function(x) { return x.then(stream => (stream.constructor.name === 'StreamReader') ? sNode : sWhatWg )};`;

    tmpl = helpers + streamToGenerator + streamWGGenerator + streamNodeGenerator + 
        "var g=function*(){yield P('"
        + tmpl
            .replace(/'|\\/g, "\\$&")
            .replace(c.interpolate, function(_, code) {
              return "');yield P(" + unescape(code) + ");yield P('";
            })
            .replace(c.conditional, function(_, els, code) {
              if (code && !els) { // {{?<something>}} === if
                return "');yield* f(P(" + unescape(code) + "),function*(){yield P('"
              } else if (!code && els) { // {{??}} === else
                return "')},function*(){yield P('";
              } else { // {{?}} === "endif"
                return "')});yield P('";
              }
            })
            .replace(c.stream, function(_, code) {
              return "');yield* s(P(" + unescape(code) + "));yield P('";
            })
            .replace(c.evaluate, function(_, code) {
              return "');" + unescape(code) + ";yield P('";
            })
            .replace(/\n/g, "\\n")
            .replace(/\t/g, '\\t')
            .replace(/\r/g, "\\r")
         + "');}();";

    if(c.node) {
      tmpl +=
`var r = new R({read:function f() {
var d=g.next();
if(d.done) return r.push(null);
P(d.value).then(v=>{if(v)return r.push(Buffer.from(v));else f()});
}});
return r;
`;
    } else {
      tmpl +=
`var e=new TextEncoder();
return new ReadableStream({
pull: c=>{
var v=g.next();
if(v.done)return c.close();
v.value.then(d=>{
if(typeof(d)=="string")d=e.encode(d);
d&&c.enqueue(d);
});
return v.value;
}});`;
    }

    try {
      if (c.noEval) return tmpl;
      if (c.node) {
        const f = new Function(c.varname, 'R', tmpl); 
        return it => f(it, require('stream').Readable);
      } 
      return new Function(c.varname, tmpl);
    } catch (e) {
      console.log("Could not create a template function: " + tmpl);
      throw e;
    }
  };
}));