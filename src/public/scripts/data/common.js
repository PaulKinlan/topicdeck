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

const findElementText = (item, tagName) => {
  const elements = findNodes(tagName, item.childNodes);
  if(elements && elements.length > 0) {
    return elements[0].textContent;
  }
  
  return "";
}

const findElementAttribute = (item, tagName, attribute) => {
  const elements = findNodes(tagName, item.childNodes);
  if(elements && elements.length > 0) {
    const attr = elements[0].attributes.getNamedItem(attribute);
    return (attr !== undefined) ? attr.value : "";
  }
  
  return "";
}

const getElementsWithAttribute = (tagName, attribute) => {
  const elements = findNodes(tagName, item.childNodes);
  return elements.filter(element => element.attributes.getNamedItem(attribute) !== undefined);
};

const attributeEquals = (attribute, value) => {
  return (element) => { 
    const attr = element.attributes.getNamedItem(attribute);
    return (attr && attr.value === value);
  };
};

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
  const title = findElementText(item, "title");
  const description = findElementText(item, "summary");
  const guid = findElementText(item, "id");
  const pubDate = findElementText(item, "updated");
  const author = findElementText(item, "author");
  const link = findElementAttribute(item, "link", "href");
  
  return {"title": sanitize(title), "guid": guid, "description": description, "pubDate": pubDate, "author": author, "link": link};
};
  
const convertRSSItemToJSON = (item) => {
  const title = findElementText(item, "title");
  const description = findElementText(item, "description");
  const guid = findElementText(item, "guid");
  const pubDate = findElementText(item, "pubDate");
  const author = findElementText(item, "author");
  const link = findElementText(item, "link");
  const enclosureElement = findNodes("enclosure", item.childNodes).filter(attributeEquals("type", "audio/mpeg"))[0];
  
  return {"title": title, "guid": guid, "description": description, "pubDate": pubDate, "author": author, "link": link};
};

export {
  convertFeedItemsToJSON
}