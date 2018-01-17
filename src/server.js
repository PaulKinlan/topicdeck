//#set _NODE 1
import express from 'express';
import fs from 'fs';
import { URL } from 'url';
import compression from 'compression';
import { getCompiledTemplate, cacheStorage, paths, generateCSPPolicy, generateIncrementalNonce } from './public/scripts/platform/common.js';
import * as node from './public/scripts/platform/node.js';

import { handler as root } from './public/scripts/routes/root.js';
import { handler as proxy } from './public/scripts/routes/proxy.js';
import { handler as all } from './public/scripts/routes/all.js';
import { handler as manifest } from './public/scripts/routes/manifest.js';

const app = express();
app.use(compression({
  filter: (req, res) => true
}));

app.set('trust proxy', true);

const generator = generateIncrementalNonce('server')

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
  let nonce = {
    analytics: generator(),
    inlinedcss: generator(),
    style: generator()
  };

  res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
  res.setHeader('Link', '</scripts/client.js>; rel=preload; as=script, </sw.js>; rel=preload; as=script');
  root(nonce)
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/all', (req, res, next) => {
  let nonce = {
    analytics: generator(),
    inlinedcss: generator(),
    style: generator()
  };

  res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
  res.setHeader('Link', '</scripts/client.js>; rel=preload; as=script, </sw.js>; rel=preload; as=script');
  all(nonce)
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/manifest.json', (req, res, next) => {
  manifest()
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/proxy', (req, res, next) => {
  proxy(req)
    .then(response => { 
      if(typeof(response.body) === 'string') {
        res.status(response.status).send(response.body);
      }
      else {
        node.sendStream(response.body, true, res);
      }
    });
});

/*
 Server specific functionality.
*/

let RSSCombiner = require('rss-combiner-ns');

let latestFeeds = {};

// A global server feedcache so we are not overloading remote servers
const fetchFeeds = () => {
  let feeds = getFeedConfigs();

  feeds.forEach(config => {
    const hostname = new URL(config.origin).hostname;
    console.log(`${hostname} Checking Feeds`, Date.now());
    
    const feedConfig = {
      title: config.title,
      size: 100,
      feeds: config.columns.map(column => column.feedUrl),
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
      successfulFetchCallback: (streamInfo) => {
        console.log(`Fetched feed: ${streamInfo.url}`);
        return cacheStorage[streamInfo.url] = streamInfo.stream;
      }
    };

    feedConfig.pubDate = new Date();

    RSSCombiner(feedConfig)
    .then(combinedFeed => {
      console.log(`${hostname} Feed Ready`, Date.now());
      latestFeeds[hostname] = combinedFeed.xml();
    });
  });
  
};

const getFeedConfigs = () => {
  var path = 'configs/';
  // Dynamically import the config objects
  return fs.readdirSync(path)
            .filter(fileName => fileName.endsWith('.json') && fileName.startsWith("_") == false && fileName.startsWith(".") == false)
            .map(fileName => require("./" + path + fileName))
}

fetchFeeds();
setInterval(fetchFeeds, 30 * 60 * 1000);

app.get('/all.rss', (req, res, next) => {
  let hostname = req.hostname; // Cleanse this.
  hostname = hostname.replace(/\//g,"");

  res.setHeader('Content-Type', 'text/xml');
  res.send(latestFeeds[hostname]);
});

app.get('/data/config.json', (req, res, next) => {
  let hostname = req.hostname; // Cleanse this.
  hostname = hostname.replace(/\//g,"");
  res.sendFile(`${__dirname}/configs/${hostname}.config.json`);
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