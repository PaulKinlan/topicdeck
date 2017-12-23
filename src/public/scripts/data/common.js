import {
  CommonDOMParser
 } from '../platform/common.js';

const findNode = (tagName, nodes) => {
  return Array.prototype.find.call(nodes, n => n.tagName == tagName);
}

const findNodes = (tagName, nodes) => {
  return Array.prototype.filter.call(nodes, n => n.tagName == tagName);
}  

const sanitize = (str) => {
  const tagsToReplace = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  };
  return str.replace(/[&<>]/g, (tag) => tagsToReplace[tag] || tag);
}

const convertFeedItemsToJSON = (feedText) => {
  if(feedText === undefined) return [];
  
  const parser = new CommonDOMParser();
  const feed = parser.parseFromString(feedText,'application/xml');
  const documentElement = feed.documentElement;
    
  if(documentElement.nodeName === 'rss') {
    const channel = findNode('channel', documentElement.childNodes);
    const items = findNodes('item', channel.childNodes);
    return items.map(item => convertRSSItemToJSON(item));
  }
  else if(documentElement.nodeName === 'feed') {
    const entrys = findNodes('entry', documentElement.childNodes);
    return entrys.map(entry => convertAtomItemToJSON(entry));
  }
  else {
    return [];
  }
}
  
const convertAtomItemToJSON = (item) => {
  const getElementText = (tagName) => {
    const elements = findNodes(tagName, item.childNodes);
    if(elements && elements.length > 0) {
      return elements[0].textContent;
    }
    
    return "";
  } 
  
  const getElementAttribute = (tagName, attribute) => {
    const elements = findNodes(tagName, item.childNodes);
    if(elements && elements.length > 0) {
      const href = elements[0].attributes.getNamedItem('href');
      return (href !== undefined) ? href.value : "";
    }
    
    return "";
  } 
  
  const title = getElementText("title");
  const description = getElementText("summary");
  const guid = getElementText("id");
  const pubDate = getElementText("updated");
  const author = getElementText("author");
  const link = getElementAttribute("link", "href");
  
  return {"title": sanitize(title), "guid": guid, "description": description, "pubDate": pubDate, "author": author, "link": link};
};
  
const convertRSSItemToJSON = (item) => {
  const getElementText = (tagName) => {
    const elements = findNodes(tagName, item.childNodes);
    if(elements && elements.length > 0) {
      return elements[0].textContent;
    }
    
    return "";
  } 
  
  const title = getElementText("title");
  const description = getElementText("description");
  const guid = getElementText("guid");
  const pubDate = getElementText("pubDate");
  const author = getElementText("author");
  const link = getElementText("link");
  
  return {"title": title, "guid": guid, "description": description, "pubDate": pubDate, "author": author, "link": link};
};

export {
  convertRSSItemToJSON,
  convertAtomItemToJSON,
  convertFeedItemsToJSON
}