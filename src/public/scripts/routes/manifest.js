import {
  loadData,
  ConcatStream,
  getCompiledTemplate,
  Response,
  paths
 } from '../platform/common.js';


let manifestTemplate = getCompiledTemplate(`${paths.assetPath}templates/manifest.json`);

const manifest = (paths) => {
  let config = loadData(`${paths.dataPath}config.json`).then(r => r.json());
  let concatStream = new ConcatStream;
  const manifestStream = manifestTemplate.then(render => render({config: config}));

  manifestStream.then(stream => stream.pipeTo(concatStream.writable))
  
  return Promise.resolve(new Response(concatStream.readable, { status: "200" }))
}


export const handler = manifest;