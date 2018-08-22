![octopus image][logo]

[logo]:https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Phantom_Open_Emoji_1f419.svg/240px-Phantom_Open_Emoji_1f419.svg.png

# Octopus RPC
Super easy bi-directional RPCs, for Node JS & the browser, that just work !
1. Handles an arbitrary mix of transports, including <b>socket.io, Node forked (child) processes, websockets</b>.
2. Pluggable architecture, so you can easily add your own custom transports.
3. RPC Calls are **namespaced** [debug](https://github.com/visionmedia/debug) style ! ( ie <b><i>local:child:*</i></b> )
4. Namespaces can be set dynamically from either end of the connection (calling or providing), at any time.

# In use @ :
[St8Flo](http://www.st8flo.com)

# Install
Use below commmand for Node. Browserify can be used to bundle for the browser.
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
const octopus = require('octopus-rpc');
var rpc = octopus('local:parent:parent1');
```



#### 2. Add RPC commands & providers.
Providers are optional.
<br>They are automatically set up across all transports, previously added to the RPC instance.
```javascript
var hello = rpc.command('hello');
hello.provide((data, prev, transportName)=> {
  // some action here
 });
```

#### 3. Add transports & call RPCs with 'debug' like namespace filters !<br>
Transports are a standard, direct connection (socket), between 2 participating entities. (for eg: client to server socket).
Currently supported transports are <b>socket.io, node forked (child) processes, websockets</b>.
<br><br>Octopus expects a ready socket connection and does not handle connection/reconnections. That is left to the user to implement.
```javascript
const { fork } = require('child_process');
const child1 = fork('child1.js');
const child2 = fork('child2.js');

var tasks = [];
tasks.push(rpc.over(child1, 'processRemote'));
tasks.push(rpc.over(child2, 'processRemote'));
Promise.all(tasks)
.then(()=>{
	hello.call('local:*', 'aloha')
	  .then((res)=>console.log(res));
});
```
Transport type | String identifier
--- | ---
child process | 'processRemote'
Socket.io | 'socketio'
Websocket | 'websocket'



# Full example
Copied from the demo folder

#### index.js
```javascript

const { fork } = require('child_process');
const octopus = require('octopus-rpc');
const child1 = fork('child1.js');
const child2 = fork('child2.js');

var rpc = octopus('local:parent:parent1');

var hello = rpc.command('hello');

hello.provide(function (data, prev, transportName) {
	return 'Parent :- Hey there ! ' + data.from;
});

var tasks = [];
tasks.push(rpc.over(child1, 'processRemote'));
tasks.push(rpc.over(child2, 'processRemote'));

Promise.all(tasks)
.then(()=>{

	hello.call('local:child:child1',{from:'Parent'})
		.then((resp) => console.log('\n\nGot "hello child:child1" response as :\n',JSON.stringify(rpc.parseResponses(resp),null,2)))
		.catch((e) => console.log('Got error as =', e));

	hello.call('local:child:child2',{from:'Parent'})
		.then((resp) => console.log('\n\nGot "hello child:child2" response as :\n',JSON.stringify(rpc.parseResponses(resp),null,2)))
		.catch((e) => console.log('Got error as =', e));

});

```
#### child1.js
```javascript
const octopus = require('octopus-rpc');
var rpc = octopus('local:child:child1');

rpc.over(process, 'processRemote');
var hello = rpc.command('hello');

hello.provide(function (data, prev, transportName) {
	return 'child1 :- Hey there ! ' + data.from;
});
```
#### child2.js
```javascript
const octopus = require('octopus-rpc');
var rpc = octopus('local:child:child2');

rpc.over(process, 'processRemote');
var hello = rpc.command('hello');

hello.provide(function (data, prev, transportName) {
	return 'child2 :- Hey there ! ' + data.from;
});
```
