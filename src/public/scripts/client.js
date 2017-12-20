import { convertFeedItemsToJSON } from './data/common.js';

(function() { 
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(function(registration) {
        // Registration was successful
        console.log('ServiceWorker registration successful with scope: ', registration.scope)
      }, function(err) {
        // registration failed :(
        console.log('ServiceWorker registration failed: ', err)
      })
    })
  }

  if('BroadcastChannel' in window) {
    const installBroadcastChannel = new BroadcastChannel('install-cache-channel');
    installBroadcastChannel.onmessage = (ev) => { console.log(ev) };
  }

  const applyTemplate = (templateElement, data) => {
    const element = templateElement.content.cloneNode(true);    
    const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, () => NodeFilter.FILTER_ACCEPT);

    while(treeWalker.nextNode()) {
      const node = treeWalker.currentNode;
      for(let bindAttr in node.dataset) {
        let isBindableAttr = (bindAttr.indexOf('bind_') == 0) ? true : false;
        if(isBindableAttr) {
          let dataKey = node.dataset[bindAttr];
          let bindKey = bindAttr.substr(5);
          node[bindKey] = data[dataKey];
        }
      }
    }

    return element;
  };
      
  window.addEventListener('DOMContentLoaded', e => {
    const columns = document.querySelectorAll('section div[data-url]');
    const itemTemplate = document.getElementById('itemTemplate')
    for(let column of columns) {
      const feedUrl = column.dataset['url'];
      fetch(`/proxy?url=${feedUrl}`)
        .then(feedResponse => feedResponse.text())
        .then(feedText => convertFeedItemsToJSON(feedText))
        .then(items => items.reverse())
        .then(items => items.filter(item => !!!(document.getElementById(item.guid))))
        .then(items => items.map(item => applyTemplate(itemTemplate.cloneNode(true), item)))
        .then(items => items.forEach(item => column.insertBefore(item, column.firstChild)));
    }
  });
    
  document.addEventListener('click', e => {
    const target = e.target;
    if(target.nodeName === 'svg' && target.classList.contains('share')) {
      e.preventDefault();
      const shareUrl = target.getAttribute("url") || "";
      const shareTitle = target.getAttribute("title") || "";
      if(!!navigator.share) {
        navigator.share({
          url: shareUrl,
          title: shareTitle,
          text: shareTitle
        })
      }
    }
  });

  document.addEventListener('keyup', e => {
    const columns = document.querySelectorAll('section');
    const selectedColumn = document.querySelector('section.selected');
    let newSelectedColumn;
    
    if(e.code == 'ArrowLeft') {
      //Move left
      if(!!selectedColumn === false) {
        newSelectedColumn = columns[columns.length - 1];
      }
      else {
        selectedColumn.classList.remove('selected');
        if(!!selectedColumn.previousElementSibling) {
          newSelectedColumn = selectedColumn.previousElementSibling;
        }
        else {
          newSelectedColumn = columns[columns.length - 1];
        }
      }
    }
    else if(e.code == 'ArrowRight') {
      //Move right
      if(!!selectedColumn === false) {
        newSelectedColumn = columns[0];
      }
      else {
        selectedColumn.classList.remove('selected');
        if(!!selectedColumn.nextElementSibling) {
          newSelectedColumn = selectedColumn.nextElementSibling;
        }
        else {
          newSelectedColumn = columns[0];

        }
      }
    }
    if(!!newSelectedColumn) {
      newSelectedColumn.classList.add('selected');
      newSelectedColumn.scrollIntoView({ "behaviour": "smooth" });
    }
  });
})();