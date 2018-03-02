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

import {
  CommonDOMParser
} from '../platform/common.js';

const findNode = (tagName, nodes) => {
  let node;
  for (let i = 0; i < nodes.length; i++) {
    node = nodes[i];
    if (node.tagName == tagName) {
      return node;
    }
  }

  return undefined;
};

const findNodes = (tagName, nodes) => {
  const foundNodes = [];
  let node;
  for (let i = 0; i < nodes.length; i++) {
    node = nodes[i];
    if (node.tagName == tagName) {
      foundNodes.push(node);
    }
  }

  return foundNodes;
};

const hardSanitize = (str, limit) => {
  limit = limit || 100;
  let strip = false;
  const output = [];

  for (let c of str) {
    if (output.length > limit) break;
    if (c == '<') {
      strip = true;
      continue;
    }
    if (c == '>' && strip == true) {
      strip = false;
      continue;
    }
    if (c == '\n' || c == '\r') {
      continue;
    }
    if (strip) continue;

    output.push(c);
  }
  return output.join('');
};

const findElementText = (tagName, item) => {
  const elements = findNodes(tagName, item.childNodes);
  if (elements && elements.length > 0) {
    return elements[0].textContent;
  }

  return '';
};

const findElementAttribute = (tagName, attribute, item) => {
  const elements = findNodes(tagName, item.childNodes);
  if (elements && elements.length > 0) {
    const attr = elements[0].attributes.getNamedItem(attribute);
    return (attr !== undefined) ? attr.value : '';
  }

  return '';
};

const attributeEquals = (attribute, value) => {
  return (element) => {
    const attr = element.attributes.getNamedItem(attribute);
    return (attr && attr.value === value);
  };
};

const convertFeedItemsToJSON = (feedText) => {
  if (feedText === undefined) return [];

  const parser = new CommonDOMParser();
  const feed = parser.parseFromString(feedText, 'application/xml');
  const documentElement = feed.documentElement;
  const defaults = {};

  if (documentElement === null) {
    return [];
  }

  if (documentElement.nodeName === 'rss') {
    const channel = findNode('channel', documentElement.childNodes);
    const title = findElementText('title', channel);
    const link = findElementText('link', channel);
    const items = findNodes('item', channel.childNodes);

    defaults.title = title;
    defaults.link = link;

    return items.map(item => convertRSSItemToJSON(item, defaults));
  } else if (documentElement.nodeName === 'feed') {
    const entrys = findNodes('entry', documentElement.childNodes);
    const title = findElementText('title', documentElement);
    const link = '';

    const linkElement = findNodes('link', documentElement)
        .filter(attributeEquals('rel', 'self'))[0];

    defaults.title = title;
    defaults.link = link;

    return entrys.map(entry => convertAtomItemToJSON(entry, defaults));
  } else {
    return [];
  }
};

const convertAtomItemToJSON = (item, defaults) => {
  const title = findElementText('title', item);
  const description = findElementText('summary', item);
  const guid = findElementText('id', item);
  const pubDate = findElementText('updated', item);
  const author = findElementText('author', item) || findElementText('dc:creator', item) || defaults.title;
  const link = findElementAttribute('link', 'href', item);

  return {'title': hardSanitize(title, 400), 'guid': guid, 'description': hardSanitize(description, 100), 'pubDate': pubDate, 'author': author, 'link': link};
};

const convertRSSItemToJSON = (item, defaults) => {
  const title = findElementText('title', item);
  const description = findElementText('description', item);
  const guid = findElementText('guid', item);
  const pubDate = findElementText('pubDate', item) || findElementText('a10:updated', item);
  const author = findElementText('author', item) || findElementText('dc:creator', item) || defaults.title;
  const link = findElementText('link', item);
  const contentEncoded = findElementText('content:encoded', item);
 
  return {'title': hardSanitize(title, 400), 'guid': guid, 'description': hardSanitize(description, 100), 'content:encoded': hardSanitize(contentEncoded, 100), 'pubDate': pubDate, 'author': author, 'link': link};
};

export {
  convertFeedItemsToJSON
};
