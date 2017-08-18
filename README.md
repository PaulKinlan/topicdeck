Web Dev Deck 💯
=========================

Inspired by River of news, but HTTPs only and a PWA.

Attempt to create a PWA that is a news reader that renders on the server and on the client using all the same templating and logic. 


Progress
--------

* Client logic in SW is now shared with the Server logic [done]
* Templating is done via streaming templates [done]
* Use WhatWG streams in node. [done]
* Need to clean up a lot. [errrr.....]
* Configuration file should really be an OPML file. [todo]
* Cache fetched data on the client and server [done]
* To render the client it still needs JS turned on. Investigate server 
  load of RSS feeds.
  * This is done in the SW, will use on Server soon.


Thoughts
--------

If possible the server logic and the client logic should be near exactly the same.

Ideally configured via a OPML file that defines the columns, that links to other OPML files that contain the feeds that should be aggregrated in this.

Thoughts: 

* The UI should render the structure without JS. Ideally after this has been
  rendered, I can stream in the first batch of aggreagated and merged feeds.  
* The UI should then take over and update the feeds in the client as much as 
  possible.
* On reload, the server should not be hit at all, save for any updates to the
  OPML file. In an ideal world, the SW would be doing the work.
  
  
Technical hitches:
  We are going to have to proxy the RSS feed requests.