(function () {

	/* ------
	
		Code below is adapted from the debug library, duly licensed as below.

		(The MIT License)

		Copyright (c) 2014 TJ Holowaychuk <tj@vision-media.ca>

		Permission is hereby granted, free of charge, to any person obtaining a copy of this software
		and associated documentation files (the 'Software'), to deal in the Software without restriction,
		including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
		and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
		subject to the following conditions:

		The above copyright notice and this permission notice shall be included in all copies or substantial
		portions of the Software.

		THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
		LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
		IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
		WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
		SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

	------ */

	var Namespace = function (namespaces) {

		this.names = [];
		this.skips = [];

		var i;
		var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
		var len = split.length;

		for (i = 0; i < len; i++) {
			if (!split[i]) continue; // ignore empty strings
			namespaces = split[i].replace(/\*/g, '.*?');
			if (namespaces[0] === '-') {
				this.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
			} else {
				this.names.push(new RegExp('^' + namespaces + '$'));
			}
		}


		return this;
	};


	Namespace.prototype.test = function (value) {
		var i, len;

		for (i = 0, len = this.skips.length; i < len; i++) {
			if (!this.skips[i].test(value))
				return false;
		}

		for (i = 0, len = this.names.length; i < len; i++) {
			if (this.names[i].test(value))
				return true;
		}

		return false;
	};



	module.exports = Namespace;

})();
