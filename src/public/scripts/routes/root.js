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

  let concatStream = new ConcatStream;
  let config = loadData(`${dataPath}config.json`).then(r => r.json());
 
  let headTemplate = getCompiledTemplate(`${assetPath}templates/head.html`);
  let preloadTemplate = getCompiledTemplate(`${assetPath}templates/columns-preload.html`);
  let styleTemplate = getCompiledTemplate(`${assetPath}templates/columns-styles.html`);
  let columnTemplate = getCompiledTemplate(`${assetPath}templates/column.html`);
  let columnsTemplate = getCompiledTemplate(`${assetPath}templates/columns.html`);
  let itemTemplate = getCompiledTemplate(`${assetPath}templates/item.html`);

  let jsonFeedData = fetchCachedFeedData(config, itemTemplate, columnTemplate);

  const streams = {
    preload: preloadTemplate.then(render => config.then(c=> render({config: c }))),
    styles: styleTemplate.then(render => render({config: config })),
    data: columnsTemplate.then(render => jsonFeedData.then(columns => render({ columns: columns }))),
    itemTemplate: itemTemplate.then(render => render({item: {}}))
  };
  
  const headStream = headTemplate.then(render => render({config: config, streams: streams}));

  headStream.then(stream => stream.pipeTo(concatStream.writable))
  
  return Promise.resolve(new Response(concatStream.readable, { status: "200" }))
}

// Helpers
const fetchCachedFeedData = (config, itemTemplate, columnTemplate) => {
  // Return a promise that resolves to a map of column id => cached data.
  const resolveCache = (cache, url) => (!!cache) ? cache.match(new Request(url)).then(response => (!!response) ? response.text() : undefined) : Promise.resolve();
  const templateOptions = {
    includeAuthor: false
  };

  const mapColumnsToCache = (cache, config) => { 
    return config.columns.map(column => {
      return {
              config: column,
              data: resolveCache(cache, `/proxy?url=${column.feedUrl}`).then(items => convertFeedItemsToJSON(items))
             };
      });
  };

  const renderItems = (items) => {
    return items.map(item => itemTemplate.then(render => render({ templateOptions: templateOptions, item: item})))
  };
  
  return caches.open('data')
      .then(cache => config.then(configData => mapColumnsToCache(cache, configData)))
      .then(columns => {
        return columns.map(column => {
          return column.data.then(data => {
            return {
              config: column.config,
              items: renderItems(data)
            }
          });
        })
      })
      .then(columns => columns.map(column => columnTemplate.then(render => column.then(c => render({column: c})))));
};

export const handler = root;