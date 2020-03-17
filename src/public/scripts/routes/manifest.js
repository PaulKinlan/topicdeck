import {
  loadData,
  ConcatStream,
  Response
} from '../platform/common.js';

const manifest = (paths, templates) => {
  const config = loadData(`${paths.dataPath}/config.json`).then(r => r.json());
  const concatStream = new ConcatStream;
  const manifestStream = templates.manifest.then(render => render({config: config}));

  manifestStream.then(stream => stream.pipeTo(concatStream.writable));

  return Promise.resolve(new Response(concatStream.readable, {status: '200'}));
};

export const handler = manifest;
