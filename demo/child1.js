const octopus = require('../octopus.js');
var rpc = octopus('local:child:child1');

rpc.over(process, 'processRemote');

var test = rpc.command('test');
var hello = rpc.command('hello');

test.provide(function (data, prev, transportName) {
	return 'child1-tested';
});

hello.provide(function (data, prev, transportName) {
	return 'child1 :- Hey there ! ' + data.from;
});

setTimeout(()=>rpc.displayTransports(),4000);
