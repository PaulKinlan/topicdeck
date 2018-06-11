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

import {convertFeedItemsToJSON} from './data/common.js';

(function() {
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
      // Registration was successful
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function(err) {
      // registration failed :(
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

if ('BroadcastChannel' in window) {
  const installBroadcastChannel = new BroadcastChannel('install-cache-channel');
  installBroadcastChannel.onmessage = (ev) => {
    console.log(ev);
    const toast = document.getElementById('toast');
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 10000);
  };
}

const applyTemplate = (templateElement, data) => {
  const element = templateElement.content.cloneNode(true);
  const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, () => NodeFilter.FILTER_ACCEPT);

  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    for (const bindAttr in node.dataset) {
      const isBindableAttr = (bindAttr.indexOf('bind_') == 0) ? true : false;
      if (isBindableAttr) {
        const dataKeyString = node.dataset[bindAttr];
        const dataKeys = dataKeyString.split('|');
        const bindKey = bindAttr.substr(5);
        for (const dataKey of dataKeys) {
          if (dataKey in data && data[dataKey] !== '') {
            node[bindKey] = data[dataKey];
            break;
          }
        }
      }
    }
  }

  return element;
};

function waitForElement(selector, onElement) {
  const elements = document.querySelectorAll(selector);

  if (elements) {
    onElement(Array.prototype.slice.call(elements));
  }

  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      let nodes = Array.prototype.slice.call(mutation.addedNodes);
      let matchedNodes = [];
      for (let node of nodes) {
        if (node.matches && node.nodeType == 1 && node.matches(selector)) {
          matchedNodes.push(node);
        }
      }
      onElement(matchedNodes);
    });
  });

  observer.observe(document.documentElement, {childList: true, subtree: true});
}

waitForElement('section div[data-url]', columns => {
  const itemTemplate = document.getElementById('itemTemplate');
  for (const column of columns) {
    const feedUrl = column.dataset['url'];
    const url = `/proxy?url=${encodeURIComponent(feedUrl)}`;
    fetch(url)
        .then(feedResponse => {
          const response = feedResponse.clone();
          if ('caches' in window) {
            return caches.open('data').then(cache => {
              if (cache) {
                cache.put(url, response);
              }
              return feedResponse.text();
            });
          }
          return feedResponse.text();
        })
        .then(feedText => convertFeedItemsToJSON(feedText))
        .then(items => items.reverse())
        .then(items => items.filter(item => !document.getElementById(item.guid)))
        .then(items => items.map(item => applyTemplate(itemTemplate.cloneNode(true), item)))
        .then(items => items.forEach(item => column.insertBefore(item, column.firstChild)));
  }
});

document.addEventListener('click', e => {
  const target = e.target;
  if (target.nodeName === 'svg' && target.classList.contains('share')) {
    e.preventDefault();
    const shareUrl = target.getAttribute('url') || '';
    const shareTitle = target.getAttribute('title') || '';
    if (navigator.share) {
      navigator.share({
        url: shareUrl,
        title: shareTitle,
        text: shareTitle
      });
    } else {
      const windowOptions = 'scrollbars=yes,resizable=yes,toolbar=no,location=yes,width=520,height=420';
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;

      window.open(twitterUrl, 'intent', windowOptions);
    }
  }
});

document.addEventListener('keyup', e => {
  const columns = document.querySelectorAll('section');
  const selectedColumn = document.querySelector('section.selected');
  let newSelectedColumn;

  if (e.code == 'ArrowLeft') {
    // Move left
    if (!!selectedColumn === false) {
      newSelectedColumn = columns[columns.length - 1];
    } else {
      selectedColumn.classList.remove('selected');
      if (selectedColumn.previousElementSibling) {
        newSelectedColumn = selectedColumn.previousElementSibling;
      } else {
        newSelectedColumn = columns[columns.length - 1];
      }
    }
  } else if (e.code == 'ArrowRight') {
    // Move right
    if (!!selectedColumn === false) {
      newSelectedColumn = columns[0];
    } else {
      selectedColumn.classList.remove('selected');
      if (selectedColumn.nextElementSibling) {
        newSelectedColumn = selectedColumn.nextElementSibling;
      } else {
        newSelectedColumn = columns[0];
      }
    }
  }
  if (newSelectedColumn) {
    newSelectedColumn.classList.add('selected');
    newSelectedColumn.scrollIntoView({'behaviour': 'smooth'});
  }
});
})();
