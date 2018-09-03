/*
	Demonstrates RPC commands (test, hello) over node's child_processes.
	1 Parent with 2 children processes communicate over RPC.
*/
const { fork } = require('child_process');
const octopus = require('../octopus.js');
const child1 = fork('child1.js');
const child2 = fork('child2.js');


/* 	STEP 1 - Create local bi-directional rpc endpoint under specified namespace
	the namespace can be updated later, from either side of the connection.
	This can be used to dynamically route rpc calls, based on property values, included as part of the namespace.
*/
var rpc = octopus('local:parent:parent1');



/*	STEP 2 - Set up instances for each required command.	*/
var test = rpc.command('test');
var hello = rpc.command('hello');


/*	STEP 3 - Add providers to whichever command is serviced on this node */
test.provide(function (data, prev, transportName) {
	return 'Parent-tested';
});

hello.provide(function (data, prev, transportName) {
	return 'Parent :- Hey there ! ' + data.from;
});


/*	STEP 4 - Add transports & Call the rpc commands.

	Tranports must be a single direct p2p link (for eg :- a single server-client socket connection)
	of a supported transport type like websockets, socket.io, node child processes etc.

	On adding, a promise is returned, which resolves when connections in both the directions have initialised.
	Any RPC calls should happen after transports have initiliased, to include them within this call.
*/

var tasks = [];
tasks.push(rpc.over(child1, 'processRemote'));
tasks.push(rpc.over(child2, 'processRemote'));

console.log('\n\n-----[index] Calling RPC test local:child:*" before setup--------\n\n');
hello.call('local:child:*', { from: 'Parent' })
	.then((resp) => {
		console.log('\n\nGot raw "local:child:*" response as :\n', resp);
		console.log('\nparseStatuses() - ', JSON.stringify(rpc.parseStatuses(resp), null, 2));
		console.log('\nparseResponses() - ', JSON.stringify(rpc.parseResponses(resp), null, 2));
		console.log('\nparseResponseData() - ', JSON.stringify(rpc.parseResponseData(resp), null, 2));
		console.log('\nparseData() - ', JSON.stringify(rpc.parseData(resp), null, 2));
		console.log('\n------------------\n\n');
	})
	.catch((e) => {
		console.log('Got raw error as :\n', e);
		console.log('\nparseStatuses() - ', JSON.stringify(rpc.parseStatuses(e), null, 2));
		console.log('\nparseResponses() - ', JSON.stringify(rpc.parseResponses(e), null, 2));
		console.log('\nparseResponseData() - ', JSON.stringify(rpc.parseResponseData(e), null, 2));
		console.log('\nparseData() - ', JSON.stringify(rpc.parseData(e), null, 2));
		console.log('\n------------------\n\n');
	});

Promise.all(tasks)
	.then(() => {
		console.log('\n\n-----[index] Calling RPC "test local:child:*" after setup--------\n\n');
		test.call('local:child:*')
			.then((resp) => {
				console.log('\n\nGot "test child:*" raw response as :\n', resp);
				console.log('\nparseStatuses() - ', JSON.stringify(rpc.parseStatuses(resp), null, 2));
				console.log('\nparseResponses() - ', JSON.stringify(rpc.parseResponses(resp), null, 2));
				console.log('\nparseResponseData() - ', JSON.stringify(rpc.parseResponseData(resp), null, 2));
				console.log('\nparseData() - ', JSON.stringify(rpc.parseData(resp), null, 2));
				console.log('\n------------------\n\n');
			})
			.catch((e) => {
				console.log('Got raw error as :\n', e);
				console.log('\nparseStatuses() - ', JSON.stringify(rpc.parseStatuses(e), null, 2));
				console.log('\nparseResponses() - ', JSON.stringify(rpc.parseResponses(e), null, 2));
				console.log('\nparseResponseData() - ', JSON.stringify(rpc.parseResponseData(e), null, 2));
				console.log('\nparseData() - ', JSON.stringify(rpc.parseData(e), null, 2));
				console.log('\n------------------\n\n');
			})

			.then(() => console.log('\n\n-----[index] Calling RPC "hello local:child:child1" after setup--------\n\n'))
			.then(() => hello.call('local:child:child1', { from: 'Parent' }))
			.then((resp) => {
				console.log('\n\nGot "hello child:child1" response as :\n');
				console.log(JSON.stringify(rpc.parseResponses(resp), null, 2));
			})
			.catch((e) => console.log('Got "hello child:child1" error as =', e))

			.then(() => console.log('\n\n-----[index] Calling RPC "hello local:child:child2" after setup--------\n\n'))
			.then(() => hello.call('local:child:child2', { from: 'Parent' }))
			.then((resp) => {
				console.log('\n\nGot "hello child:child2" response as :\n');
				console.log(JSON.stringify(rpc.parseResponses(resp), null, 2));
			})
			.catch((e) => console.log('Got "hello child:child2" error as =', e));

		// TODO - rename doesn't work properly.
		rpc.renameTo('local:parent:parent2');
		setTimeout(() => rpc.displayTransports(), 1000);
	});
