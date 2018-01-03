//#set _NODE 1
import express from 'express';
import streamToString from 'stream-to-string';
import { getCompiledTemplate, cacheStorage, paths } from './public/scripts/platform/common.js';
import * as node from './public/scripts/platform/node.js';

import { handler as root } from './public/scripts/routes/root.js';
import { handler as proxy } from './public/scripts/routes/proxy.js';
import { handler as all } from './public/scripts/routes/all.js';

const app = express();

app.all('*', (req, res, next) => {
  // protocol check, if http, redirect to https
  if(true || req.get('X-Forwarded-Proto').indexOf("https") == 0 ) {
    return next();
  } else {
    res.redirect('https://' + req.hostname + req.url);
  }
});          

getCompiledTemplate(`${paths.assetPath}templates/head.html`);

app.get('/', (req, res, next) => {
  root()
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/all', (req, res, next) => {
  all()
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/proxy', (req, res, next) => {
  proxy(req)
    .then(response => node.sendStream(response.body, true, res));
});

/*
 Server specific functionality.
*/

let RSSCombiner = require('rss-combiner-ns');
let config = require(`./${paths.dataPath}config.json`);
let feeds = config.columns.map(column => column.feedUrl);

let latestFeed;
let feedConfig = {
  title: config.title,
  size: 100,
  feeds: feeds,
  generator: config.origin,
  site_url: config.origin,
  softFail: true,
  custom_namespaces: {
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'a10': 'http://www.w3.org/2005/Atom',
    'feedburner': 'http://rssnamespace.org/feedburner/ext/1.0'
  },
  pubDate: new Date(),
  successfulFetchCallback: (streamInfo) => cacheStorage[streamInfo.url] = streamInfo.stream
};

// A global server feedcache so we are not overloading remote servers

const fetchFeeds = () => {
  console.log('Checking Feed', Date.now());
  feedConfig.pubDate = new Date();
  
  RSSCombiner(feedConfig)
    .then(function (combinedFeed) {
      console.log('Feed Ready', Date.now());
      latestFeed = combinedFeed.xml();
    });
};

fetchFeeds();
setInterval(fetchFeeds, 30 * 60 * 1000);

app.get('/all.rss', (req, res, next) => {
  res.setHeader('Content-Type', 'text/xml')
  res.send(latestFeed);
});

/*
  Start the app.
*/
app.use(express.static('public'));
app.listen(8080);

if (typeof process === 'object') {
    process.on('unhandledRejection', (error, promise) => {
        console.error("== Node detected an unhandled rejection! ==");
        console.error(error.stack);
    });
}