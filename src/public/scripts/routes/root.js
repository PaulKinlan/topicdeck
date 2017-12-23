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

const root = (dataPath, assetPath) => {

  let config = loadData(`${dataPath}config.json`).then(r => r.json());
 
  let headTemplate = getCompiledTemplate(`${assetPath}templates/head.html`);
  let itemTemplate = getCompiledTemplate(`${assetPath}templates/item.html`);
  
  let jsonFeedData = fetchCachedFeedData(config, itemTemplate);
  
  /*
   * Render the head from the cache or network
   * Render the body.
     * Body has template that brings in config to work out what to render
     * If we have data cached let's bring that in.
   * Render the footer - contains JS to data bind client request.
  */
  
  const headStream = headTemplate.then(render => jsonFeedData.then(columns => render({ config: config, columns: columns })));

  let concatStream = new ConcatStream;
  
  headStream.then(stream => stream.pipeTo(concatStream.writable))
  
  return Promise.resolve(new Response(concatStream.readable, { status: "200" }))
}


// Helpers
const fetchCachedFeedData = (config, itemTemplate) => {
  // Return a promise that resolves to a map of column id => cached data.
  const resolveCache = (cache, url) => (!!cache) ? cache.match(new Request(url)).then(response => (!!response) ? response.text() : undefined) : Promise.resolve();
  const mapColumnsToCache = (cache, config) => config.columns.map(column => [column, resolveCache(cache, `/proxy?url=${column.feedUrl}`)]);
  const mapCacheToTemplate = (columns) => columns.map(column => [column[0], column[1].then(items => itemTemplate.then(render => render({ items: convertFeedItemsToJSON(items)})))]);
    
  return caches.open('data')
      .then(cache => config.then(configData => mapColumnsToCache(cache, configData)))
      .then(columns => mapCacheToTemplate(columns));
};

export const handler = root;