import {
  loadTemplate,
  loadData,
  fetch,
  CommonDOMParser,
  ConcatStream,
  getCompiledTemplate,
  Request,
  Response,
  caches
 } from '../platform/common.js';

import { convertFeedItemsToJSON } from '../data/common.js';
const allUrl = 'https://webgdedeck.com/all.rss';
//const allUrl = 'http://127.0.0.1:8080/all.rss';

const all = (dataPath, assetPath) => {

  let concatStream = new ConcatStream;
  let config = loadData(`${dataPath}config.json`).then(r => r.json());
 
  let headTemplate = getCompiledTemplate(`${assetPath}templates/head.html`);
  let preloadTemplate = getCompiledTemplate(`${assetPath}templates/all-preload.html`);
  let styleTemplate = getCompiledTemplate(`${assetPath}templates/all-styles.html`);
  let columnTemplate = getCompiledTemplate(`${assetPath}templates/column.html`);
  let itemTemplate = getCompiledTemplate(`${assetPath}templates/item.html`);
  
  let jsonFeedData = fetchCachedFeedData(config, itemTemplate);

  const streams = {
    preload: preloadTemplate.then(render => config.then(c=> render({config: c }))),
    styles: styleTemplate.then(render => render({config: config })),
    data: columnTemplate.then(render => jsonFeedData.then(items => render({column: {config: { feedUrl: allUrl, name: "All GDE's"}, items: items } }))),
    itemTemplate: itemTemplate.then(render => render({item: {}}))
  };

  const headStream = headTemplate.then(render => render({config: config, streams: streams}));

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
      .then(cache => resolveCachedUrl(cache, `/proxy?url=${allUrl}`))
      .then(feed => convertFeedItemsToJSON(feed))
      .then(items => itemTemplate.then(render => items.map(item => render({options: templateOptions, item: item}))));
};

export const handler = all;