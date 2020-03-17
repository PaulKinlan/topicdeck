import {
  loadData,
  ConcatStream,
  Request,
  Response,
  caches
} from '../platform/common.js';

import {convertFeedItemsToJSON} from '../data/common.js';

const all = (nonce, paths, templates) => {
  const config = loadData(`${paths.dataPath}/config.json`).then(r => r.json());
  const concatStream = new ConcatStream;
  const jsonFeedData = fetchCachedFeedData(config, templates.item);

  const streams = {
    styles: templates.allStyle.then(render => config.then(c => render({config: c, nonce: nonce}))),
    data: templates.column.then(render => config.then(c => jsonFeedData.then(items => render({column: {config: {feedUrl: c.feedUrl, name: c.content.allTitle}, items: items}})))),
    itemTemplate: templates.item.then(render => render({options: {includeAuthor: true, new: true}, item: {}}))
  };

  const headStream = templates.head.then(render => render({config: config, streams: streams, nonce: nonce}));

  headStream.then(stream => stream.pipeTo(concatStream.writable));

  return Promise.resolve(new Response(concatStream.readable, {status: '200'}));
};

// Helpers.
// Todo. We will want to do a server side render...
const fetchCachedFeedData = (config, itemTemplate) => {
  // Return a promise that resolves to a map of column id => cached data.
  const resolveCachedUrl = (cache, url) => (cache) ? cache.match(new Request(url)).then(response => (response) ? response.text() : undefined) : Promise.resolve();
  const templateOptions = {
    includeAuthor: true
  };

  return caches.open('data')
      .then(cache => config.then(c => resolveCachedUrl(cache, `${c.origin}/proxy?url=${encodeURIComponent(c.feedUrl)}`)))
      .then(feed => { const items = convertFeedItemsToJSON(feed); return items; } )
      .then(items => itemTemplate.then(render => render({options: templateOptions, items: items})));
};

export const handler = all;
