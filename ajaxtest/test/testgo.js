"use strict";
(function() {

Error.stackTraceLimit = -1;

var go$reservedKeywords = ["abstract", "arguments", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double", "else", "enum", "eval", "export", "extends", "false", "final", "finally", "float", "for", "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface", "let", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield"];

var go$global;
if (typeof window !== "undefined") {
	go$global = window;
} else if (typeof GLOBAL !== "undefined") {
	go$global = GLOBAL;
}

var go$idCounter = 0;
var go$keys = function(m) { return m ? Object.keys(m) : []; };
var go$min = Math.min;
var go$parseInt = parseInt;
var go$parseFloat = parseFloat;
var go$toString = String;
var go$reflect, go$newStringPtr;
var Go$Array = Array;
var Go$Error = Error;

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
				return string + "$" + go$mapArray(this.go$val, function(e) {
					var key = e.go$key ? e.go$key() : String(e);
					return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}).join("$");
			};
			typ.extendReflectType = function(rt) {
				rt.arrayType = new go$reflect.arrayType(rt, elem.reflectType(), undefined, len);
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
				rt.chanType = new go$reflect.chanType(rt, elem.reflectType(), sendOnly ? go$reflect.SendDir : (recvOnly ? go$reflect.RecvDir : go$reflect.BothDir));
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
				var typeSlice = (go$sliceType(go$ptrType(go$reflect.rtype)));
				rt.funcType = new go$reflect.funcType(rt, variadic, new typeSlice(go$mapArray(params, function(p) { return p.reflectType(); })), new typeSlice(go$mapArray(results, function(p) { return p.reflectType(); })));
			};
		};
		break;

	case "Interface":
		typ = { implementedBy: [] };
		typ.init = function(methods) {
			typ.extendReflectType = function(rt) {
				var imethods = go$mapArray(methods, function(m) {
					return new go$reflect.imethod(go$newStringPtr(m[0]), go$newStringPtr(m[1]), m[2].reflectType());
				});
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.imethod)));
				rt.interfaceType = new go$reflect.interfaceType(rt, new methodSlice(imethods));
			};
		};
		break;

	case "Map":
		typ = function(v) { this.go$val = v; };
		typ.init = function(key, elem) {
			typ.key = key;
			typ.elem = elem;
			typ.extendReflectType = function(rt) {
				rt.mapType = new go$reflect.mapType(rt, key.reflectType(), elem.reflectType(), undefined, undefined);
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
				rt.ptrType = new go$reflect.ptrType(rt, elem.reflectType());
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
				rt.sliceType = new go$reflect.sliceType(rt, elem.reflectType());
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
				if (method[5] != -1) {
					(function(field, methodName) {
						typ.prototype[methodName] = function() {
							var v = this.go$val[field[0]];
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[5]], method[0]);
				}
			}
			for (i = 0; i < typ.Ptr.methods.length; i++) {
				var method = typ.Ptr.methods[i];
				if (method[5] != -1) {
					(function(field, methodName) {
						typ.Ptr.prototype[methodName] = function() {
							var v = this[field[0]];
							if (v.go$val === undefined) {
								v = new field[3](v);
							}
							return v[methodName].apply(v, arguments);
						};
					})(fields[method[5]], method[0]);
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
					reflectFields[i] = new go$reflect.structField(go$newStringPtr(field[1]), go$newStringPtr(field[2]), field[3].reflectType(), go$newStringPtr(field[4]), i);
				}
				rt.structType = new go$reflect.structType(rt, new (go$sliceType(go$reflect.structField))(reflectFields));
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
			rt = new go$reflect.rtype(size, 0, 0, 0, 0, go$reflect.kinds[kind], undefined, undefined, go$newStringPtr(string), undefined, undefined);
			rt.jsType = typ;

			var methods = [];
			if (typ.methods !== undefined) {
				var i;
				for (i = 0; i < typ.methods.length; i++) {
					var m = typ.methods[i];
					methods.push(new go$reflect.method(go$newStringPtr(m[0]), go$newStringPtr(m[1]), go$funcType(m[2], m[3], m[4]).reflectType(), go$funcType([typ].concat(m[2]), m[3], m[4]).reflectType(), undefined, undefined));
				}
			}
			if (name !== "" || methods.length !== 0) {
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.method)));
				rt.uncommonType = new go$reflect.uncommonType(go$newStringPtr(name), go$newStringPtr(pkgPath), new methodSlice(methods));
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
var Go$String        = go$newType( 0, "String",        "string",         "string",     "", null);
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
		typ = go$newType(0, "Array", string, "", "", null);
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
		typ = go$newType(0, "Chan", string, "", "", null);
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
		typ = go$newType(0, "Func", string, "", "", null);
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
		typ = go$newType(0, "Interface", string, "", "", null);
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
		typ = go$newType(0, "Map", string, "", "", null);
		typ.init(key, elem);
		go$mapTypes[string] = typ;
	}
	return typ;
};

