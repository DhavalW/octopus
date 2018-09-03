const octopus = require('../octopus.js');
var rpc = octopus('local:child:child2');


var test = rpc.command('test');
var hello = rpc.command('hello');

test.provide(function (data, prev, tName) {
	return 'child2-tested';
});

// hello.provide(function (data, prev, tName) {
// 	return 'child2 :- Hey there ! ' + data.from;
// });

rpc.over(process, 'processRemote');


setTimeout(()=>rpc.displayTransports(),4500);
