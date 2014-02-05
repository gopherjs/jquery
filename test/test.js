"use strict";
Error.stackTraceLimit = -1;

var go$reservedKeywords = ["abstract", "arguments", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double", "else", "enum", "eval", "export", "extends", "false", "final", "finally", "float", "for", "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface", "let", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield"];

var go$global;
if (typeof window !== "undefined") {
	go$global = window;
} else if (typeof GLOBAL !== "undefined") {
	go$global = GLOBAL;
}

var go$idCounter = 1;
var go$keys = function(m) { return m ? Object.keys(m) : []; };
var go$min = Math.min;
var go$parseInt = parseInt;
var go$parseFloat = parseFloat;
var go$reflect, go$newStringPtr;
var Go$Array = Array;
var Go$Error = Error;

var go$mapArray = function(array, f) {
	var newArray = new array.constructor(array.length), i;
	for (i = 0; i < array.length; i += 1) {
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
	case "Float32":
	case "Float64":
	case "String":
	case "UnsafePointer":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + this.go$val; };
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
				this.go$id = go$idCounter;
				go$idCounter += 1;
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
				this.go$id = go$idCounter;
				go$idCounter += 1;
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
			for (i = 0; i < capacity; i += 1) {
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
			typ.Ptr.init(typ);
			typ.Ptr.nil = new constructor();
			var i;
			for (i = 0; i < fields.length; i++) {
				var field = fields[i];
				Object.defineProperty(typ.Ptr.nil, field[0], { get: go$throwNilPointerError, set: go$throwNilPointerError });
			}
			typ.prototype.go$key = function() {
				var keys = new Array(fields.length);
				for (i = 0; i < fields.length; i++) {
					var v = this.go$val[go$fieldName(fields, i)];
					var key = v.go$key ? v.go$key() : String(v);
					keys[i] = key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}
				return string + "$" + keys.join("$");
			};
			typ.extendReflectType = function(rt) {
				var reflectFields = new Array(fields.length), i;
				for (i = 0; i < fields.length; i++) {
					var field = fields[i];
					reflectFields[i] = new go$reflect.structField(go$newStringPtr(field[0]), go$newStringPtr(field[1]), field[2].reflectType(), go$newStringPtr(field[3]), i);
				}
				rt.structType = new go$reflect.structType(rt, new (go$sliceType(go$reflect.structField))(reflectFields));
			};
		};
		break;

	default:
		throw go$panic("invalid kind: " + kind);
	}

	typ.kind = kind;
	typ.string = string;
	typ.typeName = name;
	typ.pkgPath = pkgPath;
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
	for (i = 0; i < length; i += 1) {
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
	for (i = 0; i < names.length; i += 1) {
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

var go$fieldName = function(fields, i) {
	var field = fields[i];
	var name = field[0];
	if (name === "") {
		var ntyp = field[2];
		if (ntyp.kind === "Ptr") {
			ntyp = ntyp.elem;
		}
		return ntyp.typeName;
	}
	if (name === "_" || go$reservedKeywords.indexOf(name) != -1) {
		return name + "$" + i;
	}
	return name;
};

var go$structTypes = {};
var go$structType = function(fields) {
	var string = "struct { " + go$mapArray(fields, function(f) {
		return f[0] + " " + f[2].string + (f[3] !== "" ? (' "' + f[3].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"') : "");
	}).join("; ") + " }";
	var typ = go$structTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Struct", string, "", "", function() {
			this.go$val = this;
			var i;
			for (i = 0; i < fields.length; i++) {
				this[go$fieldName(fields, i)] = arguments[i];
			}
		});
		typ.init(fields);
		var i, j;
		for (i = 0; i < fields.length; i++) {
			var field = fields[i];
			if (field[0] === "" && field[2].prototype !== undefined) {
				var methods = Object.keys(field[2].prototype);
				for (j = 0; j < methods.length; j += 1) {
					(function(fieldName, methodName, method) {
						typ.prototype[methodName] = function() {
							return method.apply(this.go$val[fieldName], arguments);
						};
						typ.Ptr.prototype[methodName] = function() {
							return method.apply(this[fieldName], arguments);
						};
					})(field[0], methods[j], field[2].prototype[methods[j]]);
				}
			}
		}
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

var go$float32bits = function(f) {
	var s, e;
	if (f === 0) {
		if (f === 0 && 1 / f === 1 / -0) {
			return 2147483648;
		}
		return 0;
	}
	if (!(f === f)) {
		return 2143289344;
	}
	s = 0;
	if (f < 0) {
		s = 2147483648;
		f = -f;
	}
	e = 150;
	while (f >= 1.6777216e+07) {
		f = f / (2);
		if (e === 255) {
			break;
		}
		e = (e + (1) >>> 0);
	}
	while (f < 8.388608e+06) {
		e = (e - (1) >>> 0);
		if (e === 0) {
			break;
		}
		f = f * (2);
	}
	return ((((s | (((e >>> 0) << 23) >>> 0)) >>> 0) | ((((((f + 0.5) >> 0) >>> 0) &~ 8388608) >>> 0))) >>> 0);
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
	for (i = 1; i < 32; i += 1) {
		if ((y.low & 1<<i) !== 0) {
			high += x.high << i | x.low >>> (32 - i);
			low += (x.low << i) >>> 0;
		}
	}
	for (i = 0; i < 32; i += 1) {
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
			xHigh -= 1;
			xLow = 4294967296 - xLow;
		}
	}

	var yHigh = y.high;
	var yLow = y.low;
	if (y.high < 0) {
		s *= -1;
		yHigh = -yHigh;
		if (yLow !== 0) {
			yHigh -= 1;
			yLow = 4294967296 - yLow;
		}
	}

	var high = 0, low = 0, n = 0, i;
	while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
		yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
		yLow = (yLow << 1) >>> 0;
		n += 1;
	}
	for (i = 0; i <= n; i += 1) {
		high = high << 1 | low >>> 31;
		low = (low << 1) >>> 0;
		if ((xHigh > yHigh) || (xHigh === yHigh && xLow >= yLow)) {
			xHigh = xHigh - yHigh;
			xLow = xLow - yLow;
			if (xLow < 0) {
				xHigh -= 1;
				xLow += 4294967296;
			}
			low += 1;
			if (low === 4294967296) {
				high += 1;
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
	for (i = 0; i < str.length; i += 1) {
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
	for (i = 0; i < str.length; i += rune[1], j += 1) {
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
	for (i = 0; i < slice.length; i += 1) {
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
		for (i = 0; i < t.params.length; i += 1) {
			convert = convert || (t.params[i] !== go$packages["github.com/neelance/gopherjs/js"].Object);
		}
		for (i = 0; i < t.results.length; i += 1) {
			convert = convert || go$needsExternalization(t.results[i]);
		}
		if (!convert) {
			return v;
		}
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i += 1) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = [], j;
					for (j = i; j < arguments.length; j += 1) {
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
		for (i = 0; i < keys.length; i += 1) {
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
		for (i = 0; i < v.length; i += r[1], j += 1) {
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
			throw go$panic("got array with wrong size from JavaScript native");
		}
		return go$mapArray(v, function(e) { return go$internalize(e, t.elem); });
	case "Func":
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i += 1) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = arguments[i], j;
					for (j = 0; j < varargs.length; j += 1) {
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
		if (t === go$packages["github.com/neelance/gopherjs/js"].Object) {
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
			var funcType = go$funcType([go$sliceType(go$emptyInterface)], [go$packages["github.com/neelance/gopherjs/js"].Object], true);
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
		for (i = 0; i < keys.length; i += 1) {
			var key = go$internalize(keys[i], t.key);
			m[key.go$key ? key.go$key() : key] = { k: key, v: go$internalize(v[keys[i]], t.elem) };
		}
		return m;
	case "Slice":
		return new t(go$mapArray(v, function(e) { return go$internalize(e, t.elem); }));
	case "String":
		v = String(v);
		var s = "", i;
		for (i = 0; i < v.length; i += 1) {
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
	for (i = 0; i < n; i += 1) {
		dst.array[dst.offset + i] = src.array[src.offset + i];
	}
	return n;
};

var go$copyString = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	for (i = 0; i < n; i += 1) {
		dst.array[dst.offset + i] = src.charCodeAt(i);
	}
	return n;
};

var go$copyArray = function(dst, src) {
	var i;
	for (i = 0; i < src.length; i += 1) {
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
	for (i = 1; i < arguments.length; i += 1) {
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
	for (i = 0; i < toAppend.length; i += 1) {
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
	var err = new Error("not supported by GopherJS: " + feature + " (hint: the file optional.go.patch contains patches for core packages)");
	err.go$notSupported = feature;
	throw err;
};
var go$throwRuntimeError; // set by package "runtime"

var go$errorStack = [], go$jsErr = null;

var go$pushErr = function(err) {
	if (err.go$panicValue === undefined) {
		var jsPkg = go$packages["github.com/neelance/gopherjs/js"];
		if (err.go$notSupported !== undefined || jsPkg === undefined) {
			go$jsErr = err;
			return;
		}
		err.go$panicValue = new jsPkg.Error.Ptr(err);
	}
	go$errorStack.push({ frame: go$getStackDepth() - 1, error: err });
};

var go$callDeferred = function(deferred) {
	if (go$jsErr !== null) {
		throw go$jsErr;
	}
	var i;
	for (i = deferred.length - 1; i >= 0; i -= 1) {
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
	if (err === undefined || err.frame !== go$getStackDepth() - 2) {
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
	for (i = 0; i < s.length; i += 1) {
		if (s[i].indexOf("go$callDeferred") == -1) {
			d += 1;
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
		return go$float32bits(a.go$val) === go$float32bits(b.go$val);
	case "Complex64":
		return go$float32bits(a.go$val.real) === go$float32bits(b.go$val.real) && go$float32bits(a.go$val.imag) === go$float32bits(b.go$val.imag);
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
var go$arrayIsEqual = function(a, b) {
	if (a.length != b.length) {
		return false;
	}
	var i;
	for (i = 0; i < a.length; i += 1) {
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
	var got = "nil";
	if (obj !== null) {
		got = obj.constructor.string;
	}
	throw go$panic("interface conversion: interface is " + got + ", not " + expected.string);
};

var go$now = function() { var msec = (new Date()).getTime(); return [new Go$Int64(0, Math.floor(msec / 1000)), (msec % 1000) * 1000000]; };

var go$packages = {};
go$packages["runtime"] = (function() {
	var go$pkg = {};
	var MemProfileRecord;
	MemProfileRecord = go$newType(0, "Struct", "runtime.MemProfileRecord", "MemProfileRecord", "runtime", function(AllocBytes_, FreeBytes_, AllocObjects_, FreeObjects_, Stack0_) {
		this.go$val = this;
		this.AllocBytes = AllocBytes_ !== undefined ? AllocBytes_ : new Go$Int64(0, 0);
		this.FreeBytes = FreeBytes_ !== undefined ? FreeBytes_ : new Go$Int64(0, 0);
		this.AllocObjects = AllocObjects_ !== undefined ? AllocObjects_ : new Go$Int64(0, 0);
		this.FreeObjects = FreeObjects_ !== undefined ? FreeObjects_ : new Go$Int64(0, 0);
		this.Stack0 = Stack0_ !== undefined ? Stack0_ : go$makeNativeArray("Uintptr", 32, function() { return 0; });
	});
	go$pkg.MemProfileRecord = MemProfileRecord;
	var StackRecord;
	StackRecord = go$newType(0, "Struct", "runtime.StackRecord", "StackRecord", "runtime", function(Stack0_) {
		this.go$val = this;
		this.Stack0 = Stack0_ !== undefined ? Stack0_ : go$makeNativeArray("Uintptr", 32, function() { return 0; });
	});
	go$pkg.StackRecord = StackRecord;
	var BlockProfileRecord;
	BlockProfileRecord = go$newType(0, "Struct", "runtime.BlockProfileRecord", "BlockProfileRecord", "runtime", function(Count_, Cycles_, StackRecord_) {
		this.go$val = this;
		this.Count = Count_ !== undefined ? Count_ : new Go$Int64(0, 0);
		this.Cycles = Cycles_ !== undefined ? Cycles_ : new Go$Int64(0, 0);
		this.StackRecord = StackRecord_ !== undefined ? StackRecord_ : new StackRecord.Ptr();
	});
	BlockProfileRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	BlockProfileRecord.Ptr.prototype.Stack = function() { return this.StackRecord.Stack(); };
	go$pkg.BlockProfileRecord = BlockProfileRecord;
	var Error;
	Error = go$newType(0, "Interface", "runtime.Error", "Error", "runtime", null);
	go$pkg.Error = Error;
	var TypeAssertionError;
	TypeAssertionError = go$newType(0, "Struct", "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.go$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	go$pkg.TypeAssertionError = TypeAssertionError;
	var errorString;
	errorString = go$newType(0, "String", "runtime.errorString", "errorString", "runtime", null);
	go$pkg.errorString = errorString;
	var errorCString;
	errorCString = go$newType(4, "Uintptr", "runtime.errorCString", "errorCString", "runtime", null);
	go$pkg.errorCString = errorCString;
	var stringer;
	stringer = go$newType(0, "Interface", "runtime.stringer", "stringer", "runtime", null);
	go$pkg.stringer = stringer;
	var Func;
	Func = go$newType(0, "Struct", "runtime.Func", "Func", "runtime", function(opaque_) {
		this.go$val = this;
		this.opaque = opaque_ !== undefined ? opaque_ : new (go$structType([])).Ptr();
	});
	go$pkg.Func = Func;
	var MemStats;
	MemStats = go$newType(0, "Struct", "runtime.MemStats", "MemStats", "runtime", function(Alloc_, TotalAlloc_, Sys_, Lookups_, Mallocs_, Frees_, HeapAlloc_, HeapSys_, HeapIdle_, HeapInuse_, HeapReleased_, HeapObjects_, StackInuse_, StackSys_, MSpanInuse_, MSpanSys_, MCacheInuse_, MCacheSys_, BuckHashSys_, GCSys_, OtherSys_, NextGC_, LastGC_, PauseTotalNs_, PauseNs_, NumGC_, EnableGC_, DebugGC_, BySize_) {
		this.go$val = this;
		this.Alloc = Alloc_ !== undefined ? Alloc_ : new Go$Uint64(0, 0);
		this.TotalAlloc = TotalAlloc_ !== undefined ? TotalAlloc_ : new Go$Uint64(0, 0);
		this.Sys = Sys_ !== undefined ? Sys_ : new Go$Uint64(0, 0);
		this.Lookups = Lookups_ !== undefined ? Lookups_ : new Go$Uint64(0, 0);
		this.Mallocs = Mallocs_ !== undefined ? Mallocs_ : new Go$Uint64(0, 0);
		this.Frees = Frees_ !== undefined ? Frees_ : new Go$Uint64(0, 0);
		this.HeapAlloc = HeapAlloc_ !== undefined ? HeapAlloc_ : new Go$Uint64(0, 0);
		this.HeapSys = HeapSys_ !== undefined ? HeapSys_ : new Go$Uint64(0, 0);
		this.HeapIdle = HeapIdle_ !== undefined ? HeapIdle_ : new Go$Uint64(0, 0);
		this.HeapInuse = HeapInuse_ !== undefined ? HeapInuse_ : new Go$Uint64(0, 0);
		this.HeapReleased = HeapReleased_ !== undefined ? HeapReleased_ : new Go$Uint64(0, 0);
		this.HeapObjects = HeapObjects_ !== undefined ? HeapObjects_ : new Go$Uint64(0, 0);
		this.StackInuse = StackInuse_ !== undefined ? StackInuse_ : new Go$Uint64(0, 0);
		this.StackSys = StackSys_ !== undefined ? StackSys_ : new Go$Uint64(0, 0);
		this.MSpanInuse = MSpanInuse_ !== undefined ? MSpanInuse_ : new Go$Uint64(0, 0);
		this.MSpanSys = MSpanSys_ !== undefined ? MSpanSys_ : new Go$Uint64(0, 0);
		this.MCacheInuse = MCacheInuse_ !== undefined ? MCacheInuse_ : new Go$Uint64(0, 0);
		this.MCacheSys = MCacheSys_ !== undefined ? MCacheSys_ : new Go$Uint64(0, 0);
		this.BuckHashSys = BuckHashSys_ !== undefined ? BuckHashSys_ : new Go$Uint64(0, 0);
		this.GCSys = GCSys_ !== undefined ? GCSys_ : new Go$Uint64(0, 0);
		this.OtherSys = OtherSys_ !== undefined ? OtherSys_ : new Go$Uint64(0, 0);
		this.NextGC = NextGC_ !== undefined ? NextGC_ : new Go$Uint64(0, 0);
		this.LastGC = LastGC_ !== undefined ? LastGC_ : new Go$Uint64(0, 0);
		this.PauseTotalNs = PauseTotalNs_ !== undefined ? PauseTotalNs_ : new Go$Uint64(0, 0);
		this.PauseNs = PauseNs_ !== undefined ? PauseNs_ : go$makeNativeArray("Uint64", 256, function() { return new Go$Uint64(0, 0); });
		this.NumGC = NumGC_ !== undefined ? NumGC_ : 0;
		this.EnableGC = EnableGC_ !== undefined ? EnableGC_ : false;
		this.DebugGC = DebugGC_ !== undefined ? DebugGC_ : false;
		this.BySize = BySize_ !== undefined ? BySize_ : go$makeNativeArray("Struct", 61, function() { return new (go$structType([["Size", "", Go$Uint32, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""]])).Ptr(0, new Go$Uint64(0, 0), new Go$Uint64(0, 0)); });
	});
	go$pkg.MemStats = MemStats;
	var rtype;
	rtype = go$newType(0, "Struct", "runtime.rtype", "rtype", "runtime", function(size_, hash_, _$2_, align_, fieldAlign_, kind_, alg_, gc_, string_, uncommonType_, ptrToThis_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : 0;
		this.hash = hash_ !== undefined ? hash_ : 0;
		this._$2 = _$2_ !== undefined ? _$2_ : 0;
		this.align = align_ !== undefined ? align_ : 0;
		this.fieldAlign = fieldAlign_ !== undefined ? fieldAlign_ : 0;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.alg = alg_ !== undefined ? alg_ : 0;
		this.gc = gc_ !== undefined ? gc_ : 0;
		this.string = string_ !== undefined ? string_ : (go$ptrType(Go$String)).nil;
		this.uncommonType = uncommonType_ !== undefined ? uncommonType_ : (go$ptrType(uncommonType)).nil;
		this.ptrToThis = ptrToThis_ !== undefined ? ptrToThis_ : (go$ptrType(rtype)).nil;
	});
	go$pkg.rtype = rtype;
	var _method;
	_method = go$newType(0, "Struct", "runtime._method", "_method", "runtime", function(name_, pkgPath_, mtyp_, typ_, ifn_, tfn_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.mtyp = mtyp_ !== undefined ? mtyp_ : (go$ptrType(rtype)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
		this.ifn = ifn_ !== undefined ? ifn_ : 0;
		this.tfn = tfn_ !== undefined ? tfn_ : 0;
	});
	go$pkg._method = _method;
	var uncommonType;
	uncommonType = go$newType(0, "Struct", "runtime.uncommonType", "uncommonType", "runtime", function(name_, pkgPath_, methods_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(_method)).nil;
	});
	go$pkg.uncommonType = uncommonType;
	var _imethod;
	_imethod = go$newType(0, "Struct", "runtime._imethod", "_imethod", "runtime", function(name_, pkgPath_, typ_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
	});
	go$pkg._imethod = _imethod;
	var interfaceType;
	interfaceType = go$newType(0, "Struct", "runtime.interfaceType", "interfaceType", "runtime", function(rtype_, methods_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(_imethod)).nil;
	});
	go$pkg.interfaceType = interfaceType;
	var lock;
	lock = go$newType(0, "Struct", "runtime.lock", "lock", "runtime", function(key_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : new Go$Uint64(0, 0);
	});
	go$pkg.lock = lock;
	var note;
	note = go$newType(0, "Struct", "runtime.note", "note", "runtime", function(key_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : new Go$Uint64(0, 0);
	});
	go$pkg.note = note;
	var _string;
	_string = go$newType(0, "Struct", "runtime._string", "_string", "runtime", function(str_, len_) {
		this.go$val = this;
		this.str = str_ !== undefined ? str_ : (go$ptrType(Go$Uint8)).nil;
		this.len = len_ !== undefined ? len_ : new Go$Int64(0, 0);
	});
	go$pkg._string = _string;
	var funcval;
	funcval = go$newType(0, "Struct", "runtime.funcval", "funcval", "runtime", function(fn_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
	});
	go$pkg.funcval = funcval;
	var iface;
	iface = go$newType(0, "Struct", "runtime.iface", "iface", "runtime", function(tab_, data_) {
		this.go$val = this;
		this.tab = tab_ !== undefined ? tab_ : (go$ptrType(itab)).nil;
		this.data = data_ !== undefined ? data_ : 0;
	});
	go$pkg.iface = iface;
	var eface;
	eface = go$newType(0, "Struct", "runtime.eface", "eface", "runtime", function(_type_, data_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
		this.data = data_ !== undefined ? data_ : 0;
	});
	go$pkg.eface = eface;
	var _complex64;
	_complex64 = go$newType(0, "Struct", "runtime._complex64", "_complex64", "runtime", function(real_, imag_) {
		this.go$val = this;
		this.real = real_ !== undefined ? real_ : 0;
		this.imag = imag_ !== undefined ? imag_ : 0;
	});
	go$pkg._complex64 = _complex64;
	var _complex128;
	_complex128 = go$newType(0, "Struct", "runtime._complex128", "_complex128", "runtime", function(real_, imag_) {
		this.go$val = this;
		this.real = real_ !== undefined ? real_ : 0;
		this.imag = imag_ !== undefined ? imag_ : 0;
	});
	go$pkg._complex128 = _complex128;
	var slice;
	slice = go$newType(0, "Struct", "runtime.slice", "slice", "runtime", function(array_, len_, cap_) {
		this.go$val = this;
		this.array = array_ !== undefined ? array_ : (go$ptrType(Go$Uint8)).nil;
		this.len = len_ !== undefined ? len_ : new Go$Uint64(0, 0);
		this.cap = cap_ !== undefined ? cap_ : new Go$Uint64(0, 0);
	});
	go$pkg.slice = slice;
	var gobuf;
	gobuf = go$newType(0, "Struct", "runtime.gobuf", "gobuf", "runtime", function(sp_, pc_, g_, ret_, ctxt_, lr_) {
		this.go$val = this;
		this.sp = sp_ !== undefined ? sp_ : new Go$Uint64(0, 0);
		this.pc = pc_ !== undefined ? pc_ : new Go$Uint64(0, 0);
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.ret = ret_ !== undefined ? ret_ : new Go$Uint64(0, 0);
		this.ctxt = ctxt_ !== undefined ? ctxt_ : 0;
		this.lr = lr_ !== undefined ? lr_ : new Go$Uint64(0, 0);
	});
	go$pkg.gobuf = gobuf;
	var gcstats;
	gcstats = go$newType(0, "Struct", "runtime.gcstats", "gcstats", "runtime", function(nhandoff_, nhandoffcnt_, nprocyield_, nosyield_, nsleep_) {
		this.go$val = this;
		this.nhandoff = nhandoff_ !== undefined ? nhandoff_ : new Go$Uint64(0, 0);
		this.nhandoffcnt = nhandoffcnt_ !== undefined ? nhandoffcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
	});
	go$pkg.gcstats = gcstats;
	var wincall;
	wincall = go$newType(0, "Struct", "runtime.wincall", "wincall", "runtime", function(fn_, n_, args_, r1_, r2_, err_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
		this.n = n_ !== undefined ? n_ : new Go$Uint64(0, 0);
		this.args = args_ !== undefined ? args_ : 0;
		this.r1 = r1_ !== undefined ? r1_ : new Go$Uint64(0, 0);
		this.r2 = r2_ !== undefined ? r2_ : new Go$Uint64(0, 0);
		this.err = err_ !== undefined ? err_ : new Go$Uint64(0, 0);
	});
	go$pkg.wincall = wincall;
	var seh;
	seh = go$newType(0, "Struct", "runtime.seh", "seh", "runtime", function(prev_, handler_) {
		this.go$val = this;
		this.prev = prev_ !== undefined ? prev_ : 0;
		this.handler = handler_ !== undefined ? handler_ : 0;
	});
	go$pkg.seh = seh;
	var wincallbackcontext;
	wincallbackcontext = go$newType(0, "Struct", "runtime.wincallbackcontext", "wincallbackcontext", "runtime", function(gobody_, argsize_, restorestack_) {
		this.go$val = this;
		this.gobody = gobody_ !== undefined ? gobody_ : 0;
		this.argsize = argsize_ !== undefined ? argsize_ : new Go$Uint64(0, 0);
		this.restorestack = restorestack_ !== undefined ? restorestack_ : new Go$Uint64(0, 0);
	});
	go$pkg.wincallbackcontext = wincallbackcontext;
	var g;
	g = go$newType(0, "Struct", "runtime.g", "g", "runtime", function(stackguard0_, stackbase_, panicwrap_, selgen_, _defer_, _panic_, sched_, syscallstack_, syscallsp_, syscallpc_, syscallguard_, stackguard_, stack0_, stacksize_, alllink_, param_, status_, goid_, waitreason_, schedlink_, ispanic_, issystem_, isbackground_, preempt_, raceignore_, m_, lockedm_, sig_, writenbuf_, writebuf_, dchunk_, dchunknext_, sigcode0_, sigcode1_, sigpc_, gopc_, racectx_, end_) {
		this.go$val = this;
		this.stackguard0 = stackguard0_ !== undefined ? stackguard0_ : new Go$Uint64(0, 0);
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.panicwrap = panicwrap_ !== undefined ? panicwrap_ : 0;
		this.selgen = selgen_ !== undefined ? selgen_ : 0;
		this._defer = _defer_ !== undefined ? _defer_ : (go$ptrType(_defer)).nil;
		this._panic = _panic_ !== undefined ? _panic_ : (go$ptrType(_panic)).nil;
		this.sched = sched_ !== undefined ? sched_ : new gobuf.Ptr();
		this.syscallstack = syscallstack_ !== undefined ? syscallstack_ : new Go$Uint64(0, 0);
		this.syscallsp = syscallsp_ !== undefined ? syscallsp_ : new Go$Uint64(0, 0);
		this.syscallpc = syscallpc_ !== undefined ? syscallpc_ : new Go$Uint64(0, 0);
		this.syscallguard = syscallguard_ !== undefined ? syscallguard_ : new Go$Uint64(0, 0);
		this.stackguard = stackguard_ !== undefined ? stackguard_ : new Go$Uint64(0, 0);
		this.stack0 = stack0_ !== undefined ? stack0_ : new Go$Uint64(0, 0);
		this.stacksize = stacksize_ !== undefined ? stacksize_ : new Go$Uint64(0, 0);
		this.alllink = alllink_ !== undefined ? alllink_ : (go$ptrType(g)).nil;
		this.param = param_ !== undefined ? param_ : 0;
		this.status = status_ !== undefined ? status_ : 0;
		this.goid = goid_ !== undefined ? goid_ : new Go$Int64(0, 0);
		this.waitreason = waitreason_ !== undefined ? waitreason_ : (go$ptrType(Go$Int8)).nil;
		this.schedlink = schedlink_ !== undefined ? schedlink_ : (go$ptrType(g)).nil;
		this.ispanic = ispanic_ !== undefined ? ispanic_ : 0;
		this.issystem = issystem_ !== undefined ? issystem_ : 0;
		this.isbackground = isbackground_ !== undefined ? isbackground_ : 0;
		this.preempt = preempt_ !== undefined ? preempt_ : 0;
		this.raceignore = raceignore_ !== undefined ? raceignore_ : 0;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.lockedm = lockedm_ !== undefined ? lockedm_ : (go$ptrType(m)).nil;
		this.sig = sig_ !== undefined ? sig_ : 0;
		this.writenbuf = writenbuf_ !== undefined ? writenbuf_ : 0;
		this.writebuf = writebuf_ !== undefined ? writebuf_ : (go$ptrType(Go$Uint8)).nil;
		this.dchunk = dchunk_ !== undefined ? dchunk_ : (go$ptrType(deferchunk)).nil;
		this.dchunknext = dchunknext_ !== undefined ? dchunknext_ : (go$ptrType(deferchunk)).nil;
		this.sigcode0 = sigcode0_ !== undefined ? sigcode0_ : new Go$Uint64(0, 0);
		this.sigcode1 = sigcode1_ !== undefined ? sigcode1_ : new Go$Uint64(0, 0);
		this.sigpc = sigpc_ !== undefined ? sigpc_ : new Go$Uint64(0, 0);
		this.gopc = gopc_ !== undefined ? gopc_ : new Go$Uint64(0, 0);
		this.racectx = racectx_ !== undefined ? racectx_ : new Go$Uint64(0, 0);
		this.end = end_ !== undefined ? end_ : go$makeNativeArray("Uint64", 0, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.g = g;
	var m;
	m = go$newType(0, "Struct", "runtime.m", "m", "runtime", function(g0_, moreargp_, morebuf_, moreframesize_, moreargsize_, cret_, procid_, gsignal_, tls_, mstartfn_, curg_, caughtsig_, p_, nextp_, id_, mallocing_, throwing_, gcing_, locks_, dying_, profilehz_, helpgc_, spinning_, fastrand_, ncgocall_, ncgo_, cgomal_, park_, alllink_, schedlink_, machport_, mcache_, stackinuse_, stackcachepos_, stackcachecnt_, stackcache_, lockedg_, createstack_, freglo_, freghi_, fflag_, locked_, nextwaitm_, waitsema_, waitsemacount_, waitsemalock_, gcstats_, racecall_, needextram_, waitunlockf_, waitlock_, settype_buf_, settype_bufsize_, thread_, wincall_, seh_, end_) {
		this.go$val = this;
		this.g0 = g0_ !== undefined ? g0_ : (go$ptrType(g)).nil;
		this.moreargp = moreargp_ !== undefined ? moreargp_ : 0;
		this.morebuf = morebuf_ !== undefined ? morebuf_ : new gobuf.Ptr();
		this.moreframesize = moreframesize_ !== undefined ? moreframesize_ : 0;
		this.moreargsize = moreargsize_ !== undefined ? moreargsize_ : 0;
		this.cret = cret_ !== undefined ? cret_ : new Go$Uint64(0, 0);
		this.procid = procid_ !== undefined ? procid_ : new Go$Uint64(0, 0);
		this.gsignal = gsignal_ !== undefined ? gsignal_ : (go$ptrType(g)).nil;
		this.tls = tls_ !== undefined ? tls_ : go$makeNativeArray("Uint64", 4, function() { return new Go$Uint64(0, 0); });
		this.mstartfn = mstartfn_ !== undefined ? mstartfn_ : go$throwNilPointerError;
		this.curg = curg_ !== undefined ? curg_ : (go$ptrType(g)).nil;
		this.caughtsig = caughtsig_ !== undefined ? caughtsig_ : (go$ptrType(g)).nil;
		this.p = p_ !== undefined ? p_ : (go$ptrType(p)).nil;
		this.nextp = nextp_ !== undefined ? nextp_ : (go$ptrType(p)).nil;
		this.id = id_ !== undefined ? id_ : 0;
		this.mallocing = mallocing_ !== undefined ? mallocing_ : 0;
		this.throwing = throwing_ !== undefined ? throwing_ : 0;
		this.gcing = gcing_ !== undefined ? gcing_ : 0;
		this.locks = locks_ !== undefined ? locks_ : 0;
		this.dying = dying_ !== undefined ? dying_ : 0;
		this.profilehz = profilehz_ !== undefined ? profilehz_ : 0;
		this.helpgc = helpgc_ !== undefined ? helpgc_ : 0;
		this.spinning = spinning_ !== undefined ? spinning_ : 0;
		this.fastrand = fastrand_ !== undefined ? fastrand_ : 0;
		this.ncgocall = ncgocall_ !== undefined ? ncgocall_ : new Go$Uint64(0, 0);
		this.ncgo = ncgo_ !== undefined ? ncgo_ : 0;
		this.cgomal = cgomal_ !== undefined ? cgomal_ : (go$ptrType(cgomal)).nil;
		this.park = park_ !== undefined ? park_ : new note.Ptr();
		this.alllink = alllink_ !== undefined ? alllink_ : (go$ptrType(m)).nil;
		this.schedlink = schedlink_ !== undefined ? schedlink_ : (go$ptrType(m)).nil;
		this.machport = machport_ !== undefined ? machport_ : 0;
		this.mcache = mcache_ !== undefined ? mcache_ : (go$ptrType(mcache)).nil;
		this.stackinuse = stackinuse_ !== undefined ? stackinuse_ : 0;
		this.stackcachepos = stackcachepos_ !== undefined ? stackcachepos_ : 0;
		this.stackcachecnt = stackcachecnt_ !== undefined ? stackcachecnt_ : 0;
		this.stackcache = stackcache_ !== undefined ? stackcache_ : go$makeNativeArray("UnsafePointer", 32, function() { return 0; });
		this.lockedg = lockedg_ !== undefined ? lockedg_ : (go$ptrType(g)).nil;
		this.createstack = createstack_ !== undefined ? createstack_ : go$makeNativeArray("Uint64", 32, function() { return new Go$Uint64(0, 0); });
		this.freglo = freglo_ !== undefined ? freglo_ : go$makeNativeArray("Uint32", 16, function() { return 0; });
		this.freghi = freghi_ !== undefined ? freghi_ : go$makeNativeArray("Uint32", 16, function() { return 0; });
		this.fflag = fflag_ !== undefined ? fflag_ : 0;
		this.locked = locked_ !== undefined ? locked_ : 0;
		this.nextwaitm = nextwaitm_ !== undefined ? nextwaitm_ : (go$ptrType(m)).nil;
		this.waitsema = waitsema_ !== undefined ? waitsema_ : new Go$Uint64(0, 0);
		this.waitsemacount = waitsemacount_ !== undefined ? waitsemacount_ : 0;
		this.waitsemalock = waitsemalock_ !== undefined ? waitsemalock_ : 0;
		this.gcstats = gcstats_ !== undefined ? gcstats_ : new gcstats.Ptr();
		this.racecall = racecall_ !== undefined ? racecall_ : 0;
		this.needextram = needextram_ !== undefined ? needextram_ : 0;
		this.waitunlockf = waitunlockf_ !== undefined ? waitunlockf_ : go$throwNilPointerError;
		this.waitlock = waitlock_ !== undefined ? waitlock_ : 0;
		this.settype_buf = settype_buf_ !== undefined ? settype_buf_ : go$makeNativeArray("Uint64", 1024, function() { return new Go$Uint64(0, 0); });
		this.settype_bufsize = settype_bufsize_ !== undefined ? settype_bufsize_ : new Go$Uint64(0, 0);
		this.thread = thread_ !== undefined ? thread_ : 0;
		this.wincall = wincall_ !== undefined ? wincall_ : new wincall.Ptr();
		this.seh = seh_ !== undefined ? seh_ : (go$ptrType(seh)).nil;
		this.end = end_ !== undefined ? end_ : go$makeNativeArray("Uint64", 0, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.m = m;
	var p;
	p = go$newType(0, "Struct", "runtime.p", "p", "runtime", function(lock_, id_, status_, link_, schedtick_, syscalltick_, m_, mcache_, runq_, runqhead_, runqtail_, runqsize_, gfree_, gfreecnt_, pad_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.id = id_ !== undefined ? id_ : 0;
		this.status = status_ !== undefined ? status_ : 0;
		this.link = link_ !== undefined ? link_ : (go$ptrType(p)).nil;
		this.schedtick = schedtick_ !== undefined ? schedtick_ : 0;
		this.syscalltick = syscalltick_ !== undefined ? syscalltick_ : 0;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.mcache = mcache_ !== undefined ? mcache_ : (go$ptrType(mcache)).nil;
		this.runq = runq_ !== undefined ? runq_ : (go$ptrType((go$ptrType(g)))).nil;
		this.runqhead = runqhead_ !== undefined ? runqhead_ : 0;
		this.runqtail = runqtail_ !== undefined ? runqtail_ : 0;
		this.runqsize = runqsize_ !== undefined ? runqsize_ : 0;
		this.gfree = gfree_ !== undefined ? gfree_ : (go$ptrType(g)).nil;
		this.gfreecnt = gfreecnt_ !== undefined ? gfreecnt_ : 0;
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg.p = p;
	var stktop;
	stktop = go$newType(0, "Struct", "runtime.stktop", "stktop", "runtime", function(stackguard_, stackbase_, gobuf_, argsize_, panicwrap_, argp_, free_, _panic_) {
		this.go$val = this;
		this.stackguard = stackguard_ !== undefined ? stackguard_ : new Go$Uint64(0, 0);
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.gobuf = gobuf_ !== undefined ? gobuf_ : new gobuf.Ptr();
		this.argsize = argsize_ !== undefined ? argsize_ : 0;
		this.panicwrap = panicwrap_ !== undefined ? panicwrap_ : 0;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.free = free_ !== undefined ? free_ : new Go$Uint64(0, 0);
		this._panic = _panic_ !== undefined ? _panic_ : 0;
	});
	go$pkg.stktop = stktop;
	var sigtab;
	sigtab = go$newType(0, "Struct", "runtime.sigtab", "sigtab", "runtime", function(flags_, name_) {
		this.go$val = this;
		this.flags = flags_ !== undefined ? flags_ : 0;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$Int8)).nil;
	});
	go$pkg.sigtab = sigtab;
	var _func;
	_func = go$newType(0, "Struct", "runtime._func", "_func", "runtime", function(entry_, nameoff_, args_, frame_, pcsp_, pcfile_, pcln_, npcdata_, nfuncdata_) {
		this.go$val = this;
		this.entry = entry_ !== undefined ? entry_ : new Go$Uint64(0, 0);
		this.nameoff = nameoff_ !== undefined ? nameoff_ : 0;
		this.args = args_ !== undefined ? args_ : 0;
		this.frame = frame_ !== undefined ? frame_ : 0;
		this.pcsp = pcsp_ !== undefined ? pcsp_ : 0;
		this.pcfile = pcfile_ !== undefined ? pcfile_ : 0;
		this.pcln = pcln_ !== undefined ? pcln_ : 0;
		this.npcdata = npcdata_ !== undefined ? npcdata_ : 0;
		this.nfuncdata = nfuncdata_ !== undefined ? nfuncdata_ : 0;
	});
	go$pkg._func = _func;
	var itab;
	itab = go$newType(0, "Struct", "runtime.itab", "itab", "runtime", function(inter_, _type_, link_, bad_, unused_, fun_) {
		this.go$val = this;
		this.inter = inter_ !== undefined ? inter_ : (go$ptrType(interfacetype)).nil;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
		this.link = link_ !== undefined ? link_ : (go$ptrType(itab)).nil;
		this.bad = bad_ !== undefined ? bad_ : 0;
		this.unused = unused_ !== undefined ? unused_ : 0;
		this.fun = fun_ !== undefined ? fun_ : go$makeNativeArray("Func", 0, function() { return go$throwNilPointerError; });
	});
	go$pkg.itab = itab;
	var timers;
	timers = go$newType(0, "Struct", "runtime.timers", "timers", "runtime", function(lock_, timerproc_, sleeping_, rescheduling_, waitnote_, t_, len_, cap_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.timerproc = timerproc_ !== undefined ? timerproc_ : (go$ptrType(g)).nil;
		this.sleeping = sleeping_ !== undefined ? sleeping_ : 0;
		this.rescheduling = rescheduling_ !== undefined ? rescheduling_ : 0;
		this.waitnote = waitnote_ !== undefined ? waitnote_ : new note.Ptr();
		this.t = t_ !== undefined ? t_ : (go$ptrType((go$ptrType(timer)))).nil;
		this.len = len_ !== undefined ? len_ : 0;
		this.cap = cap_ !== undefined ? cap_ : 0;
	});
	go$pkg.timers = timers;
	var timer;
	timer = go$newType(0, "Struct", "runtime.timer", "timer", "runtime", function(i_, when_, period_, fv_, arg_) {
		this.go$val = this;
		this.i = i_ !== undefined ? i_ : 0;
		this.when = when_ !== undefined ? when_ : new Go$Int64(0, 0);
		this.period = period_ !== undefined ? period_ : new Go$Int64(0, 0);
		this.fv = fv_ !== undefined ? fv_ : (go$ptrType(funcval)).nil;
		this.arg = arg_ !== undefined ? arg_ : new eface.Ptr();
	});
	go$pkg.timer = timer;
	var lfnode;
	lfnode = go$newType(0, "Struct", "runtime.lfnode", "lfnode", "runtime", function(next_, pushcnt_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(lfnode)).nil;
		this.pushcnt = pushcnt_ !== undefined ? pushcnt_ : new Go$Uint64(0, 0);
	});
	go$pkg.lfnode = lfnode;
	var parfor;
	parfor = go$newType(0, "Struct", "runtime.parfor", "parfor", "runtime", function(body_, done_, nthr_, nthrmax_, thrseq_, cnt_, ctx_, wait_, thr_, pad_, nsteal_, nstealcnt_, nprocyield_, nosyield_, nsleep_) {
		this.go$val = this;
		this.body = body_ !== undefined ? body_ : go$throwNilPointerError;
		this.done = done_ !== undefined ? done_ : 0;
		this.nthr = nthr_ !== undefined ? nthr_ : 0;
		this.nthrmax = nthrmax_ !== undefined ? nthrmax_ : 0;
		this.thrseq = thrseq_ !== undefined ? thrseq_ : 0;
		this.cnt = cnt_ !== undefined ? cnt_ : 0;
		this.ctx = ctx_ !== undefined ? ctx_ : 0;
		this.wait = wait_ !== undefined ? wait_ : 0;
		this.thr = thr_ !== undefined ? thr_ : (go$ptrType(parforthread)).nil;
		this.pad = pad_ !== undefined ? pad_ : 0;
		this.nsteal = nsteal_ !== undefined ? nsteal_ : new Go$Uint64(0, 0);
		this.nstealcnt = nstealcnt_ !== undefined ? nstealcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
	});
	go$pkg.parfor = parfor;
	var cgomal;
	cgomal = go$newType(0, "Struct", "runtime.cgomal", "cgomal", "runtime", function(next_, alloc_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(cgomal)).nil;
		this.alloc = alloc_ !== undefined ? alloc_ : 0;
	});
	go$pkg.cgomal = cgomal;
	var debugvars;
	debugvars = go$newType(0, "Struct", "runtime.debugvars", "debugvars", "runtime", function(gctrace_, schedtrace_, scheddetail_) {
		this.go$val = this;
		this.gctrace = gctrace_ !== undefined ? gctrace_ : 0;
		this.schedtrace = schedtrace_ !== undefined ? schedtrace_ : 0;
		this.scheddetail = scheddetail_ !== undefined ? scheddetail_ : 0;
	});
	go$pkg.debugvars = debugvars;
	var alg;
	alg = go$newType(0, "Struct", "runtime.alg", "alg", "runtime", function(hash_, equal_, print_, copy_) {
		this.go$val = this;
		this.hash = hash_ !== undefined ? hash_ : go$throwNilPointerError;
		this.equal = equal_ !== undefined ? equal_ : go$throwNilPointerError;
		this.print = print_ !== undefined ? print_ : go$throwNilPointerError;
		this.copy = copy_ !== undefined ? copy_ : go$throwNilPointerError;
	});
	go$pkg.alg = alg;
	var _defer;
	_defer = go$newType(0, "Struct", "runtime._defer", "_defer", "runtime", function(siz_, special_, free_, argp_, pc_, fn_, link_, args_) {
		this.go$val = this;
		this.siz = siz_ !== undefined ? siz_ : 0;
		this.special = special_ !== undefined ? special_ : 0;
		this.free = free_ !== undefined ? free_ : 0;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.pc = pc_ !== undefined ? pc_ : (go$ptrType(Go$Uint8)).nil;
		this.fn = fn_ !== undefined ? fn_ : (go$ptrType(funcval)).nil;
		this.link = link_ !== undefined ? link_ : (go$ptrType(_defer)).nil;
		this.args = args_ !== undefined ? args_ : go$makeNativeArray("UnsafePointer", 1, function() { return 0; });
	});
	go$pkg._defer = _defer;
	var deferchunk;
	deferchunk = go$newType(0, "Struct", "runtime.deferchunk", "deferchunk", "runtime", function(prev_, off_) {
		this.go$val = this;
		this.prev = prev_ !== undefined ? prev_ : (go$ptrType(deferchunk)).nil;
		this.off = off_ !== undefined ? off_ : new Go$Uint64(0, 0);
	});
	go$pkg.deferchunk = deferchunk;
	var _panic;
	_panic = go$newType(0, "Struct", "runtime._panic", "_panic", "runtime", function(arg_, stackbase_, link_, recovered_) {
		this.go$val = this;
		this.arg = arg_ !== undefined ? arg_ : new eface.Ptr();
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.link = link_ !== undefined ? link_ : (go$ptrType(_panic)).nil;
		this.recovered = recovered_ !== undefined ? recovered_ : 0;
	});
	go$pkg._panic = _panic;
	var stkframe;
	stkframe = go$newType(0, "Struct", "runtime.stkframe", "stkframe", "runtime", function(fn_, pc_, lr_, sp_, fp_, varp_, argp_, arglen_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : (go$ptrType(_func)).nil;
		this.pc = pc_ !== undefined ? pc_ : new Go$Uint64(0, 0);
		this.lr = lr_ !== undefined ? lr_ : new Go$Uint64(0, 0);
		this.sp = sp_ !== undefined ? sp_ : new Go$Uint64(0, 0);
		this.fp = fp_ !== undefined ? fp_ : new Go$Uint64(0, 0);
		this.varp = varp_ !== undefined ? varp_ : (go$ptrType(Go$Uint8)).nil;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.arglen = arglen_ !== undefined ? arglen_ : new Go$Uint64(0, 0);
	});
	go$pkg.stkframe = stkframe;
	var mlink;
	mlink = go$newType(0, "Struct", "runtime.mlink", "mlink", "runtime", function(next_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(mlink)).nil;
	});
	go$pkg.mlink = mlink;
	var fixalloc;
	fixalloc = go$newType(0, "Struct", "runtime.fixalloc", "fixalloc", "runtime", function(size_, first_, arg_, list_, chunk_, nchunk_, inuse_, stat_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : new Go$Uint64(0, 0);
		this.first = first_ !== undefined ? first_ : go$throwNilPointerError;
		this.arg = arg_ !== undefined ? arg_ : 0;
		this.list = list_ !== undefined ? list_ : (go$ptrType(mlink)).nil;
		this.chunk = chunk_ !== undefined ? chunk_ : (go$ptrType(Go$Uint8)).nil;
		this.nchunk = nchunk_ !== undefined ? nchunk_ : 0;
		this.inuse = inuse_ !== undefined ? inuse_ : new Go$Uint64(0, 0);
		this.stat = stat_ !== undefined ? stat_ : (go$ptrType(Go$Uint64)).nil;
	});
	go$pkg.fixalloc = fixalloc;
	var _1_;
	_1_ = go$newType(0, "Struct", "runtime._1_", "_1_", "runtime", function(size_, nmalloc_, nfree_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : 0;
		this.nmalloc = nmalloc_ !== undefined ? nmalloc_ : new Go$Uint64(0, 0);
		this.nfree = nfree_ !== undefined ? nfree_ : new Go$Uint64(0, 0);
	});
	go$pkg._1_ = _1_;
	var mstats;
	mstats = go$newType(0, "Struct", "runtime.mstats", "mstats", "runtime", function(alloc_, total_alloc_, sys_, nlookup_, nmalloc_, nfree_, heap_alloc_, heap_sys_, heap_idle_, heap_inuse_, heap_released_, heap_objects_, stacks_inuse_, stacks_sys_, mspan_inuse_, mspan_sys_, mcache_inuse_, mcache_sys_, buckhash_sys_, gc_sys_, other_sys_, next_gc_, last_gc_, pause_total_ns_, pause_ns_, numgc_, enablegc_, debuggc_, by_size_) {
		this.go$val = this;
		this.alloc = alloc_ !== undefined ? alloc_ : new Go$Uint64(0, 0);
		this.total_alloc = total_alloc_ !== undefined ? total_alloc_ : new Go$Uint64(0, 0);
		this.sys = sys_ !== undefined ? sys_ : new Go$Uint64(0, 0);
		this.nlookup = nlookup_ !== undefined ? nlookup_ : new Go$Uint64(0, 0);
		this.nmalloc = nmalloc_ !== undefined ? nmalloc_ : new Go$Uint64(0, 0);
		this.nfree = nfree_ !== undefined ? nfree_ : new Go$Uint64(0, 0);
		this.heap_alloc = heap_alloc_ !== undefined ? heap_alloc_ : new Go$Uint64(0, 0);
		this.heap_sys = heap_sys_ !== undefined ? heap_sys_ : new Go$Uint64(0, 0);
		this.heap_idle = heap_idle_ !== undefined ? heap_idle_ : new Go$Uint64(0, 0);
		this.heap_inuse = heap_inuse_ !== undefined ? heap_inuse_ : new Go$Uint64(0, 0);
		this.heap_released = heap_released_ !== undefined ? heap_released_ : new Go$Uint64(0, 0);
		this.heap_objects = heap_objects_ !== undefined ? heap_objects_ : new Go$Uint64(0, 0);
		this.stacks_inuse = stacks_inuse_ !== undefined ? stacks_inuse_ : new Go$Uint64(0, 0);
		this.stacks_sys = stacks_sys_ !== undefined ? stacks_sys_ : new Go$Uint64(0, 0);
		this.mspan_inuse = mspan_inuse_ !== undefined ? mspan_inuse_ : new Go$Uint64(0, 0);
		this.mspan_sys = mspan_sys_ !== undefined ? mspan_sys_ : new Go$Uint64(0, 0);
		this.mcache_inuse = mcache_inuse_ !== undefined ? mcache_inuse_ : new Go$Uint64(0, 0);
		this.mcache_sys = mcache_sys_ !== undefined ? mcache_sys_ : new Go$Uint64(0, 0);
		this.buckhash_sys = buckhash_sys_ !== undefined ? buckhash_sys_ : new Go$Uint64(0, 0);
		this.gc_sys = gc_sys_ !== undefined ? gc_sys_ : new Go$Uint64(0, 0);
		this.other_sys = other_sys_ !== undefined ? other_sys_ : new Go$Uint64(0, 0);
		this.next_gc = next_gc_ !== undefined ? next_gc_ : new Go$Uint64(0, 0);
		this.last_gc = last_gc_ !== undefined ? last_gc_ : new Go$Uint64(0, 0);
		this.pause_total_ns = pause_total_ns_ !== undefined ? pause_total_ns_ : new Go$Uint64(0, 0);
		this.pause_ns = pause_ns_ !== undefined ? pause_ns_ : go$makeNativeArray("Uint64", 256, function() { return new Go$Uint64(0, 0); });
		this.numgc = numgc_ !== undefined ? numgc_ : 0;
		this.enablegc = enablegc_ !== undefined ? enablegc_ : 0;
		this.debuggc = debuggc_ !== undefined ? debuggc_ : 0;
		this.by_size = by_size_ !== undefined ? by_size_ : go$makeNativeArray("Struct", 61, function() { return new _1_.Ptr(); });
	});
	go$pkg.mstats = mstats;
	var mcachelist;
	mcachelist = go$newType(0, "Struct", "runtime.mcachelist", "mcachelist", "runtime", function(list_, nlist_) {
		this.go$val = this;
		this.list = list_ !== undefined ? list_ : (go$ptrType(mlink)).nil;
		this.nlist = nlist_ !== undefined ? nlist_ : 0;
	});
	go$pkg.mcachelist = mcachelist;
	var mcache;
	mcache = go$newType(0, "Struct", "runtime.mcache", "mcache", "runtime", function(next_sample_, local_cachealloc_, list_, local_nlookup_, local_largefree_, local_nlargefree_, local_nsmallfree_) {
		this.go$val = this;
		this.next_sample = next_sample_ !== undefined ? next_sample_ : 0;
		this.local_cachealloc = local_cachealloc_ !== undefined ? local_cachealloc_ : new Go$Int64(0, 0);
		this.list = list_ !== undefined ? list_ : go$makeNativeArray("Struct", 61, function() { return new mcachelist.Ptr(); });
		this.local_nlookup = local_nlookup_ !== undefined ? local_nlookup_ : new Go$Uint64(0, 0);
		this.local_largefree = local_largefree_ !== undefined ? local_largefree_ : new Go$Uint64(0, 0);
		this.local_nlargefree = local_nlargefree_ !== undefined ? local_nlargefree_ : new Go$Uint64(0, 0);
		this.local_nsmallfree = local_nsmallfree_ !== undefined ? local_nsmallfree_ : go$makeNativeArray("Uint64", 61, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.mcache = mcache;
	var mtypes;
	mtypes = go$newType(0, "Struct", "runtime.mtypes", "mtypes", "runtime", function(compression_, data_) {
		this.go$val = this;
		this.compression = compression_ !== undefined ? compression_ : 0;
		this.data = data_ !== undefined ? data_ : new Go$Uint64(0, 0);
	});
	go$pkg.mtypes = mtypes;
	var mspan;
	mspan = go$newType(0, "Struct", "runtime.mspan", "mspan", "runtime", function(next_, prev_, start_, npages_, freelist_, ref_, sizeclass_, elemsize_, state_, unusedsince_, npreleased_, limit_, types_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(mspan)).nil;
		this.prev = prev_ !== undefined ? prev_ : (go$ptrType(mspan)).nil;
		this.start = start_ !== undefined ? start_ : new Go$Uint64(0, 0);
		this.npages = npages_ !== undefined ? npages_ : new Go$Uint64(0, 0);
		this.freelist = freelist_ !== undefined ? freelist_ : (go$ptrType(mlink)).nil;
		this.ref = ref_ !== undefined ? ref_ : 0;
		this.sizeclass = sizeclass_ !== undefined ? sizeclass_ : 0;
		this.elemsize = elemsize_ !== undefined ? elemsize_ : new Go$Uint64(0, 0);
		this.state = state_ !== undefined ? state_ : 0;
		this.unusedsince = unusedsince_ !== undefined ? unusedsince_ : new Go$Int64(0, 0);
		this.npreleased = npreleased_ !== undefined ? npreleased_ : new Go$Uint64(0, 0);
		this.limit = limit_ !== undefined ? limit_ : (go$ptrType(Go$Uint8)).nil;
		this.types = types_ !== undefined ? types_ : new mtypes.Ptr();
	});
	go$pkg.mspan = mspan;
	var mcentral;
	mcentral = go$newType(0, "Struct", "runtime.mcentral", "mcentral", "runtime", function(lock_, sizeclass_, nonempty_, empty_, nfree_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.sizeclass = sizeclass_ !== undefined ? sizeclass_ : 0;
		this.nonempty = nonempty_ !== undefined ? nonempty_ : new mspan.Ptr();
		this.empty = empty_ !== undefined ? empty_ : new mspan.Ptr();
		this.nfree = nfree_ !== undefined ? nfree_ : 0;
	});
	go$pkg.mcentral = mcentral;
	var _2_;
	_2_ = go$newType(0, "Struct", "runtime._2_", "_2_", "runtime", function(mcentral_, pad_) {
		this.go$val = this;
		this.mcentral = mcentral_ !== undefined ? mcentral_ : new mcentral.Ptr();
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg._2_ = _2_;
	var mheap;
	mheap = go$newType(0, "Struct", "runtime.mheap", "mheap", "runtime", function(lock_, free_, large_, allspans_, nspan_, nspancap_, spans_, spans_mapped_, bitmap_, bitmap_mapped_, arena_start_, arena_used_, arena_end_, central_, spanalloc_, cachealloc_, largefree_, nlargefree_, nsmallfree_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.free = free_ !== undefined ? free_ : go$makeNativeArray("Struct", 256, function() { return new mspan.Ptr(); });
		this.large = large_ !== undefined ? large_ : new mspan.Ptr();
		this.allspans = allspans_ !== undefined ? allspans_ : (go$ptrType((go$ptrType(mspan)))).nil;
		this.nspan = nspan_ !== undefined ? nspan_ : 0;
		this.nspancap = nspancap_ !== undefined ? nspancap_ : 0;
		this.spans = spans_ !== undefined ? spans_ : (go$ptrType((go$ptrType(mspan)))).nil;
		this.spans_mapped = spans_mapped_ !== undefined ? spans_mapped_ : new Go$Uint64(0, 0);
		this.bitmap = bitmap_ !== undefined ? bitmap_ : (go$ptrType(Go$Uint8)).nil;
		this.bitmap_mapped = bitmap_mapped_ !== undefined ? bitmap_mapped_ : new Go$Uint64(0, 0);
		this.arena_start = arena_start_ !== undefined ? arena_start_ : (go$ptrType(Go$Uint8)).nil;
		this.arena_used = arena_used_ !== undefined ? arena_used_ : (go$ptrType(Go$Uint8)).nil;
		this.arena_end = arena_end_ !== undefined ? arena_end_ : (go$ptrType(Go$Uint8)).nil;
		this.central = central_ !== undefined ? central_ : go$makeNativeArray("Struct", 61, function() { return new _2_.Ptr(); });
		this.spanalloc = spanalloc_ !== undefined ? spanalloc_ : new fixalloc.Ptr();
		this.cachealloc = cachealloc_ !== undefined ? cachealloc_ : new fixalloc.Ptr();
		this.largefree = largefree_ !== undefined ? largefree_ : new Go$Uint64(0, 0);
		this.nlargefree = nlargefree_ !== undefined ? nlargefree_ : new Go$Uint64(0, 0);
		this.nsmallfree = nsmallfree_ !== undefined ? nsmallfree_ : go$makeNativeArray("Uint64", 61, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.mheap = mheap;
	var _type;
	_type = go$newType(0, "Struct", "runtime._type", "_type", "runtime", function(size_, hash_, _unused_, align_, fieldalign_, kind_, alg_, gc_, _string_, x_, ptrto_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : new Go$Uint64(0, 0);
		this.hash = hash_ !== undefined ? hash_ : 0;
		this._unused = _unused_ !== undefined ? _unused_ : 0;
		this.align = align_ !== undefined ? align_ : 0;
		this.fieldalign = fieldalign_ !== undefined ? fieldalign_ : 0;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.alg = alg_ !== undefined ? alg_ : (go$ptrType(alg)).nil;
		this.gc = gc_ !== undefined ? gc_ : 0;
		this._string = _string_ !== undefined ? _string_ : (go$ptrType(Go$String)).nil;
		this.x = x_ !== undefined ? x_ : (go$ptrType(uncommontype)).nil;
		this.ptrto = ptrto_ !== undefined ? ptrto_ : (go$ptrType(_type)).nil;
	});
	go$pkg._type = _type;
	var method;
	method = go$newType(0, "Struct", "runtime.method", "method", "runtime", function(name_, pkgpath_, mtyp_, typ_, ifn_, tfn_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this.mtyp = mtyp_ !== undefined ? mtyp_ : (go$ptrType(_type)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(_type)).nil;
		this.ifn = ifn_ !== undefined ? ifn_ : go$throwNilPointerError;
		this.tfn = tfn_ !== undefined ? tfn_ : go$throwNilPointerError;
	});
	go$pkg.method = method;
	var uncommontype;
	uncommontype = go$newType(0, "Struct", "runtime.uncommontype", "uncommontype", "runtime", function(name_, pkgpath_, mhdr_, m_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this.mhdr = mhdr_ !== undefined ? mhdr_ : (go$sliceType(Go$Uint8)).nil;
		this.m = m_ !== undefined ? m_ : go$makeNativeArray("Struct", 0, function() { return new method.Ptr(); });
	});
	go$pkg.uncommontype = uncommontype;
	var imethod;
	imethod = go$newType(0, "Struct", "runtime.imethod", "imethod", "runtime", function(name_, pkgpath_, _type_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
	});
	go$pkg.imethod = imethod;
	var interfacetype;
	interfacetype = go$newType(0, "Struct", "runtime.interfacetype", "interfacetype", "runtime", function(_type_, mhdr_, m_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.mhdr = mhdr_ !== undefined ? mhdr_ : (go$sliceType(Go$Uint8)).nil;
		this.m = m_ !== undefined ? m_ : go$makeNativeArray("Struct", 0, function() { return new imethod.Ptr(); });
	});
	go$pkg.interfacetype = interfacetype;
	var maptype;
	maptype = go$newType(0, "Struct", "runtime.maptype", "maptype", "runtime", function(_type_, key_, elem_, bucket_, hmap_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.key = key_ !== undefined ? key_ : (go$ptrType(_type)).nil;
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
		this.bucket = bucket_ !== undefined ? bucket_ : (go$ptrType(_type)).nil;
		this.hmap = hmap_ !== undefined ? hmap_ : (go$ptrType(_type)).nil;
	});
	go$pkg.maptype = maptype;
	var chantype;
	chantype = go$newType(0, "Struct", "runtime.chantype", "chantype", "runtime", function(_type_, elem_, dir_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
		this.dir = dir_ !== undefined ? dir_ : new Go$Uint64(0, 0);
	});
	go$pkg.chantype = chantype;
	var slicetype;
	slicetype = go$newType(0, "Struct", "runtime.slicetype", "slicetype", "runtime", function(_type_, elem_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
	});
	go$pkg.slicetype = slicetype;
	var functype;
	functype = go$newType(0, "Struct", "runtime.functype", "functype", "runtime", function(_type_, dotdotdot_, in$2_, out_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.dotdotdot = dotdotdot_ !== undefined ? dotdotdot_ : 0;
		this.in$2 = in$2_ !== undefined ? in$2_ : (go$sliceType(Go$Uint8)).nil;
		this.out = out_ !== undefined ? out_ : (go$sliceType(Go$Uint8)).nil;
	});
	go$pkg.functype = functype;
	var ptrtype;
	ptrtype = go$newType(0, "Struct", "runtime.ptrtype", "ptrtype", "runtime", function(_type_, elem_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
	});
	go$pkg.ptrtype = ptrtype;
	var sched;
	sched = go$newType(0, "Struct", "runtime.sched", "sched", "runtime", function(lock_, goidgen_, midle_, nmidle_, nmidlelocked_, mcount_, maxmcount_, pidle_, npidle_, nmspinning_, runqhead_, runqtail_, runqsize_, gflock_, gfree_, gcwaiting_, stopwait_, stopnote_, sysmonwait_, sysmonnote_, lastpoll_, profilehz_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.goidgen = goidgen_ !== undefined ? goidgen_ : new Go$Uint64(0, 0);
		this.midle = midle_ !== undefined ? midle_ : (go$ptrType(m)).nil;
		this.nmidle = nmidle_ !== undefined ? nmidle_ : 0;
		this.nmidlelocked = nmidlelocked_ !== undefined ? nmidlelocked_ : 0;
		this.mcount = mcount_ !== undefined ? mcount_ : 0;
		this.maxmcount = maxmcount_ !== undefined ? maxmcount_ : 0;
		this.pidle = pidle_ !== undefined ? pidle_ : (go$ptrType(p)).nil;
		this.npidle = npidle_ !== undefined ? npidle_ : 0;
		this.nmspinning = nmspinning_ !== undefined ? nmspinning_ : 0;
		this.runqhead = runqhead_ !== undefined ? runqhead_ : (go$ptrType(g)).nil;
		this.runqtail = runqtail_ !== undefined ? runqtail_ : (go$ptrType(g)).nil;
		this.runqsize = runqsize_ !== undefined ? runqsize_ : 0;
		this.gflock = gflock_ !== undefined ? gflock_ : new lock.Ptr();
		this.gfree = gfree_ !== undefined ? gfree_ : (go$ptrType(g)).nil;
		this.gcwaiting = gcwaiting_ !== undefined ? gcwaiting_ : 0;
		this.stopwait = stopwait_ !== undefined ? stopwait_ : 0;
		this.stopnote = stopnote_ !== undefined ? stopnote_ : new note.Ptr();
		this.sysmonwait = sysmonwait_ !== undefined ? sysmonwait_ : 0;
		this.sysmonnote = sysmonnote_ !== undefined ? sysmonnote_ : new note.Ptr();
		this.lastpoll = lastpoll_ !== undefined ? lastpoll_ : new Go$Uint64(0, 0);
		this.profilehz = profilehz_ !== undefined ? profilehz_ : 0;
	});
	go$pkg.sched = sched;
	var cgothreadstart;
	cgothreadstart = go$newType(0, "Struct", "runtime.cgothreadstart", "cgothreadstart", "runtime", function(m_, g_, fn_) {
		this.go$val = this;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
	});
	go$pkg.cgothreadstart = cgothreadstart;
	var _3_;
	_3_ = go$newType(0, "Struct", "runtime._3_", "_3_", "runtime", function(lock_, fn_, hz_, pcbuf_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
		this.hz = hz_ !== undefined ? hz_ : 0;
		this.pcbuf = pcbuf_ !== undefined ? pcbuf_ : go$makeNativeArray("Uint64", 100, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg._3_ = _3_;
	var pdesc;
	pdesc = go$newType(0, "Struct", "runtime.pdesc", "pdesc", "runtime", function(schedtick_, schedwhen_, syscalltick_, syscallwhen_) {
		this.go$val = this;
		this.schedtick = schedtick_ !== undefined ? schedtick_ : 0;
		this.schedwhen = schedwhen_ !== undefined ? schedwhen_ : new Go$Int64(0, 0);
		this.syscalltick = syscalltick_ !== undefined ? syscalltick_ : 0;
		this.syscallwhen = syscallwhen_ !== undefined ? syscallwhen_ : new Go$Int64(0, 0);
	});
	go$pkg.pdesc = pdesc;
	var bucket;
	bucket = go$newType(0, "Struct", "runtime.bucket", "bucket", "runtime", function(tophash_, overflow_, data_) {
		this.go$val = this;
		this.tophash = tophash_ !== undefined ? tophash_ : go$makeNativeArray("Uint8", 8, function() { return 0; });
		this.overflow = overflow_ !== undefined ? overflow_ : (go$ptrType(bucket)).nil;
		this.data = data_ !== undefined ? data_ : go$makeNativeArray("Uint8", 1, function() { return 0; });
	});
	go$pkg.bucket = bucket;
	var hmap;
	hmap = go$newType(0, "Struct", "runtime.hmap", "hmap", "runtime", function(count_, flags_, hash0_, b_, keysize_, valuesize_, bucketsize_, buckets_, oldbuckets_, nevacuate_) {
		this.go$val = this;
		this.count = count_ !== undefined ? count_ : new Go$Uint64(0, 0);
		this.flags = flags_ !== undefined ? flags_ : 0;
		this.hash0 = hash0_ !== undefined ? hash0_ : 0;
		this.b = b_ !== undefined ? b_ : 0;
		this.keysize = keysize_ !== undefined ? keysize_ : 0;
		this.valuesize = valuesize_ !== undefined ? valuesize_ : 0;
		this.bucketsize = bucketsize_ !== undefined ? bucketsize_ : 0;
		this.buckets = buckets_ !== undefined ? buckets_ : (go$ptrType(Go$Uint8)).nil;
		this.oldbuckets = oldbuckets_ !== undefined ? oldbuckets_ : (go$ptrType(Go$Uint8)).nil;
		this.nevacuate = nevacuate_ !== undefined ? nevacuate_ : new Go$Uint64(0, 0);
	});
	go$pkg.hmap = hmap;
	var hash_iter;
	hash_iter = go$newType(0, "Struct", "runtime.hash_iter", "hash_iter", "runtime", function(key_, value_, t_, h_, endbucket_, wrapped_, b_, buckets_, bucket_, bptr_, i_, check_bucket_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : (go$ptrType(Go$Uint8)).nil;
		this.value = value_ !== undefined ? value_ : (go$ptrType(Go$Uint8)).nil;
		this.t = t_ !== undefined ? t_ : (go$ptrType(maptype)).nil;
		this.h = h_ !== undefined ? h_ : (go$ptrType(hmap)).nil;
		this.endbucket = endbucket_ !== undefined ? endbucket_ : new Go$Uint64(0, 0);
		this.wrapped = wrapped_ !== undefined ? wrapped_ : 0;
		this.b = b_ !== undefined ? b_ : 0;
		this.buckets = buckets_ !== undefined ? buckets_ : (go$ptrType(Go$Uint8)).nil;
		this.bucket = bucket_ !== undefined ? bucket_ : new Go$Uint64(0, 0);
		this.bptr = bptr_ !== undefined ? bptr_ : (go$ptrType(bucket)).nil;
		this.i = i_ !== undefined ? i_ : new Go$Uint64(0, 0);
		this.check_bucket = check_bucket_ !== undefined ? check_bucket_ : new Go$Int64(0, 0);
	});
	go$pkg.hash_iter = hash_iter;
	var sudog;
	sudog = go$newType(0, "Struct", "runtime.sudog", "sudog", "runtime", function(g_, selgen_, link_, releasetime_, elem_) {
		this.go$val = this;
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.selgen = selgen_ !== undefined ? selgen_ : 0;
		this.link = link_ !== undefined ? link_ : (go$ptrType(sudog)).nil;
		this.releasetime = releasetime_ !== undefined ? releasetime_ : new Go$Int64(0, 0);
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(Go$Uint8)).nil;
	});
	go$pkg.sudog = sudog;
	var waitq;
	waitq = go$newType(0, "Struct", "runtime.waitq", "waitq", "runtime", function(first_, last_) {
		this.go$val = this;
		this.first = first_ !== undefined ? first_ : (go$ptrType(sudog)).nil;
		this.last = last_ !== undefined ? last_ : (go$ptrType(sudog)).nil;
	});
	go$pkg.waitq = waitq;
	var hchan;
	hchan = go$newType(0, "Struct", "runtime.hchan", "hchan", "runtime", function(qcount_, dataqsiz_, elemsize_, pad_, closed_, elemalg_, sendx_, recvx_, recvq_, sendq_, lock_) {
		this.go$val = this;
		this.qcount = qcount_ !== undefined ? qcount_ : new Go$Uint64(0, 0);
		this.dataqsiz = dataqsiz_ !== undefined ? dataqsiz_ : new Go$Uint64(0, 0);
		this.elemsize = elemsize_ !== undefined ? elemsize_ : 0;
		this.pad = pad_ !== undefined ? pad_ : 0;
		this.closed = closed_ !== undefined ? closed_ : 0;
		this.elemalg = elemalg_ !== undefined ? elemalg_ : (go$ptrType(alg)).nil;
		this.sendx = sendx_ !== undefined ? sendx_ : new Go$Uint64(0, 0);
		this.recvx = recvx_ !== undefined ? recvx_ : new Go$Uint64(0, 0);
		this.recvq = recvq_ !== undefined ? recvq_ : new waitq.Ptr();
		this.sendq = sendq_ !== undefined ? sendq_ : new waitq.Ptr();
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
	});
	go$pkg.hchan = hchan;
	var scase;
	scase = go$newType(0, "Struct", "runtime.scase", "scase", "runtime", function(sg_, _chan_, pc_, kind_, so_, receivedp_) {
		this.go$val = this;
		this.sg = sg_ !== undefined ? sg_ : new sudog.Ptr();
		this._chan = _chan_ !== undefined ? _chan_ : (go$ptrType(hchan)).nil;
		this.pc = pc_ !== undefined ? pc_ : (go$ptrType(Go$Uint8)).nil;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.so = so_ !== undefined ? so_ : 0;
		this.receivedp = receivedp_ !== undefined ? receivedp_ : (go$ptrType(Go$Uint8)).nil;
	});
	go$pkg.scase = scase;
	var _select;
	_select = go$newType(0, "Struct", "runtime._select", "_select", "runtime", function(tcase_, ncase_, pollorder_, lockorder_, scase_) {
		this.go$val = this;
		this.tcase = tcase_ !== undefined ? tcase_ : 0;
		this.ncase = ncase_ !== undefined ? ncase_ : 0;
		this.pollorder = pollorder_ !== undefined ? pollorder_ : (go$ptrType(Go$Uint16)).nil;
		this.lockorder = lockorder_ !== undefined ? lockorder_ : (go$ptrType((go$ptrType(hchan)))).nil;
		this.scase = scase_ !== undefined ? scase_ : go$makeNativeArray("Struct", 1, function() { return new scase.Ptr(); });
	});
	go$pkg._select = _select;
	var runtimeselect;
	runtimeselect = go$newType(0, "Struct", "runtime.runtimeselect", "runtimeselect", "runtime", function(dir_, typ_, ch_, val_) {
		this.go$val = this;
		this.dir = dir_ !== undefined ? dir_ : new Go$Uint64(0, 0);
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(chantype)).nil;
		this.ch = ch_ !== undefined ? ch_ : (go$ptrType(hchan)).nil;
		this.val = val_ !== undefined ? val_ : new Go$Uint64(0, 0);
	});
	go$pkg.runtimeselect = runtimeselect;
	var parforthread;
	parforthread = go$newType(0, "Struct", "runtime.parforthread", "parforthread", "runtime", function(pos_, nsteal_, nstealcnt_, nprocyield_, nosyield_, nsleep_, pad_) {
		this.go$val = this;
		this.pos = pos_ !== undefined ? pos_ : new Go$Uint64(0, 0);
		this.nsteal = nsteal_ !== undefined ? nsteal_ : new Go$Uint64(0, 0);
		this.nstealcnt = nstealcnt_ !== undefined ? nstealcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg.parforthread = parforthread;
	MemProfileRecord.init([["AllocBytes", "", Go$Int64, ""], ["FreeBytes", "", Go$Int64, ""], ["AllocObjects", "", Go$Int64, ""], ["FreeObjects", "", Go$Int64, ""], ["Stack0", "", (go$arrayType(Go$Uintptr, 32)), ""]]);
	(go$ptrType(MemProfileRecord)).methods = [["InUseBytes", "", [], [Go$Int64], false], ["InUseObjects", "", [], [Go$Int64], false], ["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	StackRecord.init([["Stack0", "", (go$arrayType(Go$Uintptr, 32)), ""]]);
	(go$ptrType(StackRecord)).methods = [["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	BlockProfileRecord.init([["Count", "", Go$Int64, ""], ["Cycles", "", Go$Int64, ""], ["", "", StackRecord, ""]]);
	(go$ptrType(BlockProfileRecord)).methods = [["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	Error.init([["Error", "", (go$funcType([], [Go$String], false))], ["RuntimeError", "", (go$funcType([], [], false))]]);
	TypeAssertionError.init([["interfaceString", "runtime", Go$String, ""], ["concreteString", "runtime", Go$String, ""], ["assertedString", "runtime", Go$String, ""], ["missingMethod", "runtime", Go$String, ""]]);
	(go$ptrType(TypeAssertionError)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	errorString.methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	errorCString.methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	(go$ptrType(errorCString)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	stringer.init([["String", "", (go$funcType([], [Go$String], false))]]);
	Func.init([["opaque", "runtime", (go$structType([])), ""]]);
	(go$ptrType(Func)).methods = [["Entry", "", [], [Go$Uintptr], false], ["FileLine", "", [Go$Uintptr], [Go$String, Go$Int], false], ["Name", "", [], [Go$String], false]];
	MemStats.init([["Alloc", "", Go$Uint64, ""], ["TotalAlloc", "", Go$Uint64, ""], ["Sys", "", Go$Uint64, ""], ["Lookups", "", Go$Uint64, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""], ["HeapAlloc", "", Go$Uint64, ""], ["HeapSys", "", Go$Uint64, ""], ["HeapIdle", "", Go$Uint64, ""], ["HeapInuse", "", Go$Uint64, ""], ["HeapReleased", "", Go$Uint64, ""], ["HeapObjects", "", Go$Uint64, ""], ["StackInuse", "", Go$Uint64, ""], ["StackSys", "", Go$Uint64, ""], ["MSpanInuse", "", Go$Uint64, ""], ["MSpanSys", "", Go$Uint64, ""], ["MCacheInuse", "", Go$Uint64, ""], ["MCacheSys", "", Go$Uint64, ""], ["BuckHashSys", "", Go$Uint64, ""], ["GCSys", "", Go$Uint64, ""], ["OtherSys", "", Go$Uint64, ""], ["NextGC", "", Go$Uint64, ""], ["LastGC", "", Go$Uint64, ""], ["PauseTotalNs", "", Go$Uint64, ""], ["PauseNs", "", (go$arrayType(Go$Uint64, 256)), ""], ["NumGC", "", Go$Uint32, ""], ["EnableGC", "", Go$Bool, ""], ["DebugGC", "", Go$Bool, ""], ["BySize", "", (go$arrayType((go$structType([["Size", "", Go$Uint32, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""]])), 61)), ""]]);
	rtype.init([["size", "runtime", Go$Uintptr, ""], ["hash", "runtime", Go$Uint32, ""], ["_", "runtime", Go$Uint8, ""], ["align", "runtime", Go$Uint8, ""], ["fieldAlign", "runtime", Go$Uint8, ""], ["kind", "runtime", Go$Uint8, ""], ["alg", "runtime", Go$UnsafePointer, ""], ["gc", "runtime", Go$UnsafePointer, ""], ["string", "runtime", (go$ptrType(Go$String)), ""], ["", "runtime", (go$ptrType(uncommonType)), ""], ["ptrToThis", "runtime", (go$ptrType(rtype)), ""]]);
	_method.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["mtyp", "runtime", (go$ptrType(rtype)), ""], ["typ", "runtime", (go$ptrType(rtype)), ""], ["ifn", "runtime", Go$UnsafePointer, ""], ["tfn", "runtime", Go$UnsafePointer, ""]]);
	uncommonType.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["methods", "runtime", (go$sliceType(_method)), ""]]);
	_imethod.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["typ", "runtime", (go$ptrType(rtype)), ""]]);
	interfaceType.init([["", "runtime", rtype, ""], ["methods", "runtime", (go$sliceType(_imethod)), ""]]);
	lock.init([["key", "runtime", Go$Uint64, ""]]);
	note.init([["key", "runtime", Go$Uint64, ""]]);
	_string.init([["str", "runtime", (go$ptrType(Go$Uint8)), ""], ["len", "runtime", Go$Int64, ""]]);
	funcval.init([["fn", "runtime", (go$funcType([], [], false)), ""]]);
	iface.init([["tab", "runtime", (go$ptrType(itab)), ""], ["data", "runtime", Go$UnsafePointer, ""]]);
	eface.init([["_type", "runtime", (go$ptrType(_type)), ""], ["data", "runtime", Go$UnsafePointer, ""]]);
	_complex64.init([["real", "runtime", Go$Float32, ""], ["imag", "runtime", Go$Float32, ""]]);
	_complex128.init([["real", "runtime", Go$Float64, ""], ["imag", "runtime", Go$Float64, ""]]);
	slice.init([["array", "runtime", (go$ptrType(Go$Uint8)), ""], ["len", "runtime", Go$Uint64, ""], ["cap", "runtime", Go$Uint64, ""]]);
	gobuf.init([["sp", "runtime", Go$Uint64, ""], ["pc", "runtime", Go$Uint64, ""], ["g", "runtime", (go$ptrType(g)), ""], ["ret", "runtime", Go$Uint64, ""], ["ctxt", "runtime", Go$UnsafePointer, ""], ["lr", "runtime", Go$Uint64, ""]]);
	gcstats.init([["nhandoff", "runtime", Go$Uint64, ""], ["nhandoffcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""]]);
	wincall.init([["fn", "runtime", (go$funcType([Go$UnsafePointer], [], false)), ""], ["n", "runtime", Go$Uint64, ""], ["args", "runtime", Go$UnsafePointer, ""], ["r1", "runtime", Go$Uint64, ""], ["r2", "runtime", Go$Uint64, ""], ["err", "runtime", Go$Uint64, ""]]);
	seh.init([["prev", "runtime", Go$UnsafePointer, ""], ["handler", "runtime", Go$UnsafePointer, ""]]);
	wincallbackcontext.init([["gobody", "runtime", Go$UnsafePointer, ""], ["argsize", "runtime", Go$Uint64, ""], ["restorestack", "runtime", Go$Uint64, ""]]);
	g.init([["stackguard0", "runtime", Go$Uint64, ""], ["stackbase", "runtime", Go$Uint64, ""], ["panicwrap", "runtime", Go$Uint32, ""], ["selgen", "runtime", Go$Uint32, ""], ["_defer", "runtime", (go$ptrType(_defer)), ""], ["_panic", "runtime", (go$ptrType(_panic)), ""], ["sched", "runtime", gobuf, ""], ["syscallstack", "runtime", Go$Uint64, ""], ["syscallsp", "runtime", Go$Uint64, ""], ["syscallpc", "runtime", Go$Uint64, ""], ["syscallguard", "runtime", Go$Uint64, ""], ["stackguard", "runtime", Go$Uint64, ""], ["stack0", "runtime", Go$Uint64, ""], ["stacksize", "runtime", Go$Uint64, ""], ["alllink", "runtime", (go$ptrType(g)), ""], ["param", "runtime", Go$UnsafePointer, ""], ["status", "runtime", Go$Int16, ""], ["goid", "runtime", Go$Int64, ""], ["waitreason", "runtime", (go$ptrType(Go$Int8)), ""], ["schedlink", "runtime", (go$ptrType(g)), ""], ["ispanic", "runtime", Go$Uint8, ""], ["issystem", "runtime", Go$Uint8, ""], ["isbackground", "runtime", Go$Uint8, ""], ["preempt", "runtime", Go$Uint8, ""], ["raceignore", "runtime", Go$Int8, ""], ["m", "runtime", (go$ptrType(m)), ""], ["lockedm", "runtime", (go$ptrType(m)), ""], ["sig", "runtime", Go$Int32, ""], ["writenbuf", "runtime", Go$Int32, ""], ["writebuf", "runtime", (go$ptrType(Go$Uint8)), ""], ["dchunk", "runtime", (go$ptrType(deferchunk)), ""], ["dchunknext", "runtime", (go$ptrType(deferchunk)), ""], ["sigcode0", "runtime", Go$Uint64, ""], ["sigcode1", "runtime", Go$Uint64, ""], ["sigpc", "runtime", Go$Uint64, ""], ["gopc", "runtime", Go$Uint64, ""], ["racectx", "runtime", Go$Uint64, ""], ["end", "runtime", (go$arrayType(Go$Uint64, 0)), ""]]);
	m.init([["g0", "runtime", (go$ptrType(g)), ""], ["moreargp", "runtime", Go$UnsafePointer, ""], ["morebuf", "runtime", gobuf, ""], ["moreframesize", "runtime", Go$Uint32, ""], ["moreargsize", "runtime", Go$Uint32, ""], ["cret", "runtime", Go$Uint64, ""], ["procid", "runtime", Go$Uint64, ""], ["gsignal", "runtime", (go$ptrType(g)), ""], ["tls", "runtime", (go$arrayType(Go$Uint64, 4)), ""], ["mstartfn", "runtime", (go$funcType([], [], false)), ""], ["curg", "runtime", (go$ptrType(g)), ""], ["caughtsig", "runtime", (go$ptrType(g)), ""], ["p", "runtime", (go$ptrType(p)), ""], ["nextp", "runtime", (go$ptrType(p)), ""], ["id", "runtime", Go$Int32, ""], ["mallocing", "runtime", Go$Int32, ""], ["throwing", "runtime", Go$Int32, ""], ["gcing", "runtime", Go$Int32, ""], ["locks", "runtime", Go$Int32, ""], ["dying", "runtime", Go$Int32, ""], ["profilehz", "runtime", Go$Int32, ""], ["helpgc", "runtime", Go$Int32, ""], ["spinning", "runtime", Go$Uint8, ""], ["fastrand", "runtime", Go$Uint32, ""], ["ncgocall", "runtime", Go$Uint64, ""], ["ncgo", "runtime", Go$Int32, ""], ["cgomal", "runtime", (go$ptrType(cgomal)), ""], ["park", "runtime", note, ""], ["alllink", "runtime", (go$ptrType(m)), ""], ["schedlink", "runtime", (go$ptrType(m)), ""], ["machport", "runtime", Go$Uint32, ""], ["mcache", "runtime", (go$ptrType(mcache)), ""], ["stackinuse", "runtime", Go$Int32, ""], ["stackcachepos", "runtime", Go$Uint32, ""], ["stackcachecnt", "runtime", Go$Uint32, ""], ["stackcache", "runtime", (go$arrayType(Go$UnsafePointer, 32)), ""], ["lockedg", "runtime", (go$ptrType(g)), ""], ["createstack", "runtime", (go$arrayType(Go$Uint64, 32)), ""], ["freglo", "runtime", (go$arrayType(Go$Uint32, 16)), ""], ["freghi", "runtime", (go$arrayType(Go$Uint32, 16)), ""], ["fflag", "runtime", Go$Uint32, ""], ["locked", "runtime", Go$Uint32, ""], ["nextwaitm", "runtime", (go$ptrType(m)), ""], ["waitsema", "runtime", Go$Uint64, ""], ["waitsemacount", "runtime", Go$Uint32, ""], ["waitsemalock", "runtime", Go$Uint32, ""], ["gcstats", "runtime", gcstats, ""], ["racecall", "runtime", Go$Uint8, ""], ["needextram", "runtime", Go$Uint8, ""], ["waitunlockf", "runtime", (go$funcType([(go$ptrType(lock))], [], false)), ""], ["waitlock", "runtime", Go$UnsafePointer, ""], ["settype_buf", "runtime", (go$arrayType(Go$Uint64, 1024)), ""], ["settype_bufsize", "runtime", Go$Uint64, ""], ["thread", "runtime", Go$UnsafePointer, ""], ["wincall", "runtime", wincall, ""], ["seh", "runtime", (go$ptrType(seh)), ""], ["end", "runtime", (go$arrayType(Go$Uint64, 0)), ""]]);
	p.init([["", "runtime", lock, ""], ["id", "runtime", Go$Int32, ""], ["status", "runtime", Go$Uint32, ""], ["link", "runtime", (go$ptrType(p)), ""], ["schedtick", "runtime", Go$Uint32, ""], ["syscalltick", "runtime", Go$Uint32, ""], ["m", "runtime", (go$ptrType(m)), ""], ["mcache", "runtime", (go$ptrType(mcache)), ""], ["runq", "runtime", (go$ptrType((go$ptrType(g)))), ""], ["runqhead", "runtime", Go$Int32, ""], ["runqtail", "runtime", Go$Int32, ""], ["runqsize", "runtime", Go$Int32, ""], ["gfree", "runtime", (go$ptrType(g)), ""], ["gfreecnt", "runtime", Go$Int32, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	stktop.init([["stackguard", "runtime", Go$Uint64, ""], ["stackbase", "runtime", Go$Uint64, ""], ["gobuf", "runtime", gobuf, ""], ["argsize", "runtime", Go$Uint32, ""], ["panicwrap", "runtime", Go$Uint32, ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["free", "runtime", Go$Uint64, ""], ["_panic", "runtime", Go$Uint8, ""]]);
	sigtab.init([["flags", "runtime", Go$Int32, ""], ["name", "runtime", (go$ptrType(Go$Int8)), ""]]);
	_func.init([["entry", "runtime", Go$Uint64, ""], ["nameoff", "runtime", Go$Int32, ""], ["args", "runtime", Go$Int32, ""], ["frame", "runtime", Go$Int32, ""], ["pcsp", "runtime", Go$Int32, ""], ["pcfile", "runtime", Go$Int32, ""], ["pcln", "runtime", Go$Int32, ""], ["npcdata", "runtime", Go$Int32, ""], ["nfuncdata", "runtime", Go$Int32, ""]]);
	itab.init([["inter", "runtime", (go$ptrType(interfacetype)), ""], ["_type", "runtime", (go$ptrType(_type)), ""], ["link", "runtime", (go$ptrType(itab)), ""], ["bad", "runtime", Go$Int32, ""], ["unused", "runtime", Go$Int32, ""], ["fun", "runtime", (go$arrayType((go$funcType([], [], false)), 0)), ""]]);
	timers.init([["", "runtime", lock, ""], ["timerproc", "runtime", (go$ptrType(g)), ""], ["sleeping", "runtime", Go$Uint8, ""], ["rescheduling", "runtime", Go$Uint8, ""], ["waitnote", "runtime", note, ""], ["t", "runtime", (go$ptrType((go$ptrType(timer)))), ""], ["len", "runtime", Go$Int32, ""], ["cap", "runtime", Go$Int32, ""]]);
	timer.init([["i", "runtime", Go$Int32, ""], ["when", "runtime", Go$Int64, ""], ["period", "runtime", Go$Int64, ""], ["fv", "runtime", (go$ptrType(funcval)), ""], ["arg", "runtime", eface, ""]]);
	lfnode.init([["next", "runtime", (go$ptrType(lfnode)), ""], ["pushcnt", "runtime", Go$Uint64, ""]]);
	parfor.init([["body", "runtime", (go$funcType([(go$ptrType(parfor)), Go$Uint32], [], false)), ""], ["done", "runtime", Go$Uint32, ""], ["nthr", "runtime", Go$Uint32, ""], ["nthrmax", "runtime", Go$Uint32, ""], ["thrseq", "runtime", Go$Uint32, ""], ["cnt", "runtime", Go$Uint32, ""], ["ctx", "runtime", Go$UnsafePointer, ""], ["wait", "runtime", Go$Uint8, ""], ["thr", "runtime", (go$ptrType(parforthread)), ""], ["pad", "runtime", Go$Uint32, ""], ["nsteal", "runtime", Go$Uint64, ""], ["nstealcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""]]);
	cgomal.init([["next", "runtime", (go$ptrType(cgomal)), ""], ["alloc", "runtime", Go$UnsafePointer, ""]]);
	debugvars.init([["gctrace", "runtime", Go$Int32, ""], ["schedtrace", "runtime", Go$Int32, ""], ["scheddetail", "runtime", Go$Int32, ""]]);
	alg.init([["hash", "runtime", (go$funcType([(go$ptrType(Go$Uint64)), Go$Uint64, Go$UnsafePointer], [], false)), ""], ["equal", "runtime", (go$funcType([(go$ptrType(Go$Uint8)), Go$Uint64, Go$UnsafePointer, Go$UnsafePointer], [], false)), ""], ["print", "runtime", (go$funcType([Go$Uint64, Go$UnsafePointer], [], false)), ""], ["copy", "runtime", (go$funcType([Go$Uint64, Go$UnsafePointer, Go$UnsafePointer], [], false)), ""]]);
	_defer.init([["siz", "runtime", Go$Int32, ""], ["special", "runtime", Go$Uint8, ""], ["free", "runtime", Go$Uint8, ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["pc", "runtime", (go$ptrType(Go$Uint8)), ""], ["fn", "runtime", (go$ptrType(funcval)), ""], ["link", "runtime", (go$ptrType(_defer)), ""], ["args", "runtime", (go$arrayType(Go$UnsafePointer, 1)), ""]]);
	deferchunk.init([["prev", "runtime", (go$ptrType(deferchunk)), ""], ["off", "runtime", Go$Uint64, ""]]);
	_panic.init([["arg", "runtime", eface, ""], ["stackbase", "runtime", Go$Uint64, ""], ["link", "runtime", (go$ptrType(_panic)), ""], ["recovered", "runtime", Go$Uint8, ""]]);
	stkframe.init([["fn", "runtime", (go$ptrType(_func)), ""], ["pc", "runtime", Go$Uint64, ""], ["lr", "runtime", Go$Uint64, ""], ["sp", "runtime", Go$Uint64, ""], ["fp", "runtime", Go$Uint64, ""], ["varp", "runtime", (go$ptrType(Go$Uint8)), ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["arglen", "runtime", Go$Uint64, ""]]);
	mlink.init([["next", "runtime", (go$ptrType(mlink)), ""]]);
	fixalloc.init([["size", "runtime", Go$Uint64, ""], ["first", "runtime", (go$funcType([Go$UnsafePointer, (go$ptrType(Go$Uint8))], [], false)), ""], ["arg", "runtime", Go$UnsafePointer, ""], ["list", "runtime", (go$ptrType(mlink)), ""], ["chunk", "runtime", (go$ptrType(Go$Uint8)), ""], ["nchunk", "runtime", Go$Uint32, ""], ["inuse", "runtime", Go$Uint64, ""], ["stat", "runtime", (go$ptrType(Go$Uint64)), ""]]);
	_1_.init([["size", "runtime", Go$Uint32, ""], ["nmalloc", "runtime", Go$Uint64, ""], ["nfree", "runtime", Go$Uint64, ""]]);
	mstats.init([["alloc", "runtime", Go$Uint64, ""], ["total_alloc", "runtime", Go$Uint64, ""], ["sys", "runtime", Go$Uint64, ""], ["nlookup", "runtime", Go$Uint64, ""], ["nmalloc", "runtime", Go$Uint64, ""], ["nfree", "runtime", Go$Uint64, ""], ["heap_alloc", "runtime", Go$Uint64, ""], ["heap_sys", "runtime", Go$Uint64, ""], ["heap_idle", "runtime", Go$Uint64, ""], ["heap_inuse", "runtime", Go$Uint64, ""], ["heap_released", "runtime", Go$Uint64, ""], ["heap_objects", "runtime", Go$Uint64, ""], ["stacks_inuse", "runtime", Go$Uint64, ""], ["stacks_sys", "runtime", Go$Uint64, ""], ["mspan_inuse", "runtime", Go$Uint64, ""], ["mspan_sys", "runtime", Go$Uint64, ""], ["mcache_inuse", "runtime", Go$Uint64, ""], ["mcache_sys", "runtime", Go$Uint64, ""], ["buckhash_sys", "runtime", Go$Uint64, ""], ["gc_sys", "runtime", Go$Uint64, ""], ["other_sys", "runtime", Go$Uint64, ""], ["next_gc", "runtime", Go$Uint64, ""], ["last_gc", "runtime", Go$Uint64, ""], ["pause_total_ns", "runtime", Go$Uint64, ""], ["pause_ns", "runtime", (go$arrayType(Go$Uint64, 256)), ""], ["numgc", "runtime", Go$Uint32, ""], ["enablegc", "runtime", Go$Uint8, ""], ["debuggc", "runtime", Go$Uint8, ""], ["by_size", "runtime", (go$arrayType(_1_, 61)), ""]]);
	mcachelist.init([["list", "runtime", (go$ptrType(mlink)), ""], ["nlist", "runtime", Go$Uint32, ""]]);
	mcache.init([["next_sample", "runtime", Go$Int32, ""], ["local_cachealloc", "runtime", Go$Int64, ""], ["list", "runtime", (go$arrayType(mcachelist, 61)), ""], ["local_nlookup", "runtime", Go$Uint64, ""], ["local_largefree", "runtime", Go$Uint64, ""], ["local_nlargefree", "runtime", Go$Uint64, ""], ["local_nsmallfree", "runtime", (go$arrayType(Go$Uint64, 61)), ""]]);
	mtypes.init([["compression", "runtime", Go$Uint8, ""], ["data", "runtime", Go$Uint64, ""]]);
	mspan.init([["next", "runtime", (go$ptrType(mspan)), ""], ["prev", "runtime", (go$ptrType(mspan)), ""], ["start", "runtime", Go$Uint64, ""], ["npages", "runtime", Go$Uint64, ""], ["freelist", "runtime", (go$ptrType(mlink)), ""], ["ref", "runtime", Go$Uint32, ""], ["sizeclass", "runtime", Go$Int32, ""], ["elemsize", "runtime", Go$Uint64, ""], ["state", "runtime", Go$Uint32, ""], ["unusedsince", "runtime", Go$Int64, ""], ["npreleased", "runtime", Go$Uint64, ""], ["limit", "runtime", (go$ptrType(Go$Uint8)), ""], ["types", "runtime", mtypes, ""]]);
	mcentral.init([["", "runtime", lock, ""], ["sizeclass", "runtime", Go$Int32, ""], ["nonempty", "runtime", mspan, ""], ["empty", "runtime", mspan, ""], ["nfree", "runtime", Go$Int32, ""]]);
	_2_.init([["", "runtime", mcentral, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	mheap.init([["", "runtime", lock, ""], ["free", "runtime", (go$arrayType(mspan, 256)), ""], ["large", "runtime", mspan, ""], ["allspans", "runtime", (go$ptrType((go$ptrType(mspan)))), ""], ["nspan", "runtime", Go$Uint32, ""], ["nspancap", "runtime", Go$Uint32, ""], ["spans", "runtime", (go$ptrType((go$ptrType(mspan)))), ""], ["spans_mapped", "runtime", Go$Uint64, ""], ["bitmap", "runtime", (go$ptrType(Go$Uint8)), ""], ["bitmap_mapped", "runtime", Go$Uint64, ""], ["arena_start", "runtime", (go$ptrType(Go$Uint8)), ""], ["arena_used", "runtime", (go$ptrType(Go$Uint8)), ""], ["arena_end", "runtime", (go$ptrType(Go$Uint8)), ""], ["central", "runtime", (go$arrayType(_2_, 61)), ""], ["spanalloc", "runtime", fixalloc, ""], ["cachealloc", "runtime", fixalloc, ""], ["largefree", "runtime", Go$Uint64, ""], ["nlargefree", "runtime", Go$Uint64, ""], ["nsmallfree", "runtime", (go$arrayType(Go$Uint64, 61)), ""]]);
	_type.init([["size", "runtime", Go$Uint64, ""], ["hash", "runtime", Go$Uint32, ""], ["_unused", "runtime", Go$Uint8, ""], ["align", "runtime", Go$Uint8, ""], ["fieldalign", "runtime", Go$Uint8, ""], ["kind", "runtime", Go$Uint8, ""], ["alg", "runtime", (go$ptrType(alg)), ""], ["gc", "runtime", Go$UnsafePointer, ""], ["_string", "runtime", (go$ptrType(Go$String)), ""], ["x", "runtime", (go$ptrType(uncommontype)), ""], ["ptrto", "runtime", (go$ptrType(_type)), ""]]);
	method.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["mtyp", "runtime", (go$ptrType(_type)), ""], ["typ", "runtime", (go$ptrType(_type)), ""], ["ifn", "runtime", (go$funcType([], [], false)), ""], ["tfn", "runtime", (go$funcType([], [], false)), ""]]);
	uncommontype.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["mhdr", "runtime", (go$sliceType(Go$Uint8)), ""], ["m", "runtime", (go$arrayType(method, 0)), ""]]);
	imethod.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["_type", "runtime", (go$ptrType(_type)), ""]]);
	interfacetype.init([["", "runtime", _type, ""], ["mhdr", "runtime", (go$sliceType(Go$Uint8)), ""], ["m", "runtime", (go$arrayType(imethod, 0)), ""]]);
	maptype.init([["", "runtime", _type, ""], ["key", "runtime", (go$ptrType(_type)), ""], ["elem", "runtime", (go$ptrType(_type)), ""], ["bucket", "runtime", (go$ptrType(_type)), ""], ["hmap", "runtime", (go$ptrType(_type)), ""]]);
	chantype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""], ["dir", "runtime", Go$Uint64, ""]]);
	slicetype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""]]);
	functype.init([["", "runtime", _type, ""], ["dotdotdot", "runtime", Go$Uint8, ""], ["in", "runtime", (go$sliceType(Go$Uint8)), ""], ["out", "runtime", (go$sliceType(Go$Uint8)), ""]]);
	ptrtype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""]]);
	sched.init([["", "runtime", lock, ""], ["goidgen", "runtime", Go$Uint64, ""], ["midle", "runtime", (go$ptrType(m)), ""], ["nmidle", "runtime", Go$Int32, ""], ["nmidlelocked", "runtime", Go$Int32, ""], ["mcount", "runtime", Go$Int32, ""], ["maxmcount", "runtime", Go$Int32, ""], ["pidle", "runtime", (go$ptrType(p)), ""], ["npidle", "runtime", Go$Uint32, ""], ["nmspinning", "runtime", Go$Uint32, ""], ["runqhead", "runtime", (go$ptrType(g)), ""], ["runqtail", "runtime", (go$ptrType(g)), ""], ["runqsize", "runtime", Go$Int32, ""], ["gflock", "runtime", lock, ""], ["gfree", "runtime", (go$ptrType(g)), ""], ["gcwaiting", "runtime", Go$Uint32, ""], ["stopwait", "runtime", Go$Int32, ""], ["stopnote", "runtime", note, ""], ["sysmonwait", "runtime", Go$Uint32, ""], ["sysmonnote", "runtime", note, ""], ["lastpoll", "runtime", Go$Uint64, ""], ["profilehz", "runtime", Go$Int32, ""]]);
	cgothreadstart.init([["m", "runtime", (go$ptrType(m)), ""], ["g", "runtime", (go$ptrType(g)), ""], ["fn", "runtime", (go$funcType([], [], false)), ""]]);
	_3_.init([["", "runtime", lock, ""], ["fn", "runtime", (go$funcType([(go$ptrType(Go$Uint64)), Go$Int32], [], false)), ""], ["hz", "runtime", Go$Int32, ""], ["pcbuf", "runtime", (go$arrayType(Go$Uint64, 100)), ""]]);
	pdesc.init([["schedtick", "runtime", Go$Uint32, ""], ["schedwhen", "runtime", Go$Int64, ""], ["syscalltick", "runtime", Go$Uint32, ""], ["syscallwhen", "runtime", Go$Int64, ""]]);
	bucket.init([["tophash", "runtime", (go$arrayType(Go$Uint8, 8)), ""], ["overflow", "runtime", (go$ptrType(bucket)), ""], ["data", "runtime", (go$arrayType(Go$Uint8, 1)), ""]]);
	hmap.init([["count", "runtime", Go$Uint64, ""], ["flags", "runtime", Go$Uint32, ""], ["hash0", "runtime", Go$Uint32, ""], ["b", "runtime", Go$Uint8, ""], ["keysize", "runtime", Go$Uint8, ""], ["valuesize", "runtime", Go$Uint8, ""], ["bucketsize", "runtime", Go$Uint16, ""], ["buckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["oldbuckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["nevacuate", "runtime", Go$Uint64, ""]]);
	hash_iter.init([["key", "runtime", (go$ptrType(Go$Uint8)), ""], ["value", "runtime", (go$ptrType(Go$Uint8)), ""], ["t", "runtime", (go$ptrType(maptype)), ""], ["h", "runtime", (go$ptrType(hmap)), ""], ["endbucket", "runtime", Go$Uint64, ""], ["wrapped", "runtime", Go$Uint8, ""], ["b", "runtime", Go$Uint8, ""], ["buckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["bucket", "runtime", Go$Uint64, ""], ["bptr", "runtime", (go$ptrType(bucket)), ""], ["i", "runtime", Go$Uint64, ""], ["check_bucket", "runtime", Go$Int64, ""]]);
	sudog.init([["g", "runtime", (go$ptrType(g)), ""], ["selgen", "runtime", Go$Uint32, ""], ["link", "runtime", (go$ptrType(sudog)), ""], ["releasetime", "runtime", Go$Int64, ""], ["elem", "runtime", (go$ptrType(Go$Uint8)), ""]]);
	waitq.init([["first", "runtime", (go$ptrType(sudog)), ""], ["last", "runtime", (go$ptrType(sudog)), ""]]);
	hchan.init([["qcount", "runtime", Go$Uint64, ""], ["dataqsiz", "runtime", Go$Uint64, ""], ["elemsize", "runtime", Go$Uint16, ""], ["pad", "runtime", Go$Uint16, ""], ["closed", "runtime", Go$Uint8, ""], ["elemalg", "runtime", (go$ptrType(alg)), ""], ["sendx", "runtime", Go$Uint64, ""], ["recvx", "runtime", Go$Uint64, ""], ["recvq", "runtime", waitq, ""], ["sendq", "runtime", waitq, ""], ["", "runtime", lock, ""]]);
	scase.init([["sg", "runtime", sudog, ""], ["_chan", "runtime", (go$ptrType(hchan)), ""], ["pc", "runtime", (go$ptrType(Go$Uint8)), ""], ["kind", "runtime", Go$Uint16, ""], ["so", "runtime", Go$Uint16, ""], ["receivedp", "runtime", (go$ptrType(Go$Uint8)), ""]]);
	_select.init([["tcase", "runtime", Go$Uint16, ""], ["ncase", "runtime", Go$Uint16, ""], ["pollorder", "runtime", (go$ptrType(Go$Uint16)), ""], ["lockorder", "runtime", (go$ptrType((go$ptrType(hchan)))), ""], ["scase", "runtime", (go$arrayType(scase, 1)), ""]]);
	runtimeselect.init([["dir", "runtime", Go$Uint64, ""], ["typ", "runtime", (go$ptrType(chantype)), ""], ["ch", "runtime", (go$ptrType(hchan)), ""], ["val", "runtime", Go$Uint64, ""]]);
	parforthread.init([["pos", "runtime", Go$Uint64, ""], ["nsteal", "runtime", Go$Uint64, ""], ["nstealcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	go$pkg.MemProfileRate = 0;
	var sizeof_C_MStats = 0;
	var memStats = new MemStats.Ptr();
	var _ = 0;
	var precisestack = 0;
	var algarray = go$makeNativeArray("Struct", 22, function() { return new alg.Ptr(); });
	var startup_random_data = (go$ptrType(Go$Uint8)).nil;
	var startup_random_data_len = 0;
	var emptystring = "";
	var zerobase = new Go$Uint64(0, 0);
	var allg = (go$ptrType(g)).nil;
	var lastg = (go$ptrType(g)).nil;
	var allm = (go$ptrType(m)).nil;
	var allp = (go$ptrType((go$ptrType(p)))).nil;
	var gomaxprocs = 0;
	var needextram = 0;
	var panicking = 0;
	var goos = (go$ptrType(Go$Int8)).nil;
	var ncpu = 0;
	var iscgo = 0;
	var sysargs = go$throwNilPointerError;
	var maxstring = new Go$Uint64(0, 0);
	var hchansize = 0;
	var cpuid_ecx = 0;
	var cpuid_edx = 0;
	var debug = new debugvars.Ptr();
	var maxstacksize = new Go$Uint64(0, 0);
	var blockprofilerate = new Go$Int64(0, 0);
	var worldsema = 0;
	var nan = 0;
	var posinf = 0;
	var neginf = 0;
	var memstats = new mstats.Ptr();
	var class_to_size = go$makeNativeArray("Int32", 61, function() { return 0; });
	var class_to_allocnpages = go$makeNativeArray("Int32", 61, function() { return 0; });
	var size_to_class8 = go$makeNativeArray("Int8", 129, function() { return 0; });
	var size_to_class128 = go$makeNativeArray("Int8", 249, function() { return 0; });
	var checking = 0;
	var m0 = new m.Ptr();
	var g0 = new g.Ptr();
	var extram = (go$ptrType(m)).nil;
	var newprocs = 0;
	var scavenger = new funcval.Ptr();
	var initdone = new funcval.Ptr();
	var _cgo_thread_start = go$throwNilPointerError;
	var prof = new _3_.Ptr();
	var experiment = go$makeNativeArray("Int8", 0, function() { return 0; });
	var hash = go$makeNativeArray("Ptr", 1009, function() { return (go$ptrType(itab)).nil; });
	var ifacelock = new lock.Ptr();
	var typelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
	var etypelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
	var empty_value = go$makeNativeArray("Uint8", 128, function() { return 0; });
	var hashload = 0;
	var Breakpoint = go$pkg.Breakpoint = function() {
		throw go$panic("Native function not implemented: Breakpoint");
	};
	var LockOSThread = go$pkg.LockOSThread = function() {
		throw go$panic("Native function not implemented: LockOSThread");
	};
	var UnlockOSThread = go$pkg.UnlockOSThread = function() {
		throw go$panic("Native function not implemented: UnlockOSThread");
	};
	var GOMAXPROCS = go$pkg.GOMAXPROCS = function(n) {
			if (n > 1) {
				go$notSupported("GOMAXPROCS != 1");
			}
			return 1;
		};
	var NumCPU = go$pkg.NumCPU = function() { return 1; };
	var NumCgoCall = go$pkg.NumCgoCall = function() {
		throw go$panic("Native function not implemented: NumCgoCall");
	};
	var NumGoroutine = go$pkg.NumGoroutine = function() {
		throw go$panic("Native function not implemented: NumGoroutine");
	};
	MemProfileRecord.Ptr.prototype.InUseBytes = function() {
		var r, x, x$1;
		r = this;
		return (x = r.AllocBytes, x$1 = r.FreeBytes, new Go$Int64(x.high - x$1.high, x.low - x$1.low));
	};
	MemProfileRecord.prototype.InUseBytes = function() { return this.go$val.InUseBytes(); };
	MemProfileRecord.Ptr.prototype.InUseObjects = function() {
		var r, x, x$1;
		r = this;
		return (x = r.AllocObjects, x$1 = r.FreeObjects, new Go$Int64(x.high - x$1.high, x.low - x$1.low));
	};
	MemProfileRecord.prototype.InUseObjects = function() { return this.go$val.InUseObjects(); };
	MemProfileRecord.Ptr.prototype.Stack = function() {
		var r, _ref, _i, v, i;
		r = this;
		_ref = r.Stack0;
		_i = 0;
		for (; _i < 32; _i += 1) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
		}
		return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0);
	};
	MemProfileRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	var MemProfile = go$pkg.MemProfile = function(p$1, inuseZero) {
		throw go$panic("Native function not implemented: MemProfile");
	};
	StackRecord.Ptr.prototype.Stack = function() {
		var r, _ref, _i, v, i;
		r = this;
		_ref = r.Stack0;
		_i = 0;
		for (; _i < 32; _i += 1) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
		}
		return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0);
	};
	StackRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	var ThreadCreateProfile = go$pkg.ThreadCreateProfile = function(p$1) {
		throw go$panic("Native function not implemented: ThreadCreateProfile");
	};
	var GoroutineProfile = go$pkg.GoroutineProfile = function(p$1) {
		throw go$panic("Native function not implemented: GoroutineProfile");
	};
	var CPUProfile = go$pkg.CPUProfile = function() {
		throw go$panic("Native function not implemented: CPUProfile");
	};
	var SetCPUProfileRate = go$pkg.SetCPUProfileRate = function(hz) {
		throw go$panic("Native function not implemented: SetCPUProfileRate");
	};
	var SetBlockProfileRate = go$pkg.SetBlockProfileRate = function(rate) {
		throw go$panic("Native function not implemented: SetBlockProfileRate");
	};
	var BlockProfile = go$pkg.BlockProfile = function(p$1) {
		throw go$panic("Native function not implemented: BlockProfile");
	};
	var Stack = go$pkg.Stack = function(buf, all) {
		throw go$panic("Native function not implemented: Stack");
	};
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
	var newTypeAssertionError = function(ps1, ps2, ps3, pmeth, ret) {
		var _tuple, s1, s2, s3, meth;
		_tuple = ["", "", "", ""], s1 = _tuple[0], s2 = _tuple[1], s3 = _tuple[2], meth = _tuple[3];
		if (!(go$pointerIsEqual(ps1, (go$ptrType(Go$String)).nil))) {
			s1 = ps1.go$get();
		}
		if (!(go$pointerIsEqual(ps2, (go$ptrType(Go$String)).nil))) {
			s2 = ps2.go$get();
		}
		if (!(go$pointerIsEqual(ps3, (go$ptrType(Go$String)).nil))) {
			s3 = ps3.go$get();
		}
		if (!(go$pointerIsEqual(pmeth, (go$ptrType(Go$String)).nil))) {
			meth = pmeth.go$get();
		}
		ret.go$set(new TypeAssertionError.Ptr(s1, s2, s3, meth));
	};
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
	var newErrorString = function(s, ret) {
		ret.go$set(new errorString(s));
	};
	errorCString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorCString).prototype.RuntimeError = function() { return new errorCString(this.go$get()).RuntimeError(); };
	var cstringToGo = function() {
		throw go$panic("Native function not implemented: cstringToGo");
	};
	errorCString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + cstringToGo((e >>> 0));
	};
	go$ptrType(errorCString).prototype.Error = function() { return new errorCString(this.go$get()).Error(); };
	var newErrorCString = function(s, ret) {
		ret.go$set(new errorCString((s >>> 0)));
	};
	var typestring = function() {
		throw go$panic("Native function not implemented: typestring");
	};
	var printany = function(i) {
		var v, _ref, _type$1;
		_ref = i;
		_type$1 = _ref !== null ? _ref.constructor : null;
		if (_type$1 === null) {
			v = _ref;
			console.log("nil");
		} else if (stringer.implementedBy.indexOf(_type$1) !== -1) {
			v = _ref;
			console.log(v.String());
		} else if (go$error.implementedBy.indexOf(_type$1) !== -1) {
			v = _ref;
			console.log(v.Error());
		} else if (_type$1 === Go$Int) {
			v = _ref.go$val;
			console.log(v);
		} else if (_type$1 === Go$String) {
			v = _ref.go$val;
			console.log(v);
		} else {
			v = _ref;
			console.log("(", typestring(i), ") ", i);
		}
	};
	var panicwrap = function(pkg, typ, meth) {
		throw go$panic(new Go$String("value method " + pkg + "." + typ + "." + meth + " called using nil *" + typ + " pointer"));
	};
	var Gosched = go$pkg.Gosched = function() {
		throw go$panic("Native function not implemented: Gosched");
	};
	var Goexit = go$pkg.Goexit = function() {
			var err = new Go$Error();
			err.go$exit = true;
			throw err;
		};
	var Caller = go$pkg.Caller = function(skip) {
			var line = go$getStack()[skip + 3];
			if (line === undefined) {
				return [0, "", 0, false];
			}
			var parts = line.substring(line.indexOf("(") + 1, line.indexOf(")")).split(":");
			return [0, parts[0], parseInt(parts[1]), true];
		};
	var Callers = go$pkg.Callers = function(skip, pc) {
		throw go$panic("Native function not implemented: Callers");
	};
	var FuncForPC = go$pkg.FuncForPC = function(pc) {
		throw go$panic("Native function not implemented: FuncForPC");
	};
	Func.Ptr.prototype.Name = function() {
		var f;
		f = this;
		return funcname_go(f);
	};
	Func.prototype.Name = function() { return this.go$val.Name(); };
	Func.Ptr.prototype.Entry = function() {
		var f;
		f = this;
		return funcentry_go(f);
	};
	Func.prototype.Entry = function() { return this.go$val.Entry(); };
	Func.Ptr.prototype.FileLine = function(pc) {
		var file, line, f, _tuple;
		file = "";
		line = 0;
		f = this;
		_tuple = funcline_go(f, pc), file = _tuple[0], line = _tuple[1];
		return [file, line];
	};
	Func.prototype.FileLine = function(pc) { return this.go$val.FileLine(pc); };
	var funcline_go = function() {
		throw go$panic("Native function not implemented: funcline_go");
	};
	var funcname_go = function() {
		throw go$panic("Native function not implemented: funcname_go");
	};
	var funcentry_go = function() {
		throw go$panic("Native function not implemented: funcentry_go");
	};
	var SetFinalizer = go$pkg.SetFinalizer = function() {};
	var getgoroot = function() {
			return (typeof process !== 'undefined') ? (process.env["GOROOT"] || "") : "/";
		};
	var GOROOT = go$pkg.GOROOT = function() {
		var s;
		s = getgoroot();
		if (!(s === "")) {
			return s;
		}
		return "c:\\go";
	};
	var Version = go$pkg.Version = function() {
		return "go1.2";
	};
	var ReadMemStats = go$pkg.ReadMemStats = function() {};
	var GC = go$pkg.GC = function() {};
	var gc_m_ptr = function(ret) {
		ret.go$set((go$ptrType(m)).nil);
	};
	var gc_itab_ptr = function(ret) {
		ret.go$set((go$ptrType(itab)).nil);
	};
	var funpack64 = function(f) {
		var sign, mant, exp, inf, nan$1, _ref;
		sign = new Go$Uint64(0, 0);
		mant = new Go$Uint64(0, 0);
		exp = 0;
		inf = false;
		nan$1 = false;
		sign = new Go$Uint64(f.high & 2147483648, (f.low & 0) >>> 0);
		mant = new Go$Uint64(f.high & 1048575, (f.low & 4294967295) >>> 0);
		exp = (go$shiftRightUint64(f, 52).low >> 0) & 2047;
		_ref = exp;
		if (_ref === 2047) {
			if (!((mant.high === 0 && mant.low === 0))) {
				nan$1 = true;
				return [sign, mant, exp, inf, nan$1];
			}
			inf = true;
			return [sign, mant, exp, inf, nan$1];
		} else if (_ref === 0) {
			if (!((mant.high === 0 && mant.low === 0))) {
				exp = exp + -1022 >> 0;
				while ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
					mant = go$shiftLeft64(mant, 1);
					exp = exp - 1 >> 0;
				}
			}
		} else {
			mant = new Go$Uint64(mant.high | 1048576, (mant.low | 0) >>> 0);
			exp = exp + -1023 >> 0;
		}
		return [sign, mant, exp, inf, nan$1];
	};
	var funpack32 = function(f) {
		var sign, mant, exp, inf, nan$1, _ref;
		sign = 0;
		mant = 0;
		exp = 0;
		inf = false;
		nan$1 = false;
		sign = (f & 2147483648) >>> 0;
		mant = (f & 8388607) >>> 0;
		exp = ((f >>> 23 >>> 0) >> 0) & 255;
		_ref = exp;
		if (_ref === 255) {
			if (!((mant === 0))) {
				nan$1 = true;
				return [sign, mant, exp, inf, nan$1];
			}
			inf = true;
			return [sign, mant, exp, inf, nan$1];
		} else if (_ref === 0) {
			if (!((mant === 0))) {
				exp = exp + -126 >> 0;
				while (mant < 8388608) {
					mant = mant << 1 >>> 0;
					exp = exp - 1 >> 0;
				}
			}
		} else {
			mant = (mant | 8388608) >>> 0;
			exp = exp + -127 >> 0;
		}
		return [sign, mant, exp, inf, nan$1];
	};
	var fpack64 = function(sign, mant, exp, trunc) {
		var _tuple, mant0, exp0, trunc0, x, x$1, x$2, _tuple$1, x$3, x$4, x$5, x$6, x$7, x$8;
		_tuple = [mant, exp, trunc], mant0 = _tuple[0], exp0 = _tuple[1], trunc0 = _tuple[2];
		if ((mant.high === 0 && mant.low === 0)) {
			return sign;
		}
		while ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
			mant = go$shiftLeft64(mant, 1);
			exp = exp - 1 >> 0;
		}
		while ((mant.high > 4194304 || (mant.high === 4194304 && mant.low >= 0))) {
			trunc = (x = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), new Go$Uint64(trunc.high | x.high, (trunc.low | x.low) >>> 0));
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
		}
		if ((mant.high > 2097152 || (mant.high === 2097152 && mant.low >= 0))) {
			if (!((x$1 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 0))) && (!((trunc.high === 0 && trunc.low === 0)) || !((x$2 = new Go$Uint64(mant.high & 0, (mant.low & 2) >>> 0), (x$2.high === 0 && x$2.low === 0))))) {
				mant = new Go$Uint64(mant.high + 0, mant.low + 1);
				if ((mant.high > 4194304 || (mant.high === 4194304 && mant.low >= 0))) {
					mant = go$shiftRightUint64(mant, 1);
					exp = exp + 1 >> 0;
				}
			}
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
		}
		if (exp >= 1024) {
			return new Go$Uint64(sign.high ^ 2146435072, (sign.low ^ 0) >>> 0);
		}
		if (exp < -1022) {
			if (exp < -1075) {
				return new Go$Uint64(sign.high | 0, (sign.low | 0) >>> 0);
			}
			_tuple$1 = [mant0, exp0, trunc0], mant = _tuple$1[0], exp = _tuple$1[1], trunc = _tuple$1[2];
			while (exp < -1023) {
				trunc = (x$3 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), new Go$Uint64(trunc.high | x$3.high, (trunc.low | x$3.low) >>> 0));
				mant = go$shiftRightUint64(mant, 1);
				exp = exp + 1 >> 0;
			}
			if (!((x$4 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), (x$4.high === 0 && x$4.low === 0))) && (!((trunc.high === 0 && trunc.low === 0)) || !((x$5 = new Go$Uint64(mant.high & 0, (mant.low & 2) >>> 0), (x$5.high === 0 && x$5.low === 0))))) {
				mant = new Go$Uint64(mant.high + 0, mant.low + 1);
			}
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
			if ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
				return new Go$Uint64(sign.high | mant.high, (sign.low | mant.low) >>> 0);
			}
		}
		return (x$6 = (x$7 = go$shiftLeft64(new Go$Uint64(0, (exp - -1023 >> 0)), 52), new Go$Uint64(sign.high | x$7.high, (sign.low | x$7.low) >>> 0)), x$8 = new Go$Uint64(mant.high & 1048575, (mant.low & 4294967295) >>> 0), new Go$Uint64(x$6.high | x$8.high, (x$6.low | x$8.low) >>> 0));
	};
	var fpack32 = function(sign, mant, exp, trunc) {
		var _tuple, mant0, exp0, trunc0, _tuple$1;
		_tuple = [mant, exp, trunc], mant0 = _tuple[0], exp0 = _tuple[1], trunc0 = _tuple[2];
		if (mant === 0) {
			return sign;
		}
		while (mant < 8388608) {
			mant = mant << 1 >>> 0;
			exp = exp - 1 >> 0;
		}
		while (mant >= 33554432) {
			trunc = (trunc | (((mant & 1) >>> 0))) >>> 0;
			mant = mant >>> 1 >>> 0;
			exp = exp + 1 >> 0;
		}
		if (mant >= 16777216) {
			if (!((((mant & 1) >>> 0) === 0)) && (!((trunc === 0)) || !((((mant & 2) >>> 0) === 0)))) {
				mant = mant + 1 >>> 0;
				if (mant >= 33554432) {
					mant = mant >>> 1 >>> 0;
					exp = exp + 1 >> 0;
				}
			}
			mant = mant >>> 1 >>> 0;
			exp = exp + 1 >> 0;
		}
		if (exp >= 128) {
			return (sign ^ 2139095040) >>> 0;
		}
		if (exp < -126) {
			if (exp < -150) {
				return (sign | 0) >>> 0;
			}
			_tuple$1 = [mant0, exp0, trunc0], mant = _tuple$1[0], exp = _tuple$1[1], trunc = _tuple$1[2];
			while (exp < -127) {
				trunc = (trunc | (((mant & 1) >>> 0))) >>> 0;
				mant = mant >>> 1 >>> 0;
				exp = exp + 1 >> 0;
			}
			if (!((((mant & 1) >>> 0) === 0)) && (!((trunc === 0)) || !((((mant & 2) >>> 0) === 0)))) {
				mant = mant + 1 >>> 0;
			}
			mant = mant >>> 1 >>> 0;
			exp = exp + 1 >> 0;
			if (mant < 8388608) {
				return (sign | mant) >>> 0;
			}
		}
		return (((sign | (((exp - -127 >> 0) >>> 0) << 23 >>> 0)) >>> 0) | ((mant & 8388607) >>> 0)) >>> 0;
	};
	var fadd64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, x, _tuple$2, shift, x$1, x$2, trunc, x$3, x$4;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi && !((fs.high === gs.high && fs.low === gs.low))) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi) {
			return f;
		} else if (gi) {
			return g$1;
		} else if ((fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0) && !((fs.high === 0 && fs.low === 0)) && !((gs.high === 0 && gs.low === 0))) {
			return f;
		} else if ((fm.high === 0 && fm.low === 0)) {
			if ((gm.high === 0 && gm.low === 0)) {
				g$1 = (x = gs, new Go$Uint64(g$1.high ^ x.high, (g$1.low ^ x.low) >>> 0));
			}
			return g$1;
		} else if ((gm.high === 0 && gm.low === 0)) {
			return f;
		}
		if (fe < ge || (fe === ge) && (fm.high < gm.high || (fm.high === gm.high && fm.low < gm.low))) {
			_tuple$2 = [g$1, f, gs, gm, ge, fs, fm, fe], f = _tuple$2[0], g$1 = _tuple$2[1], fs = _tuple$2[2], fm = _tuple$2[3], fe = _tuple$2[4], gs = _tuple$2[5], gm = _tuple$2[6], ge = _tuple$2[7];
		}
		shift = ((fe - ge >> 0) >>> 0);
		fm = go$shiftLeft64(fm, 2);
		gm = go$shiftLeft64(gm, 2);
		trunc = (x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), shift), new Go$Uint64(x$2.high - 0, x$2.low - 1)), new Go$Uint64(gm.high & x$1.high, (gm.low & x$1.low) >>> 0));
		gm = go$shiftRightUint64(gm, (shift));
		if ((fs.high === gs.high && fs.low === gs.low)) {
			fm = (x$3 = gm, new Go$Uint64(fm.high + x$3.high, fm.low + x$3.low));
		} else {
			fm = (x$4 = gm, new Go$Uint64(fm.high - x$4.high, fm.low - x$4.low));
			if (!((trunc.high === 0 && trunc.low === 0))) {
				fm = new Go$Uint64(fm.high - 0, fm.low - 1);
			}
		}
		if ((fm.high === 0 && fm.low === 0)) {
			fs = new Go$Uint64(0, 0);
		}
		return fpack64(fs, fm, fe - 2 >> 0, trunc);
	};
	var fsub64 = function(f, g$1) {
		return fadd64(f, fneg64(g$1));
	};
	var fneg64 = function(f) {
		return new Go$Uint64(f.high ^ 2147483648, (f.low ^ 0) >>> 0);
	};
	var fmul64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, _tuple$2, lo, hi, shift, x, x$1, trunc, x$2, x$3, mant;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi) {
			return new Go$Uint64(f.high ^ gs.high, (f.low ^ gs.low) >>> 0);
		} else if (fi && (gm.high === 0 && gm.low === 0) || (fm.high === 0 && fm.low === 0) && gi) {
			return new Go$Uint64(2146435072, 1);
		} else if ((fm.high === 0 && fm.low === 0)) {
			return new Go$Uint64(f.high ^ gs.high, (f.low ^ gs.low) >>> 0);
		} else if ((gm.high === 0 && gm.low === 0)) {
			return new Go$Uint64(g$1.high ^ fs.high, (g$1.low ^ fs.low) >>> 0);
		}
		_tuple$2 = mullu(fm, gm), lo = _tuple$2[0], hi = _tuple$2[1];
		shift = 51;
		trunc = (x = (x$1 = go$shiftLeft64(new Go$Uint64(0, 1), shift), new Go$Uint64(x$1.high - 0, x$1.low - 1)), new Go$Uint64(lo.high & x.high, (lo.low & x.low) >>> 0));
		mant = (x$2 = go$shiftLeft64(hi, ((64 - shift >>> 0))), x$3 = go$shiftRightUint64(lo, shift), new Go$Uint64(x$2.high | x$3.high, (x$2.low | x$3.low) >>> 0));
		return fpack64(new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), mant, (fe + ge >> 0) - 1 >> 0, trunc);
	};
	var fdiv64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, x, x$1, _tuple$2, shift, _tuple$3, q, r;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi) {
			return new Go$Uint64(2146435072, 1);
		} else if (!fi && !gi && (fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0)) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi || !gi && (gm.high === 0 && gm.low === 0)) {
			return (x = new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), new Go$Uint64(x.high ^ 2146435072, (x.low ^ 0) >>> 0));
		} else if (gi || (fm.high === 0 && fm.low === 0)) {
			return (x$1 = new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), new Go$Uint64(x$1.high ^ 0, (x$1.low ^ 0) >>> 0));
		}
		_tuple$2 = [fi, fn, gi, gn];
		shift = 54;
		_tuple$3 = divlu(go$shiftRightUint64(fm, ((64 - shift >>> 0))), go$shiftLeft64(fm, shift), gm), q = _tuple$3[0], r = _tuple$3[1];
		return fpack64(new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), q, (fe - ge >> 0) - 2 >> 0, r);
	};
	var f64to32 = function(f) {
		var _tuple, fs, fm, fe, fi, fn, fs32;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fn) {
			return 2139095041;
		}
		fs32 = (go$shiftRightUint64(fs, 32).low >>> 0);
		if (fi) {
			return (fs32 ^ 2139095040) >>> 0;
		}
		return fpack32(fs32, (go$shiftRightUint64(fm, 28).low >>> 0), fe - 1 >> 0, (new Go$Uint64(fm.high & 0, (fm.low & 268435455) >>> 0).low >>> 0));
	};
	var f32to64 = function(f) {
		var _tuple, fs, fm, fe, fi, fn, fs64;
		_tuple = funpack32(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fn) {
			return new Go$Uint64(2146435072, 1);
		}
		fs64 = go$shiftLeft64(new Go$Uint64(0, fs), 32);
		if (fi) {
			return new Go$Uint64(fs64.high ^ 2146435072, (fs64.low ^ 0) >>> 0);
		}
		return fpack64(fs64, go$shiftLeft64(new Go$Uint64(0, fm), 29), fe, new Go$Uint64(0, 0));
	};
	var fcmp64 = function(f, g$1) {
		var cmp, isnan, _tuple, fs, fm, fi, fn, _tuple$1, gs, gm, gi, gn, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8;
		cmp = 0;
		isnan = false;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			_tuple$2 = [0, true], cmp = _tuple$2[0], isnan = _tuple$2[1];
			return [cmp, isnan];
		} else if (!fi && !gi && (fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0)) {
			_tuple$3 = [0, false], cmp = _tuple$3[0], isnan = _tuple$3[1];
			return [cmp, isnan];
		} else if ((fs.high > gs.high || (fs.high === gs.high && fs.low > gs.low))) {
			_tuple$4 = [-1, false], cmp = _tuple$4[0], isnan = _tuple$4[1];
			return [cmp, isnan];
		} else if ((fs.high < gs.high || (fs.high === gs.high && fs.low < gs.low))) {
			_tuple$5 = [1, false], cmp = _tuple$5[0], isnan = _tuple$5[1];
			return [cmp, isnan];
		} else if ((fs.high === 0 && fs.low === 0) && (f.high < g$1.high || (f.high === g$1.high && f.low < g$1.low)) || !((fs.high === 0 && fs.low === 0)) && (f.high > g$1.high || (f.high === g$1.high && f.low > g$1.low))) {
			_tuple$6 = [-1, false], cmp = _tuple$6[0], isnan = _tuple$6[1];
			return [cmp, isnan];
		} else if ((fs.high === 0 && fs.low === 0) && (f.high > g$1.high || (f.high === g$1.high && f.low > g$1.low)) || !((fs.high === 0 && fs.low === 0)) && (f.high < g$1.high || (f.high === g$1.high && f.low < g$1.low))) {
			_tuple$7 = [1, false], cmp = _tuple$7[0], isnan = _tuple$7[1];
			return [cmp, isnan];
		}
		_tuple$8 = [0, false], cmp = _tuple$8[0], isnan = _tuple$8[1];
		return [cmp, isnan];
	};
	var f64toint = function(f) {
		var val, ok, _tuple, fs, fm, fe, fi, fn, _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6;
		val = new Go$Int64(0, 0);
		ok = false;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fi || fn) {
			_tuple$1 = [new Go$Int64(0, 0), false], val = _tuple$1[0], ok = _tuple$1[1];
			return [val, ok];
		} else if (fe < -1) {
			_tuple$2 = [new Go$Int64(0, 0), false], val = _tuple$2[0], ok = _tuple$2[1];
			return [val, ok];
		} else if (fe > 63) {
			if (!((fs.high === 0 && fs.low === 0)) && (fm.high === 0 && fm.low === 0)) {
				_tuple$3 = [new Go$Int64(-2147483648, 0), true], val = _tuple$3[0], ok = _tuple$3[1];
				return [val, ok];
			}
			if (!((fs.high === 0 && fs.low === 0))) {
				_tuple$4 = [new Go$Int64(0, 0), false], val = _tuple$4[0], ok = _tuple$4[1];
				return [val, ok];
			}
			_tuple$5 = [new Go$Int64(0, 0), false], val = _tuple$5[0], ok = _tuple$5[1];
			return [val, ok];
		}
		while (fe > 52) {
			fe = fe - 1 >> 0;
			fm = go$shiftLeft64(fm, 1);
		}
		while (fe < 52) {
			fe = fe + 1 >> 0;
			fm = go$shiftRightUint64(fm, 1);
		}
		val = new Go$Int64(fm.high, fm.low);
		if (!((fs.high === 0 && fs.low === 0))) {
			val = new Go$Int64(-val.high, -val.low);
		}
		_tuple$6 = [val, true], val = _tuple$6[0], ok = _tuple$6[1];
		return [val, ok];
	};
	var fintto64 = function(val) {
		var f, x, fs, mant;
		f = new Go$Uint64(0, 0);
		fs = (x = new Go$Uint64(val.high, val.low), new Go$Uint64(x.high & 2147483648, (x.low & 0) >>> 0));
		mant = new Go$Uint64(val.high, val.low);
		if (!((fs.high === 0 && fs.low === 0))) {
			mant = new Go$Uint64(-mant.high, -mant.low);
		}
		f = fpack64(fs, mant, 52, new Go$Uint64(0, 0));
		return f;
	};
	var mullu = function(u, v) {
		var lo, hi, u0, u1, v0, v1, w0, x, x$1, t, w1, w2, x$2, x$3, x$4, x$5, _tuple;
		lo = new Go$Uint64(0, 0);
		hi = new Go$Uint64(0, 0);
		u0 = new Go$Uint64(u.high & 0, (u.low & 4294967295) >>> 0);
		u1 = go$shiftRightUint64(u, 32);
		v0 = new Go$Uint64(v.high & 0, (v.low & 4294967295) >>> 0);
		v1 = go$shiftRightUint64(v, 32);
		w0 = go$mul64(u0, v0);
		t = (x = go$mul64(u1, v0), x$1 = go$shiftRightUint64(w0, 32), new Go$Uint64(x.high + x$1.high, x.low + x$1.low));
		w1 = new Go$Uint64(t.high & 0, (t.low & 4294967295) >>> 0);
		w2 = go$shiftRightUint64(t, 32);
		w1 = (x$2 = go$mul64(u0, v1), new Go$Uint64(w1.high + x$2.high, w1.low + x$2.low));
		_tuple = [go$mul64(u, v), (x$3 = (x$4 = go$mul64(u1, v1), new Go$Uint64(x$4.high + w2.high, x$4.low + w2.low)), x$5 = go$shiftRightUint64(w1, 32), new Go$Uint64(x$3.high + x$5.high, x$3.low + x$5.low))], lo = _tuple[0], hi = _tuple[1];
		return [lo, hi];
	};
	var divlu = function(u1, u0, v) {
		var q, r, _tuple, s, x, vn1, vn0, x$1, x$2, un32, un10, un1, un0, q1, x$3, rhat, x$4, x$5, x$6, x$7, x$8, x$9, x$10, un21, q0, x$11, x$12, x$13, x$14, x$15, x$16, x$17, x$18, x$19, _tuple$1;
		q = new Go$Uint64(0, 0);
		r = new Go$Uint64(0, 0);
		if ((u1.high > v.high || (u1.high === v.high && u1.low >= v.low))) {
			_tuple = [new Go$Uint64(4294967295, 4294967295), new Go$Uint64(4294967295, 4294967295)], q = _tuple[0], r = _tuple[1];
			return [q, r];
		}
		s = 0;
		while ((x = new Go$Uint64(v.high & 2147483648, (v.low & 0) >>> 0), (x.high === 0 && x.low === 0))) {
			s = s + 1 >>> 0;
			v = go$shiftLeft64(v, 1);
		}
		vn1 = go$shiftRightUint64(v, 32);
		vn0 = new Go$Uint64(v.high & 0, (v.low & 4294967295) >>> 0);
		un32 = (x$1 = go$shiftLeft64(u1, s), x$2 = go$shiftRightUint64(u0, ((64 - s >>> 0))), new Go$Uint64(x$1.high | x$2.high, (x$1.low | x$2.low) >>> 0));
		un10 = go$shiftLeft64(u0, s);
		un1 = go$shiftRightUint64(un10, 32);
		un0 = new Go$Uint64(un10.high & 0, (un10.low & 4294967295) >>> 0);
		q1 = go$div64(un32, vn1, false);
		rhat = (x$3 = go$mul64(q1, vn1), new Go$Uint64(un32.high - x$3.high, un32.low - x$3.low));
		if ((q1.high > 1 || (q1.high === 1 && q1.low >= 0)) || (x$4 = go$mul64(q1, vn0), x$5 = (x$6 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$6.high + un1.high, x$6.low + un1.low)), (x$4.high > x$5.high || (x$4.high === x$5.high && x$4.low > x$5.low)))) {
			q1 = new Go$Uint64(q1.high - 0, q1.low - 1);
			rhat = (x$7 = vn1, new Go$Uint64(rhat.high + x$7.high, rhat.low + x$7.low));
			if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {
				go$notSupported("goto");
			}
		}
		un21 = (x$8 = (x$9 = go$mul64(un32, new Go$Uint64(1, 0)), new Go$Uint64(x$9.high + un1.high, x$9.low + un1.low)), x$10 = go$mul64(q1, v), new Go$Uint64(x$8.high - x$10.high, x$8.low - x$10.low));
		q0 = go$div64(un21, vn1, false);
		rhat = (x$11 = go$mul64(q0, vn1), new Go$Uint64(un21.high - x$11.high, un21.low - x$11.low));
		if ((q0.high > 1 || (q0.high === 1 && q0.low >= 0)) || (x$12 = go$mul64(q0, vn0), x$13 = (x$14 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$14.high + un0.high, x$14.low + un0.low)), (x$12.high > x$13.high || (x$12.high === x$13.high && x$12.low > x$13.low)))) {
			q0 = new Go$Uint64(q0.high - 0, q0.low - 1);
			rhat = (x$15 = vn1, new Go$Uint64(rhat.high + x$15.high, rhat.low + x$15.low));
			if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {
				go$notSupported("goto");
			}
		}
		_tuple$1 = [(x$16 = go$mul64(q1, new Go$Uint64(1, 0)), new Go$Uint64(x$16.high + q0.high, x$16.low + q0.low)), go$shiftRightUint64(((x$17 = (x$18 = go$mul64(un21, new Go$Uint64(1, 0)), new Go$Uint64(x$18.high + un0.high, x$18.low + un0.low)), x$19 = go$mul64(q0, v), new Go$Uint64(x$17.high - x$19.high, x$17.low - x$19.low))), s)], q = _tuple$1[0], r = _tuple$1[1];
		return [q, r];
	};
	var fadd64c = function(f, g$1, ret) {
		ret.go$set(fadd64(f, g$1));
	};
	var fsub64c = function(f, g$1, ret) {
		ret.go$set(fsub64(f, g$1));
	};
	var fmul64c = function(f, g$1, ret) {
		ret.go$set(fmul64(f, g$1));
	};
	var fdiv64c = function(f, g$1, ret) {
		ret.go$set(fdiv64(f, g$1));
	};
	var fneg64c = function(f, ret) {
		ret.go$set(fneg64(f));
	};
	var f32to64c = function(f, ret) {
		ret.go$set(f32to64(f));
	};
	var f64to32c = function(f, ret) {
		ret.go$set(f64to32(f));
	};
	var fcmp64c = function(f, g$1, ret, retnan) {
		var _tuple;
		_tuple = fcmp64(f, g$1), ret.go$set(_tuple[0]), retnan.go$set(_tuple[1]);
	};
	var fintto64c = function(val, ret) {
		ret.go$set(fintto64(val));
	};
	var f64tointc = function(f, ret, retok) {
		var _tuple;
		_tuple = f64toint(f), ret.go$set(_tuple[0]), retok.go$set(_tuple[1]);
	};

			go$throwRuntimeError = function(msg) { throw go$panic(new errorString(msg)); };
			sizeof_C_MStats = 3712;
			go$pkg.init = function() {
		go$pkg.MemProfileRate = 524288;
		if (!((sizeof_C_MStats === 3712))) {
			console.log(sizeof_C_MStats, 3712);
			throw go$panic(new Go$String("MStats vs MemStatsType size mismatch"));
		}
	};
	return go$pkg;
})();
go$packages["github.com/neelance/gopherjs/js"] = (function() {
	var go$pkg = {};
	var Object;
	Object = go$newType(0, "Interface", "js.Object", "Object", "github.com/neelance/gopherjs/js", null);
	go$pkg.Object = Object;
	var Error;
	Error = go$newType(0, "Struct", "js.Error", "Error", "github.com/neelance/gopherjs/js", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Error.prototype.Bool = function() { return this.go$val.Bool(); };
	Error.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Error.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Error.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Error.prototype.Float = function() { return this.go$val.Float(); };
	Error.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Error.prototype.Get = function(name) { return this.go$val.Get(name); };
	Error.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Error.prototype.Index = function(i) { return this.go$val.Index(i); };
	Error.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Error.prototype.Int = function() { return this.go$val.Int(); };
	Error.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Error.prototype.Interface = function() { return this.go$val.Interface(); };
	Error.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Error.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Error.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Error.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Error.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Error.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Error.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Error.prototype.Length = function() { return this.go$val.Length(); };
	Error.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Error.prototype.New = function(args) { return this.go$val.New(args); };
	Error.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Error.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Error.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Error.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Error.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Error.prototype.String = function() { return this.go$val.String(); };
	Error.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Error = Error;
	Object.init([["Bool", "", (go$funcType([], [Go$Bool], false))], ["Call", "", (go$funcType([Go$String, (go$sliceType(go$emptyInterface))], [Object], true))], ["Float", "", (go$funcType([], [Go$Float64], false))], ["Get", "", (go$funcType([Go$String], [Object], false))], ["Index", "", (go$funcType([Go$Int], [Object], false))], ["Int", "", (go$funcType([], [Go$Int], false))], ["Interface", "", (go$funcType([], [go$emptyInterface], false))], ["Invoke", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["IsNull", "", (go$funcType([], [Go$Bool], false))], ["IsUndefined", "", (go$funcType([], [Go$Bool], false))], ["Length", "", (go$funcType([], [Go$Int], false))], ["New", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["Set", "", (go$funcType([Go$String, go$emptyInterface], [], false))], ["SetIndex", "", (go$funcType([Go$Int, go$emptyInterface], [], false))], ["String", "", (go$funcType([], [Go$String], false))]]);
	Error.init([["", "", Object, ""]]);
	Error.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [Object], false], ["Index", "", [Go$Int], [Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Error)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true], ["Error", "", [], [Go$String], false], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [Object], false], ["Index", "", [Go$Int], [Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	Error.Ptr.prototype.Error = function() {
		var err;
		err = this;
		return "JavaScript error: " + go$internalize(err.Object.message, Go$String);
	};
	Error.prototype.Error = function() { return this.go$val.Error(); };
	var Global = go$pkg.Global = function(name) {
		return null;
	};
	var This = go$pkg.This = function() {
		return null;
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["github.com/rusco/jquery"] = (function() {
	var go$pkg = {};
	var js = go$packages["github.com/neelance/gopherjs/js"];
	var JQuery;
	JQuery = go$newType(0, "Struct", "jquery.JQuery", "JQuery", "github.com/rusco/jquery", function(o_) {
		this.go$val = this;
		this.o = o_ !== undefined ? o_ : null;
	});
	go$pkg.JQuery = JQuery;
	var EventContext;
	EventContext = go$newType(0, "Struct", "jquery.EventContext", "EventContext", "github.com/rusco/jquery", function(Object_, This_, KeyCode_, Target_, Data_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.This = This_ !== undefined ? This_ : null;
		this.KeyCode = KeyCode_ !== undefined ? KeyCode_ : 0;
		this.Target = Target_ !== undefined ? Target_ : 0;
		this.Data = Data_ !== undefined ? Data_ : null;
	});
	EventContext.prototype.Bool = function() { return this.go$val.Bool(); };
	EventContext.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	EventContext.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	EventContext.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	EventContext.prototype.Float = function() { return this.go$val.Float(); };
	EventContext.Ptr.prototype.Float = function() { return this.Object.Float(); };
	EventContext.prototype.Get = function(name) { return this.go$val.Get(name); };
	EventContext.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	EventContext.prototype.Index = function(i) { return this.go$val.Index(i); };
	EventContext.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	EventContext.prototype.Int = function() { return this.go$val.Int(); };
	EventContext.Ptr.prototype.Int = function() { return this.Object.Int(); };
	EventContext.prototype.Interface = function() { return this.go$val.Interface(); };
	EventContext.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	EventContext.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	EventContext.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	EventContext.prototype.IsNull = function() { return this.go$val.IsNull(); };
	EventContext.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	EventContext.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	EventContext.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	EventContext.prototype.Length = function() { return this.go$val.Length(); };
	EventContext.Ptr.prototype.Length = function() { return this.Object.Length(); };
	EventContext.prototype.New = function(args) { return this.go$val.New(args); };
	EventContext.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	EventContext.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	EventContext.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	EventContext.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	EventContext.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	EventContext.prototype.String = function() { return this.go$val.String(); };
	EventContext.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.EventContext = EventContext;
	JQuery.init([["o", "github.com/rusco/jquery", js.Object, ""]]);
	(go$ptrType(JQuery)).methods = [["Add", "", [Go$String], [(go$ptrType(JQuery))], false], ["AddClass", "", [Go$String], [(go$ptrType(JQuery))], false], ["AddContext", "", [Go$String, go$emptyInterface], [(go$ptrType(JQuery))], false], ["AddElems", "", [(go$sliceType(go$emptyInterface))], [(go$ptrType(JQuery))], true], ["AddHtml", "", [Go$String], [(go$ptrType(JQuery))], false], ["AddJquery", "", [JQuery], [(go$ptrType(JQuery))], false], ["AppendTo", "", [Go$String], [(go$ptrType(JQuery))], false], ["Attr", "", [Go$String], [Go$String], false], ["Blur", "", [], [(go$ptrType(JQuery))], false], ["Clone", "", [], [(go$ptrType(JQuery))], false], ["CloneDeep", "", [Go$Bool, Go$Bool], [(go$ptrType(JQuery))], false], ["CloneWithDataAndEvents", "", [Go$Bool], [(go$ptrType(JQuery))], false], ["Closest", "", [Go$String], [(go$ptrType(JQuery))], false], ["Css", "", [Go$String], [Go$String], false], ["Data", "", [Go$String], [Go$String], false], ["End", "", [], [(go$ptrType(JQuery))], false], ["Find", "", [Go$String], [(go$ptrType(JQuery))], false], ["Focus", "", [], [(go$ptrType(JQuery))], false], ["Hide", "", [], [(go$ptrType(JQuery))], false], ["Html", "", [], [Go$String], false], ["HtmlFn", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [(go$ptrType(JQuery))], false], ["Jquery", "", [], [Go$String], false], ["Length", "", [], [Go$Int], false], ["Next", "", [], [(go$ptrType(JQuery))], false], ["NextSelector", "", [Go$String], [(go$ptrType(JQuery))], false], ["Off", "", [Go$String, (go$funcType([], [], false))], [(go$ptrType(JQuery))], false], ["On", "", [Go$String, (go$funcType([(go$ptrType(EventContext))], [], false))], [(go$ptrType(JQuery))], false], ["OnSelector", "", [Go$String, Go$String, (go$funcType([(go$ptrType(EventContext))], [], false))], [(go$ptrType(JQuery))], false], ["One", "", [Go$String, (go$funcType([(go$ptrType(EventContext))], [], false))], [(go$ptrType(JQuery))], false], ["Prop", "", [Go$String], [Go$Bool], false], ["RemoveClass", "", [Go$String], [(go$ptrType(JQuery))], false], ["Selector", "", [], [Go$String], false], ["SetCss", "", [go$emptyInterface, go$emptyInterface], [(go$ptrType(JQuery))], false], ["SetHtml", "", [Go$String], [(go$ptrType(JQuery))], false], ["SetProp", "", [Go$String, Go$Bool], [(go$ptrType(JQuery))], false], ["SetText", "", [Go$String], [(go$ptrType(JQuery))], false], ["SetVal", "", [Go$String], [(go$ptrType(JQuery))], false], ["Show", "", [], [(go$ptrType(JQuery))], false], ["Size", "", [], [Go$Int], false], ["Text", "", [], [Go$String], false], ["TextFn", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [(go$ptrType(JQuery))], false], ["Toggle", "", [Go$Bool], [(go$ptrType(JQuery))], false], ["ToggleClass", "", [Go$Bool], [(go$ptrType(JQuery))], false], ["ToggleClassName", "", [Go$String, Go$Bool], [(go$ptrType(JQuery))], false], ["Val", "", [], [Go$String], false], ["addBack", "github.com/rusco/jquery", [], [(go$ptrType(JQuery))], false], ["addBackSelector", "github.com/rusco/jquery", [Go$String], [(go$ptrType(JQuery))], false], ["serialize", "github.com/rusco/jquery", [], [Go$String], false]];
	EventContext.init([["", "", js.Object, ""], ["This", "", js.Object, ""], ["KeyCode", "", Go$Int, "js \"keyCode\""], ["Target", "", Go$Int, "js \"target\""], ["Data", "", go$emptyInterface, "js \"data\""]]);
	EventContext.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(EventContext)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	var NewJQuery = go$pkg.NewJQuery = function(args) {
		var _slice, _index, jQ, _slice$1, _index$1, _slice$2, _index$2, jQ$1;
		if (args.length === 1) {
			jQ = new go$global.jQuery(go$externalize((_slice = args, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), Go$String));
			return new JQuery.Ptr(jQ);
		} else if (args.length === 2) {
			jQ$1 = new go$global.jQuery(go$externalize((_slice$1 = args, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), Go$String), go$externalize((_slice$2 = args, _index$2 = 1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), Go$String));
			return new JQuery.Ptr(jQ$1);
		} else {
			return new JQuery.Ptr(new go$global.jQuery());
		}
	};
	var NewJQueryFromObject = go$pkg.NewJQueryFromObject = function(o) {
		var jQ;
		jQ = new go$global.jQuery(o);
		return new JQuery.Ptr(jQ);
	};
	var Trim = go$pkg.Trim = function(text) {
		return go$internalize(go$global.jQuery.trim(go$externalize(text, Go$String)), Go$String);
	};
	JQuery.Ptr.prototype.Jquery = function() {
		var j;
		j = this;
		return go$internalize(j.o.jquery, Go$String);
	};
	JQuery.prototype.Jquery = function() { return this.go$val.Jquery(); };
	JQuery.Ptr.prototype.Length = function() {
		var j;
		j = this;
		return go$parseInt(j.o.length) >> 0;
	};
	JQuery.prototype.Length = function() { return this.go$val.Length(); };
	JQuery.Ptr.prototype.Size = function() {
		var j;
		j = this;
		return go$parseInt(j.o.size) >> 0;
	};
	JQuery.prototype.Size = function() { return this.go$val.Size(); };
	JQuery.Ptr.prototype.Selector = function() {
		var j;
		j = this;
		return go$internalize(j.o.selector, Go$String);
	};
	JQuery.prototype.Selector = function() { return this.go$val.Selector(); };
	JQuery.Ptr.prototype.serialize = function() {
		var j;
		j = this;
		return go$internalize(j.o.serialize(), Go$String);
	};
	JQuery.prototype.serialize = function() { return this.go$val.serialize(); };
	JQuery.Ptr.prototype.addBack = function() {
		var j;
		j = this;
		j.o = j.o.addBack();
		return j;
	};
	JQuery.prototype.addBack = function() { return this.go$val.addBack(); };
	JQuery.Ptr.prototype.addBackSelector = function(selector) {
		var j;
		j = this;
		j.o = j.o.addBack(go$externalize(selector, Go$String));
		return j;
	};
	JQuery.prototype.addBackSelector = function(selector) { return this.go$val.addBackSelector(selector); };
	JQuery.Ptr.prototype.Css = function(name) {
		var j;
		j = this;
		return go$internalize(j.o.css(go$externalize(name, Go$String)), Go$String);
	};
	JQuery.prototype.Css = function(name) { return this.go$val.Css(name); };
	JQuery.Ptr.prototype.SetCss = function(name, value) {
		var j;
		j = this;
		j.o.css(go$externalize(name, go$emptyInterface), go$externalize(value, go$emptyInterface));
		return j;
	};
	JQuery.prototype.SetCss = function(name, value) { return this.go$val.SetCss(name, value); };
	JQuery.Ptr.prototype.Text = function() {
		var j;
		j = this;
		return go$internalize(j.o.text(), Go$String);
	};
	JQuery.prototype.Text = function() { return this.go$val.Text(); };
	JQuery.Ptr.prototype.SetText = function(name) {
		var j;
		j = this;
		j.o.text(go$externalize(name, Go$String));
		return j;
	};
	JQuery.prototype.SetText = function(name) { return this.go$val.SetText(name); };
	JQuery.Ptr.prototype.Val = function() {
		var j;
		j = this;
		return go$internalize(j.o.val(), Go$String);
	};
	JQuery.prototype.Val = function() { return this.go$val.Val(); };
	JQuery.Ptr.prototype.SetVal = function(name) {
		var j;
		j = this;
		j.o.val(go$externalize(name, Go$String));
		return j;
	};
	JQuery.prototype.SetVal = function(name) { return this.go$val.SetVal(name); };
	JQuery.Ptr.prototype.Prop = function(property) {
		var j;
		j = this;
		return !!(j.o.prop(go$externalize(property, Go$String)));
	};
	JQuery.prototype.Prop = function(property) { return this.go$val.Prop(property); };
	JQuery.Ptr.prototype.SetProp = function(name, value) {
		var j;
		j = this;
		j.o.prop(go$externalize(name, Go$String), go$externalize(value, Go$Bool));
		return j;
	};
	JQuery.prototype.SetProp = function(name, value) { return this.go$val.SetProp(name, value); };
	JQuery.Ptr.prototype.Attr = function(property) {
		var j;
		j = this;
		return go$internalize(j.o.attr(go$externalize(property, Go$String)), Go$String);
	};
	JQuery.prototype.Attr = function(property) { return this.go$val.Attr(property); };
	JQuery.Ptr.prototype.AddClass = function(property) {
		var j;
		j = this;
		j.o.addClass(go$externalize(property, Go$String));
		return j;
	};
	JQuery.prototype.AddClass = function(property) { return this.go$val.AddClass(property); };
	JQuery.Ptr.prototype.RemoveClass = function(property) {
		var j;
		j = this;
		j.o.removeClass(go$externalize(property, Go$String));
		return j;
	};
	JQuery.prototype.RemoveClass = function(property) { return this.go$val.RemoveClass(property); };
	JQuery.Ptr.prototype.ToggleClassName = function(className, swtch) {
		var j;
		j = this;
		j.o.toggleClass(go$externalize(className, Go$String), go$externalize(swtch, Go$Bool));
		return j;
	};
	JQuery.prototype.ToggleClassName = function(className, swtch) { return this.go$val.ToggleClassName(className, swtch); };
	JQuery.Ptr.prototype.ToggleClass = function(swtch) {
		var j;
		j = this;
		j.o.toggleClass(go$externalize(swtch, Go$Bool));
		return j;
	};
	JQuery.prototype.ToggleClass = function(swtch) { return this.go$val.ToggleClass(swtch); };
	JQuery.Ptr.prototype.Focus = function() {
		var j;
		j = this;
		j.o.focus();
		return j;
	};
	JQuery.prototype.Focus = function() { return this.go$val.Focus(); };
	JQuery.Ptr.prototype.Blur = function() {
		var j;
		j = this;
		j.o.blur();
		return j;
	};
	JQuery.prototype.Blur = function() { return this.go$val.Blur(); };
	JQuery.Ptr.prototype.On = function(event, handler) {
		var j;
		j = this;
		j.o.on(go$externalize(event, Go$String), go$externalize((function(e) {
			var evCtx;
			evCtx = new EventContext.Ptr(e, this, 0, 0, null);
			handler(evCtx);
		}), (go$funcType([js.Object], [], false))));
		return j;
	};
	JQuery.prototype.On = function(event, handler) { return this.go$val.On(event, handler); };
	JQuery.Ptr.prototype.OnSelector = function(event, selector, handler) {
		var j;
		j = this;
		j.o.on(go$externalize(event, Go$String), go$externalize(selector, Go$String), go$externalize((function(e) {
			var evCtx;
			evCtx = new EventContext.Ptr(e, this, 0, 0, null);
			handler(evCtx);
		}), (go$funcType([js.Object], [], false))));
		return j;
	};
	JQuery.prototype.OnSelector = function(event, selector, handler) { return this.go$val.OnSelector(event, selector, handler); };
	JQuery.Ptr.prototype.One = function(event, handler) {
		var j;
		j = this;
		j.o.one(go$externalize(event, Go$String), go$externalize((function(e) {
			var evCtx;
			evCtx = new EventContext.Ptr(e, this, 0, 0, null);
			handler(evCtx);
		}), (go$funcType([js.Object], [], false))));
		return j;
	};
	JQuery.prototype.One = function(event, handler) { return this.go$val.One(event, handler); };
	JQuery.Ptr.prototype.Off = function(event, handler) {
		var j;
		j = this;
		j.o.off(go$externalize(event, Go$String), go$externalize((function() {
			handler();
		}), (go$funcType([], [], false))));
		return j;
	};
	JQuery.prototype.Off = function(event, handler) { return this.go$val.Off(event, handler); };
	JQuery.Ptr.prototype.AppendTo = function(destination) {
		var j;
		j = this;
		j.o.appendTo(go$externalize(destination, Go$String));
		return j;
	};
	JQuery.prototype.AppendTo = function(destination) { return this.go$val.AppendTo(destination); };
	JQuery.Ptr.prototype.Toggle = function(showOrHide) {
		var j;
		j = this;
		j.o.toggle(go$externalize(showOrHide, Go$Bool));
		return j;
	};
	JQuery.prototype.Toggle = function(showOrHide) { return this.go$val.Toggle(showOrHide); };
	JQuery.Ptr.prototype.Show = function() {
		var j;
		j = this;
		j.o.show();
		return j;
	};
	JQuery.prototype.Show = function() { return this.go$val.Show(); };
	JQuery.Ptr.prototype.Hide = function() {
		var j;
		j = this;
		j.o.hide();
		return j;
	};
	JQuery.prototype.Hide = function() { return this.go$val.Hide(); };
	JQuery.Ptr.prototype.Html = function() {
		var j;
		j = this;
		return go$internalize(j.o.html(), Go$String);
	};
	JQuery.prototype.Html = function() { return this.go$val.Html(); };
	JQuery.Ptr.prototype.SetHtml = function(html) {
		var j;
		j = this;
		j.o.html(go$externalize(html, Go$String));
		return j;
	};
	JQuery.prototype.SetHtml = function(html) { return this.go$val.SetHtml(html); };
	JQuery.Ptr.prototype.HtmlFn = function(fn) {
		var j;
		j = this;
		j.o.html(go$externalize((function(idx, txt) {
			return fn(idx, txt);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return j;
	};
	JQuery.prototype.HtmlFn = function(fn) { return this.go$val.HtmlFn(fn); };
	JQuery.Ptr.prototype.TextFn = function(fn) {
		var j;
		j = this;
		j.o.text(go$externalize((function(idx, txt) {
			return fn(idx, txt);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return j;
	};
	JQuery.prototype.TextFn = function(fn) { return this.go$val.TextFn(fn); };
	JQuery.Ptr.prototype.Find = function(selector) {
		var j, found;
		j = this;
		found = j.o.find(go$externalize(selector, Go$String));
		return new JQuery.Ptr(found);
	};
	JQuery.prototype.Find = function(selector) { return this.go$val.Find(selector); };
	JQuery.Ptr.prototype.Closest = function(selector) {
		var j, closest;
		j = this;
		closest = j.o.closest(go$externalize(selector, Go$String));
		return new JQuery.Ptr(closest);
	};
	JQuery.prototype.Closest = function(selector) { return this.go$val.Closest(selector); };
	JQuery.Ptr.prototype.End = function() {
		var j;
		j = this;
		j.o = j.o.end();
		return j;
	};
	JQuery.prototype.End = function() { return this.go$val.End(); };
	JQuery.Ptr.prototype.Data = function(key) {
		var j;
		j = this;
		return go$internalize(j.o.data(go$externalize(key, Go$String)), Go$String);
	};
	JQuery.prototype.Data = function(key) { return this.go$val.Data(key); };
	JQuery.Ptr.prototype.Add = function(selector) {
		var j;
		j = this;
		j.o = j.o.add(go$externalize(selector, Go$String));
		return j;
	};
	JQuery.prototype.Add = function(selector) { return this.go$val.Add(selector); };
	JQuery.Ptr.prototype.AddContext = function(selector, context) {
		var j;
		j = this;
		j.o = j.o.add(go$externalize(selector, Go$String), go$externalize(context, go$emptyInterface));
		return j;
	};
	JQuery.prototype.AddContext = function(selector, context) { return this.go$val.AddContext(selector, context); };
	JQuery.Ptr.prototype.AddElems = function(elements) {
		var j, obj;
		j = this;
		j.o = (obj = j.o, obj.add.apply(obj, go$externalize(elements, (go$sliceType(go$emptyInterface)))));
		return j;
	};
	JQuery.prototype.AddElems = function(elements) { return this.go$val.AddElems(elements); };
	JQuery.Ptr.prototype.AddHtml = function(html) {
		var j;
		j = this;
		j.o = j.o.add(go$externalize(html, Go$String));
		return j;
	};
	JQuery.prototype.AddHtml = function(html) { return this.go$val.AddHtml(html); };
	JQuery.Ptr.prototype.AddJquery = function(obj) {
		var j;
		j = this;
		j.o = j.o.add(go$externalize(obj, JQuery));
		return j;
	};
	JQuery.prototype.AddJquery = function(obj) { return this.go$val.AddJquery(obj); };
	JQuery.Ptr.prototype.Clone = function() {
		var j;
		j = this;
		j.o = j.o.clone();
		return j;
	};
	JQuery.prototype.Clone = function() { return this.go$val.Clone(); };
	JQuery.Ptr.prototype.CloneWithDataAndEvents = function(withDataAndEvents) {
		var j;
		j = this;
		j.o = j.o.clone(go$externalize(withDataAndEvents, Go$Bool));
		return j;
	};
	JQuery.prototype.CloneWithDataAndEvents = function(withDataAndEvents) { return this.go$val.CloneWithDataAndEvents(withDataAndEvents); };
	JQuery.Ptr.prototype.CloneDeep = function(withDataAndEvents, deepWithDataAndEvents) {
		var j;
		j = this;
		j.o = j.o.clone(go$externalize(withDataAndEvents, Go$Bool), go$externalize(deepWithDataAndEvents, Go$Bool));
		return j;
	};
	JQuery.prototype.CloneDeep = function(withDataAndEvents, deepWithDataAndEvents) { return this.go$val.CloneDeep(withDataAndEvents, deepWithDataAndEvents); };
	JQuery.Ptr.prototype.Next = function() {
		var j;
		j = this;
		j.o = j.o.next();
		return j;
	};
	JQuery.prototype.Next = function() { return this.go$val.Next(); };
	JQuery.Ptr.prototype.NextSelector = function(selector) {
		var j;
		j = this;
		j.o = j.o.next(go$externalize(selector, Go$String));
		return j;
	};
	JQuery.prototype.NextSelector = function(selector) { return this.go$val.NextSelector(selector); };
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["github.com/rusco/qunit"] = (function() {
	var go$pkg = {};
	var js = go$packages["github.com/neelance/gopherjs/js"];
	var QUnitAssert;
	QUnitAssert = go$newType(0, "Struct", "qunit.QUnitAssert", "QUnitAssert", "github.com/rusco/qunit", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	QUnitAssert.prototype.Bool = function() { return this.go$val.Bool(); };
	QUnitAssert.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	QUnitAssert.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	QUnitAssert.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	QUnitAssert.prototype.Float = function() { return this.go$val.Float(); };
	QUnitAssert.Ptr.prototype.Float = function() { return this.Object.Float(); };
	QUnitAssert.prototype.Get = function(name) { return this.go$val.Get(name); };
	QUnitAssert.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	QUnitAssert.prototype.Index = function(i) { return this.go$val.Index(i); };
	QUnitAssert.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	QUnitAssert.prototype.Int = function() { return this.go$val.Int(); };
	QUnitAssert.Ptr.prototype.Int = function() { return this.Object.Int(); };
	QUnitAssert.prototype.Interface = function() { return this.go$val.Interface(); };
	QUnitAssert.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	QUnitAssert.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	QUnitAssert.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	QUnitAssert.prototype.IsNull = function() { return this.go$val.IsNull(); };
	QUnitAssert.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	QUnitAssert.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	QUnitAssert.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	QUnitAssert.prototype.Length = function() { return this.go$val.Length(); };
	QUnitAssert.Ptr.prototype.Length = function() { return this.Object.Length(); };
	QUnitAssert.prototype.New = function(args) { return this.go$val.New(args); };
	QUnitAssert.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	QUnitAssert.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	QUnitAssert.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	QUnitAssert.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	QUnitAssert.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	QUnitAssert.prototype.String = function() { return this.go$val.String(); };
	QUnitAssert.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.QUnitAssert = QUnitAssert;
	var DoneCallbackObject;
	DoneCallbackObject = go$newType(0, "Struct", "qunit.DoneCallbackObject", "DoneCallbackObject", "github.com/rusco/qunit", function(Object_, Failed_, Passed_, Total_, Runtime_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.Failed = Failed_ !== undefined ? Failed_ : 0;
		this.Passed = Passed_ !== undefined ? Passed_ : 0;
		this.Total = Total_ !== undefined ? Total_ : 0;
		this.Runtime = Runtime_ !== undefined ? Runtime_ : 0;
	});
	DoneCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	DoneCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	DoneCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	DoneCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	DoneCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	DoneCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	DoneCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	DoneCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	DoneCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	DoneCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	DoneCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	DoneCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	DoneCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	DoneCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	DoneCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	DoneCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	DoneCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	DoneCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	DoneCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	DoneCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	DoneCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	DoneCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	DoneCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	DoneCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	DoneCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	DoneCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	DoneCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	DoneCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	DoneCallbackObject.prototype.String = function() { return this.go$val.String(); };
	DoneCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.DoneCallbackObject = DoneCallbackObject;
	var LogCallbackObject;
	LogCallbackObject = go$newType(0, "Struct", "qunit.LogCallbackObject", "LogCallbackObject", "github.com/rusco/qunit", function(Object_, result_, actual_, expected_, message_, source_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.result = result_ !== undefined ? result_ : false;
		this.actual = actual_ !== undefined ? actual_ : null;
		this.expected = expected_ !== undefined ? expected_ : null;
		this.message = message_ !== undefined ? message_ : "";
		this.source = source_ !== undefined ? source_ : "";
	});
	LogCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	LogCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	LogCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	LogCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	LogCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	LogCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	LogCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	LogCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	LogCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	LogCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	LogCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	LogCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	LogCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	LogCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	LogCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	LogCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	LogCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	LogCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	LogCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	LogCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	LogCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	LogCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	LogCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	LogCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	LogCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	LogCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	LogCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	LogCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	LogCallbackObject.prototype.String = function() { return this.go$val.String(); };
	LogCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.LogCallbackObject = LogCallbackObject;
	var ModuleStartCallbackObject;
	ModuleStartCallbackObject = go$newType(0, "Struct", "qunit.ModuleStartCallbackObject", "ModuleStartCallbackObject", "github.com/rusco/qunit", function(Object_, name_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
	});
	ModuleStartCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	ModuleStartCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	ModuleStartCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	ModuleStartCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	ModuleStartCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	ModuleStartCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	ModuleStartCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	ModuleStartCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	ModuleStartCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	ModuleStartCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	ModuleStartCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	ModuleStartCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	ModuleStartCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	ModuleStartCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	ModuleStartCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	ModuleStartCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	ModuleStartCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	ModuleStartCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	ModuleStartCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	ModuleStartCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	ModuleStartCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	ModuleStartCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	ModuleStartCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	ModuleStartCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	ModuleStartCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	ModuleStartCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	ModuleStartCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	ModuleStartCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	ModuleStartCallbackObject.prototype.String = function() { return this.go$val.String(); };
	ModuleStartCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.ModuleStartCallbackObject = ModuleStartCallbackObject;
	var ModuleDoneCallbackObject;
	ModuleDoneCallbackObject = go$newType(0, "Struct", "qunit.ModuleDoneCallbackObject", "ModuleDoneCallbackObject", "github.com/rusco/qunit", function(Object_, name_, failed_, passed_, total_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
		this.failed = failed_ !== undefined ? failed_ : 0;
		this.passed = passed_ !== undefined ? passed_ : 0;
		this.total = total_ !== undefined ? total_ : 0;
	});
	ModuleDoneCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	ModuleDoneCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	ModuleDoneCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	ModuleDoneCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	ModuleDoneCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	ModuleDoneCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	ModuleDoneCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	ModuleDoneCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	ModuleDoneCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	ModuleDoneCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	ModuleDoneCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	ModuleDoneCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	ModuleDoneCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	ModuleDoneCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	ModuleDoneCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	ModuleDoneCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	ModuleDoneCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	ModuleDoneCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	ModuleDoneCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	ModuleDoneCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	ModuleDoneCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	ModuleDoneCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	ModuleDoneCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	ModuleDoneCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	ModuleDoneCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	ModuleDoneCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	ModuleDoneCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	ModuleDoneCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	ModuleDoneCallbackObject.prototype.String = function() { return this.go$val.String(); };
	ModuleDoneCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.ModuleDoneCallbackObject = ModuleDoneCallbackObject;
	var TestDoneCallbackObject;
	TestDoneCallbackObject = go$newType(0, "Struct", "qunit.TestDoneCallbackObject", "TestDoneCallbackObject", "github.com/rusco/qunit", function(Object_, name_, module_, failed_, passed_, total_, duration_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
		this.module = module_ !== undefined ? module_ : "";
		this.failed = failed_ !== undefined ? failed_ : 0;
		this.passed = passed_ !== undefined ? passed_ : 0;
		this.total = total_ !== undefined ? total_ : 0;
		this.duration = duration_ !== undefined ? duration_ : 0;
	});
	TestDoneCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	TestDoneCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	TestDoneCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	TestDoneCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	TestDoneCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	TestDoneCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	TestDoneCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	TestDoneCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	TestDoneCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	TestDoneCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	TestDoneCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	TestDoneCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	TestDoneCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	TestDoneCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	TestDoneCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	TestDoneCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	TestDoneCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	TestDoneCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	TestDoneCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	TestDoneCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	TestDoneCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	TestDoneCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	TestDoneCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	TestDoneCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	TestDoneCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	TestDoneCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	TestDoneCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	TestDoneCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	TestDoneCallbackObject.prototype.String = function() { return this.go$val.String(); };
	TestDoneCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.TestDoneCallbackObject = TestDoneCallbackObject;
	var TestStartCallbackObject;
	TestStartCallbackObject = go$newType(0, "Struct", "qunit.TestStartCallbackObject", "TestStartCallbackObject", "github.com/rusco/qunit", function(Object_, name_, module_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
		this.module = module_ !== undefined ? module_ : "";
	});
	TestStartCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	TestStartCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	TestStartCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	TestStartCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	TestStartCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	TestStartCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	TestStartCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	TestStartCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	TestStartCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	TestStartCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	TestStartCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	TestStartCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	TestStartCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	TestStartCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	TestStartCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	TestStartCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	TestStartCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	TestStartCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	TestStartCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	TestStartCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	TestStartCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	TestStartCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	TestStartCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	TestStartCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	TestStartCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	TestStartCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	TestStartCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	TestStartCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	TestStartCallbackObject.prototype.String = function() { return this.go$val.String(); };
	TestStartCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.TestStartCallbackObject = TestStartCallbackObject;
	var Raises;
	Raises = go$newType(0, "Struct", "qunit.Raises", "Raises", "github.com/rusco/qunit", function(Object_, Raises_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.Raises = Raises_ !== undefined ? Raises_ : null;
	});
	Raises.prototype.Bool = function() { return this.go$val.Bool(); };
	Raises.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Raises.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Raises.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Raises.prototype.Float = function() { return this.go$val.Float(); };
	Raises.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Raises.prototype.Get = function(name) { return this.go$val.Get(name); };
	Raises.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Raises.prototype.Index = function(i) { return this.go$val.Index(i); };
	Raises.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Raises.prototype.Int = function() { return this.go$val.Int(); };
	Raises.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Raises.prototype.Interface = function() { return this.go$val.Interface(); };
	Raises.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Raises.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Raises.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Raises.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Raises.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Raises.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Raises.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Raises.prototype.Length = function() { return this.go$val.Length(); };
	Raises.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Raises.prototype.New = function(args) { return this.go$val.New(args); };
	Raises.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Raises.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Raises.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Raises.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Raises.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Raises.prototype.String = function() { return this.go$val.String(); };
	Raises.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Raises = Raises;
	QUnitAssert.init([["", "", js.Object, ""]]);
	QUnitAssert.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["DeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Equal", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["NotDeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotPropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotStrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Ok", "", [go$emptyInterface, Go$String], [go$emptyInterface], false], ["PropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["StrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["String", "", [], [Go$String], false], ["Throws", "", [(go$funcType([], [go$emptyInterface], false)), Go$String], [go$emptyInterface], false], ["ThrowsExpected", "", [(go$funcType([], [go$emptyInterface], false)), go$emptyInterface, Go$String], [go$emptyInterface], false]];
	(go$ptrType(QUnitAssert)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["DeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Equal", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["NotDeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotPropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotStrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Ok", "", [go$emptyInterface, Go$String], [go$emptyInterface], false], ["PropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["StrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["String", "", [], [Go$String], false], ["Throws", "", [(go$funcType([], [go$emptyInterface], false)), Go$String], [go$emptyInterface], false], ["ThrowsExpected", "", [(go$funcType([], [go$emptyInterface], false)), go$emptyInterface, Go$String], [go$emptyInterface], false]];
	DoneCallbackObject.init([["", "", js.Object, ""], ["Failed", "", Go$Int, "js:\"failed\""], ["Passed", "", Go$Int, "js:\"passed\""], ["Total", "", Go$Int, "js:\"total\""], ["Runtime", "", Go$Int, "js:\"runtime\""]]);
	DoneCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(DoneCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	LogCallbackObject.init([["", "", js.Object, ""], ["result", "github.com/rusco/qunit", Go$Bool, "js:\"result\""], ["actual", "github.com/rusco/qunit", js.Object, "js:\"actual\""], ["expected", "github.com/rusco/qunit", js.Object, "js:\"expected\""], ["message", "github.com/rusco/qunit", Go$String, "js:\"message\""], ["source", "github.com/rusco/qunit", Go$String, "js:\"source\""]]);
	LogCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(LogCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	ModuleStartCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""]]);
	ModuleStartCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(ModuleStartCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	ModuleDoneCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""], ["failed", "github.com/rusco/qunit", Go$Int, "js:\"failed\""], ["passed", "github.com/rusco/qunit", Go$Int, "js:\"passed\""], ["total", "github.com/rusco/qunit", Go$Int, "js:\"total\""]]);
	ModuleDoneCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(ModuleDoneCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	TestDoneCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""], ["module", "github.com/rusco/qunit", Go$String, "js:\"module\""], ["failed", "github.com/rusco/qunit", Go$Int, "js:\"failed\""], ["passed", "github.com/rusco/qunit", Go$Int, "js:\"passed\""], ["total", "github.com/rusco/qunit", Go$Int, "js:\"total\""], ["duration", "github.com/rusco/qunit", Go$Int, "js:\"duration\""]]);
	TestDoneCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(TestDoneCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	TestStartCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""], ["module", "github.com/rusco/qunit", Go$String, "js:\"module\""]]);
	TestStartCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(TestStartCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	Raises.init([["", "", js.Object, ""], ["Raises", "", js.Object, "js:\"raises\""]]);
	Raises.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Raises)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
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
	var Test = go$pkg.Test = function(name, testFn) {
		go$global.QUnit.test(go$externalize(name, Go$String), go$externalize((function(e) {
			testFn(new QUnitAssert.Ptr(e));
		}), (go$funcType([js.Object], [], false))));
	};
	var TestExpected = go$pkg.TestExpected = function(title, expected, testFn) {
		var t;
		t = go$global.QUnit.test(go$externalize(title, Go$String), expected, go$externalize((function(e) {
			testFn(new QUnitAssert.Ptr(e));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var Start = go$pkg.Start = function() {
		return go$global.QUnit.start();
	};
	var StartDecrement = go$pkg.StartDecrement = function(decrement) {
		return go$global.QUnit.start(decrement);
	};
	var Stop = go$pkg.Stop = function() {
		return go$global.QUnit.stop();
	};
	var StopIncrement = go$pkg.StopIncrement = function(increment) {
		return go$global.QUnit.stop(increment);
	};
	var Begin = go$pkg.Begin = function(callbackFn) {
		var t;
		t = go$global.QUnit.begin(go$externalize((function() {
			callbackFn();
		}), (go$funcType([], [], false))));
		return t;
	};
	var Done = go$pkg.Done = function(callbackFn) {
		var t;
		t = go$global.QUnit.done(go$externalize((function(e) {
			callbackFn(new DoneCallbackObject.Ptr(e, 0, 0, 0, 0));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var Log = go$pkg.Log = function(callbackFn) {
		var t;
		t = go$global.QUnit.log(go$externalize((function(e) {
			callbackFn(new LogCallbackObject.Ptr(e, false, null, null, "", ""));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var ModuleDone = go$pkg.ModuleDone = function(callbackFn) {
		var t;
		t = go$global.QUnit.moduleDone(go$externalize((function(e) {
			callbackFn(new ModuleDoneCallbackObject.Ptr(e, "", 0, 0, 0));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var ModuleStart = go$pkg.ModuleStart = function(callbackFn) {
		var t;
		t = go$global.QUnit.moduleStart(go$externalize((function(e) {
			callbackFn(go$internalize(e, Go$String));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var TestDone = go$pkg.TestDone = function(callbackFn) {
		var t;
		t = go$global.QUnit.testDone(go$externalize((function(e) {
			callbackFn(new TestDoneCallbackObject.Ptr(e, "", "", 0, 0, 0, 0));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var TestStart = go$pkg.TestStart = function(callbackFn) {
		var t;
		t = go$global.QUnit.testStart(go$externalize((function(e) {
			callbackFn(new TestStartCallbackObject.Ptr(e, "", ""));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var AsyncTestExpected = go$pkg.AsyncTestExpected = function(name, expected, testFn) {
		var t;
		t = go$global.QUnit.asyncTestExpected(go$externalize(name, Go$String), go$externalize(expected, go$emptyInterface), go$externalize((function() {
			testFn();
		}), (go$funcType([], [], false))));
		return t;
	};
	var AsyncTest = go$pkg.AsyncTest = function(name, testFn) {
		var t;
		t = go$global.QUnit.asyncTest(go$externalize(name, Go$String), go$externalize((function() {
			testFn();
		}), (go$funcType([], [], false))));
		return t;
	};
	var Expect = go$pkg.Expect = function(amount) {
		return go$global.QUnit.expect(amount);
	};
	var Equiv = go$pkg.Equiv = function(a, b) {
		return go$global.QUnit.equip(go$externalize(a, go$emptyInterface), go$externalize(b, go$emptyInterface));
	};
	var Module = go$pkg.Module = function(name) {
		return go$global.QUnit.module(go$externalize(name, Go$String));
	};
	var Push = go$pkg.Push = function(result, actual, expected, message) {
		return go$global.QUnit.push(go$externalize(result, go$emptyInterface), go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	var Reset = go$pkg.Reset = function() {
		return go$global.QUnit.reset();
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["main"] = (function() {
	var go$pkg = {};
	var jquery = go$packages["github.com/rusco/jquery"];
	var qunit = go$packages["github.com/rusco/qunit"];
	var main = go$pkg.main = function() {
		qunit.Module("core");
		qunit.Test("jQuery() Object", (function(assert) {
			var jQ, jQ2;
			jQ = jquery.NewJQuery(new (go$sliceType(Go$String))([]));
			assert.Equal(new Go$String(jQ.Jquery()), new Go$String("2.1.0"), "JQuery Version");
			assert.Equal(new Go$Int(jQ.Length()), new Go$Int(0), "jQuery().Length()");
			assert.Equal(new Go$Int(jQ.Size()), new Go$Int(0), "jQuery().Size()");
			jQ2 = jquery.NewJQuery(new (go$sliceType(Go$String))(["body"]));
			assert.Equal(new Go$String(jQ2.Selector()), new Go$String("body"), "jQuery(\"body\").Selector()");
		}));
		qunit.Module("dom");
		qunit.Test("add", (function(assert) {
			var txt;
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p"])).AddClass("wow").Clone().Add("<span>Again</span>").AppendTo("body");
			txt = jquery.NewJQuery(new (go$sliceType(Go$String))(["p#qunit-testresult"])).NextSelector("span").Text();
			console.log("txt = ", txt);
			assert.Equal(new Go$String(txt), new Go$String("Again"), "Clone, Add, AppendTo, Find, Text Functions");
		}));
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$error.implementedBy = [go$packages["github.com/neelance/gopherjs/js"].Error.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString)];
go$packages["runtime"].Error.implementedBy = [go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString)];
go$packages["runtime"].stringer.implementedBy = [go$packages["github.com/neelance/gopherjs/js"].Error, go$packages["github.com/neelance/gopherjs/js"].Error.Ptr, go$packages["github.com/rusco/jquery"].EventContext, go$packages["github.com/rusco/jquery"].EventContext.Ptr, go$packages["github.com/rusco/qunit"].DoneCallbackObject, go$packages["github.com/rusco/qunit"].DoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].LogCallbackObject, go$packages["github.com/rusco/qunit"].LogCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].QUnitAssert, go$packages["github.com/rusco/qunit"].QUnitAssert.Ptr, go$packages["github.com/rusco/qunit"].Raises, go$packages["github.com/rusco/qunit"].Raises.Ptr, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].TestStartCallbackObject, go$packages["github.com/rusco/qunit"].TestStartCallbackObject.Ptr];
go$packages["github.com/neelance/gopherjs/js"].Object.implementedBy = [go$packages["github.com/neelance/gopherjs/js"].Error, go$packages["github.com/neelance/gopherjs/js"].Error.Ptr, go$packages["github.com/rusco/jquery"].EventContext, go$packages["github.com/rusco/jquery"].EventContext.Ptr, go$packages["github.com/rusco/qunit"].DoneCallbackObject, go$packages["github.com/rusco/qunit"].DoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].LogCallbackObject, go$packages["github.com/rusco/qunit"].LogCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].QUnitAssert, go$packages["github.com/rusco/qunit"].QUnitAssert.Ptr, go$packages["github.com/rusco/qunit"].Raises, go$packages["github.com/rusco/qunit"].Raises.Ptr, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].TestStartCallbackObject, go$packages["github.com/rusco/qunit"].TestStartCallbackObject.Ptr];
go$packages["runtime"].init();
go$packages["github.com/neelance/gopherjs/js"].init();
go$packages["github.com/rusco/jquery"].init();
go$packages["github.com/rusco/qunit"].init();
go$packages["main"].init();
go$packages["main"].main();
