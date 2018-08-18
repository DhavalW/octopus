![octopus image][logo]

[logo]:https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Phantom_Open_Emoji_1f419.svg/240px-Phantom_Open_Emoji_1f419.svg.png

# Octopus RPC
Super easy bi-directional RPCs, for Node JS & the browser, that just work !
1. Handles an arbitrary mix of transports, including <b>socket.io, Node forked (child) processes, websockets</b>. 
2. Pluggable architecture, so you can easily add your own custom transports. 
3. RPC Calls are **namespaced** [debug](https://github.com/visionmedia/debug) style ! ( ie <b><i>local:child:*</i></b> ) 
<br> In other words, RPC calls can be triggered on selective nodes, with a simple namespace string ! 
4. Namespaces can be set dynamically from either end of the connection, at any time. <br>For eg: based on locality & dynamic properties like available memory ( cluster1:high:* cluster2:med:* cluster3:low:* ) 

# Install
```
npm install octopus-rpc --save
```

# Demo
See demo folder for an example - simple microservice style usage with node child process.

1. Clone the repo
2. Run demo/index.js using Node

# Usage
#### 1. Create a new RPC endpoint on each participating node 
Each node should add itself under a unique namespace. The namespaces are dynamic, and can be changed from either side of the rpc (ie, calling or providing )
```javascript
const octopus = require('octopus');
var rpc = new octopus('local:parent:parent1');
```


#### 2. Add transports<br>
Transports are a standard, direct connection (socket), between 2 participating entities. (for eg: client to server socket).
Currently supported transports are <b>socket.io, node forked (child) processes, websockets</b>. 
<br><br>Octopus expects a ready socket connection and does not handle connection/reconnections. That is left to the user to implement.
```javascript
const { fork } = require('child_process');
const child1 = fork('child1.js');
const child2 = fork('child2.js');

rpc.over(child1, 'processRemote');
rpc.over(child2, 'processRemote');
```


#### 3. Add commands & setup rpc providers.
Providers are optional. 
<br>They are automatically set up across all transports, previously added to the RPC instance.
```javascript
var hello = rpc.command('hello');
hello.provide((data, prev, transportName)=> {
  // some action here
 });
```


#### 4. Call the RPCs with 'debug' like namespace filters !

```javascript
hello.call('local:*', 'aloha')
  .then((res)=>console.log(res));
```
