const debug = require('debug');
const octopus = require('../octopus.js')(debug);
var rpc = octopus('child:child2');


var test = rpc.command('test');
var hello = rpc.command('hello');

test.provide(function (data, prev, tName) {
	return 'child2-tested';
});

// hello.provide(function (data, prev, tName) {
// 	return 'child2 :- Hey there ! ' + data.from;
// });
//
// hello.onProvide(function(msg){
// 	console.log('[Child2] Replied back to parent as ', msg);
// });

rpc.over(process, 'processRemote');


setTimeout(()=>rpc.displayTransports(),4500);
