/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

const preload = '</scripts/client.js>; rel=preload; as=script, </sw.js>; rel=preload; as=script';
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
  const forwarded = req.get('X-Forwarded-Proto');
  const hostname = req.hostname;
  const feed = feedConfigs.get(hostname);

  if (feed && 'redirect' in feed) {
    res.redirect(feed.redirect);
    return;
  }

  if (forwarded && forwarded.indexOf('https') == 0 || hostname === '127.0.0.1') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return next();
  } else {
    res.redirect('https://' + hostname + req.url);
    return;
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
  res.setHeader('Link', preload);
  root(nonce, {
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

app.get('/all', (req, res, next) => {
  const hostname = getHostName(req);

  const nonce = {
    analytics: generator(),
    inlinedcss: generator(),
    style: generator()
  };

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
const fetchFeeds = (feeds) => {
  const feedList = Array.from(feeds.values());
  feedList.filter(config => 'redirect' in config === false).forEach(config => {
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
        if ((streamInfo.url in cacheStorage) == false) {
          cacheStorage[streamInfo.url] = streamInfo.stream;
        }
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
  const path = 'configs/';
  // Dynamically import the config objects
  const configs = fs.readdirSync(path)
      .filter(fileName => fileName.endsWith('.json') && fileName.startsWith('.') == false)
      .map(fileName => [fileName.replace(/\.config\.json$/,''), require('./' + path + fileName)]);

  return new Map(configs);
};

const fetchInterval = 60 * 60 * 1000;
const feedConfigs = getFeedConfigs();
fetchFeeds(feedConfigs);
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
