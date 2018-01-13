import {
  loadData,
  ConcatStream,
  getCompiledTemplate,
  Request,
  Response,
  caches,
  paths
 } from '../platform/common.js';

import { convertFeedItemsToJSON } from '../data/common.js';

let config = loadData(`${paths.dataPath}config.json`).then(r => r.json());
 
let headTemplate = getCompiledTemplate(`${paths.assetPath}templates/head.html`);
let preloadTemplate = getCompiledTemplate(`${paths.assetPath}templates/all-preload.html`);
let styleTemplate = getCompiledTemplate(`${paths.assetPath}templates/all-styles.html`);
let columnTemplate = getCompiledTemplate(`${paths.assetPath}templates/column.html`);
let itemTemplate = getCompiledTemplate(`${paths.assetPath}templates/item.html`);

const all = (nonce) => {

  let concatStream = new ConcatStream;
  
  let jsonFeedData = fetchCachedFeedData(config, itemTemplate);

  const streams = {
    preload: preloadTemplate.then(render => config.then(c=> render({config: c }))),
    styles: styleTemplate.then(render => config.then(c => render({config: c, nonce: nonce}))),
    data: columnTemplate.then(render => config.then(c => jsonFeedData.then(items => render({column: {config: { feedUrl: c.feedUrl, name: "All GDE's"}, items: items } })))),
    itemTemplate: itemTemplate.then(render => render({options: {includeAuthor: true, new: true}, item: {}}))
  };

  const headStream = headTemplate.then(render => render({config: config, streams: streams, nonce: nonce}));

  headStream.then(stream => stream.pipeTo(concatStream.writable))
  
  return Promise.resolve(new Response(concatStream.readable, { status: "200" }))
}


// Helpers.
// Todo. We will want to do a server side render...
const fetchCachedFeedData = (config, itemTemplate) => {
  // Return a promise that resolves to a map of column id => cached data.
  const resolveCachedUrl = (cache, url) => (!!cache) ? cache.match(new Request(url)).then(response => (!!response) ? response.text() : undefined) : Promise.resolve();
  const templateOptions = {
    includeAuthor: true
  };

  return caches.open('data')
      .then(cache => config.then(c => resolveCachedUrl(cache, `/proxy?url=${encodeURIComponent(c.feedUrl)}`)))
      .then(feed => convertFeedItemsToJSON(feed))
      .then(items => itemTemplate.then(render => render({options: templateOptions, items: items})));
};

export const handler = all;