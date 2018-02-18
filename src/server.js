// #set _NODE 1
import express from 'express';
import fs from 'fs';
import {URL} from 'url';
import compression from 'compression';
import {
  getCompiledTemplate,
  cacheStorage, paths,
  generateCSPPolicy,
  generateIncrementalNonce
} from './public/scripts/platform/common.js';
import * as node from './public/scripts/platform/node.js';

import {handler as root} from './public/scripts/routes/root.js';
import {handler as proxy} from './public/scripts/routes/proxy.js';
import {handler as all} from './public/scripts/routes/all.js';
import {handler as manifest} from './public/scripts/routes/manifest.js';

const app = express();
app.use(compression({
  filter: (req, res) => true
}));

app.set('trust proxy', true);

const generator = generateIncrementalNonce('server');
const getHostName = (req) => {
  let hostname = req.hostname;

  if (knownHosts.has(hostname) == false) {
    hostname = '127.0.0.1';
  }

  return hostname.replace(/\//g, '');
};

app.all('*', (req, res, next) => {
  // protocol check, if http, redirect to https
  if (req.get('X-Forwarded-Proto').indexOf('https') == 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return next();
  } else {
    res.redirect('https://' + req.hostname + req.url);
  }
});

getCompiledTemplate(`${paths.assetPath}templates/head.html`);

app.get('/', (req, res, next) => {
  const hostname = getHostName(req);

  const nonce = {
    analytics: generator(),
    inlinedcss: generator(),
    style: generator()
  };

  res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
  res.setHeader('Link', '</scripts/client.js>; rel=preload; as=script, </sw.js>; rel=preload; as=script');
  root(nonce, {
    dataPath: `${paths.dataPath}${hostname}.`,
    assetPath: paths.assetPath
  })
      .then(response => {
        if (!!response == false) {
          console.error(req, hostname);
          return res.status(500).send(`Response undefined Error ${hostname}`);
        }
        node.responseToExpressStream(res, response.body);
      });
});

app.get('/all', (req, res, next) => {
  const hostname = getHostName(req);

  const nonce = {
    analytics: generator(),
    inlinedcss: generator(),
    style: generator()
  };

  const preload = '</scripts/client.js>; rel=preload; as=script, </sw.js>; rel=preload; as=script';

  res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
  res.setHeader('Link', preload);

  all(nonce, {
    dataPath: `${paths.dataPath}${hostname}.`,
    assetPath: paths.assetPath
  }).then(response => {
    if (!!response == false) {
      console.error(req, hostname);
      return res.status(500).send(`Response undefined Error ${hostname}`);
    }
    node.responseToExpressStream(res, response.body);
  });
});

app.get('/manifest.json', (req, res, next) => {
  const hostname = getHostName(req);

  manifest({
    dataPath: `${paths.dataPath}${hostname}.`,
    assetPath: paths.assetPath
  }).then(response => {
    node.responseToExpressStream(res, response.body);
  });
});

app.get('/proxy', (req, res, next) => {
  const hostname = getHostName(req);

  proxy(req, {
    dataPath: `${paths.dataPath}${hostname}.`,
    assetPath: paths.assetPath
  }).then(response => {
    if (!!response == false) {
      console.error(req, hostname);
      return res.status(500).send(`Response undefined Error ${hostname}`);
    }

    if (typeof(response.body) === 'string') {
      res.status(response.status).send(response.body);
    } else {
      node.sendStream(response.body, true, res);
    }
  });
});

/*
 Server specific functionality.
*/

const RSSCombiner = require('rss-combiner-ns');

const latestFeeds = {};
const knownHosts = new Set();

// A global server feedcache so we are not overloading remote servers
const fetchFeeds = () => {
  const feeds = getFeedConfigs();

  feeds.forEach(config => {
    const hostname = new URL(config.origin).hostname;
    console.log(`${hostname} Checking Feeds`, Date.now());
    knownHosts.add(hostname);

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
  let path = 'configs/';
  // Dynamically import the config objects
  return fs.readdirSync(path)
      .filter(fileName => fileName.endsWith('.json') && fileName.startsWith('_') == false && fileName.startsWith('.') == false)
      .map(fileName => require('./' + path + fileName));
};

const fetchInterval = 60 * 60 * 1000;
fetchFeeds();
setInterval(fetchFeeds, fetchInterval);

app.get('/all.rss', (req, res, next) => {
  const hostname = getHostName(req);

  res.setHeader('Content-Type', 'text/xml');
  res.send(latestFeeds[hostname]);
});

app.get('/data/config.json', (req, res, next) => {
  const hostname = getHostName(req);

  res.sendFile(`${__dirname}/configs/${hostname}.config.json`);
});

/*
  Start the app.
*/
app.use(express.static('public'));

app.listen(8080);

if (typeof process === 'object') {
  process.on('unhandledRejection', (error, promise) => {
    console.error('== Node detected an unhandled rejection! ==');
    console.error(error.stack);
  });
}
