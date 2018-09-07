const debug = require('debug');
const octopus = require('../octopus.js')(debug);
var rpc = octopus('child:child1');

var test = rpc.command('test');
var hello = rpc.command('hello');

test.provide(function (data, prev, transportName) {
	return 'child1-tested';
});

hello.provide(function (data, prev, transportName) {
	return 'child1 :- Hey there ! ' + data.from;
});

hello.onProvide(function(msg){
	console.log('[Child1] Replied back to parent as', msg);
});


rpc.over(process, 'processRemote');

setTimeout(()=>rpc.displayTransports(),4000);
