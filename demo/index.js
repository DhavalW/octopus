/*
	Demonstrates RPC commands (test, hello) over node's child_processes.
	1 Parent with 2 children processes communicate over RPC.
*/
const { fork } = require('child_process');
const debug = require('debug');
// debug.enable('logs:octopus:parent:*, warnings:octopus:parent:*, errors:octopus:parent:*');
// debug.enable('*');
const octopus = require('../octopus.js')(debug);
const child1 = fork('child1.js');
const child2 = fork('child2.js');


/* 	STEP 1 - Create local bi-directional rpc endpoint under specified namespace
	the namespace can be updated later, from either side of the connection.
	This can be used to dynamically route rpc calls, based on property values, included as part of the namespace.
*/
var rpc = octopus('parent:parent1');



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

rpc.command('test/tname').provide(() => {
	rpc.remove(child1);
	rpc.remove(child2);
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

console.log('\n\n-----[index] Calling RPC test child:*" before setup--------\n\n');
hello.call('child:*', { from: 'Parent' })
	.then((resp) => {
		console.log('\n\nGot raw "child:*" response as :\n', resp);
		console.log(JSON.stringify(rpc.parseByStatus(resp), null, 2));
		console.log('\n------------------\n\n');
	});

var i = 0;
Promise.all(tasks)
	.then(() => {
		console.log('\n\n-----[index] Calling RPC "test child:*" after setup--------\n\n');
		return Promise.resolve()
			.then(() => test.call('child:*'))
			.then((resp) => {
				console.log('\n\nGot "test child:*" raw response as :\n', resp);
				console.log('\nParsed as :\n');
				console.log(JSON.stringify(rpc.parseByStatus(resp), null, 2));
				console.log('\n------------------\n\n');
			})

			.then(() => console.log('\n\n-----[index] Calling RPC "hello child:child1" after setup--------\n\n'))
			.then(() => hello.call('child:child1', { from: 'Parent' }))
			.then((resp) => {
				console.log('\n\nGot "hello child:child1" response as :\n');
				console.log(JSON.stringify(resp, null, 2));
				console.log('\nParsed as :\n');
				console.log(JSON.stringify(rpc.parseByStatus(resp), null, 2));
			})

			.then(() => console.log('\n\n-----[index] Calling RPC "hello child:child2" after setup--------\n\n'))
			.then(() => hello.call('child:child2', { from: 'Parent' }))
			.then((resp) => {
				console.log('\n\nGot "hello child:child2" response as :\n');
				console.log(JSON.stringify(resp, null, 2));
				console.log('\nParsed as :\n');
				console.log(JSON.stringify(rpc.parseByStatus(resp), null, 2));
			})

			.then(() => console.log('\n\n-----[index] Calling RPC "hello child:*" after setup--------\n\n'))
			.then(() => hello.call('child:*', () => 'count is - ' + i++))
			.then((resp) => {
				console.log('\n\nGot "hello child:*" response as :\n');
				console.log(JSON.stringify(resp, null, 2));
				console.log('\nParsed as :\n');
				console.log(JSON.stringify(rpc.parseByStatus(resp), null, 2));
			})

			.then(() => console.log('\n\n-----[index] Running test/tname --------\n\n'))
			.then(() => rpc.command('test/tname').call('child:*', { value: 'hello' }))
			.then((res) => console.log('\n\ntname test response = ', res))
			.then(() => console.log('\n\ntname test complete'))
			.then(() => setTimeout(() => rpc.displayTransports(), 1000))


			.catch((e) => console.log('Unexpected error - ', e));

		// TODO - rename doesn't work properly yet.
		// rpc.renameTo('local:parent:parent2');

	});
