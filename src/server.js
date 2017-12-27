//#set _NODE 1
import express from 'express';
import { getCompiledTemplate } from './public/scripts/platform/common.js';
import * as node from './public/scripts/platform/node.js';

import { handler as root } from './public/scripts/routes/root.js';
import { handler as proxy } from './public/scripts/routes/proxy.js';
import { handler as all } from './public/scripts/routes/all.js';

const app = express();

const assetPath = 'public/assets/';
const dataPath = 'public/data/';

app.all('*', (req, res, next) => {
  // protocol check, if http, redirect to https
  if(true || req.get('X-Forwarded-Proto').indexOf("https") == 0 ) {
    return next();
  } else {
    res.redirect('https://' + req.hostname + req.url);
  }
});          

getCompiledTemplate(`${assetPath}templates/head.html`);

app.get('/', (req, res, next) => {
  root(dataPath, assetPath)
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/all', (req, res, next) => {
  all(dataPath, assetPath)
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/proxy', (req, res, next) => {
  proxy(dataPath, assetPath, req)
    .then(response => response.body.pipe(res, {end: true}));
});

/*
 Server specific functionality.
*/

let RSSCombiner = require('rss-combiner');
let config = require(`./${dataPath}config.json`);
let feeds = config.columns.map(column => column.feedUrl);

let latestFeed;
let feedConfig = {
  title: config.title,
  size: 100,
  feeds: feeds,
  generator: config.origin,
  site_url: config.origin,
  softFail: true,
  pubDate: new Date()
};

// Promise usage
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