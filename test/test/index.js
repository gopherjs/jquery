"use strict";
(function() {

Error.stackTraceLimit = -1;

var go$global;
if (typeof window !== "undefined") {
	go$global = window;
} else if (typeof GLOBAL !== "undefined") {
	go$global = GLOBAL;
	go$global.require = require;
}

var go$idCounter = 0;
var go$keys = function(m) { return m ? Object.keys(m) : []; };
var go$min = Math.min;
var go$parseInt = parseInt;
var go$parseFloat = function(f) {
	if (f.constructor === Number) {
		return f;
	}
	return parseFloat(f);
};
var go$mod = function(x, y) { return x % y; };
var go$toString = String;
var go$reflect, go$newStringPtr;
var Go$Array = Array;

var go$floatKey = function(f) {
	if (f !== f) {
		go$idCounter++;
		return "NaN$" + go$idCounter;
	}
	return String(f);
};

var go$mapArray = function(array, f) {
	var newArray = new array.constructor(array.length), i;
	for (i = 0; i < array.length; i++) {
		newArray[i] = f(array[i]);
	}
	return newArray;
};

var go$newType = function(size, kind, string, name, pkgPath, constructor) {
	var typ;
	switch(kind) {
	case "Bool":
	case "Int":
	case "Int8":
	case "Int16":
	case "Int32":
	case "Uint":
	case "Uint8" :
	case "Uint16":
	case "Uint32":
	case "Uintptr":
	case "String":
	case "UnsafePointer":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + this.go$val; };
		break;

	case "Float32":
	case "Float64":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + go$floatKey(this.go$val); };
		break;

	case "Int64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Uint64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >>> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Complex64":
	case "Complex128":
		typ = function(real, imag) {
			this.real = real;
			this.imag = imag;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.real + "$" + this.imag; };
		break;

	case "Array":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", function(array) {
			this.go$get = function() { return array; };
			this.go$val = array;
		});
		typ.init = function(elem, len) {
			typ.elem = elem;
			typ.len = len;
			typ.prototype.go$key = function() {
				return string + "$" + Array.prototype.join.call(go$mapArray(this.go$val, function(e) {
					var key = e.go$key ? e.go$key() : String(e);
					return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}), "$");
			};
			typ.extendReflectType = function(rt) {
				rt.arrayType = new go$reflect.arrayType.Ptr(rt, elem.reflectType(), undefined, len);
			};
			typ.Ptr.init(typ);
		};
		break;

	case "Chan":
		typ = function() { this.go$val = this; };
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				go$idCounter++;
				this.go$id = go$idCounter;
			}
			return String(this.go$id);
		};
		typ.init = function(elem, sendOnly, recvOnly) {
			typ.nil = new typ();
			typ.extendReflectType = function(rt) {
				rt.chanType = new go$reflect.chanType.Ptr(rt, elem.reflectType(), sendOnly ? go$reflect.SendDir : (recvOnly ? go$reflect.RecvDir : go$reflect.BothDir));
			};
		};
		break;

	case "Func":
		typ = function(v) { this.go$val = v; };
		typ.init = function(params, results, variadic) {
			typ.params = params;
			typ.results = results;
			typ.variadic = variadic;
			typ.extendReflectType = function(rt) {
				var typeSlice = (go$sliceType(go$ptrType(go$reflect.rtype.Ptr)));
				rt.funcType = new go$reflect.funcType.Ptr(rt, variadic, new typeSlice(go$mapArray(params, function(p) { return p.reflectType(); })), new typeSlice(go$mapArray(results, function(p) { return p.reflectType(); })));
			};
		};
		break;

	case "Interface":
		typ = { implementedBy: [] };
		typ.init = function(methods) {
			typ.extendReflectType = function(rt) {
				var imethods = go$mapArray(methods, function(m) {
					return new go$reflect.imethod.Ptr(go$newStringPtr(m[0]), go$newStringPtr(m[1]), m[2].reflectType());
				});
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.imethod.Ptr)));
				rt.interfaceType = new go$reflect.interfaceType.Ptr(rt, new methodSlice(imethods));
			};
		};
		break;

	case "Map":
		typ = function(v) { this.go$val = v; };
		typ.init = function(key, elem) {
			typ.key = key;
			typ.elem = elem;
			typ.extendReflectType = function(rt) {
				rt.mapType = new go$reflect.mapType.Ptr(rt, key.reflectType(), elem.reflectType(), undefined, undefined);
			};
		};
		break;

	case "Ptr":
		typ = constructor || function(getter, setter) {
			this.go$get = getter;
			this.go$set = setter;
			this.go$val = this;
		};
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				go$idCounter++;
				this.go$id = go$idCounter;
			}
			return String(this.go$id);
		};
		typ.init = function(elem) {
			typ.nil = new typ(go$throwNilPointerError, go$throwNilPointerError);
			typ.extendReflectType = function(rt) {
				rt.ptrType = new go$reflect.ptrType.Ptr(rt, elem.reflectType());
			};
		};
		break;

	case "Slice":
		var nativeArray;
		typ = function(array) {
			if (array.constructor !== nativeArray) {
				array = new nativeArray(array);
			}
			this.array = array;
			this.offset = 0;
			this.length = array.length;
			this.capacity = array.length;
			this.go$val = this;
		};
		typ.make = function(length, capacity, zero) {
			capacity = capacity || length;
			var array = new nativeArray(capacity), i;
			for (i = 0; i < capacity; i++) {
				array[i] = zero();
			}
			var slice = new typ(array);
			slice.length = length;
			return slice;
		};
		typ.init = function(elem) {
			typ.elem = elem;
			nativeArray = go$nativeArray(elem.kind);
			typ.nil = new typ([]);
			typ.extendReflectType = function(rt) {
				rt.sliceType = new go$reflect.sliceType.Ptr(rt, elem.reflectType());
			};
		};
		break;

	case "Struct":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", constructor);
		typ.Ptr.Struct = typ;
		typ.init = function(fields) {
			var i;
			typ.fields = fields;
			typ.Ptr.init(typ);
			// nil value
			typ.Ptr.nil = new constructor();
			for (i = 0; i < fields.length; i++) {
				var field = fields[i];
				Object.defineProperty(typ.Ptr.nil, field[1], { get: go$throwNilPointerError, set: go$throwNilPointerError });
			}
			// methods for embedded fields
			for (i = 0; i < typ.methods.length; i++) {
				var method = typ.methods[i];
				if (method[6] != -1) {
					(function(field, methodName) {
						typ.prototype[methodName] = function() {
							var v = this.go$val[field[0]];
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[6]], method[0]);
				}
			}
			for (i = 0; i < typ.Ptr.methods.length; i++) {
				var method = typ.Ptr.methods[i];
				if (method[6] != -1) {
					(function(field, methodName) {
						typ.Ptr.prototype[methodName] = function() {
							var v = this[field[0]];
							if (v.go$val === undefined) {
								v = new field[3](v);
							}
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[6]], method[0]);
				}
			}
			// map key
			typ.prototype.go$key = function() {
				var keys = new Array(fields.length);
				for (i = 0; i < fields.length; i++) {
					var v = this.go$val[fields[i][0]];
					var key = v.go$key ? v.go$key() : String(v);
					keys[i] = key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}
				return string + "$" + keys.join("$");
			};
			// reflect type
			typ.extendReflectType = function(rt) {
				var reflectFields = new Array(fields.length), i;
				for (i = 0; i < fields.length; i++) {
					var field = fields[i];
					reflectFields[i] = new go$reflect.structField.Ptr(go$newStringPtr(field[1]), go$newStringPtr(field[2]), field[3].reflectType(), go$newStringPtr(field[4]), i);
				}
				rt.structType = new go$reflect.structType.Ptr(rt, new (go$sliceType(go$reflect.structField.Ptr))(reflectFields));
			};
		};
		break;

	default:
		throw go$panic(new Go$String("invalid kind: " + kind));
	}

	typ.kind = kind;
	typ.string = string;
	typ.typeName = name;
	typ.pkgPath = pkgPath;
	typ.methods = [];
	var rt = null;
	typ.reflectType = function() {
		if (rt === null) {
			rt = new go$reflect.rtype.Ptr(size, 0, 0, 0, 0, go$reflect.kinds[kind], undefined, undefined, go$newStringPtr(string), undefined, undefined);
			rt.jsType = typ;

			var methods = [];
			if (typ.methods !== undefined) {
				var i;
				for (i = 0; i < typ.methods.length; i++) {
					var m = typ.methods[i];
					methods.push(new go$reflect.method.Ptr(go$newStringPtr(m[1]), go$newStringPtr(m[2]), go$funcType(m[3], m[4], m[5]).reflectType(), go$funcType([typ].concat(m[3]), m[4], m[5]).reflectType(), undefined, undefined));
				}
			}
			if (name !== "" || methods.length !== 0) {
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.method.Ptr)));
				rt.uncommonType = new go$reflect.uncommonType.Ptr(go$newStringPtr(name), go$newStringPtr(pkgPath), new methodSlice(methods));
				rt.uncommonType.jsType = typ;
			}

			if (typ.extendReflectType !== undefined) {
				typ.extendReflectType(rt);
			}
		}
		return rt;
	};
	return typ;
};

var Go$Bool          = go$newType( 1, "Bool",          "bool",           "bool",       "", null);
var Go$Int           = go$newType( 4, "Int",           "int",            "int",        "", null);
var Go$Int8          = go$newType( 1, "Int8",          "int8",           "int8",       "", null);
var Go$Int16         = go$newType( 2, "Int16",         "int16",          "int16",      "", null);
var Go$Int32         = go$newType( 4, "Int32",         "int32",          "int32",      "", null);
var Go$Int64         = go$newType( 8, "Int64",         "int64",          "int64",      "", null);
var Go$Uint          = go$newType( 4, "Uint",          "uint",           "uint",       "", null);
var Go$Uint8         = go$newType( 1, "Uint8",         "uint8",          "uint8",      "", null);
var Go$Uint16        = go$newType( 2, "Uint16",        "uint16",         "uint16",     "", null);
var Go$Uint32        = go$newType( 4, "Uint32",        "uint32",         "uint32",     "", null);
var Go$Uint64        = go$newType( 8, "Uint64",        "uint64",         "uint64",     "", null);
var Go$Uintptr       = go$newType( 4, "Uintptr",       "uintptr",        "uintptr",    "", null);
var Go$Float32       = go$newType( 4, "Float32",       "float32",        "float32",    "", null);
var Go$Float64       = go$newType( 8, "Float64",       "float64",        "float64",    "", null);
var Go$Complex64     = go$newType( 8, "Complex64",     "complex64",      "complex64",  "", null);
var Go$Complex128    = go$newType(16, "Complex128",    "complex128",     "complex128", "", null);
var Go$String        = go$newType( 8, "String",        "string",         "string",     "", null);
var Go$UnsafePointer = go$newType( 4, "UnsafePointer", "unsafe.Pointer", "Pointer",    "", null);

var go$nativeArray = function(elemKind) {
	return ({ Int: Int32Array, Int8: Int8Array, Int16: Int16Array, Int32: Int32Array, Uint: Uint32Array, Uint8: Uint8Array, Uint16: Uint16Array, Uint32: Uint32Array, Uintptr: Uint32Array, Float32: Float32Array, Float64: Float64Array })[elemKind] || Array;
};
var go$toNativeArray = function(elemKind, array) {
	var nativeArray = go$nativeArray(elemKind);
	if (nativeArray === Array) {
		return array;
	}
	return new nativeArray(array);
};
var go$makeNativeArray = function(elemKind, length, zero) {
	var array = new (go$nativeArray(elemKind))(length), i;
	for (i = 0; i < length; i++) {
		array[i] = zero();
	}
	return array;
};
var go$arrayTypes = {};
var go$arrayType = function(elem, len) {
	var string = "[" + len + "]" + elem.string;
	var typ = go$arrayTypes[string];
	if (typ === undefined) {
		typ = go$newType(12, "Array", string, "", "", null);
		typ.init(elem, len);
		go$arrayTypes[string] = typ;
	}
	return typ;
};

var go$chanType = function(elem, sendOnly, recvOnly) {
	var string = (recvOnly ? "<-" : "") + "chan" + (sendOnly ? "<- " : " ") + elem.string;
	var field = sendOnly ? "SendChan" : (recvOnly ? "RecvChan" : "Chan");
	var typ = elem[field];
	if (typ === undefined) {
		typ = go$newType(4, "Chan", string, "", "", null);
		typ.init(elem, sendOnly, recvOnly);
		elem[field] = typ;
	}
	return typ;
};

var go$funcTypes = {};
var go$funcType = function(params, results, variadic) {
	var paramTypes = go$mapArray(params, function(p) { return p.string; });
	if (variadic) {
		paramTypes[paramTypes.length - 1] = "..." + paramTypes[paramTypes.length - 1].substr(2);
	}
	var string = "func(" + paramTypes.join(", ") + ")";
	if (results.length === 1) {
		string += " " + results[0].string;
	} else if (results.length > 1) {
		string += " (" + go$mapArray(results, function(r) { return r.string; }).join(", ") + ")";
	}
	var typ = go$funcTypes[string];
	if (typ === undefined) {
		typ = go$newType(4, "Func", string, "", "", null);
		typ.init(params, results, variadic);
		go$funcTypes[string] = typ;
	}
	return typ;
};

var go$interfaceTypes = {};
var go$interfaceType = function(methods) {
	var string = "interface {}";
	if (methods.length !== 0) {
		string = "interface { " + go$mapArray(methods, function(m) {
			return (m[1] !== "" ? m[1] + "." : "") + m[0] + m[2].string.substr(4);
		}).join("; ") + " }";
	}
	var typ = go$interfaceTypes[string];
	if (typ === undefined) {
		typ = go$newType(8, "Interface", string, "", "", null);
		typ.init(methods);
		go$interfaceTypes[string] = typ;
	}
	return typ;
};
var go$emptyInterface = go$interfaceType([]);
var go$interfaceNil = { go$key: function() { return "nil"; } };
var go$error = go$newType(8, "Interface", "error", "error", "", null);
go$error.init([["Error", "", go$funcType([], [Go$String], false)]]);

var Go$Map = function() {};
(function() {
	var names = Object.getOwnPropertyNames(Object.prototype), i;
	for (i = 0; i < names.length; i++) {
		Go$Map.prototype[names[i]] = undefined;
	}
})();
var go$mapTypes = {};
var go$mapType = function(key, elem) {
	var string = "map[" + key.string + "]" + elem.string;
	var typ = go$mapTypes[string];
	if (typ === undefined) {
		typ = go$newType(4, "Map", string, "", "", null);
		typ.init(key, elem);
		go$mapTypes[string] = typ;
	}
	return typ;
};

var go$throwNilPointerError = function() { go$throwRuntimeError("invalid memory address or nil pointer dereference"); };
var go$ptrType = function(elem) {
	var typ = elem.Ptr;
	if (typ === undefined) {
		typ = go$newType(4, "Ptr", "*" + elem.string, "", "", null);
		typ.init(elem);
		elem.Ptr = typ;
	}
	return typ;
};

var go$sliceType = function(elem) {
	var typ = elem.Slice;
	if (typ === undefined) {
		typ = go$newType(12, "Slice", "[]" + elem.string, "", "", null);
		typ.init(elem);
		elem.Slice = typ;
	}
	return typ;
};

var go$structTypes = {};
var go$structType = function(fields) {
	var string = "struct { " + go$mapArray(fields, function(f) {
		return f[1] + " " + f[3].string + (f[4] !== "" ? (' "' + f[4].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"') : "");
	}).join("; ") + " }";
	var typ = go$structTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Struct", string, "", "", function() {
			this.go$val = this;
			var i;
			for (i = 0; i < fields.length; i++) {
				this[fields[i][0]] = arguments[i];
			}
		});
		typ.init(fields);
		go$structTypes[string] = typ;
	}
	return typ;
};

var go$stringPtrMap = new Go$Map();
go$newStringPtr = function(str) {
	if (str === undefined || str === "") {
		return go$ptrType(Go$String).nil;
	}
	var ptr = go$stringPtrMap[str];
	if (ptr === undefined) {
		ptr = new (go$ptrType(Go$String))(function() { return str; }, function(v) { str = v; });
		go$stringPtrMap[str] = ptr;
	}
	return ptr;
};
var go$newDataPointer = function(data, constructor) {
	return new constructor(function() { return data; }, function(v) { data = v; });
};

var go$coerceFloat32 = function(f) {
	var math = go$packages["math"];
	if (math === undefined) {
		return f;
	}
	return math.Float32frombits(math.Float32bits(f));
};
var go$flatten64 = function(x) {
	return x.high * 4294967296 + x.low;
};
var go$shiftLeft64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high << y | x.low >>> (32 - y), (x.low << y) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.low << (y - 32), 0);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightInt64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.high >> 31, (x.high >> (y - 32)) >>> 0);
	}
	if (x.high < 0) {
		return new x.constructor(-1, 4294967295);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightUint64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >>> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(0, x.high >>> (y - 32));
	}
	return new x.constructor(0, 0);
};
var go$mul64 = function(x, y) {
	var high = 0, low = 0, i;
	if ((y.low & 1) !== 0) {
		high = x.high;
		low = x.low;
	}
	for (i = 1; i < 32; i++) {
		if ((y.low & 1<<i) !== 0) {
			high += x.high << i | x.low >>> (32 - i);
			low += (x.low << i) >>> 0;
		}
	}
	for (i = 0; i < 32; i++) {
		if ((y.high & 1<<i) !== 0) {
			high += x.low << i;
		}
	}
	return new x.constructor(high, low);
};
var go$div64 = function(x, y, returnRemainder) {
	if (y.high === 0 && y.low === 0) {
		go$throwRuntimeError("integer divide by zero");
	}

	var s = 1;
	var rs = 1;

	var xHigh = x.high;
	var xLow = x.low;
	if (xHigh < 0) {
		s = -1;
		rs = -1;
		xHigh = -xHigh;
		if (xLow !== 0) {
			xHigh--;
			xLow = 4294967296 - xLow;
		}
	}

	var yHigh = y.high;
	var yLow = y.low;
	if (y.high < 0) {
		s *= -1;
		yHigh = -yHigh;
		if (yLow !== 0) {
			yHigh--;
			yLow = 4294967296 - yLow;
		}
	}

	var high = 0, low = 0, n = 0, i;
	while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
		yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
		yLow = (yLow << 1) >>> 0;
		n++;
	}
	for (i = 0; i <= n; i++) {
		high = high << 1 | low >>> 31;
		low = (low << 1) >>> 0;
		if ((xHigh > yHigh) || (xHigh === yHigh && xLow >= yLow)) {
			xHigh = xHigh - yHigh;
			xLow = xLow - yLow;
			if (xLow < 0) {
				xHigh--;
				xLow += 4294967296;
			}
			low++;
			if (low === 4294967296) {
				high++;
				low = 0;
			}
		}
		yLow = (yLow >>> 1 | yHigh << (32 - 1)) >>> 0;
		yHigh = yHigh >>> 1;
	}

	if (returnRemainder) {
		return new x.constructor(xHigh * rs, xLow * rs);
	}
	return new x.constructor(high * s, low * s);
};

var go$divComplex = function(n, d) {
	var ninf = n.real === 1/0 || n.real === -1/0 || n.imag === 1/0 || n.imag === -1/0;
	var dinf = d.real === 1/0 || d.real === -1/0 || d.imag === 1/0 || d.imag === -1/0;
	var nnan = !ninf && (n.real !== n.real || n.imag !== n.imag);
	var dnan = !dinf && (d.real !== d.real || d.imag !== d.imag);
	if(nnan || dnan) {
		return new n.constructor(0/0, 0/0);
	}
	if (ninf && !dinf) {
		return new n.constructor(1/0, 1/0);
	}
	if (!ninf && dinf) {
		return new n.constructor(0, 0);
	}
	if (d.real === 0 && d.imag === 0) {
		if (n.real === 0 && n.imag === 0) {
			return new n.constructor(0/0, 0/0);
		}
		return new n.constructor(1/0, 1/0);
	}
	var a = Math.abs(d.real);
	var b = Math.abs(d.imag);
	if (a <= b) {
		var ratio = d.real / d.imag;
		var denom = d.real * ratio + d.imag;
		return new n.constructor((n.real * ratio + n.imag) / denom, (n.imag * ratio - n.real) / denom);
	}
	var ratio = d.imag / d.real;
	var denom = d.imag * ratio + d.real;
	return new n.constructor((n.imag * ratio + n.real) / denom, (n.imag - n.real * ratio) / denom);
};

var go$subslice = function(slice, low, high, max) {
	if (low < 0 || high < low || max < high || high > slice.capacity || max > slice.capacity) {
		go$throwRuntimeError("slice bounds out of range");
	}
	var s = new slice.constructor(slice.array);
	s.offset = slice.offset + low;
	s.length = slice.length - low;
	s.capacity = slice.capacity - low;
	if (high !== undefined) {
		s.length = high - low;
	}
	if (max !== undefined) {
		s.capacity = max - low;
	}
	return s;
};

var go$sliceToArray = function(slice) {
	if (slice.length === 0) {
		return [];
	}
	if (slice.array.constructor !== Array) {
		return slice.array.subarray(slice.offset, slice.offset + slice.length);
	}
	return slice.array.slice(slice.offset, slice.offset + slice.length);
};

var go$decodeRune = function(str, pos) {
	var c0 = str.charCodeAt(pos);

	if (c0 < 0x80) {
		return [c0, 1];
	}

	if (c0 !== c0 || c0 < 0xC0) {
		return [0xFFFD, 1];
	}

	var c1 = str.charCodeAt(pos + 1);
	if (c1 !== c1 || c1 < 0x80 || 0xC0 <= c1) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xE0) {
		var r = (c0 & 0x1F) << 6 | (c1 & 0x3F);
		if (r <= 0x7F) {
			return [0xFFFD, 1];
		}
		return [r, 2];
	}

	var c2 = str.charCodeAt(pos + 2);
	if (c2 !== c2 || c2 < 0x80 || 0xC0 <= c2) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF0) {
		var r = (c0 & 0x0F) << 12 | (c1 & 0x3F) << 6 | (c2 & 0x3F);
		if (r <= 0x7FF) {
			return [0xFFFD, 1];
		}
		if (0xD800 <= r && r <= 0xDFFF) {
			return [0xFFFD, 1];
		}
		return [r, 3];
	}

	var c3 = str.charCodeAt(pos + 3);
	if (c3 !== c3 || c3 < 0x80 || 0xC0 <= c3) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF8) {
		var r = (c0 & 0x07) << 18 | (c1 & 0x3F) << 12 | (c2 & 0x3F) << 6 | (c3 & 0x3F);
		if (r <= 0xFFFF || 0x10FFFF < r) {
			return [0xFFFD, 1];
		}
		return [r, 4];
	}

	return [0xFFFD, 1];
};

var go$encodeRune = function(r) {
	if (r < 0 || r > 0x10FFFF || (0xD800 <= r && r <= 0xDFFF)) {
		r = 0xFFFD;
	}
	if (r <= 0x7F) {
		return String.fromCharCode(r);
	}
	if (r <= 0x7FF) {
		return String.fromCharCode(0xC0 | r >> 6, 0x80 | (r & 0x3F));
	}
	if (r <= 0xFFFF) {
		return String.fromCharCode(0xE0 | r >> 12, 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
	}
	return String.fromCharCode(0xF0 | r >> 18, 0x80 | (r >> 12 & 0x3F), 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
};

var go$stringToBytes = function(str, terminateWithNull) {
	var array = new Uint8Array(terminateWithNull ? str.length + 1 : str.length), i;
	for (i = 0; i < str.length; i++) {
		array[i] = str.charCodeAt(i);
	}
	if (terminateWithNull) {
		array[str.length] = 0;
	}
	return array;
};

var go$bytesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i += 10000) {
		str += String.fromCharCode.apply(null, slice.array.subarray(slice.offset + i, slice.offset + Math.min(slice.length, i + 10000)));
	}
	return str;
};

var go$stringToRunes = function(str) {
	var array = new Int32Array(str.length);
	var rune, i, j = 0;
	for (i = 0; i < str.length; i += rune[1], j++) {
		rune = go$decodeRune(str, i);
		array[j] = rune[0];
	}
	return array.subarray(0, j);
};

var go$runesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i++) {
		str += go$encodeRune(slice.array[slice.offset + i]);
	}
	return str;
};

var go$needsExternalization = function(t) {
	switch (t.kind) {
		case "Int64":
		case "Uint64":
		case "Array":
		case "Func":
		case "Map":
		case "Slice":
		case "String":
			return true;
		case "Interface":
			return t !== go$packages["github.com/gopherjs/gopherjs/js"].Object;
		default:
			return false;
	}
};

var go$externalize = function(v, t) {
	switch (t.kind) {
	case "Int64":
	case "Uint64":
		return go$flatten64(v);
	case "Array":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(v, function(e) { return go$externalize(e, t.elem); });
		}
		return v;
	case "Func":
		if (v === go$throwNilPointerError) {
			return null;
		}
		var convert = false;
		var i;
		for (i = 0; i < t.params.length; i++) {
			convert = convert || (t.params[i] !== go$packages["github.com/gopherjs/gopherjs/js"].Object);
		}
		for (i = 0; i < t.results.length; i++) {
			convert = convert || go$needsExternalization(t.results[i]);
		}
		if (!convert) {
			return v;
		}
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = [], j;
					for (j = i; j < arguments.length; j++) {
						varargs.push(go$internalize(arguments[j], vt));
					}
					args.push(new (t.params[i])(varargs));
					break;
				}
				args.push(go$internalize(arguments[i], t.params[i]));
			}
			var result = v.apply(undefined, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$externalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$externalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (v === null) {
			return null;
		}
		if (t === go$packages["github.com/gopherjs/gopherjs/js"].Object || v.constructor.kind === undefined) {
			return v;
		}
		return go$externalize(v.go$val, v.constructor);
	case "Map":
		var m = {};
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var entry = v[keys[i]];
			m[go$externalize(entry.k, t.key)] = go$externalize(entry.v, t.elem);
		}
		return m;
	case "Slice":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(go$sliceToArray(v), function(e) { return go$externalize(e, t.elem); });
		}
		return go$sliceToArray(v);
	case "String":
		var s = "", r, i, j = 0;
		for (i = 0; i < v.length; i += r[1], j++) {
			r = go$decodeRune(v, i);
			s += String.fromCharCode(r[0]);
		}
		return s;
	case "Struct":
		var timePkg = go$packages["time"];
		if (timePkg && v.constructor === timePkg.Time.Ptr) {
			var milli = go$div64(v.UnixNano(), new Go$Int64(0, 1000000));
			return new Date(go$flatten64(milli));
		}
		return v;
	default:
		return v;
	}
};

var go$internalize = function(v, t, recv) {
	switch (t.kind) {
	case "Bool":
		return !!v;
	case "Int":
		return parseInt(v);
	case "Int8":
		return parseInt(v) << 24 >> 24;
	case "Int16":
		return parseInt(v) << 16 >> 16;
	case "Int32":
		return parseInt(v) >> 0;
	case "Uint":
		return parseInt(v);
	case "Uint8" :
		return parseInt(v) << 24 >>> 24;
	case "Uint16":
		return parseInt(v) << 16 >>> 16;
	case "Uint32":
	case "Uintptr":
		return parseInt(v) >>> 0;
	case "Int64":
	case "Uint64":
		return new t(0, v);
	case "Float32":
	case "Float64":
		return parseFloat(v);
	case "Array":
		if (v.length !== t.len) {
			go$throwRuntimeError("got array with wrong size from JavaScript native");
		}
		return go$mapArray(v, function(e) { return go$internalize(e, t.elem); });
	case "Func":
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = arguments[i], j;
					for (j = 0; j < varargs.length; j++) {
						args.push(go$externalize(varargs.array[varargs.offset + j], vt));
					}
					break;
				}
				args.push(go$externalize(arguments[i], t.params[i]));
			}
			var result = v.apply(recv, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$internalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$internalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (v === null || t === go$packages["github.com/gopherjs/gopherjs/js"].Object) {
			return v;
		}
		switch (v.constructor) {
		case Int8Array:
			return new (go$sliceType(Go$Int8))(v);
		case Int16Array:
			return new (go$sliceType(Go$Int16))(v);
		case Int32Array:
			return new (go$sliceType(Go$Int))(v);
		case Uint8Array:
			return new (go$sliceType(Go$Uint8))(v);
		case Uint16Array:
			return new (go$sliceType(Go$Uint16))(v);
		case Uint32Array:
			return new (go$sliceType(Go$Uint))(v);
		case Float32Array:
			return new (go$sliceType(Go$Float32))(v);
		case Float64Array:
			return new (go$sliceType(Go$Float64))(v);
		case Array:
			return go$internalize(v, go$sliceType(go$emptyInterface));
		case Boolean:
			return new Go$Bool(!!v);
		case Date:
			var timePkg = go$packages["time"];
			if (timePkg) {
				return new timePkg.Time(timePkg.Unix(new Go$Int64(0, 0), new Go$Int64(0, v.getTime() * 1000000)));
			}
		case Function:
			var funcType = go$funcType([go$sliceType(go$emptyInterface)], [go$packages["github.com/gopherjs/gopherjs/js"].Object], true);
			return new funcType(go$internalize(v, funcType));
		case Number:
			return new Go$Float64(parseFloat(v));
		case Object:
			var mapType = go$mapType(Go$String, go$emptyInterface);
			return new mapType(go$internalize(v, mapType));
		case String:
			return new Go$String(go$internalize(v, Go$String));
		}
		return v;
	case "Map":
		var m = new Go$Map();
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var key = go$internalize(keys[i], t.key);
			m[key.go$key ? key.go$key() : key] = { k: key, v: go$internalize(v[keys[i]], t.elem) };
		}
		return m;
	case "Slice":
		return new t(go$mapArray(v, function(e) { return go$internalize(e, t.elem); }));
	case "String":
		v = String(v);
		var s = "", i;
		for (i = 0; i < v.length; i++) {
			s += go$encodeRune(v.charCodeAt(i));
		}
		return s;
	default:
		return v;
	}
};

var go$copySlice = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	if (dst.array.constructor !== Array && n !== 0) {
		dst.array.set(src.array.subarray(src.offset, src.offset + n), dst.offset);
		return n;
	}
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.array[src.offset + i];
	}
	return n;
};

var go$copyString = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.charCodeAt(i);
	}
	return n;
};

var go$copyArray = function(dst, src) {
	var i;
	for (i = 0; i < src.length; i++) {
		dst[i] = src[i];
	}
};

var go$growSlice = function(slice, length) {
	var newCapacity = Math.max(length, slice.capacity < 1024 ? slice.capacity * 2 : Math.floor(slice.capacity * 5 / 4));

	var newArray;
	if (slice.array.constructor === Array) {
		newArray = slice.array;
		if (slice.offset !== 0 || newArray.length !== slice.offset + slice.capacity) {
			newArray = newArray.slice(slice.offset);
		}
		newArray.length = newCapacity;
	} else {
		newArray = new slice.array.constructor(newCapacity);
		newArray.set(slice.array.subarray(slice.offset));
	}

	var newSlice = new slice.constructor(newArray);
	newSlice.length = slice.length;
	newSlice.capacity = newCapacity;
	return newSlice;
};

var go$append = function(slice) {
	if (arguments.length === 1) {
		return slice;
	}

	var newLength = slice.length + arguments.length - 1;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length - 1, i;
	for (i = 1; i < arguments.length; i++) {
		array[leftOffset + i] = arguments[i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$appendSlice = function(slice, toAppend) {
	if (toAppend.length === 0) {
		return slice;
	}

	var newLength = slice.length + toAppend.length;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length, rightOffset = toAppend.offset, i;
	for (i = 0; i < toAppend.length; i++) {
		array[leftOffset + i] = toAppend.array[rightOffset + i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$panic = function(value) {
	var message;
	if (value.constructor === Go$String) {
		message = value.go$val;
	} else if (value.Error !== undefined) {
		message = value.Error();
	} else if (value.String !== undefined) {
		message = value.String();
	} else {
		message = value;
	}
	var err = new Error(message);
	err.go$panicValue = value;
	return err;
};
var go$notSupported = function(feature) {
	var err = new Error("not supported by GopherJS: " + feature);
	err.go$notSupported = feature;
	throw err;
};
var go$throwRuntimeError; // set by package "runtime"

var go$errorStack = [], go$jsErr = null;

var go$pushErr = function(err) {
	if (err.go$panicValue === undefined) {
		if (err.go$exit || err.go$notSupported) {
			go$jsErr = err;
			return;
		}
		err.go$panicValue = new go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr(err);
	}
	go$errorStack.push({ frame: go$getStackDepth(), error: err });
};

var go$callDeferred = function(deferred) {
	if (go$jsErr !== null) {
		throw go$jsErr;
	}
	var i;
	for (i = deferred.length - 1; i >= 0; i--) {
		var call = deferred[i];
		try {
			if (call.recv !== undefined) {
				call.recv[call.method].apply(call.recv, call.args);
				continue;
			}
			call.fun.apply(undefined, call.args);
		} catch (err) {
			go$errorStack.push({ frame: go$getStackDepth(), error: err });
		}
	}
	var err = go$errorStack[go$errorStack.length - 1];
	if (err !== undefined && err.frame === go$getStackDepth()) {
		go$errorStack.pop();
		throw err.error;
	}
};

var go$recover = function() {
	var err = go$errorStack[go$errorStack.length - 1];
	if (err === undefined || err.frame !== go$getStackDepth()) {
		return null;
	}
	go$errorStack.pop();
	return err.error.go$panicValue;
};

var go$getStack = function() {
	return (new Error()).stack.split("\n");
};

var go$getStackDepth = function() {
	var s = go$getStack(), d = 0, i;
	for (i = 0; i < s.length; i++) {
		if (s[i].indexOf("go$") === -1) {
			d++;
		}
	}
	return d;
};

var go$interfaceIsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a === null || b === null || a === undefined || b === undefined || a.constructor !== b.constructor) {
		return false;
	}
	switch (a.constructor.kind) {
	case "Float32":
		return go$float32IsEqual(a.go$val, b.go$val);
	case "Complex64":
		return go$float32IsEqual(a.go$val.real, b.go$val.real) && go$float32IsEqual(a.go$val.imag, b.go$val.imag);
	case "Complex128":
		return a.go$val.real === b.go$val.real && a.go$val.imag === b.go$val.imag;
	case "Int64":
	case "Uint64":
		return a.go$val.high === b.go$val.high && a.go$val.low === b.go$val.low;
	case "Array":
		return go$arrayIsEqual(a.go$val, b.go$val);
	case "Ptr":
		if (a.constructor.Struct) {
			return false;
		}
		return go$pointerIsEqual(a, b);
	case "Func":
	case "Map":
	case "Slice":
	case "Struct":
		go$throwRuntimeError("comparing uncomparable type " + a.constructor);
	case undefined: // js.Object
		return false;
	default:
		return a.go$val === b.go$val;
	}
};
var go$float32IsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a === 0 || b === 0 || a === 1/0 || b === 1/0 || a === -1/0 || b === -1/0 || a !== a || b !== b) {
		return false;
	}
	var math = go$packages["math"];
	return math !== undefined && math.Float32bits(a) === math.Float32bits(b);
}
var go$arrayIsEqual = function(a, b) {
	if (a.length != b.length) {
		return false;
	}
	var i;
	for (i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
};
var go$sliceIsEqual = function(a, ai, b, bi) {
	return a.array === b.array && a.offset + ai === b.offset + bi;
};
var go$pointerIsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a.go$get === go$throwNilPointerError || b.go$get === go$throwNilPointerError) {
		return a.go$get === go$throwNilPointerError && b.go$get === go$throwNilPointerError;
	}
	var old = a.go$get();
	var dummy = new Object();
	a.go$set(dummy);
	var equal = b.go$get() === dummy;
	a.go$set(old);
	return equal;
};

var go$typeAssertionFailed = function(obj, expected) {
	var got = "";
	if (obj !== null) {
		got = obj.constructor.string;
	}
	throw go$panic(new go$packages["runtime"].TypeAssertionError.Ptr("", got, expected.string, ""));
};

var go$now = function() { var msec = (new Date()).getTime(); return [new Go$Int64(0, Math.floor(msec / 1000)), (msec % 1000) * 1000000]; };

var go$packages = {};
go$packages["github.com/gopherjs/gopherjs/js"] = (function() {
	var go$pkg = {}, Object, Error;
	Object = go$pkg.Object = go$newType(8, "Interface", "js.Object", "Object", "github.com/gopherjs/gopherjs/js", null);
	Error = go$pkg.Error = go$newType(0, "Struct", "js.Error", "Error", "github.com/gopherjs/gopherjs/js", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Error.Ptr.prototype.Error = function() {
		var err;
		err = this;
		return "JavaScript error: " + go$internalize(err.Object.message, Go$String);
	};
	Error.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
		Object.init([["Bool", "", (go$funcType([], [Go$Bool], false))], ["Call", "", (go$funcType([Go$String, (go$sliceType(go$emptyInterface))], [Object], true))], ["Delete", "", (go$funcType([Go$String], [], false))], ["Float", "", (go$funcType([], [Go$Float64], false))], ["Get", "", (go$funcType([Go$String], [Object], false))], ["Index", "", (go$funcType([Go$Int], [Object], false))], ["Int", "", (go$funcType([], [Go$Int], false))], ["Int64", "", (go$funcType([], [Go$Int64], false))], ["Interface", "", (go$funcType([], [go$emptyInterface], false))], ["Invoke", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["IsNull", "", (go$funcType([], [Go$Bool], false))], ["IsUndefined", "", (go$funcType([], [Go$Bool], false))], ["Length", "", (go$funcType([], [Go$Int], false))], ["New", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["Set", "", (go$funcType([Go$String, go$emptyInterface], [], false))], ["SetIndex", "", (go$funcType([Go$Int, go$emptyInterface], [], false))], ["Str", "", (go$funcType([], [Go$String], false))], ["Uint64", "", (go$funcType([], [Go$Uint64], false))], ["Unsafe", "", (go$funcType([], [Go$Uintptr], false))]]);
		Error.methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [Object], false, 0], ["Index", "Index", "", [Go$Int], [Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		(go$ptrType(Error)).methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Error", "Error", "", [], [Go$String], false, -1], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [Object], false, 0], ["Index", "Index", "", [Go$Int], [Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		Error.init([["Object", "", "", Object, ""]]);
		var e;
		e = new Error.Ptr(null);
	}
	return go$pkg;
})();
go$packages["runtime"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], TypeAssertionError, errorString, goexit, sizeof_C_MStats;
	TypeAssertionError = go$pkg.TypeAssertionError = go$newType(0, "Struct", "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.go$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	errorString = go$pkg.errorString = go$newType(8, "String", "runtime.errorString", "errorString", "runtime", null);
	TypeAssertionError.Ptr.prototype.RuntimeError = function() {
	};
	TypeAssertionError.prototype.RuntimeError = function() { return this.go$val.RuntimeError(); };
	TypeAssertionError.Ptr.prototype.Error = function() {
		var e, inter;
		e = this;
		inter = e.interfaceString;
		if (inter === "") {
			inter = "interface";
		}
		if (e.concreteString === "") {
			return "interface conversion: " + inter + " is nil, not " + e.assertedString;
		}
		if (e.missingMethod === "") {
			return "interface conversion: " + inter + " is " + e.concreteString + ", not " + e.assertedString;
		}
		return "interface conversion: " + e.concreteString + " is not " + e.assertedString + ": missing method " + e.missingMethod;
	};
	TypeAssertionError.prototype.Error = function() { return this.go$val.Error(); };
	errorString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorString).prototype.RuntimeError = function() { return new errorString(this.go$get()).RuntimeError(); };
	errorString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + e;
	};
	go$ptrType(errorString).prototype.Error = function() { return new errorString(this.go$get()).Error(); };
	go$pkg.init = function() {
		(go$ptrType(TypeAssertionError)).methods = [["Error", "Error", "", [], [Go$String], false, -1], ["RuntimeError", "RuntimeError", "", [], [], false, -1]];
		TypeAssertionError.init([["interfaceString", "interfaceString", "runtime", Go$String, ""], ["concreteString", "concreteString", "runtime", Go$String, ""], ["assertedString", "assertedString", "runtime", Go$String, ""], ["missingMethod", "missingMethod", "runtime", Go$String, ""]]);
		errorString.methods = [["Error", "Error", "", [], [Go$String], false, -1], ["RuntimeError", "RuntimeError", "", [], [], false, -1]];
		(go$ptrType(errorString)).methods = [["Error", "Error", "", [], [Go$String], false, -1], ["RuntimeError", "RuntimeError", "", [], [], false, -1]];
		sizeof_C_MStats = 3712;
		goexit = go$global.eval(go$externalize("(function() {\n\tvar err = new Error();\n\terr.go$exit = true;\n\tthrow err;\n})", Go$String));
		var e;
		go$throwRuntimeError = go$externalize((function(msg) {
			throw go$panic(new errorString(msg));
		}), (go$funcType([Go$String], [], false)));
		e = new TypeAssertionError.Ptr("", "", "", "");
		if (!((sizeof_C_MStats === 3712))) {
			console.log(sizeof_C_MStats, 3712);
			throw go$panic(new Go$String("MStats vs MemStatsType size mismatch"));
		}
	}
	return go$pkg;
})();
go$packages["github.com/gopherjs/jquery"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], JQuery, Event, JQueryCoordinates, Deferred, NewJQuery, Trim, GlobalEval, Type, IsPlainObject, IsEmptyObject, IsFunction, IsNumeric, IsXMLDoc, IsWindow, InArray, ParseHTML, ParseXML, ParseJSON, Grep, Noop, Now, Unique, Ajax, AjaxPrefilter, AjaxSetup, AjaxTransport, Get, Post, GetJSON, GetScript, When, NewDeferred;
	JQuery = go$pkg.JQuery = go$newType(0, "Struct", "jquery.JQuery", "JQuery", "github.com/gopherjs/jquery", function(o_, Jquery_, Selector_, Length_, Context_) {
		this.go$val = this;
		this.o = o_ !== undefined ? o_ : null;
		this.Jquery = Jquery_ !== undefined ? Jquery_ : "";
		this.Selector = Selector_ !== undefined ? Selector_ : "";
		this.Length = Length_ !== undefined ? Length_ : "";
		this.Context = Context_ !== undefined ? Context_ : "";
	});
	Event = go$pkg.Event = go$newType(0, "Struct", "jquery.Event", "Event", "github.com/gopherjs/jquery", function(Object_, KeyCode_, Target_, CurrentTarget_, DelegateTarget_, RelatedTarget_, Data_, Result_, Which_, Namespace_, MetaKey_, PageX_, PageY_, Type_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.KeyCode = KeyCode_ !== undefined ? KeyCode_ : 0;
		this.Target = Target_ !== undefined ? Target_ : null;
		this.CurrentTarget = CurrentTarget_ !== undefined ? CurrentTarget_ : null;
		this.DelegateTarget = DelegateTarget_ !== undefined ? DelegateTarget_ : null;
		this.RelatedTarget = RelatedTarget_ !== undefined ? RelatedTarget_ : null;
		this.Data = Data_ !== undefined ? Data_ : null;
		this.Result = Result_ !== undefined ? Result_ : null;
		this.Which = Which_ !== undefined ? Which_ : 0;
		this.Namespace = Namespace_ !== undefined ? Namespace_ : "";
		this.MetaKey = MetaKey_ !== undefined ? MetaKey_ : false;
		this.PageX = PageX_ !== undefined ? PageX_ : 0;
		this.PageY = PageY_ !== undefined ? PageY_ : 0;
		this.Type = Type_ !== undefined ? Type_ : "";
	});
	JQueryCoordinates = go$pkg.JQueryCoordinates = go$newType(0, "Struct", "jquery.JQueryCoordinates", "JQueryCoordinates", "github.com/gopherjs/jquery", function(Left_, Top_) {
		this.go$val = this;
		this.Left = Left_ !== undefined ? Left_ : 0;
		this.Top = Top_ !== undefined ? Top_ : 0;
	});
	Deferred = go$pkg.Deferred = go$newType(0, "Struct", "jquery.Deferred", "Deferred", "github.com/gopherjs/jquery", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Event.Ptr.prototype.PreventDefault = function() {
		var event;
		event = this;
		event.Object.preventDefault();
	};
	Event.prototype.PreventDefault = function() { return this.go$val.PreventDefault(); };
	Event.Ptr.prototype.IsDefaultPrevented = function() {
		var event;
		event = this;
		return !!(event.Object.isDefaultPrevented());
	};
	Event.prototype.IsDefaultPrevented = function() { return this.go$val.IsDefaultPrevented(); };
	Event.Ptr.prototype.IsImmediatePropogationStopped = function() {
		var event;
		event = this;
		return !!(event.Object.isImmediatePropogationStopped());
	};
	Event.prototype.IsImmediatePropogationStopped = function() { return this.go$val.IsImmediatePropogationStopped(); };
	Event.Ptr.prototype.IsPropagationStopped = function() {
		var event;
		event = this;
		return !!(event.Object.isPropagationStopped());
	};
	Event.prototype.IsPropagationStopped = function() { return this.go$val.IsPropagationStopped(); };
	Event.Ptr.prototype.StopImmediatePropagation = function() {
		var event;
		event = this;
		event.Object.stopImmediatePropagation();
	};
	Event.prototype.StopImmediatePropagation = function() { return this.go$val.StopImmediatePropagation(); };
	Event.Ptr.prototype.StopPropagation = function() {
		var event;
		event = this;
		event.Object.stopPropagation();
	};
	Event.prototype.StopPropagation = function() { return this.go$val.StopPropagation(); };
	NewJQuery = go$pkg.NewJQuery = function(args) {
		return new JQuery.Ptr(new (go$global.Function.prototype.bind.apply(go$global.jQuery, [undefined].concat(go$externalize(args, (go$sliceType(go$emptyInterface)))))), "", "", "", "");
	};
	Trim = go$pkg.Trim = function(text) {
		return go$internalize(go$global.jQuery.trim(go$externalize(text, Go$String)), Go$String);
	};
	GlobalEval = go$pkg.GlobalEval = function(cmd) {
		go$global.jQuery.globalEval(go$externalize(cmd, Go$String));
	};
	Type = go$pkg.Type = function(sth) {
		return go$internalize(go$global.jQuery.type(go$externalize(sth, go$emptyInterface)), Go$String);
	};
	IsPlainObject = go$pkg.IsPlainObject = function(sth) {
		return !!(go$global.jQuery.isPlainObject(go$externalize(sth, go$emptyInterface)));
	};
	IsEmptyObject = go$pkg.IsEmptyObject = function(sth) {
		return !!(go$global.jQuery.isEmptyObject(go$externalize(sth, go$emptyInterface)));
	};
	IsFunction = go$pkg.IsFunction = function(sth) {
		return !!(go$global.jQuery.isFunction(go$externalize(sth, go$emptyInterface)));
	};
	IsNumeric = go$pkg.IsNumeric = function(sth) {
		return !!(go$global.jQuery.isNumeric(go$externalize(sth, go$emptyInterface)));
	};
	IsXMLDoc = go$pkg.IsXMLDoc = function(sth) {
		return !!(go$global.jQuery.isXMLDoc(go$externalize(sth, go$emptyInterface)));
	};
	IsWindow = go$pkg.IsWindow = function(sth) {
		return !!(go$global.jQuery.isWindow(go$externalize(sth, go$emptyInterface)));
	};
	InArray = go$pkg.InArray = function(val, arr) {
		return go$parseInt(go$global.jQuery.inArray(go$externalize(val, go$emptyInterface), go$externalize(arr, (go$sliceType(go$emptyInterface))))) >> 0;
	};
	ParseHTML = go$pkg.ParseHTML = function(text) {
		var x;
		return (x = go$internalize(go$global.jQuery.parseHTML(go$externalize(text, Go$String)), go$emptyInterface), (x !== null && x.constructor === (go$sliceType(go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$sliceType(go$emptyInterface)))));
	};
	ParseXML = go$pkg.ParseXML = function(text) {
		return go$internalize(go$global.jQuery.parseXML(go$externalize(text, Go$String)), go$emptyInterface);
	};
	ParseJSON = go$pkg.ParseJSON = function(text) {
		return go$internalize(go$global.jQuery.parseJSON(go$externalize(text, Go$String)), go$emptyInterface);
	};
	Grep = go$pkg.Grep = function(arr, fn) {
		var x;
		return (x = go$internalize(go$global.jQuery.grep(go$externalize(arr, (go$sliceType(go$emptyInterface))), go$externalize(fn, (go$funcType([go$emptyInterface, Go$Int], [Go$Bool], false)))), go$emptyInterface), (x !== null && x.constructor === (go$sliceType(go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$sliceType(go$emptyInterface)))));
	};
	Noop = go$pkg.Noop = function() {
		return go$internalize(go$global.jQuery.noop, go$emptyInterface);
	};
	Now = go$pkg.Now = function() {
		return go$parseFloat(go$global.jQuery.now());
	};
	Unique = go$pkg.Unique = function(arr) {
		return go$global.jQuery.unique(arr);
	};
	JQuery.Ptr.prototype.Each = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.each(go$externalize(fn, (go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Each = function(fn) { return this.go$val.Each(fn); };
	JQuery.Ptr.prototype.Underlying = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return j.o;
	};
	JQuery.prototype.Underlying = function() { return this.go$val.Underlying(); };
	JQuery.Ptr.prototype.Get = function(i) {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (obj = j.o, obj.get.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
	};
	JQuery.prototype.Get = function(i) { return this.go$val.Get(i); };
	JQuery.Ptr.prototype.Append = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("append", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Append = function(i) { return this.go$val.Append(i); };
	JQuery.Ptr.prototype.Empty = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.empty();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Empty = function() { return this.go$val.Empty(); };
	JQuery.Ptr.prototype.Detach = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.detach.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Detach = function(i) { return this.go$val.Detach(i); };
	JQuery.Ptr.prototype.Eq = function(idx) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.eq(idx);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Eq = function(idx) { return this.go$val.Eq(idx); };
	JQuery.Ptr.prototype.FadeIn = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.fadeIn.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FadeIn = function(i) { return this.go$val.FadeIn(i); };
	JQuery.Ptr.prototype.Delay = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.delay.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Delay = function(i) { return this.go$val.Delay(i); };
	JQuery.Ptr.prototype.ToArray = function() {
		var _struct, j, x;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (x = go$internalize(j.o.toArray(), go$emptyInterface), (x !== null && x.constructor === (go$sliceType(go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$sliceType(go$emptyInterface)))));
	};
	JQuery.prototype.ToArray = function() { return this.go$val.ToArray(); };
	JQuery.Ptr.prototype.Remove = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.remove.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Remove = function(i) { return this.go$val.Remove(i); };
	JQuery.Ptr.prototype.Stop = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.stop.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Stop = function(i) { return this.go$val.Stop(i); };
	JQuery.Ptr.prototype.AddBack = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.addBack.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddBack = function(i) { return this.go$val.AddBack(i); };
	JQuery.Ptr.prototype.Css = function(name) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.css(go$externalize(name, Go$String)), Go$String);
	};
	JQuery.prototype.Css = function(name) { return this.go$val.Css(name); };
	JQuery.Ptr.prototype.CssArray = function(arr) {
		var _struct, j, x;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (x = go$internalize(j.o.css(go$externalize(arr, (go$sliceType(Go$String)))), go$emptyInterface), (x !== null && x.constructor === (go$mapType(Go$String, go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$mapType(Go$String, go$emptyInterface)))));
	};
	JQuery.prototype.CssArray = function(arr) { return this.go$val.CssArray(arr); };
	JQuery.Ptr.prototype.SetCss = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.css.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetCss = function(i) { return this.go$val.SetCss(i); };
	JQuery.Ptr.prototype.Text = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.text(), Go$String);
	};
	JQuery.prototype.Text = function() { return this.go$val.Text(); };
	JQuery.Ptr.prototype.SetText = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("SetText Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.text(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetText = function(i) { return this.go$val.SetText(i); };
	JQuery.Ptr.prototype.Val = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.val(), Go$String);
	};
	JQuery.prototype.Val = function() { return this.go$val.Val(); };
	JQuery.Ptr.prototype.SetVal = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.val(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetVal = function(i) { return this.go$val.SetVal(i); };
	JQuery.Ptr.prototype.Prop = function(property) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.prop(go$externalize(property, Go$String)), go$emptyInterface);
	};
	JQuery.prototype.Prop = function(property) { return this.go$val.Prop(property); };
	JQuery.Ptr.prototype.SetProp = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prop.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetProp = function(i) { return this.go$val.SetProp(i); };
	JQuery.Ptr.prototype.RemoveProp = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeProp(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveProp = function(property) { return this.go$val.RemoveProp(property); };
	JQuery.Ptr.prototype.Attr = function(property) {
		var _struct, j, attr;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		attr = j.o.attr(go$externalize(property, Go$String));
		if (attr === undefined) {
			return "";
		}
		return go$internalize(attr, Go$String);
	};
	JQuery.prototype.Attr = function(property) { return this.go$val.Attr(property); };
	JQuery.Ptr.prototype.SetAttr = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.attr.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetAttr = function(i) { return this.go$val.SetAttr(i); };
	JQuery.Ptr.prototype.RemoveAttr = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeAttr(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveAttr = function(property) { return this.go$val.RemoveAttr(property); };
	JQuery.Ptr.prototype.HasClass = function(class$1) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return !!(j.o.hasClass(go$externalize(class$1, Go$String)));
	};
	JQuery.prototype.HasClass = function(class$1) { return this.go$val.HasClass(class$1); };
	JQuery.Ptr.prototype.AddClass = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("addClass Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.addClass(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddClass = function(i) { return this.go$val.AddClass(i); };
	JQuery.Ptr.prototype.RemoveClass = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeClass(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveClass = function(property) { return this.go$val.RemoveClass(property); };
	JQuery.Ptr.prototype.ToggleClass = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.toggleClass.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ToggleClass = function(i) { return this.go$val.ToggleClass(i); };
	JQuery.Ptr.prototype.Focus = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.focus();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Focus = function() { return this.go$val.Focus(); };
	JQuery.Ptr.prototype.Blur = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.blur();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Blur = function() { return this.go$val.Blur(); };
	JQuery.Ptr.prototype.ReplaceAll = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("replaceAll", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ReplaceAll = function(i) { return this.go$val.ReplaceAll(i); };
	JQuery.Ptr.prototype.ReplaceWith = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("replaceWith", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ReplaceWith = function(i) { return this.go$val.ReplaceWith(i); };
	JQuery.Ptr.prototype.After = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("after", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.After = function(i) { return this.go$val.After(i); };
	JQuery.Ptr.prototype.Before = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("before", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Before = function(i) { return this.go$val.Before(i); };
	JQuery.Ptr.prototype.Prepend = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("prepend", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Prepend = function(i) { return this.go$val.Prepend(i); };
	JQuery.Ptr.prototype.PrependTo = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("prependTo", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrependTo = function(i) { return this.go$val.PrependTo(i); };
	JQuery.Ptr.prototype.AppendTo = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("appendTo", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AppendTo = function(i) { return this.go$val.AppendTo(i); };
	JQuery.Ptr.prototype.InsertAfter = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("insertAfter", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.InsertAfter = function(i) { return this.go$val.InsertAfter(i); };
	JQuery.Ptr.prototype.InsertBefore = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("insertBefore", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.InsertBefore = function(i) { return this.go$val.InsertBefore(i); };
	JQuery.Ptr.prototype.Show = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.show();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Show = function() { return this.go$val.Show(); };
	JQuery.Ptr.prototype.Hide = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.hide();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Hide = function() { return this.go$val.Hide(); };
	JQuery.Ptr.prototype.Toggle = function(showOrHide) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.toggle(go$externalize(showOrHide, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Toggle = function(showOrHide) { return this.go$val.Toggle(showOrHide); };
	JQuery.Ptr.prototype.Contents = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.contents();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Contents = function() { return this.go$val.Contents(); };
	JQuery.Ptr.prototype.Html = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.html(), Go$String);
	};
	JQuery.prototype.Html = function() { return this.go$val.Html(); };
	JQuery.Ptr.prototype.SetHtml = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("SetHtml Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.html(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetHtml = function(i) { return this.go$val.SetHtml(i); };
	JQuery.Ptr.prototype.Closest = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("closest", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Closest = function(i) { return this.go$val.Closest(i); };
	JQuery.Ptr.prototype.End = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.end();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.End = function() { return this.go$val.End(); };
	JQuery.Ptr.prototype.Add = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom2args("add", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Add = function(i) { return this.go$val.Add(i); };
	JQuery.Ptr.prototype.Clone = function(b) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.clone.apply(obj, go$externalize(b, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Clone = function(b) { return this.go$val.Clone(b); };
	JQuery.Ptr.prototype.Height = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.height()) >> 0;
	};
	JQuery.prototype.Height = function() { return this.go$val.Height(); };
	JQuery.Ptr.prototype.SetHeight = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.height(go$externalize(value, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetHeight = function(value) { return this.go$val.SetHeight(value); };
	JQuery.Ptr.prototype.Width = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.width()) >> 0;
	};
	JQuery.prototype.Width = function() { return this.go$val.Width(); };
	JQuery.Ptr.prototype.SetWidth = function(i) {
		var _struct, j, _ref, _type, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i;
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Go$Int, Go$String], [Go$String], false)) || _type === Go$String) {
		} else {
			console.log("SetWidth Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.width(go$externalize(i, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetWidth = function(i) { return this.go$val.SetWidth(i); };
	JQuery.Ptr.prototype.InnerHeight = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.innerHeight()) >> 0;
	};
	JQuery.prototype.InnerHeight = function() { return this.go$val.InnerHeight(); };
	JQuery.Ptr.prototype.InnerWidth = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.innerWidth()) >> 0;
	};
	JQuery.prototype.InnerWidth = function() { return this.go$val.InnerWidth(); };
	JQuery.Ptr.prototype.Offset = function() {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		obj = j.o.offset();
		return new JQueryCoordinates.Ptr(go$parseInt(obj.left) >> 0, go$parseInt(obj.top) >> 0);
	};
	JQuery.prototype.Offset = function() { return this.go$val.Offset(); };
	JQuery.Ptr.prototype.SetOffset = function(jc) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.offset(go$externalize(jc, JQueryCoordinates));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetOffset = function(jc) { return this.go$val.SetOffset(jc); };
	JQuery.Ptr.prototype.OuterHeight = function(includeMargin) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		if (includeMargin.length === 0) {
			return go$parseInt(j.o.outerHeight()) >> 0;
		}
		return go$parseInt(j.o.outerHeight(go$externalize(((0 < 0 || 0 >= includeMargin.length) ? go$throwRuntimeError("index out of range") : includeMargin.array[includeMargin.offset + 0]), Go$Bool))) >> 0;
	};
	JQuery.prototype.OuterHeight = function(includeMargin) { return this.go$val.OuterHeight(includeMargin); };
	JQuery.Ptr.prototype.OuterWidth = function(includeMargin) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		if (includeMargin.length === 0) {
			return go$parseInt(j.o.outerWidth()) >> 0;
		}
		return go$parseInt(j.o.outerWidth(go$externalize(((0 < 0 || 0 >= includeMargin.length) ? go$throwRuntimeError("index out of range") : includeMargin.array[includeMargin.offset + 0]), Go$Bool))) >> 0;
	};
	JQuery.prototype.OuterWidth = function(includeMargin) { return this.go$val.OuterWidth(includeMargin); };
	JQuery.Ptr.prototype.Position = function() {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		obj = j.o.position();
		return new JQueryCoordinates.Ptr(go$parseInt(obj.left) >> 0, go$parseInt(obj.top) >> 0);
	};
	JQuery.prototype.Position = function() { return this.go$val.Position(); };
	JQuery.Ptr.prototype.ScrollLeft = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.scrollLeft()) >> 0;
	};
	JQuery.prototype.ScrollLeft = function() { return this.go$val.ScrollLeft(); };
	JQuery.Ptr.prototype.SetScrollLeft = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scrollLeft(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetScrollLeft = function(value) { return this.go$val.SetScrollLeft(value); };
	JQuery.Ptr.prototype.ScrollTop = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.scrollTop()) >> 0;
	};
	JQuery.prototype.ScrollTop = function() { return this.go$val.ScrollTop(); };
	JQuery.Ptr.prototype.SetScrollTop = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scrollTop(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetScrollTop = function(value) { return this.go$val.SetScrollTop(value); };
	JQuery.Ptr.prototype.ClearQueue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.clearQueue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ClearQueue = function(queueName) { return this.go$val.ClearQueue(queueName); };
	JQuery.Ptr.prototype.SetData = function(key, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.data(go$externalize(key, Go$String), go$externalize(value, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetData = function(key, value) { return this.go$val.SetData(key, value); };
	JQuery.Ptr.prototype.Data = function(key) {
		var _struct, j, result;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		result = j.o.data(go$externalize(key, Go$String));
		if (result === undefined) {
			return null;
		}
		return go$internalize(result, go$emptyInterface);
	};
	JQuery.prototype.Data = function(key) { return this.go$val.Data(key); };
	JQuery.Ptr.prototype.Dequeue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.dequeue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Dequeue = function(queueName) { return this.go$val.Dequeue(queueName); };
	JQuery.Ptr.prototype.RemoveData = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeData(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveData = function(name) { return this.go$val.RemoveData(name); };
	JQuery.Ptr.prototype.OffsetParent = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.offsetParent();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.OffsetParent = function() { return this.go$val.OffsetParent(); };
	JQuery.Ptr.prototype.Parent = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.parent.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Parent = function(i) { return this.go$val.Parent(i); };
	JQuery.Ptr.prototype.Parents = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.parents.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Parents = function(i) { return this.go$val.Parents(i); };
	JQuery.Ptr.prototype.ParentsUntil = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.parentsUntil.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentsUntil = function(i) { return this.go$val.ParentsUntil(i); };
	JQuery.Ptr.prototype.Prev = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prev.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Prev = function(i) { return this.go$val.Prev(i); };
	JQuery.Ptr.prototype.PrevAll = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prevAll.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevAll = function(i) { return this.go$val.PrevAll(i); };
	JQuery.Ptr.prototype.PrevUntil = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.prevUntil.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevUntil = function(i) { return this.go$val.PrevUntil(i); };
	JQuery.Ptr.prototype.Siblings = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.siblings.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Siblings = function(i) { return this.go$val.Siblings(i); };
	JQuery.Ptr.prototype.Slice = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.slice.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Slice = function(i) { return this.go$val.Slice(i); };
	JQuery.Ptr.prototype.Children = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.children(go$externalize(selector, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Children = function(selector) { return this.go$val.Children(selector); };
	JQuery.Ptr.prototype.Unwrap = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.unwrap();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Unwrap = function() { return this.go$val.Unwrap(); };
	JQuery.Ptr.prototype.Wrap = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.wrap(go$externalize(obj, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Wrap = function(obj) { return this.go$val.Wrap(obj); };
	JQuery.Ptr.prototype.WrapAll = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("wrapAll", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.WrapAll = function(i) { return this.go$val.WrapAll(i); };
	JQuery.Ptr.prototype.WrapInner = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.dom1arg("wrapInner", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.WrapInner = function(i) { return this.go$val.WrapInner(i); };
	JQuery.Ptr.prototype.Next = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.next.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Next = function(i) { return this.go$val.Next(i); };
	JQuery.Ptr.prototype.NextAll = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.nextAll.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextAll = function(i) { return this.go$val.NextAll(i); };
	JQuery.Ptr.prototype.NextUntil = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.nextUntil.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextUntil = function(i) { return this.go$val.NextUntil(i); };
	JQuery.Ptr.prototype.Not = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.not.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Not = function(i) { return this.go$val.Not(i); };
	JQuery.Ptr.prototype.Filter = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.filter.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Filter = function(i) { return this.go$val.Filter(i); };
	JQuery.Ptr.prototype.Find = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.find.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Find = function(i) { return this.go$val.Find(i); };
	JQuery.Ptr.prototype.First = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.first();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.First = function() { return this.go$val.First(); };
	JQuery.Ptr.prototype.Has = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.has(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Has = function(selector) { return this.go$val.Has(selector); };
	JQuery.Ptr.prototype.Is = function(i) {
		var _struct, j, obj;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return !!((obj = j.o, obj.is.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	JQuery.prototype.Is = function(i) { return this.go$val.Is(i); };
	JQuery.Ptr.prototype.Last = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.last();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Last = function() { return this.go$val.Last(); };
	JQuery.Ptr.prototype.Ready = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.ready(go$externalize(handler, (go$funcType([], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Ready = function(handler) { return this.go$val.Ready(handler); };
	JQuery.Ptr.prototype.Resize = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.resize.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Resize = function(i) { return this.go$val.Resize(i); };
	JQuery.Ptr.prototype.Scroll = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.handleEvent("scroll", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Scroll = function(i) { return this.go$val.Scroll(i); };
	JQuery.Ptr.prototype.FadeOut = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.fadeOut.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FadeOut = function(i) { return this.go$val.FadeOut(i); };
	JQuery.Ptr.prototype.Select = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.handleEvent("select", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Select = function(i) { return this.go$val.Select(i); };
	JQuery.Ptr.prototype.Submit = function(i) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.handleEvent("submit", i), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Submit = function(i) { return this.go$val.Submit(i); };
	JQuery.Ptr.prototype.handleEvent = function(evt, i) {
		var _struct, j, _ref, x, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i.length;
		if (_ref === 0) {
			j.o = j.o[go$externalize(evt, Go$String)]();
		} else if (_ref === 1) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((function(e) {
				var x;
				(x = ((0 < 0 || 0 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 0]), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
			}), (go$funcType([js.Object], [], false))));
		} else if (_ref === 2) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((x = ((0 < 0 || 0 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 0]), (x !== null && x.constructor === (go$mapType(Go$String, go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$mapType(Go$String, go$emptyInterface))))), (go$mapType(Go$String, go$emptyInterface))), go$externalize((function(e) {
				var x$1;
				(x$1 = ((1 < 0 || 1 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 1]), (x$1 !== null && x$1.constructor === (go$funcType([Event], [], false)) ? x$1.go$val : go$typeAssertionFailed(x$1, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
			}), (go$funcType([js.Object], [], false))));
		} else {
			console.log(evt + " event expects 0 to 2 arguments");
		}
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.handleEvent = function(evt, i) { return this.go$val.handleEvent(evt, i); };
	JQuery.Ptr.prototype.Trigger = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.trigger.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Trigger = function(i) { return this.go$val.Trigger(i); };
	JQuery.Ptr.prototype.On = function(p) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.events("on", p), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.On = function(p) { return this.go$val.On(p); };
	JQuery.Ptr.prototype.One = function(p) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.events("one", p), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.One = function(p) { return this.go$val.One(p); };
	JQuery.Ptr.prototype.Off = function(p) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return (_struct$1 = j.events("off", p), new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Off = function(p) { return this.go$val.Off(p); };
	JQuery.Ptr.prototype.events = function(evt, p) {
		var _struct, j, count, isEventFunc, _ref, _type, x, _ref$1, _struct$1, _struct$2, _struct$3, _struct$4, _struct$5, _struct$6, _struct$7, _struct$8, obj, _struct$9;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		count = p.length;
		isEventFunc = false;
		_ref = (x = p.length - 1 >> 0, ((x < 0 || x >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + x]));
		_type = _ref !== null ? _ref.constructor : null;
		if (_type === (go$funcType([Event], [], false))) {
			isEventFunc = true;
		} else {
			isEventFunc = false;
		}
		_ref$1 = count;
		if (_ref$1 === 0) {
			j.o = j.o[go$externalize(evt, Go$String)]();
			return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
		} else if (_ref$1 === 1) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize(((0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0]), go$emptyInterface));
			return (_struct$2 = j, new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context));
		} else if (_ref$1 === 2) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize(((0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0]), go$emptyInterface), go$externalize((function(e) {
					var x$1;
					(x$1 = ((1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1]), (x$1 !== null && x$1.constructor === (go$funcType([Event], [], false)) ? x$1.go$val : go$typeAssertionFailed(x$1, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize(((0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0]), go$emptyInterface), go$externalize(((1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1]), go$emptyInterface));
				return (_struct$4 = j, new JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length, _struct$4.Context));
			}
		} else if (_ref$1 === 3) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize(((0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0]), go$emptyInterface), go$externalize(((1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1]), go$emptyInterface), go$externalize((function(e) {
					var x$1;
					(x$1 = ((2 < 0 || 2 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 2]), (x$1 !== null && x$1.constructor === (go$funcType([Event], [], false)) ? x$1.go$val : go$typeAssertionFailed(x$1, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$5 = j, new JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length, _struct$5.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize(((0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0]), go$emptyInterface), go$externalize(((1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1]), go$emptyInterface), go$externalize(((2 < 0 || 2 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 2]), go$emptyInterface));
				return (_struct$6 = j, new JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length, _struct$6.Context));
			}
		} else if (_ref$1 === 4) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize(((0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0]), go$emptyInterface), go$externalize(((1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1]), go$emptyInterface), go$externalize(((2 < 0 || 2 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 2]), go$emptyInterface), go$externalize((function(e) {
					var x$1;
					(x$1 = ((3 < 0 || 3 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 3]), (x$1 !== null && x$1.constructor === (go$funcType([Event], [], false)) ? x$1.go$val : go$typeAssertionFailed(x$1, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$7 = j, new JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length, _struct$7.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize(((0 < 0 || 0 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 0]), go$emptyInterface), go$externalize(((1 < 0 || 1 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 1]), go$emptyInterface), go$externalize(((2 < 0 || 2 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 2]), go$emptyInterface), go$externalize(((3 < 0 || 3 >= p.length) ? go$throwRuntimeError("index out of range") : p.array[p.offset + 3]), go$emptyInterface));
				return (_struct$8 = j, new JQuery.Ptr(_struct$8.o, _struct$8.Jquery, _struct$8.Selector, _struct$8.Length, _struct$8.Context));
			}
		} else {
			console.log(evt + " event should no have more than 4 arguments");
			j.o = (obj = j.o, obj[go$externalize(evt, Go$String)].apply(obj, go$externalize(p, (go$sliceType(go$emptyInterface)))));
			return (_struct$9 = j, new JQuery.Ptr(_struct$9.o, _struct$9.Jquery, _struct$9.Selector, _struct$9.Length, _struct$9.Context));
		}
	};
	JQuery.prototype.events = function(evt, p) { return this.go$val.events(evt, p); };
	JQuery.Ptr.prototype.dom2args = function(method, i) {
		var _struct, j, _ref, _tuple, x, _struct$1, selector, selOk, _tuple$1, x$1, _struct$2, context, ctxOk, _struct$3, _struct$4, _struct$5, _struct$6, _tuple$2, x$2, _struct$7, selector$1, selOk$1, _struct$8, _struct$9, _struct$10;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i.length;
		if (_ref === 2) {
			_tuple = (x = ((0 < 0 || 0 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 0]), (x !== null && x.constructor === JQuery ? [x.go$val, true] : [new JQuery.Ptr(), false])); selector = (_struct$1 = _tuple[0], new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context)); selOk = _tuple[1];
			_tuple$1 = (x$1 = ((1 < 0 || 1 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 1]), (x$1 !== null && x$1.constructor === JQuery ? [x$1.go$val, true] : [new JQuery.Ptr(), false])); context = (_struct$2 = _tuple$1[0], new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context)); ctxOk = _tuple$1[1];
			if (!selOk && !ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize(((0 < 0 || 0 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 0]), go$emptyInterface), go$externalize(((1 < 0 || 1 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 1]), go$emptyInterface));
				return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
			} else if (selOk && !ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](selector.o, go$externalize(((1 < 0 || 1 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 1]), go$emptyInterface));
				return (_struct$4 = j, new JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length, _struct$4.Context));
			} else if (!selOk && ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize(((0 < 0 || 0 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 0]), go$emptyInterface), context.o);
				return (_struct$5 = j, new JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length, _struct$5.Context));
			}
			j.o = j.o[go$externalize(method, Go$String)](selector.o, context.o);
			return (_struct$6 = j, new JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length, _struct$6.Context));
		} else if (_ref === 1) {
			_tuple$2 = (x$2 = ((0 < 0 || 0 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 0]), (x$2 !== null && x$2.constructor === JQuery ? [x$2.go$val, true] : [new JQuery.Ptr(), false])); selector$1 = (_struct$7 = _tuple$2[0], new JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length, _struct$7.Context)); selOk$1 = _tuple$2[1];
			if (!selOk$1) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize(((0 < 0 || 0 >= i.length) ? go$throwRuntimeError("index out of range") : i.array[i.offset + 0]), go$emptyInterface));
				return (_struct$8 = j, new JQuery.Ptr(_struct$8.o, _struct$8.Jquery, _struct$8.Selector, _struct$8.Length, _struct$8.Context));
			}
			j.o = j.o[go$externalize(method, Go$String)](selector$1.o);
			return (_struct$9 = j, new JQuery.Ptr(_struct$9.o, _struct$9.Jquery, _struct$9.Selector, _struct$9.Length, _struct$9.Context));
		} else {
			console.log(" only 1 or 2 parameters allowed for method ", method);
			return (_struct$10 = j, new JQuery.Ptr(_struct$10.o, _struct$10.Jquery, _struct$10.Selector, _struct$10.Length, _struct$10.Context));
		}
	};
	JQuery.prototype.dom2args = function(method, i) { return this.go$val.dom2args(method, i); };
	JQuery.Ptr.prototype.dom1arg = function(method, i) {
		var _struct, j, _tuple, _struct$1, selector, selOk, _struct$2, _struct$3;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_tuple = (i !== null && i.constructor === JQuery ? [i.go$val, true] : [new JQuery.Ptr(), false]); selector = (_struct$1 = _tuple[0], new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context)); selOk = _tuple[1];
		if (!selOk) {
			j.o = j.o[go$externalize(method, Go$String)](go$externalize(i, go$emptyInterface));
			return (_struct$2 = j, new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context));
		}
		j.o = j.o[go$externalize(method, Go$String)](selector.o);
		return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
	};
	JQuery.prototype.dom1arg = function(method, i) { return this.go$val.dom1arg(method, i); };
	JQuery.Ptr.prototype.Load = function(i) {
		var _struct, j, obj, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = (obj = j.o, obj.load.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Load = function(i) { return this.go$val.Load(i); };
	JQuery.Ptr.prototype.Serialize = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.serialize(), Go$String);
	};
	JQuery.prototype.Serialize = function() { return this.go$val.Serialize(); };
	JQuery.Ptr.prototype.SerializeArray = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return j.o.serializeArray();
	};
	JQuery.prototype.SerializeArray = function() { return this.go$val.SerializeArray(); };
	Ajax = go$pkg.Ajax = function(options) {
		return new Deferred.Ptr(go$global.jQuery.ajax(go$externalize(options, (go$mapType(Go$String, go$emptyInterface)))));
	};
	AjaxPrefilter = go$pkg.AjaxPrefilter = function(i) {
		var obj;
		(obj = go$global.jQuery, obj.ajaxPrefilter.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
	};
	AjaxSetup = go$pkg.AjaxSetup = function(options) {
		go$global.jQuery.ajaxSetup(go$externalize(options, (go$mapType(Go$String, go$emptyInterface))));
	};
	AjaxTransport = go$pkg.AjaxTransport = function(i) {
		var obj;
		(obj = go$global.jQuery, obj.ajaxTransport.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
	};
	Get = go$pkg.Get = function(i) {
		var obj;
		return new Deferred.Ptr((obj = go$global.jQuery, obj.get.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	Post = go$pkg.Post = function(i) {
		var obj;
		return new Deferred.Ptr((obj = go$global.jQuery, obj.post.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	GetJSON = go$pkg.GetJSON = function(i) {
		var obj;
		return new Deferred.Ptr((obj = go$global.jQuery, obj.getJSON.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	GetScript = go$pkg.GetScript = function(i) {
		var obj;
		return new Deferred.Ptr((obj = go$global.jQuery, obj.getScript.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.Ptr.prototype.Promise = function() {
		var _struct, d;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return d.Object.promise();
	};
	Deferred.prototype.Promise = function() { return this.go$val.Promise(); };
	Deferred.Ptr.prototype.Then = function(fn) {
		var _struct, d, obj;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr((obj = d.Object, obj.then.apply(obj, go$externalize(fn, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.prototype.Then = function(fn) { return this.go$val.Then(fn); };
	Deferred.Ptr.prototype.Always = function(fn) {
		var _struct, d, obj;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr((obj = d.Object, obj.always.apply(obj, go$externalize(fn, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.prototype.Always = function(fn) { return this.go$val.Always(fn); };
	Deferred.Ptr.prototype.Done = function(fn) {
		var _struct, d, obj;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr((obj = d.Object, obj.done.apply(obj, go$externalize(fn, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.prototype.Done = function(fn) { return this.go$val.Done(fn); };
	Deferred.Ptr.prototype.Fail = function(fn) {
		var _struct, d, obj;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr((obj = d.Object, obj.fail.apply(obj, go$externalize(fn, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.prototype.Fail = function(fn) { return this.go$val.Fail(fn); };
	Deferred.Ptr.prototype.Progress = function(fn) {
		var _struct, d;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr(d.Object.progress(go$externalize(fn, go$emptyInterface)));
	};
	Deferred.prototype.Progress = function(fn) { return this.go$val.Progress(fn); };
	When = go$pkg.When = function(d) {
		var obj;
		return new Deferred.Ptr((obj = go$global.jQuery, obj.when.apply(obj, go$externalize(d, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.Ptr.prototype.State = function() {
		var _struct, d;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return go$internalize(d.Object.state(), Go$String);
	};
	Deferred.prototype.State = function() { return this.go$val.State(); };
	NewDeferred = go$pkg.NewDeferred = function() {
		return new Deferred.Ptr(go$global.jQuery.Deferred());
	};
	Deferred.Ptr.prototype.Resolve = function(i) {
		var _struct, d, obj;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr((obj = d.Object, obj.resolve.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.prototype.Resolve = function(i) { return this.go$val.Resolve(i); };
	Deferred.Ptr.prototype.Reject = function(i) {
		var _struct, d, obj;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr((obj = d.Object, obj.reject.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface))))));
	};
	Deferred.prototype.Reject = function(i) { return this.go$val.Reject(i); };
	Deferred.Ptr.prototype.Notify = function(i) {
		var _struct, d;
		d = (_struct = this, new Deferred.Ptr(_struct.Object));
		return new Deferred.Ptr(d.Object.notify(go$externalize(i, go$emptyInterface)));
	};
	Deferred.prototype.Notify = function(i) { return this.go$val.Notify(i); };
	go$pkg.init = function() {
		JQuery.methods = [["Add", "Add", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddBack", "AddBack", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddClass", "AddClass", "", [go$emptyInterface], [JQuery], false, -1], ["After", "After", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Append", "Append", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AppendTo", "AppendTo", "", [go$emptyInterface], [JQuery], false, -1], ["Attr", "Attr", "", [Go$String], [Go$String], false, -1], ["Before", "Before", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Blur", "Blur", "", [], [JQuery], false, -1], ["Children", "Children", "", [go$emptyInterface], [JQuery], false, -1], ["ClearQueue", "ClearQueue", "", [Go$String], [JQuery], false, -1], ["Clone", "Clone", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Closest", "Closest", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Contents", "Contents", "", [], [JQuery], false, -1], ["Css", "Css", "", [Go$String], [Go$String], false, -1], ["CssArray", "CssArray", "", [(go$sliceType(Go$String))], [(go$mapType(Go$String, go$emptyInterface))], true, -1], ["Data", "Data", "", [Go$String], [go$emptyInterface], false, -1], ["Delay", "Delay", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Dequeue", "Dequeue", "", [Go$String], [JQuery], false, -1], ["Detach", "Detach", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Each", "Each", "", [(go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))], [JQuery], false, -1], ["Empty", "Empty", "", [], [JQuery], false, -1], ["End", "End", "", [], [JQuery], false, -1], ["Eq", "Eq", "", [Go$Int], [JQuery], false, -1], ["FadeIn", "FadeIn", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["FadeOut", "FadeOut", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Filter", "Filter", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Find", "Find", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["First", "First", "", [], [JQuery], false, -1], ["Focus", "Focus", "", [], [JQuery], false, -1], ["Get", "Get", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, -1], ["Has", "Has", "", [Go$String], [JQuery], false, -1], ["HasClass", "HasClass", "", [Go$String], [Go$Bool], false, -1], ["Height", "Height", "", [], [Go$Int], false, -1], ["Hide", "Hide", "", [], [JQuery], false, -1], ["Html", "Html", "", [], [Go$String], false, -1], ["InnerHeight", "InnerHeight", "", [], [Go$Int], false, -1], ["InnerWidth", "InnerWidth", "", [], [Go$Int], false, -1], ["InsertAfter", "InsertAfter", "", [go$emptyInterface], [JQuery], false, -1], ["InsertBefore", "InsertBefore", "", [go$emptyInterface], [JQuery], false, -1], ["Is", "Is", "", [(go$sliceType(go$emptyInterface))], [Go$Bool], true, -1], ["Last", "Last", "", [], [JQuery], false, -1], ["Load", "Load", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Next", "Next", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextAll", "NextAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextUntil", "NextUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Not", "Not", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Off", "Off", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Offset", "Offset", "", [], [JQueryCoordinates], false, -1], ["OffsetParent", "OffsetParent", "", [], [JQuery], false, -1], ["On", "On", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["One", "One", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["OuterHeight", "OuterHeight", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["OuterWidth", "OuterWidth", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["Parent", "Parent", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Parents", "Parents", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ParentsUntil", "ParentsUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Position", "Position", "", [], [JQueryCoordinates], false, -1], ["Prepend", "Prepend", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrependTo", "PrependTo", "", [go$emptyInterface], [JQuery], false, -1], ["Prev", "Prev", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevAll", "PrevAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevUntil", "PrevUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Prop", "Prop", "", [Go$String], [go$emptyInterface], false, -1], ["Ready", "Ready", "", [(go$funcType([], [], false))], [JQuery], false, -1], ["Remove", "Remove", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["RemoveAttr", "RemoveAttr", "", [Go$String], [JQuery], false, -1], ["RemoveClass", "RemoveClass", "", [Go$String], [JQuery], false, -1], ["RemoveData", "RemoveData", "", [Go$String], [JQuery], false, -1], ["RemoveProp", "RemoveProp", "", [Go$String], [JQuery], false, -1], ["ReplaceAll", "ReplaceAll", "", [go$emptyInterface], [JQuery], false, -1], ["ReplaceWith", "ReplaceWith", "", [go$emptyInterface], [JQuery], false, -1], ["Resize", "Resize", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Scroll", "Scroll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ScrollLeft", "ScrollLeft", "", [], [Go$Int], false, -1], ["ScrollTop", "ScrollTop", "", [], [Go$Int], false, -1], ["Select", "Select", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Serialize", "Serialize", "", [], [Go$String], false, -1], ["SerializeArray", "SerializeArray", "", [], [js.Object], false, -1], ["SetAttr", "SetAttr", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetCss", "SetCss", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetData", "SetData", "", [Go$String, go$emptyInterface], [JQuery], false, -1], ["SetHeight", "SetHeight", "", [Go$String], [JQuery], false, -1], ["SetHtml", "SetHtml", "", [go$emptyInterface], [JQuery], false, -1], ["SetOffset", "SetOffset", "", [JQueryCoordinates], [JQuery], false, -1], ["SetProp", "SetProp", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetScrollLeft", "SetScrollLeft", "", [Go$Int], [JQuery], false, -1], ["SetScrollTop", "SetScrollTop", "", [Go$Int], [JQuery], false, -1], ["SetText", "SetText", "", [go$emptyInterface], [JQuery], false, -1], ["SetVal", "SetVal", "", [go$emptyInterface], [JQuery], false, -1], ["SetWidth", "SetWidth", "", [go$emptyInterface], [JQuery], false, -1], ["Show", "Show", "", [], [JQuery], false, -1], ["Siblings", "Siblings", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Slice", "Slice", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Stop", "Stop", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Submit", "Submit", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Text", "Text", "", [], [Go$String], false, -1], ["ToArray", "ToArray", "", [], [(go$sliceType(go$emptyInterface))], false, -1], ["Toggle", "Toggle", "", [Go$Bool], [JQuery], false, -1], ["ToggleClass", "ToggleClass", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Trigger", "Trigger", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Underlying", "Underlying", "", [], [js.Object], false, -1], ["Unwrap", "Unwrap", "", [], [JQuery], false, -1], ["Val", "Val", "", [], [Go$String], false, -1], ["Width", "Width", "", [], [Go$Int], false, -1], ["Wrap", "Wrap", "", [go$emptyInterface], [JQuery], false, -1], ["WrapAll", "WrapAll", "", [go$emptyInterface], [JQuery], false, -1], ["WrapInner", "WrapInner", "", [go$emptyInterface], [JQuery], false, -1], ["dom1arg", "dom1arg", "github.com/gopherjs/jquery", [Go$String, go$emptyInterface], [JQuery], false, -1], ["dom2args", "dom2args", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["events", "events", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["handleEvent", "handleEvent", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1]];
		(go$ptrType(JQuery)).methods = [["Add", "Add", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddBack", "AddBack", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddClass", "AddClass", "", [go$emptyInterface], [JQuery], false, -1], ["After", "After", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Append", "Append", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AppendTo", "AppendTo", "", [go$emptyInterface], [JQuery], false, -1], ["Attr", "Attr", "", [Go$String], [Go$String], false, -1], ["Before", "Before", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Blur", "Blur", "", [], [JQuery], false, -1], ["Children", "Children", "", [go$emptyInterface], [JQuery], false, -1], ["ClearQueue", "ClearQueue", "", [Go$String], [JQuery], false, -1], ["Clone", "Clone", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Closest", "Closest", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Contents", "Contents", "", [], [JQuery], false, -1], ["Css", "Css", "", [Go$String], [Go$String], false, -1], ["CssArray", "CssArray", "", [(go$sliceType(Go$String))], [(go$mapType(Go$String, go$emptyInterface))], true, -1], ["Data", "Data", "", [Go$String], [go$emptyInterface], false, -1], ["Delay", "Delay", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Dequeue", "Dequeue", "", [Go$String], [JQuery], false, -1], ["Detach", "Detach", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Each", "Each", "", [(go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))], [JQuery], false, -1], ["Empty", "Empty", "", [], [JQuery], false, -1], ["End", "End", "", [], [JQuery], false, -1], ["Eq", "Eq", "", [Go$Int], [JQuery], false, -1], ["FadeIn", "FadeIn", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["FadeOut", "FadeOut", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Filter", "Filter", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Find", "Find", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["First", "First", "", [], [JQuery], false, -1], ["Focus", "Focus", "", [], [JQuery], false, -1], ["Get", "Get", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, -1], ["Has", "Has", "", [Go$String], [JQuery], false, -1], ["HasClass", "HasClass", "", [Go$String], [Go$Bool], false, -1], ["Height", "Height", "", [], [Go$Int], false, -1], ["Hide", "Hide", "", [], [JQuery], false, -1], ["Html", "Html", "", [], [Go$String], false, -1], ["InnerHeight", "InnerHeight", "", [], [Go$Int], false, -1], ["InnerWidth", "InnerWidth", "", [], [Go$Int], false, -1], ["InsertAfter", "InsertAfter", "", [go$emptyInterface], [JQuery], false, -1], ["InsertBefore", "InsertBefore", "", [go$emptyInterface], [JQuery], false, -1], ["Is", "Is", "", [(go$sliceType(go$emptyInterface))], [Go$Bool], true, -1], ["Last", "Last", "", [], [JQuery], false, -1], ["Load", "Load", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Next", "Next", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextAll", "NextAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextUntil", "NextUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Not", "Not", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Off", "Off", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Offset", "Offset", "", [], [JQueryCoordinates], false, -1], ["OffsetParent", "OffsetParent", "", [], [JQuery], false, -1], ["On", "On", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["One", "One", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["OuterHeight", "OuterHeight", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["OuterWidth", "OuterWidth", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["Parent", "Parent", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Parents", "Parents", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ParentsUntil", "ParentsUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Position", "Position", "", [], [JQueryCoordinates], false, -1], ["Prepend", "Prepend", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrependTo", "PrependTo", "", [go$emptyInterface], [JQuery], false, -1], ["Prev", "Prev", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevAll", "PrevAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevUntil", "PrevUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Prop", "Prop", "", [Go$String], [go$emptyInterface], false, -1], ["Ready", "Ready", "", [(go$funcType([], [], false))], [JQuery], false, -1], ["Remove", "Remove", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["RemoveAttr", "RemoveAttr", "", [Go$String], [JQuery], false, -1], ["RemoveClass", "RemoveClass", "", [Go$String], [JQuery], false, -1], ["RemoveData", "RemoveData", "", [Go$String], [JQuery], false, -1], ["RemoveProp", "RemoveProp", "", [Go$String], [JQuery], false, -1], ["ReplaceAll", "ReplaceAll", "", [go$emptyInterface], [JQuery], false, -1], ["ReplaceWith", "ReplaceWith", "", [go$emptyInterface], [JQuery], false, -1], ["Resize", "Resize", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Scroll", "Scroll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ScrollLeft", "ScrollLeft", "", [], [Go$Int], false, -1], ["ScrollTop", "ScrollTop", "", [], [Go$Int], false, -1], ["Select", "Select", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Serialize", "Serialize", "", [], [Go$String], false, -1], ["SerializeArray", "SerializeArray", "", [], [js.Object], false, -1], ["SetAttr", "SetAttr", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetCss", "SetCss", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetData", "SetData", "", [Go$String, go$emptyInterface], [JQuery], false, -1], ["SetHeight", "SetHeight", "", [Go$String], [JQuery], false, -1], ["SetHtml", "SetHtml", "", [go$emptyInterface], [JQuery], false, -1], ["SetOffset", "SetOffset", "", [JQueryCoordinates], [JQuery], false, -1], ["SetProp", "SetProp", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetScrollLeft", "SetScrollLeft", "", [Go$Int], [JQuery], false, -1], ["SetScrollTop", "SetScrollTop", "", [Go$Int], [JQuery], false, -1], ["SetText", "SetText", "", [go$emptyInterface], [JQuery], false, -1], ["SetVal", "SetVal", "", [go$emptyInterface], [JQuery], false, -1], ["SetWidth", "SetWidth", "", [go$emptyInterface], [JQuery], false, -1], ["Show", "Show", "", [], [JQuery], false, -1], ["Siblings", "Siblings", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Slice", "Slice", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Stop", "Stop", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Submit", "Submit", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Text", "Text", "", [], [Go$String], false, -1], ["ToArray", "ToArray", "", [], [(go$sliceType(go$emptyInterface))], false, -1], ["Toggle", "Toggle", "", [Go$Bool], [JQuery], false, -1], ["ToggleClass", "ToggleClass", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Trigger", "Trigger", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Underlying", "Underlying", "", [], [js.Object], false, -1], ["Unwrap", "Unwrap", "", [], [JQuery], false, -1], ["Val", "Val", "", [], [Go$String], false, -1], ["Width", "Width", "", [], [Go$Int], false, -1], ["Wrap", "Wrap", "", [go$emptyInterface], [JQuery], false, -1], ["WrapAll", "WrapAll", "", [go$emptyInterface], [JQuery], false, -1], ["WrapInner", "WrapInner", "", [go$emptyInterface], [JQuery], false, -1], ["dom1arg", "dom1arg", "github.com/gopherjs/jquery", [Go$String, go$emptyInterface], [JQuery], false, -1], ["dom2args", "dom2args", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["events", "events", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["handleEvent", "handleEvent", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1]];
		JQuery.init([["o", "o", "github.com/gopherjs/jquery", js.Object, ""], ["Jquery", "Jquery", "", Go$String, "js:\"jquery\""], ["Selector", "Selector", "", Go$String, "js:\"selector\""], ["Length", "Length", "", Go$String, "js:\"length\""], ["Context", "Context", "", Go$String, "js:\"context\""]]);
		Event.methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		(go$ptrType(Event)).methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsDefaultPrevented", "IsDefaultPrevented", "", [], [Go$Bool], false, -1], ["IsImmediatePropogationStopped", "IsImmediatePropogationStopped", "", [], [Go$Bool], false, -1], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsPropagationStopped", "IsPropagationStopped", "", [], [Go$Bool], false, -1], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["PreventDefault", "PreventDefault", "", [], [], false, -1], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["StopImmediatePropagation", "StopImmediatePropagation", "", [], [], false, -1], ["StopPropagation", "StopPropagation", "", [], [], false, -1], ["Str", "Str", "", [], [Go$String], false, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		Event.init([["Object", "", "", js.Object, ""], ["KeyCode", "KeyCode", "", Go$Int, "js:\"keyCode\""], ["Target", "Target", "", js.Object, "js:\"target\""], ["CurrentTarget", "CurrentTarget", "", js.Object, "js:\"currentTarget\""], ["DelegateTarget", "DelegateTarget", "", js.Object, "js:\"delegateTarget\""], ["RelatedTarget", "RelatedTarget", "", js.Object, "js:\"relatedTarget\""], ["Data", "Data", "", js.Object, "js:\"data\""], ["Result", "Result", "", js.Object, "js:\"result\""], ["Which", "Which", "", Go$Int, "js:\"which\""], ["Namespace", "Namespace", "", Go$String, "js:\"namespace\""], ["MetaKey", "MetaKey", "", Go$Bool, "js:\"metaKey\""], ["PageX", "PageX", "", Go$Int, "js:\"pageX\""], ["PageY", "PageY", "", Go$Int, "js:\"pageY\""], ["Type", "Type", "", Go$String, "js:\"type\""]]);
		JQueryCoordinates.init([["Left", "Left", "", Go$Int, ""], ["Top", "Top", "", Go$Int, ""]]);
		Deferred.methods = [["Always", "Always", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Done", "Done", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Fail", "Fail", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Notify", "Notify", "", [go$emptyInterface], [Deferred], false, -1], ["Progress", "Progress", "", [go$emptyInterface], [Deferred], false, -1], ["Promise", "Promise", "", [], [js.Object], false, -1], ["Reject", "Reject", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Resolve", "Resolve", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["State", "State", "", [], [Go$String], false, -1], ["Str", "Str", "", [], [Go$String], false, 0], ["Then", "Then", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		(go$ptrType(Deferred)).methods = [["Always", "Always", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Done", "Done", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Fail", "Fail", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Notify", "Notify", "", [go$emptyInterface], [Deferred], false, -1], ["Progress", "Progress", "", [go$emptyInterface], [Deferred], false, -1], ["Promise", "Promise", "", [], [js.Object], false, -1], ["Reject", "Reject", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Resolve", "Resolve", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["State", "State", "", [], [Go$String], false, -1], ["Str", "Str", "", [], [Go$String], false, 0], ["Then", "Then", "", [(go$sliceType(go$emptyInterface))], [Deferred], true, -1], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		Deferred.init([["Object", "", "", js.Object, ""]]);
	}
	return go$pkg;
})();
go$packages["github.com/rusco/qunit"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], QUnitAssert, Test, Ok, Start, AsyncTest, Expect, Module, ModuleLifecycle;
	QUnitAssert = go$pkg.QUnitAssert = go$newType(0, "Struct", "qunit.QUnitAssert", "QUnitAssert", "github.com/rusco/qunit", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	QUnitAssert.Ptr.prototype.DeepEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.deepEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.DeepEqual = function(actual, expected, message) { return this.go$val.DeepEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.Equal = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.equal(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.Equal = function(actual, expected, message) { return this.go$val.Equal(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotDeepEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notDeepEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotDeepEqual = function(actual, expected, message) { return this.go$val.NotDeepEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotEqual = function(actual, expected, message) { return this.go$val.NotEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotPropEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notPropEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotPropEqual = function(actual, expected, message) { return this.go$val.NotPropEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.PropEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.propEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.PropEqual = function(actual, expected, message) { return this.go$val.PropEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotStrictEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notStrictEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotStrictEqual = function(actual, expected, message) { return this.go$val.NotStrictEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.Ok = function(state, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.ok(go$externalize(state, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.Ok = function(state, message) { return this.go$val.Ok(state, message); };
	QUnitAssert.Ptr.prototype.StrictEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.strictEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.StrictEqual = function(actual, expected, message) { return this.go$val.StrictEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.ThrowsExpected = function(block, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.throwsExpected(go$externalize(block, (go$funcType([], [go$emptyInterface], false))), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.ThrowsExpected = function(block, expected, message) { return this.go$val.ThrowsExpected(block, expected, message); };
	QUnitAssert.Ptr.prototype.Throws = function(block, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.throws(go$externalize(block, (go$funcType([], [go$emptyInterface], false))), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.Throws = function(block, message) { return this.go$val.Throws(block, message); };
	Test = go$pkg.Test = function(name, testFn) {
		go$global.QUnit.test(go$externalize(name, Go$String), go$externalize((function(e) {
			testFn(new QUnitAssert.Ptr(e));
		}), (go$funcType([js.Object], [], false))));
	};
	Ok = go$pkg.Ok = function(state, message) {
		return go$global.QUnit.ok(go$externalize(state, go$emptyInterface), go$externalize(message, Go$String));
	};
	Start = go$pkg.Start = function() {
		return go$global.QUnit.start();
	};
	AsyncTest = go$pkg.AsyncTest = function(name, testFn) {
		var t;
		t = go$global.QUnit.asyncTest(go$externalize(name, Go$String), go$externalize((function() {
			testFn();
		}), (go$funcType([], [], false))));
		return t;
	};
	Expect = go$pkg.Expect = function(amount) {
		return go$global.QUnit.expect(amount);
	};
	Module = go$pkg.Module = function(name) {
		return go$global.QUnit.module(go$externalize(name, Go$String));
	};
	ModuleLifecycle = go$pkg.ModuleLifecycle = function(name, lc) {
		var o, _recv, _recv$1, _recv$2, _recv$3;
		o = new (go$global.Object)();
		if (!((_recv = lc, function() { return _recv.Setup(); }) === go$throwNilPointerError)) {
			o.setup = go$externalize((_recv$1 = lc, function() { return _recv$1.Setup(); }), (go$funcType([], [], false)));
		}
		if (!((_recv$2 = lc, function() { return _recv$2.Teardown(); }) === go$throwNilPointerError)) {
			o.teardown = go$externalize((_recv$3 = lc, function() { return _recv$3.Teardown(); }), (go$funcType([], [], false)));
		}
		return go$global.QUnit.module(go$externalize(name, Go$String), o);
	};
	go$pkg.init = function() {
		QUnitAssert.methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["DeepEqual", "DeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Equal", "Equal", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["NotDeepEqual", "NotDeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["NotEqual", "NotEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["NotPropEqual", "NotPropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["NotStrictEqual", "NotStrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Ok", "Ok", "", [go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["PropEqual", "PropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["StrictEqual", "StrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Throws", "Throws", "", [(go$funcType([], [go$emptyInterface], false)), Go$String], [go$emptyInterface], false, -1], ["ThrowsExpected", "ThrowsExpected", "", [(go$funcType([], [go$emptyInterface], false)), go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		(go$ptrType(QUnitAssert)).methods = [["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["DeepEqual", "DeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Equal", "Equal", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["NotDeepEqual", "NotDeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["NotEqual", "NotEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["NotPropEqual", "NotPropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["NotStrictEqual", "NotStrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Ok", "Ok", "", [go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["PropEqual", "PropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["StrictEqual", "StrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Throws", "Throws", "", [(go$funcType([], [go$emptyInterface], false)), Go$String], [go$emptyInterface], false, -1], ["ThrowsExpected", "ThrowsExpected", "", [(go$funcType([], [go$emptyInterface], false)), go$emptyInterface, Go$String], [go$emptyInterface], false, -1], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0]];
		QUnitAssert.init([["Object", "", "", js.Object, ""]]);
	}
	return go$pkg;
})();
go$packages["errors"] = (function() {
	var go$pkg = {}, errorString, New;
	errorString = go$pkg.errorString = go$newType(0, "Struct", "errors.errorString", "errorString", "errors", function(s_) {
		this.go$val = this;
		this.s = s_ !== undefined ? s_ : "";
	});
	New = go$pkg.New = function(text) {
		return new errorString.Ptr(text);
	};
	errorString.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.s;
	};
	errorString.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
		(go$ptrType(errorString)).methods = [["Error", "Error", "", [], [Go$String], false, -1]];
		errorString.init([["s", "s", "errors", Go$String, ""]]);
	}
	return go$pkg;
})();
go$packages["math"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], Ldexp, Float32bits, Float32frombits, math, zero, negInf, nan, pow10tab;
	Ldexp = go$pkg.Ldexp = function(frac, exp$1) {
		if (frac === 0) {
			return frac;
		}
		if (exp$1 >= 1024) {
			return frac * go$parseFloat(math.pow(2, 1023)) * go$parseFloat(math.pow(2, exp$1 - 1023 >> 0));
		}
		if (exp$1 <= -1024) {
			return frac * go$parseFloat(math.pow(2, -1023)) * go$parseFloat(math.pow(2, exp$1 + 1023 >> 0));
		}
		return frac * go$parseFloat(math.pow(2, exp$1));
	};
	Float32bits = go$pkg.Float32bits = function(f) {
		var s, e, r;
		if (go$float32IsEqual(f, 0)) {
			if (go$float32IsEqual(1 / f, negInf)) {
				return 2147483648;
			}
			return 0;
		}
		if (!((go$float32IsEqual(f, f)))) {
			return 2143289344;
		}
		s = 0;
		if (f < 0) {
			s = 2147483648;
			f = -f;
		}
		e = 150;
		while (f >= 1.6777216e+07) {
			f = f / 2;
			if (e === 255) {
				break;
			}
			e = e + 1 >>> 0;
		}
		while (f < 8.388608e+06) {
			e = e - 1 >>> 0;
			if (e === 0) {
				break;
			}
			f = f * 2;
		}
		r = go$parseFloat(go$mod(f, 2));
		if ((r > 0.5 && r < 1) || r >= 1.5) {
			f = f + 1;
		}
		return (((s | (e << 23 >>> 0)) >>> 0) | (((f >> 0) & ~8388608))) >>> 0;
	};
	Float32frombits = go$pkg.Float32frombits = function(b) {
		var s, e, m;
		s = 1;
		if (!((((b & 2147483648) >>> 0) === 0))) {
			s = -1;
		}
		e = (((b >>> 23 >>> 0)) & 255) >>> 0;
		m = (b & 8388607) >>> 0;
		if (e === 255) {
			if (m === 0) {
				return s / 0;
			}
			return nan;
		}
		if (!((e === 0))) {
			m = m + 8388608 >>> 0;
		}
		if (e === 0) {
			e = 1;
		}
		return Ldexp(m, ((e >> 0) - 127 >> 0) - 23 >> 0) * s;
	};
	go$pkg.init = function() {
		pow10tab = go$makeNativeArray("Float64", 70, function() { return 0; });
		math = go$global.Math;
		zero = 0;
		negInf = -1 / zero;
		nan = 0 / zero;
		var i, _q, m;
		Float32bits(0);
		Float32frombits(0);
		pow10tab[0] = 1;
		pow10tab[1] = 10;
		i = 2;
		while (i < 70) {
			m = (_q = i / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			pow10tab[i] = pow10tab[m] * pow10tab[(i - m >> 0)];
			i = i + 1 >> 0;
		}
	}
	return go$pkg;
})();
go$packages["unicode/utf8"] = (function() {
	var go$pkg = {};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["strconv"] = (function() {
	var go$pkg = {}, math = go$packages["math"], errors = go$packages["errors"], utf8 = go$packages["unicode/utf8"], FormatInt, Itoa, formatBits, shifts;
	FormatInt = go$pkg.FormatInt = function(i, base) {
		var _tuple, s;
		_tuple = formatBits((go$sliceType(Go$Uint8)).nil, new Go$Uint64(i.high, i.low), base, (i.high < 0 || (i.high === 0 && i.low < 0)), false); s = _tuple[1];
		return s;
	};
	Itoa = go$pkg.Itoa = function(i) {
		return FormatInt(new Go$Int64(0, i), 10);
	};
	formatBits = function(dst, u, base, neg, append_) {
		var d, s, a, i, q, x, j, q$1, x$1, s$1, b, m, b$1;
		d = (go$sliceType(Go$Uint8)).nil;
		s = "";
		if (base < 2 || base > 36) {
			throw go$panic(new Go$String("strconv: illegal AppendInt/FormatInt base"));
		}
		a = go$makeNativeArray("Uint8", 65, function() { return 0; });
		i = 65;
		if (neg) {
			u = new Go$Uint64(-u.high, -u.low);
		}
		if (base === 10) {
			while ((u.high > 0 || (u.high === 0 && u.low >= 100))) {
				i = i - 2 >> 0;
				q = go$div64(u, new Go$Uint64(0, 100), false);
				j = ((x = go$mul64(q, new Go$Uint64(0, 100)), new Go$Uint64(u.high - x.high, u.low - x.low)).low >>> 0);
				a[(i + 1 >> 0)] = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789".charCodeAt(j);
				a[(i + 0 >> 0)] = "0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999".charCodeAt(j);
				u = q;
			}
			if ((u.high > 0 || (u.high === 0 && u.low >= 10))) {
				i = i - 1 >> 0;
				q$1 = go$div64(u, new Go$Uint64(0, 10), false);
				a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt(((x$1 = go$mul64(q$1, new Go$Uint64(0, 10)), new Go$Uint64(u.high - x$1.high, u.low - x$1.low)).low >>> 0));
				u = q$1;
			}
		} else {
			s$1 = shifts[base];
			if (s$1 > 0) {
				b = new Go$Uint64(0, base);
				m = (b.low >>> 0) - 1 >>> 0;
				while ((u.high > b.high || (u.high === b.high && u.low >= b.low))) {
					i = i - 1 >> 0;
					a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((((u.low >>> 0) & m) >>> 0));
					u = go$shiftRightUint64(u, (s$1));
				}
			} else {
				b$1 = new Go$Uint64(0, base);
				while ((u.high > b$1.high || (u.high === b$1.high && u.low >= b$1.low))) {
					i = i - 1 >> 0;
					a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((go$div64(u, b$1, true).low >>> 0));
					u = go$div64(u, (b$1), false);
				}
			}
		}
		i = i - 1 >> 0;
		a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((u.low >>> 0));
		if (neg) {
			i = i - 1 >> 0;
			a[i] = 45;
		}
		if (append_) {
			d = go$appendSlice(dst, go$subslice(new (go$sliceType(Go$Uint8))(a), i));
			return [d, s];
		}
		s = go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(a), i));
		return [d, s];
	};
	go$pkg.init = function() {
		go$pkg.ErrRange = errors.New("value out of range");
		go$pkg.ErrSyntax = errors.New("invalid syntax");
		shifts = go$toNativeArray("Uint", [0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]);
	}
	return go$pkg;
})();
go$packages["sync/atomic"] = (function() {
	var go$pkg = {}, CompareAndSwapInt32, AddInt32, LoadUint32, StoreUint32;
	CompareAndSwapInt32 = go$pkg.CompareAndSwapInt32 = function(addr, old, new$1) {
		if (addr.go$get() === old) {
			addr.go$set(new$1);
			return true;
		}
		return false;
	};
	AddInt32 = go$pkg.AddInt32 = function(addr, delta) {
		var new$1;
		new$1 = addr.go$get() + delta >> 0;
		addr.go$set(new$1);
		return new$1;
	};
	LoadUint32 = go$pkg.LoadUint32 = function(addr) {
		return addr.go$get();
	};
	StoreUint32 = go$pkg.StoreUint32 = function(addr, val) {
		addr.go$set(val);
	};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["sync"] = (function() {
	var go$pkg = {}, atomic = go$packages["sync/atomic"], Mutex, Once, runtime_Syncsemcheck, runtime_Semacquire, runtime_Semrelease;
	Mutex = go$pkg.Mutex = go$newType(0, "Struct", "sync.Mutex", "Mutex", "sync", function(state_, sema_) {
		this.go$val = this;
		this.state = state_ !== undefined ? state_ : 0;
		this.sema = sema_ !== undefined ? sema_ : 0;
	});
	Once = go$pkg.Once = go$newType(0, "Struct", "sync.Once", "Once", "sync", function(m_, done_) {
		this.go$val = this;
		this.m = m_ !== undefined ? m_ : new Mutex.Ptr();
		this.done = done_ !== undefined ? done_ : 0;
	});
	runtime_Syncsemcheck = function(size) {
	};
	Mutex.Ptr.prototype.Lock = function() {
		var m, v, awoke, old, new$1, v$1, v$2;
		m = this;
		if (atomic.CompareAndSwapInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v) { m.state = v;; }), 0, 1)) {
			return;
		}
		awoke = false;
		while (true) {
			old = m.state;
			new$1 = old | 1;
			if (!(((old & 1) === 0))) {
				new$1 = old + 4 >> 0;
			}
			if (awoke) {
				new$1 = new$1 & ~2;
			}
			if (atomic.CompareAndSwapInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v$1) { m.state = v$1;; }), old, new$1)) {
				if ((old & 1) === 0) {
					break;
				}
				runtime_Semacquire(new (go$ptrType(Go$Uint32))(function() { return m.sema; }, function(v$2) { m.sema = v$2;; }));
				awoke = true;
			}
		}
	};
	Mutex.prototype.Lock = function() { return this.go$val.Lock(); };
	Mutex.Ptr.prototype.Unlock = function() {
		var m, v, new$1, old, v$1, v$2;
		m = this;
		new$1 = atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v) { m.state = v;; }), -1);
		if ((((new$1 + 1 >> 0)) & 1) === 0) {
			throw go$panic(new Go$String("sync: unlock of unlocked mutex"));
		}
		old = new$1;
		while (true) {
			if (((old >> 2 >> 0) === 0) || !(((old & 3) === 0))) {
				return;
			}
			new$1 = ((old - 4 >> 0)) | 2;
			if (atomic.CompareAndSwapInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v$1) { m.state = v$1;; }), old, new$1)) {
				runtime_Semrelease(new (go$ptrType(Go$Uint32))(function() { return m.sema; }, function(v$2) { m.sema = v$2;; }));
				return;
			}
			old = m.state;
		}
	};
	Mutex.prototype.Unlock = function() { return this.go$val.Unlock(); };
	Once.Ptr.prototype.Do = function(f) {
		var o, v, v$1;
		var go$deferred = [];
		try {
			o = this;
			if (atomic.LoadUint32(new (go$ptrType(Go$Uint32))(function() { return o.done; }, function(v) { o.done = v;; })) === 1) {
				return;
			}
			o.m.Lock();
			go$deferred.push({ recv: o.m, method: "Unlock", args: [] });
			if (o.done === 0) {
				f();
				atomic.StoreUint32(new (go$ptrType(Go$Uint32))(function() { return o.done; }, function(v$1) { o.done = v$1;; }), 1);
			}
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	Once.prototype.Do = function(f) { return this.go$val.Do(f); };
	runtime_Semacquire = function() {
		throw go$panic("Native function not implemented: runtime_Semacquire");
	};
	runtime_Semrelease = function() {
		throw go$panic("Native function not implemented: runtime_Semrelease");
	};
	go$pkg.init = function() {
		(go$ptrType(Mutex)).methods = [["Lock", "Lock", "", [], [], false, -1], ["Unlock", "Unlock", "", [], [], false, -1]];
		Mutex.init([["state", "state", "sync", Go$Int32, ""], ["sema", "sema", "sync", Go$Uint32, ""]]);
		(go$ptrType(Once)).methods = [["Do", "Do", "", [(go$funcType([], [], false))], [], false, -1]];
		Once.init([["m", "m", "sync", Mutex, ""], ["done", "done", "sync", Go$Uint32, ""]]);
		var s;
		s = go$makeNativeArray("Uintptr", 3, function() { return 0; });
		runtime_Syncsemcheck(12);
	}
	return go$pkg;
})();
go$packages["io"] = (function() {
	var go$pkg = {}, errors = go$packages["errors"], sync = go$packages["sync"], errWhence, errOffset;
	go$pkg.init = function() {
		go$pkg.ErrShortWrite = errors.New("short write");
		go$pkg.ErrShortBuffer = errors.New("short buffer");
		go$pkg.EOF = errors.New("EOF");
		go$pkg.ErrUnexpectedEOF = errors.New("unexpected EOF");
		go$pkg.ErrNoProgress = errors.New("multiple Read calls return no data or error");
		errWhence = errors.New("Seek: invalid whence");
		errOffset = errors.New("Seek: invalid offset");
		go$pkg.ErrClosedPipe = errors.New("io: read/write on closed pipe");
	}
	return go$pkg;
})();
go$packages["unicode"] = (function() {
	var go$pkg = {};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["strings"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], errors = go$packages["errors"], io = go$packages["io"], utf8 = go$packages["unicode/utf8"], unicode = go$packages["unicode"], Join;
	Join = go$pkg.Join = function(a, sep) {
		var x, x$1, n, i, b, bp, _ref, _i, s;
		if (a.length === 0) {
			return "";
		}
		if (a.length === 1) {
			return ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]);
		}
		n = (x = sep.length, x$1 = (a.length - 1 >> 0), (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0);
		i = 0;
		while (i < a.length) {
			n = n + (((i < 0 || i >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + i]).length) >> 0;
			i = i + 1 >> 0;
		}
		b = (go$sliceType(Go$Uint8)).make(n, 0, function() { return 0; });
		bp = go$copyString(b, ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]));
		_ref = go$subslice(a, 1);
		_i = 0;
		while (_i < _ref.length) {
			s = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]);
			bp = bp + (go$copyString(go$subslice(b, bp), sep)) >> 0;
			bp = bp + (go$copyString(go$subslice(b, bp), s)) >> 0;
			_i++;
		}
		return go$bytesToString(b);
	};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["bytes"] = (function() {
	var go$pkg = {}, errors = go$packages["errors"], io = go$packages["io"], utf8 = go$packages["unicode/utf8"], unicode = go$packages["unicode"];
	go$pkg.init = function() {
		go$pkg.ErrTooLarge = errors.New("bytes.Buffer: too large");
	}
	return go$pkg;
})();
go$packages["unicode/utf16"] = (function() {
	var go$pkg = {}, IsSurrogate, DecodeRune, EncodeRune, Encode, Decode;
	IsSurrogate = go$pkg.IsSurrogate = function(r) {
		return 55296 <= r && r < 57344;
	};
	DecodeRune = go$pkg.DecodeRune = function(r1, r2) {
		if (55296 <= r1 && r1 < 56320 && 56320 <= r2 && r2 < 57344) {
			return ((((r1 - 55296 >> 0)) << 10 >> 0) | ((r2 - 56320 >> 0))) + 65536 >> 0;
		}
		return 65533;
	};
	EncodeRune = go$pkg.EncodeRune = function(r) {
		var r1, r2, _tmp, _tmp$1, _tmp$2, _tmp$3;
		r1 = 0;
		r2 = 0;
		if (r < 65536 || r > 1114111 || IsSurrogate(r)) {
			_tmp = 65533; _tmp$1 = 65533; r1 = _tmp; r2 = _tmp$1;
			return [r1, r2];
		}
		r = r - 65536 >> 0;
		_tmp$2 = 55296 + (((r >> 10 >> 0)) & 1023) >> 0; _tmp$3 = 56320 + (r & 1023) >> 0; r1 = _tmp$2; r2 = _tmp$3;
		return [r1, r2];
	};
	Encode = go$pkg.Encode = function(s) {
		var n, _ref, _i, v, a, _ref$1, _i$1, v$1, _tuple, r1, r2, x;
		n = s.length;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			v = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]);
			if (v >= 65536) {
				n = n + 1 >> 0;
			}
			_i++;
		}
		a = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
		n = 0;
		_ref$1 = s;
		_i$1 = 0;
		while (_i$1 < _ref$1.length) {
			v$1 = ((_i$1 < 0 || _i$1 >= _ref$1.length) ? go$throwRuntimeError("index out of range") : _ref$1.array[_ref$1.offset + _i$1]);
			if (v$1 < 0 || 55296 <= v$1 && v$1 < 57344 || v$1 > 1114111) {
				v$1 = 65533;
				(n < 0 || n >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + n] = (v$1 << 16 >>> 16);
				n = n + 1 >> 0;
			} else if (v$1 < 65536) {
				(n < 0 || n >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + n] = (v$1 << 16 >>> 16);
				n = n + 1 >> 0;
			} else {
				_tuple = EncodeRune(v$1); r1 = _tuple[0]; r2 = _tuple[1];
				(n < 0 || n >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + n] = (r1 << 16 >>> 16);
				(x = n + 1 >> 0, (x < 0 || x >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + x] = (r2 << 16 >>> 16));
				n = n + 2 >> 0;
			}
			_i$1++;
		}
		return go$subslice(a, 0, n);
	};
	Decode = go$pkg.Decode = function(s) {
		var a, n, i, r, x, x$1, x$2;
		a = (go$sliceType(Go$Int32)).make(s.length, 0, function() { return 0; });
		n = 0;
		i = 0;
		while (i < s.length) {
			r = ((i < 0 || i >= s.length) ? go$throwRuntimeError("index out of range") : s.array[s.offset + i]);
			if (55296 <= r && r < 56320 && (i + 1 >> 0) < s.length && 56320 <= (x = i + 1 >> 0, ((x < 0 || x >= s.length) ? go$throwRuntimeError("index out of range") : s.array[s.offset + x])) && (x$1 = i + 1 >> 0, ((x$1 < 0 || x$1 >= s.length) ? go$throwRuntimeError("index out of range") : s.array[s.offset + x$1])) < 57344) {
				(n < 0 || n >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + n] = DecodeRune((r >> 0), ((x$2 = i + 1 >> 0, ((x$2 < 0 || x$2 >= s.length) ? go$throwRuntimeError("index out of range") : s.array[s.offset + x$2])) >> 0));
				i = i + 1 >> 0;
				n = n + 1 >> 0;
			} else if (55296 <= r && r < 57344) {
				(n < 0 || n >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + n] = 65533;
				n = n + 1 >> 0;
			} else {
				(n < 0 || n >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + n] = (r >> 0);
				n = n + 1 >> 0;
			}
			i = i + 1 >> 0;
		}
		return go$subslice(a, 0, n);
	};
	go$pkg.init = function() {
	}
	return go$pkg;
})();
go$packages["syscall"] = (function() {
	var go$pkg = {}, bytes = go$packages["bytes"], sync = go$packages["sync"], atomic = go$packages["sync/atomic"], utf16 = go$packages["unicode/utf16"], errors$1 = go$packages["errors"], DummyError, DLLError, DLL, Proc, LazyDLL, LazyProc, Handle, Errno, Filetime, Systemtime, Timezoneinformation, printWarning, Syscall, Syscall6, Syscall9, Syscall12, Syscall15, getprocaddress, getStdHandle, Getenv, GetTimeZoneInformation, NewLazyDLL, itoa, ByteSliceFromString, BytePtrFromString, UTF16FromString, UTF16ToString, UTF16PtrFromString, langid, FreeLibrary, FormatMessage, RegOpenKeyEx, RegQueryInfoKey, RegEnumKeyEx, RegQueryValueEx, warningPrinted, minusOne, errors, modkernel32, modadvapi32, modshell32, modmswsock, modcrypt32, modws2_32, moddnsapi, modiphlpapi, modsecur32, modnetapi32, moduserenv, procGetLastError, procLoadLibraryW, procFreeLibrary, procGetProcAddress, procGetVersion, procFormatMessageW, procExitProcess, procCreateFileW, procReadFile, procWriteFile, procSetFilePointer, procCloseHandle, procGetStdHandle, procFindFirstFileW, procFindNextFileW, procFindClose, procGetFileInformationByHandle, procGetCurrentDirectoryW, procSetCurrentDirectoryW, procCreateDirectoryW, procRemoveDirectoryW, procDeleteFileW, procMoveFileW, procGetComputerNameW, procSetEndOfFile, procGetSystemTimeAsFileTime, procGetTimeZoneInformation, procCreateIoCompletionPort, procGetQueuedCompletionStatus, procPostQueuedCompletionStatus, procCancelIo, procCancelIoEx, procCreateProcessW, procOpenProcess, procTerminateProcess, procGetExitCodeProcess, procGetStartupInfoW, procGetCurrentProcess, procGetProcessTimes, procDuplicateHandle, procWaitForSingleObject, procGetTempPathW, procCreatePipe, procGetFileType, procCryptAcquireContextW, procCryptReleaseContext, procCryptGenRandom, procGetEnvironmentStringsW, procFreeEnvironmentStringsW, procGetEnvironmentVariableW, procSetEnvironmentVariableW, procSetFileTime, procGetFileAttributesW, procSetFileAttributesW, procGetFileAttributesExW, procGetCommandLineW, procCommandLineToArgvW, procLocalFree, procSetHandleInformation, procFlushFileBuffers, procGetFullPathNameW, procGetLongPathNameW, procGetShortPathNameW, procCreateFileMappingW, procMapViewOfFile, procUnmapViewOfFile, procFlushViewOfFile, procVirtualLock, procVirtualUnlock, procTransmitFile, procReadDirectoryChangesW, procCertOpenSystemStoreW, procCertOpenStore, procCertEnumCertificatesInStore, procCertAddCertificateContextToStore, procCertCloseStore, procCertGetCertificateChain, procCertFreeCertificateChain, procCertCreateCertificateContext, procCertFreeCertificateContext, procCertVerifyCertificateChainPolicy, procRegOpenKeyExW, procRegCloseKey, procRegQueryInfoKeyW, procRegEnumKeyExW, procRegQueryValueExW, procGetCurrentProcessId, procGetConsoleMode, procWriteConsoleW, procReadConsoleW, procWSAStartup, procWSACleanup, procWSAIoctl, procsocket, procsetsockopt, procgetsockopt, procbind, procconnect, procgetsockname, procgetpeername, proclisten, procshutdown, procclosesocket, procAcceptEx, procGetAcceptExSockaddrs, procWSARecv, procWSASend, procWSARecvFrom, procWSASendTo, procgethostbyname, procgetservbyname, procntohs, procgetprotobyname, procDnsQuery_W, procDnsRecordListFree, procGetAddrInfoW, procFreeAddrInfoW, procGetIfEntry, procGetAdaptersInfo, procSetFileCompletionNotificationModes, procWSAEnumProtocolsW, procTranslateNameW, procGetUserNameExW, procNetUserGetInfo, procNetGetJoinInformation, procNetApiBufferFree, procLookupAccountSidW, procLookupAccountNameW, procConvertSidToStringSidW, procConvertStringSidToSidW, procGetLengthSid, procCopySid, procOpenProcessToken, procGetTokenInformation, procGetUserProfileDirectoryW;
	DummyError = go$pkg.DummyError = go$newType(0, "Struct", "syscall.DummyError", "DummyError", "syscall", function() {
		this.go$val = this;
	});
	DLLError = go$pkg.DLLError = go$newType(0, "Struct", "syscall.DLLError", "DLLError", "syscall", function(Err_, ObjName_, Msg_) {
		this.go$val = this;
		this.Err = Err_ !== undefined ? Err_ : null;
		this.ObjName = ObjName_ !== undefined ? ObjName_ : "";
		this.Msg = Msg_ !== undefined ? Msg_ : "";
	});
	DLL = go$pkg.DLL = go$newType(0, "Struct", "syscall.DLL", "DLL", "syscall", function(Name_, Handle_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.Handle = Handle_ !== undefined ? Handle_ : 0;
	});
	Proc = go$pkg.Proc = go$newType(0, "Struct", "syscall.Proc", "Proc", "syscall", function(Dll_, Name_, addr_) {
		this.go$val = this;
		this.Dll = Dll_ !== undefined ? Dll_ : (go$ptrType(DLL)).nil;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.addr = addr_ !== undefined ? addr_ : 0;
	});
	LazyDLL = go$pkg.LazyDLL = go$newType(0, "Struct", "syscall.LazyDLL", "LazyDLL", "syscall", function(mu_, dll_, Name_) {
		this.go$val = this;
		this.mu = mu_ !== undefined ? mu_ : new sync.Mutex.Ptr();
		this.dll = dll_ !== undefined ? dll_ : (go$ptrType(DLL)).nil;
		this.Name = Name_ !== undefined ? Name_ : "";
	});
	LazyProc = go$pkg.LazyProc = go$newType(0, "Struct", "syscall.LazyProc", "LazyProc", "syscall", function(mu_, Name_, l_, proc_) {
		this.go$val = this;
		this.mu = mu_ !== undefined ? mu_ : new sync.Mutex.Ptr();
		this.Name = Name_ !== undefined ? Name_ : "";
		this.l = l_ !== undefined ? l_ : (go$ptrType(LazyDLL)).nil;
		this.proc = proc_ !== undefined ? proc_ : (go$ptrType(Proc)).nil;
	});
	Handle = go$pkg.Handle = go$newType(4, "Uintptr", "syscall.Handle", "Handle", "syscall", null);
	Errno = go$pkg.Errno = go$newType(4, "Uintptr", "syscall.Errno", "Errno", "syscall", null);
	Filetime = go$pkg.Filetime = go$newType(0, "Struct", "syscall.Filetime", "Filetime", "syscall", function(LowDateTime_, HighDateTime_) {
		this.go$val = this;
		this.LowDateTime = LowDateTime_ !== undefined ? LowDateTime_ : 0;
		this.HighDateTime = HighDateTime_ !== undefined ? HighDateTime_ : 0;
	});
	Systemtime = go$pkg.Systemtime = go$newType(0, "Struct", "syscall.Systemtime", "Systemtime", "syscall", function(Year_, Month_, DayOfWeek_, Day_, Hour_, Minute_, Second_, Milliseconds_) {
		this.go$val = this;
		this.Year = Year_ !== undefined ? Year_ : 0;
		this.Month = Month_ !== undefined ? Month_ : 0;
		this.DayOfWeek = DayOfWeek_ !== undefined ? DayOfWeek_ : 0;
		this.Day = Day_ !== undefined ? Day_ : 0;
		this.Hour = Hour_ !== undefined ? Hour_ : 0;
		this.Minute = Minute_ !== undefined ? Minute_ : 0;
		this.Second = Second_ !== undefined ? Second_ : 0;
		this.Milliseconds = Milliseconds_ !== undefined ? Milliseconds_ : 0;
	});
	Timezoneinformation = go$pkg.Timezoneinformation = go$newType(0, "Struct", "syscall.Timezoneinformation", "Timezoneinformation", "syscall", function(Bias_, StandardName_, StandardDate_, StandardBias_, DaylightName_, DaylightDate_, DaylightBias_) {
		this.go$val = this;
		this.Bias = Bias_ !== undefined ? Bias_ : 0;
		this.StandardName = StandardName_ !== undefined ? StandardName_ : go$makeNativeArray("Uint16", 32, function() { return 0; });
		this.StandardDate = StandardDate_ !== undefined ? StandardDate_ : new Systemtime.Ptr();
		this.StandardBias = StandardBias_ !== undefined ? StandardBias_ : 0;
		this.DaylightName = DaylightName_ !== undefined ? DaylightName_ : go$makeNativeArray("Uint16", 32, function() { return 0; });
		this.DaylightDate = DaylightDate_ !== undefined ? DaylightDate_ : new Systemtime.Ptr();
		this.DaylightBias = DaylightBias_ !== undefined ? DaylightBias_ : 0;
	});
	printWarning = function() {
		if (!warningPrinted) {
			console.log("warning: system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md");
		}
		warningPrinted = true;
	};
	Syscall = go$pkg.Syscall = function(trap, nargs, a1, a2, a3) {
		var r1, r2, err, _tmp, _tmp$1, _tmp$2;
		r1 = 0;
		r2 = 0;
		err = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall6 = go$pkg.Syscall6 = function(trap, nargs, a1, a2, a3, a4, a5, a6) {
		var r1, r2, err, _tmp, _tmp$1, _tmp$2;
		r1 = 0;
		r2 = 0;
		err = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall9 = go$pkg.Syscall9 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
		var r1, r2, err, _tmp, _tmp$1, _tmp$2;
		r1 = 0;
		r2 = 0;
		err = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall12 = go$pkg.Syscall12 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12) {
		var r1, r2, err, _tmp, _tmp$1, _tmp$2;
		r1 = 0;
		r2 = 0;
		err = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall15 = go$pkg.Syscall15 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15) {
		var r1, r2, err, _tmp, _tmp$1, _tmp$2;
		r1 = 0;
		r2 = 0;
		err = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	getprocaddress = function(handle, procname) {
		var proc, err, _tmp, _tmp$1;
		proc = 0;
		err = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 536870913; proc = _tmp; err = _tmp$1;
		return [proc, err];
	};
	LazyDLL.Ptr.prototype.Load = function() {
		var d;
		d = this;
		return new DLLError.Ptr(null, "", "system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md");
	};
	LazyDLL.prototype.Load = function() { return this.go$val.Load(); };
	LazyProc.Ptr.prototype.Find = function() {
		var p;
		p = this;
		return new DLLError.Ptr(null, "", "system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md");
	};
	LazyProc.prototype.Find = function() { return this.go$val.Find(); };
	getStdHandle = function(h) {
		var fd;
		fd = 0;
		if (h === -11) {
			fd = 1;
			return fd;
		}
		if (h === -12) {
			fd = 2;
			return fd;
		}
		fd = 0;
		return fd;
	};
	Getenv = go$pkg.Getenv = function(key) {
		var value, found, _tmp, _tmp$1;
		value = "";
		found = false;
		_tmp = ""; _tmp$1 = false; value = _tmp; found = _tmp$1;
		return [value, found];
	};
	GetTimeZoneInformation = go$pkg.GetTimeZoneInformation = function(tzi) {
		var rc, err, _tmp, _tmp$1, x;
		rc = 0;
		err = null;
		_tmp = 0; _tmp$1 = (x = new DummyError.Ptr(), new x.constructor.Struct(x)); rc = _tmp; err = _tmp$1;
		return [rc, err];
	};
	DummyError.Ptr.prototype.Error = function() {
		var _struct, e;
		e = (_struct = this, new DummyError.Ptr());
		return "";
	};
	DummyError.prototype.Error = function() { return this.go$val.Error(); };
	DLLError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.Msg;
	};
	DLLError.prototype.Error = function() { return this.go$val.Error(); };
	DLL.Ptr.prototype.FindProc = function(name) {
		var proc, err, d, _tuple, namep, _tmp, _tmp$1, _tuple$1, a, e, _tmp$2, _tmp$3, p, _tmp$4, _tmp$5;
		proc = (go$ptrType(Proc)).nil;
		err = null;
		d = this;
		_tuple = BytePtrFromString(name); namep = _tuple[0]; err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tmp = (go$ptrType(Proc)).nil; _tmp$1 = err; proc = _tmp; err = _tmp$1;
			return [proc, err];
		}
		_tuple$1 = getprocaddress((d.Handle >>> 0), namep); a = _tuple$1[0]; e = _tuple$1[1];
		if (!((e === 0))) {
			_tmp$2 = (go$ptrType(Proc)).nil; _tmp$3 = new DLLError.Ptr(new Errno(e), name, "Failed to find " + name + " procedure in " + d.Name + ": " + (new Errno(e)).Error()); proc = _tmp$2; err = _tmp$3;
			return [proc, err];
		}
		p = new Proc.Ptr(d, name, a);
		_tmp$4 = p; _tmp$5 = null; proc = _tmp$4; err = _tmp$5;
		return [proc, err];
	};
	DLL.prototype.FindProc = function(name) { return this.go$val.FindProc(name); };
	DLL.Ptr.prototype.MustFindProc = function(name) {
		var d, _tuple, p, e;
		d = this;
		_tuple = d.FindProc(name); p = _tuple[0]; e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			throw go$panic(e);
		}
		return p;
	};
	DLL.prototype.MustFindProc = function(name) { return this.go$val.MustFindProc(name); };
	DLL.Ptr.prototype.Release = function() {
		var err, d;
		err = null;
		d = this;
		err = FreeLibrary(d.Handle);
		return err;
	};
	DLL.prototype.Release = function() { return this.go$val.Release(); };
	Proc.Ptr.prototype.Addr = function() {
		var p;
		p = this;
		return p.addr;
	};
	Proc.prototype.Addr = function() { return this.go$val.Addr(); };
	Proc.Ptr.prototype.Call = function(a) {
		var r1, r2, lastErr, p, _ref, _tuple, _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, _tuple$13, _tuple$14, _tuple$15;
		r1 = 0;
		r2 = 0;
		lastErr = null;
		p = this;
		_ref = a.length;
		if (_ref === 0) {
			_tuple = Syscall(p.Addr(), (a.length >>> 0), 0, 0, 0); r1 = _tuple[0]; r2 = _tuple[1]; lastErr = new Errno(_tuple[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 1) {
			_tuple$1 = Syscall(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), 0, 0); r1 = _tuple$1[0]; r2 = _tuple$1[1]; lastErr = new Errno(_tuple$1[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 2) {
			_tuple$2 = Syscall(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), 0); r1 = _tuple$2[0]; r2 = _tuple$2[1]; lastErr = new Errno(_tuple$2[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 3) {
			_tuple$3 = Syscall(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2])); r1 = _tuple$3[0]; r2 = _tuple$3[1]; lastErr = new Errno(_tuple$3[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 4) {
			_tuple$4 = Syscall6(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), 0, 0); r1 = _tuple$4[0]; r2 = _tuple$4[1]; lastErr = new Errno(_tuple$4[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 5) {
			_tuple$5 = Syscall6(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), 0); r1 = _tuple$5[0]; r2 = _tuple$5[1]; lastErr = new Errno(_tuple$5[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 6) {
			_tuple$6 = Syscall6(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5])); r1 = _tuple$6[0]; r2 = _tuple$6[1]; lastErr = new Errno(_tuple$6[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 7) {
			_tuple$7 = Syscall9(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), 0, 0); r1 = _tuple$7[0]; r2 = _tuple$7[1]; lastErr = new Errno(_tuple$7[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 8) {
			_tuple$8 = Syscall9(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), 0); r1 = _tuple$8[0]; r2 = _tuple$8[1]; lastErr = new Errno(_tuple$8[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 9) {
			_tuple$9 = Syscall9(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), ((8 < 0 || 8 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 8])); r1 = _tuple$9[0]; r2 = _tuple$9[1]; lastErr = new Errno(_tuple$9[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 10) {
			_tuple$10 = Syscall12(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), ((8 < 0 || 8 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 8]), ((9 < 0 || 9 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 9]), 0, 0); r1 = _tuple$10[0]; r2 = _tuple$10[1]; lastErr = new Errno(_tuple$10[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 11) {
			_tuple$11 = Syscall12(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), ((8 < 0 || 8 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 8]), ((9 < 0 || 9 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 9]), ((10 < 0 || 10 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 10]), 0); r1 = _tuple$11[0]; r2 = _tuple$11[1]; lastErr = new Errno(_tuple$11[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 12) {
			_tuple$12 = Syscall12(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), ((8 < 0 || 8 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 8]), ((9 < 0 || 9 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 9]), ((10 < 0 || 10 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 10]), ((11 < 0 || 11 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 11])); r1 = _tuple$12[0]; r2 = _tuple$12[1]; lastErr = new Errno(_tuple$12[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 13) {
			_tuple$13 = Syscall15(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), ((8 < 0 || 8 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 8]), ((9 < 0 || 9 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 9]), ((10 < 0 || 10 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 10]), ((11 < 0 || 11 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 11]), ((12 < 0 || 12 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 12]), 0, 0); r1 = _tuple$13[0]; r2 = _tuple$13[1]; lastErr = new Errno(_tuple$13[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 14) {
			_tuple$14 = Syscall15(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), ((8 < 0 || 8 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 8]), ((9 < 0 || 9 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 9]), ((10 < 0 || 10 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 10]), ((11 < 0 || 11 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 11]), ((12 < 0 || 12 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 12]), ((13 < 0 || 13 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 13]), 0); r1 = _tuple$14[0]; r2 = _tuple$14[1]; lastErr = new Errno(_tuple$14[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 15) {
			_tuple$15 = Syscall15(p.Addr(), (a.length >>> 0), ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]), ((1 < 0 || 1 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 1]), ((2 < 0 || 2 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 2]), ((3 < 0 || 3 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 3]), ((4 < 0 || 4 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 4]), ((5 < 0 || 5 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 5]), ((6 < 0 || 6 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 6]), ((7 < 0 || 7 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 7]), ((8 < 0 || 8 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 8]), ((9 < 0 || 9 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 9]), ((10 < 0 || 10 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 10]), ((11 < 0 || 11 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 11]), ((12 < 0 || 12 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 12]), ((13 < 0 || 13 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 13]), ((14 < 0 || 14 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 14])); r1 = _tuple$15[0]; r2 = _tuple$15[1]; lastErr = new Errno(_tuple$15[2]);
			return [r1, r2, lastErr];
		} else {
			throw go$panic(new Go$String("Call " + p.Name + " with too many arguments " + itoa(a.length) + "."));
		}
		return [r1, r2, lastErr];
	};
	Proc.prototype.Call = function(a) { return this.go$val.Call(a); };
	LazyDLL.Ptr.prototype.mustLoad = function() {
		var d, e;
		d = this;
		e = d.Load();
		if (!(go$interfaceIsEqual(e, null))) {
			throw go$panic(e);
		}
	};
	LazyDLL.prototype.mustLoad = function() { return this.go$val.mustLoad(); };
	LazyDLL.Ptr.prototype.Handle = function() {
		var d;
		d = this;
		d.mustLoad();
		return (d.dll.Handle >>> 0);
	};
	LazyDLL.prototype.Handle = function() { return this.go$val.Handle(); };
	LazyDLL.Ptr.prototype.NewProc = function(name) {
		var d;
		d = this;
		return new LazyProc.Ptr(new sync.Mutex.Ptr(), name, d, (go$ptrType(Proc)).nil);
	};
	LazyDLL.prototype.NewProc = function(name) { return this.go$val.NewProc(name); };
	NewLazyDLL = go$pkg.NewLazyDLL = function(name) {
		return new LazyDLL.Ptr(new sync.Mutex.Ptr(), (go$ptrType(DLL)).nil, name);
	};
	LazyProc.Ptr.prototype.mustFind = function() {
		var p, e;
		p = this;
		e = p.Find();
		if (!(go$interfaceIsEqual(e, null))) {
			throw go$panic(e);
		}
	};
	LazyProc.prototype.mustFind = function() { return this.go$val.mustFind(); };
	LazyProc.Ptr.prototype.Addr = function() {
		var p;
		p = this;
		p.mustFind();
		return p.proc.Addr();
	};
	LazyProc.prototype.Addr = function() { return this.go$val.Addr(); };
	LazyProc.Ptr.prototype.Call = function(a) {
		var r1, r2, lastErr, p, _tuple;
		r1 = 0;
		r2 = 0;
		lastErr = null;
		p = this;
		p.mustFind();
		_tuple = p.proc.Call(a); r1 = _tuple[0]; r2 = _tuple[1]; lastErr = _tuple[2];
		return [r1, r2, lastErr];
	};
	LazyProc.prototype.Call = function(a) { return this.go$val.Call(a); };
	itoa = function(val) {
		var buf, i, _r, _q;
		if (val < 0) {
			return "-" + itoa(-val);
		}
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		i = 31;
		while (val >= 10) {
			buf[i] = (((_r = val % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >> 0) << 24 >>> 24);
			i = i - 1 >> 0;
			val = (_q = val / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		buf[i] = ((val + 48 >> 0) << 24 >>> 24);
		return go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(buf), i));
	};
	ByteSliceFromString = go$pkg.ByteSliceFromString = function(s) {
		var i, a;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === 0) {
				return [(go$sliceType(Go$Uint8)).nil, new Errno(536870951)];
			}
			i = i + 1 >> 0;
		}
		a = (go$sliceType(Go$Uint8)).make((s.length + 1 >> 0), 0, function() { return 0; });
		go$copyString(a, s);
		return [a, null];
	};
	BytePtrFromString = go$pkg.BytePtrFromString = function(s) {
		var _tuple, a, err, v;
		_tuple = ByteSliceFromString(s); a = _tuple[0]; err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [(go$ptrType(Go$Uint8)).nil, err];
		}
		return [new (go$ptrType(Go$Uint8))(function() { return ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]); }, function(v) { (0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0] = v;; }), null];
	};
	UTF16FromString = go$pkg.UTF16FromString = function(s) {
		var i;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === 0) {
				return [(go$sliceType(Go$Uint16)).nil, new Errno(536870951)];
			}
			i = i + 1 >> 0;
		}
		return [utf16.Encode(new (go$sliceType(Go$Int32))(go$stringToRunes(s + "\x00"))), null];
	};
	UTF16ToString = go$pkg.UTF16ToString = function(s) {
		var _ref, _i, v, i;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			v = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]);
			i = _i;
			if (v === 0) {
				s = go$subslice(s, 0, i);
				break;
			}
			_i++;
		}
		return go$runesToString(utf16.Decode(s));
	};
	UTF16PtrFromString = go$pkg.UTF16PtrFromString = function(s) {
		var _tuple, a, err, v;
		_tuple = UTF16FromString(s); a = _tuple[0]; err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [(go$ptrType(Go$Uint16)).nil, err];
		}
		return [new (go$ptrType(Go$Uint16))(function() { return ((0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0]); }, function(v) { (0 < 0 || 0 >= a.length) ? go$throwRuntimeError("index out of range") : a.array[a.offset + 0] = v;; }), null];
	};
	langid = function(pri, sub) {
		return (((sub >>> 0) << 10 >>> 0) | (pri >>> 0)) >>> 0;
	};
	Errno.prototype.Error = function() {
		var e, idx, flags, b, _tuple, n, err, _tuple$1, x, x$1;
		e = this.go$val;
		idx = ((e - 536870912 >>> 0) >> 0);
		if (0 <= idx && idx < 131) {
			return errors[idx];
		}
		flags = 12800;
		b = (go$sliceType(Go$Uint16)).make(300, 0, function() { return 0; });
		_tuple = FormatMessage(flags, 0, (e >>> 0), langid(9, 1), b, (go$ptrType(Go$Uint8)).nil); n = _tuple[0]; err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$1 = FormatMessage(flags, 0, (e >>> 0), 0, b, (go$ptrType(Go$Uint8)).nil); n = _tuple$1[0]; err = _tuple$1[1];
			if (!(go$interfaceIsEqual(err, null))) {
				return "winapi error #" + itoa((e >> 0));
			}
		}
		while (n > 0 && (((x = n - 1 >>> 0, ((x < 0 || x >= b.length) ? go$throwRuntimeError("index out of range") : b.array[b.offset + x])) === 10) || ((x$1 = n - 1 >>> 0, ((x$1 < 0 || x$1 >= b.length) ? go$throwRuntimeError("index out of range") : b.array[b.offset + x$1])) === 13))) {
			n = n - 1 >>> 0;
		}
		return go$runesToString(utf16.Decode(go$subslice(b, 0, n)));
	};
	go$ptrType(Errno).prototype.Error = function() { return new Errno(this.go$get()).Error(); };
	Errno.prototype.Temporary = function() {
		var e;
		e = this.go$val;
		return (e === 536870950) || (e === 536870971) || (new Errno(e)).Timeout();
	};
	go$ptrType(Errno).prototype.Temporary = function() { return new Errno(this.go$get()).Temporary(); };
	Errno.prototype.Timeout = function() {
		var e;
		e = this.go$val;
		return (e === 536870918) || (e === 536871039) || (e === 536871033);
	};
	go$ptrType(Errno).prototype.Timeout = function() { return new Errno(this.go$get()).Timeout(); };
	FreeLibrary = go$pkg.FreeLibrary = function(handle) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procFreeLibrary.Addr(), 1, (handle >>> 0), 0, 0); r1 = _tuple[0]; e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	FormatMessage = go$pkg.FormatMessage = function(flags, msgsrc, msgid, langid$1, buf, args) {
		var n, err, _p0, v, _tuple, r0, e1;
		n = 0;
		err = null;
		_p0 = (go$ptrType(Go$Uint16)).nil;
		if (buf.length > 0) {
			_p0 = new (go$ptrType(Go$Uint16))(function() { return ((0 < 0 || 0 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 0]); }, function(v) { (0 < 0 || 0 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 0] = v;; });
		}
		_tuple = Syscall9(procFormatMessageW.Addr(), 7, (flags >>> 0), (msgsrc >>> 0), (msgid >>> 0), (langid$1 >>> 0), _p0, (buf.length >>> 0), args, 0, 0); r0 = _tuple[0]; e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	RegOpenKeyEx = go$pkg.RegOpenKeyEx = function(key, subkey, options, desiredAccess, result) {
		var regerrno, _tuple, r0;
		regerrno = null;
		_tuple = Syscall6(procRegOpenKeyExW.Addr(), 5, (key >>> 0), subkey, (options >>> 0), (desiredAccess >>> 0), result, 0); r0 = _tuple[0];
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	RegQueryInfoKey = go$pkg.RegQueryInfoKey = function(key, class$1, classLen, reserved, subkeysLen, maxSubkeyLen, maxClassLen, valuesLen, maxValueNameLen, maxValueLen, saLen, lastWriteTime) {
		var regerrno, _tuple, _array, _struct, _view, r0;
		regerrno = null;
		_array = new Uint8Array(8);
		_tuple = Syscall12(procRegQueryInfoKeyW.Addr(), 12, (key >>> 0), class$1, classLen, reserved, subkeysLen, maxSubkeyLen, maxClassLen, valuesLen, maxValueNameLen, maxValueLen, saLen, _array); r0 = _tuple[0];
		_struct = lastWriteTime, _view = new DataView(_array.buffer, _array.byteOffset), _struct.LowDateTime = _view.getUint32(0, true), _struct.HighDateTime = _view.getUint32(4, true);
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	RegEnumKeyEx = go$pkg.RegEnumKeyEx = function(key, index, name, nameLen, reserved, class$1, classLen, lastWriteTime) {
		var regerrno, _tuple, _array, _struct, _view, r0;
		regerrno = null;
		_array = new Uint8Array(8);
		_tuple = Syscall9(procRegEnumKeyExW.Addr(), 8, (key >>> 0), (index >>> 0), name, nameLen, reserved, class$1, classLen, _array, 0); r0 = _tuple[0];
		_struct = lastWriteTime, _view = new DataView(_array.buffer, _array.byteOffset), _struct.LowDateTime = _view.getUint32(0, true), _struct.HighDateTime = _view.getUint32(4, true);
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	RegQueryValueEx = go$pkg.RegQueryValueEx = function(key, name, reserved, valtype, buf, buflen) {
		var regerrno, _tuple, r0;
		regerrno = null;
		_tuple = Syscall6(procRegQueryValueExW.Addr(), 6, (key >>> 0), name, reserved, valtype, buf, buflen); r0 = _tuple[0];
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	Filetime.Ptr.prototype.Nanoseconds = function() {
		var ft, x, x$1, nsec;
		ft = this;
		nsec = (x = go$shiftLeft64(new Go$Int64(0, ft.HighDateTime), 32), x$1 = new Go$Int64(0, ft.LowDateTime), new Go$Int64(x.high + x$1.high, x.low + x$1.low));
		nsec = new Go$Int64(nsec.high - 27111902, nsec.low - 3577643008);
		nsec = go$mul64(nsec, new Go$Int64(0, 100));
		return nsec;
	};
	Filetime.prototype.Nanoseconds = function() { return this.go$val.Nanoseconds(); };
	go$pkg.init = function() {
		DummyError.methods = [["Error", "Error", "", [], [Go$String], false, -1]];
		(go$ptrType(DummyError)).methods = [["Error", "Error", "", [], [Go$String], false, -1]];
		DummyError.init([]);
		(go$ptrType(DLLError)).methods = [["Error", "Error", "", [], [Go$String], false, -1]];
		DLLError.init([["Err", "Err", "", go$error, ""], ["ObjName", "ObjName", "", Go$String, ""], ["Msg", "Msg", "", Go$String, ""]]);
		(go$ptrType(DLL)).methods = [["FindProc", "FindProc", "", [Go$String], [(go$ptrType(Proc)), go$error], false, -1], ["MustFindProc", "MustFindProc", "", [Go$String], [(go$ptrType(Proc))], false, -1], ["Release", "Release", "", [], [go$error], false, -1]];
		DLL.init([["Name", "Name", "", Go$String, ""], ["Handle", "Handle", "", Handle, ""]]);
		(go$ptrType(Proc)).methods = [["Addr", "Addr", "", [], [Go$Uintptr], false, -1], ["Call", "Call", "", [(go$sliceType(Go$Uintptr))], [Go$Uintptr, Go$Uintptr, go$error], true, -1]];
		Proc.init([["Dll", "Dll", "", (go$ptrType(DLL)), ""], ["Name", "Name", "", Go$String, ""], ["addr", "addr", "syscall", Go$Uintptr, ""]]);
		(go$ptrType(LazyDLL)).methods = [["Handle", "Handle", "", [], [Go$Uintptr], false, -1], ["Load", "Load", "", [], [go$error], false, -1], ["NewProc", "NewProc", "", [Go$String], [(go$ptrType(LazyProc))], false, -1], ["mustLoad", "mustLoad", "syscall", [], [], false, -1]];
		LazyDLL.init([["mu", "mu", "syscall", sync.Mutex, ""], ["dll", "dll", "syscall", (go$ptrType(DLL)), ""], ["Name", "Name", "", Go$String, ""]]);
		(go$ptrType(LazyProc)).methods = [["Addr", "Addr", "", [], [Go$Uintptr], false, -1], ["Call", "Call", "", [(go$sliceType(Go$Uintptr))], [Go$Uintptr, Go$Uintptr, go$error], true, -1], ["Find", "Find", "", [], [go$error], false, -1], ["mustFind", "mustFind", "syscall", [], [], false, -1]];
		LazyProc.init([["mu", "mu", "syscall", sync.Mutex, ""], ["Name", "Name", "", Go$String, ""], ["l", "l", "syscall", (go$ptrType(LazyDLL)), ""], ["proc", "proc", "syscall", (go$ptrType(Proc)), ""]]);
		Errno.methods = [["Error", "Error", "", [], [Go$String], false, -1], ["Temporary", "Temporary", "", [], [Go$Bool], false, -1], ["Timeout", "Timeout", "", [], [Go$Bool], false, -1]];
		(go$ptrType(Errno)).methods = [["Error", "Error", "", [], [Go$String], false, -1], ["Temporary", "Temporary", "", [], [Go$Bool], false, -1], ["Timeout", "Timeout", "", [], [Go$Bool], false, -1]];
		(go$ptrType(Filetime)).methods = [["Nanoseconds", "Nanoseconds", "", [], [Go$Int64], false, -1]];
		Filetime.init([["LowDateTime", "LowDateTime", "", Go$Uint32, ""], ["HighDateTime", "HighDateTime", "", Go$Uint32, ""]]);
		Systemtime.init([["Year", "Year", "", Go$Uint16, ""], ["Month", "Month", "", Go$Uint16, ""], ["DayOfWeek", "DayOfWeek", "", Go$Uint16, ""], ["Day", "Day", "", Go$Uint16, ""], ["Hour", "Hour", "", Go$Uint16, ""], ["Minute", "Minute", "", Go$Uint16, ""], ["Second", "Second", "", Go$Uint16, ""], ["Milliseconds", "Milliseconds", "", Go$Uint16, ""]]);
		Timezoneinformation.init([["Bias", "Bias", "", Go$Int32, ""], ["StandardName", "StandardName", "", (go$arrayType(Go$Uint16, 32)), ""], ["StandardDate", "StandardDate", "", Systemtime, ""], ["StandardBias", "StandardBias", "", Go$Int32, ""], ["DaylightName", "DaylightName", "", (go$arrayType(Go$Uint16, 32)), ""], ["DaylightDate", "DaylightDate", "", Systemtime, ""], ["DaylightBias", "DaylightBias", "", Go$Int32, ""]]);
		warningPrinted = false;
		minusOne = -1;
		go$pkg.Stdin = getStdHandle(-10);
		go$pkg.Stdout = getStdHandle(-11);
		go$pkg.Stderr = getStdHandle(-12);
		errors = go$toNativeArray("String", ["argument list too long", "permission denied", "address already in use", "cannot assign requested address", "advertise error", "address family not supported by protocol", "resource temporarily unavailable", "operation already in progress", "invalid exchange", "bad file descriptor", "file descriptor in bad state", "bad message", "invalid request descriptor", "invalid request code", "invalid slot", "bad font file format", "device or resource busy", "operation canceled", "no child processes", "channel number out of range", "communication error on send", "software caused connection abort", "connection refused", "connection reset by peer", "resource deadlock avoided", "resource deadlock avoided", "destination address required", "numerical argument out of domain", "RFS specific error", "disk quota exceeded", "file exists", "bad address", "file too large", "host is down", "no route to host", "identifier removed", "invalid or incomplete multibyte or wide character", "operation now in progress", "interrupted system call", "invalid argument", "input/output error", "transport endpoint is already connected", "is a directory", "is a named type file", "key has expired", "key was rejected by service", "key has been revoked", "level 2 halted", "level 2 not synchronized", "level 3 halted", "level 3 reset", "can not access a needed shared library", "accessing a corrupted shared library", "cannot exec a shared library directly", "attempting to link in too many shared libraries", ".lib section in a.out corrupted", "link number out of range", "too many levels of symbolic links", "wrong medium type", "too many open files", "too many links", "message too long", "multihop attempted", "file name too long", "no XENIX semaphores available", "network is down", "network dropped connection on reset", "network is unreachable", "too many open files in system", "no anode", "no buffer space available", "no CSI structure available", "no data available", "no such device", "exec format error", "required key not available", "no locks available", "link has been severed", "no medium found", "cannot allocate memory", "no message of desired type", "machine is not on the network", "package not installed", "protocol not available", "no space left on device", "out of streams resources", "device not a stream", "function not implemented", "block device required", "transport endpoint is not connected", "directory not empty", "not a XENIX named type file", "state not recoverable", "socket operation on non-socket", "operation not supported", "inappropriate ioctl for device", "name not unique on network", "no such device or address", "operation not supported", "value too large for defined data type", "owner died", "operation not permitted", "protocol family not supported", "broken pipe", "protocol error", "protocol not supported", "protocol wrong type for socket", "numerical result out of range", "remote address changed", "object is remote", "remote I/O error", "interrupted system call should be restarted", "read-only file system", "cannot send after transport endpoint shutdown", "socket type not supported", "illegal seek", "no such process", "srmount error", "stale NFS file handle", "streams pipe error", "timer expired", "connection timed out", "too many references: cannot splice", "text file busy", "structure needs cleaning", "protocol driver not attached", "too many users", "resource temporarily unavailable", "invalid cross-device link", "exchange full", "not supported by windows"]);
		modkernel32 = NewLazyDLL("kernel32.dll");
		modadvapi32 = NewLazyDLL("advapi32.dll");
		modshell32 = NewLazyDLL("shell32.dll");
		modmswsock = NewLazyDLL("mswsock.dll");
		modcrypt32 = NewLazyDLL("crypt32.dll");
		modws2_32 = NewLazyDLL("ws2_32.dll");
		moddnsapi = NewLazyDLL("dnsapi.dll");
		modiphlpapi = NewLazyDLL("iphlpapi.dll");
		modsecur32 = NewLazyDLL("secur32.dll");
		modnetapi32 = NewLazyDLL("netapi32.dll");
		moduserenv = NewLazyDLL("userenv.dll");
		procGetLastError = modkernel32.NewProc("GetLastError");
		procLoadLibraryW = modkernel32.NewProc("LoadLibraryW");
		procFreeLibrary = modkernel32.NewProc("FreeLibrary");
		procGetProcAddress = modkernel32.NewProc("GetProcAddress");
		procGetVersion = modkernel32.NewProc("GetVersion");
		procFormatMessageW = modkernel32.NewProc("FormatMessageW");
		procExitProcess = modkernel32.NewProc("ExitProcess");
		procCreateFileW = modkernel32.NewProc("CreateFileW");
		procReadFile = modkernel32.NewProc("ReadFile");
		procWriteFile = modkernel32.NewProc("WriteFile");
		procSetFilePointer = modkernel32.NewProc("SetFilePointer");
		procCloseHandle = modkernel32.NewProc("CloseHandle");
		procGetStdHandle = modkernel32.NewProc("GetStdHandle");
		procFindFirstFileW = modkernel32.NewProc("FindFirstFileW");
		procFindNextFileW = modkernel32.NewProc("FindNextFileW");
		procFindClose = modkernel32.NewProc("FindClose");
		procGetFileInformationByHandle = modkernel32.NewProc("GetFileInformationByHandle");
		procGetCurrentDirectoryW = modkernel32.NewProc("GetCurrentDirectoryW");
		procSetCurrentDirectoryW = modkernel32.NewProc("SetCurrentDirectoryW");
		procCreateDirectoryW = modkernel32.NewProc("CreateDirectoryW");
		procRemoveDirectoryW = modkernel32.NewProc("RemoveDirectoryW");
		procDeleteFileW = modkernel32.NewProc("DeleteFileW");
		procMoveFileW = modkernel32.NewProc("MoveFileW");
		procGetComputerNameW = modkernel32.NewProc("GetComputerNameW");
		procSetEndOfFile = modkernel32.NewProc("SetEndOfFile");
		procGetSystemTimeAsFileTime = modkernel32.NewProc("GetSystemTimeAsFileTime");
		procGetTimeZoneInformation = modkernel32.NewProc("GetTimeZoneInformation");
		procCreateIoCompletionPort = modkernel32.NewProc("CreateIoCompletionPort");
		procGetQueuedCompletionStatus = modkernel32.NewProc("GetQueuedCompletionStatus");
		procPostQueuedCompletionStatus = modkernel32.NewProc("PostQueuedCompletionStatus");
		procCancelIo = modkernel32.NewProc("CancelIo");
		procCancelIoEx = modkernel32.NewProc("CancelIoEx");
		procCreateProcessW = modkernel32.NewProc("CreateProcessW");
		procOpenProcess = modkernel32.NewProc("OpenProcess");
		procTerminateProcess = modkernel32.NewProc("TerminateProcess");
		procGetExitCodeProcess = modkernel32.NewProc("GetExitCodeProcess");
		procGetStartupInfoW = modkernel32.NewProc("GetStartupInfoW");
		procGetCurrentProcess = modkernel32.NewProc("GetCurrentProcess");
		procGetProcessTimes = modkernel32.NewProc("GetProcessTimes");
		procDuplicateHandle = modkernel32.NewProc("DuplicateHandle");
		procWaitForSingleObject = modkernel32.NewProc("WaitForSingleObject");
		procGetTempPathW = modkernel32.NewProc("GetTempPathW");
		procCreatePipe = modkernel32.NewProc("CreatePipe");
		procGetFileType = modkernel32.NewProc("GetFileType");
		procCryptAcquireContextW = modadvapi32.NewProc("CryptAcquireContextW");
		procCryptReleaseContext = modadvapi32.NewProc("CryptReleaseContext");
		procCryptGenRandom = modadvapi32.NewProc("CryptGenRandom");
		procGetEnvironmentStringsW = modkernel32.NewProc("GetEnvironmentStringsW");
		procFreeEnvironmentStringsW = modkernel32.NewProc("FreeEnvironmentStringsW");
		procGetEnvironmentVariableW = modkernel32.NewProc("GetEnvironmentVariableW");
		procSetEnvironmentVariableW = modkernel32.NewProc("SetEnvironmentVariableW");
		procSetFileTime = modkernel32.NewProc("SetFileTime");
		procGetFileAttributesW = modkernel32.NewProc("GetFileAttributesW");
		procSetFileAttributesW = modkernel32.NewProc("SetFileAttributesW");
		procGetFileAttributesExW = modkernel32.NewProc("GetFileAttributesExW");
		procGetCommandLineW = modkernel32.NewProc("GetCommandLineW");
		procCommandLineToArgvW = modshell32.NewProc("CommandLineToArgvW");
		procLocalFree = modkernel32.NewProc("LocalFree");
		procSetHandleInformation = modkernel32.NewProc("SetHandleInformation");
		procFlushFileBuffers = modkernel32.NewProc("FlushFileBuffers");
		procGetFullPathNameW = modkernel32.NewProc("GetFullPathNameW");
		procGetLongPathNameW = modkernel32.NewProc("GetLongPathNameW");
		procGetShortPathNameW = modkernel32.NewProc("GetShortPathNameW");
		procCreateFileMappingW = modkernel32.NewProc("CreateFileMappingW");
		procMapViewOfFile = modkernel32.NewProc("MapViewOfFile");
		procUnmapViewOfFile = modkernel32.NewProc("UnmapViewOfFile");
		procFlushViewOfFile = modkernel32.NewProc("FlushViewOfFile");
		procVirtualLock = modkernel32.NewProc("VirtualLock");
		procVirtualUnlock = modkernel32.NewProc("VirtualUnlock");
		procTransmitFile = modmswsock.NewProc("TransmitFile");
		procReadDirectoryChangesW = modkernel32.NewProc("ReadDirectoryChangesW");
		procCertOpenSystemStoreW = modcrypt32.NewProc("CertOpenSystemStoreW");
		procCertOpenStore = modcrypt32.NewProc("CertOpenStore");
		procCertEnumCertificatesInStore = modcrypt32.NewProc("CertEnumCertificatesInStore");
		procCertAddCertificateContextToStore = modcrypt32.NewProc("CertAddCertificateContextToStore");
		procCertCloseStore = modcrypt32.NewProc("CertCloseStore");
		procCertGetCertificateChain = modcrypt32.NewProc("CertGetCertificateChain");
		procCertFreeCertificateChain = modcrypt32.NewProc("CertFreeCertificateChain");
		procCertCreateCertificateContext = modcrypt32.NewProc("CertCreateCertificateContext");
		procCertFreeCertificateContext = modcrypt32.NewProc("CertFreeCertificateContext");
		procCertVerifyCertificateChainPolicy = modcrypt32.NewProc("CertVerifyCertificateChainPolicy");
		procRegOpenKeyExW = modadvapi32.NewProc("RegOpenKeyExW");
		procRegCloseKey = modadvapi32.NewProc("RegCloseKey");
		procRegQueryInfoKeyW = modadvapi32.NewProc("RegQueryInfoKeyW");
		procRegEnumKeyExW = modadvapi32.NewProc("RegEnumKeyExW");
		procRegQueryValueExW = modadvapi32.NewProc("RegQueryValueExW");
		procGetCurrentProcessId = modkernel32.NewProc("GetCurrentProcessId");
		procGetConsoleMode = modkernel32.NewProc("GetConsoleMode");
		procWriteConsoleW = modkernel32.NewProc("WriteConsoleW");
		procReadConsoleW = modkernel32.NewProc("ReadConsoleW");
		procWSAStartup = modws2_32.NewProc("WSAStartup");
		procWSACleanup = modws2_32.NewProc("WSACleanup");
		procWSAIoctl = modws2_32.NewProc("WSAIoctl");
		procsocket = modws2_32.NewProc("socket");
		procsetsockopt = modws2_32.NewProc("setsockopt");
		procgetsockopt = modws2_32.NewProc("getsockopt");
		procbind = modws2_32.NewProc("bind");
		procconnect = modws2_32.NewProc("connect");
		procgetsockname = modws2_32.NewProc("getsockname");
		procgetpeername = modws2_32.NewProc("getpeername");
		proclisten = modws2_32.NewProc("listen");
		procshutdown = modws2_32.NewProc("shutdown");
		procclosesocket = modws2_32.NewProc("closesocket");
		procAcceptEx = modmswsock.NewProc("AcceptEx");
		procGetAcceptExSockaddrs = modmswsock.NewProc("GetAcceptExSockaddrs");
		procWSARecv = modws2_32.NewProc("WSARecv");
		procWSASend = modws2_32.NewProc("WSASend");
		procWSARecvFrom = modws2_32.NewProc("WSARecvFrom");
		procWSASendTo = modws2_32.NewProc("WSASendTo");
		procgethostbyname = modws2_32.NewProc("gethostbyname");
		procgetservbyname = modws2_32.NewProc("getservbyname");
		procntohs = modws2_32.NewProc("ntohs");
		procgetprotobyname = modws2_32.NewProc("getprotobyname");
		procDnsQuery_W = moddnsapi.NewProc("DnsQuery_W");
		procDnsRecordListFree = moddnsapi.NewProc("DnsRecordListFree");
		procGetAddrInfoW = modws2_32.NewProc("GetAddrInfoW");
		procFreeAddrInfoW = modws2_32.NewProc("FreeAddrInfoW");
		procGetIfEntry = modiphlpapi.NewProc("GetIfEntry");
		procGetAdaptersInfo = modiphlpapi.NewProc("GetAdaptersInfo");
		procSetFileCompletionNotificationModes = modkernel32.NewProc("SetFileCompletionNotificationModes");
		procWSAEnumProtocolsW = modws2_32.NewProc("WSAEnumProtocolsW");
		procTranslateNameW = modsecur32.NewProc("TranslateNameW");
		procGetUserNameExW = modsecur32.NewProc("GetUserNameExW");
		procNetUserGetInfo = modnetapi32.NewProc("NetUserGetInfo");
		procNetGetJoinInformation = modnetapi32.NewProc("NetGetJoinInformation");
		procNetApiBufferFree = modnetapi32.NewProc("NetApiBufferFree");
		procLookupAccountSidW = modadvapi32.NewProc("LookupAccountSidW");
		procLookupAccountNameW = modadvapi32.NewProc("LookupAccountNameW");
		procConvertSidToStringSidW = modadvapi32.NewProc("ConvertSidToStringSidW");
		procConvertStringSidToSidW = modadvapi32.NewProc("ConvertStringSidToSidW");
		procGetLengthSid = modadvapi32.NewProc("GetLengthSid");
		procCopySid = modadvapi32.NewProc("CopySid");
		procOpenProcessToken = modadvapi32.NewProc("OpenProcessToken");
		procGetTokenInformation = modadvapi32.NewProc("GetTokenInformation");
		procGetUserProfileDirectoryW = moduserenv.NewProc("GetUserProfileDirectoryW");
	}
	return go$pkg;
})();
go$packages["time"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], errors = go$packages["errors"], syscall = go$packages["syscall"], sync = go$packages["sync"], runtime = go$packages["runtime"], ParseError, Time, Month, Weekday, Duration, Location, zone, zoneTrans, abbr, now, startsWithLowerCase, nextStdChunk, match, lookup, appendUint, atoi, formatNano, quote, isDigit, getnum, cutspace, skip, Parse, parse, parseTimeZone, parseGMT, parseNanoseconds, leadingInt, absWeekday, absClock, fmtFrac, fmtInt, absDate, daysIn, Now, isLeap, norm, Date, div, FixedZone, getKeyValue, matchZoneKey, toEnglishName, extractCAPS, abbrev, pseudoUnix, initLocalFromTZI, initLocal, std0x, longDayNames, shortDayNames, shortMonthNames, longMonthNames, atoiError, errBad, errLeadingInt, months, days, daysBefore, utcLoc, localLoc, localOnce, zoneinfo, abbrs, badData;
	ParseError = go$pkg.ParseError = go$newType(0, "Struct", "time.ParseError", "ParseError", "time", function(Layout_, Value_, LayoutElem_, ValueElem_, Message_) {
		this.go$val = this;
		this.Layout = Layout_ !== undefined ? Layout_ : "";
		this.Value = Value_ !== undefined ? Value_ : "";
		this.LayoutElem = LayoutElem_ !== undefined ? LayoutElem_ : "";
		this.ValueElem = ValueElem_ !== undefined ? ValueElem_ : "";
		this.Message = Message_ !== undefined ? Message_ : "";
	});
	Time = go$pkg.Time = go$newType(0, "Struct", "time.Time", "Time", "time", function(sec_, nsec_, loc_) {
		this.go$val = this;
		this.sec = sec_ !== undefined ? sec_ : new Go$Int64(0, 0);
		this.nsec = nsec_ !== undefined ? nsec_ : 0;
		this.loc = loc_ !== undefined ? loc_ : (go$ptrType(Location)).nil;
	});
	Month = go$pkg.Month = go$newType(4, "Int", "time.Month", "Month", "time", null);
	Weekday = go$pkg.Weekday = go$newType(4, "Int", "time.Weekday", "Weekday", "time", null);
	Duration = go$pkg.Duration = go$newType(8, "Int64", "time.Duration", "Duration", "time", null);
	Location = go$pkg.Location = go$newType(0, "Struct", "time.Location", "Location", "time", function(name_, zone_, tx_, cacheStart_, cacheEnd_, cacheZone_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : "";
		this.zone = zone_ !== undefined ? zone_ : (go$sliceType(zone)).nil;
		this.tx = tx_ !== undefined ? tx_ : (go$sliceType(zoneTrans)).nil;
		this.cacheStart = cacheStart_ !== undefined ? cacheStart_ : new Go$Int64(0, 0);
		this.cacheEnd = cacheEnd_ !== undefined ? cacheEnd_ : new Go$Int64(0, 0);
		this.cacheZone = cacheZone_ !== undefined ? cacheZone_ : (go$ptrType(zone)).nil;
	});
	zone = go$pkg.zone = go$newType(0, "Struct", "time.zone", "zone", "time", function(name_, offset_, isDST_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : "";
		this.offset = offset_ !== undefined ? offset_ : 0;
		this.isDST = isDST_ !== undefined ? isDST_ : false;
	});
	zoneTrans = go$pkg.zoneTrans = go$newType(0, "Struct", "time.zoneTrans", "zoneTrans", "time", function(when_, index_, isstd_, isutc_) {
		this.go$val = this;
		this.when = when_ !== undefined ? when_ : new Go$Int64(0, 0);
		this.index = index_ !== undefined ? index_ : 0;
		this.isstd = isstd_ !== undefined ? isstd_ : false;
		this.isutc = isutc_ !== undefined ? isutc_ : false;
	});
	abbr = go$pkg.abbr = go$newType(0, "Struct", "time.abbr", "abbr", "time", function(std_, dst_) {
		this.go$val = this;
		this.std = std_ !== undefined ? std_ : "";
		this.dst = dst_ !== undefined ? dst_ : "";
	});
	now = function() {
		var sec, nsec, msec, _tmp, _tmp$1, x, x$1;
		sec = new Go$Int64(0, 0);
		nsec = 0;
		msec = go$internalize(new (go$global.Date)().getTime(), Go$Int64);
		_tmp = go$div64(msec, new Go$Int64(0, 1000), false); _tmp$1 = (x = ((x$1 = go$div64(msec, new Go$Int64(0, 1000), true), x$1.low + ((x$1.high >> 31) * 4294967296)) >> 0), (((x >>> 16 << 16) * 1000000 >> 0) + (x << 16 >>> 16) * 1000000) >> 0); sec = _tmp; nsec = _tmp$1;
		return [sec, nsec];
	};
	startsWithLowerCase = function(str) {
		var c;
		if (str.length === 0) {
			return false;
		}
		c = str.charCodeAt(0);
		return 97 <= c && c <= 122;
	};
	nextStdChunk = function(layout) {
		var prefix, std, suffix, i, c, _ref, _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tmp$6, _tmp$7, _tmp$8, _tmp$9, _tmp$10, _tmp$11, _tmp$12, _tmp$13, _tmp$14, _tmp$15, _tmp$16, _tmp$17, _tmp$18, _tmp$19, _tmp$20, _tmp$21, _tmp$22, _tmp$23, _tmp$24, _tmp$25, _tmp$26, _tmp$27, _tmp$28, _tmp$29, _tmp$30, _tmp$31, _tmp$32, _tmp$33, _tmp$34, _tmp$35, _tmp$36, _tmp$37, _tmp$38, _tmp$39, _tmp$40, _tmp$41, _tmp$42, _tmp$43, _tmp$44, _tmp$45, _tmp$46, _tmp$47, _tmp$48, _tmp$49, _tmp$50, _tmp$51, _tmp$52, _tmp$53, _tmp$54, _tmp$55, _tmp$56, _tmp$57, _tmp$58, _tmp$59, _tmp$60, _tmp$61, _tmp$62, _tmp$63, _tmp$64, _tmp$65, _tmp$66, _tmp$67, _tmp$68, _tmp$69, _tmp$70, _tmp$71, _tmp$72, _tmp$73, _tmp$74, ch, j, std$1, _tmp$75, _tmp$76, _tmp$77, _tmp$78, _tmp$79, _tmp$80;
		prefix = "";
		std = 0;
		suffix = "";
		i = 0;
		while (i < layout.length) {
			c = (layout.charCodeAt(i) >> 0);
			_ref = c;
			if (_ref === 74) {
				if (layout.length >= (i + 3 >> 0) && layout.substring(i, (i + 3 >> 0)) === "Jan") {
					if (layout.length >= (i + 7 >> 0) && layout.substring(i, (i + 7 >> 0)) === "January") {
						_tmp = layout.substring(0, i); _tmp$1 = 257; _tmp$2 = layout.substring((i + 7 >> 0)); prefix = _tmp; std = _tmp$1; suffix = _tmp$2;
						return [prefix, std, suffix];
					}
					if (!startsWithLowerCase(layout.substring((i + 3 >> 0)))) {
						_tmp$3 = layout.substring(0, i); _tmp$4 = 258; _tmp$5 = layout.substring((i + 3 >> 0)); prefix = _tmp$3; std = _tmp$4; suffix = _tmp$5;
						return [prefix, std, suffix];
					}
				}
			} else if (_ref === 77) {
				if (layout.length >= (i + 3 >> 0)) {
					if (layout.substring(i, (i + 3 >> 0)) === "Mon") {
						if (layout.length >= (i + 6 >> 0) && layout.substring(i, (i + 6 >> 0)) === "Monday") {
							_tmp$6 = layout.substring(0, i); _tmp$7 = 261; _tmp$8 = layout.substring((i + 6 >> 0)); prefix = _tmp$6; std = _tmp$7; suffix = _tmp$8;
							return [prefix, std, suffix];
						}
						if (!startsWithLowerCase(layout.substring((i + 3 >> 0)))) {
							_tmp$9 = layout.substring(0, i); _tmp$10 = 262; _tmp$11 = layout.substring((i + 3 >> 0)); prefix = _tmp$9; std = _tmp$10; suffix = _tmp$11;
							return [prefix, std, suffix];
						}
					}
					if (layout.substring(i, (i + 3 >> 0)) === "MST") {
						_tmp$12 = layout.substring(0, i); _tmp$13 = 21; _tmp$14 = layout.substring((i + 3 >> 0)); prefix = _tmp$12; std = _tmp$13; suffix = _tmp$14;
						return [prefix, std, suffix];
					}
				}
			} else if (_ref === 48) {
				if (layout.length >= (i + 2 >> 0) && 49 <= layout.charCodeAt((i + 1 >> 0)) && layout.charCodeAt((i + 1 >> 0)) <= 54) {
					_tmp$15 = layout.substring(0, i); _tmp$16 = std0x[(layout.charCodeAt((i + 1 >> 0)) - 49 << 24 >>> 24)]; _tmp$17 = layout.substring((i + 2 >> 0)); prefix = _tmp$15; std = _tmp$16; suffix = _tmp$17;
					return [prefix, std, suffix];
				}
			} else if (_ref === 49) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 53)) {
					_tmp$18 = layout.substring(0, i); _tmp$19 = 522; _tmp$20 = layout.substring((i + 2 >> 0)); prefix = _tmp$18; std = _tmp$19; suffix = _tmp$20;
					return [prefix, std, suffix];
				}
				_tmp$21 = layout.substring(0, i); _tmp$22 = 259; _tmp$23 = layout.substring((i + 1 >> 0)); prefix = _tmp$21; std = _tmp$22; suffix = _tmp$23;
				return [prefix, std, suffix];
			} else if (_ref === 50) {
				if (layout.length >= (i + 4 >> 0) && layout.substring(i, (i + 4 >> 0)) === "2006") {
					_tmp$24 = layout.substring(0, i); _tmp$25 = 273; _tmp$26 = layout.substring((i + 4 >> 0)); prefix = _tmp$24; std = _tmp$25; suffix = _tmp$26;
					return [prefix, std, suffix];
				}
				_tmp$27 = layout.substring(0, i); _tmp$28 = 263; _tmp$29 = layout.substring((i + 1 >> 0)); prefix = _tmp$27; std = _tmp$28; suffix = _tmp$29;
				return [prefix, std, suffix];
			} else if (_ref === 95) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 50)) {
					_tmp$30 = layout.substring(0, i); _tmp$31 = 264; _tmp$32 = layout.substring((i + 2 >> 0)); prefix = _tmp$30; std = _tmp$31; suffix = _tmp$32;
					return [prefix, std, suffix];
				}
			} else if (_ref === 51) {
				_tmp$33 = layout.substring(0, i); _tmp$34 = 523; _tmp$35 = layout.substring((i + 1 >> 0)); prefix = _tmp$33; std = _tmp$34; suffix = _tmp$35;
				return [prefix, std, suffix];
			} else if (_ref === 52) {
				_tmp$36 = layout.substring(0, i); _tmp$37 = 525; _tmp$38 = layout.substring((i + 1 >> 0)); prefix = _tmp$36; std = _tmp$37; suffix = _tmp$38;
				return [prefix, std, suffix];
			} else if (_ref === 53) {
				_tmp$39 = layout.substring(0, i); _tmp$40 = 527; _tmp$41 = layout.substring((i + 1 >> 0)); prefix = _tmp$39; std = _tmp$40; suffix = _tmp$41;
				return [prefix, std, suffix];
			} else if (_ref === 80) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 77)) {
					_tmp$42 = layout.substring(0, i); _tmp$43 = 531; _tmp$44 = layout.substring((i + 2 >> 0)); prefix = _tmp$42; std = _tmp$43; suffix = _tmp$44;
					return [prefix, std, suffix];
				}
			} else if (_ref === 112) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 109)) {
					_tmp$45 = layout.substring(0, i); _tmp$46 = 532; _tmp$47 = layout.substring((i + 2 >> 0)); prefix = _tmp$45; std = _tmp$46; suffix = _tmp$47;
					return [prefix, std, suffix];
				}
			} else if (_ref === 45) {
				if (layout.length >= (i + 7 >> 0) && layout.substring(i, (i + 7 >> 0)) === "-070000") {
					_tmp$48 = layout.substring(0, i); _tmp$49 = 27; _tmp$50 = layout.substring((i + 7 >> 0)); prefix = _tmp$48; std = _tmp$49; suffix = _tmp$50;
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 9 >> 0) && layout.substring(i, (i + 9 >> 0)) === "-07:00:00") {
					_tmp$51 = layout.substring(0, i); _tmp$52 = 30; _tmp$53 = layout.substring((i + 9 >> 0)); prefix = _tmp$51; std = _tmp$52; suffix = _tmp$53;
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 5 >> 0) && layout.substring(i, (i + 5 >> 0)) === "-0700") {
					_tmp$54 = layout.substring(0, i); _tmp$55 = 26; _tmp$56 = layout.substring((i + 5 >> 0)); prefix = _tmp$54; std = _tmp$55; suffix = _tmp$56;
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 6 >> 0) && layout.substring(i, (i + 6 >> 0)) === "-07:00") {
					_tmp$57 = layout.substring(0, i); _tmp$58 = 29; _tmp$59 = layout.substring((i + 6 >> 0)); prefix = _tmp$57; std = _tmp$58; suffix = _tmp$59;
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 3 >> 0) && layout.substring(i, (i + 3 >> 0)) === "-07") {
					_tmp$60 = layout.substring(0, i); _tmp$61 = 28; _tmp$62 = layout.substring((i + 3 >> 0)); prefix = _tmp$60; std = _tmp$61; suffix = _tmp$62;
					return [prefix, std, suffix];
				}
			} else if (_ref === 90) {
				if (layout.length >= (i + 7 >> 0) && layout.substring(i, (i + 7 >> 0)) === "Z070000") {
					_tmp$63 = layout.substring(0, i); _tmp$64 = 23; _tmp$65 = layout.substring((i + 7 >> 0)); prefix = _tmp$63; std = _tmp$64; suffix = _tmp$65;
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 9 >> 0) && layout.substring(i, (i + 9 >> 0)) === "Z07:00:00") {
					_tmp$66 = layout.substring(0, i); _tmp$67 = 25; _tmp$68 = layout.substring((i + 9 >> 0)); prefix = _tmp$66; std = _tmp$67; suffix = _tmp$68;
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 5 >> 0) && layout.substring(i, (i + 5 >> 0)) === "Z0700") {
					_tmp$69 = layout.substring(0, i); _tmp$70 = 22; _tmp$71 = layout.substring((i + 5 >> 0)); prefix = _tmp$69; std = _tmp$70; suffix = _tmp$71;
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 6 >> 0) && layout.substring(i, (i + 6 >> 0)) === "Z07:00") {
					_tmp$72 = layout.substring(0, i); _tmp$73 = 24; _tmp$74 = layout.substring((i + 6 >> 0)); prefix = _tmp$72; std = _tmp$73; suffix = _tmp$74;
					return [prefix, std, suffix];
				}
			} else if (_ref === 46) {
				if ((i + 1 >> 0) < layout.length && ((layout.charCodeAt((i + 1 >> 0)) === 48) || (layout.charCodeAt((i + 1 >> 0)) === 57))) {
					ch = layout.charCodeAt((i + 1 >> 0));
					j = i + 1 >> 0;
					while (j < layout.length && (layout.charCodeAt(j) === ch)) {
						j = j + 1 >> 0;
					}
					if (!isDigit(layout, j)) {
						std$1 = 31;
						if (layout.charCodeAt((i + 1 >> 0)) === 57) {
							std$1 = 32;
						}
						std$1 = std$1 | ((((j - ((i + 1 >> 0)) >> 0)) << 16 >> 0));
						_tmp$75 = layout.substring(0, i); _tmp$76 = std$1; _tmp$77 = layout.substring(j); prefix = _tmp$75; std = _tmp$76; suffix = _tmp$77;
						return [prefix, std, suffix];
					}
				}
			}
			i = i + 1 >> 0;
		}
		_tmp$78 = layout; _tmp$79 = 0; _tmp$80 = ""; prefix = _tmp$78; std = _tmp$79; suffix = _tmp$80;
		return [prefix, std, suffix];
	};
	match = function(s1, s2) {
		var i, c1, c2;
		i = 0;
		while (i < s1.length) {
			c1 = s1.charCodeAt(i);
			c2 = s2.charCodeAt(i);
			if (!((c1 === c2))) {
				c1 = (c1 | 32) >>> 0;
				c2 = (c2 | 32) >>> 0;
				if (!((c1 === c2)) || c1 < 97 || c1 > 122) {
					return false;
				}
			}
			i = i + 1 >> 0;
		}
		return true;
	};
	lookup = function(tab, val) {
		var _ref, _i, v, i;
		_ref = tab;
		_i = 0;
		while (_i < _ref.length) {
			v = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]);
			i = _i;
			if (val.length >= v.length && match(val.substring(0, v.length), v)) {
				return [i, val.substring(v.length), null];
			}
			_i++;
		}
		return [-1, val, errBad];
	};
	appendUint = function(b, x, pad) {
		var _q, _r, buf, n, _r$1, _q$1;
		if (x < 10) {
			if (!((pad === 0))) {
				b = go$append(b, pad);
			}
			return go$append(b, ((48 + x >>> 0) << 24 >>> 24));
		}
		if (x < 100) {
			b = go$append(b, ((48 + (_q = x / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero")) >>> 0) << 24 >>> 24));
			b = go$append(b, ((48 + (_r = x % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) >>> 0) << 24 >>> 24));
			return b;
		}
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		n = 32;
		if (x === 0) {
			return go$append(b, 48);
		}
		while (x >= 10) {
			n = n - 1 >> 0;
			buf[n] = (((_r$1 = x % 10, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero")) + 48 >>> 0) << 24 >>> 24);
			x = (_q$1 = x / 10, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >>> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		n = n - 1 >> 0;
		buf[n] = ((x + 48 >>> 0) << 24 >>> 24);
		return go$appendSlice(b, go$subslice(new (go$sliceType(Go$Uint8))(buf), n));
	};
	atoi = function(s) {
		var x, err, neg, _tuple, q, rem, _tmp, _tmp$1, _tmp$2, _tmp$3;
		x = 0;
		err = null;
		neg = false;
		if (!(s === "") && ((s.charCodeAt(0) === 45) || (s.charCodeAt(0) === 43))) {
			neg = s.charCodeAt(0) === 45;
			s = s.substring(1);
		}
		_tuple = leadingInt(s); q = _tuple[0]; rem = _tuple[1]; err = _tuple[2];
		x = ((q.low + ((q.high >> 31) * 4294967296)) >> 0);
		if (!(go$interfaceIsEqual(err, null)) || !(rem === "")) {
			_tmp = 0; _tmp$1 = atoiError; x = _tmp; err = _tmp$1;
			return [x, err];
		}
		if (neg) {
			x = -x;
		}
		_tmp$2 = x; _tmp$3 = null; x = _tmp$2; err = _tmp$3;
		return [x, err];
	};
	formatNano = function(b, nanosec, n, trim) {
		var u, buf, start, _r, _q;
		u = nanosec;
		buf = go$makeNativeArray("Uint8", 9, function() { return 0; });
		start = 9;
		while (start > 0) {
			start = start - 1 >> 0;
			buf[start] = (((_r = u % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >>> 0) << 24 >>> 24);
			u = (_q = u / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		if (n > 9) {
			n = 9;
		}
		if (trim) {
			while (n > 0 && (buf[(n - 1 >> 0)] === 48)) {
				n = n - 1 >> 0;
			}
			if (n === 0) {
				return b;
			}
		}
		b = go$append(b, 46);
		return go$appendSlice(b, go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, n));
	};
	Time.Ptr.prototype.String = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return t.Format("2006-01-02 15:04:05.999999999 -0700 MST");
	};
	Time.prototype.String = function() { return this.go$val.String(); };
	Time.Ptr.prototype.Format = function(layout) {
		var _struct, t, _tuple, name, offset, abs, year, month, day, hour, min, sec, b, buf, max, _tuple$1, prefix, std, suffix, _tuple$2, _tuple$3, _ref, y, _r, y$1, m, s, _r$1, hr, _r$2, hr$1, _q, zone$1, absoffset, _q$1, _r$3, _r$4, _q$2, zone$2, _q$3, _r$5;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.locabs(); name = _tuple[0]; offset = _tuple[1]; abs = _tuple[2];
		year = -1;
		month = 0;
		day = 0;
		hour = -1;
		min = 0;
		sec = 0;
		b = (go$sliceType(Go$Uint8)).nil;
		buf = go$makeNativeArray("Uint8", 64, function() { return 0; });
		max = layout.length + 10 >> 0;
		if (max <= 64) {
			b = go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, 0);
		} else {
			b = (go$sliceType(Go$Uint8)).make(0, max, function() { return 0; });
		}
		while (!(layout === "")) {
			_tuple$1 = nextStdChunk(layout); prefix = _tuple$1[0]; std = _tuple$1[1]; suffix = _tuple$1[2];
			if (!(prefix === "")) {
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(prefix)));
			}
			if (std === 0) {
				break;
			}
			layout = suffix;
			if (year < 0 && !(((std & 256) === 0))) {
				_tuple$2 = absDate(abs, true); year = _tuple$2[0]; month = _tuple$2[1]; day = _tuple$2[2];
			}
			if (hour < 0 && !(((std & 512) === 0))) {
				_tuple$3 = absClock(abs); hour = _tuple$3[0]; min = _tuple$3[1]; sec = _tuple$3[2];
			}
			_ref = std & 65535;
			switch (0) { default: if (_ref === 274) {
				y = year;
				if (y < 0) {
					y = -y;
				}
				b = appendUint(b, ((_r = y % 100, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
			} else if (_ref === 273) {
				y$1 = year;
				if (year <= -1000) {
					b = go$append(b, 45);
					y$1 = -y$1;
				} else if (year <= -100) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("-0")));
					y$1 = -y$1;
				} else if (year <= -10) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("-00")));
					y$1 = -y$1;
				} else if (year < 0) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("-000")));
					y$1 = -y$1;
				} else if (year < 10) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("000")));
				} else if (year < 100) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("00")));
				} else if (year < 1000) {
					b = go$append(b, 48);
				}
				b = appendUint(b, (y$1 >>> 0), 0);
			} else if (_ref === 258) {
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes((new Month(month)).String().substring(0, 3))));
			} else if (_ref === 257) {
				m = (new Month(month)).String();
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(m)));
			} else if (_ref === 259) {
				b = appendUint(b, (month >>> 0), 0);
			} else if (_ref === 260) {
				b = appendUint(b, (month >>> 0), 48);
			} else if (_ref === 262) {
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes((new Weekday(absWeekday(abs))).String().substring(0, 3))));
			} else if (_ref === 261) {
				s = (new Weekday(absWeekday(abs))).String();
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(s)));
			} else if (_ref === 263) {
				b = appendUint(b, (day >>> 0), 0);
			} else if (_ref === 264) {
				b = appendUint(b, (day >>> 0), 32);
			} else if (_ref === 265) {
				b = appendUint(b, (day >>> 0), 48);
			} else if (_ref === 522) {
				b = appendUint(b, (hour >>> 0), 48);
			} else if (_ref === 523) {
				hr = (_r$1 = hour % 12, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero"));
				if (hr === 0) {
					hr = 12;
				}
				b = appendUint(b, (hr >>> 0), 0);
			} else if (_ref === 524) {
				hr$1 = (_r$2 = hour % 12, _r$2 === _r$2 ? _r$2 : go$throwRuntimeError("integer divide by zero"));
				if (hr$1 === 0) {
					hr$1 = 12;
				}
				b = appendUint(b, (hr$1 >>> 0), 48);
			} else if (_ref === 525) {
				b = appendUint(b, (min >>> 0), 0);
			} else if (_ref === 526) {
				b = appendUint(b, (min >>> 0), 48);
			} else if (_ref === 527) {
				b = appendUint(b, (sec >>> 0), 0);
			} else if (_ref === 528) {
				b = appendUint(b, (sec >>> 0), 48);
			} else if (_ref === 531) {
				if (hour >= 12) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("PM")));
				} else {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("AM")));
				}
			} else if (_ref === 532) {
				if (hour >= 12) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("pm")));
				} else {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("am")));
				}
			} else if (_ref === 22 || _ref === 24 || _ref === 23 || _ref === 25 || _ref === 26 || _ref === 29 || _ref === 27 || _ref === 30) {
				if ((offset === 0) && ((std === 22) || (std === 24) || (std === 23) || (std === 25))) {
					b = go$append(b, 90);
					break;
				}
				zone$1 = (_q = offset / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
				absoffset = offset;
				if (zone$1 < 0) {
					b = go$append(b, 45);
					zone$1 = -zone$1;
					absoffset = -absoffset;
				} else {
					b = go$append(b, 43);
				}
				b = appendUint(b, ((_q$1 = zone$1 / 60, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				if ((std === 24) || (std === 29)) {
					b = go$append(b, 58);
				}
				b = appendUint(b, ((_r$3 = zone$1 % 60, _r$3 === _r$3 ? _r$3 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				if ((std === 23) || (std === 27) || (std === 30) || (std === 25)) {
					if ((std === 30) || (std === 25)) {
						b = go$append(b, 58);
					}
					b = appendUint(b, ((_r$4 = absoffset % 60, _r$4 === _r$4 ? _r$4 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				}
			} else if (_ref === 21) {
				if (!(name === "")) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(name)));
					break;
				}
				zone$2 = (_q$2 = offset / 60, (_q$2 === _q$2 && _q$2 !== 1/0 && _q$2 !== -1/0) ? _q$2 >> 0 : go$throwRuntimeError("integer divide by zero"));
				if (zone$2 < 0) {
					b = go$append(b, 45);
					zone$2 = -zone$2;
				} else {
					b = go$append(b, 43);
				}
				b = appendUint(b, ((_q$3 = zone$2 / 60, (_q$3 === _q$3 && _q$3 !== 1/0 && _q$3 !== -1/0) ? _q$3 >> 0 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				b = appendUint(b, ((_r$5 = zone$2 % 60, _r$5 === _r$5 ? _r$5 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
			} else if (_ref === 31 || _ref === 32) {
				b = formatNano(b, (t.Nanosecond() >>> 0), std >> 16 >> 0, (std & 65535) === 32);
			} }
		}
		return go$bytesToString(b);
	};
	Time.prototype.Format = function(layout) { return this.go$val.Format(layout); };
	quote = function(s) {
		return "\"" + s + "\"";
	};
	ParseError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		if (e.Message === "") {
			return "parsing time " + quote(e.Value) + " as " + quote(e.Layout) + ": cannot parse " + quote(e.ValueElem) + " as " + quote(e.LayoutElem);
		}
		return "parsing time " + quote(e.Value) + e.Message;
	};
	ParseError.prototype.Error = function() { return this.go$val.Error(); };
	isDigit = function(s, i) {
		var c;
		if (s.length <= i) {
			return false;
		}
		c = s.charCodeAt(i);
		return 48 <= c && c <= 57;
	};
	getnum = function(s, fixed) {
		var x;
		if (!isDigit(s, 0)) {
			return [0, s, errBad];
		}
		if (!isDigit(s, 1)) {
			if (fixed) {
				return [0, s, errBad];
			}
			return [((s.charCodeAt(0) - 48 << 24 >>> 24) >> 0), s.substring(1), null];
		}
		return [(x = ((s.charCodeAt(0) - 48 << 24 >>> 24) >> 0), (((x >>> 16 << 16) * 10 >> 0) + (x << 16 >>> 16) * 10) >> 0) + ((s.charCodeAt(1) - 48 << 24 >>> 24) >> 0) >> 0, s.substring(2), null];
	};
	cutspace = function(s) {
		while (s.length > 0 && (s.charCodeAt(0) === 32)) {
			s = s.substring(1);
		}
		return s;
	};
	skip = function(value, prefix) {
		while (prefix.length > 0) {
			if (prefix.charCodeAt(0) === 32) {
				if (value.length > 0 && !((value.charCodeAt(0) === 32))) {
					return [value, errBad];
				}
				prefix = cutspace(prefix);
				value = cutspace(value);
				continue;
			}
			if ((value.length === 0) || !((value.charCodeAt(0) === prefix.charCodeAt(0)))) {
				return [value, errBad];
			}
			prefix = prefix.substring(1);
			value = value.substring(1);
		}
		return [value, null];
	};
	Parse = go$pkg.Parse = function(layout, value) {
		return parse(layout, value, go$pkg.UTC, go$pkg.Local);
	};
	parse = function(layout, value, defaultLocation, local) {
		var _tmp, _tmp$1, alayout, avalue, rangeErrString, amSet, pmSet, year, month, day, hour, min, sec, nsec, z, zoneOffset, zoneName, err, _tuple, prefix, std, suffix, stdstr, _tuple$1, p, _ref, _tmp$2, _tmp$3, _tuple$2, _tmp$4, _tmp$5, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, _tuple$13, _tuple$14, n, _tuple$15, _tmp$6, _tmp$7, _ref$1, _tmp$8, _tmp$9, _ref$2, _tmp$10, _tmp$11, _tmp$12, _tmp$13, sign, hour$1, min$1, seconds, _tmp$14, _tmp$15, _tmp$16, _tmp$17, _tmp$18, _tmp$19, _tmp$20, _tmp$21, _tmp$22, _tmp$23, _tmp$24, _tmp$25, _tmp$26, _tmp$27, _tmp$28, _tmp$29, _tmp$30, _tmp$31, _tmp$32, _tmp$33, _tmp$34, _tmp$35, _tmp$36, _tmp$37, _tmp$38, _tmp$39, _tmp$40, _tmp$41, hr, mm, ss, _tuple$16, _tuple$17, _tuple$18, x, _ref$3, _tuple$19, n$1, ok, _tmp$42, _tmp$43, ndigit, _tuple$20, i, _tuple$21, _struct, _struct$1, t, x$1, x$2, _tuple$22, x$3, name, offset, _struct$2, _struct$3, _struct$4, t$1, _tuple$23, x$4, offset$1, ok$1, x$5, x$6, _struct$5, _tuple$24, _struct$6, _struct$7;
		_tmp = layout; _tmp$1 = value; alayout = _tmp; avalue = _tmp$1;
		rangeErrString = "";
		amSet = false;
		pmSet = false;
		year = 0;
		month = 1;
		day = 1;
		hour = 0;
		min = 0;
		sec = 0;
		nsec = 0;
		z = (go$ptrType(Location)).nil;
		zoneOffset = -1;
		zoneName = "";
		while (true) {
			err = null;
			_tuple = nextStdChunk(layout); prefix = _tuple[0]; std = _tuple[1]; suffix = _tuple[2];
			stdstr = layout.substring(prefix.length, (layout.length - suffix.length >> 0));
			_tuple$1 = skip(value, prefix); value = _tuple$1[0]; err = _tuple$1[1];
			if (!(go$interfaceIsEqual(err, null))) {
				return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, prefix, value, "")];
			}
			if (std === 0) {
				if (!((value.length === 0))) {
					return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, "", value, ": extra text: " + value)];
				}
				break;
			}
			layout = suffix;
			p = "";
			_ref = std & 65535;
			switch (0) { default: if (_ref === 274) {
				if (value.length < 2) {
					err = errBad;
					break;
				}
				_tmp$2 = value.substring(0, 2); _tmp$3 = value.substring(2); p = _tmp$2; value = _tmp$3;
				_tuple$2 = atoi(p); year = _tuple$2[0]; err = _tuple$2[1];
				if (year >= 69) {
					year = year + 1900 >> 0;
				} else {
					year = year + 2000 >> 0;
				}
			} else if (_ref === 273) {
				if (value.length < 4 || !isDigit(value, 0)) {
					err = errBad;
					break;
				}
				_tmp$4 = value.substring(0, 4); _tmp$5 = value.substring(4); p = _tmp$4; value = _tmp$5;
				_tuple$3 = atoi(p); year = _tuple$3[0]; err = _tuple$3[1];
			} else if (_ref === 258) {
				_tuple$4 = lookup(shortMonthNames, value); month = _tuple$4[0]; value = _tuple$4[1]; err = _tuple$4[2];
			} else if (_ref === 257) {
				_tuple$5 = lookup(longMonthNames, value); month = _tuple$5[0]; value = _tuple$5[1]; err = _tuple$5[2];
			} else if (_ref === 259 || _ref === 260) {
				_tuple$6 = getnum(value, std === 260); month = _tuple$6[0]; value = _tuple$6[1]; err = _tuple$6[2];
				if (month <= 0 || 12 < month) {
					rangeErrString = "month";
				}
			} else if (_ref === 262) {
				_tuple$7 = lookup(shortDayNames, value); value = _tuple$7[1]; err = _tuple$7[2];
			} else if (_ref === 261) {
				_tuple$8 = lookup(longDayNames, value); value = _tuple$8[1]; err = _tuple$8[2];
			} else if (_ref === 263 || _ref === 264 || _ref === 265) {
				if ((std === 264) && value.length > 0 && (value.charCodeAt(0) === 32)) {
					value = value.substring(1);
				}
				_tuple$9 = getnum(value, std === 265); day = _tuple$9[0]; value = _tuple$9[1]; err = _tuple$9[2];
				if (day < 0 || 31 < day) {
					rangeErrString = "day";
				}
			} else if (_ref === 522) {
				_tuple$10 = getnum(value, false); hour = _tuple$10[0]; value = _tuple$10[1]; err = _tuple$10[2];
				if (hour < 0 || 24 <= hour) {
					rangeErrString = "hour";
				}
			} else if (_ref === 523 || _ref === 524) {
				_tuple$11 = getnum(value, std === 524); hour = _tuple$11[0]; value = _tuple$11[1]; err = _tuple$11[2];
				if (hour < 0 || 12 < hour) {
					rangeErrString = "hour";
				}
			} else if (_ref === 525 || _ref === 526) {
				_tuple$12 = getnum(value, std === 526); min = _tuple$12[0]; value = _tuple$12[1]; err = _tuple$12[2];
				if (min < 0 || 60 <= min) {
					rangeErrString = "minute";
				}
			} else if (_ref === 527 || _ref === 528) {
				_tuple$13 = getnum(value, std === 528); sec = _tuple$13[0]; value = _tuple$13[1]; err = _tuple$13[2];
				if (sec < 0 || 60 <= sec) {
					rangeErrString = "second";
				}
				if (value.length >= 2 && (value.charCodeAt(0) === 46) && isDigit(value, 1)) {
					_tuple$14 = nextStdChunk(layout); std = _tuple$14[1];
					std = std & 65535;
					if ((std === 31) || (std === 32)) {
						break;
					}
					n = 2;
					while (n < value.length && isDigit(value, n)) {
						n = n + 1 >> 0;
					}
					_tuple$15 = parseNanoseconds(value, n); nsec = _tuple$15[0]; rangeErrString = _tuple$15[1]; err = _tuple$15[2];
					value = value.substring(n);
				}
			} else if (_ref === 531) {
				if (value.length < 2) {
					err = errBad;
					break;
				}
				_tmp$6 = value.substring(0, 2); _tmp$7 = value.substring(2); p = _tmp$6; value = _tmp$7;
				_ref$1 = p;
				if (_ref$1 === "PM") {
					pmSet = true;
				} else if (_ref$1 === "AM") {
					amSet = true;
				} else {
					err = errBad;
				}
			} else if (_ref === 532) {
				if (value.length < 2) {
					err = errBad;
					break;
				}
				_tmp$8 = value.substring(0, 2); _tmp$9 = value.substring(2); p = _tmp$8; value = _tmp$9;
				_ref$2 = p;
				if (_ref$2 === "pm") {
					pmSet = true;
				} else if (_ref$2 === "am") {
					amSet = true;
				} else {
					err = errBad;
				}
			} else if (_ref === 22 || _ref === 24 || _ref === 23 || _ref === 25 || _ref === 26 || _ref === 28 || _ref === 29 || _ref === 27 || _ref === 30) {
				if (((std === 22) || (std === 24)) && value.length >= 1 && (value.charCodeAt(0) === 90)) {
					value = value.substring(1);
					z = go$pkg.UTC;
					break;
				}
				_tmp$10 = ""; _tmp$11 = ""; _tmp$12 = ""; _tmp$13 = ""; sign = _tmp$10; hour$1 = _tmp$11; min$1 = _tmp$12; seconds = _tmp$13;
				if ((std === 24) || (std === 29)) {
					if (value.length < 6) {
						err = errBad;
						break;
					}
					if (!((value.charCodeAt(3) === 58))) {
						err = errBad;
						break;
					}
					_tmp$14 = value.substring(0, 1); _tmp$15 = value.substring(1, 3); _tmp$16 = value.substring(4, 6); _tmp$17 = "00"; _tmp$18 = value.substring(6); sign = _tmp$14; hour$1 = _tmp$15; min$1 = _tmp$16; seconds = _tmp$17; value = _tmp$18;
				} else if (std === 28) {
					if (value.length < 3) {
						err = errBad;
						break;
					}
					_tmp$19 = value.substring(0, 1); _tmp$20 = value.substring(1, 3); _tmp$21 = "00"; _tmp$22 = "00"; _tmp$23 = value.substring(3); sign = _tmp$19; hour$1 = _tmp$20; min$1 = _tmp$21; seconds = _tmp$22; value = _tmp$23;
				} else if ((std === 25) || (std === 30)) {
					if (value.length < 9) {
						err = errBad;
						break;
					}
					if (!((value.charCodeAt(3) === 58)) || !((value.charCodeAt(6) === 58))) {
						err = errBad;
						break;
					}
					_tmp$24 = value.substring(0, 1); _tmp$25 = value.substring(1, 3); _tmp$26 = value.substring(4, 6); _tmp$27 = value.substring(7, 9); _tmp$28 = value.substring(9); sign = _tmp$24; hour$1 = _tmp$25; min$1 = _tmp$26; seconds = _tmp$27; value = _tmp$28;
				} else if ((std === 23) || (std === 27)) {
					if (value.length < 7) {
						err = errBad;
						break;
					}
					_tmp$29 = value.substring(0, 1); _tmp$30 = value.substring(1, 3); _tmp$31 = value.substring(3, 5); _tmp$32 = value.substring(5, 7); _tmp$33 = value.substring(7); sign = _tmp$29; hour$1 = _tmp$30; min$1 = _tmp$31; seconds = _tmp$32; value = _tmp$33;
				} else {
					if (value.length < 5) {
						err = errBad;
						break;
					}
					_tmp$34 = value.substring(0, 1); _tmp$35 = value.substring(1, 3); _tmp$36 = value.substring(3, 5); _tmp$37 = "00"; _tmp$38 = value.substring(5); sign = _tmp$34; hour$1 = _tmp$35; min$1 = _tmp$36; seconds = _tmp$37; value = _tmp$38;
				}
				_tmp$39 = 0; _tmp$40 = 0; _tmp$41 = 0; hr = _tmp$39; mm = _tmp$40; ss = _tmp$41;
				_tuple$16 = atoi(hour$1); hr = _tuple$16[0]; err = _tuple$16[1];
				if (go$interfaceIsEqual(err, null)) {
					_tuple$17 = atoi(min$1); mm = _tuple$17[0]; err = _tuple$17[1];
				}
				if (go$interfaceIsEqual(err, null)) {
					_tuple$18 = atoi(seconds); ss = _tuple$18[0]; err = _tuple$18[1];
				}
				zoneOffset = (x = (((((hr >>> 16 << 16) * 60 >> 0) + (hr << 16 >>> 16) * 60) >> 0) + mm >> 0), (((x >>> 16 << 16) * 60 >> 0) + (x << 16 >>> 16) * 60) >> 0) + ss >> 0;
				_ref$3 = sign.charCodeAt(0);
				if (_ref$3 === 43) {
				} else if (_ref$3 === 45) {
					zoneOffset = -zoneOffset;
				} else {
					err = errBad;
				}
			} else if (_ref === 21) {
				if (value.length >= 3 && value.substring(0, 3) === "UTC") {
					z = go$pkg.UTC;
					value = value.substring(3);
					break;
				}
				_tuple$19 = parseTimeZone(value); n$1 = _tuple$19[0]; ok = _tuple$19[1];
				if (!ok) {
					err = errBad;
					break;
				}
				_tmp$42 = value.substring(0, n$1); _tmp$43 = value.substring(n$1); zoneName = _tmp$42; value = _tmp$43;
			} else if (_ref === 31) {
				ndigit = 1 + ((std >> 16 >> 0)) >> 0;
				if (value.length < ndigit) {
					err = errBad;
					break;
				}
				_tuple$20 = parseNanoseconds(value, ndigit); nsec = _tuple$20[0]; rangeErrString = _tuple$20[1]; err = _tuple$20[2];
				value = value.substring(ndigit);
			} else if (_ref === 32) {
				if (value.length < 2 || !((value.charCodeAt(0) === 46)) || value.charCodeAt(1) < 48 || 57 < value.charCodeAt(1)) {
					break;
				}
				i = 0;
				while (i < 9 && (i + 1 >> 0) < value.length && 48 <= value.charCodeAt((i + 1 >> 0)) && value.charCodeAt((i + 1 >> 0)) <= 57) {
					i = i + 1 >> 0;
				}
				_tuple$21 = parseNanoseconds(value, 1 + i >> 0); nsec = _tuple$21[0]; rangeErrString = _tuple$21[1]; err = _tuple$21[2];
				value = value.substring((1 + i >> 0));
			} }
			if (!(rangeErrString === "")) {
				return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, stdstr, value, ": " + rangeErrString + " out of range")];
			}
			if (!(go$interfaceIsEqual(err, null))) {
				return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, stdstr, value, "")];
			}
		}
		if (pmSet && hour < 12) {
			hour = hour + 12 >> 0;
		} else if (amSet && (hour === 12)) {
			hour = 0;
		}
		if (!(z === (go$ptrType(Location)).nil)) {
			return [(_struct = Date(year, (month >> 0), day, hour, min, sec, nsec, z), new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc)), null];
		}
		if (!((zoneOffset === -1))) {
			t = (_struct$1 = Date(year, (month >> 0), day, hour, min, sec, nsec, go$pkg.UTC), new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
			t.sec = (x$1 = t.sec, x$2 = new Go$Int64(0, zoneOffset), new Go$Int64(x$1.high - x$2.high, x$1.low - x$2.low));
			_tuple$22 = local.lookup((x$3 = t.sec, new Go$Int64(x$3.high + -15, x$3.low + 2288912640))); name = _tuple$22[0]; offset = _tuple$22[1];
			if ((offset === zoneOffset) && (zoneName === "" || name === zoneName)) {
				t.loc = local;
				return [(_struct$2 = t, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)), null];
			}
			t.loc = FixedZone(zoneName, zoneOffset);
			return [(_struct$3 = t, new Time.Ptr(_struct$3.sec, _struct$3.nsec, _struct$3.loc)), null];
		}
		if (!(zoneName === "")) {
			t$1 = (_struct$4 = Date(year, (month >> 0), day, hour, min, sec, nsec, go$pkg.UTC), new Time.Ptr(_struct$4.sec, _struct$4.nsec, _struct$4.loc));
			_tuple$23 = local.lookupName(zoneName, (x$4 = t$1.sec, new Go$Int64(x$4.high + -15, x$4.low + 2288912640))); offset$1 = _tuple$23[0]; ok$1 = _tuple$23[2];
			if (ok$1) {
				t$1.sec = (x$5 = t$1.sec, x$6 = new Go$Int64(0, offset$1), new Go$Int64(x$5.high - x$6.high, x$5.low - x$6.low));
				t$1.loc = local;
				return [(_struct$5 = t$1, new Time.Ptr(_struct$5.sec, _struct$5.nsec, _struct$5.loc)), null];
			}
			if (zoneName.length > 3 && zoneName.substring(0, 3) === "GMT") {
				_tuple$24 = atoi(zoneName.substring(3)); offset$1 = _tuple$24[0];
				offset$1 = (((offset$1 >>> 16 << 16) * 3600 >> 0) + (offset$1 << 16 >>> 16) * 3600) >> 0;
			}
			t$1.loc = FixedZone(zoneName, offset$1);
			return [(_struct$6 = t$1, new Time.Ptr(_struct$6.sec, _struct$6.nsec, _struct$6.loc)), null];
		}
		return [(_struct$7 = Date(year, (month >> 0), day, hour, min, sec, nsec, defaultLocation), new Time.Ptr(_struct$7.sec, _struct$7.nsec, _struct$7.loc)), null];
	};
	parseTimeZone = function(value) {
		var length, ok, _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, nUpper, c, _ref, _tmp$6, _tmp$7, _tmp$8, _tmp$9, _tmp$10, _tmp$11, _tmp$12, _tmp$13, _tmp$14, _tmp$15;
		length = 0;
		ok = false;
		if (value.length < 3) {
			_tmp = 0; _tmp$1 = false; length = _tmp; ok = _tmp$1;
			return [length, ok];
		}
		if (value.length >= 4 && value.substring(0, 4) === "ChST") {
			_tmp$2 = 4; _tmp$3 = true; length = _tmp$2; ok = _tmp$3;
			return [length, ok];
		}
		if (value.substring(0, 3) === "GMT") {
			length = parseGMT(value);
			_tmp$4 = length; _tmp$5 = true; length = _tmp$4; ok = _tmp$5;
			return [length, ok];
		}
		nUpper = 0;
		nUpper = 0;
		while (nUpper < 6) {
			if (nUpper >= value.length) {
				break;
			}
			c = value.charCodeAt(nUpper);
			if (c < 65 || 90 < c) {
				break;
			}
			nUpper = nUpper + 1 >> 0;
		}
		_ref = nUpper;
		if (_ref === 0 || _ref === 1 || _ref === 2 || _ref === 6) {
			_tmp$6 = 0; _tmp$7 = false; length = _tmp$6; ok = _tmp$7;
			return [length, ok];
		} else if (_ref === 5) {
			if (value.charCodeAt(4) === 84) {
				_tmp$8 = 5; _tmp$9 = true; length = _tmp$8; ok = _tmp$9;
				return [length, ok];
			}
		} else if (_ref === 4) {
			if (value.charCodeAt(3) === 84) {
				_tmp$10 = 4; _tmp$11 = true; length = _tmp$10; ok = _tmp$11;
				return [length, ok];
			}
		} else if (_ref === 3) {
			_tmp$12 = 3; _tmp$13 = true; length = _tmp$12; ok = _tmp$13;
			return [length, ok];
		}
		_tmp$14 = 0; _tmp$15 = false; length = _tmp$14; ok = _tmp$15;
		return [length, ok];
	};
	parseGMT = function(value) {
		var sign, _tuple, x, rem, err;
		value = value.substring(3);
		if (value.length === 0) {
			return 3;
		}
		sign = value.charCodeAt(0);
		if (!((sign === 45)) && !((sign === 43))) {
			return 3;
		}
		_tuple = leadingInt(value.substring(1)); x = _tuple[0]; rem = _tuple[1]; err = _tuple[2];
		if (!(go$interfaceIsEqual(err, null))) {
			return 3;
		}
		if (sign === 45) {
			x = new Go$Int64(-x.high, -x.low);
		}
		if ((x.high === 0 && x.low === 0) || (x.high < -1 || (x.high === -1 && x.low < 4294967282)) || (0 < x.high || (0 === x.high && 12 < x.low))) {
			return 3;
		}
		return (3 + value.length >> 0) - rem.length >> 0;
	};
	parseNanoseconds = function(value, nbytes) {
		var ns, rangeErrString, err, _tuple, scaleDigits, i;
		ns = 0;
		rangeErrString = "";
		err = null;
		if (!((value.charCodeAt(0) === 46))) {
			err = errBad;
			return [ns, rangeErrString, err];
		}
		_tuple = atoi(value.substring(1, nbytes)); ns = _tuple[0]; err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [ns, rangeErrString, err];
		}
		if (ns < 0 || 1000000000 <= ns) {
			rangeErrString = "fractional second";
			return [ns, rangeErrString, err];
		}
		scaleDigits = 10 - nbytes >> 0;
		i = 0;
		while (i < scaleDigits) {
			ns = (((ns >>> 16 << 16) * 10 >> 0) + (ns << 16 >>> 16) * 10) >> 0;
			i = i + 1 >> 0;
		}
		return [ns, rangeErrString, err];
	};
	leadingInt = function(s) {
		var x, rem, err, i, c, _tmp, _tmp$1, _tmp$2, x$1, x$2, x$3, _tmp$3, _tmp$4, _tmp$5;
		x = new Go$Int64(0, 0);
		rem = "";
		err = null;
		i = 0;
		while (i < s.length) {
			c = s.charCodeAt(i);
			if (c < 48 || c > 57) {
				break;
			}
			if ((x.high > 214748364 || (x.high === 214748364 && x.low >= 3435973835))) {
				_tmp = new Go$Int64(0, 0); _tmp$1 = ""; _tmp$2 = errLeadingInt; x = _tmp; rem = _tmp$1; err = _tmp$2;
				return [x, rem, err];
			}
			x = (x$1 = (x$2 = go$mul64(x, new Go$Int64(0, 10)), x$3 = new Go$Int64(0, c), new Go$Int64(x$2.high + x$3.high, x$2.low + x$3.low)), new Go$Int64(x$1.high - 0, x$1.low - 48));
			i = i + 1 >> 0;
		}
		_tmp$3 = x; _tmp$4 = s.substring(i); _tmp$5 = null; x = _tmp$3; rem = _tmp$4; err = _tmp$5;
		return [x, rem, err];
	};
	Time.Ptr.prototype.After = function(u) {
		var _struct, t, x, x$1, x$2, x$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, x$1 = u.sec, (x.high > x$1.high || (x.high === x$1.high && x.low > x$1.low))) || (x$2 = t.sec, x$3 = u.sec, (x$2.high === x$3.high && x$2.low === x$3.low)) && t.nsec > u.nsec;
	};
	Time.prototype.After = function(u) { return this.go$val.After(u); };
	Time.Ptr.prototype.Before = function(u) {
		var _struct, t, x, x$1, x$2, x$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, x$1 = u.sec, (x.high < x$1.high || (x.high === x$1.high && x.low < x$1.low))) || (x$2 = t.sec, x$3 = u.sec, (x$2.high === x$3.high && x$2.low === x$3.low)) && t.nsec < u.nsec;
	};
	Time.prototype.Before = function(u) { return this.go$val.Before(u); };
	Time.Ptr.prototype.Equal = function(u) {
		var _struct, t, x, x$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, x$1 = u.sec, (x.high === x$1.high && x.low === x$1.low)) && (t.nsec === u.nsec);
	};
	Time.prototype.Equal = function(u) { return this.go$val.Equal(u); };
	Month.prototype.String = function() {
		var m;
		m = this.go$val;
		return months[(m - 1 >> 0)];
	};
	go$ptrType(Month).prototype.String = function() { return new Month(this.go$get()).String(); };
	Weekday.prototype.String = function() {
		var d;
		d = this.go$val;
		return days[d];
	};
	go$ptrType(Weekday).prototype.String = function() { return new Weekday(this.go$get()).String(); };
	Time.Ptr.prototype.IsZero = function() {
		var _struct, t, x;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, (x.high === 0 && x.low === 0)) && (t.nsec === 0);
	};
	Time.prototype.IsZero = function() { return this.go$val.IsZero(); };
	Time.Ptr.prototype.abs = function() {
		var _struct, t, l, x, sec, x$1, x$2, x$3, _tuple, offset, x$4, x$5;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		l = t.loc;
		if (l === (go$ptrType(Location)).nil || l === localLoc) {
			l = l.get();
		}
		sec = (x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640));
		if (!(l === utcLoc)) {
			if (!(l.cacheZone === (go$ptrType(zone)).nil) && (x$1 = l.cacheStart, (x$1.high < sec.high || (x$1.high === sec.high && x$1.low <= sec.low))) && (x$2 = l.cacheEnd, (sec.high < x$2.high || (sec.high === x$2.high && sec.low < x$2.low)))) {
				sec = (x$3 = new Go$Int64(0, l.cacheZone.offset), new Go$Int64(sec.high + x$3.high, sec.low + x$3.low));
			} else {
				_tuple = l.lookup(sec); offset = _tuple[1];
				sec = (x$4 = new Go$Int64(0, offset), new Go$Int64(sec.high + x$4.high, sec.low + x$4.low));
			}
		}
		return (x$5 = new Go$Int64(sec.high + 2147483646, sec.low + 450480384), new Go$Uint64(x$5.high, x$5.low));
	};
	Time.prototype.abs = function() { return this.go$val.abs(); };
	Time.Ptr.prototype.locabs = function() {
		var name, offset, abs, _struct, t, l, x, sec, x$1, x$2, _tuple, x$3, x$4;
		name = "";
		offset = 0;
		abs = new Go$Uint64(0, 0);
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		l = t.loc;
		if (l === (go$ptrType(Location)).nil || l === localLoc) {
			l = l.get();
		}
		sec = (x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640));
		if (!(l === utcLoc)) {
			if (!(l.cacheZone === (go$ptrType(zone)).nil) && (x$1 = l.cacheStart, (x$1.high < sec.high || (x$1.high === sec.high && x$1.low <= sec.low))) && (x$2 = l.cacheEnd, (sec.high < x$2.high || (sec.high === x$2.high && sec.low < x$2.low)))) {
				name = l.cacheZone.name;
				offset = l.cacheZone.offset;
			} else {
				_tuple = l.lookup(sec); name = _tuple[0]; offset = _tuple[1];
			}
			sec = (x$3 = new Go$Int64(0, offset), new Go$Int64(sec.high + x$3.high, sec.low + x$3.low));
		} else {
			name = "UTC";
		}
		abs = (x$4 = new Go$Int64(sec.high + 2147483646, sec.low + 450480384), new Go$Uint64(x$4.high, x$4.low));
		return [name, offset, abs];
	};
	Time.prototype.locabs = function() { return this.go$val.locabs(); };
	Time.Ptr.prototype.Date = function() {
		var year, month, day, _struct, t, _tuple;
		year = 0;
		month = 0;
		day = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true); year = _tuple[0]; month = _tuple[1]; day = _tuple[2];
		return [year, month, day];
	};
	Time.prototype.Date = function() { return this.go$val.Date(); };
	Time.Ptr.prototype.Year = function() {
		var _struct, t, _tuple, year;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(false); year = _tuple[0];
		return year;
	};
	Time.prototype.Year = function() { return this.go$val.Year(); };
	Time.Ptr.prototype.Month = function() {
		var _struct, t, _tuple, month;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true); month = _tuple[1];
		return month;
	};
	Time.prototype.Month = function() { return this.go$val.Month(); };
	Time.Ptr.prototype.Day = function() {
		var _struct, t, _tuple, day;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true); day = _tuple[2];
		return day;
	};
	Time.prototype.Day = function() { return this.go$val.Day(); };
	Time.Ptr.prototype.Weekday = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return absWeekday(t.abs());
	};
	Time.prototype.Weekday = function() { return this.go$val.Weekday(); };
	absWeekday = function(abs) {
		var sec, _q;
		sec = go$div64((new Go$Uint64(abs.high + 0, abs.low + 86400)), new Go$Uint64(0, 604800), true);
		return ((_q = (sec.low >> 0) / 86400, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0);
	};
	Time.Ptr.prototype.ISOWeek = function() {
		var year, week, _struct, t, _tuple, month, day, yday, _r, wday, _q, _r$1, jan1wday, _r$2, dec31wday;
		year = 0;
		week = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true); year = _tuple[0]; month = _tuple[1]; day = _tuple[2]; yday = _tuple[3];
		wday = (_r = ((t.Weekday() + 6 >> 0) >> 0) % 7, _r === _r ? _r : go$throwRuntimeError("integer divide by zero"));
		week = (_q = (((yday - wday >> 0) + 7 >> 0)) / 7, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		jan1wday = (_r$1 = (((wday - yday >> 0) + 371 >> 0)) % 7, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero"));
		if (1 <= jan1wday && jan1wday <= 3) {
			week = week + 1 >> 0;
		}
		if (week === 0) {
			year = year - 1 >> 0;
			week = 52;
			if ((jan1wday === 4) || ((jan1wday === 5) && isLeap(year))) {
				week = week + 1 >> 0;
			}
		}
		if ((month === 12) && day >= 29 && wday < 3) {
			dec31wday = (_r$2 = (((wday + 31 >> 0) - day >> 0)) % 7, _r$2 === _r$2 ? _r$2 : go$throwRuntimeError("integer divide by zero"));
			if (0 <= dec31wday && dec31wday <= 2) {
				year = year + 1 >> 0;
				week = 1;
			}
		}
		return [year, week];
	};
	Time.prototype.ISOWeek = function() { return this.go$val.ISOWeek(); };
	Time.Ptr.prototype.Clock = function() {
		var hour, min, sec, _struct, t, _tuple;
		hour = 0;
		min = 0;
		sec = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = absClock(t.abs()); hour = _tuple[0]; min = _tuple[1]; sec = _tuple[2];
		return [hour, min, sec];
	};
	Time.prototype.Clock = function() { return this.go$val.Clock(); };
	absClock = function(abs) {
		var hour, min, sec, _q, _q$1;
		hour = 0;
		min = 0;
		sec = 0;
		sec = (go$div64(abs, new Go$Uint64(0, 86400), true).low >> 0);
		hour = (_q = sec / 3600, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		sec = sec - (((((hour >>> 16 << 16) * 3600 >> 0) + (hour << 16 >>> 16) * 3600) >> 0)) >> 0;
		min = (_q$1 = sec / 60, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
		sec = sec - (((((min >>> 16 << 16) * 60 >> 0) + (min << 16 >>> 16) * 60) >> 0)) >> 0;
		return [hour, min, sec];
	};
	Time.Ptr.prototype.Hour = function() {
		var _struct, t, _q;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (_q = (go$div64(t.abs(), new Go$Uint64(0, 86400), true).low >> 0) / 3600, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
	};
	Time.prototype.Hour = function() { return this.go$val.Hour(); };
	Time.Ptr.prototype.Minute = function() {
		var _struct, t, _q;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (_q = (go$div64(t.abs(), new Go$Uint64(0, 3600), true).low >> 0) / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
	};
	Time.prototype.Minute = function() { return this.go$val.Minute(); };
	Time.Ptr.prototype.Second = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (go$div64(t.abs(), new Go$Uint64(0, 60), true).low >> 0);
	};
	Time.prototype.Second = function() { return this.go$val.Second(); };
	Time.Ptr.prototype.Nanosecond = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (t.nsec >> 0);
	};
	Time.prototype.Nanosecond = function() { return this.go$val.Nanosecond(); };
	Time.Ptr.prototype.YearDay = function() {
		var _struct, t, _tuple, yday;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(false); yday = _tuple[3];
		return yday + 1 >> 0;
	};
	Time.prototype.YearDay = function() { return this.go$val.YearDay(); };
	Duration.prototype.String = function() {
		var d, buf, w, u, neg, prec, unit, _tuple, _tuple$1;
		d = this;
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		w = 32;
		u = new Go$Uint64(d.high, d.low);
		neg = (d.high < 0 || (d.high === 0 && d.low < 0));
		if (neg) {
			u = new Go$Uint64(-u.high, -u.low);
		}
		if ((u.high < 0 || (u.high === 0 && u.low < 1000000000))) {
			prec = 0;
			unit = 0;
			if ((u.high === 0 && u.low === 0)) {
				return "0";
			} else if ((u.high < 0 || (u.high === 0 && u.low < 1000))) {
				prec = 0;
				unit = 110;
			} else if ((u.high < 0 || (u.high === 0 && u.low < 1000000))) {
				prec = 3;
				unit = 117;
			} else {
				prec = 6;
				unit = 109;
			}
			w = w - 2 >> 0;
			buf[w] = unit;
			buf[(w + 1 >> 0)] = 115;
			_tuple = fmtFrac(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u, prec); w = _tuple[0]; u = _tuple[1];
			w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u);
		} else {
			w = w - 1 >> 0;
			buf[w] = 115;
			_tuple$1 = fmtFrac(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u, 9); w = _tuple$1[0]; u = _tuple$1[1];
			w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), go$div64(u, new Go$Uint64(0, 60), true));
			u = go$div64(u, new Go$Uint64(0, 60), false);
			if ((u.high > 0 || (u.high === 0 && u.low > 0))) {
				w = w - 1 >> 0;
				buf[w] = 109;
				w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), go$div64(u, new Go$Uint64(0, 60), true));
				u = go$div64(u, new Go$Uint64(0, 60), false);
				if ((u.high > 0 || (u.high === 0 && u.low > 0))) {
					w = w - 1 >> 0;
					buf[w] = 104;
					w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u);
				}
			}
		}
		if (neg) {
			w = w - 1 >> 0;
			buf[w] = 45;
		}
		return go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(buf), w));
	};
	go$ptrType(Duration).prototype.String = function() { return this.go$get().String(); };
	fmtFrac = function(buf, v, prec) {
		var nw, nv, w, print, i, digit, _tmp, _tmp$1;
		nw = 0;
		nv = new Go$Uint64(0, 0);
		w = buf.length;
		print = false;
		i = 0;
		while (i < prec) {
			digit = go$div64(v, new Go$Uint64(0, 10), true);
			print = print || !((digit.high === 0 && digit.low === 0));
			if (print) {
				w = w - 1 >> 0;
				(w < 0 || w >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + w] = (digit.low << 24 >>> 24) + 48 << 24 >>> 24;
			}
			v = go$div64(v, new Go$Uint64(0, 10), false);
			i = i + 1 >> 0;
		}
		if (print) {
			w = w - 1 >> 0;
			(w < 0 || w >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + w] = 46;
		}
		_tmp = w; _tmp$1 = v; nw = _tmp; nv = _tmp$1;
		return [nw, nv];
	};
	fmtInt = function(buf, v) {
		var w;
		w = buf.length;
		if ((v.high === 0 && v.low === 0)) {
			w = w - 1 >> 0;
			(w < 0 || w >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + w] = 48;
		} else {
			while ((v.high > 0 || (v.high === 0 && v.low > 0))) {
				w = w - 1 >> 0;
				(w < 0 || w >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + w] = (go$div64(v, new Go$Uint64(0, 10), true).low << 24 >>> 24) + 48 << 24 >>> 24;
				v = go$div64(v, new Go$Uint64(0, 10), false);
			}
		}
		return w;
	};
	Duration.prototype.Nanoseconds = function() {
		var d;
		d = this;
		return new Go$Int64(d.high, d.low);
	};
	go$ptrType(Duration).prototype.Nanoseconds = function() { return this.go$get().Nanoseconds(); };
	Duration.prototype.Seconds = function() {
		var d, sec, nsec;
		d = this;
		sec = go$div64(d, new Duration(0, 1000000000), false);
		nsec = go$div64(d, new Duration(0, 1000000000), true);
		return go$flatten64(sec) + go$flatten64(nsec) * 1e-09;
	};
	go$ptrType(Duration).prototype.Seconds = function() { return this.go$get().Seconds(); };
	Duration.prototype.Minutes = function() {
		var d, min, nsec;
		d = this;
		min = go$div64(d, new Duration(13, 4165425152), false);
		nsec = go$div64(d, new Duration(13, 4165425152), true);
		return go$flatten64(min) + go$flatten64(nsec) * 1.6666666666666667e-11;
	};
	go$ptrType(Duration).prototype.Minutes = function() { return this.go$get().Minutes(); };
	Duration.prototype.Hours = function() {
		var d, hour, nsec;
		d = this;
		hour = go$div64(d, new Duration(838, 817405952), false);
		nsec = go$div64(d, new Duration(838, 817405952), true);
		return go$flatten64(hour) + go$flatten64(nsec) * 2.777777777777778e-13;
	};
	go$ptrType(Duration).prototype.Hours = function() { return this.go$get().Hours(); };
	Time.Ptr.prototype.Add = function(d) {
		var _struct, t, x, x$1, x$2, x$3, nsec, x$4, x$5, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		t.sec = (x = t.sec, x$1 = (x$2 = go$div64(d, new Duration(0, 1000000000), false), new Go$Int64(x$2.high, x$2.low)), new Go$Int64(x.high + x$1.high, x.low + x$1.low));
		nsec = (t.nsec >> 0) + ((x$3 = go$div64(d, new Duration(0, 1000000000), true), x$3.low + ((x$3.high >> 31) * 4294967296)) >> 0) >> 0;
		if (nsec >= 1000000000) {
			t.sec = (x$4 = t.sec, new Go$Int64(x$4.high + 0, x$4.low + 1));
			nsec = nsec - 1000000000 >> 0;
		} else if (nsec < 0) {
			t.sec = (x$5 = t.sec, new Go$Int64(x$5.high - 0, x$5.low - 1));
			nsec = nsec + 1000000000 >> 0;
		}
		t.nsec = (nsec >>> 0);
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.Add = function(d) { return this.go$val.Add(d); };
	Time.Ptr.prototype.Sub = function(u) {
		var _struct, t, x, x$1, x$2, x$3, x$4, d, _struct$1, _struct$2;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		d = (x = go$mul64((x$1 = (x$2 = t.sec, x$3 = u.sec, new Go$Int64(x$2.high - x$3.high, x$2.low - x$3.low)), new Duration(x$1.high, x$1.low)), new Duration(0, 1000000000)), x$4 = new Duration(0, ((t.nsec >> 0) - (u.nsec >> 0) >> 0)), new Duration(x.high + x$4.high, x.low + x$4.low));
		if (u.Add(d).Equal((_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc)))) {
			return d;
		} else if (t.Before((_struct$2 = u, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)))) {
			return new Duration(-2147483648, 0);
		} else {
			return new Duration(2147483647, 4294967295);
		}
	};
	Time.prototype.Sub = function(u) { return this.go$val.Sub(u); };
	Time.Ptr.prototype.AddDate = function(years, months$1, days$1) {
		var _struct, t, _tuple, year, month, day, _tuple$1, hour, min, sec, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.Date(); year = _tuple[0]; month = _tuple[1]; day = _tuple[2];
		_tuple$1 = t.Clock(); hour = _tuple$1[0]; min = _tuple$1[1]; sec = _tuple$1[2];
		return (_struct$1 = Date(year + years >> 0, month + (months$1 >> 0) >> 0, day + days$1 >> 0, hour, min, sec, (t.nsec >> 0), t.loc), new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.AddDate = function(years, months$1, days$1) { return this.go$val.AddDate(years, months$1, days$1); };
	Time.Ptr.prototype.date = function(full) {
		var year, month, day, yday, _struct, t, _tuple;
		year = 0;
		month = 0;
		day = 0;
		yday = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = absDate(t.abs(), full); year = _tuple[0]; month = _tuple[1]; day = _tuple[2]; yday = _tuple[3];
		return [year, month, day, yday];
	};
	Time.prototype.date = function(full) { return this.go$val.date(full); };
	absDate = function(abs, full) {
		var year, month, day, yday, d, n, y, x, x$1, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9, x$10, _q, end, begin;
		year = 0;
		month = 0;
		day = 0;
		yday = 0;
		d = go$div64(abs, new Go$Uint64(0, 86400), false);
		n = go$div64(d, new Go$Uint64(0, 146097), false);
		y = go$mul64(new Go$Uint64(0, 400), n);
		d = (x = go$mul64(new Go$Uint64(0, 146097), n), new Go$Uint64(d.high - x.high, d.low - x.low));
		n = go$div64(d, new Go$Uint64(0, 36524), false);
		n = (x$1 = go$shiftRightUint64(n, 2), new Go$Uint64(n.high - x$1.high, n.low - x$1.low));
		y = (x$2 = go$mul64(new Go$Uint64(0, 100), n), new Go$Uint64(y.high + x$2.high, y.low + x$2.low));
		d = (x$3 = go$mul64(new Go$Uint64(0, 36524), n), new Go$Uint64(d.high - x$3.high, d.low - x$3.low));
		n = go$div64(d, new Go$Uint64(0, 1461), false);
		y = (x$4 = go$mul64(new Go$Uint64(0, 4), n), new Go$Uint64(y.high + x$4.high, y.low + x$4.low));
		d = (x$5 = go$mul64(new Go$Uint64(0, 1461), n), new Go$Uint64(d.high - x$5.high, d.low - x$5.low));
		n = go$div64(d, new Go$Uint64(0, 365), false);
		n = (x$6 = go$shiftRightUint64(n, 2), new Go$Uint64(n.high - x$6.high, n.low - x$6.low));
		y = (x$7 = n, new Go$Uint64(y.high + x$7.high, y.low + x$7.low));
		d = (x$8 = go$mul64(new Go$Uint64(0, 365), n), new Go$Uint64(d.high - x$8.high, d.low - x$8.low));
		year = ((x$9 = (x$10 = new Go$Int64(y.high, y.low), new Go$Int64(x$10.high + -69, x$10.low + 4075721025)), x$9.low + ((x$9.high >> 31) * 4294967296)) >> 0);
		yday = (d.low >> 0);
		if (!full) {
			return [year, month, day, yday];
		}
		day = yday;
		if (isLeap(year)) {
			if (day > 59) {
				day = day - 1 >> 0;
			} else if (day === 59) {
				month = 2;
				day = 29;
				return [year, month, day, yday];
			}
		}
		month = ((_q = day / 31, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0);
		end = (daysBefore[(month + 1 >> 0)] >> 0);
		begin = 0;
		if (day >= end) {
			month = month + 1 >> 0;
			begin = end;
		} else {
			begin = (daysBefore[month] >> 0);
		}
		month = month + 1 >> 0;
		day = (day - begin >> 0) + 1 >> 0;
		return [year, month, day, yday];
	};
	daysIn = function(m, year) {
		if ((m === 2) && isLeap(year)) {
			return 29;
		}
		return ((daysBefore[m] - daysBefore[(m - 1 >> 0)] >> 0) >> 0);
	};
	Now = go$pkg.Now = function() {
		var _tuple, sec, nsec;
		_tuple = now(); sec = _tuple[0]; nsec = _tuple[1];
		return new Time.Ptr(new Go$Int64(sec.high + 14, sec.low + 2006054656), (nsec >>> 0), go$pkg.Local);
	};
	Time.Ptr.prototype.UTC = function() {
		var _struct, t, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		t.loc = go$pkg.UTC;
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.UTC = function() { return this.go$val.UTC(); };
	Time.Ptr.prototype.Local = function() {
		var _struct, t, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		t.loc = go$pkg.Local;
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.Local = function() { return this.go$val.Local(); };
	Time.Ptr.prototype.In = function(loc) {
		var _struct, t, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if (loc === (go$ptrType(Location)).nil) {
			throw go$panic(new Go$String("time: missing Location in call to Time.In"));
		}
		t.loc = loc;
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.In = function(loc) { return this.go$val.In(loc); };
	Time.Ptr.prototype.Location = function() {
		var _struct, t, l;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		l = t.loc;
		if (l === (go$ptrType(Location)).nil) {
			l = go$pkg.UTC;
		}
		return l;
	};
	Time.prototype.Location = function() { return this.go$val.Location(); };
	Time.Ptr.prototype.Zone = function() {
		var name, offset, _struct, t, _tuple, x;
		name = "";
		offset = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.loc.lookup((x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640))); name = _tuple[0]; offset = _tuple[1];
		return [name, offset];
	};
	Time.prototype.Zone = function() { return this.go$val.Zone(); };
	Time.Ptr.prototype.Unix = function() {
		var _struct, t, x;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640));
	};
	Time.prototype.Unix = function() { return this.go$val.Unix(); };
	Time.Ptr.prototype.UnixNano = function() {
		var _struct, t, x, x$1, x$2, x$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = go$mul64(((x$1 = t.sec, new Go$Int64(x$1.high + -15, x$1.low + 2288912640))), new Go$Int64(0, 1000000000)), x$2 = (x$3 = t.nsec, new Go$Int64(0, x$3.constructor === Number ? x$3 : 1)), new Go$Int64(x.high + x$2.high, x.low + x$2.low));
	};
	Time.prototype.UnixNano = function() { return this.go$val.UnixNano(); };
	Time.Ptr.prototype.MarshalBinary = function() {
		var _struct, t, offsetMin, _tuple, offset, _r, _q, enc;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		offsetMin = 0;
		if (t.Location() === utcLoc) {
			offsetMin = -1;
		} else {
			_tuple = t.Zone(); offset = _tuple[1];
			if (!(((_r = offset % 60, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 0))) {
				return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalBinary: zone offset has fractional minute")];
			}
			offset = (_q = offset / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			if (offset < -32768 || (offset === -1) || offset > 32767) {
				return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalBinary: unexpected zone offset")];
			}
			offsetMin = (offset << 16 >> 16);
		}
		enc = new (go$sliceType(Go$Uint8))([1, (go$shiftRightInt64(t.sec, 56).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 48).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 40).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 32).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 24).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 16).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 8).low << 24 >>> 24), (t.sec.low << 24 >>> 24), ((t.nsec >>> 24 >>> 0) << 24 >>> 24), ((t.nsec >>> 16 >>> 0) << 24 >>> 24), ((t.nsec >>> 8 >>> 0) << 24 >>> 24), (t.nsec << 24 >>> 24), ((offsetMin >> 8 << 16 >> 16) << 24 >>> 24), (offsetMin << 24 >>> 24)]);
		return [enc, null];
	};
	Time.prototype.MarshalBinary = function() { return this.go$val.MarshalBinary(); };
	Time.Ptr.prototype.UnmarshalBinary = function(data$1) {
		var t, buf, x, x$1, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9, x$10, x$11, x$12, x$13, x$14, offset, _tuple, x$15, localoff;
		t = this;
		buf = data$1;
		if (buf.length === 0) {
			return errors.New("Time.UnmarshalBinary: no data");
		}
		if (!((((0 < 0 || 0 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 0]) === 1))) {
			return errors.New("Time.UnmarshalBinary: unsupported version");
		}
		if (!((buf.length === 15))) {
			return errors.New("Time.UnmarshalBinary: invalid length");
		}
		buf = go$subslice(buf, 1);
		t.sec = (x = (x$1 = (x$2 = (x$3 = (x$4 = (x$5 = (x$6 = new Go$Int64(0, ((7 < 0 || 7 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 7])), x$7 = go$shiftLeft64(new Go$Int64(0, ((6 < 0 || 6 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 6])), 8), new Go$Int64(x$6.high | x$7.high, (x$6.low | x$7.low) >>> 0)), x$8 = go$shiftLeft64(new Go$Int64(0, ((5 < 0 || 5 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 5])), 16), new Go$Int64(x$5.high | x$8.high, (x$5.low | x$8.low) >>> 0)), x$9 = go$shiftLeft64(new Go$Int64(0, ((4 < 0 || 4 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 4])), 24), new Go$Int64(x$4.high | x$9.high, (x$4.low | x$9.low) >>> 0)), x$10 = go$shiftLeft64(new Go$Int64(0, ((3 < 0 || 3 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 3])), 32), new Go$Int64(x$3.high | x$10.high, (x$3.low | x$10.low) >>> 0)), x$11 = go$shiftLeft64(new Go$Int64(0, ((2 < 0 || 2 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 2])), 40), new Go$Int64(x$2.high | x$11.high, (x$2.low | x$11.low) >>> 0)), x$12 = go$shiftLeft64(new Go$Int64(0, ((1 < 0 || 1 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 1])), 48), new Go$Int64(x$1.high | x$12.high, (x$1.low | x$12.low) >>> 0)), x$13 = go$shiftLeft64(new Go$Int64(0, ((0 < 0 || 0 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 0])), 56), new Go$Int64(x.high | x$13.high, (x.low | x$13.low) >>> 0));
		buf = go$subslice(buf, 8);
		t.nsec = (((((((3 < 0 || 3 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 3]) >> 0) | ((((2 < 0 || 2 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 2]) >> 0) << 8 >> 0)) | ((((1 < 0 || 1 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 1]) >> 0) << 16 >> 0)) | ((((0 < 0 || 0 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 0]) >> 0) << 24 >> 0)) >>> 0);
		buf = go$subslice(buf, 4);
		offset = (x$14 = (((((1 < 0 || 1 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 1]) << 16 >> 16) | ((((0 < 0 || 0 >= buf.length) ? go$throwRuntimeError("index out of range") : buf.array[buf.offset + 0]) << 16 >> 16) << 8 << 16 >> 16)) >> 0), (((x$14 >>> 16 << 16) * 60 >> 0) + (x$14 << 16 >>> 16) * 60) >> 0);
		if (offset === -60) {
			t.loc = utcLoc;
		} else {
			_tuple = go$pkg.Local.lookup((x$15 = t.sec, new Go$Int64(x$15.high + -15, x$15.low + 2288912640))); localoff = _tuple[1];
			if (offset === localoff) {
				t.loc = go$pkg.Local;
			} else {
				t.loc = FixedZone("", offset);
			}
		}
		return null;
	};
	Time.prototype.UnmarshalBinary = function(data$1) { return this.go$val.UnmarshalBinary(data$1); };
	Time.Ptr.prototype.GobEncode = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return t.MarshalBinary();
	};
	Time.prototype.GobEncode = function() { return this.go$val.GobEncode(); };
	Time.Ptr.prototype.GobDecode = function(data$1) {
		var t;
		t = this;
		return t.UnmarshalBinary(data$1);
	};
	Time.prototype.GobDecode = function(data$1) { return this.go$val.GobDecode(data$1); };
	Time.Ptr.prototype.MarshalJSON = function() {
		var _struct, t, y;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		y = t.Year();
		if (y < 0 || y >= 10000) {
			return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalJSON: year outside of range [0,9999]")];
		}
		return [new (go$sliceType(Go$Uint8))(go$stringToBytes(t.Format("\"2006-01-02T15:04:05.999999999Z07:00\""))), null];
	};
	Time.prototype.MarshalJSON = function() { return this.go$val.MarshalJSON(); };
	Time.Ptr.prototype.UnmarshalJSON = function(data$1) {
		var err, t, _tuple, _struct, l, r;
		err = null;
		t = this;
		_tuple = Parse("\"2006-01-02T15:04:05Z07:00\"", go$bytesToString(data$1)); l = t; r = (_struct = _tuple[0], new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc)); l.sec = r.sec; l.nsec = r.nsec; l.loc = r.loc; err = _tuple[1];
		return err;
	};
	Time.prototype.UnmarshalJSON = function(data$1) { return this.go$val.UnmarshalJSON(data$1); };
	Time.Ptr.prototype.MarshalText = function() {
		var _struct, t, y;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		y = t.Year();
		if (y < 0 || y >= 10000) {
			return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalText: year outside of range [0,9999]")];
		}
		return [new (go$sliceType(Go$Uint8))(go$stringToBytes(t.Format("2006-01-02T15:04:05.999999999Z07:00"))), null];
	};
	Time.prototype.MarshalText = function() { return this.go$val.MarshalText(); };
	Time.Ptr.prototype.UnmarshalText = function(data$1) {
		var err, t, _tuple, _struct, l, r;
		err = null;
		t = this;
		_tuple = Parse("2006-01-02T15:04:05Z07:00", go$bytesToString(data$1)); l = t; r = (_struct = _tuple[0], new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc)); l.sec = r.sec; l.nsec = r.nsec; l.loc = r.loc; err = _tuple[1];
		return err;
	};
	Time.prototype.UnmarshalText = function(data$1) { return this.go$val.UnmarshalText(data$1); };
	isLeap = function(year) {
		var _r, _r$1, _r$2;
		return ((_r = year % 4, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 0) && (!(((_r$1 = year % 100, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero")) === 0)) || ((_r$2 = year % 400, _r$2 === _r$2 ? _r$2 : go$throwRuntimeError("integer divide by zero")) === 0));
	};
	norm = function(hi, lo, base) {
		var nhi, nlo, _q, n, _q$1, n$1, _tmp, _tmp$1;
		nhi = 0;
		nlo = 0;
		if (lo < 0) {
			n = (_q = ((-lo - 1 >> 0)) / base, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) + 1 >> 0;
			hi = hi - (n) >> 0;
			lo = lo + (((((n >>> 16 << 16) * base >> 0) + (n << 16 >>> 16) * base) >> 0)) >> 0;
		}
		if (lo >= base) {
			n$1 = (_q$1 = lo / base, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
			hi = hi + (n$1) >> 0;
			lo = lo - (((((n$1 >>> 16 << 16) * base >> 0) + (n$1 << 16 >>> 16) * base) >> 0)) >> 0;
		}
		_tmp = hi; _tmp$1 = lo; nhi = _tmp; nlo = _tmp$1;
		return [nhi, nlo];
	};
	Date = go$pkg.Date = function(year, month, day, hour, min, sec, nsec, loc) {
		var m, _tuple, _tuple$1, _tuple$2, _tuple$3, _tuple$4, x, x$1, y, n, x$2, d, x$3, x$4, x$5, x$6, x$7, x$8, x$9, abs, x$10, x$11, unix, _tuple$5, offset, start, end, x$12, utc, _tuple$6, _tuple$7, x$13;
		if (loc === (go$ptrType(Location)).nil) {
			throw go$panic(new Go$String("time: missing Location in call to Date"));
		}
		m = (month >> 0) - 1 >> 0;
		_tuple = norm(year, m, 12); year = _tuple[0]; m = _tuple[1];
		month = (m >> 0) + 1 >> 0;
		_tuple$1 = norm(sec, nsec, 1000000000); sec = _tuple$1[0]; nsec = _tuple$1[1];
		_tuple$2 = norm(min, sec, 60); min = _tuple$2[0]; sec = _tuple$2[1];
		_tuple$3 = norm(hour, min, 60); hour = _tuple$3[0]; min = _tuple$3[1];
		_tuple$4 = norm(day, hour, 24); day = _tuple$4[0]; hour = _tuple$4[1];
		y = (x = (x$1 = new Go$Int64(0, year), new Go$Int64(x$1.high - -69, x$1.low - 4075721025)), new Go$Uint64(x.high, x.low));
		n = go$div64(y, new Go$Uint64(0, 400), false);
		y = (x$2 = go$mul64(new Go$Uint64(0, 400), n), new Go$Uint64(y.high - x$2.high, y.low - x$2.low));
		d = go$mul64(new Go$Uint64(0, 146097), n);
		n = go$div64(y, new Go$Uint64(0, 100), false);
		y = (x$3 = go$mul64(new Go$Uint64(0, 100), n), new Go$Uint64(y.high - x$3.high, y.low - x$3.low));
		d = (x$4 = go$mul64(new Go$Uint64(0, 36524), n), new Go$Uint64(d.high + x$4.high, d.low + x$4.low));
		n = go$div64(y, new Go$Uint64(0, 4), false);
		y = (x$5 = go$mul64(new Go$Uint64(0, 4), n), new Go$Uint64(y.high - x$5.high, y.low - x$5.low));
		d = (x$6 = go$mul64(new Go$Uint64(0, 1461), n), new Go$Uint64(d.high + x$6.high, d.low + x$6.low));
		n = y;
		d = (x$7 = go$mul64(new Go$Uint64(0, 365), n), new Go$Uint64(d.high + x$7.high, d.low + x$7.low));
		d = (x$8 = new Go$Uint64(0, daysBefore[(month - 1 >> 0)]), new Go$Uint64(d.high + x$8.high, d.low + x$8.low));
		if (isLeap(year) && month >= 3) {
			d = new Go$Uint64(d.high + 0, d.low + 1);
		}
		d = (x$9 = new Go$Uint64(0, (day - 1 >> 0)), new Go$Uint64(d.high + x$9.high, d.low + x$9.low));
		abs = go$mul64(d, new Go$Uint64(0, 86400));
		abs = (x$10 = new Go$Uint64(0, ((((((hour >>> 16 << 16) * 3600 >> 0) + (hour << 16 >>> 16) * 3600) >> 0) + ((((min >>> 16 << 16) * 60 >> 0) + (min << 16 >>> 16) * 60) >> 0) >> 0) + sec >> 0)), new Go$Uint64(abs.high + x$10.high, abs.low + x$10.low));
		unix = (x$11 = new Go$Int64(abs.high, abs.low), new Go$Int64(x$11.high + -2147483647, x$11.low + 3844486912));
		_tuple$5 = loc.lookup(unix); offset = _tuple$5[1]; start = _tuple$5[3]; end = _tuple$5[4];
		if (!((offset === 0))) {
			utc = (x$12 = new Go$Int64(0, offset), new Go$Int64(unix.high - x$12.high, unix.low - x$12.low));
			if ((utc.high < start.high || (utc.high === start.high && utc.low < start.low))) {
				_tuple$6 = loc.lookup(new Go$Int64(start.high - 0, start.low - 1)); offset = _tuple$6[1];
			} else if ((utc.high > end.high || (utc.high === end.high && utc.low >= end.low))) {
				_tuple$7 = loc.lookup(end); offset = _tuple$7[1];
			}
			unix = (x$13 = new Go$Int64(0, offset), new Go$Int64(unix.high - x$13.high, unix.low - x$13.low));
		}
		return new Time.Ptr(new Go$Int64(unix.high + 14, unix.low + 2006054656), (nsec >>> 0), loc);
	};
	Time.Ptr.prototype.Truncate = function(d) {
		var _struct, t, _struct$1, _tuple, _struct$2, r, _struct$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if ((d.high < 0 || (d.high === 0 && d.low <= 0))) {
			return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
		}
		_tuple = div((_struct$2 = t, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)), d); r = _tuple[1];
		return (_struct$3 = t.Add(new Duration(-r.high, -r.low)), new Time.Ptr(_struct$3.sec, _struct$3.nsec, _struct$3.loc));
	};
	Time.prototype.Truncate = function(d) { return this.go$val.Truncate(d); };
	Time.Ptr.prototype.Round = function(d) {
		var _struct, t, _struct$1, _tuple, _struct$2, r, x, _struct$3, _struct$4;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if ((d.high < 0 || (d.high === 0 && d.low <= 0))) {
			return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
		}
		_tuple = div((_struct$2 = t, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)), d); r = _tuple[1];
		if ((x = new Duration(r.high + r.high, r.low + r.low), (x.high < d.high || (x.high === d.high && x.low < d.low)))) {
			return (_struct$3 = t.Add(new Duration(-r.high, -r.low)), new Time.Ptr(_struct$3.sec, _struct$3.nsec, _struct$3.loc));
		}
		return (_struct$4 = t.Add(new Duration(d.high - r.high, d.low - r.low)), new Time.Ptr(_struct$4.sec, _struct$4.nsec, _struct$4.loc));
	};
	Time.prototype.Round = function(d) { return this.go$val.Round(d); };
	div = function(t, d) {
		var qmod2, r, neg, nsec, x, x$1, x$2, x$3, x$4, _q, _r, x$5, d1, x$6, x$7, x$8, x$9, x$10, sec, tmp, u1, u0, _tmp, _tmp$1, u0x, _tmp$2, _tmp$3, x$11, d1$1, x$12, d0, _tmp$4, _tmp$5, x$13, x$14, x$15;
		qmod2 = 0;
		r = new Duration(0, 0);
		neg = false;
		nsec = (t.nsec >> 0);
		if ((x = t.sec, (x.high < 0 || (x.high === 0 && x.low < 0)))) {
			neg = true;
			t.sec = (x$1 = t.sec, new Go$Int64(-x$1.high, -x$1.low));
			nsec = -nsec;
			if (nsec < 0) {
				nsec = nsec + 1000000000 >> 0;
				t.sec = (x$2 = t.sec, new Go$Int64(x$2.high - 0, x$2.low - 1));
			}
		}
		if ((d.high < 0 || (d.high === 0 && d.low < 1000000000)) && (x$3 = go$div64(new Duration(0, 1000000000), (new Duration(d.high + d.high, d.low + d.low)), true), (x$3.high === 0 && x$3.low === 0))) {
			qmod2 = ((_q = nsec / ((d.low + ((d.high >> 31) * 4294967296)) >> 0), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0) & 1;
			r = new Duration(0, (_r = nsec % ((d.low + ((d.high >> 31) * 4294967296)) >> 0), _r === _r ? _r : go$throwRuntimeError("integer divide by zero")));
		} else if ((x$4 = go$div64(d, new Duration(0, 1000000000), true), (x$4.high === 0 && x$4.low === 0))) {
			d1 = (x$5 = go$div64(d, new Duration(0, 1000000000), false), new Go$Int64(x$5.high, x$5.low));
			qmod2 = ((x$6 = go$div64(t.sec, d1, false), x$6.low + ((x$6.high >> 31) * 4294967296)) >> 0) & 1;
			r = (x$7 = go$mul64((x$8 = go$div64(t.sec, d1, true), new Duration(x$8.high, x$8.low)), new Duration(0, 1000000000)), x$9 = new Duration(0, nsec), new Duration(x$7.high + x$9.high, x$7.low + x$9.low));
		} else {
			sec = (x$10 = t.sec, new Go$Uint64(x$10.high, x$10.low));
			tmp = go$mul64((go$shiftRightUint64(sec, 32)), new Go$Uint64(0, 1000000000));
			u1 = go$shiftRightUint64(tmp, 32);
			u0 = go$shiftLeft64(tmp, 32);
			tmp = go$mul64(new Go$Uint64(sec.high & 0, (sec.low & 4294967295) >>> 0), new Go$Uint64(0, 1000000000));
			_tmp = u0; _tmp$1 = new Go$Uint64(u0.high + tmp.high, u0.low + tmp.low); u0x = _tmp; u0 = _tmp$1;
			if ((u0.high < u0x.high || (u0.high === u0x.high && u0.low < u0x.low))) {
				u1 = new Go$Uint64(u1.high + 0, u1.low + 1);
			}
			_tmp$2 = u0; _tmp$3 = (x$11 = new Go$Uint64(0, nsec), new Go$Uint64(u0.high + x$11.high, u0.low + x$11.low)); u0x = _tmp$2; u0 = _tmp$3;
			if ((u0.high < u0x.high || (u0.high === u0x.high && u0.low < u0x.low))) {
				u1 = new Go$Uint64(u1.high + 0, u1.low + 1);
			}
			d1$1 = new Go$Uint64(d.high, d.low);
			while (!((x$12 = go$shiftRightUint64(d1$1, 63), (x$12.high === 0 && x$12.low === 1)))) {
				d1$1 = go$shiftLeft64(d1$1, 1);
			}
			d0 = new Go$Uint64(0, 0);
			while (true) {
				qmod2 = 0;
				if ((u1.high > d1$1.high || (u1.high === d1$1.high && u1.low > d1$1.low)) || (u1.high === d1$1.high && u1.low === d1$1.low) && (u0.high > d0.high || (u0.high === d0.high && u0.low >= d0.low))) {
					qmod2 = 1;
					_tmp$4 = u0; _tmp$5 = new Go$Uint64(u0.high - d0.high, u0.low - d0.low); u0x = _tmp$4; u0 = _tmp$5;
					if ((u0.high > u0x.high || (u0.high === u0x.high && u0.low > u0x.low))) {
						u1 = new Go$Uint64(u1.high - 0, u1.low - 1);
					}
					u1 = (x$13 = d1$1, new Go$Uint64(u1.high - x$13.high, u1.low - x$13.low));
				}
				if ((d1$1.high === 0 && d1$1.low === 0) && (x$14 = new Go$Uint64(d.high, d.low), (d0.high === x$14.high && d0.low === x$14.low))) {
					break;
				}
				d0 = go$shiftRightUint64(d0, 1);
				d0 = (x$15 = go$shiftLeft64((new Go$Uint64(d1$1.high & 0, (d1$1.low & 1) >>> 0)), 63), new Go$Uint64(d0.high | x$15.high, (d0.low | x$15.low) >>> 0));
				d1$1 = go$shiftRightUint64(d1$1, 1);
			}
			r = new Duration(u0.high, u0.low);
		}
		if (neg && !((r.high === 0 && r.low === 0))) {
			qmod2 = (qmod2 ^ 1) >> 0;
			r = new Duration(d.high - r.high, d.low - r.low);
		}
		return [qmod2, r];
	};
	Location.Ptr.prototype.get = function() {
		var l;
		l = this;
		if (l === (go$ptrType(Location)).nil) {
			return utcLoc;
		}
		if (l === localLoc) {
			localOnce.Do(initLocal);
		}
		return l;
	};
	Location.prototype.get = function() { return this.go$val.get(); };
	Location.Ptr.prototype.String = function() {
		var l;
		l = this;
		return l.get().name;
	};
	Location.prototype.String = function() { return this.go$val.String(); };
	FixedZone = go$pkg.FixedZone = function(name, offset) {
		var l, x;
		l = new Location.Ptr(name, new (go$sliceType(zone))([new zone.Ptr(name, offset, false)]), new (go$sliceType(zoneTrans))([new zoneTrans.Ptr(new Go$Int64(-2147483648, 0), 0, false, false)]), new Go$Int64(-2147483648, 0), new Go$Int64(2147483647, 4294967295), (go$ptrType(zone)).nil);
		l.cacheZone = (x = l.zone, ((0 < 0 || 0 >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + 0]));
		return l;
	};
	Location.Ptr.prototype.lookup = function(sec) {
		var name, offset, isDST, start, end, l, zone$1, x, x$1, tx, lo, hi, _q, m, lim, x$2, x$3, zone$2;
		name = "";
		offset = 0;
		isDST = false;
		start = new Go$Int64(0, 0);
		end = new Go$Int64(0, 0);
		l = this;
		l = l.get();
		if (l.tx.length === 0) {
			name = "UTC";
			offset = 0;
			isDST = false;
			start = new Go$Int64(-2147483648, 0);
			end = new Go$Int64(2147483647, 4294967295);
			return [name, offset, isDST, start, end];
		}
		zone$1 = l.cacheZone;
		if (!(zone$1 === (go$ptrType(zone)).nil) && (x = l.cacheStart, (x.high < sec.high || (x.high === sec.high && x.low <= sec.low))) && (x$1 = l.cacheEnd, (sec.high < x$1.high || (sec.high === x$1.high && sec.low < x$1.low)))) {
			name = zone$1.name;
			offset = zone$1.offset;
			isDST = zone$1.isDST;
			start = l.cacheStart;
			end = l.cacheEnd;
			return [name, offset, isDST, start, end];
		}
		tx = l.tx;
		end = new Go$Int64(2147483647, 4294967295);
		lo = 0;
		hi = tx.length;
		while ((hi - lo >> 0) > 1) {
			m = lo + (_q = ((hi - lo >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			lim = ((m < 0 || m >= tx.length) ? go$throwRuntimeError("index out of range") : tx.array[tx.offset + m]).when;
			if ((sec.high < lim.high || (sec.high === lim.high && sec.low < lim.low))) {
				end = lim;
				hi = m;
			} else {
				lo = m;
			}
		}
		zone$2 = (x$2 = l.zone, x$3 = ((lo < 0 || lo >= tx.length) ? go$throwRuntimeError("index out of range") : tx.array[tx.offset + lo]).index, ((x$3 < 0 || x$3 >= x$2.length) ? go$throwRuntimeError("index out of range") : x$2.array[x$2.offset + x$3]));
		name = zone$2.name;
		offset = zone$2.offset;
		isDST = zone$2.isDST;
		start = ((lo < 0 || lo >= tx.length) ? go$throwRuntimeError("index out of range") : tx.array[tx.offset + lo]).when;
		return [name, offset, isDST, start, end];
	};
	Location.prototype.lookup = function(sec) { return this.go$val.lookup(sec); };
	Location.Ptr.prototype.lookupName = function(name, unix) {
		var offset, isDST, ok, l, _ref, _i, i, x, zone$1, _tuple, x$1, nam, offset$1, isDST$1, _tmp, _tmp$1, _tmp$2, _ref$1, _i$1, i$1, x$2, zone$2, _tmp$3, _tmp$4, _tmp$5;
		offset = 0;
		isDST = false;
		ok = false;
		l = this;
		l = l.get();
		_ref = l.zone;
		_i = 0;
		while (_i < _ref.length) {
			i = _i;
			zone$1 = (x = l.zone, ((i < 0 || i >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + i]));
			if (zone$1.name === name) {
				_tuple = l.lookup((x$1 = new Go$Int64(0, zone$1.offset), new Go$Int64(unix.high - x$1.high, unix.low - x$1.low))); nam = _tuple[0]; offset$1 = _tuple[1]; isDST$1 = _tuple[2];
				if (nam === zone$1.name) {
					_tmp = offset$1; _tmp$1 = isDST$1; _tmp$2 = true; offset = _tmp; isDST = _tmp$1; ok = _tmp$2;
					return [offset, isDST, ok];
				}
			}
			_i++;
		}
		_ref$1 = l.zone;
		_i$1 = 0;
		while (_i$1 < _ref$1.length) {
			i$1 = _i$1;
			zone$2 = (x$2 = l.zone, ((i$1 < 0 || i$1 >= x$2.length) ? go$throwRuntimeError("index out of range") : x$2.array[x$2.offset + i$1]));
			if (zone$2.name === name) {
				_tmp$3 = zone$2.offset; _tmp$4 = zone$2.isDST; _tmp$5 = true; offset = _tmp$3; isDST = _tmp$4; ok = _tmp$5;
				return [offset, isDST, ok];
			}
			_i$1++;
		}
		return [offset, isDST, ok];
	};
	Location.prototype.lookupName = function(name, unix) { return this.go$val.lookupName(name, unix); };
	getKeyValue = function(kh, kname) {
		var buf, typ, n, _tuple, p, v, v$1, err;
		buf = go$makeNativeArray("Uint16", 50, function() { return 0; });
		typ = 0;
		n = 100;
		_tuple = syscall.UTF16PtrFromString(kname); p = _tuple[0];
		err = syscall.RegQueryValueEx(kh, p, (go$ptrType(Go$Uint32)).nil, new (go$ptrType(Go$Uint32))(function() { return typ; }, function(v) { typ = v;; }), go$sliceToArray(new (go$sliceType(Go$Uint8))(buf)), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1;; }));
		if (!(go$interfaceIsEqual(err, null))) {
			return ["", err];
		}
		if (!((typ === 1))) {
			return ["", errors.New("Key is not string")];
		}
		return [syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(buf)), null];
	};
	matchZoneKey = function(zones, kname, stdname, dstname) {
		var matched, err2, h, _tuple, p, v, err, _tmp, _tmp$1, _tuple$1, s, err$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tuple$2, _tmp$6, _tmp$7, _tmp$8, _tmp$9, _tmp$10, _tmp$11;
		matched = false;
		err2 = null;
		var go$deferred = [];
		try {
			h = 0;
			_tuple = syscall.UTF16PtrFromString(kname); p = _tuple[0];
			err = syscall.RegOpenKeyEx(zones, p, 0, 131097, new (go$ptrType(syscall.Handle))(function() { return h; }, function(v) { h = v;; }));
			if (!(go$interfaceIsEqual(err, null))) {
				_tmp = false; _tmp$1 = err; matched = _tmp; err2 = _tmp$1;
				return [matched, err2];
			}
			go$deferred.push({ recv: syscall, method: "RegCloseKey", args: [h] });
			_tuple$1 = getKeyValue(h, "Std"); s = _tuple$1[0]; err$1 = _tuple$1[1];
			if (!(go$interfaceIsEqual(err$1, null))) {
				_tmp$2 = false; _tmp$3 = err$1; matched = _tmp$2; err2 = _tmp$3;
				return [matched, err2];
			}
			if (!(s === stdname)) {
				_tmp$4 = false; _tmp$5 = null; matched = _tmp$4; err2 = _tmp$5;
				return [matched, err2];
			}
			_tuple$2 = getKeyValue(h, "Dlt"); s = _tuple$2[0]; err$1 = _tuple$2[1];
			if (!(go$interfaceIsEqual(err$1, null))) {
				_tmp$6 = false; _tmp$7 = err$1; matched = _tmp$6; err2 = _tmp$7;
				return [matched, err2];
			}
			if (!(s === dstname)) {
				_tmp$8 = false; _tmp$9 = null; matched = _tmp$8; err2 = _tmp$9;
				return [matched, err2];
			}
			_tmp$10 = true; _tmp$11 = null; matched = _tmp$10; err2 = _tmp$11;
			return [matched, err2];
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
			return [matched, err2];
		}
	};
	toEnglishName = function(stdname, dstname) {
		var zones, _tuple, p, v, err, count, v$1, err$1, buf, i, n, v$2, v$3, kname, _tuple$1, matched, err$2;
		var go$deferred = [];
		try {
			zones = 0;
			_tuple = syscall.UTF16PtrFromString("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Time Zones"); p = _tuple[0];
			err = syscall.RegOpenKeyEx(2147483650, p, 0, 131097, new (go$ptrType(syscall.Handle))(function() { return zones; }, function(v) { zones = v;; }));
			if (!(go$interfaceIsEqual(err, null))) {
				return ["", err];
			}
			go$deferred.push({ recv: syscall, method: "RegCloseKey", args: [zones] });
			count = 0;
			err$1 = syscall.RegQueryInfoKey(zones, (go$ptrType(Go$Uint16)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, new (go$ptrType(Go$Uint32))(function() { return count; }, function(v$1) { count = v$1;; }), (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(syscall.Filetime)).nil);
			if (!(go$interfaceIsEqual(err$1, null))) {
				return ["", err$1];
			}
			buf = go$makeNativeArray("Uint16", 50, function() { return 0; });
			i = 0;
			while (i < count) {
				n = [undefined];
				n[0] = 50;
				if (!(go$interfaceIsEqual(syscall.RegEnumKeyEx(zones, i, (function(n) { return new (go$ptrType(Go$Uint16))(function() { return buf[0]; }, function(v$2) { buf[0] = v$2;; }); })(n), (function(n) { return new (go$ptrType(Go$Uint32))(function() { return n[0]; }, function(v$3) { n[0] = v$3;; }); })(n), (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint16)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(syscall.Filetime)).nil), null))) {
					i = i + 1 >>> 0;
					continue;
				}
				kname = syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(buf));
				_tuple$1 = matchZoneKey(zones, kname, stdname, dstname); matched = _tuple$1[0]; err$2 = _tuple$1[1];
				if (go$interfaceIsEqual(err$2, null) && matched) {
					return [kname, null];
				}
				i = i + 1 >>> 0;
			}
			return ["", errors.New("English name for time zone \"" + stdname + "\" not found in registry")];
		} catch(go$err) {
			go$pushErr(go$err);
			return ["", null];
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	extractCAPS = function(desc) {
		var short$1, _ref, _i, _rune, c;
		short$1 = (go$sliceType(Go$Int32)).nil;
		_ref = desc;
		_i = 0;
		while (_i < _ref.length) {
			_rune = go$decodeRune(_ref, _i);
			c = _rune[0];
			if (65 <= c && c <= 90) {
				short$1 = go$append(short$1, c);
			}
			_i += _rune[1];
		}
		return go$runesToString(short$1);
	};
	abbrev = function(z) {
		var std, dst, stdName, _tuple, _entry, _struct, a, ok, dstName, _tuple$1, englishName, err, _tuple$2, _entry$1, _struct$1, _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5;
		std = "";
		dst = "";
		stdName = syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(z.StandardName));
		_tuple = (_entry = abbrs[stdName], _entry !== undefined ? [_entry.v, true] : [new abbr.Ptr(), false]); a = (_struct = _tuple[0], new abbr.Ptr(_struct.std, _struct.dst)); ok = _tuple[1];
		if (!ok) {
			dstName = syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(z.DaylightName));
			_tuple$1 = toEnglishName(stdName, dstName); englishName = _tuple$1[0]; err = _tuple$1[1];
			if (go$interfaceIsEqual(err, null)) {
				_tuple$2 = (_entry$1 = abbrs[englishName], _entry$1 !== undefined ? [_entry$1.v, true] : [new abbr.Ptr(), false]); a = (_struct$1 = _tuple$2[0], new abbr.Ptr(_struct$1.std, _struct$1.dst)); ok = _tuple$2[1];
				if (ok) {
					_tmp = a.std; _tmp$1 = a.dst; std = _tmp; dst = _tmp$1;
					return [std, dst];
				}
			}
			_tmp$2 = extractCAPS(stdName); _tmp$3 = extractCAPS(dstName); std = _tmp$2; dst = _tmp$3;
			return [std, dst];
		}
		_tmp$4 = a.std; _tmp$5 = a.dst; std = _tmp$4; dst = _tmp$5;
		return [std, dst];
	};
	pseudoUnix = function(year, d) {
		var day, _struct, t, i, week, x, x$1, x$2;
		day = 1;
		t = (_struct = Date(year, (d.Month >> 0), day, (d.Hour >> 0), (d.Minute >> 0), (d.Second >> 0), 0, go$pkg.UTC), new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		i = (d.DayOfWeek >> 0) - (t.Weekday() >> 0) >> 0;
		if (i < 0) {
			i = i + 7 >> 0;
		}
		day = day + (i) >> 0;
		week = (d.Day >> 0) - 1 >> 0;
		if (week < 4) {
			day = day + (((((week >>> 16 << 16) * 7 >> 0) + (week << 16 >>> 16) * 7) >> 0)) >> 0;
		} else {
			day = day + 28 >> 0;
			if (day > daysIn((d.Month >> 0), year)) {
				day = day - 7 >> 0;
			}
		}
		return (x = (x$1 = t.sec, x$2 = go$mul64(new Go$Int64(0, (day - 1 >> 0)), new Go$Int64(0, 86400)), new Go$Int64(x$1.high + x$2.high, x$1.low + x$2.low)), new Go$Int64(x.high + -15, x.low + 2288912640));
	};
	initLocalFromTZI = function(i) {
		var l, nzone, _tuple, stdname, dstname, x, std, x$1, x$2, x$3, x$4, x$5, dst, x$6, d0, d1, i0, i1, _tmp, _tmp$1, _tmp$2, _tmp$3, _struct, t, year, txi, y, x$7, tx, x$8, x$9, x$10, x$11, x$12, x$13, x$14;
		l = localLoc;
		nzone = 1;
		if (i.StandardDate.Month > 0) {
			nzone = nzone + 1 >> 0;
		}
		l.zone = (go$sliceType(zone)).make(nzone, 0, function() { return new zone.Ptr(); });
		_tuple = abbrev(i); stdname = _tuple[0]; dstname = _tuple[1];
		std = (x = l.zone, ((0 < 0 || 0 >= x.length) ? go$throwRuntimeError("index out of range") : x.array[x.offset + 0]));
		std.name = stdname;
		if (nzone === 1) {
			std.offset = (x$1 = -(i.Bias >> 0), (((x$1 >>> 16 << 16) * 60 >> 0) + (x$1 << 16 >>> 16) * 60) >> 0);
			l.cacheStart = new Go$Int64(-2147483648, 0);
			l.cacheEnd = new Go$Int64(2147483647, 4294967295);
			l.cacheZone = std;
			l.tx = (go$sliceType(zoneTrans)).make(1, 0, function() { return new zoneTrans.Ptr(); });
			(x$2 = l.tx, ((0 < 0 || 0 >= x$2.length) ? go$throwRuntimeError("index out of range") : x$2.array[x$2.offset + 0])).when = l.cacheStart;
			(x$3 = l.tx, ((0 < 0 || 0 >= x$3.length) ? go$throwRuntimeError("index out of range") : x$3.array[x$3.offset + 0])).index = 0;
			return;
		}
		std.offset = (x$4 = -((i.Bias + i.StandardBias >> 0) >> 0), (((x$4 >>> 16 << 16) * 60 >> 0) + (x$4 << 16 >>> 16) * 60) >> 0);
		dst = (x$5 = l.zone, ((1 < 0 || 1 >= x$5.length) ? go$throwRuntimeError("index out of range") : x$5.array[x$5.offset + 1]));
		dst.name = dstname;
		dst.offset = (x$6 = -((i.Bias + i.DaylightBias >> 0) >> 0), (((x$6 >>> 16 << 16) * 60 >> 0) + (x$6 << 16 >>> 16) * 60) >> 0);
		dst.isDST = true;
		d0 = i.StandardDate;
		d1 = i.DaylightDate;
		i0 = 0;
		i1 = 1;
		if (d0.Month > d1.Month) {
			_tmp = d1; _tmp$1 = d0; d0 = _tmp; d1 = _tmp$1;
			_tmp$2 = i1; _tmp$3 = i0; i0 = _tmp$2; i1 = _tmp$3;
		}
		l.tx = (go$sliceType(zoneTrans)).make(400, 0, function() { return new zoneTrans.Ptr(); });
		t = (_struct = Now().UTC(), new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		year = t.Year();
		txi = 0;
		y = year - 100 >> 0;
		while (y < (year + 100 >> 0)) {
			tx = (x$7 = l.tx, ((txi < 0 || txi >= x$7.length) ? go$throwRuntimeError("index out of range") : x$7.array[x$7.offset + txi]));
			tx.when = (x$8 = pseudoUnix(y, d0), x$9 = new Go$Int64(0, (x$10 = l.zone, ((i1 < 0 || i1 >= x$10.length) ? go$throwRuntimeError("index out of range") : x$10.array[x$10.offset + i1])).offset), new Go$Int64(x$8.high - x$9.high, x$8.low - x$9.low));
			tx.index = (i0 << 24 >>> 24);
			txi = txi + 1 >> 0;
			tx = (x$11 = l.tx, ((txi < 0 || txi >= x$11.length) ? go$throwRuntimeError("index out of range") : x$11.array[x$11.offset + txi]));
			tx.when = (x$12 = pseudoUnix(y, d1), x$13 = new Go$Int64(0, (x$14 = l.zone, ((i0 < 0 || i0 >= x$14.length) ? go$throwRuntimeError("index out of range") : x$14.array[x$14.offset + i0])).offset), new Go$Int64(x$12.high - x$13.high, x$12.low - x$13.low));
			tx.index = (i1 << 24 >>> 24);
			txi = txi + 1 >> 0;
			y = y + 1 >> 0;
		}
	};
	initLocal = function() {
		var i, _tuple, err;
		i = new syscall.Timezoneinformation.Ptr();
		_tuple = syscall.GetTimeZoneInformation(i); err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			localLoc.name = "UTC";
			return;
		}
		initLocalFromTZI(i);
	};
	go$pkg.init = function() {
		(go$ptrType(ParseError)).methods = [["Error", "Error", "", [], [Go$String], false, -1]];
		ParseError.init([["Layout", "Layout", "", Go$String, ""], ["Value", "Value", "", Go$String, ""], ["LayoutElem", "LayoutElem", "", Go$String, ""], ["ValueElem", "ValueElem", "", Go$String, ""], ["Message", "Message", "", Go$String, ""]]);
		Time.methods = [["Add", "Add", "", [Duration], [Time], false, -1], ["AddDate", "AddDate", "", [Go$Int, Go$Int, Go$Int], [Time], false, -1], ["After", "After", "", [Time], [Go$Bool], false, -1], ["Before", "Before", "", [Time], [Go$Bool], false, -1], ["Clock", "Clock", "", [], [Go$Int, Go$Int, Go$Int], false, -1], ["Date", "Date", "", [], [Go$Int, Month, Go$Int], false, -1], ["Day", "Day", "", [], [Go$Int], false, -1], ["Equal", "Equal", "", [Time], [Go$Bool], false, -1], ["Format", "Format", "", [Go$String], [Go$String], false, -1], ["GobEncode", "GobEncode", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["Hour", "Hour", "", [], [Go$Int], false, -1], ["ISOWeek", "ISOWeek", "", [], [Go$Int, Go$Int], false, -1], ["In", "In", "", [(go$ptrType(Location))], [Time], false, -1], ["IsZero", "IsZero", "", [], [Go$Bool], false, -1], ["Local", "Local", "", [], [Time], false, -1], ["Location", "Location", "", [], [(go$ptrType(Location))], false, -1], ["MarshalBinary", "MarshalBinary", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["MarshalJSON", "MarshalJSON", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["MarshalText", "MarshalText", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["Minute", "Minute", "", [], [Go$Int], false, -1], ["Month", "Month", "", [], [Month], false, -1], ["Nanosecond", "Nanosecond", "", [], [Go$Int], false, -1], ["Round", "Round", "", [Duration], [Time], false, -1], ["Second", "Second", "", [], [Go$Int], false, -1], ["String", "String", "", [], [Go$String], false, -1], ["Sub", "Sub", "", [Time], [Duration], false, -1], ["Truncate", "Truncate", "", [Duration], [Time], false, -1], ["UTC", "UTC", "", [], [Time], false, -1], ["Unix", "Unix", "", [], [Go$Int64], false, -1], ["UnixNano", "UnixNano", "", [], [Go$Int64], false, -1], ["Weekday", "Weekday", "", [], [Weekday], false, -1], ["Year", "Year", "", [], [Go$Int], false, -1], ["YearDay", "YearDay", "", [], [Go$Int], false, -1], ["Zone", "Zone", "", [], [Go$String, Go$Int], false, -1], ["abs", "abs", "time", [], [Go$Uint64], false, -1], ["date", "date", "time", [Go$Bool], [Go$Int, Month, Go$Int, Go$Int], false, -1], ["locabs", "locabs", "time", [], [Go$String, Go$Int, Go$Uint64], false, -1]];
		(go$ptrType(Time)).methods = [["Add", "Add", "", [Duration], [Time], false, -1], ["AddDate", "AddDate", "", [Go$Int, Go$Int, Go$Int], [Time], false, -1], ["After", "After", "", [Time], [Go$Bool], false, -1], ["Before", "Before", "", [Time], [Go$Bool], false, -1], ["Clock", "Clock", "", [], [Go$Int, Go$Int, Go$Int], false, -1], ["Date", "Date", "", [], [Go$Int, Month, Go$Int], false, -1], ["Day", "Day", "", [], [Go$Int], false, -1], ["Equal", "Equal", "", [Time], [Go$Bool], false, -1], ["Format", "Format", "", [Go$String], [Go$String], false, -1], ["GobDecode", "GobDecode", "", [(go$sliceType(Go$Uint8))], [go$error], false, -1], ["GobEncode", "GobEncode", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["Hour", "Hour", "", [], [Go$Int], false, -1], ["ISOWeek", "ISOWeek", "", [], [Go$Int, Go$Int], false, -1], ["In", "In", "", [(go$ptrType(Location))], [Time], false, -1], ["IsZero", "IsZero", "", [], [Go$Bool], false, -1], ["Local", "Local", "", [], [Time], false, -1], ["Location", "Location", "", [], [(go$ptrType(Location))], false, -1], ["MarshalBinary", "MarshalBinary", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["MarshalJSON", "MarshalJSON", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["MarshalText", "MarshalText", "", [], [(go$sliceType(Go$Uint8)), go$error], false, -1], ["Minute", "Minute", "", [], [Go$Int], false, -1], ["Month", "Month", "", [], [Month], false, -1], ["Nanosecond", "Nanosecond", "", [], [Go$Int], false, -1], ["Round", "Round", "", [Duration], [Time], false, -1], ["Second", "Second", "", [], [Go$Int], false, -1], ["String", "String", "", [], [Go$String], false, -1], ["Sub", "Sub", "", [Time], [Duration], false, -1], ["Truncate", "Truncate", "", [Duration], [Time], false, -1], ["UTC", "UTC", "", [], [Time], false, -1], ["Unix", "Unix", "", [], [Go$Int64], false, -1], ["UnixNano", "UnixNano", "", [], [Go$Int64], false, -1], ["UnmarshalBinary", "UnmarshalBinary", "", [(go$sliceType(Go$Uint8))], [go$error], false, -1], ["UnmarshalJSON", "UnmarshalJSON", "", [(go$sliceType(Go$Uint8))], [go$error], false, -1], ["UnmarshalText", "UnmarshalText", "", [(go$sliceType(Go$Uint8))], [go$error], false, -1], ["Weekday", "Weekday", "", [], [Weekday], false, -1], ["Year", "Year", "", [], [Go$Int], false, -1], ["YearDay", "YearDay", "", [], [Go$Int], false, -1], ["Zone", "Zone", "", [], [Go$String, Go$Int], false, -1], ["abs", "abs", "time", [], [Go$Uint64], false, -1], ["date", "date", "time", [Go$Bool], [Go$Int, Month, Go$Int, Go$Int], false, -1], ["locabs", "locabs", "time", [], [Go$String, Go$Int, Go$Uint64], false, -1]];
		Time.init([["sec", "sec", "time", Go$Int64, ""], ["nsec", "nsec", "time", Go$Uintptr, ""], ["loc", "loc", "time", (go$ptrType(Location)), ""]]);
		Month.methods = [["String", "String", "", [], [Go$String], false, -1]];
		(go$ptrType(Month)).methods = [["String", "String", "", [], [Go$String], false, -1]];
		Weekday.methods = [["String", "String", "", [], [Go$String], false, -1]];
		(go$ptrType(Weekday)).methods = [["String", "String", "", [], [Go$String], false, -1]];
		Duration.methods = [["Hours", "Hours", "", [], [Go$Float64], false, -1], ["Minutes", "Minutes", "", [], [Go$Float64], false, -1], ["Nanoseconds", "Nanoseconds", "", [], [Go$Int64], false, -1], ["Seconds", "Seconds", "", [], [Go$Float64], false, -1], ["String", "String", "", [], [Go$String], false, -1]];
		(go$ptrType(Duration)).methods = [["Hours", "Hours", "", [], [Go$Float64], false, -1], ["Minutes", "Minutes", "", [], [Go$Float64], false, -1], ["Nanoseconds", "Nanoseconds", "", [], [Go$Int64], false, -1], ["Seconds", "Seconds", "", [], [Go$Float64], false, -1], ["String", "String", "", [], [Go$String], false, -1]];
		(go$ptrType(Location)).methods = [["String", "String", "", [], [Go$String], false, -1], ["get", "get", "time", [], [(go$ptrType(Location))], false, -1], ["lookup", "lookup", "time", [Go$Int64], [Go$String, Go$Int, Go$Bool, Go$Int64, Go$Int64], false, -1], ["lookupName", "lookupName", "time", [Go$String, Go$Int64], [Go$Int, Go$Bool, Go$Bool], false, -1]];
		Location.init([["name", "name", "time", Go$String, ""], ["zone", "zone", "time", (go$sliceType(zone)), ""], ["tx", "tx", "time", (go$sliceType(zoneTrans)), ""], ["cacheStart", "cacheStart", "time", Go$Int64, ""], ["cacheEnd", "cacheEnd", "time", Go$Int64, ""], ["cacheZone", "cacheZone", "time", (go$ptrType(zone)), ""]]);
		zone.init([["name", "name", "time", Go$String, ""], ["offset", "offset", "time", Go$Int, ""], ["isDST", "isDST", "time", Go$Bool, ""]]);
		zoneTrans.init([["when", "when", "time", Go$Int64, ""], ["index", "index", "time", Go$Uint8, ""], ["isstd", "isstd", "time", Go$Bool, ""], ["isutc", "isutc", "time", Go$Bool, ""]]);
		abbr.init([["std", "std", "time", Go$String, ""], ["dst", "dst", "time", Go$String, ""]]);
		localLoc = new Location.Ptr();
		localOnce = new sync.Once.Ptr();
		std0x = go$toNativeArray("Int", [260, 265, 524, 526, 528, 274]);
		longDayNames = new (go$sliceType(Go$String))(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
		shortDayNames = new (go$sliceType(Go$String))(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
		shortMonthNames = new (go$sliceType(Go$String))(["---", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
		longMonthNames = new (go$sliceType(Go$String))(["---", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
		atoiError = errors.New("time: invalid number");
		errBad = errors.New("bad value for field");
		errLeadingInt = errors.New("time: bad [0-9]*");
		months = go$toNativeArray("String", ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
		days = go$toNativeArray("String", ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
		daysBefore = go$toNativeArray("Int32", [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365]);
		utcLoc = new Location.Ptr("UTC", (go$sliceType(zone)).nil, (go$sliceType(zoneTrans)).nil, new Go$Int64(0, 0), new Go$Int64(0, 0), (go$ptrType(zone)).nil);
		go$pkg.UTC = utcLoc;
		go$pkg.Local = localLoc;
		var _tuple;
		_tuple = syscall.Getenv("ZONEINFO"); zoneinfo = _tuple[0];
		var _map$1, _key$1;
		abbrs = (_map$1 = new Go$Map(), _key$1 = "Egypt Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EET") }, _key$1 = "Morocco Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WET", "WEST") }, _key$1 = "South Africa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("SAST", "SAST") }, _key$1 = "W. Central Africa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WAT", "WAT") }, _key$1 = "E. Africa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EAT", "EAT") }, _key$1 = "Namibia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WAT", "WAST") }, _key$1 = "Alaskan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AKST", "AKDT") }, _key$1 = "Paraguay Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PYT", "PYST") }, _key$1 = "Bahia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BRT", "BRST") }, _key$1 = "SA Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("COT", "COT") }, _key$1 = "Argentina Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ART", "ART") }, _key$1 = "Venezuela Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("VET", "VET") }, _key$1 = "SA Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GFT", "GFT") }, _key$1 = "Central Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CDT") }, _key$1 = "Mountain Standard Time (Mexico)", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MST", "MDT") }, _key$1 = "Central Brazilian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AMT", "AMST") }, _key$1 = "Mountain Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MST", "MDT") }, _key$1 = "Greenland Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WGT", "WGST") }, _key$1 = "Central America Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Atlantic Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AST", "ADT") }, _key$1 = "US Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EDT") }, _key$1 = "SA Western Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BOT", "BOT") }, _key$1 = "Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PST", "PDT") }, _key$1 = "Central Standard Time (Mexico)", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CDT") }, _key$1 = "Montevideo Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("UYT", "UYST") }, _key$1 = "Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EDT") }, _key$1 = "US Mountain Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MST", "MST") }, _key$1 = "Canada Central Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Pacific Standard Time (Mexico)", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PST", "PDT") }, _key$1 = "Pacific SA Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CLT", "CLST") }, _key$1 = "E. South America Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BRT", "BRST") }, _key$1 = "Newfoundland Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NST", "NDT") }, _key$1 = "Central Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ALMT", "ALMT") }, _key$1 = "Jordan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Arabic Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AST", "AST") }, _key$1 = "Azerbaijan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AZT", "AZST") }, _key$1 = "SE Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ICT", "ICT") }, _key$1 = "Middle East Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "India Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IST", "IST") }, _key$1 = "Sri Lanka Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IST", "IST") }, _key$1 = "Syria Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Bangladesh Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BDT", "BDT") }, _key$1 = "Arabian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GST", "GST") }, _key$1 = "North Asia East Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IRKT", "IRKT") }, _key$1 = "Israel Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IST", "IDT") }, _key$1 = "Afghanistan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AFT", "AFT") }, _key$1 = "Pakistan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PKT", "PKT") }, _key$1 = "Nepal Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NPT", "NPT") }, _key$1 = "North Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("KRAT", "KRAT") }, _key$1 = "Magadan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MAGT", "MAGT") }, _key$1 = "E. Europe Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "N. Central Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NOVT", "NOVT") }, _key$1 = "Myanmar Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MMT", "MMT") }, _key$1 = "Arab Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AST", "AST") }, _key$1 = "Korea Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("KST", "KST") }, _key$1 = "China Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Singapore Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("SGT", "SGT") }, _key$1 = "Taipei Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "West Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("UZT", "UZT") }, _key$1 = "Georgian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GET", "GET") }, _key$1 = "Iran Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IRST", "IRDT") }, _key$1 = "Tokyo Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("JST", "JST") }, _key$1 = "Ulaanbaatar Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ULAT", "ULAT") }, _key$1 = "Vladivostok Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("VLAT", "VLAT") }, _key$1 = "Yakutsk Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("YAKT", "YAKT") }, _key$1 = "Ekaterinburg Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("YEKT", "YEKT") }, _key$1 = "Caucasus Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AMT", "AMT") }, _key$1 = "Azores Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AZOT", "AZOST") }, _key$1 = "Cape Verde Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CVT", "CVT") }, _key$1 = "Greenwich Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT", "GMT") }, _key$1 = "Cen. Australia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "E. Australia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EST") }, _key$1 = "AUS Central Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Tasmania Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EST") }, _key$1 = "W. Australia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WST", "WST") }, _key$1 = "AUS Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EST") }, _key$1 = "UTC", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT", "GMT") }, _key$1 = "UTC-11", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT+11", "GMT+11") }, _key$1 = "Dateline Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT+12", "GMT+12") }, _key$1 = "UTC-02", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT+2", "GMT+2") }, _key$1 = "UTC+12", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT-12", "GMT-12") }, _key$1 = "W. Europe Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "GTB Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Central Europe Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "Turkey Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Kaliningrad Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("FET", "FET") }, _key$1 = "FLE Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "GMT Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT", "BST") }, _key$1 = "Russian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MSK", "MSK") }, _key$1 = "Romance Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "Central European Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "Mauritius Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MUT", "MUT") }, _key$1 = "Samoa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WST", "WST") }, _key$1 = "New Zealand Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NZST", "NZDT") }, _key$1 = "Fiji Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("FJT", "FJT") }, _key$1 = "Central Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("SBT", "SBT") }, _key$1 = "Hawaiian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("HST", "HST") }, _key$1 = "West Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PGT", "PGT") }, _key$1 = "Tonga Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("TOT", "TOT") }, _map$1);
		badData = errors.New("malformed time zone information");
	}
	return go$pkg;
})();
go$packages["main"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], jquery = go$packages["github.com/gopherjs/jquery"], qunit = go$packages["github.com/rusco/qunit"], strconv = go$packages["strconv"], strings = go$packages["strings"], time = go$packages["time"], Object, EvtScenario, working, getDocumentBody, stringify, NewWorking, asyncEvent, main, jQuery, countJohn, countKarl;
	Object = go$pkg.Object = go$newType(4, "Map", "test.Object", "Object", "main", null);
	EvtScenario = go$pkg.EvtScenario = go$newType(0, "Struct", "test.EvtScenario", "EvtScenario", "main", function() {
		this.go$val = this;
	});
	working = go$pkg.working = go$newType(0, "Struct", "test.working", "working", "main", function(Deferred_) {
		this.go$val = this;
		this.Deferred = Deferred_ !== undefined ? Deferred_ : new jquery.Deferred.Ptr();
	});
	EvtScenario.Ptr.prototype.Setup = function() {
		var _struct, s;
		s = (_struct = this, new EvtScenario.Ptr());
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<p id=\"firstp\">See \n\t\t\t<a id=\"someid\" href=\"somehref\" rel=\"bookmark\">this blog entry</a>\n\t\t\tfor more information.</p>")])).AppendTo(new Go$String("#qunit-fixture"));
	};
	EvtScenario.prototype.Setup = function() { return this.go$val.Setup(); };
	EvtScenario.Ptr.prototype.Teardown = function() {
		var _struct, s;
		s = (_struct = this, new EvtScenario.Ptr());
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Empty();
	};
	EvtScenario.prototype.Teardown = function() { return this.go$val.Teardown(); };
	getDocumentBody = function() {
		return go$global.document.body;
	};
	stringify = function(i) {
		return go$internalize(go$global.JSON.stringify(go$externalize(i, go$emptyInterface)), Go$String);
	};
	NewWorking = go$pkg.NewWorking = function(d) {
		var _struct;
		return new working.Ptr((_struct = d, new jquery.Deferred.Ptr(_struct.Object)));
	};
	working.Ptr.prototype.notify = function() {
		var _struct, _struct$1, w, _recv;
		w = (_struct = this, new working.Ptr((_struct$1 = _struct.Deferred, new jquery.Deferred.Ptr(_struct$1.Object))));
		if (w.Deferred.State() === "pending") {
			w.Deferred.Notify(new Go$String("working... "));
			go$global.setTimeout(go$externalize((_recv = w, function() { return _recv.notify(); }), (go$funcType([], [], false))), 500);
		}
	};
	working.prototype.notify = function() { return this.go$val.notify(); };
	working.Ptr.prototype.hi = function(name) {
		var _struct, _struct$1, w;
		w = (_struct = this, new working.Ptr((_struct$1 = _struct.Deferred, new jquery.Deferred.Ptr(_struct$1.Object))));
		if (name === "John") {
			countJohn = countJohn + 1 >> 0;
		} else if (name === "Karl") {
			countKarl = countKarl + 1 >> 0;
		}
	};
	working.prototype.hi = function(name) { return this.go$val.hi(name); };
	asyncEvent = function(accept, i) {
		var _struct, dfd, _struct$1, _struct$2, _struct$3, wx, _recv;
		dfd = (_struct = jquery.NewDeferred(), new jquery.Deferred.Ptr(_struct.Object));
		if (accept) {
			go$global.setTimeout(go$externalize((function() {
				dfd.Resolve(new (go$sliceType(go$emptyInterface))([new Go$String("hurray")]));
			}), (go$funcType([], [], false))), (((200 >>> 16 << 16) * i >> 0) + (200 << 16 >>> 16) * i) >> 0);
		} else {
			go$global.setTimeout(go$externalize((function() {
				dfd.Reject(new (go$sliceType(go$emptyInterface))([new Go$String("sorry")]));
			}), (go$funcType([], [], false))), (((210 >>> 16 << 16) * i >> 0) + (210 << 16 >>> 16) * i) >> 0);
		}
		wx = (_struct$2 = NewWorking((_struct$1 = dfd, new jquery.Deferred.Ptr(_struct$1.Object))), new working.Ptr((_struct$3 = _struct$2.Deferred, new jquery.Deferred.Ptr(_struct$3.Object))));
		go$global.setTimeout(go$externalize((_recv = wx, function() { return _recv.notify(); }), (go$funcType([], [], false))), 1);
		return dfd.Promise();
	};
	main = go$pkg.main = function() {
		var x;
		qunit.Module("Core");
		qunit.Test("jQuery Properties", (function(assert) {
			var _struct, jQ2;
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([])).o.jquery, Go$String)), new Go$String("2.1.1"), "JQuery Version");
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([])).o.length, Go$String)), new Go$Int(0), "jQuery().Length");
			jQ2 = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("body")])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$String(go$internalize(jQ2.o.selector, Go$String)), new Go$String("body"), "jQ2 := jQuery(\"body\"); jQ2.Selector.Selector");
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("body")])).o.selector, Go$String)), new Go$String("body"), "jQuery(\"body\").Selector");
		}));
		qunit.Test("Test Setup", (function(assert) {
			var _struct, test;
			test = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([getDocumentBody()])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$String(go$internalize(test.o.selector, Go$String)), new Go$String("#qunit-fixture"), "#qunit-fixture find Selector");
			assert.Equal(new Go$String(go$internalize(test.o.context, Go$String)), getDocumentBody(), "#qunit-fixture find Context");
		}));
		qunit.Test("Static Functions", (function(assert) {
			var x, _map, _key, o, _map$1, _key$1;
			jquery.GlobalEval("var globalEvalTest = 2;");
			assert.Equal(new Go$Int((go$parseInt(go$global.globalEvalTest) >> 0)), new Go$Int(2), "GlobalEval: Test variable declarations are global");
			assert.Equal(new Go$String(jquery.Trim("  GopherJS  ")), new Go$String("GopherJS"), "Trim: leading and trailing space");
			assert.Equal(new Go$String(jquery.Type(new Go$Bool(true))), new Go$String("boolean"), "Type: Boolean");
			assert.Equal(new Go$String(jquery.Type((x = time.Now(), new x.constructor.Struct(x)))), new Go$String("date"), "Type: Date");
			assert.Equal(new Go$String(jquery.Type(new Go$String("GopherJS"))), new Go$String("string"), "Type: String");
			assert.Equal(new Go$String(jquery.Type(new Go$Float64(12.21))), new Go$String("number"), "Type: Number");
			assert.Equal(new Go$String(jquery.Type(null)), new Go$String("null"), "Type: Null");
			assert.Equal(new Go$String(jquery.Type(new (go$arrayType(Go$String, 2))(go$toNativeArray("String", ["go", "lang"])))), new Go$String("array"), "Type: Array");
			assert.Equal(new Go$String(jquery.Type(new (go$sliceType(Go$String))(["go", "lang"]))), new Go$String("array"), "Type: Array");
			o = (_map = new Go$Map(), _key = "a", _map[_key] = { k: _key, v: new Go$Bool(true) }, _key = "b", _map[_key] = { k: _key, v: new Go$Float64(1.1) }, _key = "c", _map[_key] = { k: _key, v: new Go$String("more") }, _map);
			assert.Equal(new Go$String(jquery.Type(new (go$mapType(Go$String, go$emptyInterface))(o))), new Go$String("object"), "Type: Object");
			assert.Equal(new Go$String(jquery.Type(new (go$funcType([], [js.Object], false))(getDocumentBody))), new Go$String("function"), "Type: Function");
			assert.Ok(new Go$Bool(!jquery.IsPlainObject(new Go$String(""))), "IsPlainObject: string");
			assert.Ok(new Go$Bool(jquery.IsPlainObject(new (go$mapType(Go$String, go$emptyInterface))(o))), "IsPlainObject: Object");
			assert.Ok(new Go$Bool(!jquery.IsEmptyObject(new (go$mapType(Go$String, go$emptyInterface))(o))), "IsEmptyObject: Object");
			assert.Ok(new Go$Bool(jquery.IsEmptyObject(new (go$mapType(Go$String, go$emptyInterface))((_map$1 = new Go$Map(), _map$1)))), "IsEmptyObject: Object");
			assert.Ok(new Go$Bool(!jquery.IsFunction(new Go$String(""))), "IsFunction: string");
			assert.Ok(new Go$Bool(jquery.IsFunction(new (go$funcType([], [js.Object], false))(getDocumentBody))), "IsFunction: getDocumentBody");
			assert.Ok(new Go$Bool(!jquery.IsNumeric(new Go$String("a3a"))), "IsNumeric: string");
			assert.Ok(new Go$Bool(jquery.IsNumeric(new Go$String("0xFFF"))), "IsNumeric: hex");
			assert.Ok(new Go$Bool(jquery.IsNumeric(new Go$String("8e-2"))), "IsNumeric: exponential");
			assert.Ok(new Go$Bool(!jquery.IsXMLDoc(new (go$funcType([], [js.Object], false))(getDocumentBody))), "HTML Body element");
			assert.Ok(new Go$Bool(jquery.IsWindow(go$global)), "window");
		}));
		qunit.Test("ToArray,InArray", (function(assert) {
			var _struct, divs, str, _ref, _i, v, arr;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<div>a</div>\n\t\t\t\t<div>b</div>\n\t\t\t\t<div>c</div>")])).AppendTo(new Go$String("#qunit-fixture"));
			divs = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$String(go$internalize(divs.o.length, Go$String)), new Go$Int(3), "3 divs in Fixture inserted");
			str = "";
			_ref = divs.ToArray();
			_i = 0;
			while (_i < _ref.length) {
				v = ((_i < 0 || _i >= _ref.length) ? go$throwRuntimeError("index out of range") : _ref.array[_ref.offset + _i]);
				str = str + (jQuery(new (go$sliceType(go$emptyInterface))([v])).Text());
				_i++;
			}
			assert.Equal(new Go$String(str), new Go$String("abc"), "ToArray() allows range over selection");
			arr = new (go$sliceType(go$emptyInterface))([new Go$String("a"), new Go$Int(3), new Go$Bool(true), new Go$Float64(2.2), new Go$String("GopherJS")]);
			assert.Equal(new Go$Int(jquery.InArray(new Go$Int(4), arr)), new Go$Int(-1), "InArray");
			assert.Equal(new Go$Int(jquery.InArray(new Go$Int(3), arr)), new Go$Int(1), "InArray");
			assert.Equal(new Go$Int(jquery.InArray(new Go$String("a"), arr)), new Go$Int(0), "InArray");
			assert.Equal(new Go$Int(jquery.InArray(new Go$String("b"), arr)), new Go$Int(-1), "InArray");
			assert.Equal(new Go$Int(jquery.InArray(new Go$String("GopherJS"), arr)), new Go$Int(4), "InArray");
		}));
		qunit.Test("ParseHTML, ParseXML, ParseJSON", (function(assert) {
			var str, arr, xml, xmlDoc, obj, x, _entry, language;
			str = "<ul>\n  \t\t\t\t<li class=\"firstclass\">list item 1</li>\n  \t\t\t\t<li>list item 2</li>\n  \t\t\t\t<li>list item 3</li>\n  \t\t\t\t<li>list item 4</li>\n  \t\t\t\t<li class=\"lastclass\">list item 5</li>\n\t\t\t\t</ul>";
			arr = jquery.ParseHTML(str);
			jQuery(new (go$sliceType(go$emptyInterface))([arr])).AppendTo(new Go$String("#qunit-fixture"));
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("ul li")])).o.length, Go$String)), new Go$Int(5), "ParseHTML");
			xml = "<rss version='2.0'><channel><title>RSS Title</title></channel></rss>";
			xmlDoc = jquery.ParseXML(xml);
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([xmlDoc])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("title")])).Text()), new Go$String("RSS Title"), "ParseXML");
			obj = jquery.ParseJSON("{ \"language\": \"go\" }");
			language = (x = (_entry = (obj !== null && obj.constructor === (go$mapType(Go$String, go$emptyInterface)) ? obj.go$val : go$typeAssertionFailed(obj, (go$mapType(Go$String, go$emptyInterface))))["language"], _entry !== undefined ? _entry.v : null), (x !== null && x.constructor === Go$String ? x.go$val : go$typeAssertionFailed(x, Go$String)));
			assert.Equal(new Go$String(language), new Go$String("go"), "ParseJSON");
		}));
		qunit.Test("Grep", (function(assert) {
			var arr, arr2;
			arr = new (go$sliceType(go$emptyInterface))([new Go$Int(1), new Go$Int(9), new Go$Int(3), new Go$Int(8), new Go$Int(6), new Go$Int(1), new Go$Int(5), new Go$Int(9), new Go$Int(4), new Go$Int(7), new Go$Int(3), new Go$Int(8), new Go$Int(6), new Go$Int(9), new Go$Int(1)]);
			arr2 = jquery.Grep(arr, (function(n, idx) {
				return !(((n !== null && n.constructor === Go$Float64 ? n.go$val : go$typeAssertionFailed(n, Go$Float64)) === 5)) && idx > 4;
			}));
			assert.Equal(new Go$Int(arr2.length), new Go$Int(9), "Grep");
		}));
		qunit.Test("Noop,Now", (function(assert) {
			var callSth, date, time$1;
			callSth = (function(fn) {
				return fn();
			});
			callSth(jquery.Noop);
			jquery.Noop();
			assert.Ok(new Go$Bool(jquery.IsFunction(new (go$funcType([], [go$emptyInterface], false))(jquery.Noop))), "jquery.Noop");
			date = new (go$global.Date)();
			time$1 = go$parseFloat(date.getTime());
			assert.Ok(new Go$Bool(time$1 <= jquery.Now()), "jquery.Now()");
		}));
		qunit.Module("Dom");
		qunit.Test("AddClass,Clone,Add,AppendTo,Find", (function(assert) {
			var txt, html;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).AddClass(new Go$String("wow")).Clone(new (go$sliceType(go$emptyInterface))([])).Add(new (go$sliceType(go$emptyInterface))([new Go$String("<span id='dom02'>WhatADay</span>")])).AppendTo(new Go$String("#qunit-fixture"));
			txt = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("span#dom02")])).Text();
			assert.Equal(new Go$String(txt), new Go$String("WhatADay"), "Test of Clone, Add, AppendTo, Find, Text Functions");
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Empty();
			html = "\n\t\t\t<div>This div should be white</div>\n\t\t\t<div class=\"red\">This div will be green because it now has the \"green\" and \"red\" classes.\n\t\t\t   It would be red if the addClass function failed.</div>\n\t\t\t<div>This div should be white</div>\n\t\t\t<p>There are zero green divs</p>\n\n\t\t\t<button>some btn</button>";
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(html)])).AppendTo(new Go$String("#qunit-fixture"));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).AddClass(new (go$funcType([Go$Int, Go$String], [Go$String], false))((function(index, currentClass) {
				var addedClass;
				addedClass = "";
				if (currentClass === "red") {
					addedClass = "green";
					jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).SetText(new Go$String("There is one green div"));
				}
				return addedClass;
			})));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("button")])).AddClass(new Go$String("red"));
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("button")])).HasClass("red")), "button hasClass red");
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).Text() === "There is one green div"), "There is one green div");
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div:eq(1)")])).HasClass("green")), "one div hasClass green");
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Empty();
		}));
		qunit.Test("Children,Append", (function(assert) {
			var _struct, j, x, x$1;
			j = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<div class=\"pipe animated\"><div class=\"pipe_upper\" style=\"height: 79px;\"></div><div class=\"guess top\" style=\"top: 114px;\"></div><div class=\"pipe_middle\" style=\"height: 100px; top: 179px;\"></div><div class=\"guess bottom\" style=\"bottom: 76px;\"></div><div class=\"pipe_lower\" style=\"height: 41px;\"></div><div class=\"question\"></div></div>")])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Ok(new Go$Bool((j.Html().length === 301)), "jQuery html len");
			j.Children(new Go$String(".question")).Append(new (go$sliceType(go$emptyInterface))([(x = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<div class = \"question_digit first\" style = \"background-image: url('assets/font_big_3.png');\"></div>")])), new x.constructor.Struct(x))]));
			assert.Ok(new Go$Bool((j.Html().length === 397)), "jquery html len after 1st jquery object append");
			j.Children(new Go$String(".question")).Append(new (go$sliceType(go$emptyInterface))([(x$1 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<div class = \"question_digit symbol\" style=\"background-image: url('assets/font_shitty_x.png');\"></div>")])), new x$1.constructor.Struct(x$1))]));
			assert.Ok(new Go$Bool((j.Html().length === 497)), "jquery htm len after 2nd jquery object append");
			j.Children(new Go$String(".question")).Append(new (go$sliceType(go$emptyInterface))([new Go$String("<div class = \"question_digit second\" style = \"background-image: url('assets/font_big_1.png');\"></div>")]));
			assert.Ok(new Go$Bool((j.Html().length === 594)), "jquery html len after html append");
		}));
		qunit.Test("ApiOnly:ScollFn,SetCss,CssArray,FadeOut", (function(assert) {
			var i, htmlsnippet;
			i = 0;
			while (i < 3) {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).Clone(new (go$sliceType(go$emptyInterface))([])).AppendTo(new Go$String("#qunit-fixture"));
				i = i + 1 >> 0;
			}
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Scroll(new (go$sliceType(go$emptyInterface))([new (go$funcType([jquery.Event], [], false))((function(e) {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("span")])).SetCss(new (go$sliceType(go$emptyInterface))([new Go$String("display"), new Go$String("inline")])).FadeOut(new (go$sliceType(go$emptyInterface))([new Go$String("slow")]));
			}))]));
			htmlsnippet = "<style>\n\t\t\t  div {\n\t\t\t    height: 50px;\n\t\t\t    margin: 5px;\n\t\t\t    padding: 5px;\n\t\t\t    float: left;\n\t\t\t  }\n\t\t\t  #box1 {\n\t\t\t    width: 50px;\n\t\t\t    color: yellow;\n\t\t\t    background-color: blue;\n\t\t\t  }\n\t\t\t  #box2 {\n\t\t\t    width: 80px;\n\t\t\t    color: rgb(255, 255, 255);\n\t\t\t    background-color: rgb(15, 99, 30);\n\t\t\t  }\n\t\t\t  #box3 {\n\t\t\t    width: 40px;\n\t\t\t    color: #fcc;\n\t\t\t    background-color: #123456;\n\t\t\t  }\n\t\t\t  #box4 {\n\t\t\t    width: 70px;\n\t\t\t    background-color: #f11;\n\t\t\t  }\n\t\t\t  </style>\n\t\t\t \n\t\t\t<p id=\"result\">&nbsp;</p>\n\t\t\t<div id=\"box1\">1</div>\n\t\t\t<div id=\"box2\">2</div>\n\t\t\t<div id=\"box3\">3</div>\n\t\t\t<div id=\"box4\">4</div>";
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(htmlsnippet)])).AppendTo(new Go$String("#qunit-fixture"));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([], [], false))((function() {
				var html, styleProps, _ref, _i, _keys, _entry, value, prop;
				html = new (go$sliceType(Go$String))(["The clicked div has the following styles:"]);
				styleProps = jQuery(new (go$sliceType(go$emptyInterface))([this])).CssArray(new (go$sliceType(Go$String))(["width", "height"]));
				_ref = styleProps;
				_i = 0;
				_keys = go$keys(_ref);
				while (_i < _keys.length) {
					_entry = _ref[_keys[_i]];
					value = _entry.v;
					prop = _entry.k;
					html = go$append(html, prop + ": " + (value !== null && value.constructor === Go$String ? value.go$val : go$typeAssertionFailed(value, Go$String)));
					_i++;
				}
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("#result")])).SetHtml(new Go$String(strings.Join(html, "<br>")));
			}))]));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div:eq(0)")])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("click")]));
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("#result")])).Html() === "The clicked div has the following styles:<br>width: 50px<br>height: 50px"), "CssArray read properties");
		}));
		qunit.Test("ApiOnly:SelectFn,SetText,Show,FadeOut", (function(assert) {
			qunit.Expect(0);
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<p>Click and drag the mouse to select text in the inputs.</p>\n  \t\t\t\t<input type=\"text\" value=\"Some text\">\n  \t\t\t\t<input type=\"text\" value=\"to test on\">\n  \t\t\t\t<div></div>")])).AppendTo(new Go$String("#qunit-fixture"));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(":input")])).Select(new (go$sliceType(go$emptyInterface))([new (go$funcType([jquery.Event], [], false))((function(e) {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).SetText(new Go$String("Something was selected")).Show().FadeOut(new (go$sliceType(go$emptyInterface))([new Go$String("1000")]));
			}))]));
		}));
		qunit.Test("Eq,Find", (function(assert) {
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<div></div>\n\t\t\t\t<div></div>\n\t\t\t\t<div class=\"test\"></div>\n\t\t\t\t<div></div>\n\t\t\t\t<div></div>\n\t\t\t\t<div></div>")])).AppendTo(new Go$String("#qunit-fixture"));
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).Eq(2).HasClass("test")), "Eq(2) has class test");
			assert.Ok(new Go$Bool(!jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).Eq(0).HasClass("test")), "Eq(0) has no class test");
		}));
		qunit.Test("Find,End", (function(assert) {
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<p class='ok'><span class='notok'>Hello</span>, how are you?</p>")])).AppendTo(new Go$String("#qunit-fixture"));
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("span")])).HasClass("notok")), "before call to end");
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("span")])).End().HasClass("ok")), "after call to end");
		}));
		qunit.Test("Slice,Attr,First,Last", (function(assert) {
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<ul>\n  \t\t\t\t<li class=\"firstclass\">list item 1</li>\n  \t\t\t\t<li>list item 2</li>\n  \t\t\t\t<li>list item 3</li>\n  \t\t\t\t<li>list item 4</li>\n  \t\t\t\t<li class=\"lastclass\">list item 5</li>\n\t\t\t\t</ul>")])).AppendTo(new Go$String("#qunit-fixture"));
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("li")])).Slice(new (go$sliceType(go$emptyInterface))([new Go$Int(2)])).o.length, Go$String)), new Go$Int(3), "Slice");
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("li")])).Slice(new (go$sliceType(go$emptyInterface))([new Go$Int(2), new Go$Int(4)])).o.length, Go$String)), new Go$Int(2), "SliceByEnd");
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("li")])).First().Attr("class")), new Go$String("firstclass"), "First");
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("li")])).Last().Attr("class")), new Go$String("lastclass"), "Last");
		}));
		qunit.Test("Css", (function(assert) {
			var _map, _key, _struct, div, _struct$1, span;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).SetCss(new (go$sliceType(go$emptyInterface))([new (go$mapType(Go$String, go$emptyInterface))((_map = new Go$Map(), _key = "color", _map[_key] = { k: _key, v: new Go$String("red") }, _key = "background", _map[_key] = { k: _key, v: new Go$String("blue") }, _key = "width", _map[_key] = { k: _key, v: new Go$String("20px") }, _key = "height", _map[_key] = { k: _key, v: new Go$String("10px") }, _map))]));
			assert.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Css("width") === "20px" && jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Css("height") === "10px"), "SetCssMap");
			div = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<div style='display: inline'/>")])).Show().AppendTo(new Go$String("#qunit-fixture")), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$String(div.Css("display")), new Go$String("inline"), "Make sure that element has same display when it was created.");
			div.Remove(new (go$sliceType(go$emptyInterface))([]));
			span = (_struct$1 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<span/>")])).Hide().Show(), new jquery.JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
			assert.Equal(span.Get(new (go$sliceType(go$emptyInterface))([new Go$Int(0)])).style.display, new Go$String("inline"), "For detached span elements, display should always be inline");
			span.Remove(new (go$sliceType(go$emptyInterface))([]));
		}));
		qunit.Test("Attributes", (function(assert) {
			var _struct, extras, _map, _key, _struct$1, input;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<form id='testForm'></form>")])).AppendTo(new Go$String("#qunit-fixture"));
			extras = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<input id='id' name='id' /><input id='name' name='name' /><input id='target' name='target' />")])).AppendTo(new Go$String("#testForm")), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#testForm")])).Attr("target")), new Go$String(""), "Attr");
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#testForm")])).SetAttr(new (go$sliceType(go$emptyInterface))([new Go$String("target"), new Go$String("newTarget")])).Attr("target")), new Go$String("newTarget"), "SetAttr2");
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#testForm")])).RemoveAttr("id").Attr("id")), new Go$String(""), "RemoveAttr ");
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#testForm")])).Attr("name")), new Go$String(""), "Attr undefined");
			extras.Remove(new (go$sliceType(go$emptyInterface))([]));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<a/>")])).SetAttr(new (go$sliceType(go$emptyInterface))([new (go$mapType(Go$String, go$emptyInterface))((_map = new Go$Map(), _key = "id", _map[_key] = { k: _key, v: new Go$String("tAnchor5") }, _key = "href", _map[_key] = { k: _key, v: new Go$String("#5") }, _map))])).AppendTo(new Go$String("#qunit-fixture"));
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#tAnchor5")])).Attr("href")), new Go$String("#5"), "Attr");
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<a id='tAnchor6' href='#5' />")])).AppendTo(new Go$String("#qunit-fixture"));
			assert.Equal(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#tAnchor5")])).Prop("href"), jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#tAnchor6")])).Prop("href"), "Prop");
			input = (_struct$1 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<input name='tester' />")])), new jquery.JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
			assert.StrictEqual(input.Clone(new (go$sliceType(go$emptyInterface))([new Go$Bool(true)])).SetAttr(new (go$sliceType(go$emptyInterface))([new Go$String("name"), new Go$String("test")])).Underlying()[0].name, new Go$String("test"), "Clone");
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Empty();
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<input type=\"checkbox\" checked=\"checked\">\n  \t\t\t<input type=\"checkbox\">\n  \t\t\t<input type=\"checkbox\">\n  \t\t\t<input type=\"checkbox\" checked=\"checked\">")])).AppendTo(new Go$String("#qunit-fixture"));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("input[type='checkbox']")])).SetProp(new (go$sliceType(go$emptyInterface))([new Go$String("disabled"), new Go$Bool(true)]));
			assert.Ok(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("input[type='checkbox']")])).Prop("disabled"), "SetProp");
		}));
		qunit.Test("Unique", (function(assert) {
			var divs, divs2, divs3;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<div>There are 6 divs in this document.</div>\n\t\t\t\t<div></div>\n\t\t\t\t<div class=\"dup\"></div>\n\t\t\t\t<div class=\"dup\"></div>\n\t\t\t\t<div class=\"dup\"></div>\n\t\t\t\t<div></div>")])).AppendTo(new Go$String("#qunit-fixture"));
			divs = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).Get(new (go$sliceType(go$emptyInterface))([]));
			assert.Equal(divs.length, new Go$Int(6), "6 divs inserted");
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String(".dup")])).Clone(new (go$sliceType(go$emptyInterface))([new Go$Bool(true)])).AppendTo(new Go$String("#qunit-fixture"));
			divs2 = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).Get(new (go$sliceType(go$emptyInterface))([]));
			assert.Equal(divs2.length, new Go$Int(9), "9 divs inserted");
			divs3 = jquery.Unique(divs);
			assert.Equal(divs3.length, new Go$Int(6), "post-qunique should be 6 elements");
		}));
		qunit.Test("Serialize,SerializeArray,Trigger,Submit", (function(assert) {
			var collectResults, serializedString;
			qunit.Expect(2);
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("<form>\n\t\t\t\t  <div><input type=\"text\" name=\"a\" value=\"1\" id=\"a\"></div>\n\t\t\t\t  <div><input type=\"text\" name=\"b\" value=\"2\" id=\"b\"></div>\n\t\t\t\t  <div><input type=\"hidden\" name=\"c\" value=\"3\" id=\"c\"></div>\n\t\t\t\t  <div>\n\t\t\t\t    <textarea name=\"d\" rows=\"8\" cols=\"40\">4</textarea>\n\t\t\t\t  </div>\n\t\t\t\t  <div><select name=\"e\">\n\t\t\t\t    <option value=\"5\" selected=\"selected\">5</option>\n\t\t\t\t    <option value=\"6\">6</option>\n\t\t\t\t    <option value=\"7\">7</option>\n\t\t\t\t  </select></div>\n\t\t\t\t  <div>\n\t\t\t\t    <input type=\"checkbox\" name=\"f\" value=\"8\" id=\"f\">\n\t\t\t\t  </div>\n\t\t\t\t  <div>\n\t\t\t\t    <input type=\"submit\" name=\"g\" value=\"Submit\" id=\"g\">\n\t\t\t\t  </div>\n\t\t\t\t</form>")])).AppendTo(new Go$String("#qunit-fixture"));
			collectResults = "";
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("form")])).Submit(new (go$sliceType(go$emptyInterface))([new (go$funcType([jquery.Event], [], false))((function(evt) {
				var sa, i;
				sa = jQuery(new (go$sliceType(go$emptyInterface))([evt.Object.target])).SerializeArray();
				i = 0;
				while (i < go$parseInt(sa.length)) {
					collectResults = collectResults + (go$internalize(sa[i].name, Go$String));
					i = i + 1 >> 0;
				}
				assert.Equal(new Go$String(collectResults), new Go$String("abcde"), "SerializeArray");
				evt.PreventDefault();
			}))]));
			serializedString = "a=1&b=2&c=3&d=4&e=5";
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("form")])).Serialize()), new Go$String(serializedString), "Serialize");
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("form")])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("submit")]));
		}));
		qunit.ModuleLifecycle("Events", (x = new EvtScenario.Ptr(), new x.constructor.Struct(x)));
		qunit.Test("On,One,Off,Trigger", (function(assert) {
			var fn, _map, _key, data, _tmp, _tmp$1, clickCounter, mouseoverCounter, handler, handlerWithData, _map$1, _key$1, data2, _struct, elem;
			fn = (function(ev) {
				assert.Ok(new Go$Bool(!(ev.Object.data === undefined)), "on() with data, check passed data exists");
				assert.Equal(ev.Object.data.foo, new Go$String("bar"), "on() with data, Check value of passed data");
			});
			data = (_map = new Go$Map(), _key = "foo", _map[_key] = { k: _key, v: new Go$String("bar") }, _map);
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#firstp")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$mapType(Go$String, go$emptyInterface))(data), new (go$funcType([jquery.Event], [], false))(fn)])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("click")])).Off(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([jquery.Event], [], false))(fn)]));
			_tmp = 0; _tmp$1 = 0; clickCounter = _tmp; mouseoverCounter = _tmp$1;
			handler = (function(ev) {
				if (go$internalize(ev.Object.type, Go$String) === "click") {
					clickCounter = clickCounter + 1 >> 0;
				} else if (go$internalize(ev.Object.type, Go$String) === "mouseover") {
					mouseoverCounter = mouseoverCounter + 1 >> 0;
				}
			});
			handlerWithData = (function(ev) {
				if (go$internalize(ev.Object.type, Go$String) === "click") {
					clickCounter = clickCounter + ((go$parseInt(ev.Object.data.data) >> 0)) >> 0;
				} else if (go$internalize(ev.Object.type, Go$String) === "mouseover") {
					mouseoverCounter = mouseoverCounter + ((go$parseInt(ev.Object.data.data) >> 0)) >> 0;
				}
			});
			data2 = (_map$1 = new Go$Map(), _key$1 = "data", _map$1[_key$1] = { k: _key$1, v: new Go$Int(2) }, _map$1);
			elem = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#firstp")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([jquery.Event], [], false))(handler)])).On(new (go$sliceType(go$emptyInterface))([new Go$String("mouseover"), new (go$funcType([jquery.Event], [], false))(handler)])).One(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$mapType(Go$String, go$emptyInterface))(data2), new (go$funcType([jquery.Event], [], false))(handlerWithData)])).One(new (go$sliceType(go$emptyInterface))([new Go$String("mouseover"), new (go$mapType(Go$String, go$emptyInterface))(data2), new (go$funcType([jquery.Event], [], false))(handlerWithData)])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$Int(clickCounter), new Go$Int(0), "clickCounter initialization ok");
			assert.Equal(new Go$Int(mouseoverCounter), new Go$Int(0), "mouseoverCounter initialization ok");
			elem.Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("click")])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("mouseover")]));
			assert.Equal(new Go$Int(clickCounter), new Go$Int(3), "clickCounter Increased after Trigger/On/One");
			assert.Equal(new Go$Int(mouseoverCounter), new Go$Int(3), "mouseoverCounter Increased after Trigger/On/One");
			elem.Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("click")])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("mouseover")]));
			assert.Equal(new Go$Int(clickCounter), new Go$Int(4), "clickCounter Increased after Trigger/On");
			assert.Equal(new Go$Int(mouseoverCounter), new Go$Int(4), "a) mouseoverCounter Increased after TriggerOn");
			elem.Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("click")])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("mouseover")]));
			assert.Equal(new Go$Int(clickCounter), new Go$Int(5), "b) clickCounter not Increased after Off");
			assert.Equal(new Go$Int(mouseoverCounter), new Go$Int(5), "c) mouseoverCounter not Increased after Off");
			elem.Off(new (go$sliceType(go$emptyInterface))([new Go$String("click")])).Off(new (go$sliceType(go$emptyInterface))([new Go$String("mouseover")]));
			elem.Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("click")])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("mouseover")]));
			assert.Equal(new Go$Int(clickCounter), new Go$Int(5), "clickCounter not Increased after Off");
			assert.Equal(new Go$Int(mouseoverCounter), new Go$Int(5), "mouseoverCounter not Increased after Off");
		}));
		qunit.Test("Each", (function(assert) {
			var html, blueCount, i;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Empty();
			html = "<style>\n\t\t\t  \t\tdiv {\n\t\t\t    \t\tcolor: red;\n\t\t\t    \t\ttext-align: center;\n\t\t\t    \t\tcursor: pointer;\n\t\t\t    \t\tfont-weight: bolder;\n\t\t\t\t    width: 300px;\n\t\t\t\t  }\n\t\t\t\t </style>\n\t\t\t\t <div>Click here</div>\n\t\t\t\t <div>to iterate through</div>\n\t\t\t\t <div>these divs.</div>";
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(html)])).AppendTo(new Go$String("#qunit-fixture"));
			blueCount = 0;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([jquery.Event], [], false))((function(e) {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).Each((function(i, elem) {
					var style;
					style = jQuery(new (go$sliceType(go$emptyInterface))([elem])).Get(new (go$sliceType(go$emptyInterface))([new Go$Int(0)])).style;
					if (!(go$internalize(style.color, Go$String) === "blue")) {
						style.color = go$externalize("blue", Go$String);
					} else {
						blueCount = blueCount + 1 >> 0;
						style.color = go$externalize("", Go$String);
					}
					return null;
				}));
			}))]));
			i = 0;
			while (i < 6) {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div:eq(0)")])).Trigger(new (go$sliceType(go$emptyInterface))([new Go$String("click")]));
				i = i + 1 >> 0;
			}
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).o.length, Go$String)), new Go$Int(3), "Test setup problem: 3 divs expected");
			assert.Equal(new Go$Int(blueCount), new Go$Int(9), "blueCount Counter should be 9");
		}));
		qunit.Test("Filter, Resize", (function(assert) {
			var html, countFontweight;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Empty();
			html = "<style>\n\t\t\t\t  \tdiv {\n\t\t\t\t    \twidth: 60px;\n\t\t\t\t    \theight: 60px;\n\t\t\t\t    \tmargin: 5px;\n\t\t\t\t    \tfloat: left;\n\t\t\t\t    \tborder: 2px white solid;\n\t\t\t\t  \t}\n\t\t\t\t </style>\n\t\t\t\t  \n\t\t\t\t <div></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div></div>";
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(html)])).AppendTo(new Go$String("#qunit-fixture"));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).SetCss(new (go$sliceType(go$emptyInterface))([new Go$String("background"), new Go$String("silver")])).Filter(new (go$sliceType(go$emptyInterface))([new (go$funcType([Go$Int], [Go$Bool], false))((function(index) {
				var _r;
				return (_r = index % 3, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 2;
			}))])).SetCss(new (go$sliceType(go$emptyInterface))([new Go$String("font-weight"), new Go$String("bold")]));
			countFontweight = 0;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).Each((function(i, elem) {
				var fw;
				fw = jQuery(new (go$sliceType(go$emptyInterface))([elem])).Css("font-weight");
				if (fw === "bold" || fw === "700") {
					countFontweight = countFontweight + 1 >> 0;
				}
				return null;
			}));
			assert.Equal(new Go$Int(countFontweight), new Go$Int(2), "2 divs should have font-weight = 'bold'");
			jQuery(new (go$sliceType(go$emptyInterface))([go$global])).Resize(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div:eq(0)")])).SetText(new Go$String(strconv.Itoa(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("div:eq(0)")])).Width())));
			}))])).Resize(new (go$sliceType(go$emptyInterface))([]));
			assert.Equal(new Go$String(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div:eq(0)")])).Text()), new Go$String("60"), "text of first div should be 60");
		}));
		qunit.Test("Not,Offset", (function(assert) {
			var html;
			qunit.Expect(0);
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Empty();
			html = "<div></div>\n\t\t\t\t <div id=\"blueone\"></div>\n\t\t\t\t <div></div>\n\t\t\t\t <div class=\"green\"></div>\n\t\t\t\t <div class=\"green\"></div>\n\t\t\t\t <div class=\"gray\"></div>\n\t\t\t\t <div></div>";
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(html)])).AppendTo(new Go$String("#qunit-fixture"));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).Not(new (go$sliceType(go$emptyInterface))([new Go$String(".green,#blueone")])).SetCss(new (go$sliceType(go$emptyInterface))([new Go$String("border-color"), new Go$String("red")]));
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("*"), new Go$String("body")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([jquery.Event], [], false))((function(event) {
				var _struct, offset, x$1, tag;
				offset = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([event.Object.target])).Offset(), new jquery.JQueryCoordinates.Ptr(_struct.Left, _struct.Top));
				event.StopPropagation();
				tag = (x$1 = jQuery(new (go$sliceType(go$emptyInterface))([event.Object.target])).Prop("tagName"), (x$1 !== null && x$1.constructor === Go$String ? x$1.go$val : go$typeAssertionFailed(x$1, Go$String)));
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#result")])).SetText(new Go$String(tag + " coords ( " + strconv.Itoa(offset.Left) + ", " + strconv.Itoa(offset.Top) + " )"));
			}))]));
		}));
		qunit.Module("Ajax");
		qunit.AsyncTest("Async Dummy Test", (function() {
			qunit.Expect(1);
			return go$global.setTimeout(go$externalize((function() {
				qunit.Ok(new Go$Bool(true), " async ok");
				qunit.Start();
			}), (go$funcType([], [], false))), 1000);
		}));
		qunit.AsyncTest("Ajax Call", (function() {
			var _map, _key, ajaxopt;
			qunit.Expect(1);
			ajaxopt = (_map = new Go$Map(), _key = "async", _map[_key] = { k: _key, v: new Go$Bool(true) }, _key = "type", _map[_key] = { k: _key, v: new Go$String("POST") }, _key = "url", _map[_key] = { k: _key, v: new Go$String("http://localhost:3000/nestedjson/") }, _key = "contentType", _map[_key] = { k: _key, v: new Go$String("application/json charset=utf-8") }, _key = "dataType", _map[_key] = { k: _key, v: new Go$String("json") }, _key = "data", _map[_key] = { k: _key, v: null }, _key = "beforeSend", _map[_key] = { k: _key, v: new (go$funcType([Object], [], false))((function(data) {
			})) }, _key = "success", _map[_key] = { k: _key, v: new (go$funcType([Object], [], false))((function(data) {
				var dataStr, expected;
				dataStr = stringify(new Object(data));
				expected = "{\"message\":\"Welcome!\",\"nested\":{\"level\":1,\"moresuccess\":true},\"success\":true}";
				qunit.Ok(new Go$Bool(dataStr === expected), "Ajax call did not returns expected result");
				qunit.Start();
			})) }, _key = "error", _map[_key] = { k: _key, v: new (go$funcType([go$emptyInterface], [], false))((function(status) {
			})) }, _map);
			jquery.Ajax(ajaxopt);
			return null;
		}));
		qunit.AsyncTest("Load", (function() {
			qunit.Expect(1);
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Load(new (go$sliceType(go$emptyInterface))([new Go$String("/resources/load.html"), new (go$funcType([], [], false))((function() {
				qunit.Ok(new Go$Bool(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Html() === "<div>load successful!</div>"), "Load call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("Get", (function() {
			qunit.Expect(1);
			jquery.Get(new (go$sliceType(go$emptyInterface))([new Go$String("/resources/get.html"), new (go$funcType([go$emptyInterface, Go$String, go$emptyInterface], [], false))((function(data, status, xhr) {
				qunit.Ok(new Go$Bool(go$interfaceIsEqual(data, new Go$String("<div>get successful!</div>"))), "Get call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("Post", (function() {
			qunit.Expect(1);
			jquery.Post(new (go$sliceType(go$emptyInterface))([new Go$String("/gopher"), new (go$funcType([go$emptyInterface, Go$String, go$emptyInterface], [], false))((function(data, status, xhr) {
				qunit.Ok(new Go$Bool(go$interfaceIsEqual(data, new Go$String("<div>Welcome gopher</div>"))), "Post call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("GetJSON", (function() {
			qunit.Expect(1);
			jquery.GetJSON(new (go$sliceType(go$emptyInterface))([new Go$String("/json/1"), new (go$funcType([go$emptyInterface], [], false))((function(data) {
				var _tuple, _entry, val, ok;
				_tuple = (_entry = (data !== null && data.constructor === (go$mapType(Go$String, go$emptyInterface)) ? data.go$val : go$typeAssertionFailed(data, (go$mapType(Go$String, go$emptyInterface))))["json"], _entry !== undefined ? [_entry.v, true] : [null, false]); val = _tuple[0]; ok = _tuple[1];
				if (ok) {
					qunit.Ok(new Go$Bool(go$interfaceIsEqual(val, new Go$String("1"))), "Json call did not returns expected result");
					qunit.Start();
				}
			}))]));
			return null;
		}));
		qunit.AsyncTest("GetScript", (function() {
			qunit.Expect(1);
			jquery.GetScript(new (go$sliceType(go$emptyInterface))([new Go$String("/script"), new (go$funcType([go$emptyInterface], [], false))((function(data) {
				qunit.Ok(new Go$Bool(((data !== null && data.constructor === Go$String ? data.go$val : go$typeAssertionFailed(data, Go$String)).length === 29)), "GetScript call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("AjaxSetup", (function() {
			var _map, _key, ajaxSetupOptions, _map$1, _key$1, ajaxopt;
			qunit.Expect(1);
			ajaxSetupOptions = (_map = new Go$Map(), _key = "async", _map[_key] = { k: _key, v: new Go$Bool(true) }, _key = "type", _map[_key] = { k: _key, v: new Go$String("POST") }, _key = "url", _map[_key] = { k: _key, v: new Go$String("/nestedjson/") }, _key = "contentType", _map[_key] = { k: _key, v: new Go$String("application/json charset=utf-8") }, _map);
			jquery.AjaxSetup(ajaxSetupOptions);
			ajaxopt = (_map$1 = new Go$Map(), _key$1 = "dataType", _map$1[_key$1] = { k: _key$1, v: new Go$String("json") }, _key$1 = "data", _map$1[_key$1] = { k: _key$1, v: null }, _key$1 = "beforeSend", _map$1[_key$1] = { k: _key$1, v: new (go$funcType([Object], [], false))((function(data) {
			})) }, _key$1 = "success", _map$1[_key$1] = { k: _key$1, v: new (go$funcType([Object], [], false))((function(data) {
				var dataStr, expected;
				dataStr = stringify(new Object(data));
				expected = "{\"message\":\"Welcome!\",\"nested\":{\"level\":1,\"moresuccess\":true},\"success\":true}";
				qunit.Ok(new Go$Bool(dataStr === expected), "AjaxSetup call did not returns expected result");
				qunit.Start();
			})) }, _key$1 = "error", _map$1[_key$1] = { k: _key$1, v: new (go$funcType([go$emptyInterface], [], false))((function(status) {
			})) }, _map$1);
			jquery.Ajax(ajaxopt);
			return null;
		}));
		qunit.AsyncTest("AjaxPrefilter", (function() {
			qunit.Expect(1);
			jquery.AjaxPrefilter(new (go$sliceType(go$emptyInterface))([new Go$String("+json"), new (go$funcType([go$emptyInterface, Go$String, go$emptyInterface], [], false))((function(options, originalOptions, jqXHR) {
			}))]));
			jquery.GetJSON(new (go$sliceType(go$emptyInterface))([new Go$String("/json/3"), new (go$funcType([go$emptyInterface], [], false))((function(data) {
				var _tuple, _entry, val, ok;
				_tuple = (_entry = (data !== null && data.constructor === (go$mapType(Go$String, go$emptyInterface)) ? data.go$val : go$typeAssertionFailed(data, (go$mapType(Go$String, go$emptyInterface))))["json"], _entry !== undefined ? [_entry.v, true] : [null, false]); val = _tuple[0]; ok = _tuple[1];
				if (ok) {
					qunit.Ok(new Go$Bool((val !== null && val.constructor === Go$String ? val.go$val : go$typeAssertionFailed(val, Go$String)) === "3"), "AjaxPrefilter call did not returns expected result");
					qunit.Start();
				}
			}))]));
			return null;
		}));
		qunit.AsyncTest("AjaxTransport", (function() {
			qunit.Expect(1);
			jquery.AjaxTransport(new (go$sliceType(go$emptyInterface))([new Go$String("+json"), new (go$funcType([go$emptyInterface, Go$String, go$emptyInterface], [], false))((function(options, originalOptions, jqXHR) {
			}))]));
			jquery.GetJSON(new (go$sliceType(go$emptyInterface))([new Go$String("/json/4"), new (go$funcType([go$emptyInterface], [], false))((function(data) {
				var _tuple, _entry, val, ok;
				_tuple = (_entry = (data !== null && data.constructor === (go$mapType(Go$String, go$emptyInterface)) ? data.go$val : go$typeAssertionFailed(data, (go$mapType(Go$String, go$emptyInterface))))["json"], _entry !== undefined ? [_entry.v, true] : [null, false]); val = _tuple[0]; ok = _tuple[1];
				if (ok) {
					qunit.Ok(new Go$Bool((val !== null && val.constructor === Go$String ? val.go$val : go$typeAssertionFailed(val, Go$String)) === "4"), "AjaxTransport call did not returns expected result");
					qunit.Start();
				}
			}))]));
			return null;
		}));
		qunit.Module("Deferreds");
		qunit.AsyncTest("Deferreds Test 01", (function() {
			var _tmp, _tmp$1, _tmp$2, pass, fail, progress, i, _r;
			qunit.Expect(1);
			_tmp = 0; _tmp$1 = 0; _tmp$2 = 0; pass = _tmp; fail = _tmp$1; progress = _tmp$2;
			i = 0;
			while (i < 10) {
				jquery.When(new (go$sliceType(go$emptyInterface))([asyncEvent((_r = i % 2, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 0, i)])).Then(new (go$sliceType(go$emptyInterface))([new (go$funcType([go$emptyInterface], [], false))((function(status) {
					pass = pass + 1 >> 0;
				})), new (go$funcType([go$emptyInterface], [], false))((function(status) {
					fail = fail + 1 >> 0;
				})), new (go$funcType([go$emptyInterface], [], false))((function(status) {
					progress = progress + 1 >> 0;
				}))])).Done(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
					if (pass >= 5) {
						qunit.Start();
						qunit.Ok(new Go$Bool(pass >= 5 && fail >= 4 && progress >= 20), "Deferred Test 01 fail");
					}
				}))]));
				i = i + 1 >> 0;
			}
			return null;
		}));
		qunit.Test("Deferreds Test 02", (function(assert) {
			var _struct, _struct$1, _struct$2, o;
			qunit.Expect(1);
			o = (_struct$1 = NewWorking((_struct = jquery.NewDeferred(), new jquery.Deferred.Ptr(_struct.Object))), new working.Ptr((_struct$2 = _struct$1.Deferred, new jquery.Deferred.Ptr(_struct$2.Object))));
			o.Deferred.Resolve(new (go$sliceType(go$emptyInterface))([new Go$String("John")]));
			o.Deferred.Done(new (go$sliceType(go$emptyInterface))([new (go$funcType([Go$String], [], false))((function(name) {
				o.hi(name);
			}))])).Done(new (go$sliceType(go$emptyInterface))([new (go$funcType([Go$String], [], false))((function(name) {
				o.hi("John");
			}))]));
			o.hi("Karl");
			assert.Ok(new Go$Bool((countJohn === 2) && (countKarl === 1)), "Deferred Test 02 fail");
		}));
		qunit.AsyncTest("Deferreds Test 03", (function() {
			qunit.Expect(1);
			jquery.Get(new (go$sliceType(go$emptyInterface))([new Go$String("/get.html")])).Always(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
				qunit.Start();
				qunit.Ok(new Go$Bool(true), "Deferred Test 03 fail");
			}))]));
			return null;
		}));
		qunit.AsyncTest("Deferreds Test 04", (function() {
			qunit.Expect(2);
			jquery.Get(new (go$sliceType(go$emptyInterface))([new Go$String("/get.html")])).Done(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
				qunit.Ok(new Go$Bool(true), "Deferred Test 04 fail");
			}))])).Fail(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
			}))]));
			jquery.Get(new (go$sliceType(go$emptyInterface))([new Go$String("/shouldnotexist.html")])).Done(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
			}))])).Fail(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
				qunit.Start();
				qunit.Ok(new Go$Bool(true), "Deferred Test 04 fail");
			}))]));
			return null;
		}));
		qunit.AsyncTest("Deferreds Test 05", (function() {
			qunit.Expect(2);
			jquery.Get(new (go$sliceType(go$emptyInterface))([new Go$String("/get.html")])).Then(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
				qunit.Ok(new Go$Bool(true), "Deferred Test 05 fail");
			})), new (go$funcType([], [], false))((function() {
			}))]));
			jquery.Get(new (go$sliceType(go$emptyInterface))([new Go$String("/shouldnotexist.html")])).Then(new (go$sliceType(go$emptyInterface))([new (go$funcType([], [], false))((function() {
			})), new (go$funcType([], [], false))((function() {
				qunit.Start();
				qunit.Ok(new Go$Bool(true), "Deferred Test 05, 2nd part, fail");
			}))]));
			return null;
		}));
		qunit.Test("Deferreds Test 06", (function(assert) {
			var _struct, o, _struct$1, filtered;
			qunit.Expect(1);
			o = (_struct = jquery.NewDeferred(), new jquery.Deferred.Ptr(_struct.Object));
			filtered = (_struct$1 = o.Then(new (go$sliceType(go$emptyInterface))([new (go$funcType([Go$Int], [Go$Int], false))((function(value) {
				return (((value >>> 16 << 16) * 2 >> 0) + (value << 16 >>> 16) * 2) >> 0;
			}))])), new jquery.Deferred.Ptr(_struct$1.Object));
			o.Resolve(new (go$sliceType(go$emptyInterface))([new Go$Int(5)]));
			filtered.Done(new (go$sliceType(go$emptyInterface))([new (go$funcType([Go$Int], [], false))((function(value) {
				assert.Ok(new Go$Bool((value === 10)), "Deferred Test 06 fail");
			}))]));
		}));
		qunit.Test("Deferreds Test 07", (function(assert) {
			var _struct, o, _struct$1, filtered;
			o = (_struct = jquery.NewDeferred(), new jquery.Deferred.Ptr(_struct.Object));
			filtered = (_struct$1 = o.Then(new (go$sliceType(go$emptyInterface))([null, new (go$funcType([Go$Int], [Go$Int], false))((function(value) {
				return (((value >>> 16 << 16) * 3 >> 0) + (value << 16 >>> 16) * 3) >> 0;
			}))])), new jquery.Deferred.Ptr(_struct$1.Object));
			o.Reject(new (go$sliceType(go$emptyInterface))([new Go$Int(6)]));
			filtered.Fail(new (go$sliceType(go$emptyInterface))([new (go$funcType([Go$Int], [], false))((function(value) {
				assert.Ok(new Go$Bool((value === 18)), "Deferred Test 07 fail");
			}))]));
		}));
	};
	go$pkg.init = function() {
		Object.init(Go$String, go$emptyInterface);
		EvtScenario.methods = [["Setup", "Setup", "", [], [], false, -1], ["Teardown", "Teardown", "", [], [], false, -1]];
		(go$ptrType(EvtScenario)).methods = [["Setup", "Setup", "", [], [], false, -1], ["Teardown", "Teardown", "", [], [], false, -1]];
		EvtScenario.init([]);
		working.methods = [["Always", "Always", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Done", "Done", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Fail", "Fail", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Notify", "Notify", "", [go$emptyInterface], [jquery.Deferred], false, 0], ["Progress", "Progress", "", [go$emptyInterface], [jquery.Deferred], false, 0], ["Promise", "Promise", "", [], [js.Object], false, 0], ["Reject", "Reject", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Resolve", "Resolve", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["State", "State", "", [], [Go$String], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Then", "Then", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0], ["hi", "hi", "main", [Go$String], [], false, -1], ["notify", "notify", "main", [], [], false, -1]];
		(go$ptrType(working)).methods = [["Always", "Always", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Bool", "Bool", "", [], [Go$Bool], false, 0], ["Call", "Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Delete", "Delete", "", [Go$String], [], false, 0], ["Done", "Done", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Fail", "Fail", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Float", "Float", "", [], [Go$Float64], false, 0], ["Get", "Get", "", [Go$String], [js.Object], false, 0], ["Index", "Index", "", [Go$Int], [js.Object], false, 0], ["Int", "Int", "", [], [Go$Int], false, 0], ["Int64", "Int64", "", [], [Go$Int64], false, 0], ["Interface", "Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "Length", "", [], [Go$Int], false, 0], ["New", "New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Notify", "Notify", "", [go$emptyInterface], [jquery.Deferred], false, 0], ["Progress", "Progress", "", [go$emptyInterface], [jquery.Deferred], false, 0], ["Promise", "Promise", "", [], [js.Object], false, 0], ["Reject", "Reject", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Resolve", "Resolve", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Set", "Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["State", "State", "", [], [Go$String], false, 0], ["Str", "Str", "", [], [Go$String], false, 0], ["Then", "Then", "", [(go$sliceType(go$emptyInterface))], [jquery.Deferred], true, 0], ["Uint64", "Uint64", "", [], [Go$Uint64], false, 0], ["Unsafe", "Unsafe", "", [], [Go$Uintptr], false, 0], ["hi", "hi", "main", [Go$String], [], false, -1], ["notify", "notify", "main", [], [], false, -1]];
		working.init([["Deferred", "", "", jquery.Deferred, ""]]);
		jQuery = jquery.NewJQuery;
		countJohn = 0;
		countKarl = 0;
	}
	return go$pkg;
})();
go$error.implementedBy = [go$packages["errors"].errorString.Ptr, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorString, go$packages["syscall"].DLLError.Ptr, go$packages["syscall"].DummyError, go$packages["syscall"].DummyError.Ptr, go$packages["syscall"].Errno, go$packages["time"].ParseError.Ptr, go$ptrType(go$packages["runtime"].errorString), go$ptrType(go$packages["syscall"].Errno)];
go$packages["github.com/gopherjs/gopherjs/js"].Object.implementedBy = [go$packages["github.com/gopherjs/gopherjs/js"].Error, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["github.com/gopherjs/jquery"].Deferred, go$packages["github.com/gopherjs/jquery"].Deferred.Ptr, go$packages["github.com/gopherjs/jquery"].Event, go$packages["github.com/gopherjs/jquery"].Event.Ptr, go$packages["github.com/rusco/qunit"].QUnitAssert, go$packages["github.com/rusco/qunit"].QUnitAssert.Ptr, go$packages["main"].working, go$packages["main"].working.Ptr];
go$packages["github.com/gopherjs/gopherjs/js"].init();
go$packages["runtime"].init();
go$packages["github.com/gopherjs/jquery"].init();
go$packages["github.com/rusco/qunit"].init();
go$packages["errors"].init();
go$packages["math"].init();
go$packages["unicode/utf8"].init();
go$packages["strconv"].init();
go$packages["sync/atomic"].init();
go$packages["sync"].init();
go$packages["io"].init();
go$packages["unicode"].init();
go$packages["strings"].init();
go$packages["bytes"].init();
go$packages["unicode/utf16"].init();
go$packages["syscall"].init();
go$packages["time"].init();
go$packages["main"].init();
go$packages["main"].main();

})();
//# sourceMappingURL=index.js.map
