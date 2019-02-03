const debug = require('debug');
const octopus = require('../octopus.js')(debug);
var rpc = octopus('child:child2');
// debug.enable('*');

var test = rpc.command('test');
var hello = rpc.command('hello');

test.provide(function (data, prev, tName) {
	return 'child2-tested';
});

hello.provide(function (data, prev, transportName) {
	return 'child1 :- Hey there ! ' + data.from;
});

hello.onProvide(function(msg){
	console.log('[Child2] Replied back to parent as ', msg);
});

rpc.command('test/tname').provide((v) => {
	console.log('Child2 recieved test/tname request with params ', v);

	return 'NA-' + v.value;
});

rpc.over(process, 'processRemote');


setTimeout(()=>rpc.displayTransports(),4500);
