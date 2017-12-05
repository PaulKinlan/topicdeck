//#set _NODE 1
import express from 'express';
import { getCompiledTemplate } from './public/scripts/platform/common.js';
import * as node from './public/scripts/platform/node.js';

import { handler as root } from './public/scripts/routes/root.js';
import { handler as proxy } from './public/scripts/routes/proxy.js';

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
getCompiledTemplate(`${assetPath}templates/body.html`);

app.get('/', (req, res, next) => {
  root(dataPath, assetPath)
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/proxy', (req, res, next) => {
  proxy(dataPath, assetPath, req)
    .then(response => response.body.pipe(res, {end: true}));
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