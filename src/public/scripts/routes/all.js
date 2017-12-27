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

const all = (dataPath, assetPath) => {

  let config = loadData(`${dataPath}config.json`).then(r => r.json());
 
  let headTemplate = getCompiledTemplate(`${assetPath}templates/head.html`);
  let styleTemplate = getCompiledTemplate(`${assetPath}templates/all-styles.html`);
  let itemsTemplate = getCompiledTemplate(`${assetPath}templates/all.html`);
  let itemTemplate = getCompiledTemplate(`${assetPath}templates/item.html`);
  
  let jsonFeedData = fetchCachedFeedData(config, itemTemplate);
  
  /*
   * Render the head from the cache or network
   * Render the body.
     * Body has template that brings in config to work out what to render
     * If we have data cached let's bring that in.
   * Render the footer - contains JS to data bind client request.
  */
  
  const styleStream = styleTemplate.then(render => render({config: config }));
  const itemsStream = itemsTemplate.then(render => jsonFeedData.then(items => render({url: allUrl, items: items })));
  const headStream = headTemplate.then(render => render({config: config, data: itemsStream, styles: styleStream}));

  let concatStream = new ConcatStream;
  
  headStream.then(stream => stream.pipeTo(concatStream.writable))
  
  return Promise.resolve(new Response(concatStream.readable, { status: "200" }))
}


// Helpers.
// Todo. We will want to do a server side render...
const fetchCachedFeedData = (config, itemTemplate) => {
  // Return a promise that resolves to a map of column id => cached data.
  const resolveCachedUrl = (cache, url) => (!!cache) ? cache.match(new Request(url)).then(response => (!!response) ? response.text() : undefined) : Promise.resolve();
  
  return caches.open('data')
      .then(cache => resolveCachedUrl(cache, `/proxy?url=${allUrl}`))
      .then(items => itemTemplate.then(render => render({ items: convertFeedItemsToJSON(items)})));
};

export const handler = all;