/*
	Demonstrates RPC commands (test, hello) over node's child_processes.
	1 Parent with 2 children processes communicate over RPC.
*/
const { fork } = require('child_process');
const rpcBi = require('../rpc.js');
const child1 = fork('child1.js');
const child2 = fork('child2.js');


/* 	STEP 1 - Create local bi-directional rpc endpoint under specified namespace
	the namespace can be updated later, from either side of the connection.
	This can be used to dynamically route rpc calls, based on property values, included as part of the namespace.
*/
var rpc = new rpcBi('local:parent:parent1');


/*	STEP 2 - Add transports.
	Tranports must be a single direct p2p link (for eg :- a single server-client socket connection)
	of a supported transport type like websockets, socket.io, node child processes etc.
*/
rpc.over(child1, 'processRemote');
rpc.over(child2, 'processRemote');


/*	STEP 3 - Set up instances for each required command.	*/
var test = rpc.command('test');
var hello = rpc.command('hello');


/*	STEP 4 - Add providers to whichever command is serviced on this node */
test.provide(function (data, prev, transportName) {
	return 'Parent-tested';
});

hello.provide(function (data, prev, transportName) {
	return 'Parent :- Hey there ! ' + data.from;
});

/*	STEP 5 - Call the rpc commands.
	Remote rpc providers will execute, depending on the nodes filtered by the specified namespace string.

	Timeout is provided to allow transports to synronize initially, before this rpc call,
	otherwise, the filters might not pickup on yet-to-initalise transports on this call.
*/
setTimeout(()=>{

	test.call('local:child:*')
		.then((resp) => {
			console.log('\n\nGot "test child:*" response as :\n');
			console.log(JSON.stringify(rpc.parseResponses(resp),null,2));
		})
		.catch((e) => console.log('Got error as =', e));

	hello.call('local:child:child1',{from:'Parent'})
		.then((resp) => {
			console.log('\n\nGot "hello child:child1" response as :\n');
			console.log(JSON.stringify(rpc.parseResponses(resp),null,2));
		})
		.catch((e) => console.log('Got error as =', e));

	hello.call('local:child:child2',{from:'Parent'})
		.then((resp) => {
			console.log('\n\nGot "hello child:child2" response as :\n');
			console.log(JSON.stringify(rpc.parseResponses(resp),null,2));
		})
		.catch((e) => console.log('Got error as =', e));

	// TODO - rename doesn't work properly.
	rpc.renameTo('local:parent:parent2');
	setTimeout(()=>rpc.displayTransports(),1000);
},1000);
