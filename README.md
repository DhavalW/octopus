# Octopus RPC
Super easy bi-directional RPCs, for Node JS & the browser, that just work !<br>
Can be configured to handle an arbitrary mix of transports, including <b>socket.io, Node forked (child) processes, websockets</b>. 

RPC Calls are namespaced ! (ie <b><i>local:child:*</i></b> ) 
<br>& namespaces can be updated dynamically from either end of the transport. 

In other words, RPC calls can be triggered only on select nodes, using debug style filters ! 

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
#### 2. Add tranports<br>
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
providers are optional and are set across all transports added to a given RPC instance.
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
