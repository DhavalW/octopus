const debug = require('debug');
const octopus = require('../octopus.js')(debug);
var rpc = octopus('child:child1');
// debug.enable('*');

var test = rpc.command('test');
var hello = rpc.command('hello');

test.provide(function (data, prev, transportName) {
	return 'child1-tested';
});

hello.provide(function (data, prev, transportName) {
	return 'child1 :- Hey there ! ' + data.from;
});

hello.onProvide(function (msg) {
	console.log('[Child1] Replied back to parent as', msg);
});

rpc.command('test/tname').provide((v) => {
	console.log('Child1 recieved test/tname request with params', v);
	rpc.remove(process);
	console.log('Child1 disconnected before responding');
	setTimeout(() => {
		rpc.over(process, 'processRemote')
			.then(() => console.log('Child1 reconnected again'))
			.then(() => rpc.command('hello').call('parent:*', 'ooga'))
			.then((res) => console.log('Child1 got post-reconncetion hello response from paretn as ', res))
			.catch((e) => console.error('[Error] in reconnection chain  - ', e));
		console.log('Child1 reconnecting to parent');
	}, 1500);

	return 'OK-' + v;
});


rpc.over(process, 'processRemote');

setTimeout(() => rpc.displayTransports(), 4000);
