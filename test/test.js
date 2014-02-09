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
				go$idCounter++;
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
				go$idCounter++;
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
				for (j = 0; j < methods.length; j++) {
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
			convert = convert || (t.params[i] !== go$packages["github.com/neelance/gopherjs/js"].Object);
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
			throw go$panic("got array with wrong size from JavaScript native");
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
	var sizeof_C_MStats, memStats, precisestack, algarray, startup_random_data, startup_random_data_len, emptystring, zerobase, allg, lastg, allm, allp, gomaxprocs, needextram, panicking, goos, ncpu, iscgo, sysargs, maxstring, hchansize, cpuid_ecx, cpuid_edx, debug, maxstacksize, blockprofilerate, worldsema, nan, posinf, neginf, memstats, class_to_size, class_to_allocnpages, size_to_class8, size_to_class128, checking, m0, g0, extram, newprocs, scavenger, initdone, _cgo_thread_start, prof, experiment, hash, ifacelock, typelink, etypelink, empty_value, hashload;
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
		while (_i < 32) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
			_i++;
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
		while (_i < 32) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
			_i++;
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
		var go$this = this, q, r, _tuple, s, x, vn1, vn0, x$1, x$2, un32, un10, un1, un0, q1, x$3, rhat, x$4, x$5, x$6, x$7, x$8, x$9, x$10, un21, q0, x$11, x$12, x$13, x$14, x$15, x$16, x$17, x$18, x$19, _tuple$1;
		q = new Go$Uint64(0, 0);
		r = new Go$Uint64(0, 0);
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
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
		/* again1: */ case 1:
		/* if ((q1.high > 1 || (q1.high === 1 && q1.low >= 0)) || (x$4 = go$mul64(q1, vn0), x$5 = (x$6 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$6.high + un1.high, x$6.low + un1.low)), (x$4.high > x$5.high || (x$4.high === x$5.high && x$4.low > x$5.low)))) { */ if ((q1.high > 1 || (q1.high === 1 && q1.low >= 0)) || (x$4 = go$mul64(q1, vn0), x$5 = (x$6 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$6.high + un1.high, x$6.low + un1.low)), (x$4.high > x$5.high || (x$4.high === x$5.high && x$4.low > x$5.low)))) {} else { go$s = 3; continue; }
			q1 = new Go$Uint64(q1.high - 0, q1.low - 1);
			rhat = (x$7 = vn1, new Go$Uint64(rhat.high + x$7.high, rhat.low + x$7.low));
			/* if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) { */ if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {} else { go$s = 4; continue; }
				/* goto again1 */ go$s = 1; continue;
			/* } */ case 4:
		/* } */ case 3:
		un21 = (x$8 = (x$9 = go$mul64(un32, new Go$Uint64(1, 0)), new Go$Uint64(x$9.high + un1.high, x$9.low + un1.low)), x$10 = go$mul64(q1, v), new Go$Uint64(x$8.high - x$10.high, x$8.low - x$10.low));
		q0 = go$div64(un21, vn1, false);
		rhat = (x$11 = go$mul64(q0, vn1), new Go$Uint64(un21.high - x$11.high, un21.low - x$11.low));
		/* again2: */ case 2:
		/* if ((q0.high > 1 || (q0.high === 1 && q0.low >= 0)) || (x$12 = go$mul64(q0, vn0), x$13 = (x$14 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$14.high + un0.high, x$14.low + un0.low)), (x$12.high > x$13.high || (x$12.high === x$13.high && x$12.low > x$13.low)))) { */ if ((q0.high > 1 || (q0.high === 1 && q0.low >= 0)) || (x$12 = go$mul64(q0, vn0), x$13 = (x$14 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$14.high + un0.high, x$14.low + un0.low)), (x$12.high > x$13.high || (x$12.high === x$13.high && x$12.low > x$13.low)))) {} else { go$s = 5; continue; }
			q0 = new Go$Uint64(q0.high - 0, q0.low - 1);
			rhat = (x$15 = vn1, new Go$Uint64(rhat.high + x$15.high, rhat.low + x$15.low));
			/* if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) { */ if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {} else { go$s = 6; continue; }
				/* goto again2 */ go$s = 2; continue;
			/* } */ case 6:
		/* } */ case 5:
		_tuple$1 = [(x$16 = go$mul64(q1, new Go$Uint64(1, 0)), new Go$Uint64(x$16.high + q0.high, x$16.low + q0.low)), go$shiftRightUint64(((x$17 = (x$18 = go$mul64(un21, new Go$Uint64(1, 0)), new Go$Uint64(x$18.high + un0.high, x$18.low + un0.low)), x$19 = go$mul64(q0, v), new Go$Uint64(x$17.high - x$19.high, x$17.low - x$19.low))), s)], q = _tuple$1[0], r = _tuple$1[1];
		return [q, r];
		/* */ } break; } }; return go$f();
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
	go$pkg.init = function() {
		sizeof_C_MStats = 0;
		memStats = new MemStats.Ptr();
		precisestack = 0;
		algarray = go$makeNativeArray("Struct", 22, function() { return new alg.Ptr(); });
		startup_random_data = (go$ptrType(Go$Uint8)).nil;
		startup_random_data_len = 0;
		emptystring = "";
		zerobase = new Go$Uint64(0, 0);
		allg = (go$ptrType(g)).nil;
		lastg = (go$ptrType(g)).nil;
		allm = (go$ptrType(m)).nil;
		allp = (go$ptrType((go$ptrType(p)))).nil;
		gomaxprocs = 0;
		needextram = 0;
		panicking = 0;
		goos = (go$ptrType(Go$Int8)).nil;
		ncpu = 0;
		iscgo = 0;
		sysargs = go$throwNilPointerError;
		maxstring = new Go$Uint64(0, 0);
		hchansize = 0;
		cpuid_ecx = 0;
		cpuid_edx = 0;
		debug = new debugvars.Ptr();
		maxstacksize = new Go$Uint64(0, 0);
		blockprofilerate = new Go$Int64(0, 0);
		worldsema = 0;
		nan = 0;
		posinf = 0;
		neginf = 0;
		memstats = new mstats.Ptr();
		class_to_size = go$makeNativeArray("Int32", 61, function() { return 0; });
		class_to_allocnpages = go$makeNativeArray("Int32", 61, function() { return 0; });
		size_to_class8 = go$makeNativeArray("Int8", 129, function() { return 0; });
		size_to_class128 = go$makeNativeArray("Int8", 249, function() { return 0; });
		checking = 0;
		m0 = new m.Ptr();
		g0 = new g.Ptr();
		extram = (go$ptrType(m)).nil;
		newprocs = 0;
		scavenger = new funcval.Ptr();
		initdone = new funcval.Ptr();
		_cgo_thread_start = go$throwNilPointerError;
		prof = new _3_.Ptr();
		experiment = go$makeNativeArray("Int8", 0, function() { return 0; });
		hash = go$makeNativeArray("Ptr", 1009, function() { return (go$ptrType(itab)).nil; });
		ifacelock = new lock.Ptr();
		typelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
		etypelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
		empty_value = go$makeNativeArray("Uint8", 128, function() { return 0; });
		hashload = 0;

			go$throwRuntimeError = function(msg) { throw go$panic(new errorString(msg)); };
			sizeof_C_MStats = 3712;
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
	JQuery = go$newType(0, "Struct", "jquery.JQuery", "JQuery", "github.com/rusco/jquery", function(o_, Jquery_, Selector_, Length_) {
		this.go$val = this;
		this.o = o_ !== undefined ? o_ : null;
		this.Jquery = Jquery_ !== undefined ? Jquery_ : "";
		this.Selector = Selector_ !== undefined ? Selector_ : "";
		this.Length = Length_ !== undefined ? Length_ : "";
	});
	go$pkg.JQuery = JQuery;
	var Event;
	Event = go$newType(0, "Struct", "jquery.Event", "Event", "github.com/rusco/jquery", function(Object_, KeyCode_, Target_, Data_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.KeyCode = KeyCode_ !== undefined ? KeyCode_ : 0;
		this.Target = Target_ !== undefined ? Target_ : 0;
		this.Data = Data_ !== undefined ? Data_ : null;
	});
	Event.prototype.Bool = function() { return this.go$val.Bool(); };
	Event.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Event.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Event.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Event.prototype.Float = function() { return this.go$val.Float(); };
	Event.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Event.prototype.Get = function(name) { return this.go$val.Get(name); };
	Event.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Event.prototype.Index = function(i) { return this.go$val.Index(i); };
	Event.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Event.prototype.Int = function() { return this.go$val.Int(); };
	Event.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Event.prototype.Interface = function() { return this.go$val.Interface(); };
	Event.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Event.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Event.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Event.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Event.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Event.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Event.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Event.prototype.Length = function() { return this.go$val.Length(); };
	Event.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Event.prototype.New = function(args) { return this.go$val.New(args); };
	Event.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Event.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Event.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Event.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Event.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Event.prototype.String = function() { return this.go$val.String(); };
	Event.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Event = Event;
	JQuery.init([["o", "github.com/rusco/jquery", js.Object, ""], ["Jquery", "", Go$String, "js:\"jquery\""], ["Selector", "", Go$String, "js:\"selector\""], ["Length", "", Go$String, "js:\"length\""]]);
	JQuery.methods = [["Add", "", [Go$String], [JQuery], false], ["AddByContext", "", [Go$String, go$emptyInterface], [JQuery], false], ["AddClass", "", [Go$String], [JQuery], false], ["AddClassFn", "", [(go$funcType([Go$Int], [Go$String], false))], [JQuery], false], ["AddClassFnClass", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["AddHtml", "", [Go$String], [JQuery], false], ["AddJQuery", "", [JQuery], [JQuery], false], ["AppendTo", "", [Go$String], [JQuery], false], ["AppendToJQuery", "", [JQuery], [JQuery], false], ["Attr", "", [Go$String], [Go$String], false], ["Blur", "", [], [JQuery], false], ["ClearQueue", "", [Go$String], [JQuery], false], ["Clone", "", [], [JQuery], false], ["CloneDeep", "", [Go$Bool, Go$Bool], [JQuery], false], ["CloneWithDataAndEvents", "", [Go$Bool], [JQuery], false], ["Closest", "", [Go$String], [JQuery], false], ["Css", "", [Go$String], [Go$String], false], ["Data", "", [Go$String], [Go$String], false], ["DataByKey", "", [Go$String], [go$emptyInterface], false], ["Dequeue", "", [Go$String], [JQuery], false], ["End", "", [], [JQuery], false], ["Filter", "", [Go$String], [JQuery], false], ["FilterByFunc", "", [(go$funcType([Go$Int], [Go$Int], false))], [JQuery], false], ["FilterByJQuery", "", [JQuery], [JQuery], false], ["Find", "", [Go$String], [JQuery], false], ["FindByJQuery", "", [JQuery], [JQuery], false], ["First", "", [], [JQuery], false], ["Focus", "", [], [JQuery], false], ["Has", "", [Go$String], [JQuery], false], ["Height", "", [], [Go$Int], false], ["Hide", "", [], [JQuery], false], ["Html", "", [], [Go$String], false], ["HtmlByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Is", "", [Go$String], [Go$Bool], false], ["IsByFunc", "", [(go$funcType([Go$Int], [Go$Bool], false))], [JQuery], false], ["IsByJQuery", "", [JQuery], [Go$Bool], false], ["Last", "", [], [JQuery], false], ["Next", "", [], [JQuery], false], ["NextAll", "", [], [JQuery], false], ["NextAllBySelector", "", [Go$String], [JQuery], false], ["NextBySelector", "", [Go$String], [JQuery], false], ["NextUntil", "", [Go$String], [JQuery], false], ["NextUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["NextUntilByJQuery", "", [JQuery], [JQuery], false], ["NextUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Not", "", [Go$String], [JQuery], false], ["NotByJQuery", "", [JQuery], [JQuery], false], ["Off", "", [Go$String, (go$funcType([], [], false))], [JQuery], false], ["OffsetParent", "", [], [JQuery], false], ["On", "", [Go$String, (go$funcType([js.Object, (go$ptrType(Event))], [], false))], [JQuery], false], ["OnSelector", "", [Go$String, Go$String, (go$funcType([js.Object, (go$ptrType(Event))], [], false))], [JQuery], false], ["One", "", [Go$String, (go$funcType([js.Object, (go$ptrType(Event))], [], false))], [JQuery], false], ["Parent", "", [], [JQuery], false], ["ParentBySelector", "", [Go$String], [JQuery], false], ["Parents", "", [], [JQuery], false], ["ParentsBySelector", "", [Go$String], [JQuery], false], ["ParentsUntil", "", [Go$String], [JQuery], false], ["ParentsUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["ParentsUntilByJQuery", "", [JQuery], [JQuery], false], ["ParentsUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prev", "", [], [JQuery], false], ["PrevAll", "", [], [JQuery], false], ["PrevAllBySelector", "", [Go$String], [JQuery], false], ["PrevBySelector", "", [Go$String], [JQuery], false], ["PrevUntil", "", [Go$String], [JQuery], false], ["PrevUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["PrevUntilByJQuery", "", [JQuery], [JQuery], false], ["PrevUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prop", "", [Go$String], [Go$Bool], false], ["RemoveClass", "", [Go$String], [JQuery], false], ["RemoveData", "", [Go$String], [JQuery], false], ["ScrollLeft", "", [], [Go$Int], false], ["ScrollTop", "", [], [Go$Int], false], ["SetCss", "", [go$emptyInterface, go$emptyInterface], [JQuery], false], ["SetData", "", [Go$String, go$emptyInterface], [JQuery], false], ["SetHeight", "", [Go$String], [JQuery], false], ["SetHtml", "", [Go$String], [JQuery], false], ["SetProp", "", [Go$String, Go$Bool], [JQuery], false], ["SetScrollLeft", "", [Go$Int], [JQuery], false], ["SetScrollTop", "", [Go$Int], [JQuery], false], ["SetText", "", [Go$String], [JQuery], false], ["SetVal", "", [Go$String], [JQuery], false], ["SetWidth", "", [Go$String], [JQuery], false], ["Show", "", [], [JQuery], false], ["Siblings", "", [], [JQuery], false], ["SiblingsBySelector", "", [Go$String], [JQuery], false], ["Slice", "", [Go$Int], [JQuery], false], ["SliceByEnd", "", [Go$Int, Go$Int], [JQuery], false], ["Text", "", [], [Go$String], false], ["TextByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Toggle", "", [Go$Bool], [JQuery], false], ["ToggleClass", "", [Go$Bool], [JQuery], false], ["ToggleClassByName", "", [Go$String, Go$Bool], [JQuery], false], ["Val", "", [], [Go$String], false], ["Width", "", [], [Go$Int], false], ["WidthByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["addBack", "github.com/rusco/jquery", [], [JQuery], false], ["addBackBySelector", "github.com/rusco/jquery", [Go$String], [JQuery], false], ["serialize", "github.com/rusco/jquery", [], [Go$String], false]];
	(go$ptrType(JQuery)).methods = [["Add", "", [Go$String], [JQuery], false], ["AddByContext", "", [Go$String, go$emptyInterface], [JQuery], false], ["AddClass", "", [Go$String], [JQuery], false], ["AddClassFn", "", [(go$funcType([Go$Int], [Go$String], false))], [JQuery], false], ["AddClassFnClass", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["AddHtml", "", [Go$String], [JQuery], false], ["AddJQuery", "", [JQuery], [JQuery], false], ["AppendTo", "", [Go$String], [JQuery], false], ["AppendToJQuery", "", [JQuery], [JQuery], false], ["Attr", "", [Go$String], [Go$String], false], ["Blur", "", [], [JQuery], false], ["ClearQueue", "", [Go$String], [JQuery], false], ["Clone", "", [], [JQuery], false], ["CloneDeep", "", [Go$Bool, Go$Bool], [JQuery], false], ["CloneWithDataAndEvents", "", [Go$Bool], [JQuery], false], ["Closest", "", [Go$String], [JQuery], false], ["Css", "", [Go$String], [Go$String], false], ["Data", "", [Go$String], [Go$String], false], ["DataByKey", "", [Go$String], [go$emptyInterface], false], ["Dequeue", "", [Go$String], [JQuery], false], ["End", "", [], [JQuery], false], ["Filter", "", [Go$String], [JQuery], false], ["FilterByFunc", "", [(go$funcType([Go$Int], [Go$Int], false))], [JQuery], false], ["FilterByJQuery", "", [JQuery], [JQuery], false], ["Find", "", [Go$String], [JQuery], false], ["FindByJQuery", "", [JQuery], [JQuery], false], ["First", "", [], [JQuery], false], ["Focus", "", [], [JQuery], false], ["Has", "", [Go$String], [JQuery], false], ["Height", "", [], [Go$Int], false], ["Hide", "", [], [JQuery], false], ["Html", "", [], [Go$String], false], ["HtmlByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Is", "", [Go$String], [Go$Bool], false], ["IsByFunc", "", [(go$funcType([Go$Int], [Go$Bool], false))], [JQuery], false], ["IsByJQuery", "", [JQuery], [Go$Bool], false], ["Last", "", [], [JQuery], false], ["Next", "", [], [JQuery], false], ["NextAll", "", [], [JQuery], false], ["NextAllBySelector", "", [Go$String], [JQuery], false], ["NextBySelector", "", [Go$String], [JQuery], false], ["NextUntil", "", [Go$String], [JQuery], false], ["NextUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["NextUntilByJQuery", "", [JQuery], [JQuery], false], ["NextUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Not", "", [Go$String], [JQuery], false], ["NotByJQuery", "", [JQuery], [JQuery], false], ["Off", "", [Go$String, (go$funcType([], [], false))], [JQuery], false], ["OffsetParent", "", [], [JQuery], false], ["On", "", [Go$String, (go$funcType([js.Object, (go$ptrType(Event))], [], false))], [JQuery], false], ["OnSelector", "", [Go$String, Go$String, (go$funcType([js.Object, (go$ptrType(Event))], [], false))], [JQuery], false], ["One", "", [Go$String, (go$funcType([js.Object, (go$ptrType(Event))], [], false))], [JQuery], false], ["Parent", "", [], [JQuery], false], ["ParentBySelector", "", [Go$String], [JQuery], false], ["Parents", "", [], [JQuery], false], ["ParentsBySelector", "", [Go$String], [JQuery], false], ["ParentsUntil", "", [Go$String], [JQuery], false], ["ParentsUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["ParentsUntilByJQuery", "", [JQuery], [JQuery], false], ["ParentsUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prev", "", [], [JQuery], false], ["PrevAll", "", [], [JQuery], false], ["PrevAllBySelector", "", [Go$String], [JQuery], false], ["PrevBySelector", "", [Go$String], [JQuery], false], ["PrevUntil", "", [Go$String], [JQuery], false], ["PrevUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["PrevUntilByJQuery", "", [JQuery], [JQuery], false], ["PrevUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prop", "", [Go$String], [Go$Bool], false], ["RemoveClass", "", [Go$String], [JQuery], false], ["RemoveData", "", [Go$String], [JQuery], false], ["ScrollLeft", "", [], [Go$Int], false], ["ScrollTop", "", [], [Go$Int], false], ["SetCss", "", [go$emptyInterface, go$emptyInterface], [JQuery], false], ["SetData", "", [Go$String, go$emptyInterface], [JQuery], false], ["SetHeight", "", [Go$String], [JQuery], false], ["SetHtml", "", [Go$String], [JQuery], false], ["SetProp", "", [Go$String, Go$Bool], [JQuery], false], ["SetScrollLeft", "", [Go$Int], [JQuery], false], ["SetScrollTop", "", [Go$Int], [JQuery], false], ["SetText", "", [Go$String], [JQuery], false], ["SetVal", "", [Go$String], [JQuery], false], ["SetWidth", "", [Go$String], [JQuery], false], ["Show", "", [], [JQuery], false], ["Siblings", "", [], [JQuery], false], ["SiblingsBySelector", "", [Go$String], [JQuery], false], ["Slice", "", [Go$Int], [JQuery], false], ["SliceByEnd", "", [Go$Int, Go$Int], [JQuery], false], ["Text", "", [], [Go$String], false], ["TextByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Toggle", "", [Go$Bool], [JQuery], false], ["ToggleClass", "", [Go$Bool], [JQuery], false], ["ToggleClassByName", "", [Go$String, Go$Bool], [JQuery], false], ["Val", "", [], [Go$String], false], ["Width", "", [], [Go$Int], false], ["WidthByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["addBack", "github.com/rusco/jquery", [], [JQuery], false], ["addBackBySelector", "github.com/rusco/jquery", [Go$String], [JQuery], false], ["serialize", "github.com/rusco/jquery", [], [Go$String], false]];
	Event.init([["", "", js.Object, ""], ["KeyCode", "", Go$Int, "js:\"keyCode\""], ["Target", "", Go$Int, "js:\"target\""], ["Data", "", go$emptyInterface, "js:\"data\""]]);
	Event.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Event)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	var NewJQuery = go$pkg.NewJQuery = function(args) {
		var _slice, _index, jQ, _slice$1, _index$1, _slice$2, _index$2, jQ$1;
		if (args.length === 1) {
			jQ = new go$global.jQuery(go$externalize((_slice = args, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), Go$String));
			return new JQuery.Ptr(jQ, "", "", "");
		} else if (args.length === 2) {
			jQ$1 = new go$global.jQuery(go$externalize((_slice$1 = args, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), Go$String), go$externalize((_slice$2 = args, _index$2 = 1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), Go$String));
			return new JQuery.Ptr(jQ$1, "", "", "");
		}
		return new JQuery.Ptr(new go$global.jQuery(), "", "", "");
	};
	var NewJQueryByObject = go$pkg.NewJQueryByObject = function(o) {
		return new JQuery.Ptr(new go$global.jQuery(o), "", "", "");
	};
	var Trim = go$pkg.Trim = function(text) {
		return go$internalize(go$global.jQuery.trim(go$externalize(text, Go$String)), Go$String);
	};
	JQuery.Ptr.prototype.serialize = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.serialize(), Go$String);
	};
	JQuery.prototype.serialize = function() { return this.go$val.serialize(); };
	JQuery.Ptr.prototype.addBack = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.addBack();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.addBack = function() { return this.go$val.addBack(); };
	JQuery.Ptr.prototype.addBackBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.addBack(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.addBackBySelector = function(selector) { return this.go$val.addBackBySelector(selector); };
	JQuery.Ptr.prototype.Css = function(name) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.css(go$externalize(name, Go$String)), Go$String);
	};
	JQuery.prototype.Css = function(name) { return this.go$val.Css(name); };
	JQuery.Ptr.prototype.SetCss = function(name, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.css(go$externalize(name, go$emptyInterface), go$externalize(value, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetCss = function(name, value) { return this.go$val.SetCss(name, value); };
	JQuery.Ptr.prototype.Text = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.text(), Go$String);
	};
	JQuery.prototype.Text = function() { return this.go$val.Text(); };
	JQuery.Ptr.prototype.SetText = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.text(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetText = function(name) { return this.go$val.SetText(name); };
	JQuery.Ptr.prototype.Val = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.val(), Go$String);
	};
	JQuery.prototype.Val = function() { return this.go$val.Val(); };
	JQuery.Ptr.prototype.SetVal = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.val(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetVal = function(name) { return this.go$val.SetVal(name); };
	JQuery.Ptr.prototype.Prop = function(property) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return !!(j.o.prop(go$externalize(property, Go$String)));
	};
	JQuery.prototype.Prop = function(property) { return this.go$val.Prop(property); };
	JQuery.Ptr.prototype.SetProp = function(name, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prop(go$externalize(name, Go$String), go$externalize(value, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetProp = function(name, value) { return this.go$val.SetProp(name, value); };
	JQuery.Ptr.prototype.Attr = function(property) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.attr(go$externalize(property, Go$String)), Go$String);
	};
	JQuery.prototype.Attr = function(property) { return this.go$val.Attr(property); };
	JQuery.Ptr.prototype.AddClass = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.addClass(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AddClass = function(property) { return this.go$val.AddClass(property); };
	JQuery.Ptr.prototype.AddClassFn = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.html(go$externalize((function(idx) {
			return fn(idx);
		}), (go$funcType([Go$Int], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AddClassFn = function(fn) { return this.go$val.AddClassFn(fn); };
	JQuery.Ptr.prototype.AddClassFnClass = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.html(go$externalize((function(idx, class$1) {
			return fn(idx, class$1);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AddClassFnClass = function(fn) { return this.go$val.AddClassFnClass(fn); };
	JQuery.Ptr.prototype.RemoveClass = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.removeClass(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.RemoveClass = function(property) { return this.go$val.RemoveClass(property); };
	JQuery.Ptr.prototype.ToggleClassByName = function(className, swtch) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.toggleClass(go$externalize(className, Go$String), go$externalize(swtch, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ToggleClassByName = function(className, swtch) { return this.go$val.ToggleClassByName(className, swtch); };
	JQuery.Ptr.prototype.ToggleClass = function(swtch) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.toggleClass(go$externalize(swtch, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ToggleClass = function(swtch) { return this.go$val.ToggleClass(swtch); };
	JQuery.Ptr.prototype.Focus = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.focus();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Focus = function() { return this.go$val.Focus(); };
	JQuery.Ptr.prototype.Blur = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.blur();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Blur = function() { return this.go$val.Blur(); };
	JQuery.Ptr.prototype.On = function(event, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.on(go$externalize(event, Go$String), go$externalize((function(e) {
			handler(this, new Event.Ptr(e, 0, 0, null));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.On = function(event, handler) { return this.go$val.On(event, handler); };
	JQuery.Ptr.prototype.OnSelector = function(event, selector, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.on(go$externalize(event, Go$String), go$externalize(selector, Go$String), go$externalize((function(e) {
			handler(this, new Event.Ptr(e, 0, 0, null));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.OnSelector = function(event, selector, handler) { return this.go$val.OnSelector(event, selector, handler); };
	JQuery.Ptr.prototype.One = function(event, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.one(go$externalize(event, Go$String), go$externalize((function(e) {
			handler(this, new Event.Ptr(e, 0, 0, null));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.One = function(event, handler) { return this.go$val.One(event, handler); };
	JQuery.Ptr.prototype.Off = function(event, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.off(go$externalize(event, Go$String), go$externalize((function() {
			handler();
		}), (go$funcType([], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Off = function(event, handler) { return this.go$val.Off(event, handler); };
	JQuery.Ptr.prototype.AppendTo = function(destination) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.appendTo(go$externalize(destination, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AppendTo = function(destination) { return this.go$val.AppendTo(destination); };
	JQuery.Ptr.prototype.AppendToJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.appendTo(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AppendToJQuery = function(obj) { return this.go$val.AppendToJQuery(obj); };
	JQuery.Ptr.prototype.Toggle = function(showOrHide) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.toggle(go$externalize(showOrHide, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Toggle = function(showOrHide) { return this.go$val.Toggle(showOrHide); };
	JQuery.Ptr.prototype.Show = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.show();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Show = function() { return this.go$val.Show(); };
	JQuery.Ptr.prototype.Hide = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.hide();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Hide = function() { return this.go$val.Hide(); };
	JQuery.Ptr.prototype.Html = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.html(), Go$String);
	};
	JQuery.prototype.Html = function() { return this.go$val.Html(); };
	JQuery.Ptr.prototype.SetHtml = function(html) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.html(go$externalize(html, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetHtml = function(html) { return this.go$val.SetHtml(html); };
	JQuery.Ptr.prototype.HtmlByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.html(go$externalize((function(idx, txt) {
			return fn(idx, txt);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.HtmlByFunc = function(fn) { return this.go$val.HtmlByFunc(fn); };
	JQuery.Ptr.prototype.TextByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.text(go$externalize((function(idx, txt) {
			return fn(idx, txt);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.TextByFunc = function(fn) { return this.go$val.TextByFunc(fn); };
	JQuery.Ptr.prototype.Closest = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.closest(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Closest = function(selector) { return this.go$val.Closest(selector); };
	JQuery.Ptr.prototype.End = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.end();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.End = function() { return this.go$val.End(); };
	JQuery.Ptr.prototype.Add = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.add(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Add = function(selector) { return this.go$val.Add(selector); };
	JQuery.Ptr.prototype.AddByContext = function(selector, context) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.add(go$externalize(selector, Go$String), go$externalize(context, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AddByContext = function(selector, context) { return this.go$val.AddByContext(selector, context); };
	JQuery.Ptr.prototype.AddHtml = function(html) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.add(go$externalize(html, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AddHtml = function(html) { return this.go$val.AddHtml(html); };
	JQuery.Ptr.prototype.AddJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.add(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.AddJQuery = function(obj) { return this.go$val.AddJQuery(obj); };
	JQuery.Ptr.prototype.Clone = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.clone();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Clone = function() { return this.go$val.Clone(); };
	JQuery.Ptr.prototype.CloneWithDataAndEvents = function(withDataAndEvents) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.clone(go$externalize(withDataAndEvents, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.CloneWithDataAndEvents = function(withDataAndEvents) { return this.go$val.CloneWithDataAndEvents(withDataAndEvents); };
	JQuery.Ptr.prototype.CloneDeep = function(withDataAndEvents, deepWithDataAndEvents) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.clone(go$externalize(withDataAndEvents, Go$Bool), go$externalize(deepWithDataAndEvents, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.CloneDeep = function(withDataAndEvents, deepWithDataAndEvents) { return this.go$val.CloneDeep(withDataAndEvents, deepWithDataAndEvents); };
	JQuery.Ptr.prototype.Height = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$parseInt(j.o.height()) >> 0;
	};
	JQuery.prototype.Height = function() { return this.go$val.Height(); };
	JQuery.Ptr.prototype.SetHeight = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.height(go$externalize(value, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetHeight = function(value) { return this.go$val.SetHeight(value); };
	JQuery.Ptr.prototype.ScrollLeft = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$parseInt(j.o.scrollLeft()) >> 0;
	};
	JQuery.prototype.ScrollLeft = function() { return this.go$val.ScrollLeft(); };
	JQuery.Ptr.prototype.SetScrollLeft = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.scrollLeft(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetScrollLeft = function(value) { return this.go$val.SetScrollLeft(value); };
	JQuery.Ptr.prototype.ScrollTop = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$parseInt(j.o.scrollTop()) >> 0;
	};
	JQuery.prototype.ScrollTop = function() { return this.go$val.ScrollTop(); };
	JQuery.Ptr.prototype.SetScrollTop = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.scrollTop(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetScrollTop = function(value) { return this.go$val.SetScrollTop(value); };
	JQuery.Ptr.prototype.Width = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$parseInt(j.o.scrollTop()) >> 0;
	};
	JQuery.prototype.Width = function() { return this.go$val.Width(); };
	JQuery.Ptr.prototype.SetWidth = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.scrollTop(go$externalize(value, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetWidth = function(value) { return this.go$val.SetWidth(value); };
	JQuery.Ptr.prototype.WidthByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.width(go$externalize((function(index, width) {
			return fn(index, width);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.WidthByFunc = function(fn) { return this.go$val.WidthByFunc(fn); };
	JQuery.Ptr.prototype.ClearQueue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.clearQueue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ClearQueue = function(queueName) { return this.go$val.ClearQueue(queueName); };
	JQuery.Ptr.prototype.SetData = function(key, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.data(go$externalize(key, Go$String), go$externalize(value, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SetData = function(key, value) { return this.go$val.SetData(key, value); };
	JQuery.Ptr.prototype.DataByKey = function(key) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.data(go$externalize(key, Go$String)), go$emptyInterface);
	};
	JQuery.prototype.DataByKey = function(key) { return this.go$val.DataByKey(key); };
	JQuery.Ptr.prototype.Data = function(key) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return go$internalize(j.o.data(go$externalize(key, Go$String)), Go$String);
	};
	JQuery.prototype.Data = function(key) { return this.go$val.Data(key); };
	JQuery.Ptr.prototype.Dequeue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.dequeue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Dequeue = function(queueName) { return this.go$val.Dequeue(queueName); };
	JQuery.Ptr.prototype.RemoveData = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.removeData(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.RemoveData = function(name) { return this.go$val.RemoveData(name); };
	JQuery.Ptr.prototype.OffsetParent = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.offsetParent();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.OffsetParent = function() { return this.go$val.OffsetParent(); };
	JQuery.Ptr.prototype.Parent = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parent();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Parent = function() { return this.go$val.Parent(); };
	JQuery.Ptr.prototype.ParentBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parent(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ParentBySelector = function(selector) { return this.go$val.ParentBySelector(selector); };
	JQuery.Ptr.prototype.Parents = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parents();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Parents = function() { return this.go$val.Parents(); };
	JQuery.Ptr.prototype.ParentsBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parents(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ParentsBySelector = function(selector) { return this.go$val.ParentsBySelector(selector); };
	JQuery.Ptr.prototype.ParentsUntil = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parentsUntil(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ParentsUntil = function(selector) { return this.go$val.ParentsUntil(selector); };
	JQuery.Ptr.prototype.ParentsUntilByFilter = function(selector, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parentsUntil(go$externalize(selector, Go$String), go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ParentsUntilByFilter = function(selector, filter) { return this.go$val.ParentsUntilByFilter(selector, filter); };
	JQuery.Ptr.prototype.ParentsUntilByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parentsUntil(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ParentsUntilByJQuery = function(obj) { return this.go$val.ParentsUntilByJQuery(obj); };
	JQuery.Ptr.prototype.ParentsUntilByJQueryAndFilter = function(obj, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.parentsUntil(obj.o, go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.ParentsUntilByJQueryAndFilter = function(obj, filter) { return this.go$val.ParentsUntilByJQueryAndFilter(obj, filter); };
	JQuery.Ptr.prototype.Prev = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prev();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Prev = function() { return this.go$val.Prev(); };
	JQuery.Ptr.prototype.PrevBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prev(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.PrevBySelector = function(selector) { return this.go$val.PrevBySelector(selector); };
	JQuery.Ptr.prototype.PrevAll = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prevAll();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.PrevAll = function() { return this.go$val.PrevAll(); };
	JQuery.Ptr.prototype.PrevAllBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prevAll(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.PrevAllBySelector = function(selector) { return this.go$val.PrevAllBySelector(selector); };
	JQuery.Ptr.prototype.PrevUntil = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prevUntil(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.PrevUntil = function(selector) { return this.go$val.PrevUntil(selector); };
	JQuery.Ptr.prototype.PrevUntilByFilter = function(selector, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prevUntil(go$externalize(selector, Go$String), go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.PrevUntilByFilter = function(selector, filter) { return this.go$val.PrevUntilByFilter(selector, filter); };
	JQuery.Ptr.prototype.PrevUntilByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prevUntil(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.PrevUntilByJQuery = function(obj) { return this.go$val.PrevUntilByJQuery(obj); };
	JQuery.Ptr.prototype.PrevUntilByJQueryAndFilter = function(obj, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.prevUntil(obj.o, go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.PrevUntilByJQueryAndFilter = function(obj, filter) { return this.go$val.PrevUntilByJQueryAndFilter(obj, filter); };
	JQuery.Ptr.prototype.Siblings = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.siblings();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Siblings = function() { return this.go$val.Siblings(); };
	JQuery.Ptr.prototype.SiblingsBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.siblings(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SiblingsBySelector = function(selector) { return this.go$val.SiblingsBySelector(selector); };
	JQuery.Ptr.prototype.Slice = function(start) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.slice(start);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Slice = function(start) { return this.go$val.Slice(start); };
	JQuery.Ptr.prototype.SliceByEnd = function(start, end) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.slice(start, end);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.SliceByEnd = function(start, end) { return this.go$val.SliceByEnd(start, end); };
	JQuery.Ptr.prototype.Next = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.next();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Next = function() { return this.go$val.Next(); };
	JQuery.Ptr.prototype.NextBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.next(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NextBySelector = function(selector) { return this.go$val.NextBySelector(selector); };
	JQuery.Ptr.prototype.NextAll = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.nextAll();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NextAll = function() { return this.go$val.NextAll(); };
	JQuery.Ptr.prototype.NextAllBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.nextAll(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NextAllBySelector = function(selector) { return this.go$val.NextAllBySelector(selector); };
	JQuery.Ptr.prototype.NextUntil = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.nextUntil(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NextUntil = function(selector) { return this.go$val.NextUntil(selector); };
	JQuery.Ptr.prototype.NextUntilByFilter = function(selector, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.nextUntil(go$externalize(selector, Go$String), go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NextUntilByFilter = function(selector, filter) { return this.go$val.NextUntilByFilter(selector, filter); };
	JQuery.Ptr.prototype.NextUntilByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.nextUntil(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NextUntilByJQuery = function(obj) { return this.go$val.NextUntilByJQuery(obj); };
	JQuery.Ptr.prototype.NextUntilByJQueryAndFilter = function(obj, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.nextUntil(obj.o, go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NextUntilByJQueryAndFilter = function(obj, filter) { return this.go$val.NextUntilByJQueryAndFilter(obj, filter); };
	JQuery.Ptr.prototype.Not = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.not(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Not = function(selector) { return this.go$val.Not(selector); };
	JQuery.Ptr.prototype.NotByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.not(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.NotByJQuery = function(obj) { return this.go$val.NotByJQuery(obj); };
	JQuery.Ptr.prototype.Filter = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.filter(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Filter = function(selector) { return this.go$val.Filter(selector); };
	JQuery.Ptr.prototype.FilterByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.filter(go$externalize((function(index) {
			return fn(index);
		}), (go$funcType([Go$Int], [Go$Int], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.FilterByFunc = function(fn) { return this.go$val.FilterByFunc(fn); };
	JQuery.Ptr.prototype.FilterByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.filter(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.FilterByJQuery = function(obj) { return this.go$val.FilterByJQuery(obj); };
	JQuery.Ptr.prototype.Find = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.find(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Find = function(selector) { return this.go$val.Find(selector); };
	JQuery.Ptr.prototype.FindByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.find(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.FindByJQuery = function(obj) { return this.go$val.FindByJQuery(obj); };
	JQuery.Ptr.prototype.First = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.first();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.First = function() { return this.go$val.First(); };
	JQuery.Ptr.prototype.Has = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.has(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Has = function(selector) { return this.go$val.Has(selector); };
	JQuery.Ptr.prototype.Is = function(selector) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return !!(j.o.Is(go$externalize(selector, Go$String)));
	};
	JQuery.prototype.Is = function(selector) { return this.go$val.Is(selector); };
	JQuery.Ptr.prototype.IsByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o.width(go$externalize((function(index) {
			return fn(index);
		}), (go$funcType([Go$Int], [Go$Bool], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.IsByFunc = function(fn) { return this.go$val.IsByFunc(fn); };
	JQuery.Ptr.prototype.IsByJQuery = function(obj) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		return !!(j.o.is(obj.o));
	};
	JQuery.prototype.IsByJQuery = function(obj) { return this.go$val.IsByJQuery(obj); };
	JQuery.Ptr.prototype.Last = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
		j.o = j.o.Last();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
	};
	JQuery.prototype.Last = function() { return this.go$val.Last(); };
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
go$packages["errors"] = (function() {
	var go$pkg = {};
	var errorString;
	errorString = go$newType(0, "Struct", "errors.errorString", "errorString", "errors", function(s_) {
		this.go$val = this;
		this.s = s_ !== undefined ? s_ : "";
	});
	go$pkg.errorString = errorString;
	errorString.init([["s", "errors", Go$String, ""]]);
	(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false]];
	var New = go$pkg.New = function(text) {
		return new errorString.Ptr(text);
	};
	errorString.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.s;
	};
	errorString.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["math"] = (function() {
	var go$pkg = {};
	var _gamP, _gamQ, _gamS, p0R8, p0S8, p0R5, p0S5, p0R3, p0S3, p0R2, p0S2, q0R8, q0S8, q0R5, q0S5, q0R3, q0S3, q0R2, q0S2, p1R8, p1S8, p1R5, p1S5, p1R3, p1S3, p1R2, p1S2, q1R8, q1S8, q1R5, q1S5, q1R3, q1S3, q1R2, q1S2, _lgamA, _lgamR, _lgamS, _lgamT, _lgamU, _lgamV, _lgamW, pow10tab, _sin, _cos, _tanP, _tanQ, tanhP, tanhQ;
	var Abs = go$pkg.Abs = Math.abs;
	var abs = function(x) {
		if (x < 0) {
			return -x;
		} else if (x === 0) {
			return 0;
		}
		return x;
	};
	var Acosh = go$pkg.Acosh = function(x) {
		var t;
		if (x < 1 || IsNaN(x)) {
			return NaN();
		} else if (x === 1) {
			return 0;
		} else if (x >= 2.68435456e+08) {
			return Log(x) + 0.6931471805599453;
		} else if (x > 2) {
			return Log(2 * x - 1 / (x + Sqrt(x * x - 1)));
		}
		t = x - 1;
		return Log1p(t + Sqrt(2 * t + t * t));
	};
	var Asin = go$pkg.Asin = Math.asin;
	var asin = function(x) {
		var sign, temp;
		if (x === 0) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x > 1) {
			return NaN();
		}
		temp = Sqrt(1 - x * x);
		if (x > 0.7) {
			temp = 1.5707963267948966 - satan(temp / x);
		} else {
			temp = satan(x / temp);
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Acos = go$pkg.Acos = Math.acos;
	var acos = function(x) {
		return 1.5707963267948966 - Asin(x);
	};
	var Asinh = go$pkg.Asinh = function(x) {
		var sign, temp;
		if (IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		if (x > 2.68435456e+08) {
			temp = Log(x) + 0.6931471805599453;
		} else if (x > 2) {
			temp = Log(2 * x + 1 / (Sqrt(x * x + 1) + x));
		} else if (x < 3.725290298461914e-09) {
			temp = x;
		} else {
			temp = Log1p(x + x * x / (1 + Sqrt(1 + x * x)));
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var xatan = function(x) {
		var z;
		z = x * x;
		z = z * ((((-0.8750608600031904 * z + -16.157537187333652) * z + -75.00855792314705) * z + -122.88666844901361) * z + -64.85021904942025) / (((((z + 24.858464901423062) * z + 165.02700983169885) * z + 432.88106049129027) * z + 485.3903996359137) * z + 194.5506571482614);
		z = x * z + x;
		return z;
	};
	var satan = function(x) {
		if (x <= 0.66) {
			return xatan(x);
		}
		if (x > 2.414213562373095) {
			return 1.5707963267948966 - xatan(1 / x) + 6.123233995736766e-17;
		}
		return 0.7853981633974483 + xatan((x - 1) / (x + 1)) + 3.061616997868383e-17;
	};
	var Atan = go$pkg.Atan = Math.atan;
	var atan = function(x) {
		if (x === 0) {
			return x;
		}
		if (x > 0) {
			return satan(x);
		}
		return -satan(-x);
	};
	var Atan2 = go$pkg.Atan2 = Math.atan2;
	var atan2 = function(y, x) {
		var q;
		if (IsNaN(y) || IsNaN(x)) {
			return NaN();
		} else if (y === 0) {
			if (x >= 0 && !Signbit(x)) {
				return Copysign(0, y);
			}
			return Copysign(3.141592653589793, y);
		} else if (x === 0) {
			return Copysign(1.5707963267948966, y);
		} else if (IsInf(x, 0)) {
			if (IsInf(x, 1)) {
				if (IsInf(y, 0)) {
					return Copysign(0.7853981633974483, y);
				} else {
					return Copysign(0, y);
				}
			}
			if (IsInf(y, 0)) {
				return Copysign(2.356194490192345, y);
			} else {
				return Copysign(3.141592653589793, y);
			}
		} else if (IsInf(y, 0)) {
			return Copysign(1.5707963267948966, y);
		}
		q = Atan(y / x);
		if (x < 0) {
			if (q <= 0) {
				return q + 3.141592653589793;
			}
			return q - 3.141592653589793;
		}
		return q;
	};
	var Atanh = go$pkg.Atanh = function(x) {
		var sign, temp;
		if (x < -1 || x > 1 || IsNaN(x)) {
			return NaN();
		} else if (x === 1) {
			return Inf(1);
		} else if (x === -1) {
			return Inf(-1);
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		if (x < 3.725290298461914e-09) {
			temp = x;
		} else if (x < 0.5) {
			temp = x + x;
			temp = 0.5 * Log1p(temp + temp * x / (1 - x));
		} else {
			temp = 0.5 * Log1p((x + x) / (1 - x));
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Inf = go$pkg.Inf = function(sign) { return sign >= 0 ? 1/0 : -1/0; };
	var NaN = go$pkg.NaN = function() { return 0/0; };
	var IsNaN = go$pkg.IsNaN = function(f) { return f !== f; };
	var IsInf = go$pkg.IsInf = function(f, sign) { if (f === -1/0) { return sign <= 0; } if (f === 1/0) { return sign >= 0; } return false; };
	var normalize = function(x) {
		var y, exp$1, _tuple, _tuple$1;
		y = 0;
		exp$1 = 0;
		if (Abs(x) < 2.2250738585072014e-308) {
			_tuple = [x * 4.503599627370496e+15, -52], y = _tuple[0], exp$1 = _tuple[1];
			return [y, exp$1];
		}
		_tuple$1 = [x, 0], y = _tuple$1[0], exp$1 = _tuple$1[1];
		return [y, exp$1];
	};
	var Cbrt = go$pkg.Cbrt = function(x) {
		var sign, _tuple, f, e, _r, m, _ref, _q, y, s, t;
		if ((x === 0) || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		_tuple = Frexp(x), f = _tuple[0], e = _tuple[1];
		m = (_r = e % 3, _r === _r ? _r : go$throwRuntimeError("integer divide by zero"));
		if (m > 0) {
			m = m - 3 >> 0;
			e = e - (m) >> 0;
		}
		_ref = m;
		if (_ref === 0) {
			f = 0.1662848358 * f + 1.096040958 - 0.4105032829 / (0.5649335816 + f);
		} else if (_ref === -1) {
			f = f * 0.5;
			f = 0.2639607233 * f + 0.8699282849 - 0.1629083358 / (0.2824667908 + f);
		} else {
			f = f * 0.25;
			f = 0.4190115298 * f + 0.6904625373 - 0.0646502159 / (0.1412333954 + f);
		}
		y = Ldexp(f, (_q = e / 3, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")));
		s = y * y * y;
		t = s + x;
		y = y * ((t + x) / (s + t));
		s = (y * y * y - x) / x;
		y = y - (y * ((0.1728395061728395 * s - 0.2222222222222222) * s + 0.3333333333333333) * s);
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Copysign = go$pkg.Copysign = function(x, y) { return (x < 0 || 1/x === 1/-0) !== (y < 0 || 1/y === 1/-0) ? -x : x; };
	var Dim = go$pkg.Dim = function(x, y) { return Math.max(x - y, 0); };
	var dim = function(x, y) {
		return max(x - y, 0);
	};
	var Max = go$pkg.Max = function(x, y) { return (x === 1/0 || y === 1/0) ? 1/0 : Math.max(x, y); };
	var max = function(x, y) {
		if (IsInf(x, 1) || IsInf(y, 1)) {
			return Inf(1);
		} else if (IsNaN(x) || IsNaN(y)) {
			return NaN();
		} else if ((x === 0) && (x === y)) {
			if (Signbit(x)) {
				return y;
			}
			return x;
		}
		if (x > y) {
			return x;
		}
		return y;
	};
	var Min = go$pkg.Min = function(x, y) { return (x === -1/0 || y === -1/0) ? -1/0 : Math.min(x, y); };
	var min = function(x, y) {
		if (IsInf(x, -1) || IsInf(y, -1)) {
			return Inf(-1);
		} else if (IsNaN(x) || IsNaN(y)) {
			return NaN();
		} else if ((x === 0) && (x === y)) {
			if (Signbit(x)) {
				return x;
			}
			return y;
		}
		if (x < y) {
			return x;
		}
		return y;
	};
	var Erf = go$pkg.Erf = function(x) {
		var sign, temp, z, r, s, y, s$1, P, Q, s$2, _tuple, R, S, x$1, z$1, r$1;
		if (IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 1;
		} else if (IsInf(x, -1)) {
			return -1;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x < 0.84375) {
			temp = 0;
			if (x < 3.725290298461914e-09) {
				if (x < 2.848094538889218e-306) {
					temp = 0.125 * (8 * x + 1.0270333367641007 * x);
				} else {
					temp = x + 0.1283791670955126 * x;
				}
			} else {
				z = x * x;
				r = 0.12837916709551256 + z * (-0.3250421072470015 + z * (-0.02848174957559851 + z * (-0.005770270296489442 + z * -2.3763016656650163e-05)));
				s = 1 + z * (0.39791722395915535 + z * (0.0650222499887673 + z * (0.005081306281875766 + z * (0.00013249473800432164 + z * -3.960228278775368e-06))));
				y = r / s;
				temp = x + x * y;
			}
			if (sign) {
				return -temp;
			}
			return temp;
		}
		if (x < 1.25) {
			s$1 = x - 1;
			P = -0.0023621185607526594 + s$1 * (0.41485611868374833 + s$1 * (-0.3722078760357013 + s$1 * (0.31834661990116175 + s$1 * (-0.11089469428239668 + s$1 * (0.035478304325618236 + s$1 * -0.002166375594868791)))));
			Q = 1 + s$1 * (0.10642088040084423 + s$1 * (0.540397917702171 + s$1 * (0.07182865441419627 + s$1 * (0.12617121980876164 + s$1 * (0.01363708391202905 + s$1 * 0.011984499846799107)))));
			if (sign) {
				return -0.8450629115104675 - P / Q;
			}
			return 0.8450629115104675 + P / Q;
		}
		if (x >= 6) {
			if (sign) {
				return -1;
			}
			return 1;
		}
		s$2 = 1 / (x * x);
		_tuple = [0, 0], R = _tuple[0], S = _tuple[1];
		if (x < 2.857142857142857) {
			R = -0.009864944034847148 + s$2 * (-0.6938585727071818 + s$2 * (-10.558626225323291 + s$2 * (-62.375332450326006 + s$2 * (-162.39666946257347 + s$2 * (-184.60509290671104 + s$2 * (-81.2874355063066 + s$2 * -9.814329344169145))))));
			S = 1 + s$2 * (19.651271667439257 + s$2 * (137.65775414351904 + s$2 * (434.56587747522923 + s$2 * (645.3872717332679 + s$2 * (429.00814002756783 + s$2 * (108.63500554177944 + s$2 * (6.570249770319282 + s$2 * -0.0604244152148581)))))));
		} else {
			R = -0.0098649429247001 + s$2 * (-0.799283237680523 + s$2 * (-17.757954917754752 + s$2 * (-160.63638485582192 + s$2 * (-637.5664433683896 + s$2 * (-1025.0951316110772 + s$2 * -483.5191916086514)))));
			S = 1 + s$2 * (30.33806074348246 + s$2 * (325.7925129965739 + s$2 * (1536.729586084437 + s$2 * (3199.8582195085955 + s$2 * (2553.0504064331644 + s$2 * (474.52854120695537 + s$2 * -22.44095244658582))))));
		}
		z$1 = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high & 4294967295, (x$1.low & 0) >>> 0)));
		r$1 = Exp(-z$1 * z$1 - 0.5625) * Exp((z$1 - x) * (z$1 + x) + R / S);
		if (sign) {
			return r$1 / x - 1;
		}
		return 1 - r$1 / x;
	};
	var Erfc = go$pkg.Erfc = function(x) {
		var sign, temp, z, r, s, y, s$1, P, Q, s$2, _tuple, R, S, x$1, z$1, r$1;
		if (IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (IsInf(x, -1)) {
			return 2;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x < 0.84375) {
			temp = 0;
			if (x < 1.3877787807814457e-17) {
				temp = x;
			} else {
				z = x * x;
				r = 0.12837916709551256 + z * (-0.3250421072470015 + z * (-0.02848174957559851 + z * (-0.005770270296489442 + z * -2.3763016656650163e-05)));
				s = 1 + z * (0.39791722395915535 + z * (0.0650222499887673 + z * (0.005081306281875766 + z * (0.00013249473800432164 + z * -3.960228278775368e-06))));
				y = r / s;
				if (x < 0.25) {
					temp = x + x * y;
				} else {
					temp = 0.5 + (x * y + (x - 0.5));
				}
			}
			if (sign) {
				return 1 + temp;
			}
			return 1 - temp;
		}
		if (x < 1.25) {
			s$1 = x - 1;
			P = -0.0023621185607526594 + s$1 * (0.41485611868374833 + s$1 * (-0.3722078760357013 + s$1 * (0.31834661990116175 + s$1 * (-0.11089469428239668 + s$1 * (0.035478304325618236 + s$1 * -0.002166375594868791)))));
			Q = 1 + s$1 * (0.10642088040084423 + s$1 * (0.540397917702171 + s$1 * (0.07182865441419627 + s$1 * (0.12617121980876164 + s$1 * (0.01363708391202905 + s$1 * 0.011984499846799107)))));
			if (sign) {
				return 1.8450629115104675 + P / Q;
			}
			return 0.15493708848953247 - P / Q;
		}
		if (x < 28) {
			s$2 = 1 / (x * x);
			_tuple = [0, 0], R = _tuple[0], S = _tuple[1];
			if (x < 2.857142857142857) {
				R = -0.009864944034847148 + s$2 * (-0.6938585727071818 + s$2 * (-10.558626225323291 + s$2 * (-62.375332450326006 + s$2 * (-162.39666946257347 + s$2 * (-184.60509290671104 + s$2 * (-81.2874355063066 + s$2 * -9.814329344169145))))));
				S = 1 + s$2 * (19.651271667439257 + s$2 * (137.65775414351904 + s$2 * (434.56587747522923 + s$2 * (645.3872717332679 + s$2 * (429.00814002756783 + s$2 * (108.63500554177944 + s$2 * (6.570249770319282 + s$2 * -0.0604244152148581)))))));
			} else {
				if (sign && x > 6) {
					return 2;
				}
				R = -0.0098649429247001 + s$2 * (-0.799283237680523 + s$2 * (-17.757954917754752 + s$2 * (-160.63638485582192 + s$2 * (-637.5664433683896 + s$2 * (-1025.0951316110772 + s$2 * -483.5191916086514)))));
				S = 1 + s$2 * (30.33806074348246 + s$2 * (325.7925129965739 + s$2 * (1536.729586084437 + s$2 * (3199.8582195085955 + s$2 * (2553.0504064331644 + s$2 * (474.52854120695537 + s$2 * -22.44095244658582))))));
			}
			z$1 = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high & 4294967295, (x$1.low & 0) >>> 0)));
			r$1 = Exp(-z$1 * z$1 - 0.5625) * Exp((z$1 - x) * (z$1 + x) + R / S);
			if (sign) {
				return 2 - r$1 / x;
			}
			return r$1 / x;
		}
		if (sign) {
			return 2;
		}
		return 0;
	};
	var Exp = go$pkg.Exp = Math.exp;
	var exp = function(x) {
		var k, hi, lo;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (IsInf(x, -1)) {
			return 0;
		} else if (x > 709.782712893384) {
			return Inf(1);
		} else if (x < -745.1332191019411) {
			return 0;
		} else if (-3.725290298461914e-09 < x && x < 3.725290298461914e-09) {
			return 1 + x;
		}
		k = 0;
		if (x < 0) {
			k = (1.4426950408889634 * x - 0.5 >> 0);
		} else if (x > 0) {
			k = (1.4426950408889634 * x + 0.5 >> 0);
		}
		hi = x - k * 0.6931471803691238;
		lo = k * 1.9082149292705877e-10;
		return expmulti(hi, lo, k);
	};
	var Exp2 = go$pkg.Exp2 = function(x) { return Math.pow(2, x); };
	var exp2 = function(x) {
		var k, t, hi, lo;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (IsInf(x, -1)) {
			return 0;
		} else if (x > 1023.9999999999999) {
			return Inf(1);
		} else if (x < -1074) {
			return 0;
		}
		k = 0;
		if (x > 0) {
			k = (x + 0.5 >> 0);
		} else if (x < 0) {
			k = (x - 0.5 >> 0);
		}
		t = x - k;
		hi = t * 0.6931471803691238;
		lo = -t * 1.9082149292705877e-10;
		return expmulti(hi, lo, k);
	};
	var expmulti = function(hi, lo, k) {
		var r, t, c, y;
		r = hi - lo;
		t = r * r;
		c = r - t * (0.16666666666666602 + t * (-0.0027777777777015593 + t * (6.613756321437934e-05 + t * (-1.6533902205465252e-06 + t * 4.1381367970572385e-08))));
		y = 1 - ((lo - (r * c) / (2 - c)) - hi);
		return Ldexp(y, k);
	};
	var Expm1 = go$pkg.Expm1 = function(x) { return expm1(x); };
	var expm1 = function(x) {
		var absx, sign, c, k, _tuple, hi, lo, t, hfx, hxs, r1, t$1, e, y, x$1, x$2, x$3, t$2, y$1, x$4, x$5, t$3, y$2, x$6, x$7;
		if (IsInf(x, 1) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, -1)) {
			return -1;
		}
		absx = x;
		sign = false;
		if (x < 0) {
			absx = -absx;
			sign = true;
		}
		if (absx >= 38.816242111356935) {
			if (absx >= 709.782712893384) {
				return Inf(1);
			}
			if (sign) {
				return -1;
			}
		}
		c = 0;
		k = 0;
		if (absx > 0.34657359027997264) {
			_tuple = [0, 0], hi = _tuple[0], lo = _tuple[1];
			if (absx < 1.0397207708399179) {
				if (!sign) {
					hi = x - 0.6931471803691238;
					lo = 1.9082149292705877e-10;
					k = 1;
				} else {
					hi = x + 0.6931471803691238;
					lo = -1.9082149292705877e-10;
					k = -1;
				}
			} else {
				if (!sign) {
					k = (1.4426950408889634 * x + 0.5 >> 0);
				} else {
					k = (1.4426950408889634 * x - 0.5 >> 0);
				}
				t = k;
				hi = x - t * 0.6931471803691238;
				lo = t * 1.9082149292705877e-10;
			}
			x = hi - lo;
			c = (hi - x) - lo;
		} else if (absx < 5.551115123125783e-17) {
			return x;
		} else {
			k = 0;
		}
		hfx = 0.5 * x;
		hxs = x * hfx;
		r1 = 1 + hxs * (-0.03333333333333313 + hxs * (0.0015873015872548146 + hxs * (-7.93650757867488e-05 + hxs * (4.008217827329362e-06 + hxs * -2.0109921818362437e-07))));
		t$1 = 3 - r1 * hfx;
		e = hxs * ((r1 - t$1) / (6 - x * t$1));
		if (!((k === 0))) {
			e = x * (e - c) - c;
			e = e - (hxs);
			if (k === -1) {
				return 0.5 * (x - e) - 0.5;
			} else if (k === 1) {
				if (x < -0.25) {
					return -2 * (e - (x + 0.5));
				}
				return 1 + 2 * (x - e);
			} else if (k <= -2 || k > 56) {
				y = 1 - (e - x);
				y = Float64frombits((x$1 = Float64bits(y), x$2 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$1.high + x$2.high, x$1.low + x$2.low)));
				return y - 1;
			}
			if (k < 20) {
				t$2 = Float64frombits((x$3 = go$shiftRightUint64(new Go$Uint64(2097152, 0), (k >>> 0)), new Go$Uint64(1072693248 - x$3.high, 0 - x$3.low)));
				y$1 = t$2 - (e - x);
				y$1 = Float64frombits((x$4 = Float64bits(y$1), x$5 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$4.high + x$5.high, x$4.low + x$5.low)));
				return y$1;
			}
			t$3 = Float64frombits(new Go$Uint64(0, (((1023 - k >> 0)) << 52 >> 0)));
			y$2 = x - (e + t$3);
			y$2 = y$2 + 1;
			y$2 = Float64frombits((x$6 = Float64bits(y$2), x$7 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$6.high + x$7.high, x$6.low + x$7.low)));
			return y$2;
		}
		return x - (x * e - hxs);
	};
	var Floor = go$pkg.Floor = Math.floor;
	var floor = function(x) {
		var _tuple, d, fract, _tuple$1, d$1;
		if ((x === 0) || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		if (x < 0) {
			_tuple = Modf(-x), d = _tuple[0], fract = _tuple[1];
			if (!((fract === 0))) {
				d = d + 1;
			}
			return -d;
		}
		_tuple$1 = Modf(x), d$1 = _tuple$1[0];
		return d$1;
	};
	var Ceil = go$pkg.Ceil = Math.ceil;
	var ceil = function(x) {
		return -Floor(-x);
	};
	var Trunc = go$pkg.Trunc = function(x) { return (x === 1/0 || x === -1/0 || x !== x || 1/x === 1/-0) ? x : x >> 0; };
	var trunc = function(x) {
		var _tuple, d;
		if ((x === 0) || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		_tuple = Modf(x), d = _tuple[0];
		return d;
	};
	var Frexp = go$pkg.Frexp = function(f) { return frexp(f); };
	var frexp = function(f) {
		var frac, exp$1, _tuple, _tuple$1, _tuple$2, x, x$1;
		frac = 0;
		exp$1 = 0;
		if (f === 0) {
			_tuple = [f, 0], frac = _tuple[0], exp$1 = _tuple[1];
			return [frac, exp$1];
		} else if (IsInf(f, 0) || IsNaN(f)) {
			_tuple$1 = [f, 0], frac = _tuple$1[0], exp$1 = _tuple$1[1];
			return [frac, exp$1];
		}
		_tuple$2 = normalize(f), f = _tuple$2[0], exp$1 = _tuple$2[1];
		x = Float64bits(f);
		exp$1 = exp$1 + (((((x$1 = go$shiftRightUint64(x, 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0) - 1023 >> 0) + 1 >> 0)) >> 0;
		x = new Go$Uint64(x.high &~ 2146435072, (x.low &~ 0) >>> 0);
		x = new Go$Uint64(x.high | 1071644672, (x.low | 0) >>> 0);
		frac = Float64frombits(x);
		return [frac, exp$1];
	};
	var stirling = function(x) {
		var w, y, v;
		w = 1 / x;
		w = 1 + w * ((((_gamS[0] * w + _gamS[1]) * w + _gamS[2]) * w + _gamS[3]) * w + _gamS[4]);
		y = Exp(x);
		if (x > 143.01608) {
			v = Pow(x, 0.5 * x - 0.25);
			y = v * (v / y);
		} else {
			y = Pow(x, x - 0.5) / y;
		}
		y = 2.5066282746310007 * y * w;
		return y;
	};
	var Gamma = go$pkg.Gamma = function(x) {
		var go$this = this, q, p, signgam, ip, z, z$1;
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		if (isNegInt(x) || IsInf(x, -1) || IsNaN(x)) {
			return NaN();
		} else if (x === 0) {
			if (Signbit(x)) {
				return Inf(-1);
			}
			return Inf(1);
		} else if (x < -170.5674972726612 || x > 171.61447887182297) {
			return Inf(1);
		}
		q = Abs(x);
		p = Floor(q);
		if (q > 33) {
			if (x >= 0) {
				return stirling(x);
			}
			signgam = 1;
			if (ip = (p >> 0), (ip & 1) === 0) {
				signgam = -1;
			}
			z = q - p;
			if (z > 0.5) {
				p = p + 1;
				z = q - p;
			}
			z = q * Sin(3.141592653589793 * z);
			if (z === 0) {
				return Inf(signgam);
			}
			z = 3.141592653589793 / (Abs(z) * stirling(q));
			return signgam * z;
		}
		z$1 = 1;
		while (x >= 3) {
			x = x - 1;
			z$1 = z$1 * x;
		}
		/* while (x < 0) { */ case 2: if(!(x < 0)) { go$s = 3; continue; }
			/* if (x > -1e-09) { */ if (x > -1e-09) {} else { go$s = 4; continue; }
				/* goto small */ go$s = 1; continue;
			/* } */ case 4:
			z$1 = z$1 / x;
			x = x + 1;
		/* } */ go$s = 2; continue; case 3:
		/* while (x < 2) { */ case 5: if(!(x < 2)) { go$s = 6; continue; }
			/* if (x < 1e-09) { */ if (x < 1e-09) {} else { go$s = 7; continue; }
				/* goto small */ go$s = 1; continue;
			/* } */ case 7:
			z$1 = z$1 / x;
			x = x + 1;
		/* } */ go$s = 5; continue; case 6:
		if (x === 2) {
			return z$1;
		}
		x = x - 2;
		p = (((((x * _gamP[0] + _gamP[1]) * x + _gamP[2]) * x + _gamP[3]) * x + _gamP[4]) * x + _gamP[5]) * x + _gamP[6];
		q = ((((((x * _gamQ[0] + _gamQ[1]) * x + _gamQ[2]) * x + _gamQ[3]) * x + _gamQ[4]) * x + _gamQ[5]) * x + _gamQ[6]) * x + _gamQ[7];
		return z$1 * p / q;
		/* small: */ case 1:
		/* if (x === 0) { */ if (x === 0) {} else { go$s = 8; continue; }
			return Inf(1);
		/* } */ case 8:
		return z$1 / ((1 + 0.5772156649015329 * x) * x);
		/* */ } break; } }; return go$f();
	};
	var isNegInt = function(x) {
		var _tuple, xf;
		if (x < 0) {
			_tuple = Modf(x), xf = _tuple[1];
			return xf === 0;
		}
		return false;
	};
	var Hypot = go$pkg.Hypot = function(p, q) { return hypot(p, q); };
	var hypot = function(p, q) {
		var _tuple;
		if (IsInf(p, 0) || IsInf(q, 0)) {
			return Inf(1);
		} else if (IsNaN(p) || IsNaN(q)) {
			return NaN();
		}
		if (p < 0) {
			p = -p;
		}
		if (q < 0) {
			q = -q;
		}
		if (p < q) {
			_tuple = [q, p], p = _tuple[0], q = _tuple[1];
		}
		if (p === 0) {
			return 0;
		}
		q = q / p;
		return p * Sqrt(1 + q * q);
	};
	var J0 = go$pkg.J0 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, r, s$1, u$1;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return 0;
		} else if (x === 0) {
			return 1;
		}
		if (x < 0) {
			x = -x;
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = s - c;
			cc = s + c;
			if (x < 8.988465674311579e+307) {
				z = -Cos(x + x);
				if (s * c < 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * cc / Sqrt(x);
			} else {
				u = pzero(x);
				v = qzero(x);
				z$1 = 0.5641895835477563 * (u * cc - v * ss) / Sqrt(x);
			}
			return z$1;
		}
		if (x < 0.0001220703125) {
			if (x < 7.450580596923828e-09) {
				return 1;
			}
			return 1 - 0.25 * x * x;
		}
		z$2 = x * x;
		r = z$2 * (0.015624999999999995 + z$2 * (-0.00018997929423885472 + z$2 * (1.8295404953270067e-06 + z$2 * -4.618326885321032e-09)));
		s$1 = 1 + z$2 * (0.015619102946489001 + z$2 * (0.00011692678466333745 + z$2 * (5.135465502073181e-07 + z$2 * 1.1661400333379e-09)));
		if (x < 1) {
			return 1 + z$2 * (-0.25 + (r / s$1));
		}
		u$1 = 0.5 * x;
		return (1 + u$1) * (1 - u$1) + z$2 * (r / s$1);
	};
	var Y0 = go$pkg.Y0 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, u$1, v$1;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (x === 0) {
			return Inf(-1);
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = s - c;
			cc = s + c;
			if (x < 8.988465674311579e+307) {
				z = -Cos(x + x);
				if (s * c < 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * ss / Sqrt(x);
			} else {
				u = pzero(x);
				v = qzero(x);
				z$1 = 0.5641895835477563 * (u * ss + v * cc) / Sqrt(x);
			}
			return z$1;
		}
		if (x <= 7.450580596923828e-09) {
			return -0.07380429510868723 + 0.6366197723675814 * Log(x);
		}
		z$2 = x * x;
		u$1 = -0.07380429510868723 + z$2 * (0.17666645250918112 + z$2 * (-0.01381856719455969 + z$2 * (0.00034745343209368365 + z$2 * (-3.8140705372436416e-06 + z$2 * (1.9559013703502292e-08 + z$2 * -3.982051941321034e-11)))));
		v$1 = 1 + z$2 * (0.01273048348341237 + z$2 * (7.600686273503533e-05 + z$2 * (2.591508518404578e-07 + z$2 * 4.4111031133267547e-10)));
		return u$1 / v$1 + 0.6366197723675814 * J0(x) * Log(x);
	};
	var pzero = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; });
		q = go$makeNativeArray("Float64", 5, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(p0R8, function(entry) { return entry; });
			q = go$mapArray(p0S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(p0R5, function(entry) { return entry; });
			q = go$mapArray(p0S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(p0R3, function(entry) { return entry; });
			q = go$mapArray(p0S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(p0R2, function(entry) { return entry; });
			q = go$mapArray(p0S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * q[4]))));
		return 1 + r / s;
	};
	var qzero = function(x) {
		var _tuple, p, q, z, r, s;
		_tuple = [go$makeNativeArray("Float64", 6, function() { return 0; }), go$makeNativeArray("Float64", 6, function() { return 0; })], p = _tuple[0], q = _tuple[1];
		if (x >= 8) {
			p = go$mapArray(q0R8, function(entry) { return entry; });
			q = go$mapArray(q0S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(q0R5, function(entry) { return entry; });
			q = go$mapArray(q0S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(q0R3, function(entry) { return entry; });
			q = go$mapArray(q0S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(q0R2, function(entry) { return entry; });
			q = go$mapArray(q0S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * (q[4] + z * q[5])))));
		return (-0.125 + r / s) / x;
	};
	var J1 = go$pkg.J1 = function(x) {
		var sign, _tuple, s, c, ss, cc, z, z$1, u, v, z$2, r, s$1;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0) || (x === 0)) {
			return 0;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = -s - c;
			cc = s - c;
			if (x < 8.988465674311579e+307) {
				z = Cos(x + x);
				if (s * c > 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * cc / Sqrt(x);
			} else {
				u = pone(x);
				v = qone(x);
				z$1 = 0.5641895835477563 * (u * cc - v * ss) / Sqrt(x);
			}
			if (sign) {
				return -z$1;
			}
			return z$1;
		}
		if (x < 7.450580596923828e-09) {
			return 0.5 * x;
		}
		z$2 = x * x;
		r = z$2 * (-0.0625 + z$2 * (0.001407056669551897 + z$2 * (-1.599556310840356e-05 + z$2 * 4.9672799960958445e-08)));
		s$1 = 1 + z$2 * (0.019153759953836346 + z$2 * (0.00018594678558863092 + z$2 * (1.1771846404262368e-06 + z$2 * (5.0463625707621704e-09 + z$2 * 1.2354227442613791e-11))));
		r = r * (x);
		z$2 = 0.5 * x + r / s$1;
		if (sign) {
			return -z$2;
		}
		return z$2;
	};
	var Y1 = go$pkg.Y1 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, u$1, v$1;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (x === 0) {
			return Inf(-1);
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = -s - c;
			cc = s - c;
			if (x < 8.988465674311579e+307) {
				z = Cos(x + x);
				if (s * c > 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * ss / Sqrt(x);
			} else {
				u = pone(x);
				v = qone(x);
				z$1 = 0.5641895835477563 * (u * ss + v * cc) / Sqrt(x);
			}
			return z$1;
		}
		if (x <= 5.551115123125783e-17) {
			return -0.6366197723675814 / x;
		}
		z$2 = x * x;
		u$1 = -0.19605709064623894 + z$2 * (0.05044387166398113 + z$2 * (-0.0019125689587576355 + z$2 * (2.352526005616105e-05 + z$2 * -9.190991580398789e-08)));
		v$1 = 1 + z$2 * (0.01991673182366499 + z$2 * (0.00020255258102513517 + z$2 * (1.3560880109751623e-06 + z$2 * (6.227414523646215e-09 + z$2 * 1.6655924620799208e-11))));
		return x * (u$1 / v$1) + 0.6366197723675814 * (J1(x) * Log(x) - 1 / x);
	};
	var pone = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; });
		q = go$makeNativeArray("Float64", 5, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(p1R8, function(entry) { return entry; });
			q = go$mapArray(p1S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(p1R5, function(entry) { return entry; });
			q = go$mapArray(p1S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(p1R3, function(entry) { return entry; });
			q = go$mapArray(p1S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(p1R2, function(entry) { return entry; });
			q = go$mapArray(p1S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * q[4]))));
		return 1 + r / s;
	};
	var qone = function(x) {
		var _tuple, p, q, z, r, s;
		_tuple = [go$makeNativeArray("Float64", 6, function() { return 0; }), go$makeNativeArray("Float64", 6, function() { return 0; })], p = _tuple[0], q = _tuple[1];
		if (x >= 8) {
			p = go$mapArray(q1R8, function(entry) { return entry; });
			q = go$mapArray(q1S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(q1R5, function(entry) { return entry; });
			q = go$mapArray(q1S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(q1R3, function(entry) { return entry; });
			q = go$mapArray(q1S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(q1R2, function(entry) { return entry; });
			q = go$mapArray(q1S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * (q[4] + z * q[5])))));
		return (0.375 + r / s) / x;
	};
	var Jn = go$pkg.Jn = function(n, x) {
		var _tuple, sign, b, temp, _ref, _tuple$1, i, a, _tuple$2, temp$1, a$1, i$1, w, h, q0, z, q1, k, _tuple$3, m, t, x$1, x$2, i$2, a$2, tmp, v, i$3, di, _tuple$4, i$4, di$1, _tuple$5;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return 0;
		}
		if (n === 0) {
			return J0(x);
		}
		if (x === 0) {
			return 0;
		}
		if (n < 0) {
			_tuple = [-n, -x], n = _tuple[0], x = _tuple[1];
		}
		if (n === 1) {
			return J1(x);
		}
		sign = false;
		if (x < 0) {
			x = -x;
			if ((n & 1) === 1) {
				sign = true;
			}
		}
		b = 0;
		if (n <= x) {
			if (x >= 8.148143905337944e+90) {
				temp = 0;
				_ref = n & 3;
				if (_ref === 0) {
					temp = Cos(x) + Sin(x);
				} else if (_ref === 1) {
					temp = -Cos(x) + Sin(x);
				} else if (_ref === 2) {
					temp = -Cos(x) - Sin(x);
				} else if (_ref === 3) {
					temp = Cos(x) - Sin(x);
				}
				b = 0.5641895835477563 * temp / Sqrt(x);
			} else {
				b = J1(x);
				_tuple$1 = [1, J0(x)], i = _tuple$1[0], a = _tuple$1[1];
				while (i < n) {
					_tuple$2 = [b, b * ((i + i >> 0) / x) - a], a = _tuple$2[0], b = _tuple$2[1];
					i = i + 1 >> 0;
				}
			}
		} else {
			if (x < 1.862645149230957e-09) {
				if (n > 33) {
					b = 0;
				} else {
					temp$1 = x * 0.5;
					b = temp$1;
					a$1 = 1;
					i$1 = 2;
					while (i$1 <= n) {
						a$1 = a$1 * (i$1);
						b = b * (temp$1);
						i$1 = i$1 + 1 >> 0;
					}
					b = b / (a$1);
				}
			} else {
				w = (n + n >> 0) / x;
				h = 2 / x;
				q0 = w;
				z = w + h;
				q1 = w * z - 1;
				k = 1;
				while (q1 < 1e+09) {
					k = k + 1 >> 0;
					z = z + (h);
					_tuple$3 = [q1, z * q1 - q0], q0 = _tuple$3[0], q1 = _tuple$3[1];
				}
				m = n + n >> 0;
				t = 0;
				i$2 = (x$1 = 2, x$2 = (n + k >> 0), (((x$1 >>> 16 << 16) * x$2 >> 0) + (x$1 << 16 >>> 16) * x$2) >> 0);
				while (i$2 >= m) {
					t = 1 / (i$2 / x - t);
					i$2 = i$2 - 2 >> 0;
				}
				a$2 = t;
				b = 1;
				tmp = n;
				v = 2 / x;
				tmp = tmp * Log(Abs(v * tmp));
				if (tmp < 709.782712893384) {
					i$3 = n - 1 >> 0;
					while (i$3 > 0) {
						di = (i$3 + i$3 >> 0);
						_tuple$4 = [b, b * di / x - a$2], a$2 = _tuple$4[0], b = _tuple$4[1];
						di = di - 2;
						i$3 = i$3 - 1 >> 0;
					}
				} else {
					i$4 = n - 1 >> 0;
					while (i$4 > 0) {
						di$1 = (i$4 + i$4 >> 0);
						_tuple$5 = [b, b * di$1 / x - a$2], a$2 = _tuple$5[0], b = _tuple$5[1];
						di$1 = di$1 - 2;
						if (b > 1e+100) {
							a$2 = a$2 / (b);
							t = t / (b);
							b = 1;
						}
						i$4 = i$4 - 1 >> 0;
					}
				}
				b = t * J0(x) / b;
			}
		}
		if (sign) {
			return -b;
		}
		return b;
	};
	var Yn = go$pkg.Yn = function(n, x) {
		var sign, b, temp, _ref, a, i, _tuple;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		}
		if (n === 0) {
			return Y0(x);
		}
		if (x === 0) {
			if (n < 0 && ((n & 1) === 1)) {
				return Inf(1);
			}
			return Inf(-1);
		}
		sign = false;
		if (n < 0) {
			n = -n;
			if ((n & 1) === 1) {
				sign = true;
			}
		}
		if (n === 1) {
			if (sign) {
				return -Y1(x);
			}
			return Y1(x);
		}
		b = 0;
		if (x >= 8.148143905337944e+90) {
			temp = 0;
			_ref = n & 3;
			if (_ref === 0) {
				temp = Sin(x) - Cos(x);
			} else if (_ref === 1) {
				temp = -Sin(x) - Cos(x);
			} else if (_ref === 2) {
				temp = -Sin(x) + Cos(x);
			} else if (_ref === 3) {
				temp = Sin(x) + Cos(x);
			}
			b = 0.5641895835477563 * temp / Sqrt(x);
		} else {
			a = Y0(x);
			b = Y1(x);
			i = 1;
			while (i < n && !IsInf(b, -1)) {
				_tuple = [b, ((i + i >> 0) / x) * b - a], a = _tuple[0], b = _tuple[1];
				i = i + 1 >> 0;
			}
		}
		if (sign) {
			return -b;
		}
		return b;
	};
	var Ldexp = go$pkg.Ldexp = function(frac, exp) {
			if (frac === 0) { return frac; }
			if (exp >= 1024) { return frac * Math.pow(2, 1023) * Math.pow(2, exp - 1023); }
			if (exp <= -1024) { return frac * Math.pow(2, -1023) * Math.pow(2, exp + 1023); }
			return frac * Math.pow(2, exp);
		};
	var ldexp = function(frac, exp$1) {
		var _tuple, e, x, m, x$1;
		if (frac === 0) {
			return frac;
		} else if (IsInf(frac, 0) || IsNaN(frac)) {
			return frac;
		}
		_tuple = normalize(frac), frac = _tuple[0], e = _tuple[1];
		exp$1 = exp$1 + (e) >> 0;
		x = Float64bits(frac);
		exp$1 = exp$1 + ((((go$shiftRightUint64(x, 52).low >> 0) & 2047) - 1023 >> 0)) >> 0;
		if (exp$1 < -1074) {
			return Copysign(0, frac);
		}
		if (exp$1 > 1023) {
			if (frac < 0) {
				return Inf(-1);
			}
			return Inf(1);
		}
		m = 1;
		if (exp$1 < -1022) {
			exp$1 = exp$1 + 52 >> 0;
			m = 2.220446049250313e-16;
		}
		x = new Go$Uint64(x.high &~ 2146435072, (x.low &~ 0) >>> 0);
		x = (x$1 = go$shiftLeft64(new Go$Uint64(0, (exp$1 + 1023 >> 0)), 52), new Go$Uint64(x.high | x$1.high, (x.low | x$1.low) >>> 0));
		return m * Float64frombits(x);
	};
	var Lgamma = go$pkg.Lgamma = function(x) {
		var lgamma, sign, neg, nadj, t, y, i, _ref, z, p1, p2, p, z$1, w, p1$1, p2$1, p3, p$1, p1$2, p2$2, i$1, y$1, p$2, q, z$2, _ref$1, t$1, z$3, y$2, w$1;
		lgamma = 0;
		sign = 0;
		sign = 1;
		if (IsNaN(x)) {
			lgamma = x;
			return [lgamma, sign];
		} else if (IsInf(x, 0)) {
			lgamma = x;
			return [lgamma, sign];
		} else if (x === 0) {
			lgamma = Inf(1);
			return [lgamma, sign];
		}
		neg = false;
		if (x < 0) {
			x = -x;
			neg = true;
		}
		if (x < 8.470329472543003e-22) {
			if (neg) {
				sign = -1;
			}
			lgamma = -Log(x);
			return [lgamma, sign];
		}
		nadj = 0;
		if (neg) {
			if (x >= 4.503599627370496e+15) {
				lgamma = Inf(1);
				return [lgamma, sign];
			}
			t = sinPi(x);
			if (t === 0) {
				lgamma = Inf(1);
				return [lgamma, sign];
			}
			nadj = Log(3.141592653589793 / Abs(t * x));
			if (t < 0) {
				sign = -1;
			}
		}
		if ((x === 1) || (x === 2)) {
			lgamma = 0;
			return [lgamma, sign];
		} else if (x < 2) {
			y = 0;
			i = 0;
			if (x <= 0.9) {
				lgamma = -Log(x);
				if (x >= 0.7316321449683623) {
					y = 1 - x;
					i = 0;
				} else if (x >= 0.19163214496836226) {
					y = x - 0.46163214496836225;
					i = 1;
				} else {
					y = x;
					i = 2;
				}
			} else {
				lgamma = 0;
				if (x >= 1.7316321449683623) {
					y = 2 - x;
					i = 0;
				} else if (x >= 1.1916321449683622) {
					y = x - 1.4616321449683622;
					i = 1;
				} else {
					y = x - 1;
					i = 2;
				}
			}
			_ref = i;
			if (_ref === 0) {
				z = y * y;
				p1 = _lgamA[0] + z * (_lgamA[2] + z * (_lgamA[4] + z * (_lgamA[6] + z * (_lgamA[8] + z * _lgamA[10]))));
				p2 = z * (_lgamA[1] + z * (_lgamA[3] + z * (_lgamA[5] + z * (_lgamA[7] + z * (_lgamA[9] + z * _lgamA[11])))));
				p = y * p1 + p2;
				lgamma = lgamma + ((p - 0.5 * y));
			} else if (_ref === 1) {
				z$1 = y * y;
				w = z$1 * y;
				p1$1 = _lgamT[0] + w * (_lgamT[3] + w * (_lgamT[6] + w * (_lgamT[9] + w * _lgamT[12])));
				p2$1 = _lgamT[1] + w * (_lgamT[4] + w * (_lgamT[7] + w * (_lgamT[10] + w * _lgamT[13])));
				p3 = _lgamT[2] + w * (_lgamT[5] + w * (_lgamT[8] + w * (_lgamT[11] + w * _lgamT[14])));
				p$1 = z$1 * p1$1 - (-3.638676997039505e-18 - w * (p2$1 + y * p3));
				lgamma = lgamma + ((-0.12148629053584961 + p$1));
			} else if (_ref === 2) {
				p1$2 = y * (_lgamU[0] + y * (_lgamU[1] + y * (_lgamU[2] + y * (_lgamU[3] + y * (_lgamU[4] + y * _lgamU[5])))));
				p2$2 = 1 + y * (_lgamV[1] + y * (_lgamV[2] + y * (_lgamV[3] + y * (_lgamV[4] + y * _lgamV[5]))));
				lgamma = lgamma + ((-0.5 * y + p1$2 / p2$2));
			}
		} else if (x < 8) {
			i$1 = (x >> 0);
			y$1 = x - i$1;
			p$2 = y$1 * (_lgamS[0] + y$1 * (_lgamS[1] + y$1 * (_lgamS[2] + y$1 * (_lgamS[3] + y$1 * (_lgamS[4] + y$1 * (_lgamS[5] + y$1 * _lgamS[6]))))));
			q = 1 + y$1 * (_lgamR[1] + y$1 * (_lgamR[2] + y$1 * (_lgamR[3] + y$1 * (_lgamR[4] + y$1 * (_lgamR[5] + y$1 * _lgamR[6])))));
			lgamma = 0.5 * y$1 + p$2 / q;
			z$2 = 1;
			_ref$1 = i$1;
			if (_ref$1 === 7) {
				z$2 = z$2 * ((y$1 + 6));
				z$2 = z$2 * ((y$1 + 5));
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 6) {
				z$2 = z$2 * ((y$1 + 5));
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 5) {
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 4) {
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 3) {
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			}
		} else if (x < 2.8823037615171174e+17) {
			t$1 = Log(x);
			z$3 = 1 / x;
			y$2 = z$3 * z$3;
			w$1 = _lgamW[0] + z$3 * (_lgamW[1] + y$2 * (_lgamW[2] + y$2 * (_lgamW[3] + y$2 * (_lgamW[4] + y$2 * (_lgamW[5] + y$2 * _lgamW[6])))));
			lgamma = (x - 0.5) * (t$1 - 1) + w$1;
		} else {
			lgamma = x * (Log(x) - 1);
		}
		if (neg) {
			lgamma = nadj - lgamma;
		}
		return [lgamma, sign];
	};
	var sinPi = function(x) {
		var z, n, x$1, _ref;
		if (x < 0.25) {
			return -Sin(3.141592653589793 * x);
		}
		z = Floor(x);
		n = 0;
		if (!((z === x))) {
			x = Mod(x, 2);
			n = (x * 4 >> 0);
		} else {
			if (x >= 9.007199254740992e+15) {
				x = 0;
				n = 0;
			} else {
				if (x < 4.503599627370496e+15) {
					z = x + 4.503599627370496e+15;
				}
				n = ((x$1 = Float64bits(z), new Go$Uint64(0 & x$1.high, (1 & x$1.low) >>> 0)).low >> 0);
				x = n;
				n = n << 2 >> 0;
			}
		}
		_ref = n;
		if (_ref === 0) {
			x = Sin(3.141592653589793 * x);
		} else if (_ref === 1 || _ref === 2) {
			x = Cos(3.141592653589793 * (0.5 - x));
		} else if (_ref === 3 || _ref === 4) {
			x = Sin(3.141592653589793 * (1 - x));
		} else if (_ref === 5 || _ref === 6) {
			x = -Cos(3.141592653589793 * (x - 1.5));
		} else {
			x = Sin(3.141592653589793 * (x - 2));
		}
		return -x;
	};
	var Log = go$pkg.Log = Math.log;
	var log = function(x) {
		var _tuple, f1, ki, f, k, s, s2, s4, t1, t2, R, hfsq;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (x < 0) {
			return NaN();
		} else if (x === 0) {
			return Inf(-1);
		}
		_tuple = Frexp(x), f1 = _tuple[0], ki = _tuple[1];
		if (f1 < 0.7071067811865476) {
			f1 = f1 * 2;
			ki = ki - 1 >> 0;
		}
		f = f1 - 1;
		k = ki;
		s = f / (2 + f);
		s2 = s * s;
		s4 = s2 * s2;
		t1 = s2 * (0.6666666666666735 + s4 * (0.2857142874366239 + s4 * (0.1818357216161805 + s4 * 0.14798198605116586)));
		t2 = s4 * (0.3999999999940942 + s4 * (0.22222198432149784 + s4 * 0.15313837699209373));
		R = t1 + t2;
		hfsq = 0.5 * f * f;
		return k * 0.6931471803691238 - ((hfsq - (s * (hfsq + R) + k * 1.9082149292705877e-10)) - f);
	};
	var Log10 = go$pkg.Log10 = function(x) { return log10(x); };
	var log10 = function(x) {
		return Log(x) * 0.4342944819032518;
	};
	var Log2 = go$pkg.Log2 = function(x) { return log2(x); };
	var log2 = function(x) {
		var _tuple, frac, exp$1;
		_tuple = Frexp(x), frac = _tuple[0], exp$1 = _tuple[1];
		return Log(frac) * 1.4426950408889634 + exp$1;
	};
	var Log1p = go$pkg.Log1p = function(x) { return log1p(x); };
	var log1p = function(x) {
		var absx, f, iu, k, c, u, x$1, x$2, hfsq, _tuple, s, R, z;
		if (x < -1 || IsNaN(x)) {
			return NaN();
		} else if (x === -1) {
			return Inf(-1);
		} else if (IsInf(x, 1)) {
			return Inf(1);
		}
		absx = x;
		if (absx < 0) {
			absx = -absx;
		}
		f = 0;
		iu = new Go$Uint64(0, 0);
		k = 1;
		if (absx < 0.41421356237309503) {
			if (absx < 1.862645149230957e-09) {
				if (absx < 5.551115123125783e-17) {
					return x;
				}
				return x - x * x * 0.5;
			}
			if (x > -0.2928932188134525) {
				k = 0;
				f = x;
				iu = new Go$Uint64(0, 1);
			}
		}
		c = 0;
		if (!((k === 0))) {
			u = 0;
			if (absx < 9.007199254740992e+15) {
				u = 1 + x;
				iu = Float64bits(u);
				k = ((x$1 = go$shiftRightUint64(iu, 52), new Go$Uint64(x$1.high - 0, x$1.low - 1023)).low >> 0);
				if (k > 0) {
					c = 1 - (u - x);
				} else {
					c = x - (u - 1);
					c = c / (u);
				}
			} else {
				u = x;
				iu = Float64bits(u);
				k = ((x$2 = go$shiftRightUint64(iu, 52), new Go$Uint64(x$2.high - 0, x$2.low - 1023)).low >> 0);
				c = 0;
			}
			iu = new Go$Uint64(iu.high & 1048575, (iu.low & 4294967295) >>> 0);
			if ((iu.high < 434334 || (iu.high === 434334 && iu.low < 1719614413))) {
				u = Float64frombits(new Go$Uint64(iu.high | 1072693248, (iu.low | 0) >>> 0));
			} else {
				k = k + 1 >> 0;
				u = Float64frombits(new Go$Uint64(iu.high | 1071644672, (iu.low | 0) >>> 0));
				iu = go$shiftRightUint64((new Go$Uint64(1048576 - iu.high, 0 - iu.low)), 2);
			}
			f = u - 1;
		}
		hfsq = 0.5 * f * f;
		_tuple = [0, 0, 0], s = _tuple[0], R = _tuple[1], z = _tuple[2];
		if ((iu.high === 0 && iu.low === 0)) {
			if (f === 0) {
				if (k === 0) {
					return 0;
				} else {
					c = c + (k * 1.9082149292705877e-10);
					return k * 0.6931471803691238 + c;
				}
			}
			R = hfsq * (1 - 0.6666666666666666 * f);
			if (k === 0) {
				return f - R;
			}
			return k * 0.6931471803691238 - ((R - (k * 1.9082149292705877e-10 + c)) - f);
		}
		s = f / (2 + f);
		z = s * s;
		R = z * (0.6666666666666735 + z * (0.3999999999940942 + z * (0.2857142874366239 + z * (0.22222198432149784 + z * (0.1818357216161805 + z * (0.15313837699209373 + z * 0.14798198605116586))))));
		if (k === 0) {
			return f - (hfsq - s * (hfsq + R));
		}
		return k * 0.6931471803691238 - ((hfsq - (s * (hfsq + R) + (k * 1.9082149292705877e-10 + c))) - f);
	};
	var Logb = go$pkg.Logb = function(x) {
		if (x === 0) {
			return Inf(-1);
		} else if (IsInf(x, 0)) {
			return Inf(1);
		} else if (IsNaN(x)) {
			return x;
		}
		return ilogb(x);
	};
	var Ilogb = go$pkg.Ilogb = function(x) {
		if (x === 0) {
			return -2147483648;
		} else if (IsNaN(x)) {
			return 2147483647;
		} else if (IsInf(x, 0)) {
			return 2147483647;
		}
		return ilogb(x);
	};
	var ilogb = function(x) {
		var _tuple, exp$1, x$1;
		_tuple = normalize(x), x = _tuple[0], exp$1 = _tuple[1];
		return (((x$1 = go$shiftRightUint64(Float64bits(x), 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0) - 1023 >> 0) + exp$1 >> 0;
	};
	var Mod = go$pkg.Mod = function(x, y) { return x % y; };
	var mod = function(x, y) {
		var _tuple, yfr, yexp, sign, r, _tuple$1, rfr, rexp;
		if ((y === 0) || IsInf(x, 0) || IsNaN(x) || IsNaN(y)) {
			return NaN();
		}
		if (y < 0) {
			y = -y;
		}
		_tuple = Frexp(y), yfr = _tuple[0], yexp = _tuple[1];
		sign = false;
		r = x;
		if (x < 0) {
			r = -x;
			sign = true;
		}
		while (r >= y) {
			_tuple$1 = Frexp(r), rfr = _tuple$1[0], rexp = _tuple$1[1];
			if (rfr < yfr) {
				rexp = rexp - 1 >> 0;
			}
			r = r - Ldexp(y, rexp - yexp >> 0);
		}
		if (sign) {
			r = -r;
		}
		return r;
	};
	var Modf = go$pkg.Modf = function(f) { if (f === -1/0 || f === 1/0) { return [f, 0/0]; } var frac = f % 1; return [f - frac, frac]; };
	var modf = function(f) {
		var int$1, frac, _tuple, _tuple$1, _tuple$2, x, e, x$1, x$2;
		int$1 = 0;
		frac = 0;
		if (f < 1) {
			if (f < 0) {
				_tuple = Modf(-f), int$1 = _tuple[0], frac = _tuple[1];
				_tuple$1 = [-int$1, -frac], int$1 = _tuple$1[0], frac = _tuple$1[1];
				return [int$1, frac];
			}
			_tuple$2 = [0, f], int$1 = _tuple$2[0], frac = _tuple$2[1];
			return [int$1, frac];
		}
		x = Float64bits(f);
		e = (((go$shiftRightUint64(x, 52).low >>> 0) & 2047) >>> 0) - 1023 >>> 0;
		if (e < 52) {
			x = (x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), ((52 - e >>> 0))), new Go$Uint64(x$2.high - 0, x$2.low - 1)), new Go$Uint64(x.high &~ x$1.high, (x.low &~ x$1.low) >>> 0));
		}
		int$1 = Float64frombits(x);
		frac = f - int$1;
		return [int$1, frac];
	};
	var Nextafter = go$pkg.Nextafter = function(x, y) {
		var r, x$1, x$2;
		r = 0;
		if (IsNaN(x) || IsNaN(y)) {
			r = NaN();
		} else if (x === y) {
			r = x;
		} else if (x === 0) {
			r = Copysign(Float64frombits(new Go$Uint64(0, 1)), y);
		} else if ((y > x) === (x > 0)) {
			r = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high + 0, x$1.low + 1)));
		} else {
			r = Float64frombits((x$2 = Float64bits(x), new Go$Uint64(x$2.high - 0, x$2.low - 1)));
		}
		return r;
	};
	var isOddInt = function(x) {
		var _tuple, xi, xf, x$1, x$2;
		_tuple = Modf(x), xi = _tuple[0], xf = _tuple[1];
		return (xf === 0) && (x$1 = (x$2 = new Go$Int64(0, xi), new Go$Int64(x$2.high & 0, (x$2.low & 1) >>> 0)), (x$1.high === 0 && x$1.low === 1));
	};
	var Pow = go$pkg.Pow = function(x, y) { return ((x === 1) || (x === -1 && (y === -1/0 || y === 1/0))) ? 1 : Math.pow(x, y); };
	var Pow10 = go$pkg.Pow10 = function(e) {
		var _q, m;
		if (e <= -325) {
			return 0;
		} else if (e > 309) {
			return Inf(1);
		}
		if (e < 0) {
			return 1 / Pow10(-e);
		}
		if (e < 70) {
			return pow10tab[e];
		}
		m = (_q = e / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		return Pow10(m) * Pow10(e - m >> 0);
	};
	var Remainder = go$pkg.Remainder = function(x, y) { return remainder(x, y); };
	var remainder = function(x, y) {
		var sign, yHalf;
		if (IsNaN(x) || IsNaN(y) || IsInf(x, 0) || (y === 0)) {
			return NaN();
		} else if (IsInf(y, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (y < 0) {
			y = -y;
		}
		if (x === y) {
			return 0;
		}
		if (y <= 8.988465674311579e+307) {
			x = Mod(x, y + y);
		}
		if (y < 4.450147717014403e-308) {
			if (x + x > y) {
				x = x - (y);
				if (x + x >= y) {
					x = x - (y);
				}
			}
		} else {
			yHalf = 0.5 * y;
			if (x > yHalf) {
				x = x - (y);
				if (x >= yHalf) {
					x = x - (y);
				}
			}
		}
		if (sign) {
			x = -x;
		}
		return x;
	};
	var Signbit = go$pkg.Signbit = function(x) { return x < 0 || 1/x === 1/-0; };
	var Cos = go$pkg.Cos = Math.cos;
	var cos = function(x) {
		var sign, j, y, x$1, z, zz;
		if (IsNaN(x) || IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			j = new Go$Int64(j.high - 0, j.low - 4);
			sign = !sign;
		}
		if ((j.high > 0 || (j.high === 0 && j.low > 1))) {
			sign = !sign;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			y = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		} else {
			y = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Sin = go$pkg.Sin = Math.sin;
	var sin = function(x) {
		var sign, j, y, x$1, z, zz;
		if ((x === 0) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			sign = !sign;
			j = new Go$Int64(j.high - 0, j.low - 4);
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			y = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		} else {
			y = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Sincos = go$pkg.Sincos = function(x) { return [Math.sin(x), Math.cos(x)]; };
	var sincos = function(x) {
		var sin$1, cos$1, _tuple, _tuple$1, _tuple$2, sinSign, cosSign, j, y, x$1, _tuple$3, z, zz, _tuple$4;
		sin$1 = 0;
		cos$1 = 0;
		if (x === 0) {
			_tuple = [x, 1], sin$1 = _tuple[0], cos$1 = _tuple[1];
			return [sin$1, cos$1];
		} else if (IsNaN(x) || IsInf(x, 0)) {
			_tuple$1 = [NaN(), NaN()], sin$1 = _tuple$1[0], cos$1 = _tuple$1[1];
			return [sin$1, cos$1];
		}
		_tuple$2 = [false, false], sinSign = _tuple$2[0], cosSign = _tuple$2[1];
		if (x < 0) {
			x = -x;
			sinSign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			j = new Go$Int64(j.high - 0, j.low - 4);
			_tuple$3 = [!sinSign, !cosSign], sinSign = _tuple$3[0], cosSign = _tuple$3[1];
		}
		if ((j.high > 0 || (j.high === 0 && j.low > 1))) {
			cosSign = !cosSign;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		cos$1 = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		sin$1 = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			_tuple$4 = [cos$1, sin$1], sin$1 = _tuple$4[0], cos$1 = _tuple$4[1];
		}
		if (cosSign) {
			cos$1 = -cos$1;
		}
		if (sinSign) {
			sin$1 = -sin$1;
		}
		return [sin$1, cos$1];
	};
	var Sinh = go$pkg.Sinh = function(x) {
		var sign, temp, _ref, sq;
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		_ref = true;
		if (_ref === x > 21) {
			temp = Exp(x) / 2;
		} else if (_ref === x > 0.5) {
			temp = (Exp(x) - Exp(-x)) / 2;
		} else {
			sq = x * x;
			temp = (((-26.30563213397497 * sq + -2894.211355989564) * sq + -89912.72022039509) * sq + -630767.3640497717) * x;
			temp = temp / (((sq + -173.6789535582337) * sq + 15215.17378790019) * sq + -630767.3640497717);
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Cosh = go$pkg.Cosh = function(x) {
		if (x < 0) {
			x = -x;
		}
		if (x > 21) {
			return Exp(x) / 2;
		}
		return (Exp(x) + Exp(-x)) / 2;
	};
	var Sqrt = go$pkg.Sqrt = Math.sqrt;
	var sqrt = function(x) {
		var ix, x$1, exp$1, x$2, _tuple, q, s, r, t, x$3, x$4, x$5, x$6, x$7;
		if ((x === 0) || IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (x < 0) {
			return NaN();
		}
		ix = Float64bits(x);
		exp$1 = ((x$1 = go$shiftRightUint64(ix, 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0);
		if (exp$1 === 0) {
			while ((x$2 = go$shiftLeft64(new Go$Uint64(ix.high & 0, (ix.low & 1) >>> 0), 52), (x$2.high === 0 && x$2.low === 0))) {
				ix = go$shiftLeft64(ix, 1);
				exp$1 = exp$1 - 1 >> 0;
			}
			exp$1 = exp$1 + 1 >> 0;
		}
		exp$1 = exp$1 - 1023 >> 0;
		ix = new Go$Uint64(ix.high &~ 2146435072, (ix.low &~ 0) >>> 0);
		ix = new Go$Uint64(ix.high | 1048576, (ix.low | 0) >>> 0);
		if ((exp$1 & 1) === 1) {
			ix = go$shiftLeft64(ix, 1);
		}
		exp$1 = exp$1 >> 1 >> 0;
		ix = go$shiftLeft64(ix, 1);
		_tuple = [new Go$Uint64(0, 0), new Go$Uint64(0, 0)], q = _tuple[0], s = _tuple[1];
		r = new Go$Uint64(2097152, 0);
		while (!((r.high === 0 && r.low === 0))) {
			t = new Go$Uint64(s.high + r.high, s.low + r.low);
			if ((t.high < ix.high || (t.high === ix.high && t.low <= ix.low))) {
				s = new Go$Uint64(t.high + r.high, t.low + r.low);
				ix = (x$3 = t, new Go$Uint64(ix.high - x$3.high, ix.low - x$3.low));
				q = (x$4 = r, new Go$Uint64(q.high + x$4.high, q.low + x$4.low));
			}
			ix = go$shiftLeft64(ix, 1);
			r = go$shiftRightUint64(r, 1);
		}
		if (!((ix.high === 0 && ix.low === 0))) {
			q = (x$5 = new Go$Uint64(q.high & 0, (q.low & 1) >>> 0), new Go$Uint64(q.high + x$5.high, q.low + x$5.low));
		}
		ix = (x$6 = go$shiftRightUint64(q, 1), x$7 = go$shiftLeft64(new Go$Uint64(0, ((exp$1 - 1 >> 0) + 1023 >> 0)), 52), new Go$Uint64(x$6.high + x$7.high, x$6.low + x$7.low));
		return Float64frombits(ix);
	};
	var sqrtC = function(f, r) {
		r.go$set(sqrt(f));
	};
	var Tan = go$pkg.Tan = Math.tan;
	var tan = function(x) {
		var sign, j, y, x$1, z, zz, x$2;
		if ((x === 0) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if (zz > 1e-14) {
			y = z + z * (zz * (((_tanP[0] * zz) + _tanP[1]) * zz + _tanP[2]) / ((((zz + _tanQ[1]) * zz + _tanQ[2]) * zz + _tanQ[3]) * zz + _tanQ[4]));
		} else {
			y = z;
		}
		if ((x$2 = new Go$Int64(j.high & 0, (j.low & 2) >>> 0), (x$2.high === 0 && x$2.low === 2))) {
			y = -1 / y;
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Tanh = go$pkg.Tanh = function(x) {
		var z, s, s$1;
		z = Abs(x);
		if (z > 44.014845965556525) {
			if (x < 0) {
				return -1;
			}
			return 1;
		} else if (z >= 0.625) {
			s = Exp(2 * z);
			z = 1 - 2 / (s + 1);
			if (x < 0) {
				z = -z;
			}
		} else {
			if (x === 0) {
				return x;
			}
			s$1 = x * x;
			z = x + x * s$1 * ((tanhP[0] * s$1 + tanhP[1]) * s$1 + tanhP[2]) / (((s$1 + tanhQ[0]) * s$1 + tanhQ[1]) * s$1 + tanhQ[2]);
		}
		return z;
	};
	var Float32bits = go$pkg.Float32bits = go$float32bits;
	var Float32frombits = go$pkg.Float32frombits = function(b) {
			var s, e, m;
			s = 1;
			if (!(((b & 2147483648) >>> 0) === 0)) {
				s = -1;
			}
			e = (((((b >>> 23) >>> 0)) & 255) >>> 0);
			m = ((b & 8388607) >>> 0);
			if (e === 255) {
				if (m === 0) {
					return s / 0;
				}
				return 0/0;
			}
			if (!(e === 0)) {
				m = (m + (8388608) >>> 0);
			}
			if (e === 0) {
				e = 1;
			}
			return Ldexp(m, e - 127 - 23) * s;
		};
	var Float64bits = go$pkg.Float64bits = function(f) {
			var s, e, x, y, x$1, y$1, x$2, y$2;
			if (f === 0) {
				if (f === 0 && 1 / f === 1 / -0) {
					return new Go$Uint64(2147483648, 0);
				}
				return new Go$Uint64(0, 0);
			}
			if (!(f === f)) {
				return new Go$Uint64(2146959360, 1);
			}
			s = new Go$Uint64(0, 0);
			if (f < 0) {
				s = new Go$Uint64(2147483648, 0);
				f = -f;
			}
			e = 1075;
			while (f >= 9.007199254740992e+15) {
				f = f / (2);
				if (e === 2047) {
					break;
				}
				e = (e + (1) >>> 0);
			}
			while (f < 4.503599627370496e+15) {
				e = (e - (1) >>> 0);
				if (e === 0) {
					break;
				}
				f = f * (2);
			}
			return (x$2 = (x = s, y = go$shiftLeft64(new Go$Uint64(0, e), 52), new Go$Uint64(x.high | y.high, (x.low | y.low) >>> 0)), y$2 = ((x$1 = new Go$Uint64(0, f), y$1 = new Go$Uint64(1048576, 0), new Go$Uint64(x$1.high &~ y$1.high, (x$1.low &~ y$1.low) >>> 0))), new Go$Uint64(x$2.high | y$2.high, (x$2.low | y$2.low) >>> 0));
		};
	var Float64frombits = go$pkg.Float64frombits = function(b) {
			var s, x, y, x$1, y$1, x$2, y$2, e, x$3, y$3, m, x$4, y$4, x$5, y$5, x$6, y$6, x$7, y$7, x$8, y$8;
			s = 1;
			if (!((x$1 = (x = b, y = new Go$Uint64(2147483648, 0), new Go$Uint64(x.high & y.high, (x.low & y.low) >>> 0)), y$1 = new Go$Uint64(0, 0), x$1.high === y$1.high && x$1.low === y$1.low))) {
				s = -1;
			}
			e = (x$2 = (go$shiftRightUint64(b, 52)), y$2 = new Go$Uint64(0, 2047), new Go$Uint64(x$2.high & y$2.high, (x$2.low & y$2.low) >>> 0));
			m = (x$3 = b, y$3 = new Go$Uint64(1048575, 4294967295), new Go$Uint64(x$3.high & y$3.high, (x$3.low & y$3.low) >>> 0));
			if ((x$4 = e, y$4 = new Go$Uint64(0, 2047), x$4.high === y$4.high && x$4.low === y$4.low)) {
				if ((x$5 = m, y$5 = new Go$Uint64(0, 0), x$5.high === y$5.high && x$5.low === y$5.low)) {
					return s / 0;
				}
				return 0/0;
			}
			if (!((x$6 = e, y$6 = new Go$Uint64(0, 0), x$6.high === y$6.high && x$6.low === y$6.low))) {
				m = (x$7 = m, y$7 = (new Go$Uint64(1048576, 0)), new Go$Uint64(x$7.high + y$7.high, x$7.low + y$7.low));
			}
			if ((x$8 = e, y$8 = new Go$Uint64(0, 0), x$8.high === y$8.high && x$8.low === y$8.low)) {
				e = new Go$Uint64(0, 1);
			}
			return Ldexp((m.high * 4294967296 + m.low), e.low - 1023 - 52) * s;
		};
	go$pkg.init = function() {
		pow10tab = go$makeNativeArray("Float64", 70, function() { return 0; });
		var i, _q, m;
		_gamP = go$toNativeArray("Float64", [0.00016011952247675185, 0.0011913514700658638, 0.010421379756176158, 0.04763678004571372, 0.20744822764843598, 0.4942148268014971, 1]);
		_gamQ = go$toNativeArray("Float64", [-2.3158187332412014e-05, 0.0005396055804933034, -0.004456419138517973, 0.011813978522206043, 0.035823639860549865, -0.23459179571824335, 0.0714304917030273, 1]);
		_gamS = go$toNativeArray("Float64", [0.0007873113957930937, -0.00022954996161337813, -0.0026813261780578124, 0.0034722222160545866, 0.08333333333334822]);
		p0R8 = go$toNativeArray("Float64", [0, -0.07031249999999004, -8.081670412753498, -257.06310567970485, -2485.216410094288, -5253.043804907295]);
		p0S8 = go$toNativeArray("Float64", [116.53436461966818, 3833.7447536412183, 40597.857264847255, 116752.97256437592, 47627.728414673096]);
		p0R5 = go$toNativeArray("Float64", [-1.141254646918945e-11, -0.07031249408735993, -4.159610644705878, -67.67476522651673, -331.23129964917297, -346.4333883656049]);
		p0S5 = go$toNativeArray("Float64", [60.753938269230034, 1051.2523059570458, 5978.970943338558, 9625.445143577745, 2406.058159229391]);
		p0R3 = go$toNativeArray("Float64", [-2.547046017719519e-09, -0.07031196163814817, -2.409032215495296, -21.96597747348831, -58.07917047017376, -31.44794705948885]);
		p0S3 = go$toNativeArray("Float64", [35.85603380552097, 361.51398305030386, 1193.6078379211153, 1127.9967985690741, 173.58093081333575]);
		p0R2 = go$toNativeArray("Float64", [-8.875343330325264e-08, -0.07030309954836247, -1.4507384678095299, -7.635696138235278, -11.193166886035675, -3.2336457935133534]);
		p0S2 = go$toNativeArray("Float64", [22.22029975320888, 136.2067942182152, 270.4702786580835, 153.87539420832033, 14.65761769482562]);
		q0R8 = go$toNativeArray("Float64", [0, 0.0732421874999935, 11.76820646822527, 557.6733802564019, 8859.197207564686, 37014.62677768878]);
		q0S8 = go$toNativeArray("Float64", [163.77602689568982, 8098.344946564498, 142538.29141912048, 803309.2571195144, 840501.5798190605, -343899.2935378666]);
		q0R5 = go$toNativeArray("Float64", [1.8408596359451553e-11, 0.07324217666126848, 5.8356350896205695, 135.11157728644983, 1027.243765961641, 1989.9778586460538]);
		q0S5 = go$toNativeArray("Float64", [82.77661022365378, 2077.81416421393, 18847.28877857181, 56751.11228949473, 35976.75384251145, -5354.342756019448]);
		q0R3 = go$toNativeArray("Float64", [4.377410140897386e-09, 0.07324111800429114, 3.344231375161707, 42.621844074541265, 170.8080913405656, 166.73394869665117]);
		q0S3 = go$toNativeArray("Float64", [48.75887297245872, 709.689221056606, 3704.1482262011136, 6460.425167525689, 2516.3336892036896, -149.2474518361564]);
		q0R2 = go$toNativeArray("Float64", [1.5044444488698327e-07, 0.07322342659630793, 1.99819174093816, 14.495602934788574, 31.666231750478154, 16.252707571092927]);
		q0S2 = go$toNativeArray("Float64", [30.36558483552192, 269.34811860804984, 844.7837575953201, 882.9358451124886, 212.66638851179883, -5.3109549388266695]);
		p1R8 = go$toNativeArray("Float64", [0, 0.11718749999998865, 13.239480659307358, 412.05185430737856, 3874.7453891396053, 7914.479540318917]);
		p1S8 = go$toNativeArray("Float64", [114.20737037567841, 3650.9308342085346, 36956.206026903346, 97602.79359349508, 30804.27206278888]);
		p1R5 = go$toNativeArray("Float64", [1.3199051955624352e-11, 0.1171874931906141, 6.802751278684329, 108.30818299018911, 517.6361395331998, 528.7152013633375]);
		p1S5 = go$toNativeArray("Float64", [59.28059872211313, 991.4014187336144, 5353.26695291488, 7844.690317495512, 1504.0468881036106]);
		p1R3 = go$toNativeArray("Float64", [3.025039161373736e-09, 0.11718686556725359, 3.9329775003331564, 35.11940355916369, 91.05501107507813, 48.55906851973649]);
		p1S3 = go$toNativeArray("Float64", [34.79130950012515, 336.76245874782575, 1046.8713997577513, 890.8113463982564, 103.78793243963928]);
		p1R2 = go$toNativeArray("Float64", [1.0771083010687374e-07, 0.11717621946268335, 2.368514966676088, 12.242610914826123, 17.693971127168773, 5.073523125888185]);
		p1S2 = go$toNativeArray("Float64", [21.43648593638214, 125.29022716840275, 232.2764690571628, 117.6793732871471, 8.364638933716183]);
		q1R8 = go$toNativeArray("Float64", [0, -0.10253906249999271, -16.271753454459, -759.6017225139501, -11849.806670242959, -48438.512428575035]);
		q1S8 = go$toNativeArray("Float64", [161.3953697007229, 7825.385999233485, 133875.33628724958, 719657.7236832409, 666601.2326177764, -294490.26430383464]);
		q1R5 = go$toNativeArray("Float64", [-2.089799311417641e-11, -0.10253905024137543, -8.05644828123936, -183.66960747488838, -1373.1937606550816, -2612.4444045321566]);
		q1S5 = go$toNativeArray("Float64", [81.27655013843358, 1991.7987346048596, 17468.48519249089, 49851.42709103523, 27948.075163891812, -4719.183547951285]);
		q1R3 = go$toNativeArray("Float64", [-5.078312264617666e-09, -0.10253782982083709, -4.610115811394734, -57.847221656278364, -228.2445407376317, -219.21012847890933]);
		q1S3 = go$toNativeArray("Float64", [47.66515503237295, 673.8651126766997, 3380.1528667952634, 5547.729097207228, 1903.119193388108, -135.20119144430734]);
		q1R2 = go$toNativeArray("Float64", [-1.7838172751095887e-07, -0.10251704260798555, -2.7522056827818746, -19.663616264370372, -42.32531333728305, -21.371921170370406]);
		q1S2 = go$toNativeArray("Float64", [29.533362906052385, 252.98154998219053, 757.5028348686454, 739.3932053204672, 155.94900333666612, -4.959498988226282]);
		_lgamA = go$toNativeArray("Float64", [0.07721566490153287, 0.3224670334241136, 0.06735230105312927, 0.020580808432516733, 0.007385550860814029, 0.0028905138367341563, 0.0011927076318336207, 0.0005100697921535113, 0.00022086279071390839, 0.00010801156724758394, 2.5214456545125733e-05, 4.4864094961891516e-05]);
		_lgamR = go$toNativeArray("Float64", [1, 1.3920053346762105, 0.7219355475671381, 0.17193386563280308, 0.01864591917156529, 0.0007779424963818936, 7.326684307446256e-06]);
		_lgamS = go$toNativeArray("Float64", [-0.07721566490153287, 0.21498241596060885, 0.325778796408931, 0.14635047265246445, 0.02664227030336386, 0.0018402845140733772, 3.194753265841009e-05]);
		_lgamT = go$toNativeArray("Float64", [0.48383612272381005, -0.1475877229945939, 0.06462494023913339, -0.032788541075985965, 0.01797067508118204, -0.010314224129834144, 0.006100538702462913, -0.0036845201678113826, 0.0022596478090061247, -0.0014034646998923284, 0.000881081882437654, -0.0005385953053567405, 0.00031563207090362595, -0.00031275416837512086, 0.0003355291926355191]);
		_lgamU = go$toNativeArray("Float64", [-0.07721566490153287, 0.6328270640250934, 1.4549225013723477, 0.9777175279633727, 0.22896372806469245, 0.013381091853678766]);
		_lgamV = go$toNativeArray("Float64", [1, 2.4559779371304113, 2.128489763798934, 0.7692851504566728, 0.10422264559336913, 0.003217092422824239]);
		_lgamW = go$toNativeArray("Float64", [0.4189385332046727, 0.08333333333333297, -0.0027777777772877554, 0.0007936505586430196, -0.00059518755745034, 0.0008363399189962821, -0.0016309293409657527]);
		_sin = go$toNativeArray("Float64", [1.5896230157654656e-10, -2.5050747762857807e-08, 2.7557313621385722e-06, -0.0001984126982958954, 0.008333333333322118, -0.1666666666666663]);
		_cos = go$toNativeArray("Float64", [-1.1358536521387682e-11, 2.087570084197473e-09, -2.755731417929674e-07, 2.4801587288851704e-05, -0.0013888888888873056, 0.041666666666666595]);
		_tanP = go$toNativeArray("Float64", [-13093.693918138379, 1.1535166483858742e+06, -1.7956525197648488e+07]);
		_tanQ = go$toNativeArray("Float64", [1, 13681.296347069296, -1.3208923444021097e+06, 2.500838018233579e+07, -5.3869575592945464e+07]);
		tanhP = go$toNativeArray("Float64", [-0.9643991794250523, -99.28772310019185, -1614.6876844170845]);
		tanhQ = go$toNativeArray("Float64", [112.81167849163293, 2235.4883906010045, 4844.063053251255]);
		pow10tab[0] = 1;
		pow10tab[1] = 10;
		i = 2;
		while (i < 70) {
			m = (_q = i / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			pow10tab[i] = pow10tab[m] * pow10tab[(i - m >> 0)];
			i = i + 1 >> 0;
		}
	};
	return go$pkg;
})();
go$packages["unicode/utf8"] = (function() {
	var go$pkg = {};
	var decodeRuneInternal = function(p) {
		var r, size, short$1, n, _tuple, _slice, _index, c0, _tuple$1, _tuple$2, _tuple$3, _slice$1, _index$1, c1, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _slice$2, _index$2, c2, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, _slice$3, _index$3, c3, _tuple$13, _tuple$14, _tuple$15, _tuple$16;
		r = 0;
		size = 0;
		short$1 = false;
		n = p.length;
		if (n < 1) {
			_tuple = [65533, 0, true], r = _tuple[0], size = _tuple[1], short$1 = _tuple[2];
			return [r, size, short$1];
		}
		c0 = (_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
		if (c0 < 128) {
			_tuple$1 = [(c0 >> 0), 1, false], r = _tuple$1[0], size = _tuple$1[1], short$1 = _tuple$1[2];
			return [r, size, short$1];
		}
		if (c0 < 192) {
			_tuple$2 = [65533, 1, false], r = _tuple$2[0], size = _tuple$2[1], short$1 = _tuple$2[2];
			return [r, size, short$1];
		}
		if (n < 2) {
			_tuple$3 = [65533, 1, true], r = _tuple$3[0], size = _tuple$3[1], short$1 = _tuple$3[2];
			return [r, size, short$1];
		}
		c1 = (_slice$1 = p, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
		if (c1 < 128 || 192 <= c1) {
			_tuple$4 = [65533, 1, false], r = _tuple$4[0], size = _tuple$4[1], short$1 = _tuple$4[2];
			return [r, size, short$1];
		}
		if (c0 < 224) {
			r = ((((c0 & 31) >>> 0) >> 0) << 6 >> 0) | (((c1 & 63) >>> 0) >> 0);
			if (r <= 127) {
				_tuple$5 = [65533, 1, false], r = _tuple$5[0], size = _tuple$5[1], short$1 = _tuple$5[2];
				return [r, size, short$1];
			}
			_tuple$6 = [r, 2, false], r = _tuple$6[0], size = _tuple$6[1], short$1 = _tuple$6[2];
			return [r, size, short$1];
		}
		if (n < 3) {
			_tuple$7 = [65533, 1, true], r = _tuple$7[0], size = _tuple$7[1], short$1 = _tuple$7[2];
			return [r, size, short$1];
		}
		c2 = (_slice$2 = p, _index$2 = 2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range"));
		if (c2 < 128 || 192 <= c2) {
			_tuple$8 = [65533, 1, false], r = _tuple$8[0], size = _tuple$8[1], short$1 = _tuple$8[2];
			return [r, size, short$1];
		}
		if (c0 < 240) {
			r = (((((c0 & 15) >>> 0) >> 0) << 12 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c2 & 63) >>> 0) >> 0);
			if (r <= 2047) {
				_tuple$9 = [65533, 1, false], r = _tuple$9[0], size = _tuple$9[1], short$1 = _tuple$9[2];
				return [r, size, short$1];
			}
			if (55296 <= r && r <= 57343) {
				_tuple$10 = [65533, 1, false], r = _tuple$10[0], size = _tuple$10[1], short$1 = _tuple$10[2];
				return [r, size, short$1];
			}
			_tuple$11 = [r, 3, false], r = _tuple$11[0], size = _tuple$11[1], short$1 = _tuple$11[2];
			return [r, size, short$1];
		}
		if (n < 4) {
			_tuple$12 = [65533, 1, true], r = _tuple$12[0], size = _tuple$12[1], short$1 = _tuple$12[2];
			return [r, size, short$1];
		}
		c3 = (_slice$3 = p, _index$3 = 3, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range"));
		if (c3 < 128 || 192 <= c3) {
			_tuple$13 = [65533, 1, false], r = _tuple$13[0], size = _tuple$13[1], short$1 = _tuple$13[2];
			return [r, size, short$1];
		}
		if (c0 < 248) {
			r = ((((((c0 & 7) >>> 0) >> 0) << 18 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 12 >> 0)) | ((((c2 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c3 & 63) >>> 0) >> 0);
			if (r <= 65535 || 1114111 < r) {
				_tuple$14 = [65533, 1, false], r = _tuple$14[0], size = _tuple$14[1], short$1 = _tuple$14[2];
				return [r, size, short$1];
			}
			_tuple$15 = [r, 4, false], r = _tuple$15[0], size = _tuple$15[1], short$1 = _tuple$15[2];
			return [r, size, short$1];
		}
		_tuple$16 = [65533, 1, false], r = _tuple$16[0], size = _tuple$16[1], short$1 = _tuple$16[2];
		return [r, size, short$1];
	};
	var decodeRuneInStringInternal = function(s) {
		var r, size, short$1, n, _tuple, c0, _tuple$1, _tuple$2, _tuple$3, c1, _tuple$4, _tuple$5, _tuple$6, _tuple$7, c2, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, c3, _tuple$13, _tuple$14, _tuple$15, _tuple$16;
		r = 0;
		size = 0;
		short$1 = false;
		n = s.length;
		if (n < 1) {
			_tuple = [65533, 0, true], r = _tuple[0], size = _tuple[1], short$1 = _tuple[2];
			return [r, size, short$1];
		}
		c0 = s.charCodeAt(0);
		if (c0 < 128) {
			_tuple$1 = [(c0 >> 0), 1, false], r = _tuple$1[0], size = _tuple$1[1], short$1 = _tuple$1[2];
			return [r, size, short$1];
		}
		if (c0 < 192) {
			_tuple$2 = [65533, 1, false], r = _tuple$2[0], size = _tuple$2[1], short$1 = _tuple$2[2];
			return [r, size, short$1];
		}
		if (n < 2) {
			_tuple$3 = [65533, 1, true], r = _tuple$3[0], size = _tuple$3[1], short$1 = _tuple$3[2];
			return [r, size, short$1];
		}
		c1 = s.charCodeAt(1);
		if (c1 < 128 || 192 <= c1) {
			_tuple$4 = [65533, 1, false], r = _tuple$4[0], size = _tuple$4[1], short$1 = _tuple$4[2];
			return [r, size, short$1];
		}
		if (c0 < 224) {
			r = ((((c0 & 31) >>> 0) >> 0) << 6 >> 0) | (((c1 & 63) >>> 0) >> 0);
			if (r <= 127) {
				_tuple$5 = [65533, 1, false], r = _tuple$5[0], size = _tuple$5[1], short$1 = _tuple$5[2];
				return [r, size, short$1];
			}
			_tuple$6 = [r, 2, false], r = _tuple$6[0], size = _tuple$6[1], short$1 = _tuple$6[2];
			return [r, size, short$1];
		}
		if (n < 3) {
			_tuple$7 = [65533, 1, true], r = _tuple$7[0], size = _tuple$7[1], short$1 = _tuple$7[2];
			return [r, size, short$1];
		}
		c2 = s.charCodeAt(2);
		if (c2 < 128 || 192 <= c2) {
			_tuple$8 = [65533, 1, false], r = _tuple$8[0], size = _tuple$8[1], short$1 = _tuple$8[2];
			return [r, size, short$1];
		}
		if (c0 < 240) {
			r = (((((c0 & 15) >>> 0) >> 0) << 12 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c2 & 63) >>> 0) >> 0);
			if (r <= 2047) {
				_tuple$9 = [65533, 1, false], r = _tuple$9[0], size = _tuple$9[1], short$1 = _tuple$9[2];
				return [r, size, short$1];
			}
			if (55296 <= r && r <= 57343) {
				_tuple$10 = [65533, 1, false], r = _tuple$10[0], size = _tuple$10[1], short$1 = _tuple$10[2];
				return [r, size, short$1];
			}
			_tuple$11 = [r, 3, false], r = _tuple$11[0], size = _tuple$11[1], short$1 = _tuple$11[2];
			return [r, size, short$1];
		}
		if (n < 4) {
			_tuple$12 = [65533, 1, true], r = _tuple$12[0], size = _tuple$12[1], short$1 = _tuple$12[2];
			return [r, size, short$1];
		}
		c3 = s.charCodeAt(3);
		if (c3 < 128 || 192 <= c3) {
			_tuple$13 = [65533, 1, false], r = _tuple$13[0], size = _tuple$13[1], short$1 = _tuple$13[2];
			return [r, size, short$1];
		}
		if (c0 < 248) {
			r = ((((((c0 & 7) >>> 0) >> 0) << 18 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 12 >> 0)) | ((((c2 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c3 & 63) >>> 0) >> 0);
			if (r <= 65535 || 1114111 < r) {
				_tuple$14 = [65533, 1, false], r = _tuple$14[0], size = _tuple$14[1], short$1 = _tuple$14[2];
				return [r, size, short$1];
			}
			_tuple$15 = [r, 4, false], r = _tuple$15[0], size = _tuple$15[1], short$1 = _tuple$15[2];
			return [r, size, short$1];
		}
		_tuple$16 = [65533, 1, false], r = _tuple$16[0], size = _tuple$16[1], short$1 = _tuple$16[2];
		return [r, size, short$1];
	};
	var FullRune = go$pkg.FullRune = function(p) {
		var _tuple, short$1;
		_tuple = decodeRuneInternal(p), short$1 = _tuple[2];
		return !short$1;
	};
	var FullRuneInString = go$pkg.FullRuneInString = function(s) {
		var _tuple, short$1;
		_tuple = decodeRuneInStringInternal(s), short$1 = _tuple[2];
		return !short$1;
	};
	var DecodeRune = go$pkg.DecodeRune = function(p) {
		var r, size, _tuple;
		r = 0;
		size = 0;
		_tuple = decodeRuneInternal(p), r = _tuple[0], size = _tuple[1];
		return [r, size];
	};
	var DecodeRuneInString = go$pkg.DecodeRuneInString = function(s) {
		var r, size, _tuple;
		r = 0;
		size = 0;
		_tuple = decodeRuneInStringInternal(s), r = _tuple[0], size = _tuple[1];
		return [r, size];
	};
	var DecodeLastRune = go$pkg.DecodeLastRune = function(p) {
		var r, size, end, _tuple, start, _slice, _index, _tuple$1, lim, _slice$1, _index$1, _tuple$2, _tuple$3, _tuple$4;
		r = 0;
		size = 0;
		end = p.length;
		if (end === 0) {
			_tuple = [65533, 0], r = _tuple[0], size = _tuple[1];
			return [r, size];
		}
		start = end - 1 >> 0;
		r = ((_slice = p, _index = start, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) >> 0);
		if (r < 128) {
			_tuple$1 = [r, 1], r = _tuple$1[0], size = _tuple$1[1];
			return [r, size];
		}
		lim = end - 4 >> 0;
		if (lim < 0) {
			lim = 0;
		}
		start = start - 1 >> 0;
		while (start >= lim) {
			if (RuneStart((_slice$1 = p, _index$1 = start, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")))) {
				break;
			}
			start = start - 1 >> 0;
		}
		if (start < 0) {
			start = 0;
		}
		_tuple$2 = DecodeRune(go$subslice(p, start, end)), r = _tuple$2[0], size = _tuple$2[1];
		if (!(((start + size >> 0) === end))) {
			_tuple$3 = [65533, 1], r = _tuple$3[0], size = _tuple$3[1];
			return [r, size];
		}
		_tuple$4 = [r, size], r = _tuple$4[0], size = _tuple$4[1];
		return [r, size];
	};
	var DecodeLastRuneInString = go$pkg.DecodeLastRuneInString = function(s) {
		var r, size, end, _tuple, start, _tuple$1, lim, _tuple$2, _tuple$3, _tuple$4;
		r = 0;
		size = 0;
		end = s.length;
		if (end === 0) {
			_tuple = [65533, 0], r = _tuple[0], size = _tuple[1];
			return [r, size];
		}
		start = end - 1 >> 0;
		r = (s.charCodeAt(start) >> 0);
		if (r < 128) {
			_tuple$1 = [r, 1], r = _tuple$1[0], size = _tuple$1[1];
			return [r, size];
		}
		lim = end - 4 >> 0;
		if (lim < 0) {
			lim = 0;
		}
		start = start - 1 >> 0;
		while (start >= lim) {
			if (RuneStart(s.charCodeAt(start))) {
				break;
			}
			start = start - 1 >> 0;
		}
		if (start < 0) {
			start = 0;
		}
		_tuple$2 = DecodeRuneInString(s.substring(start, end)), r = _tuple$2[0], size = _tuple$2[1];
		if (!(((start + size >> 0) === end))) {
			_tuple$3 = [65533, 1], r = _tuple$3[0], size = _tuple$3[1];
			return [r, size];
		}
		_tuple$4 = [r, size], r = _tuple$4[0], size = _tuple$4[1];
		return [r, size];
	};
	var RuneLen = go$pkg.RuneLen = function(r) {
		if (r < 0) {
			return -1;
		} else if (r <= 127) {
			return 1;
		} else if (r <= 2047) {
			return 2;
		} else if (55296 <= r && r <= 57343) {
			return -1;
		} else if (r <= 65535) {
			return 3;
		} else if (r <= 1114111) {
			return 4;
		}
		return -1;
	};
	var EncodeRune = go$pkg.EncodeRune = function(p, r) {
		var _slice, _index, _slice$1, _index$1, _slice$2, _index$2, _slice$3, _index$3, _slice$4, _index$4, _slice$5, _index$5, _slice$6, _index$6, _slice$7, _index$7, _slice$8, _index$8, _slice$9, _index$9;
		if ((r >>> 0) <= 127) {
			_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = (r << 24 >>> 24)) : go$throwRuntimeError("index out of range");
			return 1;
		}
		if ((r >>> 0) <= 2047) {
			_slice$1 = p, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = (192 | ((r >> 6 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$2 = p, _index$2 = 1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			return 2;
		}
		if ((r >>> 0) > 1114111) {
			r = 65533;
		}
		if (55296 <= r && r <= 57343) {
			r = 65533;
		}
		if ((r >>> 0) <= 65535) {
			_slice$3 = p, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = (224 | ((r >> 12 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$4 = p, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? (_slice$4.array[_slice$4.offset + _index$4] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$5 = p, _index$5 = 2, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			return 3;
		}
		_slice$6 = p, _index$6 = 0, (_index$6 >= 0 && _index$6 < _slice$6.length) ? (_slice$6.array[_slice$6.offset + _index$6] = (240 | ((r >> 18 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$7 = p, _index$7 = 1, (_index$7 >= 0 && _index$7 < _slice$7.length) ? (_slice$7.array[_slice$7.offset + _index$7] = (128 | ((((r >> 12 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$8 = p, _index$8 = 2, (_index$8 >= 0 && _index$8 < _slice$8.length) ? (_slice$8.array[_slice$8.offset + _index$8] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$9 = p, _index$9 = 3, (_index$9 >= 0 && _index$9 < _slice$9.length) ? (_slice$9.array[_slice$9.offset + _index$9] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		return 4;
	};
	var RuneCount = go$pkg.RuneCount = function(p) {
		var i, n, _slice, _index, _tuple, size;
		i = 0;
		n = 0;
		n = 0;
		while (i < p.length) {
			if ((_slice = p, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < 128) {
				i = i + 1 >> 0;
			} else {
				_tuple = DecodeRune(go$subslice(p, i)), size = _tuple[1];
				i = i + (size) >> 0;
			}
			n = n + 1 >> 0;
		}
		return n;
	};
	var RuneCountInString = go$pkg.RuneCountInString = function(s) {
		var n, _ref, _i, _rune;
		n = 0;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			_rune = go$decodeRune(_ref, _i);
			n = n + 1 >> 0;
			_i += _rune[1];
		}
		return n;
	};
	var RuneStart = go$pkg.RuneStart = function(b) {
		return !((((b & 192) >>> 0) === 128));
	};
	var Valid = go$pkg.Valid = function(p) {
		var i, _slice, _index, _tuple, size;
		i = 0;
		while (i < p.length) {
			if ((_slice = p, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < 128) {
				i = i + 1 >> 0;
			} else {
				_tuple = DecodeRune(go$subslice(p, i)), size = _tuple[1];
				if (size === 1) {
					return false;
				}
				i = i + (size) >> 0;
			}
		}
		return true;
	};
	var ValidString = go$pkg.ValidString = function(s) {
		var _ref, _i, _rune, r, i, _tuple, size;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			_rune = go$decodeRune(_ref, _i);
			r = _rune[0];
			i = _i;
			if (r === 65533) {
				_tuple = DecodeRuneInString(s.substring(i)), size = _tuple[1];
				if (size === 1) {
					return false;
				}
			}
			_i += _rune[1];
		}
		return true;
	};
	var ValidRune = go$pkg.ValidRune = function(r) {
		if (r < 0) {
			return false;
		} else if (55296 <= r && r <= 57343) {
			return false;
		} else if (r > 1114111) {
			return false;
		}
		return true;
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["strconv"] = (function() {
	var go$pkg = {};
	var math = go$packages["math"];
	var errors = go$packages["errors"];
	var utf8 = go$packages["unicode/utf8"];
	var NumError;
	NumError = go$newType(0, "Struct", "strconv.NumError", "NumError", "strconv", function(Func_, Num_, Err_) {
		this.go$val = this;
		this.Func = Func_ !== undefined ? Func_ : "";
		this.Num = Num_ !== undefined ? Num_ : "";
		this.Err = Err_ !== undefined ? Err_ : null;
	});
	go$pkg.NumError = NumError;
	var decimal;
	decimal = go$newType(0, "Struct", "strconv.decimal", "decimal", "strconv", function(d_, nd_, dp_, neg_, trunc_) {
		this.go$val = this;
		this.d = d_ !== undefined ? d_ : go$makeNativeArray("Uint8", 800, function() { return 0; });
		this.nd = nd_ !== undefined ? nd_ : 0;
		this.dp = dp_ !== undefined ? dp_ : 0;
		this.neg = neg_ !== undefined ? neg_ : false;
		this.trunc = trunc_ !== undefined ? trunc_ : false;
	});
	go$pkg.decimal = decimal;
	var leftCheat;
	leftCheat = go$newType(0, "Struct", "strconv.leftCheat", "leftCheat", "strconv", function(delta_, cutoff_) {
		this.go$val = this;
		this.delta = delta_ !== undefined ? delta_ : 0;
		this.cutoff = cutoff_ !== undefined ? cutoff_ : "";
	});
	go$pkg.leftCheat = leftCheat;
	var extFloat;
	extFloat = go$newType(0, "Struct", "strconv.extFloat", "extFloat", "strconv", function(mant_, exp_, neg_) {
		this.go$val = this;
		this.mant = mant_ !== undefined ? mant_ : new Go$Uint64(0, 0);
		this.exp = exp_ !== undefined ? exp_ : 0;
		this.neg = neg_ !== undefined ? neg_ : false;
	});
	go$pkg.extFloat = extFloat;
	var floatInfo;
	floatInfo = go$newType(0, "Struct", "strconv.floatInfo", "floatInfo", "strconv", function(mantbits_, expbits_, bias_) {
		this.go$val = this;
		this.mantbits = mantbits_ !== undefined ? mantbits_ : 0;
		this.expbits = expbits_ !== undefined ? expbits_ : 0;
		this.bias = bias_ !== undefined ? bias_ : 0;
	});
	go$pkg.floatInfo = floatInfo;
	var decimalSlice;
	decimalSlice = go$newType(0, "Struct", "strconv.decimalSlice", "decimalSlice", "strconv", function(d_, nd_, dp_, neg_) {
		this.go$val = this;
		this.d = d_ !== undefined ? d_ : (go$sliceType(Go$Uint8)).nil;
		this.nd = nd_ !== undefined ? nd_ : 0;
		this.dp = dp_ !== undefined ? dp_ : 0;
		this.neg = neg_ !== undefined ? neg_ : false;
	});
	go$pkg.decimalSlice = decimalSlice;
	NumError.init([["Func", "", Go$String, ""], ["Num", "", Go$String, ""], ["Err", "", go$error, ""]]);
	(go$ptrType(NumError)).methods = [["Error", "", [], [Go$String], false]];
	decimal.init([["d", "strconv", (go$arrayType(Go$Uint8, 800)), ""], ["nd", "strconv", Go$Int, ""], ["dp", "strconv", Go$Int, ""], ["neg", "strconv", Go$Bool, ""], ["trunc", "strconv", Go$Bool, ""]]);
	(go$ptrType(decimal)).methods = [["Assign", "", [Go$Uint64], [], false], ["Round", "", [Go$Int], [], false], ["RoundDown", "", [Go$Int], [], false], ["RoundUp", "", [Go$Int], [], false], ["RoundedInteger", "", [], [Go$Uint64], false], ["Shift", "", [Go$Int], [], false], ["String", "", [], [Go$String], false], ["atof32int", "strconv", [], [Go$Float32], false], ["floatBits", "strconv", [(go$ptrType(floatInfo))], [Go$Uint64, Go$Bool], false], ["set", "strconv", [Go$String], [Go$Bool], false]];
	leftCheat.init([["delta", "strconv", Go$Int, ""], ["cutoff", "strconv", Go$String, ""]]);
	extFloat.init([["mant", "strconv", Go$Uint64, ""], ["exp", "strconv", Go$Int, ""], ["neg", "strconv", Go$Bool, ""]]);
	(go$ptrType(extFloat)).methods = [["AssignComputeBounds", "", [Go$Uint64, Go$Int, Go$Bool, (go$ptrType(floatInfo))], [extFloat, extFloat], false], ["AssignDecimal", "", [Go$Uint64, Go$Int, Go$Bool, Go$Bool, (go$ptrType(floatInfo))], [Go$Bool], false], ["FixedDecimal", "", [(go$ptrType(decimalSlice)), Go$Int], [Go$Bool], false], ["Multiply", "", [extFloat], [], false], ["Normalize", "", [], [Go$Uint], false], ["ShortestDecimal", "", [(go$ptrType(decimalSlice)), (go$ptrType(extFloat)), (go$ptrType(extFloat))], [Go$Bool], false], ["floatBits", "strconv", [(go$ptrType(floatInfo))], [Go$Uint64, Go$Bool], false], ["frexp10", "strconv", [], [Go$Int, Go$Int], false]];
	floatInfo.init([["mantbits", "strconv", Go$Uint, ""], ["expbits", "strconv", Go$Uint, ""], ["bias", "strconv", Go$Int, ""]]);
	decimalSlice.init([["d", "strconv", (go$sliceType(Go$Uint8)), ""], ["nd", "strconv", Go$Int, ""], ["dp", "strconv", Go$Int, ""], ["neg", "strconv", Go$Bool, ""]]);
	var optimize, powtab, float64pow10, float32pow10, leftcheats, smallPowersOfTen, powersOfTen, uint64pow10, float32info, float64info, isPrint16, isNotPrint16, isPrint32, isNotPrint32, shifts;
	var ParseBool = go$pkg.ParseBool = function(str) {
		var value, err, _ref, _tuple, _tuple$1, _tuple$2;
		value = false;
		err = null;
		_ref = str;
		if (_ref === "1" || _ref === "t" || _ref === "T" || _ref === "true" || _ref === "TRUE" || _ref === "True") {
			_tuple = [true, null], value = _tuple[0], err = _tuple[1];
			return [value, err];
		} else if (_ref === "0" || _ref === "f" || _ref === "F" || _ref === "false" || _ref === "FALSE" || _ref === "False") {
			_tuple$1 = [false, null], value = _tuple$1[0], err = _tuple$1[1];
			return [value, err];
		}
		_tuple$2 = [false, syntaxError("ParseBool", str)], value = _tuple$2[0], err = _tuple$2[1];
		return [value, err];
	};
	var FormatBool = go$pkg.FormatBool = function(b) {
		if (b) {
			return "true";
		}
		return "false";
	};
	var AppendBool = go$pkg.AppendBool = function(dst, b) {
		if (b) {
			return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes("true")));
		}
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes("false")));
	};
	var equalIgnoreCase = function(s1, s2) {
		var i, c1, c2;
		if (!((s1.length === s2.length))) {
			return false;
		}
		i = 0;
		while (i < s1.length) {
			c1 = s1.charCodeAt(i);
			if (65 <= c1 && c1 <= 90) {
				c1 = c1 + 32 << 24 >>> 24;
			}
			c2 = s2.charCodeAt(i);
			if (65 <= c2 && c2 <= 90) {
				c2 = c2 + 32 << 24 >>> 24;
			}
			if (!((c1 === c2))) {
				return false;
			}
			i = i + 1 >> 0;
		}
		return true;
	};
	var special = function(s) {
		var f, ok, _ref, _tuple, _tuple$1, _tuple$2, _tuple$3;
		f = 0;
		ok = false;
		if (s.length === 0) {
			return [f, ok];
		}
		_ref = s.charCodeAt(0);
		if (_ref === 43) {
			if (equalIgnoreCase(s, "+inf") || equalIgnoreCase(s, "+infinity")) {
				_tuple = [math.Inf(1), true], f = _tuple[0], ok = _tuple[1];
				return [f, ok];
			}
		} else if (_ref === 45) {
			if (equalIgnoreCase(s, "-inf") || equalIgnoreCase(s, "-infinity")) {
				_tuple$1 = [math.Inf(-1), true], f = _tuple$1[0], ok = _tuple$1[1];
				return [f, ok];
			}
		} else if (_ref === 110 || _ref === 78) {
			if (equalIgnoreCase(s, "nan")) {
				_tuple$2 = [math.NaN(), true], f = _tuple$2[0], ok = _tuple$2[1];
				return [f, ok];
			}
		} else if (_ref === 105 || _ref === 73) {
			if (equalIgnoreCase(s, "inf") || equalIgnoreCase(s, "infinity")) {
				_tuple$3 = [math.Inf(1), true], f = _tuple$3[0], ok = _tuple$3[1];
				return [f, ok];
			}
		} else {
			return [f, ok];
		}
		return [f, ok];
	};
	decimal.Ptr.prototype.set = function(s) {
		var ok, b, i, sawdot, sawdigits, esign, e, x;
		ok = false;
		b = this;
		i = 0;
		b.neg = false;
		b.trunc = false;
		if (i >= s.length) {
			return ok;
		}
		if (s.charCodeAt(i) === 43) {
			i = i + 1 >> 0;
		} else if (s.charCodeAt(i) === 45) {
			b.neg = true;
			i = i + 1 >> 0;
		}
		sawdot = false;
		sawdigits = false;
		while (i < s.length) {
			if (s.charCodeAt(i) === 46) {
				if (sawdot) {
					return ok;
				}
				sawdot = true;
				b.dp = b.nd;
				i = i + 1 >> 0;
				continue;
			} else if (48 <= s.charCodeAt(i) && s.charCodeAt(i) <= 57) {
				sawdigits = true;
				if ((s.charCodeAt(i) === 48) && (b.nd === 0)) {
					b.dp = b.dp - 1 >> 0;
					i = i + 1 >> 0;
					continue;
				}
				if (b.nd < 800) {
					b.d[b.nd] = s.charCodeAt(i);
					b.nd = b.nd + 1 >> 0;
				} else if (!((s.charCodeAt(i) === 48))) {
					b.trunc = true;
				}
				i = i + 1 >> 0;
				continue;
			}
			break;
		}
		if (!sawdigits) {
			return ok;
		}
		if (!sawdot) {
			b.dp = b.nd;
		}
		if (i < s.length && ((s.charCodeAt(i) === 101) || (s.charCodeAt(i) === 69))) {
			i = i + 1 >> 0;
			if (i >= s.length) {
				return ok;
			}
			esign = 1;
			if (s.charCodeAt(i) === 43) {
				i = i + 1 >> 0;
			} else if (s.charCodeAt(i) === 45) {
				i = i + 1 >> 0;
				esign = -1;
			}
			if (i >= s.length || s.charCodeAt(i) < 48 || s.charCodeAt(i) > 57) {
				return ok;
			}
			e = 0;
			while (i < s.length && 48 <= s.charCodeAt(i) && s.charCodeAt(i) <= 57) {
				if (e < 10000) {
					e = ((x = 10, (((e >>> 16 << 16) * x >> 0) + (e << 16 >>> 16) * x) >> 0) + (s.charCodeAt(i) >> 0) >> 0) - 48 >> 0;
				}
				i = i + 1 >> 0;
			}
			b.dp = b.dp + (((((e >>> 16 << 16) * esign >> 0) + (e << 16 >>> 16) * esign) >> 0)) >> 0;
		}
		if (!((i === s.length))) {
			return ok;
		}
		ok = true;
		return ok;
	};
	decimal.prototype.set = function(s) { return this.go$val.set(s); };
	var readFloat = function(s) {
		var mantissa, exp, neg, trunc, ok, i, sawdot, sawdigits, nd, ndMant, dp, c, _ref, x, esign, e, x$1;
		mantissa = new Go$Uint64(0, 0);
		exp = 0;
		neg = false;
		trunc = false;
		ok = false;
		i = 0;
		if (i >= s.length) {
			return [mantissa, exp, neg, trunc, ok];
		}
		if (s.charCodeAt(i) === 43) {
			i = i + 1 >> 0;
		} else if (s.charCodeAt(i) === 45) {
			neg = true;
			i = i + 1 >> 0;
		}
		sawdot = false;
		sawdigits = false;
		nd = 0;
		ndMant = 0;
		dp = 0;
		while (i < s.length) {
			c = s.charCodeAt(i);
			_ref = true;
			if (_ref === (c === 46)) {
				if (sawdot) {
					return [mantissa, exp, neg, trunc, ok];
				}
				sawdot = true;
				dp = nd;
				i = i + 1 >> 0;
				continue;
			} else if (_ref === 48 <= c && c <= 57) {
				sawdigits = true;
				if ((c === 48) && (nd === 0)) {
					dp = dp - 1 >> 0;
					i = i + 1 >> 0;
					continue;
				}
				nd = nd + 1 >> 0;
				if (ndMant < 19) {
					mantissa = go$mul64(mantissa, new Go$Uint64(0, 10));
					mantissa = (x = new Go$Uint64(0, (c - 48 << 24 >>> 24)), new Go$Uint64(mantissa.high + x.high, mantissa.low + x.low));
					ndMant = ndMant + 1 >> 0;
				} else if (!((s.charCodeAt(i) === 48))) {
					trunc = true;
				}
				i = i + 1 >> 0;
				continue;
			}
			break;
		}
		if (!sawdigits) {
			return [mantissa, exp, neg, trunc, ok];
		}
		if (!sawdot) {
			dp = nd;
		}
		if (i < s.length && ((s.charCodeAt(i) === 101) || (s.charCodeAt(i) === 69))) {
			i = i + 1 >> 0;
			if (i >= s.length) {
				return [mantissa, exp, neg, trunc, ok];
			}
			esign = 1;
			if (s.charCodeAt(i) === 43) {
				i = i + 1 >> 0;
			} else if (s.charCodeAt(i) === 45) {
				i = i + 1 >> 0;
				esign = -1;
			}
			if (i >= s.length || s.charCodeAt(i) < 48 || s.charCodeAt(i) > 57) {
				return [mantissa, exp, neg, trunc, ok];
			}
			e = 0;
			while (i < s.length && 48 <= s.charCodeAt(i) && s.charCodeAt(i) <= 57) {
				if (e < 10000) {
					e = ((x$1 = 10, (((e >>> 16 << 16) * x$1 >> 0) + (e << 16 >>> 16) * x$1) >> 0) + (s.charCodeAt(i) >> 0) >> 0) - 48 >> 0;
				}
				i = i + 1 >> 0;
			}
			dp = dp + (((((e >>> 16 << 16) * esign >> 0) + (e << 16 >>> 16) * esign) >> 0)) >> 0;
		}
		if (!((i === s.length))) {
			return [mantissa, exp, neg, trunc, ok];
		}
		exp = dp - ndMant >> 0;
		ok = true;
		return [mantissa, exp, neg, trunc, ok];
	};
	decimal.Ptr.prototype.floatBits = function(flt) {
		var go$this = this, b, overflow, d, exp, mant, n, _slice, _index, n$1, _slice$1, _index$1, n$2, y, x, y$1, x$1, x$2, y$2, x$3, x$4, bits, x$5, y$3, x$6, _tuple;
		b = new Go$Uint64(0, 0);
		overflow = false;
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		d = go$this;
		exp = 0;
		mant = new Go$Uint64(0, 0);
		/* if (d.nd === 0) { */ if (d.nd === 0) {} else { go$s = 3; continue; }
			mant = new Go$Uint64(0, 0);
			exp = flt.bias;
			/* goto out */ go$s = 1; continue;
		/* } */ case 3:
		/* if (d.dp > 310) { */ if (d.dp > 310) {} else { go$s = 4; continue; }
			/* goto overflow */ go$s = 2; continue;
		/* } */ case 4:
		/* if (d.dp < -330) { */ if (d.dp < -330) {} else { go$s = 5; continue; }
			mant = new Go$Uint64(0, 0);
			exp = flt.bias;
			/* goto out */ go$s = 1; continue;
		/* } */ case 5:
		exp = 0;
		while (d.dp > 0) {
			n = 0;
			if (d.dp >= powtab.length) {
				n = 27;
			} else {
				n = (_slice = powtab, _index = d.dp, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			}
			d.Shift(-n);
			exp = exp + (n) >> 0;
		}
		while (d.dp < 0 || (d.dp === 0) && d.d[0] < 53) {
			n$1 = 0;
			if (-d.dp >= powtab.length) {
				n$1 = 27;
			} else {
				n$1 = (_slice$1 = powtab, _index$1 = -d.dp, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
			}
			d.Shift(n$1);
			exp = exp - (n$1) >> 0;
		}
		exp = exp - 1 >> 0;
		if (exp < (flt.bias + 1 >> 0)) {
			n$2 = (flt.bias + 1 >> 0) - exp >> 0;
			d.Shift(-n$2);
			exp = exp + (n$2) >> 0;
		}
		/* if ((exp - flt.bias >> 0) >= (((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0)) { */ if ((exp - flt.bias >> 0) >= (((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0)) {} else { go$s = 6; continue; }
			/* goto overflow */ go$s = 2; continue;
		/* } */ case 6:
		d.Shift(((1 + flt.mantbits >>> 0) >> 0));
		mant = d.RoundedInteger();
		/* if ((x = go$shiftLeft64(new Go$Uint64(0, 2), flt.mantbits), (mant.high === x.high && mant.low === x.low))) { */ if ((x = go$shiftLeft64(new Go$Uint64(0, 2), flt.mantbits), (mant.high === x.high && mant.low === x.low))) {} else { go$s = 7; continue; }
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
			/* if ((exp - flt.bias >> 0) >= (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0)) { */ if ((exp - flt.bias >> 0) >= (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0)) {} else { go$s = 8; continue; }
				/* goto overflow */ go$s = 2; continue;
			/* } */ case 8:
		/* } */ case 7:
		if ((x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(mant.high & x$2.high, (mant.low & x$2.low) >>> 0)), (x$1.high === 0 && x$1.low === 0))) {
			exp = flt.bias;
		}
		/* goto out */ go$s = 1; continue;
		/* overflow: */ case 2:
		mant = new Go$Uint64(0, 0);
		exp = (((y$2 = flt.expbits, y$2 < 32 ? (1 << y$2) : 0) >> 0) - 1 >> 0) + flt.bias >> 0;
		overflow = true;
		/* out: */ case 1:
		bits = (x$3 = (x$4 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(x$4.high - 0, x$4.low - 1)), new Go$Uint64(mant.high & x$3.high, (mant.low & x$3.low) >>> 0));
		bits = (x$5 = go$shiftLeft64(new Go$Uint64(0, (((exp - flt.bias >> 0)) & ((((y$3 = flt.expbits, y$3 < 32 ? (1 << y$3) : 0) >> 0) - 1 >> 0)))), flt.mantbits), new Go$Uint64(bits.high | x$5.high, (bits.low | x$5.low) >>> 0));
		if (d.neg) {
			bits = (x$6 = go$shiftLeft64(go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), flt.expbits), new Go$Uint64(bits.high | x$6.high, (bits.low | x$6.low) >>> 0));
		}
		_tuple = [bits, overflow], b = _tuple[0], overflow = _tuple[1];
		return [b, overflow];
		/* */ } break; } }; return go$f();
	};
	decimal.prototype.floatBits = function(flt) { return this.go$val.floatBits(flt); };
	decimal.Ptr.prototype.atof32int = function() {
		var d, f, i;
		d = this;
		f = 0;
		i = 0;
		while (i < d.nd) {
			f = f * 10 + (d.d[i] - 48 << 24 >>> 24);
			i = i + 1 >> 0;
		}
		if (d.neg) {
			f = -f;
		}
		return f;
	};
	decimal.prototype.atof32int = function() { return this.go$val.atof32int(); };
	var atof64exact = function(mantissa, exp, neg) {
		var f, ok, x, _tuple, _slice, _index, _slice$1, _index$1, _tuple$1, _slice$2, _index$2, _tuple$2;
		f = 0;
		ok = false;
		if (!((x = go$shiftRightUint64(mantissa, float64info.mantbits), (x.high === 0 && x.low === 0)))) {
			return [f, ok];
		}
		f = go$flatten64(mantissa);
		if (neg) {
			f = -f;
		}
		if (exp === 0) {
			_tuple = [f, true], f = _tuple[0], ok = _tuple[1];
			return [f, ok];
		} else if (exp > 0 && exp <= 37) {
			if (exp > 22) {
				f = f * ((_slice = float64pow10, _index = (exp - 22 >> 0), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")));
				exp = 22;
			}
			if (f > 1e+15 || f < -1e+15) {
				return [f, ok];
			}
			_tuple$1 = [f * (_slice$1 = float64pow10, _index$1 = exp, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), true], f = _tuple$1[0], ok = _tuple$1[1];
			return [f, ok];
		} else if (exp < 0 && exp >= -22) {
			_tuple$2 = [f / (_slice$2 = float64pow10, _index$2 = -exp, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), true], f = _tuple$2[0], ok = _tuple$2[1];
			return [f, ok];
		}
		return [f, ok];
	};
	var atof32exact = function(mantissa, exp, neg) {
		var f, ok, x, _tuple, _slice, _index, _slice$1, _index$1, _tuple$1, _slice$2, _index$2, _tuple$2;
		f = 0;
		ok = false;
		if (!((x = go$shiftRightUint64(mantissa, float32info.mantbits), (x.high === 0 && x.low === 0)))) {
			return [f, ok];
		}
		f = go$flatten64(mantissa);
		if (neg) {
			f = -f;
		}
		if (exp === 0) {
			_tuple = [f, true], f = _tuple[0], ok = _tuple[1];
			return [f, ok];
		} else if (exp > 0 && exp <= 17) {
			if (exp > 10) {
				f = f * ((_slice = float32pow10, _index = (exp - 10 >> 0), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")));
				exp = 10;
			}
			if (f > 1e+07 || f < -1e+07) {
				return [f, ok];
			}
			_tuple$1 = [f * (_slice$1 = float32pow10, _index$1 = exp, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), true], f = _tuple$1[0], ok = _tuple$1[1];
			return [f, ok];
		} else if (exp < 0 && exp >= -10) {
			_tuple$2 = [f / (_slice$2 = float32pow10, _index$2 = -exp, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), true], f = _tuple$2[0], ok = _tuple$2[1];
			return [f, ok];
		}
		return [f, ok];
	};
	var atof32 = function(s) {
		var f, err, ok, _tuple, val, _tuple$1, _tuple$2, mantissa, exp, neg, trunc, ok$1, ok$2, _tuple$3, f$1, _tuple$4, ext, ok$3, _tuple$5, b, ovf, _tuple$6, d, _tuple$7, _tuple$8, b$1, ovf$1, _tuple$9;
		f = 0;
		err = null;
		if (_tuple = special(s), val = _tuple[0], ok = _tuple[1], ok) {
			_tuple$1 = [val, null], f = _tuple$1[0], err = _tuple$1[1];
			return [f, err];
		}
		if (optimize) {
			_tuple$2 = readFloat(s), mantissa = _tuple$2[0], exp = _tuple$2[1], neg = _tuple$2[2], trunc = _tuple$2[3], ok$1 = _tuple$2[4];
			if (ok$1) {
				if (!trunc) {
					if (_tuple$3 = atof32exact(mantissa, exp, neg), f$1 = _tuple$3[0], ok$2 = _tuple$3[1], ok$2) {
						_tuple$4 = [f$1, null], f = _tuple$4[0], err = _tuple$4[1];
						return [f, err];
					}
				}
				ext = new extFloat.Ptr();
				if (ok$3 = ext.AssignDecimal(mantissa, exp, neg, trunc, float32info), ok$3) {
					_tuple$5 = ext.floatBits(float32info), b = _tuple$5[0], ovf = _tuple$5[1];
					f = math.Float32frombits((b.low >>> 0));
					if (ovf) {
						err = rangeError("ParseFloat", s);
					}
					_tuple$6 = [f, err], f = _tuple$6[0], err = _tuple$6[1];
					return [f, err];
				}
			}
		}
		d = new decimal.Ptr();
		if (!d.set(s)) {
			_tuple$7 = [0, syntaxError("ParseFloat", s)], f = _tuple$7[0], err = _tuple$7[1];
			return [f, err];
		}
		_tuple$8 = d.floatBits(float32info), b$1 = _tuple$8[0], ovf$1 = _tuple$8[1];
		f = math.Float32frombits((b$1.low >>> 0));
		if (ovf$1) {
			err = rangeError("ParseFloat", s);
		}
		_tuple$9 = [f, err], f = _tuple$9[0], err = _tuple$9[1];
		return [f, err];
	};
	var atof64 = function(s) {
		var f, err, ok, _tuple, val, _tuple$1, _tuple$2, mantissa, exp, neg, trunc, ok$1, ok$2, _tuple$3, f$1, _tuple$4, ext, ok$3, _tuple$5, b, ovf, _tuple$6, d, _tuple$7, _tuple$8, b$1, ovf$1, _tuple$9;
		f = 0;
		err = null;
		if (_tuple = special(s), val = _tuple[0], ok = _tuple[1], ok) {
			_tuple$1 = [val, null], f = _tuple$1[0], err = _tuple$1[1];
			return [f, err];
		}
		if (optimize) {
			_tuple$2 = readFloat(s), mantissa = _tuple$2[0], exp = _tuple$2[1], neg = _tuple$2[2], trunc = _tuple$2[3], ok$1 = _tuple$2[4];
			if (ok$1) {
				if (!trunc) {
					if (_tuple$3 = atof64exact(mantissa, exp, neg), f$1 = _tuple$3[0], ok$2 = _tuple$3[1], ok$2) {
						_tuple$4 = [f$1, null], f = _tuple$4[0], err = _tuple$4[1];
						return [f, err];
					}
				}
				ext = new extFloat.Ptr();
				if (ok$3 = ext.AssignDecimal(mantissa, exp, neg, trunc, float64info), ok$3) {
					_tuple$5 = ext.floatBits(float64info), b = _tuple$5[0], ovf = _tuple$5[1];
					f = math.Float64frombits(b);
					if (ovf) {
						err = rangeError("ParseFloat", s);
					}
					_tuple$6 = [f, err], f = _tuple$6[0], err = _tuple$6[1];
					return [f, err];
				}
			}
		}
		d = new decimal.Ptr();
		if (!d.set(s)) {
			_tuple$7 = [0, syntaxError("ParseFloat", s)], f = _tuple$7[0], err = _tuple$7[1];
			return [f, err];
		}
		_tuple$8 = d.floatBits(float64info), b$1 = _tuple$8[0], ovf$1 = _tuple$8[1];
		f = math.Float64frombits(b$1);
		if (ovf$1) {
			err = rangeError("ParseFloat", s);
		}
		_tuple$9 = [f, err], f = _tuple$9[0], err = _tuple$9[1];
		return [f, err];
	};
	var ParseFloat = go$pkg.ParseFloat = function(s, bitSize) {
		var f, err, _tuple, f1, err1, _tuple$1, _tuple$2, f1$1, err1$1, _tuple$3;
		f = 0;
		err = null;
		if (bitSize === 32) {
			_tuple = atof32(s), f1 = _tuple[0], err1 = _tuple[1];
			_tuple$1 = [f1, err1], f = _tuple$1[0], err = _tuple$1[1];
			return [f, err];
		}
		_tuple$2 = atof64(s), f1$1 = _tuple$2[0], err1$1 = _tuple$2[1];
		_tuple$3 = [f1$1, err1$1], f = _tuple$3[0], err = _tuple$3[1];
		return [f, err];
	};
	NumError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return "strconv." + e.Func + ": " + "parsing " + Quote(e.Num) + ": " + e.Err.Error();
	};
	NumError.prototype.Error = function() { return this.go$val.Error(); };
	var syntaxError = function(fn, str) {
		return new NumError.Ptr(fn, str, go$pkg.ErrSyntax);
	};
	var rangeError = function(fn, str) {
		return new NumError.Ptr(fn, str, go$pkg.ErrRange);
	};
	var cutoff64 = function(base) {
		var x;
		if (base < 2) {
			return new Go$Uint64(0, 0);
		}
		return (x = go$div64(new Go$Uint64(4294967295, 4294967295), new Go$Uint64(0, base), false), new Go$Uint64(x.high + 0, x.low + 1));
	};
	var ParseUint = go$pkg.ParseUint = function(s, base, bitSize) {
		var go$this = this, n, err, _tuple, cutoff, maxVal, s0, x, i, v, d, x$1, n1, _tuple$1, _tuple$2;
		n = new Go$Uint64(0, 0);
		err = null;
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		_tuple = [new Go$Uint64(0, 0), new Go$Uint64(0, 0)], cutoff = _tuple[0], maxVal = _tuple[1];
		if (bitSize === 0) {
			bitSize = 32;
		}
		s0 = s;
		/* if (s.length < 1) { */ if (s.length < 1) {} else if (2 <= base && base <= 36) { go$s = 2; continue; } else if (base === 0) { go$s = 3; continue; } else { go$s = 4; continue; }
			err = go$pkg.ErrSyntax;
			/* goto Error */ go$s = 1; continue;
		/* } else if (2 <= base && base <= 36) { */ go$s = 5; continue; case 2: 
		/* } else if (base === 0) { */ go$s = 5; continue; case 3: 
			/* if ((s.charCodeAt(0) === 48) && s.length > 1 && ((s.charCodeAt(1) === 120) || (s.charCodeAt(1) === 88))) { */ if ((s.charCodeAt(0) === 48) && s.length > 1 && ((s.charCodeAt(1) === 120) || (s.charCodeAt(1) === 88))) {} else if (s.charCodeAt(0) === 48) { go$s = 6; continue; } else { go$s = 7; continue; }
				base = 16;
				s = s.substring(2);
				/* if (s.length < 1) { */ if (s.length < 1) {} else { go$s = 9; continue; }
					err = go$pkg.ErrSyntax;
					/* goto Error */ go$s = 1; continue;
				/* } */ case 9:
			/* } else if (s.charCodeAt(0) === 48) { */ go$s = 8; continue; case 6: 
				base = 8;
			/* } else { */ go$s = 8; continue; case 7: 
				base = 10;
			/* } */ case 8:
		/* } else { */ go$s = 5; continue; case 4: 
			err = errors.New("invalid base " + Itoa(base));
			/* goto Error */ go$s = 1; continue;
		/* } */ case 5:
		n = new Go$Uint64(0, 0);
		cutoff = cutoff64(base);
		maxVal = (x = go$shiftLeft64(new Go$Uint64(0, 1), (bitSize >>> 0)), new Go$Uint64(x.high - 0, x.low - 1));
		i = 0;
		/* while (i < s.length) { */ case 10: if(!(i < s.length)) { go$s = 11; continue; }
			v = 0;
			d = s.charCodeAt(i);
			/* if (48 <= d && d <= 57) { */ if (48 <= d && d <= 57) {} else if (97 <= d && d <= 122) { go$s = 12; continue; } else if (65 <= d && d <= 90) { go$s = 13; continue; } else { go$s = 14; continue; }
				v = d - 48 << 24 >>> 24;
			/* } else if (97 <= d && d <= 122) { */ go$s = 15; continue; case 12: 
				v = (d - 97 << 24 >>> 24) + 10 << 24 >>> 24;
			/* } else if (65 <= d && d <= 90) { */ go$s = 15; continue; case 13: 
				v = (d - 65 << 24 >>> 24) + 10 << 24 >>> 24;
			/* } else { */ go$s = 15; continue; case 14: 
				n = new Go$Uint64(0, 0);
				err = go$pkg.ErrSyntax;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 15:
			/* if ((v >> 0) >= base) { */ if ((v >> 0) >= base) {} else { go$s = 16; continue; }
				n = new Go$Uint64(0, 0);
				err = go$pkg.ErrSyntax;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 16:
			/* if ((n.high > cutoff.high || (n.high === cutoff.high && n.low >= cutoff.low))) { */ if ((n.high > cutoff.high || (n.high === cutoff.high && n.low >= cutoff.low))) {} else { go$s = 17; continue; }
				n = new Go$Uint64(4294967295, 4294967295);
				err = go$pkg.ErrRange;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 17:
			n = go$mul64(n, (new Go$Uint64(0, base)));
			n1 = (x$1 = new Go$Uint64(0, v), new Go$Uint64(n.high + x$1.high, n.low + x$1.low));
			/* if ((n1.high < n.high || (n1.high === n.high && n1.low < n.low)) || (n1.high > maxVal.high || (n1.high === maxVal.high && n1.low > maxVal.low))) { */ if ((n1.high < n.high || (n1.high === n.high && n1.low < n.low)) || (n1.high > maxVal.high || (n1.high === maxVal.high && n1.low > maxVal.low))) {} else { go$s = 18; continue; }
				n = new Go$Uint64(4294967295, 4294967295);
				err = go$pkg.ErrRange;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 18:
			n = n1;
			i = i + 1 >> 0;
		/* } */ go$s = 10; continue; case 11:
		_tuple$1 = [n, null], n = _tuple$1[0], err = _tuple$1[1];
		return [n, err];
		/* Error: */ case 1:
		_tuple$2 = [n, new NumError.Ptr("ParseUint", s0, err)], n = _tuple$2[0], err = _tuple$2[1];
		return [n, err];
		/* */ } break; } }; return go$f();
	};
	var ParseInt = go$pkg.ParseInt = function(s, base, bitSize) {
		var i, err, _tuple, s0, neg, un, _tuple$1, _tuple$2, cutoff, x, _tuple$3, x$1, _tuple$4, n, _tuple$5;
		i = new Go$Int64(0, 0);
		err = null;
		if (bitSize === 0) {
			bitSize = 32;
		}
		if (s.length === 0) {
			_tuple = [new Go$Int64(0, 0), syntaxError("ParseInt", s)], i = _tuple[0], err = _tuple[1];
			return [i, err];
		}
		s0 = s;
		neg = false;
		if (s.charCodeAt(0) === 43) {
			s = s.substring(1);
		} else if (s.charCodeAt(0) === 45) {
			neg = true;
			s = s.substring(1);
		}
		un = new Go$Uint64(0, 0);
		_tuple$1 = ParseUint(s, base, bitSize), un = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null)) && !(go$interfaceIsEqual((err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Err, go$pkg.ErrRange))) {
			(err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Func = "ParseInt";
			(err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Num = s0;
			_tuple$2 = [new Go$Int64(0, 0), err], i = _tuple$2[0], err = _tuple$2[1];
			return [i, err];
		}
		cutoff = go$shiftLeft64(new Go$Uint64(0, 1), ((bitSize - 1 >> 0) >>> 0));
		if (!neg && (un.high > cutoff.high || (un.high === cutoff.high && un.low >= cutoff.low))) {
			_tuple$3 = [(x = new Go$Uint64(cutoff.high - 0, cutoff.low - 1), new Go$Int64(x.high, x.low)), rangeError("ParseInt", s0)], i = _tuple$3[0], err = _tuple$3[1];
			return [i, err];
		}
		if (neg && (un.high > cutoff.high || (un.high === cutoff.high && un.low > cutoff.low))) {
			_tuple$4 = [(x$1 = new Go$Int64(cutoff.high, cutoff.low), new Go$Int64(-x$1.high, -x$1.low)), rangeError("ParseInt", s0)], i = _tuple$4[0], err = _tuple$4[1];
			return [i, err];
		}
		n = new Go$Int64(un.high, un.low);
		if (neg) {
			n = new Go$Int64(-n.high, -n.low);
		}
		_tuple$5 = [n, null], i = _tuple$5[0], err = _tuple$5[1];
		return [i, err];
	};
	var Atoi = go$pkg.Atoi = function(s) {
		var i, err, _tuple, i64, _tuple$1;
		i = 0;
		err = null;
		_tuple = ParseInt(s, 10, 0), i64 = _tuple[0], err = _tuple[1];
		_tuple$1 = [((i64.low + ((i64.high >> 31) * 4294967296)) >> 0), err], i = _tuple$1[0], err = _tuple$1[1];
		return [i, err];
	};
	decimal.Ptr.prototype.String = function() {
		var a, n, buf, w, _slice, _index, _slice$1, _index$1, _slice$2, _index$2;
		a = this;
		n = 10 + a.nd >> 0;
		if (a.dp > 0) {
			n = n + (a.dp) >> 0;
		}
		if (a.dp < 0) {
			n = n + (-a.dp) >> 0;
		}
		buf = (go$sliceType(Go$Uint8)).make(n, 0, function() { return 0; });
		w = 0;
		if (a.nd === 0) {
			return "0";
		} else if (a.dp <= 0) {
			_slice = buf, _index = w, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = 48) : go$throwRuntimeError("index out of range");
			w = w + 1 >> 0;
			_slice$1 = buf, _index$1 = w, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = 46) : go$throwRuntimeError("index out of range");
			w = w + 1 >> 0;
			w = w + (digitZero(go$subslice(buf, w, (w + -a.dp >> 0)))) >> 0;
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.nd))) >> 0;
		} else if (a.dp < a.nd) {
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.dp))) >> 0;
			_slice$2 = buf, _index$2 = w, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = 46) : go$throwRuntimeError("index out of range");
			w = w + 1 >> 0;
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), a.dp, a.nd))) >> 0;
		} else {
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.nd))) >> 0;
			w = w + (digitZero(go$subslice(buf, w, ((w + a.dp >> 0) - a.nd >> 0)))) >> 0;
		}
		return go$bytesToString(go$subslice(buf, 0, w));
	};
	decimal.prototype.String = function() { return this.go$val.String(); };
	var digitZero = function(dst) {
		var _ref, _i, i, _slice, _index;
		_ref = dst;
		_i = 0;
		while (_i < _ref.length) {
			i = _i;
			_slice = dst, _index = i, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = 48) : go$throwRuntimeError("index out of range");
			_i++;
		}
		return dst.length;
	};
	var trim = function(a) {
		while (a.nd > 0 && (a.d[(a.nd - 1 >> 0)] === 48)) {
			a.nd = a.nd - 1 >> 0;
		}
		if (a.nd === 0) {
			a.dp = 0;
		}
	};
	decimal.Ptr.prototype.Assign = function(v) {
		var a, buf, n, v1, x;
		a = this;
		buf = go$makeNativeArray("Uint8", 24, function() { return 0; });
		n = 0;
		while ((v.high > 0 || (v.high === 0 && v.low > 0))) {
			v1 = go$div64(v, new Go$Uint64(0, 10), false);
			v = (x = go$mul64(new Go$Uint64(0, 10), v1), new Go$Uint64(v.high - x.high, v.low - x.low));
			buf[n] = (new Go$Uint64(v.high + 0, v.low + 48).low << 24 >>> 24);
			n = n + 1 >> 0;
			v = v1;
		}
		a.nd = 0;
		n = n - 1 >> 0;
		while (n >= 0) {
			a.d[a.nd] = buf[n];
			a.nd = a.nd + 1 >> 0;
			n = n - 1 >> 0;
		}
		a.dp = a.nd;
		trim(a);
	};
	decimal.prototype.Assign = function(v) { return this.go$val.Assign(v); };
	var rightShift = function(a, k) {
		var r, w, n, x, c, x$1, c$1, dig, y, x$2, dig$1, y$1, x$3;
		r = 0;
		w = 0;
		n = 0;
		while (((n >> go$min(k, 31)) >> 0) === 0) {
			if (r >= a.nd) {
				if (n === 0) {
					a.nd = 0;
					return;
				}
				while (((n >> go$min(k, 31)) >> 0) === 0) {
					n = (x = 10, (((n >>> 16 << 16) * x >> 0) + (n << 16 >>> 16) * x) >> 0);
					r = r + 1 >> 0;
				}
				break;
			}
			c = (a.d[r] >> 0);
			n = ((x$1 = 10, (((n >>> 16 << 16) * x$1 >> 0) + (n << 16 >>> 16) * x$1) >> 0) + c >> 0) - 48 >> 0;
			r = r + 1 >> 0;
		}
		a.dp = a.dp - ((r - 1 >> 0)) >> 0;
		while (r < a.nd) {
			c$1 = (a.d[r] >> 0);
			dig = (n >> go$min(k, 31)) >> 0;
			n = n - (((y = k, y < 32 ? (dig << y) : 0) >> 0)) >> 0;
			a.d[w] = ((dig + 48 >> 0) << 24 >>> 24);
			w = w + 1 >> 0;
			n = ((x$2 = 10, (((n >>> 16 << 16) * x$2 >> 0) + (n << 16 >>> 16) * x$2) >> 0) + c$1 >> 0) - 48 >> 0;
			r = r + 1 >> 0;
		}
		while (n > 0) {
			dig$1 = (n >> go$min(k, 31)) >> 0;
			n = n - (((y$1 = k, y$1 < 32 ? (dig$1 << y$1) : 0) >> 0)) >> 0;
			if (w < 800) {
				a.d[w] = ((dig$1 + 48 >> 0) << 24 >>> 24);
				w = w + 1 >> 0;
			} else if (dig$1 > 0) {
				a.trunc = true;
			}
			n = (x$3 = 10, (((n >>> 16 << 16) * x$3 >> 0) + (n << 16 >>> 16) * x$3) >> 0);
		}
		a.nd = w;
		trim(a);
	};
	var prefixIsLessThan = function(b, s) {
		var i, _slice, _index, _slice$1, _index$1;
		i = 0;
		while (i < s.length) {
			if (i >= b.length) {
				return true;
			}
			if (!(((_slice = b, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === s.charCodeAt(i)))) {
				return (_slice$1 = b, _index$1 = i, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) < s.charCodeAt(i);
			}
			i = i + 1 >> 0;
		}
		return false;
	};
	var leftShift = function(a, k) {
		var _slice, _index, delta, _slice$1, _index$1, r, w, n, y, _q, quo, x, rem, _q$1, quo$1, x$1, rem$1;
		delta = (_slice = leftcheats, _index = k, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")).delta;
		if (prefixIsLessThan(go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.nd), (_slice$1 = leftcheats, _index$1 = k, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")).cutoff)) {
			delta = delta - 1 >> 0;
		}
		r = a.nd;
		w = a.nd + delta >> 0;
		n = 0;
		r = r - 1 >> 0;
		while (r >= 0) {
			n = n + (((y = k, y < 32 ? ((((a.d[r] >> 0) - 48 >> 0)) << y) : 0) >> 0)) >> 0;
			quo = (_q = n / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			rem = n - (x = 10, (((x >>> 16 << 16) * quo >> 0) + (x << 16 >>> 16) * quo) >> 0) >> 0;
			w = w - 1 >> 0;
			if (w < 800) {
				a.d[w] = ((rem + 48 >> 0) << 24 >>> 24);
			} else if (!((rem === 0))) {
				a.trunc = true;
			}
			n = quo;
			r = r - 1 >> 0;
		}
		while (n > 0) {
			quo$1 = (_q$1 = n / 10, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
			rem$1 = n - (x$1 = 10, (((x$1 >>> 16 << 16) * quo$1 >> 0) + (x$1 << 16 >>> 16) * quo$1) >> 0) >> 0;
			w = w - 1 >> 0;
			if (w < 800) {
				a.d[w] = ((rem$1 + 48 >> 0) << 24 >>> 24);
			} else if (!((rem$1 === 0))) {
				a.trunc = true;
			}
			n = quo$1;
		}
		a.nd = a.nd + (delta) >> 0;
		if (a.nd >= 800) {
			a.nd = 800;
		}
		a.dp = a.dp + (delta) >> 0;
		trim(a);
	};
	decimal.Ptr.prototype.Shift = function(k) {
		var a;
		a = this;
		if (a.nd === 0) {
		} else if (k > 0) {
			while (k > 27) {
				leftShift(a, 27);
				k = k - 27 >> 0;
			}
			leftShift(a, (k >>> 0));
		} else if (k < 0) {
			while (k < -27) {
				rightShift(a, 27);
				k = k + 27 >> 0;
			}
			rightShift(a, (-k >>> 0));
		}
	};
	decimal.prototype.Shift = function(k) { return this.go$val.Shift(k); };
	var shouldRoundUp = function(a, nd) {
		var _r;
		if (nd < 0 || nd >= a.nd) {
			return false;
		}
		if ((a.d[nd] === 53) && ((nd + 1 >> 0) === a.nd)) {
			if (a.trunc) {
				return true;
			}
			return nd > 0 && !(((_r = ((a.d[(nd - 1 >> 0)] - 48 << 24 >>> 24)) % 2, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 0));
		}
		return a.d[nd] >= 53;
	};
	decimal.Ptr.prototype.Round = function(nd) {
		var a;
		a = this;
		if (nd < 0 || nd >= a.nd) {
			return;
		}
		if (shouldRoundUp(a, nd)) {
			a.RoundUp(nd);
		} else {
			a.RoundDown(nd);
		}
	};
	decimal.prototype.Round = function(nd) { return this.go$val.Round(nd); };
	decimal.Ptr.prototype.RoundDown = function(nd) {
		var a;
		a = this;
		if (nd < 0 || nd >= a.nd) {
			return;
		}
		a.nd = nd;
		trim(a);
	};
	decimal.prototype.RoundDown = function(nd) { return this.go$val.RoundDown(nd); };
	decimal.Ptr.prototype.RoundUp = function(nd) {
		var a, i, c, _lhs, _index;
		a = this;
		if (nd < 0 || nd >= a.nd) {
			return;
		}
		i = nd - 1 >> 0;
		while (i >= 0) {
			c = a.d[i];
			if (c < 57) {
				_lhs = a.d, _index = i, _lhs[_index] = _lhs[_index] + 1 << 24 >>> 24;
				a.nd = i + 1 >> 0;
				return;
			}
			i = i - 1 >> 0;
		}
		a.d[0] = 49;
		a.nd = 1;
		a.dp = a.dp + 1 >> 0;
	};
	decimal.prototype.RoundUp = function(nd) { return this.go$val.RoundUp(nd); };
	decimal.Ptr.prototype.RoundedInteger = function() {
		var a, i, n, x, x$1;
		a = this;
		if (a.dp > 20) {
			return new Go$Uint64(4294967295, 4294967295);
		}
		i = 0;
		n = new Go$Uint64(0, 0);
		i = 0;
		while (i < a.dp && i < a.nd) {
			n = (x = go$mul64(n, new Go$Uint64(0, 10)), x$1 = new Go$Uint64(0, (a.d[i] - 48 << 24 >>> 24)), new Go$Uint64(x.high + x$1.high, x.low + x$1.low));
			i = i + 1 >> 0;
		}
		while (i < a.dp) {
			n = go$mul64(n, new Go$Uint64(0, 10));
			i = i + 1 >> 0;
		}
		if (shouldRoundUp(a, a.dp)) {
			n = new Go$Uint64(n.high + 0, n.low + 1);
		}
		return n;
	};
	decimal.prototype.RoundedInteger = function() { return this.go$val.RoundedInteger(); };
	extFloat.Ptr.prototype.floatBits = function(flt) {
		var bits, overflow, f, exp, n, mant, x, x$1, x$2, x$3, y, x$4, x$5, y$1, x$6, x$7, x$8, y$2, x$9;
		bits = new Go$Uint64(0, 0);
		overflow = false;
		f = this;
		f.Normalize();
		exp = f.exp + 63 >> 0;
		if (exp < (flt.bias + 1 >> 0)) {
			n = (flt.bias + 1 >> 0) - exp >> 0;
			f.mant = go$shiftRightUint64(f.mant, ((n >>> 0)));
			exp = exp + (n) >> 0;
		}
		mant = go$shiftRightUint64(f.mant, ((63 - flt.mantbits >>> 0)));
		if (!((x = (x$1 = f.mant, x$2 = go$shiftLeft64(new Go$Uint64(0, 1), ((62 - flt.mantbits >>> 0))), new Go$Uint64(x$1.high & x$2.high, (x$1.low & x$2.low) >>> 0)), (x.high === 0 && x.low === 0)))) {
			mant = new Go$Uint64(mant.high + 0, mant.low + 1);
		}
		if ((x$3 = go$shiftLeft64(new Go$Uint64(0, 2), flt.mantbits), (mant.high === x$3.high && mant.low === x$3.low))) {
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
		}
		if ((exp - flt.bias >> 0) >= (((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0)) {
			mant = new Go$Uint64(0, 0);
			exp = (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0) + flt.bias >> 0;
			overflow = true;
		} else if ((x$4 = (x$5 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(mant.high & x$5.high, (mant.low & x$5.low) >>> 0)), (x$4.high === 0 && x$4.low === 0))) {
			exp = flt.bias;
		}
		bits = (x$6 = (x$7 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(x$7.high - 0, x$7.low - 1)), new Go$Uint64(mant.high & x$6.high, (mant.low & x$6.low) >>> 0));
		bits = (x$8 = go$shiftLeft64(new Go$Uint64(0, (((exp - flt.bias >> 0)) & ((((y$2 = flt.expbits, y$2 < 32 ? (1 << y$2) : 0) >> 0) - 1 >> 0)))), flt.mantbits), new Go$Uint64(bits.high | x$8.high, (bits.low | x$8.low) >>> 0));
		if (f.neg) {
			bits = (x$9 = go$shiftLeft64(new Go$Uint64(0, 1), ((flt.mantbits + flt.expbits >>> 0))), new Go$Uint64(bits.high | x$9.high, (bits.low | x$9.low) >>> 0));
		}
		return [bits, overflow];
	};
	extFloat.prototype.floatBits = function(flt) { return this.go$val.floatBits(flt); };
	extFloat.Ptr.prototype.AssignComputeBounds = function(mant, exp, neg, flt) {
		var lower, upper, f, x, _struct, _struct$1, _tuple, _struct$2, _struct$3, expBiased, x$1, x$2, x$3, x$4, _struct$4, _struct$5;
		lower = new extFloat.Ptr();
		upper = new extFloat.Ptr();
		f = this;
		f.mant = mant;
		f.exp = exp - (flt.mantbits >> 0) >> 0;
		f.neg = neg;
		if (f.exp <= 0 && (x = go$shiftLeft64((go$shiftRightUint64(mant, (-f.exp >>> 0))), (-f.exp >>> 0)), (mant.high === x.high && mant.low === x.low))) {
			f.mant = go$shiftRightUint64(f.mant, ((-f.exp >>> 0)));
			f.exp = 0;
			_tuple = [(_struct = f, new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)), (_struct$1 = f, new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg))], lower = _tuple[0], upper = _tuple[1];
			return [(_struct$2 = lower, new extFloat.Ptr(_struct$2.mant, _struct$2.exp, _struct$2.neg)), (_struct$3 = upper, new extFloat.Ptr(_struct$3.mant, _struct$3.exp, _struct$3.neg))];
		}
		expBiased = exp - flt.bias >> 0;
		upper = new extFloat.Ptr((x$1 = go$mul64(new Go$Uint64(0, 2), f.mant), new Go$Uint64(x$1.high + 0, x$1.low + 1)), f.exp - 1 >> 0, f.neg);
		if (!((x$2 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), (mant.high === x$2.high && mant.low === x$2.low))) || (expBiased === 1)) {
			lower = new extFloat.Ptr((x$3 = go$mul64(new Go$Uint64(0, 2), f.mant), new Go$Uint64(x$3.high - 0, x$3.low - 1)), f.exp - 1 >> 0, f.neg);
		} else {
			lower = new extFloat.Ptr((x$4 = go$mul64(new Go$Uint64(0, 4), f.mant), new Go$Uint64(x$4.high - 0, x$4.low - 1)), f.exp - 2 >> 0, f.neg);
		}
		return [(_struct$4 = lower, new extFloat.Ptr(_struct$4.mant, _struct$4.exp, _struct$4.neg)), (_struct$5 = upper, new extFloat.Ptr(_struct$5.mant, _struct$5.exp, _struct$5.neg))];
	};
	extFloat.prototype.AssignComputeBounds = function(mant, exp, neg, flt) { return this.go$val.AssignComputeBounds(mant, exp, neg, flt); };
	extFloat.Ptr.prototype.Normalize = function() {
		var shift, f, _tuple, mant, exp, x, x$1, x$2, x$3, x$4, x$5, _tuple$1;
		shift = 0;
		f = this;
		_tuple = [f.mant, f.exp], mant = _tuple[0], exp = _tuple[1];
		if ((mant.high === 0 && mant.low === 0)) {
			shift = 0;
			return shift;
		}
		if ((x = go$shiftRightUint64(mant, 32), (x.high === 0 && x.low === 0))) {
			mant = go$shiftLeft64(mant, 32);
			exp = exp - 32 >> 0;
		}
		if ((x$1 = go$shiftRightUint64(mant, 48), (x$1.high === 0 && x$1.low === 0))) {
			mant = go$shiftLeft64(mant, 16);
			exp = exp - 16 >> 0;
		}
		if ((x$2 = go$shiftRightUint64(mant, 56), (x$2.high === 0 && x$2.low === 0))) {
			mant = go$shiftLeft64(mant, 8);
			exp = exp - 8 >> 0;
		}
		if ((x$3 = go$shiftRightUint64(mant, 60), (x$3.high === 0 && x$3.low === 0))) {
			mant = go$shiftLeft64(mant, 4);
			exp = exp - 4 >> 0;
		}
		if ((x$4 = go$shiftRightUint64(mant, 62), (x$4.high === 0 && x$4.low === 0))) {
			mant = go$shiftLeft64(mant, 2);
			exp = exp - 2 >> 0;
		}
		if ((x$5 = go$shiftRightUint64(mant, 63), (x$5.high === 0 && x$5.low === 0))) {
			mant = go$shiftLeft64(mant, 1);
			exp = exp - 1 >> 0;
		}
		shift = ((f.exp - exp >> 0) >>> 0);
		_tuple$1 = [mant, exp], f.mant = _tuple$1[0], f.exp = _tuple$1[1];
		return shift;
	};
	extFloat.prototype.Normalize = function() { return this.go$val.Normalize(); };
	extFloat.Ptr.prototype.Multiply = function(g) {
		var f, _tuple, fhi, flo, _tuple$1, ghi, glo, cross1, cross2, x, x$1, x$2, x$3, x$4, x$5, x$6, x$7, rem, x$8, x$9;
		f = this;
		_tuple = [go$shiftRightUint64(f.mant, 32), new Go$Uint64(0, (f.mant.low >>> 0))], fhi = _tuple[0], flo = _tuple[1];
		_tuple$1 = [go$shiftRightUint64(g.mant, 32), new Go$Uint64(0, (g.mant.low >>> 0))], ghi = _tuple$1[0], glo = _tuple$1[1];
		cross1 = go$mul64(fhi, glo);
		cross2 = go$mul64(flo, ghi);
		f.mant = (x = (x$1 = go$mul64(fhi, ghi), x$2 = go$shiftRightUint64(cross1, 32), new Go$Uint64(x$1.high + x$2.high, x$1.low + x$2.low)), x$3 = go$shiftRightUint64(cross2, 32), new Go$Uint64(x.high + x$3.high, x.low + x$3.low));
		rem = (x$4 = (x$5 = new Go$Uint64(0, (cross1.low >>> 0)), x$6 = new Go$Uint64(0, (cross2.low >>> 0)), new Go$Uint64(x$5.high + x$6.high, x$5.low + x$6.low)), x$7 = go$shiftRightUint64((go$mul64(flo, glo)), 32), new Go$Uint64(x$4.high + x$7.high, x$4.low + x$7.low));
		rem = new Go$Uint64(rem.high + 0, rem.low + 2147483648);
		f.mant = (x$8 = f.mant, x$9 = (go$shiftRightUint64(rem, 32)), new Go$Uint64(x$8.high + x$9.high, x$8.low + x$9.low));
		f.exp = (f.exp + g.exp >> 0) + 64 >> 0;
	};
	extFloat.prototype.Multiply = function(g) { return this.go$val.Multiply(g); };
	extFloat.Ptr.prototype.AssignDecimal = function(mantissa, exp10, neg, trunc, flt) {
		var ok, f, errors$1, _q, i, _r, adjExp, x, _struct, _struct$1, shift, y, denormalExp, extrabits, halfway, x$1, x$2, x$3, mant_extra, x$4, x$5, x$6, x$7, x$8, x$9, x$10, x$11;
		ok = false;
		f = this;
		errors$1 = 0;
		if (trunc) {
			errors$1 = errors$1 + 4 >> 0;
		}
		f.mant = mantissa;
		f.exp = 0;
		f.neg = neg;
		i = (_q = ((exp10 - -348 >> 0)) / 8, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		if (exp10 < -348 || i >= 87) {
			ok = false;
			return ok;
		}
		adjExp = (_r = ((exp10 - -348 >> 0)) % 8, _r === _r ? _r : go$throwRuntimeError("integer divide by zero"));
		if (adjExp < 19 && (x = uint64pow10[(19 - adjExp >> 0)], (mantissa.high < x.high || (mantissa.high === x.high && mantissa.low < x.low)))) {
			f.mant = go$mul64(f.mant, (uint64pow10[adjExp]));
			f.Normalize();
		} else {
			f.Normalize();
			f.Multiply((_struct = smallPowersOfTen[adjExp], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)));
			errors$1 = errors$1 + 4 >> 0;
		}
		f.Multiply((_struct$1 = powersOfTen[i], new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg)));
		if (errors$1 > 0) {
			errors$1 = errors$1 + 1 >> 0;
		}
		errors$1 = errors$1 + 4 >> 0;
		shift = f.Normalize();
		errors$1 = (y = (shift), y < 32 ? (errors$1 << y) : 0) >> 0;
		denormalExp = flt.bias - 63 >> 0;
		extrabits = 0;
		if (f.exp <= denormalExp) {
			extrabits = (((63 - flt.mantbits >>> 0) + 1 >>> 0) + ((denormalExp - f.exp >> 0) >>> 0) >>> 0);
		} else {
			extrabits = (63 - flt.mantbits >>> 0);
		}
		halfway = go$shiftLeft64(new Go$Uint64(0, 1), ((extrabits - 1 >>> 0)));
		mant_extra = (x$1 = f.mant, x$2 = (x$3 = go$shiftLeft64(new Go$Uint64(0, 1), extrabits), new Go$Uint64(x$3.high - 0, x$3.low - 1)), new Go$Uint64(x$1.high & x$2.high, (x$1.low & x$2.low) >>> 0));
		if ((x$4 = (x$5 = new Go$Int64(halfway.high, halfway.low), x$6 = new Go$Int64(0, errors$1), new Go$Int64(x$5.high - x$6.high, x$5.low - x$6.low)), x$7 = new Go$Int64(mant_extra.high, mant_extra.low), (x$4.high < x$7.high || (x$4.high === x$7.high && x$4.low < x$7.low))) && (x$8 = new Go$Int64(mant_extra.high, mant_extra.low), x$9 = (x$10 = new Go$Int64(halfway.high, halfway.low), x$11 = new Go$Int64(0, errors$1), new Go$Int64(x$10.high + x$11.high, x$10.low + x$11.low)), (x$8.high < x$9.high || (x$8.high === x$9.high && x$8.low < x$9.low)))) {
			ok = false;
			return ok;
		}
		ok = true;
		return ok;
	};
	extFloat.prototype.AssignDecimal = function(mantissa, exp10, neg, trunc, flt) { return this.go$val.AssignDecimal(mantissa, exp10, neg, trunc, flt); };
	extFloat.Ptr.prototype.frexp10 = function() {
		var exp10, index, f, _q, x, x$1, approxExp10, _q$1, i, exp, _struct, _tuple;
		exp10 = 0;
		index = 0;
		f = this;
		approxExp10 = (_q = (x = (-46 - f.exp >> 0), x$1 = 28, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) / 93, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		i = (_q$1 = ((approxExp10 - -348 >> 0)) / 8, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
		Loop:
		while (true) {
			exp = (f.exp + powersOfTen[i].exp >> 0) + 64 >> 0;
			if (exp < -60) {
				i = i + 1 >> 0;
			} else if (exp > -32) {
				i = i - 1 >> 0;
			} else {
				break Loop;
			}
		}
		f.Multiply((_struct = powersOfTen[i], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)));
		_tuple = [-((-348 + ((((i >>> 16 << 16) * 8 >> 0) + (i << 16 >>> 16) * 8) >> 0) >> 0)), i], exp10 = _tuple[0], index = _tuple[1];
		return [exp10, index];
	};
	extFloat.prototype.frexp10 = function() { return this.go$val.frexp10(); };
	var frexp10Many = function(a, b, c) {
		var exp10, _tuple, i, _struct, _struct$1;
		exp10 = 0;
		_tuple = c.frexp10(), exp10 = _tuple[0], i = _tuple[1];
		a.Multiply((_struct = powersOfTen[i], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)));
		b.Multiply((_struct$1 = powersOfTen[i], new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg)));
		return exp10;
	};
	extFloat.Ptr.prototype.FixedDecimal = function(d, n) {
		var f, x, _tuple, exp10, shift, integer, x$1, x$2, fraction, nonAsciiName, needed, integerDigits, pow10, _tuple$1, i, pow, x$3, rest, _q, x$4, buf, pos, v, _q$1, v1, x$5, i$1, _slice, _index, nd, x$6, x$7, digit, _slice$1, _index$1, x$8, x$9, ok, i$2, _slice$2, _index$2;
		f = this;
		if ((x = f.mant, (x.high === 0 && x.low === 0))) {
			d.nd = 0;
			d.dp = 0;
			d.neg = f.neg;
			return true;
		}
		if (n === 0) {
			throw go$panic(new Go$String("strconv: internal error: extFloat.FixedDecimal called with n == 0"));
		}
		f.Normalize();
		_tuple = f.frexp10(), exp10 = _tuple[0];
		shift = (-f.exp >>> 0);
		integer = (go$shiftRightUint64(f.mant, shift).low >>> 0);
		fraction = (x$1 = f.mant, x$2 = go$shiftLeft64(new Go$Uint64(0, integer), shift), new Go$Uint64(x$1.high - x$2.high, x$1.low - x$2.low));
		nonAsciiName = new Go$Uint64(0, 1);
		needed = n;
		integerDigits = 0;
		pow10 = new Go$Uint64(0, 1);
		_tuple$1 = [0, new Go$Uint64(0, 1)], i = _tuple$1[0], pow = _tuple$1[1];
		while (i < 20) {
			if ((x$3 = new Go$Uint64(0, integer), (pow.high > x$3.high || (pow.high === x$3.high && pow.low > x$3.low)))) {
				integerDigits = i;
				break;
			}
			pow = go$mul64(pow, new Go$Uint64(0, 10));
			i = i + 1 >> 0;
		}
		rest = integer;
		if (integerDigits > needed) {
			pow10 = uint64pow10[(integerDigits - needed >> 0)];
			integer = (_q = integer / ((pow10.low >>> 0)), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero"));
			rest = rest - ((x$4 = (pow10.low >>> 0), (((integer >>> 16 << 16) * x$4 >>> 0) + (integer << 16 >>> 16) * x$4) >>> 0)) >>> 0;
		} else {
			rest = 0;
		}
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		pos = 32;
		v = integer;
		while (v > 0) {
			v1 = (_q$1 = v / 10, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >>> 0 : go$throwRuntimeError("integer divide by zero"));
			v = v - ((x$5 = 10, (((x$5 >>> 16 << 16) * v1 >>> 0) + (x$5 << 16 >>> 16) * v1) >>> 0)) >>> 0;
			pos = pos - 1 >> 0;
			buf[pos] = ((v + 48 >>> 0) << 24 >>> 24);
			v = v1;
		}
		i$1 = pos;
		while (i$1 < 32) {
			_slice = d.d, _index = i$1 - pos >> 0, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = buf[i$1]) : go$throwRuntimeError("index out of range");
			i$1 = i$1 + 1 >> 0;
		}
		nd = 32 - pos >> 0;
		d.nd = nd;
		d.dp = integerDigits + exp10 >> 0;
		needed = needed - (nd) >> 0;
		if (needed > 0) {
			if (!((rest === 0)) || !((pow10.high === 0 && pow10.low === 1))) {
				throw go$panic(new Go$String("strconv: internal error, rest != 0 but needed > 0"));
			}
			while (needed > 0) {
				fraction = go$mul64(fraction, new Go$Uint64(0, 10));
				nonAsciiName = go$mul64(nonAsciiName, new Go$Uint64(0, 10));
				if ((x$6 = go$mul64(new Go$Uint64(0, 2), nonAsciiName), x$7 = go$shiftLeft64(new Go$Uint64(0, 1), shift), (x$6.high > x$7.high || (x$6.high === x$7.high && x$6.low > x$7.low)))) {
					return false;
				}
				digit = go$shiftRightUint64(fraction, shift);
				_slice$1 = d.d, _index$1 = nd, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = (new Go$Uint64(digit.high + 0, digit.low + 48).low << 24 >>> 24)) : go$throwRuntimeError("index out of range");
				fraction = (x$8 = go$shiftLeft64(digit, shift), new Go$Uint64(fraction.high - x$8.high, fraction.low - x$8.low));
				nd = nd + 1 >> 0;
				needed = needed - 1 >> 0;
			}
			d.nd = nd;
		}
		ok = adjustLastDigitFixed(d, (x$9 = go$shiftLeft64(new Go$Uint64(0, rest), shift), new Go$Uint64(x$9.high | fraction.high, (x$9.low | fraction.low) >>> 0)), pow10, shift, nonAsciiName);
		if (!ok) {
			return false;
		}
		i$2 = d.nd - 1 >> 0;
		while (i$2 >= 0) {
			if (!(((_slice$2 = d.d, _index$2 = i$2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) === 48))) {
				d.nd = i$2 + 1 >> 0;
				break;
			}
			i$2 = i$2 - 1 >> 0;
		}
		return true;
	};
	extFloat.prototype.FixedDecimal = function(d, n) { return this.go$val.FixedDecimal(d, n); };
	var adjustLastDigitFixed = function(d, num, den, shift, nonAsciiName) {
		var x, x$1, x$2, x$3, x$4, x$5, x$6, i, _slice, _index, _slice$1, _index$1, _lhs, _index$2, _slice$2, _index$3, _slice$3, _index$4;
		if ((x = go$shiftLeft64(den, shift), (num.high > x.high || (num.high === x.high && num.low > x.low)))) {
			throw go$panic(new Go$String("strconv: num > den<<shift in adjustLastDigitFixed"));
		}
		if ((x$1 = go$mul64(new Go$Uint64(0, 2), nonAsciiName), x$2 = go$shiftLeft64(den, shift), (x$1.high > x$2.high || (x$1.high === x$2.high && x$1.low > x$2.low)))) {
			throw go$panic(new Go$String("strconv: \xCE\xB5 > (den<<shift)/2"));
		}
		if ((x$3 = go$mul64(new Go$Uint64(0, 2), (new Go$Uint64(num.high + nonAsciiName.high, num.low + nonAsciiName.low))), x$4 = go$shiftLeft64(den, shift), (x$3.high < x$4.high || (x$3.high === x$4.high && x$3.low < x$4.low)))) {
			return true;
		}
		if ((x$5 = go$mul64(new Go$Uint64(0, 2), (new Go$Uint64(num.high - nonAsciiName.high, num.low - nonAsciiName.low))), x$6 = go$shiftLeft64(den, shift), (x$5.high > x$6.high || (x$5.high === x$6.high && x$5.low > x$6.low)))) {
			i = d.nd - 1 >> 0;
			while (i >= 0) {
				if ((_slice = d.d, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === 57) {
					d.nd = d.nd - 1 >> 0;
				} else {
					break;
				}
				i = i - 1 >> 0;
			}
			if (i < 0) {
				_slice$1 = d.d, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = 49) : go$throwRuntimeError("index out of range");
				d.nd = 1;
				d.dp = d.dp + 1 >> 0;
			} else {
				_lhs = d.d, _index$2 = i, _slice$3 = _lhs, _index$4 = _index$2, (_index$4 >= 0 && _index$4 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$4] = (_slice$2 = _lhs, _index$3 = _index$2, (_index$3 >= 0 && _index$3 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$3] : go$throwRuntimeError("index out of range")) + 1 << 24 >>> 24) : go$throwRuntimeError("index out of range");
			}
			return true;
		}
		return false;
	};
	extFloat.Ptr.prototype.ShortestDecimal = function(d, lower, upper) {
		var f, x, x$1, y, x$2, y$1, buf, n, v, v1, x$3, nd, i, _slice, _index, _tuple, _slice$1, _index$1, exp10, x$4, x$5, shift, integer, x$6, x$7, fraction, x$8, x$9, allowance, x$10, x$11, targetDiff, integerDigits, _tuple$1, i$1, pow, x$12, i$2, pow$1, _q, digit, _slice$2, _index$2, x$13, currentDiff, x$14, digit$1, multiplier, _slice$3, _index$3, x$15, x$16;
		f = this;
		if ((x = f.mant, (x.high === 0 && x.low === 0))) {
			d.nd = 0;
			d.dp = 0;
			d.neg = f.neg;
			return true;
		}
		if ((f.exp === 0) && (x$1 = lower, y = f, (x$1.mant.high === y.mant.high && x$1.mant.low === y.mant.low) && x$1.exp === y.exp && x$1.neg === y.neg) && (x$2 = lower, y$1 = upper, (x$2.mant.high === y$1.mant.high && x$2.mant.low === y$1.mant.low) && x$2.exp === y$1.exp && x$2.neg === y$1.neg)) {
			buf = go$makeNativeArray("Uint8", 24, function() { return 0; });
			n = 23;
			v = f.mant;
			while ((v.high > 0 || (v.high === 0 && v.low > 0))) {
				v1 = go$div64(v, new Go$Uint64(0, 10), false);
				v = (x$3 = go$mul64(new Go$Uint64(0, 10), v1), new Go$Uint64(v.high - x$3.high, v.low - x$3.low));
				buf[n] = (new Go$Uint64(v.high + 0, v.low + 48).low << 24 >>> 24);
				n = n - 1 >> 0;
				v = v1;
			}
			nd = (24 - n >> 0) - 1 >> 0;
			i = 0;
			while (i < nd) {
				_slice = d.d, _index = i, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = buf[((n + 1 >> 0) + i >> 0)]) : go$throwRuntimeError("index out of range");
				i = i + 1 >> 0;
			}
			_tuple = [nd, nd], d.nd = _tuple[0], d.dp = _tuple[1];
			while (d.nd > 0 && ((_slice$1 = d.d, _index$1 = (d.nd - 1 >> 0), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) === 48)) {
				d.nd = d.nd - 1 >> 0;
			}
			if (d.nd === 0) {
				d.dp = 0;
			}
			d.neg = f.neg;
			return true;
		}
		upper.Normalize();
		if (f.exp > upper.exp) {
			f.mant = go$shiftLeft64(f.mant, (((f.exp - upper.exp >> 0) >>> 0)));
			f.exp = upper.exp;
		}
		if (lower.exp > upper.exp) {
			lower.mant = go$shiftLeft64(lower.mant, (((lower.exp - upper.exp >> 0) >>> 0)));
			lower.exp = upper.exp;
		}
		exp10 = frexp10Many(lower, f, upper);
		upper.mant = (x$4 = upper.mant, new Go$Uint64(x$4.high + 0, x$4.low + 1));
		lower.mant = (x$5 = lower.mant, new Go$Uint64(x$5.high - 0, x$5.low - 1));
		shift = (-upper.exp >>> 0);
		integer = (go$shiftRightUint64(upper.mant, shift).low >>> 0);
		fraction = (x$6 = upper.mant, x$7 = go$shiftLeft64(new Go$Uint64(0, integer), shift), new Go$Uint64(x$6.high - x$7.high, x$6.low - x$7.low));
		allowance = (x$8 = upper.mant, x$9 = lower.mant, new Go$Uint64(x$8.high - x$9.high, x$8.low - x$9.low));
		targetDiff = (x$10 = upper.mant, x$11 = f.mant, new Go$Uint64(x$10.high - x$11.high, x$10.low - x$11.low));
		integerDigits = 0;
		_tuple$1 = [0, new Go$Uint64(0, 1)], i$1 = _tuple$1[0], pow = _tuple$1[1];
		while (i$1 < 20) {
			if ((x$12 = new Go$Uint64(0, integer), (pow.high > x$12.high || (pow.high === x$12.high && pow.low > x$12.low)))) {
				integerDigits = i$1;
				break;
			}
			pow = go$mul64(pow, new Go$Uint64(0, 10));
			i$1 = i$1 + 1 >> 0;
		}
		i$2 = 0;
		while (i$2 < integerDigits) {
			pow$1 = uint64pow10[((integerDigits - i$2 >> 0) - 1 >> 0)];
			digit = (_q = integer / (pow$1.low >>> 0), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero"));
			_slice$2 = d.d, _index$2 = i$2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = ((digit + 48 >>> 0) << 24 >>> 24)) : go$throwRuntimeError("index out of range");
			integer = integer - ((x$13 = (pow$1.low >>> 0), (((digit >>> 16 << 16) * x$13 >>> 0) + (digit << 16 >>> 16) * x$13) >>> 0)) >>> 0;
			if (currentDiff = (x$14 = go$shiftLeft64(new Go$Uint64(0, integer), shift), new Go$Uint64(x$14.high + fraction.high, x$14.low + fraction.low)), (currentDiff.high < allowance.high || (currentDiff.high === allowance.high && currentDiff.low < allowance.low))) {
				d.nd = i$2 + 1 >> 0;
				d.dp = integerDigits + exp10 >> 0;
				d.neg = f.neg;
				return adjustLastDigit(d, currentDiff, targetDiff, allowance, go$shiftLeft64(pow$1, shift), new Go$Uint64(0, 2));
			}
			i$2 = i$2 + 1 >> 0;
		}
		d.nd = integerDigits;
		d.dp = d.nd + exp10 >> 0;
		d.neg = f.neg;
		digit$1 = 0;
		multiplier = new Go$Uint64(0, 1);
		while (true) {
			fraction = go$mul64(fraction, new Go$Uint64(0, 10));
			multiplier = go$mul64(multiplier, new Go$Uint64(0, 10));
			digit$1 = (go$shiftRightUint64(fraction, shift).low >> 0);
			_slice$3 = d.d, _index$3 = d.nd, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = ((digit$1 + 48 >> 0) << 24 >>> 24)) : go$throwRuntimeError("index out of range");
			d.nd = d.nd + 1 >> 0;
			fraction = (x$15 = go$shiftLeft64(new Go$Uint64(0, digit$1), shift), new Go$Uint64(fraction.high - x$15.high, fraction.low - x$15.low));
			if ((x$16 = go$mul64(allowance, multiplier), (fraction.high < x$16.high || (fraction.high === x$16.high && fraction.low < x$16.low)))) {
				return adjustLastDigit(d, fraction, go$mul64(targetDiff, multiplier), go$mul64(allowance, multiplier), go$shiftLeft64(new Go$Uint64(0, 1), shift), go$mul64(multiplier, new Go$Uint64(0, 2)));
			}
		}
	};
	extFloat.prototype.ShortestDecimal = function(d, lower, upper) { return this.go$val.ShortestDecimal(d, lower, upper); };
	var adjustLastDigit = function(d, currentDiff, targetDiff, maxDiff, ulpDecimal, ulpBinary) {
		var x, x$1, x$2, x$3, _lhs, _index, _slice, _index$1, _slice$1, _index$2, x$4, x$5, x$6, x$7, x$8, x$9, _slice$2, _index$3;
		if ((x = go$mul64(new Go$Uint64(0, 2), ulpBinary), (ulpDecimal.high < x.high || (ulpDecimal.high === x.high && ulpDecimal.low < x.low)))) {
			return false;
		}
		while ((x$1 = (x$2 = (x$3 = go$div64(ulpDecimal, new Go$Uint64(0, 2), false), new Go$Uint64(currentDiff.high + x$3.high, currentDiff.low + x$3.low)), new Go$Uint64(x$2.high + ulpBinary.high, x$2.low + ulpBinary.low)), (x$1.high < targetDiff.high || (x$1.high === targetDiff.high && x$1.low < targetDiff.low)))) {
			_lhs = d.d, _index = d.nd - 1 >> 0, _slice$1 = _lhs, _index$2 = _index, (_index$2 >= 0 && _index$2 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$2] = (_slice = _lhs, _index$1 = _index, (_index$1 >= 0 && _index$1 < _slice.length) ? _slice.array[_slice.offset + _index$1] : go$throwRuntimeError("index out of range")) - 1 << 24 >>> 24) : go$throwRuntimeError("index out of range");
			currentDiff = (x$4 = ulpDecimal, new Go$Uint64(currentDiff.high + x$4.high, currentDiff.low + x$4.low));
		}
		if ((x$5 = new Go$Uint64(currentDiff.high + ulpDecimal.high, currentDiff.low + ulpDecimal.low), x$6 = (x$7 = (x$8 = go$div64(ulpDecimal, new Go$Uint64(0, 2), false), new Go$Uint64(targetDiff.high + x$8.high, targetDiff.low + x$8.low)), new Go$Uint64(x$7.high + ulpBinary.high, x$7.low + ulpBinary.low)), (x$5.high < x$6.high || (x$5.high === x$6.high && x$5.low <= x$6.low)))) {
			return false;
		}
		if ((currentDiff.high < ulpBinary.high || (currentDiff.high === ulpBinary.high && currentDiff.low < ulpBinary.low)) || (x$9 = new Go$Uint64(maxDiff.high - ulpBinary.high, maxDiff.low - ulpBinary.low), (currentDiff.high > x$9.high || (currentDiff.high === x$9.high && currentDiff.low > x$9.low)))) {
			return false;
		}
		if ((d.nd === 1) && ((_slice$2 = d.d, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$3] : go$throwRuntimeError("index out of range")) === 48)) {
			d.nd = 0;
			d.dp = 0;
		}
		return true;
	};
	var FormatFloat = go$pkg.FormatFloat = function(f, fmt, prec, bitSize) {
		return go$bytesToString(genericFtoa((go$sliceType(Go$Uint8)).make(0, max(prec + 4 >> 0, 24), function() { return 0; }), f, fmt, prec, bitSize));
	};
	var AppendFloat = go$pkg.AppendFloat = function(dst, f, fmt, prec, bitSize) {
		return genericFtoa(dst, f, fmt, prec, bitSize);
	};
	var genericFtoa = function(dst, val, fmt, prec, bitSize) {
		var bits, flt, _ref, x, neg, y, exp, x$1, x$2, mant, _ref$1, y$1, s, x$3, digs, ok, shortest, f, _tuple, _struct, lower, _struct$1, upper, buf, _ref$2, digits, _ref$3, buf$1, f$1, _struct$2;
		bits = new Go$Uint64(0, 0);
		flt = (go$ptrType(floatInfo)).nil;
		_ref = bitSize;
		if (_ref === 32) {
			bits = new Go$Uint64(0, math.Float32bits(val));
			flt = float32info;
		} else if (_ref === 64) {
			bits = math.Float64bits(val);
			flt = float64info;
		} else {
			throw go$panic(new Go$String("strconv: illegal AppendFloat/FormatFloat bitSize"));
		}
		neg = !((x = go$shiftRightUint64(bits, ((flt.expbits + flt.mantbits >>> 0))), (x.high === 0 && x.low === 0)));
		exp = (go$shiftRightUint64(bits, flt.mantbits).low >> 0) & ((((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0));
		mant = (x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(x$2.high - 0, x$2.low - 1)), new Go$Uint64(bits.high & x$1.high, (bits.low & x$1.low) >>> 0));
		_ref$1 = exp;
		if (_ref$1 === (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0)) {
			s = "";
			if (!((mant.high === 0 && mant.low === 0))) {
				s = "NaN";
			} else if (neg) {
				s = "-Inf";
			} else {
				s = "+Inf";
			}
			return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(s)));
		} else if (_ref$1 === 0) {
			exp = exp + 1 >> 0;
		} else {
			mant = (x$3 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(mant.high | x$3.high, (mant.low | x$3.low) >>> 0));
		}
		exp = exp + (flt.bias) >> 0;
		if (fmt === 98) {
			return fmtB(dst, neg, mant, exp, flt);
		}
		if (!optimize) {
			return bigFtoa(dst, prec, fmt, neg, mant, exp, flt);
		}
		digs = new decimalSlice.Ptr();
		ok = false;
		shortest = prec < 0;
		if (shortest) {
			f = new extFloat.Ptr();
			_tuple = f.AssignComputeBounds(mant, exp, neg, flt), lower = (_struct = _tuple[0], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)), upper = (_struct$1 = _tuple[1], new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg));
			buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
			digs.d = new (go$sliceType(Go$Uint8))(buf);
			ok = f.ShortestDecimal(digs, lower, upper);
			if (!ok) {
				return bigFtoa(dst, prec, fmt, neg, mant, exp, flt);
			}
			_ref$2 = fmt;
			if (_ref$2 === 101 || _ref$2 === 69) {
				prec = digs.nd - 1 >> 0;
			} else if (_ref$2 === 102) {
				prec = max(digs.nd - digs.dp >> 0, 0);
			} else if (_ref$2 === 103 || _ref$2 === 71) {
				prec = digs.nd;
			}
		} else if (!((fmt === 102))) {
			digits = prec;
			_ref$3 = fmt;
			if (_ref$3 === 101 || _ref$3 === 69) {
				digits = digits + 1 >> 0;
			} else if (_ref$3 === 103 || _ref$3 === 71) {
				if (prec === 0) {
					prec = 1;
				}
				digits = prec;
			}
			if (digits <= 15) {
				buf$1 = go$makeNativeArray("Uint8", 24, function() { return 0; });
				digs.d = new (go$sliceType(Go$Uint8))(buf$1);
				f$1 = new extFloat.Ptr(mant, exp - (flt.mantbits >> 0) >> 0, neg);
				ok = f$1.FixedDecimal(digs, digits);
			}
		}
		if (!ok) {
			return bigFtoa(dst, prec, fmt, neg, mant, exp, flt);
		}
		return formatDigits(dst, shortest, neg, (_struct$2 = digs, new decimalSlice.Ptr(_struct$2.d, _struct$2.nd, _struct$2.dp, _struct$2.neg)), prec, fmt);
	};
	var bigFtoa = function(dst, prec, fmt, neg, mant, exp, flt) {
		var d, digs, shortest, _ref, _ref$1, _struct;
		d = new decimal.Ptr();
		d.Assign(mant);
		d.Shift(exp - (flt.mantbits >> 0) >> 0);
		digs = new decimalSlice.Ptr();
		shortest = prec < 0;
		if (shortest) {
			roundShortest(d, mant, exp, flt);
			digs = new decimalSlice.Ptr(new (go$sliceType(Go$Uint8))(d.d), d.nd, d.dp, false);
			_ref = fmt;
			if (_ref === 101 || _ref === 69) {
				prec = digs.nd - 1 >> 0;
			} else if (_ref === 102) {
				prec = max(digs.nd - digs.dp >> 0, 0);
			} else if (_ref === 103 || _ref === 71) {
				prec = digs.nd;
			}
		} else {
			_ref$1 = fmt;
			if (_ref$1 === 101 || _ref$1 === 69) {
				d.Round(prec + 1 >> 0);
			} else if (_ref$1 === 102) {
				d.Round(d.dp + prec >> 0);
			} else if (_ref$1 === 103 || _ref$1 === 71) {
				if (prec === 0) {
					prec = 1;
				}
				d.Round(prec);
			}
			digs = new decimalSlice.Ptr(new (go$sliceType(Go$Uint8))(d.d), d.nd, d.dp, false);
		}
		return formatDigits(dst, shortest, neg, (_struct = digs, new decimalSlice.Ptr(_struct.d, _struct.nd, _struct.dp, _struct.neg)), prec, fmt);
	};
	var formatDigits = function(dst, shortest, neg, digs, prec, fmt) {
		var _ref, _struct, _struct$1, eprec, exp, _struct$2, _struct$3;
		_ref = fmt;
		if (_ref === 101 || _ref === 69) {
			return fmtE(dst, neg, (_struct = digs, new decimalSlice.Ptr(_struct.d, _struct.nd, _struct.dp, _struct.neg)), prec, fmt);
		} else if (_ref === 102) {
			return fmtF(dst, neg, (_struct$1 = digs, new decimalSlice.Ptr(_struct$1.d, _struct$1.nd, _struct$1.dp, _struct$1.neg)), prec);
		} else if (_ref === 103 || _ref === 71) {
			eprec = prec;
			if (eprec > digs.nd && digs.nd >= digs.dp) {
				eprec = digs.nd;
			}
			if (shortest) {
				eprec = 6;
			}
			exp = digs.dp - 1 >> 0;
			if (exp < -4 || exp >= eprec) {
				if (prec > digs.nd) {
					prec = digs.nd;
				}
				return fmtE(dst, neg, (_struct$2 = digs, new decimalSlice.Ptr(_struct$2.d, _struct$2.nd, _struct$2.dp, _struct$2.neg)), prec - 1 >> 0, (fmt + 101 << 24 >>> 24) - 103 << 24 >>> 24);
			}
			if (prec > digs.dp) {
				prec = digs.nd;
			}
			return fmtF(dst, neg, (_struct$3 = digs, new decimalSlice.Ptr(_struct$3.d, _struct$3.nd, _struct$3.dp, _struct$3.neg)), max(prec - digs.dp >> 0, 0));
		}
		return go$append(dst, 37, fmt);
	};
	var roundShortest = function(d, mant, exp, flt) {
		var minexp, x, x$1, x$2, x$3, upper, x$4, mantlo, explo, x$5, x$6, lower, x$7, x$8, inclusive, i, _tuple, l, m, u, okdown, okup;
		if ((mant.high === 0 && mant.low === 0)) {
			d.nd = 0;
			return;
		}
		minexp = flt.bias + 1 >> 0;
		if (exp > minexp && (x = 332, x$1 = (d.dp - d.nd >> 0), (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) >= (x$2 = 100, x$3 = (exp - (flt.mantbits >> 0) >> 0), (((x$2 >>> 16 << 16) * x$3 >> 0) + (x$2 << 16 >>> 16) * x$3) >> 0)) {
			return;
		}
		upper = new decimal.Ptr();
		upper.Assign((x$4 = go$mul64(mant, new Go$Uint64(0, 2)), new Go$Uint64(x$4.high + 0, x$4.low + 1)));
		upper.Shift((exp - (flt.mantbits >> 0) >> 0) - 1 >> 0);
		mantlo = new Go$Uint64(0, 0);
		explo = 0;
		if ((x$5 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), (mant.high > x$5.high || (mant.high === x$5.high && mant.low > x$5.low))) || (exp === minexp)) {
			mantlo = new Go$Uint64(mant.high - 0, mant.low - 1);
			explo = exp;
		} else {
			mantlo = (x$6 = go$mul64(mant, new Go$Uint64(0, 2)), new Go$Uint64(x$6.high - 0, x$6.low - 1));
			explo = exp - 1 >> 0;
		}
		lower = new decimal.Ptr();
		lower.Assign((x$7 = go$mul64(mantlo, new Go$Uint64(0, 2)), new Go$Uint64(x$7.high + 0, x$7.low + 1)));
		lower.Shift((explo - (flt.mantbits >> 0) >> 0) - 1 >> 0);
		inclusive = (x$8 = go$div64(mant, new Go$Uint64(0, 2), true), (x$8.high === 0 && x$8.low === 0));
		i = 0;
		while (i < d.nd) {
			_tuple = [0, 0, 0], l = _tuple[0], m = _tuple[1], u = _tuple[2];
			if (i < lower.nd) {
				l = lower.d[i];
			} else {
				l = 48;
			}
			m = d.d[i];
			if (i < upper.nd) {
				u = upper.d[i];
			} else {
				u = 48;
			}
			okdown = !((l === m)) || (inclusive && (l === m) && ((i + 1 >> 0) === lower.nd));
			okup = !((m === u)) && (inclusive || (m + 1 << 24 >>> 24) < u || (i + 1 >> 0) < upper.nd);
			if (okdown && okup) {
				d.Round(i + 1 >> 0);
				return;
			} else if (okdown) {
				d.RoundDown(i + 1 >> 0);
				return;
			} else if (okup) {
				d.RoundUp(i + 1 >> 0);
				return;
			}
			i = i + 1 >> 0;
		}
	};
	var fmtE = function(dst, neg, d, prec, fmt) {
		var ch, _slice, _index, i, m, _slice$1, _index$1, exp, buf, i$1, _r, _q, _ref;
		if (neg) {
			dst = go$append(dst, 45);
		}
		ch = 48;
		if (!((d.nd === 0))) {
			ch = (_slice = d.d, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
		}
		dst = go$append(dst, ch);
		if (prec > 0) {
			dst = go$append(dst, 46);
			i = 1;
			m = ((d.nd + prec >> 0) + 1 >> 0) - max(d.nd, prec + 1 >> 0) >> 0;
			while (i < m) {
				dst = go$append(dst, (_slice$1 = d.d, _index$1 = i, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")));
				i = i + 1 >> 0;
			}
			while (i <= prec) {
				dst = go$append(dst, 48);
				i = i + 1 >> 0;
			}
		}
		dst = go$append(dst, fmt);
		exp = d.dp - 1 >> 0;
		if (d.nd === 0) {
			exp = 0;
		}
		if (exp < 0) {
			ch = 45;
			exp = -exp;
		} else {
			ch = 43;
		}
		dst = go$append(dst, ch);
		buf = go$makeNativeArray("Uint8", 3, function() { return 0; });
		i$1 = 3;
		while (exp >= 10) {
			i$1 = i$1 - 1 >> 0;
			buf[i$1] = (((_r = exp % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >> 0) << 24 >>> 24);
			exp = (_q = exp / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		i$1 = i$1 - 1 >> 0;
		buf[i$1] = ((exp + 48 >> 0) << 24 >>> 24);
		_ref = i$1;
		if (_ref === 0) {
			dst = go$append(dst, buf[0], buf[1], buf[2]);
		} else if (_ref === 1) {
			dst = go$append(dst, buf[1], buf[2]);
		} else if (_ref === 2) {
			dst = go$append(dst, 48, buf[2]);
		}
		return dst;
	};
	var fmtF = function(dst, neg, d, prec) {
		var i, _slice, _index, i$1, ch, j, _slice$1, _index$1;
		if (neg) {
			dst = go$append(dst, 45);
		}
		if (d.dp > 0) {
			i = 0;
			i = 0;
			while (i < d.dp && i < d.nd) {
				dst = go$append(dst, (_slice = d.d, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")));
				i = i + 1 >> 0;
			}
			while (i < d.dp) {
				dst = go$append(dst, 48);
				i = i + 1 >> 0;
			}
		} else {
			dst = go$append(dst, 48);
		}
		if (prec > 0) {
			dst = go$append(dst, 46);
			i$1 = 0;
			while (i$1 < prec) {
				ch = 48;
				if (j = d.dp + i$1 >> 0, 0 <= j && j < d.nd) {
					ch = (_slice$1 = d.d, _index$1 = j, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
				}
				dst = go$append(dst, ch);
				i$1 = i$1 + 1 >> 0;
			}
		}
		return dst;
	};
	var fmtB = function(dst, neg, mant, exp, flt) {
		var buf, w, esign, n, _r, _q, x;
		buf = go$makeNativeArray("Uint8", 50, function() { return 0; });
		w = 50;
		exp = exp - ((flt.mantbits >> 0)) >> 0;
		esign = 43;
		if (exp < 0) {
			esign = 45;
			exp = -exp;
		}
		n = 0;
		while (exp > 0 || n < 1) {
			n = n + 1 >> 0;
			w = w - 1 >> 0;
			buf[w] = (((_r = exp % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >> 0) << 24 >>> 24);
			exp = (_q = exp / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		w = w - 1 >> 0;
		buf[w] = esign;
		w = w - 1 >> 0;
		buf[w] = 112;
		n = 0;
		while ((mant.high > 0 || (mant.high === 0 && mant.low > 0)) || n < 1) {
			n = n + 1 >> 0;
			w = w - 1 >> 0;
			buf[w] = ((x = go$div64(mant, new Go$Uint64(0, 10), true), new Go$Uint64(x.high + 0, x.low + 48)).low << 24 >>> 24);
			mant = go$div64(mant, new Go$Uint64(0, 10), false);
		}
		if (neg) {
			w = w - 1 >> 0;
			buf[w] = 45;
		}
		return go$appendSlice(dst, go$subslice(new (go$sliceType(Go$Uint8))(buf), w));
	};
	var max = function(a, b) {
		if (a > b) {
			return a;
		}
		return b;
	};
	var FormatUint = go$pkg.FormatUint = function(i, base) {
		var _tuple, s;
		_tuple = formatBits((go$sliceType(Go$Uint8)).nil, i, base, false, false), s = _tuple[1];
		return s;
	};
	var FormatInt = go$pkg.FormatInt = function(i, base) {
		var _tuple, s;
		_tuple = formatBits((go$sliceType(Go$Uint8)).nil, new Go$Uint64(i.high, i.low), base, (i.high < 0 || (i.high === 0 && i.low < 0)), false), s = _tuple[1];
		return s;
	};
	var Itoa = go$pkg.Itoa = function(i) {
		return FormatInt(new Go$Int64(0, i), 10);
	};
	var AppendInt = go$pkg.AppendInt = function(dst, i, base) {
		var _tuple;
		_tuple = formatBits(dst, new Go$Uint64(i.high, i.low), base, (i.high < 0 || (i.high === 0 && i.low < 0)), true), dst = _tuple[0];
		return dst;
	};
	var AppendUint = go$pkg.AppendUint = function(dst, i, base) {
		var _tuple;
		_tuple = formatBits(dst, i, base, false, true), dst = _tuple[0];
		return dst;
	};
	var formatBits = function(dst, u, base, neg, append_) {
		var d, s, a, i, s$1, q, x, j, q$1, x$1, b, m, b$1;
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
				a[i + 1 >> 0] = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789".charCodeAt(j);
				a[i + 0 >> 0] = "0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999".charCodeAt(j);
				u = q;
			}
			if ((u.high > 0 || (u.high === 0 && u.low >= 10))) {
				i = i - 1 >> 0;
				q$1 = go$div64(u, new Go$Uint64(0, 10), false);
				a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt(((x$1 = go$mul64(q$1, new Go$Uint64(0, 10)), new Go$Uint64(u.high - x$1.high, u.low - x$1.low)).low >>> 0));
				u = q$1;
			}
		} else if (s$1 = shifts[base], s$1 > 0) {
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
	var quoteWith = function(s, quote, ASCIIonly) {
		var runeTmp, _q, x, x$1, buf, width, r, _tuple, n, _ref, s$1, s$2;
		runeTmp = go$makeNativeArray("Uint8", 4, function() { return 0; });
		buf = (go$sliceType(Go$Uint8)).make(0, (_q = (x = 3, x$1 = s.length, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")), function() { return 0; });
		buf = go$append(buf, quote);
		width = 0;
		while (s.length > 0) {
			r = (s.charCodeAt(0) >> 0);
			width = 1;
			if (r >= 128) {
				_tuple = utf8.DecodeRuneInString(s), r = _tuple[0], width = _tuple[1];
			}
			if ((width === 1) && (r === 65533)) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\x")));
				buf = go$append(buf, "0123456789abcdef".charCodeAt((s.charCodeAt(0) >>> 4 << 24 >>> 24)));
				buf = go$append(buf, "0123456789abcdef".charCodeAt(((s.charCodeAt(0) & 15) >>> 0)));
				s = s.substring(width);
				continue;
			}
			if ((r === (quote >> 0)) || (r === 92)) {
				buf = go$append(buf, 92);
				buf = go$append(buf, (r << 24 >>> 24));
				s = s.substring(width);
				continue;
			}
			if (ASCIIonly) {
				if (r < 128 && IsPrint(r)) {
					buf = go$append(buf, (r << 24 >>> 24));
					s = s.substring(width);
					continue;
				}
			} else if (IsPrint(r)) {
				n = utf8.EncodeRune(new (go$sliceType(Go$Uint8))(runeTmp), r);
				buf = go$appendSlice(buf, go$subslice(new (go$sliceType(Go$Uint8))(runeTmp), 0, n));
				s = s.substring(width);
				continue;
			}
			_ref = r;
			if (_ref === 7) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\a")));
			} else if (_ref === 8) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\b")));
			} else if (_ref === 12) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\f")));
			} else if (_ref === 10) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\n")));
			} else if (_ref === 13) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\r")));
			} else if (_ref === 9) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\t")));
			} else if (_ref === 11) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\v")));
			} else {
				if (r < 32) {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\x")));
					buf = go$append(buf, "0123456789abcdef".charCodeAt((s.charCodeAt(0) >>> 4 << 24 >>> 24)));
					buf = go$append(buf, "0123456789abcdef".charCodeAt(((s.charCodeAt(0) & 15) >>> 0)));
				} else if (r > 1114111) {
					r = 65533;
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\u")));
					s$1 = 12;
					while (s$1 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$1 >>> 0), 31)) >> 0) & 15)));
						s$1 = s$1 - 4 >> 0;
					}
				} else if (r < 65536) {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\u")));
					s$1 = 12;
					while (s$1 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$1 >>> 0), 31)) >> 0) & 15)));
						s$1 = s$1 - 4 >> 0;
					}
				} else {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\U")));
					s$2 = 28;
					while (s$2 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$2 >>> 0), 31)) >> 0) & 15)));
						s$2 = s$2 - 4 >> 0;
					}
				}
			}
			s = s.substring(width);
		}
		buf = go$append(buf, quote);
		return go$bytesToString(buf);
	};
	var Quote = go$pkg.Quote = function(s) {
		return quoteWith(s, 34, false);
	};
	var AppendQuote = go$pkg.AppendQuote = function(dst, s) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(Quote(s))));
	};
	var QuoteToASCII = go$pkg.QuoteToASCII = function(s) {
		return quoteWith(s, 34, true);
	};
	var AppendQuoteToASCII = go$pkg.AppendQuoteToASCII = function(dst, s) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(QuoteToASCII(s))));
	};
	var QuoteRune = go$pkg.QuoteRune = function(r) {
		return quoteWith(go$encodeRune(r), 39, false);
	};
	var AppendQuoteRune = go$pkg.AppendQuoteRune = function(dst, r) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(QuoteRune(r))));
	};
	var QuoteRuneToASCII = go$pkg.QuoteRuneToASCII = function(r) {
		return quoteWith(go$encodeRune(r), 39, true);
	};
	var AppendQuoteRuneToASCII = go$pkg.AppendQuoteRuneToASCII = function(dst, r) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(QuoteRuneToASCII(r))));
	};
	var CanBackquote = go$pkg.CanBackquote = function(s) {
		var i;
		i = 0;
		while (i < s.length) {
			if ((s.charCodeAt(i) < 32 && !((s.charCodeAt(i) === 9))) || (s.charCodeAt(i) === 96)) {
				return false;
			}
			i = i + 1 >> 0;
		}
		return true;
	};
	var unhex = function(b) {
		var v, ok, c, _tuple, _tuple$1, _tuple$2;
		v = 0;
		ok = false;
		c = (b >> 0);
		if (48 <= c && c <= 57) {
			_tuple = [c - 48 >> 0, true], v = _tuple[0], ok = _tuple[1];
			return [v, ok];
		} else if (97 <= c && c <= 102) {
			_tuple$1 = [(c - 97 >> 0) + 10 >> 0, true], v = _tuple$1[0], ok = _tuple$1[1];
			return [v, ok];
		} else if (65 <= c && c <= 70) {
			_tuple$2 = [(c - 65 >> 0) + 10 >> 0, true], v = _tuple$2[0], ok = _tuple$2[1];
			return [v, ok];
		}
		return [v, ok];
	};
	var UnquoteChar = go$pkg.UnquoteChar = function(s, quote) {
		var value, multibyte, tail, err, c, _tuple, r, size, _tuple$1, _tuple$2, c$1, _ref, n, _ref$1, v, j, _tuple$3, x, ok, v$1, j$1, x$1;
		value = 0;
		multibyte = false;
		tail = "";
		err = null;
		c = s.charCodeAt(0);
		if ((c === quote) && ((quote === 39) || (quote === 34))) {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		} else if (c >= 128) {
			_tuple = utf8.DecodeRuneInString(s), r = _tuple[0], size = _tuple[1];
			_tuple$1 = [r, true, s.substring(size), null], value = _tuple$1[0], multibyte = _tuple$1[1], tail = _tuple$1[2], err = _tuple$1[3];
			return [value, multibyte, tail, err];
		} else if (!((c === 92))) {
			_tuple$2 = [(s.charCodeAt(0) >> 0), false, s.substring(1), null], value = _tuple$2[0], multibyte = _tuple$2[1], tail = _tuple$2[2], err = _tuple$2[3];
			return [value, multibyte, tail, err];
		}
		if (s.length <= 1) {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		}
		c$1 = s.charCodeAt(1);
		s = s.substring(2);
		_ref = c$1;
		switch (0) { default: if (_ref === 97) {
			value = 7;
		} else if (_ref === 98) {
			value = 8;
		} else if (_ref === 102) {
			value = 12;
		} else if (_ref === 110) {
			value = 10;
		} else if (_ref === 114) {
			value = 13;
		} else if (_ref === 116) {
			value = 9;
		} else if (_ref === 118) {
			value = 11;
		} else if (_ref === 120 || _ref === 117 || _ref === 85) {
			n = 0;
			_ref$1 = c$1;
			if (_ref$1 === 120) {
				n = 2;
			} else if (_ref$1 === 117) {
				n = 4;
			} else if (_ref$1 === 85) {
				n = 8;
			}
			v = 0;
			if (s.length < n) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			j = 0;
			while (j < n) {
				_tuple$3 = unhex(s.charCodeAt(j)), x = _tuple$3[0], ok = _tuple$3[1];
				if (!ok) {
					err = go$pkg.ErrSyntax;
					return [value, multibyte, tail, err];
				}
				v = (v << 4 >> 0) | x;
				j = j + 1 >> 0;
			}
			s = s.substring(n);
			if (c$1 === 120) {
				value = v;
				break;
			}
			if (v > 1114111) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = v;
			multibyte = true;
		} else if (_ref === 48 || _ref === 49 || _ref === 50 || _ref === 51 || _ref === 52 || _ref === 53 || _ref === 54 || _ref === 55) {
			v$1 = (c$1 >> 0) - 48 >> 0;
			if (s.length < 2) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			j$1 = 0;
			while (j$1 < 2) {
				x$1 = (s.charCodeAt(j$1) >> 0) - 48 >> 0;
				if (x$1 < 0 || x$1 > 7) {
					err = go$pkg.ErrSyntax;
					return [value, multibyte, tail, err];
				}
				v$1 = ((v$1 << 3 >> 0)) | x$1;
				j$1 = j$1 + 1 >> 0;
			}
			s = s.substring(2);
			if (v$1 > 255) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = v$1;
		} else if (_ref === 92) {
			value = 92;
		} else if (_ref === 39 || _ref === 34) {
			if (!((c$1 === quote))) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = (c$1 >> 0);
		} else {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		} }
		tail = s;
		return [value, multibyte, tail, err];
	};
	var Unquote = go$pkg.Unquote = function(s) {
		var t, err, n, _tuple, quote, _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _ref, _tuple$6, _tuple$7, r, size, _tuple$8, runeTmp, _q, x, x$1, buf, _tuple$9, c, multibyte, ss, err$1, _tuple$10, n$1, _tuple$11, _tuple$12;
		t = "";
		err = null;
		n = s.length;
		if (n < 2) {
			_tuple = ["", go$pkg.ErrSyntax], t = _tuple[0], err = _tuple[1];
			return [t, err];
		}
		quote = s.charCodeAt(0);
		if (!((quote === s.charCodeAt((n - 1 >> 0))))) {
			_tuple$1 = ["", go$pkg.ErrSyntax], t = _tuple$1[0], err = _tuple$1[1];
			return [t, err];
		}
		s = s.substring(1, (n - 1 >> 0));
		if (quote === 96) {
			if (contains(s, 96)) {
				_tuple$2 = ["", go$pkg.ErrSyntax], t = _tuple$2[0], err = _tuple$2[1];
				return [t, err];
			}
			_tuple$3 = [s, null], t = _tuple$3[0], err = _tuple$3[1];
			return [t, err];
		}
		if (!((quote === 34)) && !((quote === 39))) {
			_tuple$4 = ["", go$pkg.ErrSyntax], t = _tuple$4[0], err = _tuple$4[1];
			return [t, err];
		}
		if (contains(s, 10)) {
			_tuple$5 = ["", go$pkg.ErrSyntax], t = _tuple$5[0], err = _tuple$5[1];
			return [t, err];
		}
		if (!contains(s, 92) && !contains(s, quote)) {
			_ref = quote;
			if (_ref === 34) {
				_tuple$6 = [s, null], t = _tuple$6[0], err = _tuple$6[1];
				return [t, err];
			} else if (_ref === 39) {
				_tuple$7 = utf8.DecodeRuneInString(s), r = _tuple$7[0], size = _tuple$7[1];
				if ((size === s.length) && (!((r === 65533)) || !((size === 1)))) {
					_tuple$8 = [s, null], t = _tuple$8[0], err = _tuple$8[1];
					return [t, err];
				}
			}
		}
		runeTmp = go$makeNativeArray("Uint8", 4, function() { return 0; });
		buf = (go$sliceType(Go$Uint8)).make(0, (_q = (x = 3, x$1 = s.length, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")), function() { return 0; });
		while (s.length > 0) {
			_tuple$9 = UnquoteChar(s, quote), c = _tuple$9[0], multibyte = _tuple$9[1], ss = _tuple$9[2], err$1 = _tuple$9[3];
			if (!(go$interfaceIsEqual(err$1, null))) {
				_tuple$10 = ["", err$1], t = _tuple$10[0], err = _tuple$10[1];
				return [t, err];
			}
			s = ss;
			if (c < 128 || !multibyte) {
				buf = go$append(buf, (c << 24 >>> 24));
			} else {
				n$1 = utf8.EncodeRune(new (go$sliceType(Go$Uint8))(runeTmp), c);
				buf = go$appendSlice(buf, go$subslice(new (go$sliceType(Go$Uint8))(runeTmp), 0, n$1));
			}
			if ((quote === 39) && !((s.length === 0))) {
				_tuple$11 = ["", go$pkg.ErrSyntax], t = _tuple$11[0], err = _tuple$11[1];
				return [t, err];
			}
		}
		_tuple$12 = [go$bytesToString(buf), null], t = _tuple$12[0], err = _tuple$12[1];
		return [t, err];
	};
	var contains = function(s, c) {
		var i;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === c) {
				return true;
			}
			i = i + 1 >> 0;
		}
		return false;
	};
	var bsearch16 = function(a, x) {
		var _tuple, i, j, _q, h, _slice, _index;
		_tuple = [0, a.length], i = _tuple[0], j = _tuple[1];
		while (i < j) {
			h = i + (_q = ((j - i >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			if ((_slice = a, _index = h, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < x) {
				i = h + 1 >> 0;
			} else {
				j = h;
			}
		}
		return i;
	};
	var bsearch32 = function(a, x) {
		var _tuple, i, j, _q, h, _slice, _index;
		_tuple = [0, a.length], i = _tuple[0], j = _tuple[1];
		while (i < j) {
			h = i + (_q = ((j - i >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			if ((_slice = a, _index = h, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < x) {
				i = h + 1 >> 0;
			} else {
				j = h;
			}
		}
		return i;
	};
	var IsPrint = go$pkg.IsPrint = function(r) {
		var _tuple, rr, isPrint, isNotPrint, i, _slice, _index, _slice$1, _index$1, j, _slice$2, _index$2, _tuple$1, rr$1, isPrint$1, isNotPrint$1, i$1, _slice$3, _index$3, _slice$4, _index$4, j$1, _slice$5, _index$5;
		if (r <= 255) {
			if (32 <= r && r <= 126) {
				return true;
			}
			if (161 <= r && r <= 255) {
				return !((r === 173));
			}
			return false;
		}
		if (0 <= r && r < 65536) {
			_tuple = [(r << 16 >>> 16), isPrint16, isNotPrint16], rr = _tuple[0], isPrint = _tuple[1], isNotPrint = _tuple[2];
			i = bsearch16(isPrint, rr);
			if (i >= isPrint.length || rr < (_slice = isPrint, _index = (i & ~1), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) || (_slice$1 = isPrint, _index$1 = (i | 1), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) < rr) {
				return false;
			}
			j = bsearch16(isNotPrint, rr);
			return j >= isNotPrint.length || !(((_slice$2 = isNotPrint, _index$2 = j, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) === rr));
		}
		_tuple$1 = [(r >>> 0), isPrint32, isNotPrint32], rr$1 = _tuple$1[0], isPrint$1 = _tuple$1[1], isNotPrint$1 = _tuple$1[2];
		i$1 = bsearch32(isPrint$1, rr$1);
		if (i$1 >= isPrint$1.length || rr$1 < (_slice$3 = isPrint$1, _index$3 = (i$1 & ~1), (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")) || (_slice$4 = isPrint$1, _index$4 = (i$1 | 1), (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")) < rr$1) {
			return false;
		}
		if (r >= 131072) {
			return true;
		}
		r = r - 65536 >> 0;
		j$1 = bsearch16(isNotPrint$1, (r << 16 >>> 16));
		return j$1 >= isNotPrint$1.length || !(((_slice$5 = isNotPrint$1, _index$5 = j$1, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")) === (r << 16 >>> 16)));
	};
	go$pkg.init = function() {
		optimize = true;
		powtab = new (go$sliceType(Go$Int))([1, 3, 6, 9, 13, 16, 19, 23, 26]);
		float64pow10 = new (go$sliceType(Go$Float64))([1, 10, 100, 1000, 10000, 100000, 1e+06, 1e+07, 1e+08, 1e+09, 1e+10, 1e+11, 1e+12, 1e+13, 1e+14, 1e+15, 1e+16, 1e+17, 1e+18, 1e+19, 1e+20, 1e+21, 1e+22]);
		float32pow10 = new (go$sliceType(Go$Float32))([1, 10, 100, 1000, 10000, 100000, 1e+06, 1e+07, 1e+08, 1e+09, 1e+10]);
		go$pkg.ErrRange = errors.New("value out of range");
		go$pkg.ErrSyntax = errors.New("invalid syntax");
		leftcheats = new (go$sliceType(leftCheat))([new leftCheat.Ptr(0, ""), new leftCheat.Ptr(1, "5"), new leftCheat.Ptr(1, "25"), new leftCheat.Ptr(1, "125"), new leftCheat.Ptr(2, "625"), new leftCheat.Ptr(2, "3125"), new leftCheat.Ptr(2, "15625"), new leftCheat.Ptr(3, "78125"), new leftCheat.Ptr(3, "390625"), new leftCheat.Ptr(3, "1953125"), new leftCheat.Ptr(4, "9765625"), new leftCheat.Ptr(4, "48828125"), new leftCheat.Ptr(4, "244140625"), new leftCheat.Ptr(4, "1220703125"), new leftCheat.Ptr(5, "6103515625"), new leftCheat.Ptr(5, "30517578125"), new leftCheat.Ptr(5, "152587890625"), new leftCheat.Ptr(6, "762939453125"), new leftCheat.Ptr(6, "3814697265625"), new leftCheat.Ptr(6, "19073486328125"), new leftCheat.Ptr(7, "95367431640625"), new leftCheat.Ptr(7, "476837158203125"), new leftCheat.Ptr(7, "2384185791015625"), new leftCheat.Ptr(7, "11920928955078125"), new leftCheat.Ptr(8, "59604644775390625"), new leftCheat.Ptr(8, "298023223876953125"), new leftCheat.Ptr(8, "1490116119384765625"), new leftCheat.Ptr(9, "7450580596923828125")]);
		smallPowersOfTen = go$toNativeArray("Struct", [new extFloat.Ptr(new Go$Uint64(2147483648, 0), -63, false), new extFloat.Ptr(new Go$Uint64(2684354560, 0), -60, false), new extFloat.Ptr(new Go$Uint64(3355443200, 0), -57, false), new extFloat.Ptr(new Go$Uint64(4194304000, 0), -54, false), new extFloat.Ptr(new Go$Uint64(2621440000, 0), -50, false), new extFloat.Ptr(new Go$Uint64(3276800000, 0), -47, false), new extFloat.Ptr(new Go$Uint64(4096000000, 0), -44, false), new extFloat.Ptr(new Go$Uint64(2560000000, 0), -40, false)]);
		powersOfTen = go$toNativeArray("Struct", [new extFloat.Ptr(new Go$Uint64(4203730336, 136053384), -1220, false), new extFloat.Ptr(new Go$Uint64(3132023167, 2722021238), -1193, false), new extFloat.Ptr(new Go$Uint64(2333539104, 810921078), -1166, false), new extFloat.Ptr(new Go$Uint64(3477244234, 1573795306), -1140, false), new extFloat.Ptr(new Go$Uint64(2590748842, 1432697645), -1113, false), new extFloat.Ptr(new Go$Uint64(3860516611, 1025131999), -1087, false), new extFloat.Ptr(new Go$Uint64(2876309015, 3348809418), -1060, false), new extFloat.Ptr(new Go$Uint64(4286034428, 3200048207), -1034, false), new extFloat.Ptr(new Go$Uint64(3193344495, 1097586188), -1007, false), new extFloat.Ptr(new Go$Uint64(2379227053, 2424306748), -980, false), new extFloat.Ptr(new Go$Uint64(3545324584, 827693699), -954, false), new extFloat.Ptr(new Go$Uint64(2641472655, 2913388981), -927, false), new extFloat.Ptr(new Go$Uint64(3936100983, 602835915), -901, false), new extFloat.Ptr(new Go$Uint64(2932623761, 1081627501), -874, false), new extFloat.Ptr(new Go$Uint64(2184974969, 1572261463), -847, false), new extFloat.Ptr(new Go$Uint64(3255866422, 1308317239), -821, false), new extFloat.Ptr(new Go$Uint64(2425809519, 944281679), -794, false), new extFloat.Ptr(new Go$Uint64(3614737867, 629291719), -768, false), new extFloat.Ptr(new Go$Uint64(2693189581, 2545915892), -741, false), new extFloat.Ptr(new Go$Uint64(4013165208, 388672741), -715, false), new extFloat.Ptr(new Go$Uint64(2990041083, 708162190), -688, false), new extFloat.Ptr(new Go$Uint64(2227754207, 3536207675), -661, false), new extFloat.Ptr(new Go$Uint64(3319612455, 450088378), -635, false), new extFloat.Ptr(new Go$Uint64(2473304014, 3139815830), -608, false), new extFloat.Ptr(new Go$Uint64(3685510180, 2103616900), -582, false), new extFloat.Ptr(new Go$Uint64(2745919064, 224385782), -555, false), new extFloat.Ptr(new Go$Uint64(4091738259, 3737383206), -529, false), new extFloat.Ptr(new Go$Uint64(3048582568, 2868871352), -502, false), new extFloat.Ptr(new Go$Uint64(2271371013, 1820084875), -475, false), new extFloat.Ptr(new Go$Uint64(3384606560, 885076051), -449, false), new extFloat.Ptr(new Go$Uint64(2521728396, 2444895829), -422, false), new extFloat.Ptr(new Go$Uint64(3757668132, 1881767613), -396, false), new extFloat.Ptr(new Go$Uint64(2799680927, 3102062735), -369, false), new extFloat.Ptr(new Go$Uint64(4171849679, 2289335700), -343, false), new extFloat.Ptr(new Go$Uint64(3108270227, 2410191823), -316, false), new extFloat.Ptr(new Go$Uint64(2315841784, 3205436779), -289, false), new extFloat.Ptr(new Go$Uint64(3450873173, 1697722806), -263, false), new extFloat.Ptr(new Go$Uint64(2571100870, 3497754540), -236, false), new extFloat.Ptr(new Go$Uint64(3831238852, 707476230), -210, false), new extFloat.Ptr(new Go$Uint64(2854495385, 1769181907), -183, false), new extFloat.Ptr(new Go$Uint64(4253529586, 2197867022), -157, false), new extFloat.Ptr(new Go$Uint64(3169126500, 2450594539), -130, false), new extFloat.Ptr(new Go$Uint64(2361183241, 1867548876), -103, false), new extFloat.Ptr(new Go$Uint64(3518437208, 3793315116), -77, false), new extFloat.Ptr(new Go$Uint64(2621440000, 0), -50, false), new extFloat.Ptr(new Go$Uint64(3906250000, 0), -24, false), new extFloat.Ptr(new Go$Uint64(2910383045, 2892103680), 3, false), new extFloat.Ptr(new Go$Uint64(2168404344, 4170451332), 30, false), new extFloat.Ptr(new Go$Uint64(3231174267, 3372684723), 56, false), new extFloat.Ptr(new Go$Uint64(2407412430, 2078956656), 83, false), new extFloat.Ptr(new Go$Uint64(3587324068, 2884206696), 109, false), new extFloat.Ptr(new Go$Uint64(2672764710, 395977285), 136, false), new extFloat.Ptr(new Go$Uint64(3982729777, 3569679143), 162, false), new extFloat.Ptr(new Go$Uint64(2967364920, 2361961896), 189, false), new extFloat.Ptr(new Go$Uint64(2210859150, 447440347), 216, false), new extFloat.Ptr(new Go$Uint64(3294436857, 1114709402), 242, false), new extFloat.Ptr(new Go$Uint64(2454546732, 2786846552), 269, false), new extFloat.Ptr(new Go$Uint64(3657559652, 443583978), 295, false), new extFloat.Ptr(new Go$Uint64(2725094297, 2599384906), 322, false), new extFloat.Ptr(new Go$Uint64(4060706939, 3028118405), 348, false), new extFloat.Ptr(new Go$Uint64(3025462433, 2044532855), 375, false), new extFloat.Ptr(new Go$Uint64(2254145170, 1536935362), 402, false), new extFloat.Ptr(new Go$Uint64(3358938053, 3365297469), 428, false), new extFloat.Ptr(new Go$Uint64(2502603868, 4204241075), 455, false), new extFloat.Ptr(new Go$Uint64(3729170365, 2577424355), 481, false), new extFloat.Ptr(new Go$Uint64(2778448436, 3677981733), 508, false), new extFloat.Ptr(new Go$Uint64(4140210802, 2744688476), 534, false), new extFloat.Ptr(new Go$Uint64(3084697427, 1424604878), 561, false), new extFloat.Ptr(new Go$Uint64(2298278679, 4062331362), 588, false), new extFloat.Ptr(new Go$Uint64(3424702107, 3546052773), 614, false), new extFloat.Ptr(new Go$Uint64(2551601907, 2065781727), 641, false), new extFloat.Ptr(new Go$Uint64(3802183132, 2535403578), 667, false), new extFloat.Ptr(new Go$Uint64(2832847187, 1558426518), 694, false), new extFloat.Ptr(new Go$Uint64(4221271257, 2762425404), 720, false), new extFloat.Ptr(new Go$Uint64(3145092172, 2812560400), 747, false), new extFloat.Ptr(new Go$Uint64(2343276271, 3057687578), 774, false), new extFloat.Ptr(new Go$Uint64(3491753744, 2790753324), 800, false), new extFloat.Ptr(new Go$Uint64(2601559269, 3918606633), 827, false), new extFloat.Ptr(new Go$Uint64(3876625403, 2711358621), 853, false), new extFloat.Ptr(new Go$Uint64(2888311001, 1648096297), 880, false), new extFloat.Ptr(new Go$Uint64(2151959390, 2057817989), 907, false), new extFloat.Ptr(new Go$Uint64(3206669376, 61660461), 933, false), new extFloat.Ptr(new Go$Uint64(2389154863, 1581580175), 960, false), new extFloat.Ptr(new Go$Uint64(3560118173, 2626467905), 986, false), new extFloat.Ptr(new Go$Uint64(2652494738, 3034782633), 1013, false), new extFloat.Ptr(new Go$Uint64(3952525166, 3135207385), 1039, false), new extFloat.Ptr(new Go$Uint64(2944860731, 2616258155), 1066, false)]);
		uint64pow10 = go$toNativeArray("Uint64", [new Go$Uint64(0, 1), new Go$Uint64(0, 10), new Go$Uint64(0, 100), new Go$Uint64(0, 1000), new Go$Uint64(0, 10000), new Go$Uint64(0, 100000), new Go$Uint64(0, 1000000), new Go$Uint64(0, 10000000), new Go$Uint64(0, 100000000), new Go$Uint64(0, 1000000000), new Go$Uint64(2, 1410065408), new Go$Uint64(23, 1215752192), new Go$Uint64(232, 3567587328), new Go$Uint64(2328, 1316134912), new Go$Uint64(23283, 276447232), new Go$Uint64(232830, 2764472320), new Go$Uint64(2328306, 1874919424), new Go$Uint64(23283064, 1569325056), new Go$Uint64(232830643, 2808348672), new Go$Uint64(2328306436, 2313682944)]);
		float32info = new floatInfo.Ptr(23, 8, -127);
		float64info = new floatInfo.Ptr(52, 11, -1023);
		isPrint16 = new (go$sliceType(Go$Uint16))([32, 126, 161, 887, 890, 894, 900, 1319, 1329, 1366, 1369, 1418, 1423, 1479, 1488, 1514, 1520, 1524, 1542, 1563, 1566, 1805, 1808, 1866, 1869, 1969, 1984, 2042, 2048, 2093, 2096, 2139, 2142, 2142, 2208, 2220, 2276, 2444, 2447, 2448, 2451, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2531, 2534, 2555, 2561, 2570, 2575, 2576, 2579, 2617, 2620, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2654, 2662, 2677, 2689, 2745, 2748, 2765, 2768, 2768, 2784, 2787, 2790, 2801, 2817, 2828, 2831, 2832, 2835, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2915, 2918, 2935, 2946, 2954, 2958, 2965, 2969, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3021, 3024, 3024, 3031, 3031, 3046, 3066, 3073, 3129, 3133, 3149, 3157, 3161, 3168, 3171, 3174, 3183, 3192, 3199, 3202, 3257, 3260, 3277, 3285, 3286, 3294, 3299, 3302, 3314, 3330, 3386, 3389, 3406, 3415, 3415, 3424, 3427, 3430, 3445, 3449, 3455, 3458, 3478, 3482, 3517, 3520, 3526, 3530, 3530, 3535, 3551, 3570, 3572, 3585, 3642, 3647, 3675, 3713, 3716, 3719, 3722, 3725, 3725, 3732, 3751, 3754, 3773, 3776, 3789, 3792, 3801, 3804, 3807, 3840, 3948, 3953, 4058, 4096, 4295, 4301, 4301, 4304, 4685, 4688, 4701, 4704, 4749, 4752, 4789, 4792, 4805, 4808, 4885, 4888, 4954, 4957, 4988, 4992, 5017, 5024, 5108, 5120, 5788, 5792, 5872, 5888, 5908, 5920, 5942, 5952, 5971, 5984, 6003, 6016, 6109, 6112, 6121, 6128, 6137, 6144, 6157, 6160, 6169, 6176, 6263, 6272, 6314, 6320, 6389, 6400, 6428, 6432, 6443, 6448, 6459, 6464, 6464, 6468, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6618, 6622, 6683, 6686, 6780, 6783, 6793, 6800, 6809, 6816, 6829, 6912, 6987, 6992, 7036, 7040, 7155, 7164, 7223, 7227, 7241, 7245, 7295, 7360, 7367, 7376, 7414, 7424, 7654, 7676, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8061, 8064, 8147, 8150, 8175, 8178, 8190, 8208, 8231, 8240, 8286, 8304, 8305, 8308, 8348, 8352, 8378, 8400, 8432, 8448, 8585, 8592, 9203, 9216, 9254, 9280, 9290, 9312, 11084, 11088, 11097, 11264, 11507, 11513, 11559, 11565, 11565, 11568, 11623, 11631, 11632, 11647, 11670, 11680, 11835, 11904, 12019, 12032, 12245, 12272, 12283, 12289, 12438, 12441, 12543, 12549, 12589, 12593, 12730, 12736, 12771, 12784, 19893, 19904, 40908, 40960, 42124, 42128, 42182, 42192, 42539, 42560, 42647, 42655, 42743, 42752, 42899, 42912, 42922, 43000, 43051, 43056, 43065, 43072, 43127, 43136, 43204, 43214, 43225, 43232, 43259, 43264, 43347, 43359, 43388, 43392, 43481, 43486, 43487, 43520, 43574, 43584, 43597, 43600, 43609, 43612, 43643, 43648, 43714, 43739, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43822, 43968, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64449, 64467, 64831, 64848, 64911, 64914, 64967, 65008, 65021, 65024, 65049, 65056, 65062, 65072, 65131, 65136, 65276, 65281, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65504, 65518, 65532, 65533]);
		isNotPrint16 = new (go$sliceType(Go$Uint16))([173, 907, 909, 930, 1376, 1416, 1424, 1757, 2111, 2209, 2303, 2424, 2432, 2436, 2473, 2481, 2526, 2564, 2601, 2609, 2612, 2615, 2621, 2653, 2692, 2702, 2706, 2729, 2737, 2740, 2758, 2762, 2820, 2857, 2865, 2868, 2910, 2948, 2961, 2971, 2973, 3017, 3076, 3085, 3089, 3113, 3124, 3141, 3145, 3159, 3204, 3213, 3217, 3241, 3252, 3269, 3273, 3295, 3312, 3332, 3341, 3345, 3397, 3401, 3460, 3506, 3516, 3541, 3543, 3715, 3721, 3736, 3744, 3748, 3750, 3756, 3770, 3781, 3783, 3912, 3992, 4029, 4045, 4294, 4681, 4695, 4697, 4745, 4785, 4799, 4801, 4823, 4881, 5760, 5901, 5997, 6001, 6751, 8024, 8026, 8028, 8030, 8117, 8133, 8156, 8181, 8335, 9984, 11311, 11359, 11558, 11687, 11695, 11703, 11711, 11719, 11727, 11735, 11743, 11930, 12352, 12687, 12831, 13055, 42895, 43470, 43815, 64311, 64317, 64319, 64322, 64325, 65107, 65127, 65141, 65511]);
		isPrint32 = new (go$sliceType(Go$Uint32))([65536, 65613, 65616, 65629, 65664, 65786, 65792, 65794, 65799, 65843, 65847, 65930, 65936, 65947, 66000, 66045, 66176, 66204, 66208, 66256, 66304, 66339, 66352, 66378, 66432, 66499, 66504, 66517, 66560, 66717, 66720, 66729, 67584, 67589, 67592, 67640, 67644, 67644, 67647, 67679, 67840, 67867, 67871, 67897, 67903, 67903, 67968, 68023, 68030, 68031, 68096, 68102, 68108, 68147, 68152, 68154, 68159, 68167, 68176, 68184, 68192, 68223, 68352, 68405, 68409, 68437, 68440, 68466, 68472, 68479, 68608, 68680, 69216, 69246, 69632, 69709, 69714, 69743, 69760, 69825, 69840, 69864, 69872, 69881, 69888, 69955, 70016, 70088, 70096, 70105, 71296, 71351, 71360, 71369, 73728, 74606, 74752, 74850, 74864, 74867, 77824, 78894, 92160, 92728, 93952, 94020, 94032, 94078, 94095, 94111, 110592, 110593, 118784, 119029, 119040, 119078, 119081, 119154, 119163, 119261, 119296, 119365, 119552, 119638, 119648, 119665, 119808, 119967, 119970, 119970, 119973, 119974, 119977, 120074, 120077, 120134, 120138, 120485, 120488, 120779, 120782, 120831, 126464, 126500, 126503, 126523, 126530, 126530, 126535, 126548, 126551, 126564, 126567, 126619, 126625, 126651, 126704, 126705, 126976, 127019, 127024, 127123, 127136, 127150, 127153, 127166, 127169, 127199, 127232, 127242, 127248, 127339, 127344, 127386, 127462, 127490, 127504, 127546, 127552, 127560, 127568, 127569, 127744, 127776, 127792, 127868, 127872, 127891, 127904, 127946, 127968, 127984, 128000, 128252, 128256, 128317, 128320, 128323, 128336, 128359, 128507, 128576, 128581, 128591, 128640, 128709, 128768, 128883, 131072, 173782, 173824, 177972, 177984, 178205, 194560, 195101, 917760, 917999]);
		isNotPrint32 = new (go$sliceType(Go$Uint16))([12, 39, 59, 62, 799, 926, 2057, 2102, 2134, 2564, 2580, 2584, 4285, 4405, 54357, 54429, 54445, 54458, 54460, 54468, 54534, 54549, 54557, 54586, 54591, 54597, 54609, 60932, 60960, 60963, 60968, 60979, 60984, 60986, 61000, 61002, 61004, 61008, 61011, 61016, 61018, 61020, 61022, 61024, 61027, 61035, 61043, 61048, 61053, 61055, 61066, 61092, 61098, 61648, 61743, 62262, 62405, 62527, 62529, 62712]);
		shifts = go$toNativeArray("Uint", [0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]);
	};
	return go$pkg;
})();
go$packages["main"] = (function() {
	var go$pkg = {};
	var jquery = go$packages["github.com/rusco/jquery"];
	var qunit = go$packages["github.com/rusco/qunit"];
	var strconv = go$packages["strconv"];
	var main = go$pkg.main = function() {
		qunit.Module("core");
		qunit.Test("jQuery Properties", (function(assert) {
			var _struct, jQ, _struct$1, jQ2;
			jQ = (_struct = jquery.NewJQuery(new (go$sliceType(Go$String))([])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
			assert.Equal(new Go$String(go$internalize(jQ.o.jquery, Go$String)), new Go$String("2.1.0"), "JQuery Version");
			assert.Equal(new Go$String(go$internalize(jQ.o.length, Go$String)), new Go$Int(0), "jQuery().Length");
			jQ2 = (_struct$1 = jquery.NewJQuery(new (go$sliceType(Go$String))(["body"])), new jquery.JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
			assert.Equal(new Go$String(go$internalize(jQ2.o.selector, Go$String)), new Go$String("body"), "jQuery(\"body\").Selector");
		}));
		qunit.Module("dom");
		qunit.Test("basic dom manipulations", (function(assert) {
			var txt;
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p"])).AddClass("wow").Clone().Add("<span id='dom02'>WhatADay</span>").AppendTo("#div02");
			txt = jquery.NewJQuery(new (go$sliceType(Go$String))(["#div02"])).Find("span#dom02").Text();
			assert.Equal(new Go$String(txt), new Go$String("WhatADay"), "Test of Clone, Add, AppendTo, Find, Text Functions");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 ul.first"])).Find(".foo").SetCss(new Go$String("width"), new Go$String("200px")).End().Find(".bar").SetCss(new Go$String("width"), new Go$String("300px"));
			assert.Equal(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01a"])).Css("width")), new Go$String("200px"), "Width should be 200px");
			assert.NotEqual(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01b"])).Css("width")), new Go$String("200px"), "Strange: Width is 200px ?");
			assert.Equal(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01c"])).Css("width")), new Go$String("300px"), "Width should be 300px");
			assert.NotEqual(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01d"])).Css("width")), new Go$String("200px"), "Strange: Width is 200px ?");
			assert.NotEqual(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01d"])).Css("width")), new Go$String("300px"), "Strange: Width is 300px ?");
			assert.NotEqual(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01e"])).Css("width")), new Go$String("200px"), "Strange: Width is 200px ?");
			assert.NotEqual(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01e"])).Css("width")), new Go$String("300px"), "Strange: Width is 300px ?");
			assert.NotEqual(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01f"])).Css("width")), new Go$String("200px"), "Strange: Width is 200px ?");
			assert.NotEqual(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01 #div01f"])).Css("width")), new Go$String("300px"), "Strange: Width is 300px ?");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["li.third-item"])).Next().SetText("ok");
			assert.Equal(new Go$String(jquery.NewJQuery(new (go$sliceType(Go$String))(["#div02a"])).Text()), new Go$String("ok"), "Text should be 'ok' ");
		}));
		qunit.Module("api only");
		qunit.Test("add function", (function(assert) {
			var _struct, p, _struct$1, pdiv, _struct$2, elem, color, _struct$3, _struct$4, _struct$5, _struct$6, collection, _struct$7, _struct$8;
			qunit.Expect(0);
			p = (_struct = jquery.NewJQuery(new (go$sliceType(Go$String))(["p"])).Add("div").AddClass("dummy"), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length));
			pdiv = (_struct$1 = jquery.NewJQuery(new (go$sliceType(Go$String))(["p"])).Add("div"), new jquery.JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length));
			elem = (_struct$2 = jquery.NewJQuery(new (go$sliceType(Go$String))(["#div01"])).Add("p"), new jquery.JQuery.Ptr(_struct$2.o, _struct$2.Jquery, _struct$2.Selector, _struct$2.Length));
			color = elem.Css("background-color");
			elem.SetCss(new Go$String("background-color"), new Go$String(color));
			jquery.NewJQuery(new (go$sliceType(Go$String))(["li#doesnotexist"])).Clone().AddJQuery((_struct$3 = jquery.NewJQuery(new (go$sliceType(Go$String))(["dt"])), new jquery.JQuery.Ptr(_struct$3.o, _struct$3.Jquery, _struct$3.Selector, _struct$3.Length))).SetCss(new Go$String("background-color"), new Go$String("red")).AppendTo("#div01");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["li#doesalsonotexist"])).SetCss(new Go$String("background-color"), new Go$String("red")).AppendTo("#div01");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["li#andthis"])).Add("<p id='new'>new paragraph</p>").SetCss(new Go$String("background-color"), new Go$String("red")).AppendTo("#div01");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["div#new01"])).SetCss(new Go$String("border"), new Go$String("2px solid red")).Add("h3").SetCss(new Go$String("background"), new Go$String("silver")).AppendTo("#div01");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p#xnew02"])).Add("dl").SetCss(new Go$String("background"), new Go$String("blue"));
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p#new03"])).Clone().AddHtml("<span>Again</span>").AppendToJQuery((_struct$4 = jquery.NewJQuery(new (go$sliceType(Go$String))(["body #div01"])), new jquery.JQuery.Ptr(_struct$4.o, _struct$4.Jquery, _struct$4.Selector, _struct$4.Length)));
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p#new04"])).AddJQuery((_struct$5 = jquery.NewJQuery(new (go$sliceType(Go$String))(["a#sth"])), new jquery.JQuery.Ptr(_struct$5.o, _struct$5.Jquery, _struct$5.Selector, _struct$5.Length))).SetCss(new Go$String("background"), new Go$String("red"));
			collection = (_struct$6 = jquery.NewJQuery(new (go$sliceType(Go$String))(["p#elsewhere"])), new jquery.JQuery.Ptr(_struct$6.o, _struct$6.Jquery, _struct$6.Selector, _struct$6.Length));
			collection = (_struct$8 = collection.AddJQuery((_struct$7 = jquery.NewJQuery(new (go$sliceType(Go$String))(["a#notehere"])), new jquery.JQuery.Ptr(_struct$7.o, _struct$7.Jquery, _struct$7.Selector, _struct$7.Length))), new jquery.JQuery.Ptr(_struct$8.o, _struct$8.Jquery, _struct$8.Selector, _struct$8.Length));
			collection.SetCss(new Go$String("background"), new Go$String("green"));
		}));
		qunit.Test("addClass function", (function(assert) {
			qunit.Expect(0);
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p#someidx01"])).AddClass("myClass yourClass");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p#someidx02"])).RemoveClass("myClass noClass").AddClass("yourClass");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["ul#someidx03 li"])).AddClassFn((function(index) {
				return "item-" + strconv.Itoa(index);
			}));
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p#someide04"])).AddClass("selected");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["p#someidx05"])).AddClass("selected highlight");
			jquery.NewJQuery(new (go$sliceType(Go$String))(["div#someidx06"])).AddClassFnClass((function(index, currentClass) {
				var addedClass;
				addedClass = "";
				if (currentClass === "red") {
					addedClass = "green";
					jquery.NewJQuery(new (go$sliceType(Go$String))(["p"])).SetText("There is one green div");
				}
				return addedClass;
			}));
		}));
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$error.implementedBy = [go$packages["errors"].errorString.Ptr, go$packages["github.com/neelance/gopherjs/js"].Error.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$packages["strconv"].NumError.Ptr, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString)];
go$packages["runtime"].Error.implementedBy = [go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString)];
go$packages["runtime"].stringer.implementedBy = [go$packages["github.com/neelance/gopherjs/js"].Error, go$packages["github.com/neelance/gopherjs/js"].Error.Ptr, go$packages["github.com/rusco/jquery"].Event, go$packages["github.com/rusco/jquery"].Event.Ptr, go$packages["github.com/rusco/qunit"].DoneCallbackObject, go$packages["github.com/rusco/qunit"].DoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].LogCallbackObject, go$packages["github.com/rusco/qunit"].LogCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].QUnitAssert, go$packages["github.com/rusco/qunit"].QUnitAssert.Ptr, go$packages["github.com/rusco/qunit"].Raises, go$packages["github.com/rusco/qunit"].Raises.Ptr, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].TestStartCallbackObject, go$packages["github.com/rusco/qunit"].TestStartCallbackObject.Ptr, go$packages["strconv"].decimal.Ptr];
go$packages["github.com/neelance/gopherjs/js"].Object.implementedBy = [go$packages["github.com/neelance/gopherjs/js"].Error, go$packages["github.com/neelance/gopherjs/js"].Error.Ptr, go$packages["github.com/rusco/jquery"].Event, go$packages["github.com/rusco/jquery"].Event.Ptr, go$packages["github.com/rusco/qunit"].DoneCallbackObject, go$packages["github.com/rusco/qunit"].DoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].LogCallbackObject, go$packages["github.com/rusco/qunit"].LogCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].QUnitAssert, go$packages["github.com/rusco/qunit"].QUnitAssert.Ptr, go$packages["github.com/rusco/qunit"].Raises, go$packages["github.com/rusco/qunit"].Raises.Ptr, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].TestStartCallbackObject, go$packages["github.com/rusco/qunit"].TestStartCallbackObject.Ptr];
go$packages["runtime"].init();
go$packages["github.com/neelance/gopherjs/js"].init();
go$packages["github.com/rusco/jquery"].init();
go$packages["github.com/rusco/qunit"].init();
go$packages["errors"].init();
go$packages["math"].init();
go$packages["unicode/utf8"].init();
go$packages["strconv"].init();
go$packages["main"].init();
go$packages["main"].main();
