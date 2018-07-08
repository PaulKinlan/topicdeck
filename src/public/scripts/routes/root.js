import {
  loadData,
  ConcatStream,
  Request,
  Response,
  caches
} from '../platform/common.js';

import {convertFeedItemsToJSON} from '../data/common.js';

const root = (nonce, paths, templates) => {
  const config = loadData(`${paths.dataPath}config.json`).then(r => r.json());

  const concatStream = new ConcatStream;

  const jsonFeedData = fetchCachedFeedData(config, templates.item, templates.column);

  const streams = {
    styles: templates.columnsStyle.then(render => config.then(c => render({config: c, nonce: nonce}))),
    data: templates.columns.then(render => jsonFeedData.then(columns => render({columns: columns}))),
    itemTemplate: templates.item.then(render => render({options: {includeAuthor: false, new: true}, item: {}}))
  };

  const headStream = templates.head.then(render => render({config: config, streams: streams, nonce: nonce}));

  headStream.then(stream => stream.pipeTo(concatStream.writable));

  return Promise.resolve(new Response(concatStream.readable, {status: '200'}));
};

// Helpers
const fetchCachedFeedData = (config, itemTemplate, columnTemplate) => {
  // Return a promise that resolves to a map of column id => cached data.
  const resolveCache = (cache, url) => (cache) ? cache.match(new Request(url)).then(response => (response) ? response.text() : undefined) : Promise.resolve();
  const templateOptions = {
    includeAuthor: false
  };

  const mapColumnsToCache = (cache, config) => {
    return config.columns.map(column => {
      return {
        config: column,
        data: resolveCache(cache, `${config.origin}/proxy?url=${encodeURIComponent(column.feedUrl)}`).then(items => convertFeedItemsToJSON(items))
      };
    });
  };

  const renderItems = (items) => {
    return itemTemplate.then(render => render({templateOptions: templateOptions, items: items}));
  };

  return caches.open('data')
      .then(cache => config.then(configData => mapColumnsToCache(cache, configData)))
      .then(columns => {
        return columns.map(column => {
          return column.data.then(data => {
            return {
              config: column.config,
              items: renderItems(data)
            };
          });
        });
      })
      .then(columns => columns.map(column => {
        return columnTemplate.then(render => column.then(c => {
          const result = render({column: c});
          return result;
        }
        ));
      }));
};

export const handler = root;