var go$throwNilPointerError = function() { go$throwRuntimeError("invalid memory address or nil pointer dereference"); };
var go$ptrType = function(elem) {
	var typ = elem.Ptr;
	if (typ === undefined) {
		typ = go$newType(0, "Ptr", "*" + elem.string, "", "", null);
		typ.init(elem);
		elem.Ptr = typ;
	}
	return typ;
};

var go$sliceType = function(elem) {
	var typ = elem.Slice;
	if (typ === undefined) {
		typ = go$newType(0, "Slice", "[]" + elem.string, "", "", null);
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

var go$ldexp = function(frac, exp) {
	if (frac === 0) { return frac; }
	if (exp >= 1024) { return frac * Math.pow(2, 1023) * Math.pow(2, exp - 1023); }
	if (exp <= -1024) { return frac * Math.pow(2, -1023) * Math.pow(2, exp + 1023); }
	return frac * Math.pow(2, exp);
};
var go$float32bits = function(f) {
	var s, e, r;
	if (f === 0) {
		if (f === 0 && 1 / f === 1 / -0) {
			return 2147483648;
		}
		return 0;
	}
	if (f !== f) {
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
	r = f % 2;
	if ((r > 0.5 && r < 1) || r >= 1.5) {
		f++;
	}
	return (((s | (e << 23 >>> 0)) >>> 0) | (((f >> 0) & ~8388608))) >>> 0;
};
var go$float32frombits = function(b) {
	var s, e, m;
	s = 1;
	if (((b & 2147483648) >>> 0) !== 0) {
		s = -1;
	}
	e = (((b >>> 23 >>> 0)) & 255) >>> 0;
	m = (b & 8388607) >>> 0;
	if (e === 255) {
		if (m === 0) {
			return s / 0;
		}
		return 0/0;
	}
	if (e !== 0) {
		m = m + 8388608 >>> 0;
	}
	if (e === 0) {
		e = 1;
	}
	return go$ldexp(m, e - 127 - 23) * s;
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
		case "Interface":
		case "Map":
		case "Slice":
		case "String":
			return true;
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
		if (v.constructor.kind === undefined) {
			return v; // js.Object
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
		if (t === go$packages["github.com/gopherjs/gopherjs/js"].Object) {
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
		var jsPkg = go$packages["github.com/gopherjs/gopherjs/js"];
		if (err.go$notSupported !== undefined || jsPkg === undefined) {
			go$jsErr = err;
			return;
		}
		err.go$panicValue = new jsPkg.Error.Ptr(err);
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
	if (a === null || b === null) {
		return a === null && b === null;
	}
	if (a.constructor !== b.constructor) {
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
			return a === b;
		}
		return go$pointerIsEqual(a, b);
	case "Func":
	case "Map":
	case "Slice":
	case "Struct":
		go$throwRuntimeError("comparing uncomparable type " + a.constructor);
	case undefined: // js.Object
		return a === b;
	default:
		return a.go$val === b.go$val;
	}
};
var go$float32IsEqual = function(a, b) {
	return a === a && b === b && go$float32bits(a) === go$float32bits(b);
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
go$packages["runtime"] = (function() {
	var go$pkg = {}, TypeAssertionError, errorString, sizeof_C_MStats;
	TypeAssertionError = go$pkg.TypeAssertionError = go$newType(0, "Struct", "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.go$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	errorString = go$pkg.errorString = go$newType(0, "String", "runtime.errorString", "errorString", "runtime", null);
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

			go$throwRuntimeError = function(msg) { throw go$panic(new errorString(msg)); };
			go$pkg.init = function() {
		(go$ptrType(TypeAssertionError)).methods = [["Error", "", [], [Go$String], false, -1], ["RuntimeError", "", [], [], false, -1]];
		TypeAssertionError.init([["interfaceString", "interfaceString", "runtime", Go$String, ""], ["concreteString", "concreteString", "runtime", Go$String, ""], ["assertedString", "assertedString", "runtime", Go$String, ""], ["missingMethod", "missingMethod", "runtime", Go$String, ""]]);
		errorString.methods = [["Error", "", [], [Go$String], false, -1], ["RuntimeError", "", [], [], false, -1]];
		(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false, -1], ["RuntimeError", "", [], [], false, -1]];
		sizeof_C_MStats = 3712;
		if (!((sizeof_C_MStats === 3712))) {
			console.log(sizeof_C_MStats, 3712);
			throw go$panic(new Go$String("MStats vs MemStatsType size mismatch"));
		}
	}
	return go$pkg;
})();
go$packages["github.com/gopherjs/gopherjs/js"] = (function() {
	var go$pkg = {}, Object, Error;
	Object = go$pkg.Object = go$newType(0, "Interface", "js.Object", "Object", "github.com/gopherjs/gopherjs/js", null);
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
		Object.init([["Bool", "", (go$funcType([], [Go$Bool], false))], ["Call", "", (go$funcType([Go$String, (go$sliceType(go$emptyInterface))], [Object], true))], ["Float", "", (go$funcType([], [Go$Float64], false))], ["Get", "", (go$funcType([Go$String], [Object], false))], ["Index", "", (go$funcType([Go$Int], [Object], false))], ["Int", "", (go$funcType([], [Go$Int], false))], ["Interface", "", (go$funcType([], [go$emptyInterface], false))], ["Invoke", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["IsNull", "", (go$funcType([], [Go$Bool], false))], ["IsUndefined", "", (go$funcType([], [Go$Bool], false))], ["Length", "", (go$funcType([], [Go$Int], false))], ["New", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["Set", "", (go$funcType([Go$String, go$emptyInterface], [], false))], ["SetIndex", "", (go$funcType([Go$Int, go$emptyInterface], [], false))], ["String", "", (go$funcType([], [Go$String], false))]]);
		Error.methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [Object], false, 0], ["Index", "", [Go$Int], [Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["String", "", [], [Go$String], false, 0]];
		(go$ptrType(Error)).methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true, 0], ["Error", "", [], [Go$String], false, -1], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [Object], false, 0], ["Index", "", [Go$Int], [Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true, 0], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["String", "", [], [Go$String], false, 0]];
		Error.init([["Object", "", "", Object, ""]]);
	}
	return go$pkg;
})();
go$packages["github.com/gopherjs/jquery"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], JQuery, Event, JQueryCoordinates, NewJQuery, Ajax, Get, Post;
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
		var _struct, j, _slice, _index;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		if (includeMargin.length === 0) {
			return go$parseInt(j.o.outerHeight()) >> 0;
		}
		return go$parseInt(j.o.outerHeight(go$externalize((_slice = includeMargin, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), Go$Bool))) >> 0;
	};
	JQuery.prototype.OuterHeight = function(includeMargin) { return this.go$val.OuterHeight(includeMargin); };
	JQuery.Ptr.prototype.OuterWidth = function(includeMargin) {
		var _struct, j, _slice, _index;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		if (includeMargin.length === 0) {
			return go$parseInt(j.o.outerWidth()) >> 0;
		}
		return go$parseInt(j.o.outerWidth(go$externalize((_slice = includeMargin, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), Go$Bool))) >> 0;
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
		var _struct, j, _ref, x, _slice, _index, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i.length;
		if (_ref === 0) {
			j.o = j.o[go$externalize(evt, Go$String)]();
		} else if (_ref === 1) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((function(e) {
				var x, _slice, _index;
				(x = (_slice = i, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
			}), (go$funcType([js.Object], [], false))));
		} else if (_ref === 2) {
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((x = (_slice = i, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$mapType(Go$String, go$emptyInterface)) ? x.go$val : go$typeAssertionFailed(x, (go$mapType(Go$String, go$emptyInterface))))), (go$mapType(Go$String, go$emptyInterface))), go$externalize((function(e) {
				var x$1, _slice$1, _index$1;
				(x$1 = (_slice$1 = i, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), (x$1 !== null && x$1.constructor === (go$funcType([Event], [], false)) ? x$1.go$val : go$typeAssertionFailed(x$1, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
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
		var _struct, j, count, isEventFunc, _ref, _type, _slice, _index, _ref$1, _struct$1, _slice$1, _index$1, _struct$2, _slice$2, _index$2, _struct$3, _slice$3, _index$3, _slice$4, _index$4, _struct$4, _slice$5, _index$5, _slice$6, _index$6, _struct$5, _slice$7, _index$7, _slice$8, _index$8, _slice$9, _index$9, _struct$6, _slice$10, _index$10, _slice$11, _index$11, _slice$12, _index$12, _struct$7, _slice$13, _index$13, _slice$14, _index$14, _slice$15, _index$15, _slice$16, _index$16, _struct$8, obj, _struct$9;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		count = p.length;
		isEventFunc = false;
		_ref = (_slice = p, _index = (p.length - 1 >> 0), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
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
			j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$1 = p, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), go$emptyInterface));
			return (_struct$2 = j, new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context));
		} else if (_ref$1 === 2) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$2 = p, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((function(e) {
					var x, _slice$3, _index$3;
					(x = (_slice$3 = p, _index$3 = 1, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$3 = p, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$4 = p, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$4 = j, new JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length, _struct$4.Context));
			}
		} else if (_ref$1 === 3) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$5 = p, _index$5 = 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$6 = p, _index$6 = 1, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((function(e) {
					var x, _slice$7, _index$7;
					(x = (_slice$7 = p, _index$7 = 2, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$5 = j, new JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length, _struct$5.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$7 = p, _index$7 = 0, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$8 = p, _index$8 = 1, (_index$8 >= 0 && _index$8 < _slice$8.length) ? _slice$8.array[_slice$8.offset + _index$8] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$9 = p, _index$9 = 2, (_index$9 >= 0 && _index$9 < _slice$9.length) ? _slice$9.array[_slice$9.offset + _index$9] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$6 = j, new JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length, _struct$6.Context));
			}
		} else if (_ref$1 === 4) {
			if (isEventFunc) {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$10 = p, _index$10 = 0, (_index$10 >= 0 && _index$10 < _slice$10.length) ? _slice$10.array[_slice$10.offset + _index$10] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$11 = p, _index$11 = 1, (_index$11 >= 0 && _index$11 < _slice$11.length) ? _slice$11.array[_slice$11.offset + _index$11] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$12 = p, _index$12 = 2, (_index$12 >= 0 && _index$12 < _slice$12.length) ? _slice$12.array[_slice$12.offset + _index$12] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((function(e) {
					var x, _slice$13, _index$13;
					(x = (_slice$13 = p, _index$13 = 3, (_index$13 >= 0 && _index$13 < _slice$13.length) ? _slice$13.array[_slice$13.offset + _index$13] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === (go$funcType([Event], [], false)) ? x.go$val : go$typeAssertionFailed(x, (go$funcType([Event], [], false)))))(new Event.Ptr(e, 0, null, null, null, null, null, null, 0, "", false, 0, 0, ""));
				}), (go$funcType([js.Object], [], false))));
				return (_struct$7 = j, new JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length, _struct$7.Context));
			} else {
				j.o = j.o[go$externalize(evt, Go$String)](go$externalize((_slice$13 = p, _index$13 = 0, (_index$13 >= 0 && _index$13 < _slice$13.length) ? _slice$13.array[_slice$13.offset + _index$13] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$14 = p, _index$14 = 1, (_index$14 >= 0 && _index$14 < _slice$14.length) ? _slice$14.array[_slice$14.offset + _index$14] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$15 = p, _index$15 = 2, (_index$15 >= 0 && _index$15 < _slice$15.length) ? _slice$15.array[_slice$15.offset + _index$15] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$16 = p, _index$16 = 3, (_index$16 >= 0 && _index$16 < _slice$16.length) ? _slice$16.array[_slice$16.offset + _index$16] : go$throwRuntimeError("index out of range")), go$emptyInterface));
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
		var _struct, j, _ref, _tuple, x, _slice, _index, _struct$1, selector, selOk, _tuple$1, x$1, _slice$1, _index$1, _struct$2, context, ctxOk, _slice$2, _index$2, _slice$3, _index$3, _struct$3, _slice$4, _index$4, _struct$4, _slice$5, _index$5, _struct$5, _struct$6, _tuple$2, x$2, _slice$6, _index$6, _struct$7, selector$1, selOk$1, _slice$7, _index$7, _struct$8, _struct$9, _struct$10;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		_ref = i.length;
		if (_ref === 2) {
			_tuple = (x = (_slice = i, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), (x !== null && x.constructor === JQuery ? [x.go$val, true] : [new JQuery.Ptr(), false])); selector = (_struct$1 = _tuple[0], new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context)); selOk = _tuple[1];
			_tuple$1 = (x$1 = (_slice$1 = i, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), (x$1 !== null && x$1.constructor === JQuery ? [x$1.go$val, true] : [new JQuery.Ptr(), false])); context = (_struct$2 = _tuple$1[0], new JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length, _struct$2.Context)); ctxOk = _tuple$1[1];
			if (!selOk && !ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize((_slice$2 = i, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$3 = i, _index$3 = 1, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$3 = j, new JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length, _struct$3.Context));
			} else if (selOk && !ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](selector.o, go$externalize((_slice$4 = i, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")), go$emptyInterface));
				return (_struct$4 = j, new JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length, _struct$4.Context));
			} else if (!selOk && ctxOk) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize((_slice$5 = i, _index$5 = 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")), go$emptyInterface), context.o);
				return (_struct$5 = j, new JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length, _struct$5.Context));
			}
			j.o = j.o[go$externalize(method, Go$String)](selector.o, context.o);
			return (_struct$6 = j, new JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length, _struct$6.Context));
		} else if (_ref === 1) {
			_tuple$2 = (x$2 = (_slice$6 = i, _index$6 = 0, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range")), (x$2 !== null && x$2.constructor === JQuery ? [x$2.go$val, true] : [new JQuery.Ptr(), false])); selector$1 = (_struct$7 = _tuple$2[0], new JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length, _struct$7.Context)); selOk$1 = _tuple$2[1];
			if (!selOk$1) {
				j.o = j.o[go$externalize(method, Go$String)](go$externalize((_slice$7 = i, _index$7 = 0, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")), go$emptyInterface));
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
		go$global.jQuery.ajax(go$externalize(options, (go$mapType(Go$String, go$emptyInterface))));
	};
	Get = go$pkg.Get = function(i) {
		var obj;
		(obj = go$global.jQuery, obj.get.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
	};
	Post = go$pkg.Post = function(i) {
		var obj;
		(obj = go$global.jQuery, obj.post.apply(obj, go$externalize(i, (go$sliceType(go$emptyInterface)))));
	};
	go$pkg.init = function() {
		JQuery.methods = [["Add", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddBack", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddClass", "", [go$emptyInterface], [JQuery], false, -1], ["After", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Append", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AppendTo", "", [go$emptyInterface], [JQuery], false, -1], ["Attr", "", [Go$String], [Go$String], false, -1], ["Before", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Blur", "", [], [JQuery], false, -1], ["Children", "", [go$emptyInterface], [JQuery], false, -1], ["ClearQueue", "", [Go$String], [JQuery], false, -1], ["Clone", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Closest", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Contents", "", [], [JQuery], false, -1], ["Css", "", [Go$String], [Go$String], false, -1], ["CssArray", "", [(go$sliceType(Go$String))], [(go$mapType(Go$String, go$emptyInterface))], true, -1], ["Data", "", [Go$String], [go$emptyInterface], false, -1], ["Delay", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Dequeue", "", [Go$String], [JQuery], false, -1], ["Detach", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Each", "", [(go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))], [JQuery], false, -1], ["Empty", "", [], [JQuery], false, -1], ["End", "", [], [JQuery], false, -1], ["Eq", "", [Go$Int], [JQuery], false, -1], ["FadeIn", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["FadeOut", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Filter", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Find", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["First", "", [], [JQuery], false, -1], ["Focus", "", [], [JQuery], false, -1], ["Get", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, -1], ["Has", "", [Go$String], [JQuery], false, -1], ["HasClass", "", [Go$String], [Go$Bool], false, -1], ["Height", "", [], [Go$Int], false, -1], ["Hide", "", [], [JQuery], false, -1], ["Html", "", [], [Go$String], false, -1], ["InnerHeight", "", [], [Go$Int], false, -1], ["InnerWidth", "", [], [Go$Int], false, -1], ["InsertAfter", "", [go$emptyInterface], [JQuery], false, -1], ["InsertBefore", "", [go$emptyInterface], [JQuery], false, -1], ["Is", "", [(go$sliceType(go$emptyInterface))], [Go$Bool], true, -1], ["Last", "", [], [JQuery], false, -1], ["Load", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Next", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Not", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Off", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Offset", "", [], [JQueryCoordinates], false, -1], ["OffsetParent", "", [], [JQuery], false, -1], ["On", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["One", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["OuterHeight", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["OuterWidth", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["Parent", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Parents", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ParentsUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Position", "", [], [JQueryCoordinates], false, -1], ["Prepend", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrependTo", "", [go$emptyInterface], [JQuery], false, -1], ["Prev", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Prop", "", [Go$String], [go$emptyInterface], false, -1], ["Ready", "", [(go$funcType([], [], false))], [JQuery], false, -1], ["Remove", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["RemoveAttr", "", [Go$String], [JQuery], false, -1], ["RemoveClass", "", [Go$String], [JQuery], false, -1], ["RemoveData", "", [Go$String], [JQuery], false, -1], ["RemoveProp", "", [Go$String], [JQuery], false, -1], ["ReplaceAll", "", [go$emptyInterface], [JQuery], false, -1], ["ReplaceWith", "", [go$emptyInterface], [JQuery], false, -1], ["Resize", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Scroll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ScrollLeft", "", [], [Go$Int], false, -1], ["ScrollTop", "", [], [Go$Int], false, -1], ["Select", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Serialize", "", [], [Go$String], false, -1], ["SerializeArray", "", [], [js.Object], false, -1], ["SetAttr", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetCss", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetData", "", [Go$String, go$emptyInterface], [JQuery], false, -1], ["SetHeight", "", [Go$String], [JQuery], false, -1], ["SetHtml", "", [go$emptyInterface], [JQuery], false, -1], ["SetOffset", "", [JQueryCoordinates], [JQuery], false, -1], ["SetProp", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetScrollLeft", "", [Go$Int], [JQuery], false, -1], ["SetScrollTop", "", [Go$Int], [JQuery], false, -1], ["SetText", "", [go$emptyInterface], [JQuery], false, -1], ["SetVal", "", [go$emptyInterface], [JQuery], false, -1], ["SetWidth", "", [go$emptyInterface], [JQuery], false, -1], ["Show", "", [], [JQuery], false, -1], ["Siblings", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Slice", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Stop", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Submit", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Text", "", [], [Go$String], false, -1], ["ToArray", "", [], [(go$sliceType(go$emptyInterface))], false, -1], ["Toggle", "", [Go$Bool], [JQuery], false, -1], ["ToggleClass", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Trigger", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Underlying", "", [], [js.Object], false, -1], ["Unwrap", "", [], [JQuery], false, -1], ["Val", "", [], [Go$String], false, -1], ["Width", "", [], [Go$Int], false, -1], ["Wrap", "", [go$emptyInterface], [JQuery], false, -1], ["WrapAll", "", [go$emptyInterface], [JQuery], false, -1], ["WrapInner", "", [go$emptyInterface], [JQuery], false, -1], ["dom1arg", "github.com/gopherjs/jquery", [Go$String, go$emptyInterface], [JQuery], false, -1], ["dom2args", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["events", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["handleEvent", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1]];
		(go$ptrType(JQuery)).methods = [["Add", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddBack", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AddClass", "", [go$emptyInterface], [JQuery], false, -1], ["After", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Append", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["AppendTo", "", [go$emptyInterface], [JQuery], false, -1], ["Attr", "", [Go$String], [Go$String], false, -1], ["Before", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Blur", "", [], [JQuery], false, -1], ["Children", "", [go$emptyInterface], [JQuery], false, -1], ["ClearQueue", "", [Go$String], [JQuery], false, -1], ["Clone", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Closest", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Contents", "", [], [JQuery], false, -1], ["Css", "", [Go$String], [Go$String], false, -1], ["CssArray", "", [(go$sliceType(Go$String))], [(go$mapType(Go$String, go$emptyInterface))], true, -1], ["Data", "", [Go$String], [go$emptyInterface], false, -1], ["Delay", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Dequeue", "", [Go$String], [JQuery], false, -1], ["Detach", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Each", "", [(go$funcType([Go$Int, go$emptyInterface], [go$emptyInterface], false))], [JQuery], false, -1], ["Empty", "", [], [JQuery], false, -1], ["End", "", [], [JQuery], false, -1], ["Eq", "", [Go$Int], [JQuery], false, -1], ["FadeIn", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["FadeOut", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Filter", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Find", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["First", "", [], [JQuery], false, -1], ["Focus", "", [], [JQuery], false, -1], ["Get", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, -1], ["Has", "", [Go$String], [JQuery], false, -1], ["HasClass", "", [Go$String], [Go$Bool], false, -1], ["Height", "", [], [Go$Int], false, -1], ["Hide", "", [], [JQuery], false, -1], ["Html", "", [], [Go$String], false, -1], ["InnerHeight", "", [], [Go$Int], false, -1], ["InnerWidth", "", [], [Go$Int], false, -1], ["InsertAfter", "", [go$emptyInterface], [JQuery], false, -1], ["InsertBefore", "", [go$emptyInterface], [JQuery], false, -1], ["Is", "", [(go$sliceType(go$emptyInterface))], [Go$Bool], true, -1], ["Last", "", [], [JQuery], false, -1], ["Load", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Next", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["NextUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Not", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Off", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Offset", "", [], [JQueryCoordinates], false, -1], ["OffsetParent", "", [], [JQuery], false, -1], ["On", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["One", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["OuterHeight", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["OuterWidth", "", [(go$sliceType(Go$Bool))], [Go$Int], true, -1], ["Parent", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Parents", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ParentsUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Position", "", [], [JQueryCoordinates], false, -1], ["Prepend", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrependTo", "", [go$emptyInterface], [JQuery], false, -1], ["Prev", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevAll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["PrevUntil", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Prop", "", [Go$String], [go$emptyInterface], false, -1], ["Ready", "", [(go$funcType([], [], false))], [JQuery], false, -1], ["Remove", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["RemoveAttr", "", [Go$String], [JQuery], false, -1], ["RemoveClass", "", [Go$String], [JQuery], false, -1], ["RemoveData", "", [Go$String], [JQuery], false, -1], ["RemoveProp", "", [Go$String], [JQuery], false, -1], ["ReplaceAll", "", [go$emptyInterface], [JQuery], false, -1], ["ReplaceWith", "", [go$emptyInterface], [JQuery], false, -1], ["Resize", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Scroll", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["ScrollLeft", "", [], [Go$Int], false, -1], ["ScrollTop", "", [], [Go$Int], false, -1], ["Select", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Serialize", "", [], [Go$String], false, -1], ["SerializeArray", "", [], [js.Object], false, -1], ["SetAttr", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetCss", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetData", "", [Go$String, go$emptyInterface], [JQuery], false, -1], ["SetHeight", "", [Go$String], [JQuery], false, -1], ["SetHtml", "", [go$emptyInterface], [JQuery], false, -1], ["SetOffset", "", [JQueryCoordinates], [JQuery], false, -1], ["SetProp", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["SetScrollLeft", "", [Go$Int], [JQuery], false, -1], ["SetScrollTop", "", [Go$Int], [JQuery], false, -1], ["SetText", "", [go$emptyInterface], [JQuery], false, -1], ["SetVal", "", [go$emptyInterface], [JQuery], false, -1], ["SetWidth", "", [go$emptyInterface], [JQuery], false, -1], ["Show", "", [], [JQuery], false, -1], ["Siblings", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Slice", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Stop", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Submit", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Text", "", [], [Go$String], false, -1], ["ToArray", "", [], [(go$sliceType(go$emptyInterface))], false, -1], ["Toggle", "", [Go$Bool], [JQuery], false, -1], ["ToggleClass", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Trigger", "", [(go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["Underlying", "", [], [js.Object], false, -1], ["Unwrap", "", [], [JQuery], false, -1], ["Val", "", [], [Go$String], false, -1], ["Width", "", [], [Go$Int], false, -1], ["Wrap", "", [go$emptyInterface], [JQuery], false, -1], ["WrapAll", "", [go$emptyInterface], [JQuery], false, -1], ["WrapInner", "", [go$emptyInterface], [JQuery], false, -1], ["dom1arg", "github.com/gopherjs/jquery", [Go$String, go$emptyInterface], [JQuery], false, -1], ["dom2args", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["events", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1], ["handleEvent", "github.com/gopherjs/jquery", [Go$String, (go$sliceType(go$emptyInterface))], [JQuery], true, -1]];
		JQuery.init([["o", "o", "github.com/gopherjs/jquery", js.Object, ""], ["Jquery", "Jquery", "", Go$String, "js:\"jquery\""], ["Selector", "Selector", "", Go$String, "js:\"selector\""], ["Length", "Length", "", Go$String, "js:\"length\""], ["Context", "Context", "", Go$String, "js:\"context\""]]);
		Event.methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [js.Object], false, 0], ["Index", "", [Go$Int], [js.Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsNull", "", [], [Go$Bool], false, 0], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["String", "", [], [Go$String], false, 0]];
		(go$ptrType(Event)).methods = [["Bool", "", [], [Go$Bool], false, 0], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["Float", "", [], [Go$Float64], false, 0], ["Get", "", [Go$String], [js.Object], false, 0], ["Index", "", [Go$Int], [js.Object], false, 0], ["Int", "", [], [Go$Int], false, 0], ["Interface", "", [], [go$emptyInterface], false, 0], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["IsDefaultPrevented", "", [], [Go$Bool], false, -1], ["IsImmediatePropogationStopped", "", [], [Go$Bool], false, -1], ["IsNull", "", [], [Go$Bool], false, 0], ["IsPropagationStopped", "", [], [Go$Bool], false, -1], ["IsUndefined", "", [], [Go$Bool], false, 0], ["Length", "", [], [Go$Int], false, 0], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true, 0], ["PreventDefault", "", [], [], false, -1], ["Set", "", [Go$String, go$emptyInterface], [], false, 0], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false, 0], ["StopImmediatePropagation", "", [], [], false, -1], ["StopPropagation", "", [], [], false, -1], ["String", "", [], [Go$String], false, 0]];
		Event.init([["Object", "", "", js.Object, ""], ["KeyCode", "KeyCode", "", Go$Int, "js:\"keyCode\""], ["Target", "Target", "", js.Object, "js:\"target\""], ["CurrentTarget", "CurrentTarget", "", js.Object, "js:\"currentTarget\""], ["DelegateTarget", "DelegateTarget", "", js.Object, "js:\"delegateTarget\""], ["RelatedTarget", "RelatedTarget", "", js.Object, "js:\"relatedTarget\""], ["Data", "Data", "", js.Object, "js:\"data\""], ["Result", "Result", "", js.Object, "js:\"result\""], ["Which", "Which", "", Go$Int, "js:\"which\""], ["Namespace", "Namespace", "", Go$String, "js:\"namespace\""], ["MetaKey", "MetaKey", "", Go$Bool, "js:\"metaKey\""], ["PageX", "PageX", "", Go$Int, "js:\"pageX\""], ["PageY", "PageY", "", Go$Int, "js:\"pageY\""], ["Type", "Type", "", Go$String, "js:\"type\""]]);
		JQueryCoordinates.init([["Left", "Left", "", Go$Int, ""], ["Top", "Top", "", Go$Int, ""]]);
	}
	return go$pkg;
})();
go$packages["main"] = (function() {
	var go$pkg = {}, js = go$packages["github.com/gopherjs/gopherjs/js"], jquery = go$packages["github.com/gopherjs/jquery"], Object, isChecked, stringify, main, jQuery;
	Object = go$pkg.Object = go$newType(0, "Map", "main.Object", "Object", "main", null);
	isChecked = function() {
		return jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("input[name='console']")])).Is(new (go$sliceType(go$emptyInterface))([new Go$String(":checked")]));
	};
	stringify = function(i) {
		return go$internalize(go$global.JSON.stringify(go$externalize(i, go$emptyInterface)), Go$String);
	};
	main = go$pkg.main = function() {
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#btnAjaxGopherJs")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([], [], false))((function() {
			var _map, _key, ajaxopt;
			if (isChecked()) {
				console.log("GoperJS here");
			}
			ajaxopt = (_map = new Go$Map(), _key = "async", _map[_key] = { k: _key, v: new Go$Bool(true) }, _key = "type", _map[_key] = { k: _key, v: new Go$String("POST") }, _key = "url", _map[_key] = { k: _key, v: new Go$String("http://localhost:3000/json/") }, _key = "contentType", _map[_key] = { k: _key, v: new Go$String("application/json; charset=utf-8") }, _key = "dataType", _map[_key] = { k: _key, v: new Go$String("json") }, _key = "data", _map[_key] = { k: _key, v: null }, _key = "beforeSend", _map[_key] = { k: _key, v: new (go$funcType([Object], [], false))((function(data) {
				if (isChecked()) {
					console.log(" before:", data);
				}
			})) }, _key = "success", _map[_key] = { k: _key, v: new (go$funcType([Object], [], false))((function(data) {
				var dataStr, _ref, _i, _keys, _entry, v, k, _ref$1, _type;
				dataStr = stringify(new Object(data));
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#inTextArea")])).SetVal(new Go$String(dataStr));
				if (isChecked()) {
					console.log(" success:", data);
					_ref = data;
					_i = 0;
					_keys = go$keys(_ref);
					while (_i < _keys.length) {
						_entry = _ref[_keys[_i]];
						v = _entry.v;
						k = _entry.k;
						_ref$1 = v;
						_type = _ref$1 !== null ? _ref$1.constructor : null;
						if (_type === Go$Bool) {
							console.log(k, (v !== null && v.constructor === Go$Bool ? v.go$val : go$typeAssertionFailed(v, Go$Bool)));
						} else if (_type === Go$String) {
							console.log(k, (v !== null && v.constructor === Go$String ? v.go$val : go$typeAssertionFailed(v, Go$String)));
						} else if (_type === Go$Float64) {
							console.log(k, (v !== null && v.constructor === Go$Float64 ? v.go$val : go$typeAssertionFailed(v, Go$Float64)));
						} else {
							console.log("sth. else:", k, v);
						}
						_i++;
					}
				}
			})) }, _key = "error", _map[_key] = { k: _key, v: new (go$funcType([go$emptyInterface], [], false))((function(status) {
				if (isChecked()) {
					console.log(" error:", status);
				}
			})) }, _map);
			jquery.Ajax(ajaxopt);
		}))]));
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#btnLoadGopherJS")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([], [], false))((function() {
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#result")])).Load(new (go$sliceType(go$emptyInterface))([new Go$String("/load.html"), new (go$funcType([], [], false))((function() {
				if (isChecked()) {
					console.log("load was performed");
				}
			}))]));
		}))]));
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#btnGetGopherJS")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([], [], false))((function() {
			jquery.Get(new (go$sliceType(go$emptyInterface))([new Go$String("/get.html"), new (go$funcType([go$emptyInterface, Go$String, go$emptyInterface], [], false))((function(data, status, xhr) {
				if (isChecked()) {
					console.log(" data:   ", data);
					console.log(" status: ", status);
					console.log(" xhr:    ", xhr);
				}
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#result")])).SetHtml(data);
			}))]));
		}))]));
		jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#btnPostGopherJS")])).On(new (go$sliceType(go$emptyInterface))([new Go$String("click"), new (go$funcType([], [], false))((function() {
			jquery.Post(new (go$sliceType(go$emptyInterface))([new Go$String("/gopher"), new (go$funcType([go$emptyInterface, Go$String, go$emptyInterface], [], false))((function(data, status, xhr) {
				if (isChecked()) {
					console.log(" data:   ", data);
					console.log(" status: ", status);
					console.log(" xhr:    ", xhr);
				}
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#result")])).SetHtml(data);
			}))]));
		}))]));
	};
	go$pkg.init = function() {
		Object.init(Go$String, go$emptyInterface);
		jQuery = jquery.NewJQuery;
	}
	return go$pkg;
})();
go$error.implementedBy = [go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorString)];
go$packages["github.com/gopherjs/gopherjs/js"].Object.implementedBy = [go$packages["github.com/gopherjs/gopherjs/js"].Error, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["github.com/gopherjs/jquery"].Event, go$packages["github.com/gopherjs/jquery"].Event.Ptr];
go$packages["runtime"].init();
go$packages["github.com/gopherjs/gopherjs/js"].init();
go$packages["github.com/gopherjs/jquery"].init();
go$packages["main"].init();
go$packages["main"].main();

})();
//# sourceMappingURL=testgo.js.map
