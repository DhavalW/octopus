(function () {

	var rpcTransport = function (type, socket, endpoint) {
		// console.log('Creating rpc transport [%s] for endpoint [%s][%s]',type, endpoint.label, endpoint.dir);

		var _self = this;
		_self.endpoint = endpoint;
		_self.type = type;
		_self.socket = socket;
		_self.tName = 'nonname';
		_self.initialised = false;
		_self.nameClock = 0;
		_self.dirFlip = {
			i: 'o',
			o: 'i'
		};

		// Add trasport type specific methods to self
		Object.assign(_self, _self.endpoint.transportTypes[type](type, socket));

		_self.initPromise = new Promise((res,rej)=>{
			_self.onRecv((data) => {
				// console.log('[onRecv] Data recvd on [%s][%s]',_self.tName,_self.endpoint.dir, data);
				if (data.rpc_dir == _self.dirFlip[_self.endpoint.dir]) {
					// console.log('[onRecv] Data accepted on [%s][%s]',_self.tName,_self.endpoint.dir, data);

					if (data.rpc_tName_change) {
						/*
							NOTE - Implementing "Latest & last write wins" consensus policy :
								WHY ? - Required to solve disputes when both(or more) endpoints request a name change at the same time.
								Without this, a simultaneous request causes each one to sends his name change over while implementing the other's name change request.
								 	consequence - a name swap, instead of consensus on a single name value.
						*/
						if (data.rpc_tName_change.force || data.rpc_tName_change.clock >= _self.nameClock) {
							console.log('[%s, clock %s] [%s] Changing name of transport [%s] to [%s] at clock =', _self.endpoint.label, _self.nameClock, data.rpc_tName_change.force ? 'forced' : '', _self.tName, data.rpc_tName_change.tName, data.rpc_tName_change.clock);
							delete _self.endpoint.transports[_self.tName];
							_self.tName = data.rpc_tName_change.tName;
							_self.nameClock = data.rpc_tName_change.clock;
							_self.endpoint.transports[_self.tName] = _self;
							if(!_self.initialised) {
								_self.initialised = true;
								res();
							}
						} else {
							console.log('[%s, clock %s] [%s] Rejecting name change of transport [%s] as [%s] at clock =',_self.endpoint.label,_self.nameClock,data.rpc_tName_change.force?'forced':'', _self.tName,data.rpc_tName_change.tName,data.rpc_tName_change.clock);
							_self.send({
								rpc_tName_change: {
									tName: _self.tName,
									clock: _self.nameClock,
									force: true
								},
								rpc_dir: _self.endpoint.dir
							});
						}
					}

					if (data.rpc_msg) {
						Object.keys(data.rpc_msg).forEach((cKey) => {
							if (_self.endpoint.commands[cKey])
								_self.endpoint.commands[cKey].recieve(data.rpc_msg[cKey], _self.tName);
						});
					}
				}
			});

			_self.as = function (tName) {
				delete _self.endpoint.transports[_self.tName];
				var prevName = _self.tName;
				_self.tName = tName;
				_self.nameClock++;
				// console.log('[%s] Sending namechange of transport [%s] to [%s] at clock =',_self.endpoint.label, prevName,tName,_self.nameClock);
				_self.send({
					rpc_tName_change: {
						tName: _self.tName,
						clock: _self.nameClock
					},
					rpc_dir: _self.endpoint.dir
				});
				_self.endpoint.transports[tName] = _self;
				if(!_self.initialised) {
					_self.initialised = true;
					res();
				}
				return _self;
			};
		});

		_self.endpoint.transports[_self.tName] = _self;
		return _self;
	};

	/* ----------------------------------------------------------- */


	module.exports = rpcTransport;

})();
