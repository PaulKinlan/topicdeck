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
//let preloadTemplate = getCompiledTemplate(`${paths.assetPath}templates/columns-preload.html`);
let styleTemplate = getCompiledTemplate(`${paths.assetPath}templates/columns-styles.html`);
let columnTemplate = getCompiledTemplate(`${paths.assetPath}templates/column.html`);
let columnsTemplate = getCompiledTemplate(`${paths.assetPath}templates/columns.html`);
let itemTemplate = getCompiledTemplate(`${paths.assetPath}templates/item.html`);

const root = () => {

  let concatStream = new ConcatStream;

  let jsonFeedData = fetchCachedFeedData(config, itemTemplate, columnTemplate);

  const streams = {
    //preload: preloadTemplate.then(render => config.then(c=> render({config: c }))),
    styles: styleTemplate.then(render => render({config: config })),
    data: columnsTemplate.then(render => jsonFeedData.then(columns => render({ columns: columns }))),
    itemTemplate: itemTemplate.then(render => render({options: {includeAuthor: false, new: true}, item: {}}))
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
              data: resolveCache(cache, `/proxy?url=${encodeURIComponent(column.feedUrl)}`).then(items => convertFeedItemsToJSON(items))
             };
      });
  };

  const renderItems = (items) => {
    return itemTemplate.then(render => render({ templateOptions: templateOptions, items: items}));
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