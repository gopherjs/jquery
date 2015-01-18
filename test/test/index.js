"use strict";
(function($topLevelThis) {

Error.stackTraceLimit = Infinity;

var $global, $module;
if (typeof window !== "undefined") { /* web page */
  $global = window;
} else if (typeof self !== "undefined") { /* web worker */
  $global = self;
} else if (typeof global !== "undefined") { /* Node.js */
  $global = global;
  $global.require = require;
} else { /* others (e.g. Nashorn) */
  $global = $topLevelThis;
}

if ($global === undefined || $global.Array === undefined) {
  throw new Error("no global object found");
}
if (typeof module !== "undefined") {
  $module = module;
}

var $packages = {}, $reflect, $idCounter = 0;
var $keys = function(m) { return m ? Object.keys(m) : []; };
var $min = Math.min;
var $mod = function(x, y) { return x % y; };
var $parseInt = parseInt;
var $parseFloat = function(f) {
  if (f !== undefined && f !== null && f.constructor === Number) {
    return f;
  }
  return parseFloat(f);
};
var $flushConsole = function() {};

var $mapArray = function(array, f) {
  var newArray = new array.constructor(array.length);
  for (var i = 0; i < array.length; i++) {
    newArray[i] = f(array[i]);
  }
  return newArray;
};

var $methodVal = function(recv, name) {
  var vals = recv.$methodVals || {};
  recv.$methodVals = vals; /* noop for primitives */
  var f = vals[name];
  if (f !== undefined) {
    return f;
  }
  var method = recv[name];
  f = function() {
    $stackDepthOffset--;
    try {
      return method.apply(recv, arguments);
    } finally {
      $stackDepthOffset++;
    }
  };
  vals[name] = f;
  return f;
};

var $methodExpr = function(method) {
  if (method.$expr === undefined) {
    method.$expr = function() {
      $stackDepthOffset--;
      try {
        return Function.call.apply(method, arguments);
      } finally {
        $stackDepthOffset++;
      }
    };
  }
  return method.$expr;
};

var $subslice = function(slice, low, high, max) {
  if (low < 0 || high < low || max < high || high > slice.$capacity || max > slice.$capacity) {
    $throwRuntimeError("slice bounds out of range");
  }
  var s = new slice.constructor(slice.$array);
  s.$offset = slice.$offset + low;
  s.$length = slice.$length - low;
  s.$capacity = slice.$capacity - low;
  if (high !== undefined) {
    s.$length = high - low;
  }
  if (max !== undefined) {
    s.$capacity = max - low;
  }
  return s;
};

var $sliceToArray = function(slice) {
  if (slice.$length === 0) {
    return [];
  }
  if (slice.$array.constructor !== Array) {
    return slice.$array.subarray(slice.$offset, slice.$offset + slice.$length);
  }
  return slice.$array.slice(slice.$offset, slice.$offset + slice.$length);
};

var $decodeRune = function(str, pos) {
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

var $encodeRune = function(r) {
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

var $stringToBytes = function(str) {
  var array = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i);
  }
  return array;
};

var $bytesToString = function(slice) {
  if (slice.$length === 0) {
    return "";
  }
  var str = "";
  for (var i = 0; i < slice.$length; i += 10000) {
    str += String.fromCharCode.apply(null, slice.$array.subarray(slice.$offset + i, slice.$offset + Math.min(slice.$length, i + 10000)));
  }
  return str;
};

var $stringToRunes = function(str) {
  var array = new Int32Array(str.length);
  var rune, j = 0;
  for (var i = 0; i < str.length; i += rune[1], j++) {
    rune = $decodeRune(str, i);
    array[j] = rune[0];
  }
  return array.subarray(0, j);
};

var $runesToString = function(slice) {
  if (slice.$length === 0) {
    return "";
  }
  var str = "";
  for (var i = 0; i < slice.$length; i++) {
    str += $encodeRune(slice.$array[slice.$offset + i]);
  }
  return str;
};

var $copyString = function(dst, src) {
  var n = Math.min(src.length, dst.$length);
  for (var i = 0; i < n; i++) {
    dst.$array[dst.$offset + i] = src.charCodeAt(i);
  }
  return n;
};

var $copySlice = function(dst, src) {
  var n = Math.min(src.$length, dst.$length);
  $internalCopy(dst.$array, src.$array, dst.$offset, src.$offset, n, dst.constructor.elem);
  return n;
};

var $copy = function(dst, src, type) {
  switch (type.kind) {
  case $kindArray:
    $internalCopy(dst, src, 0, 0, src.length, type.elem);
    break;
  case $kindStruct:
    for (var i = 0; i < type.fields.length; i++) {
      var f = type.fields[i];
      switch (f.type.kind) {
      case $kindArray:
      case $kindStruct:
        $copy(dst[f.prop], src[f.prop], f.type);
        continue;
      default:
        dst[f.prop] = src[f.prop];
        continue;
      }
    }
    break;
  }
};

var $internalCopy = function(dst, src, dstOffset, srcOffset, n, elem) {
  if (n === 0 || (dst === src && dstOffset === srcOffset)) {
    return;
  }

  if (src.subarray) {
    dst.set(src.subarray(srcOffset, srcOffset + n), dstOffset);
    return;
  }

  switch (elem.kind) {
  case $kindArray:
  case $kindStruct:
    if (dst === src && dstOffset > srcOffset) {
      for (var i = n - 1; i >= 0; i--) {
        $copy(dst[dstOffset + i], src[srcOffset + i], elem);
      }
      return;
    }
    for (var i = 0; i < n; i++) {
      $copy(dst[dstOffset + i], src[srcOffset + i], elem);
    }
    return;
  }

  if (dst === src && dstOffset > srcOffset) {
    for (var i = n - 1; i >= 0; i--) {
      dst[dstOffset + i] = src[srcOffset + i];
    }
    return;
  }
  for (var i = 0; i < n; i++) {
    dst[dstOffset + i] = src[srcOffset + i];
  }
};

var $clone = function(src, type) {
  var clone = type.zero();
  $copy(clone, src, type);
  return clone;
};

var $pointerOfStructConversion = function(obj, type) {
  if(obj.$proxies === undefined) {
    obj.$proxies = {};
    obj.$proxies[obj.constructor.string] = obj;
  }
  var proxy = obj.$proxies[type.string];
  if (proxy === undefined) {
    var properties = {};
    for (var i = 0; i < type.elem.fields.length; i++) {
      (function(fieldProp) {
        properties[fieldProp] = {
          get: function() { return obj[fieldProp]; },
          set: function(value) { obj[fieldProp] = value; },
        };
      })(type.elem.fields[i].prop);
    }
    proxy = Object.create(type.prototype, properties);
    proxy.$val = proxy;
    obj.$proxies[type.string] = proxy;
    proxy.$proxies = obj.$proxies;
  }
  return proxy;
};

var $append = function(slice) {
  return $internalAppend(slice, arguments, 1, arguments.length - 1);
};

var $appendSlice = function(slice, toAppend) {
  return $internalAppend(slice, toAppend.$array, toAppend.$offset, toAppend.$length);
};

var $internalAppend = function(slice, array, offset, length) {
  if (length === 0) {
    return slice;
  }

  var newArray = slice.$array;
  var newOffset = slice.$offset;
  var newLength = slice.$length + length;
  var newCapacity = slice.$capacity;

  if (newLength > newCapacity) {
    newOffset = 0;
    newCapacity = Math.max(newLength, slice.$capacity < 1024 ? slice.$capacity * 2 : Math.floor(slice.$capacity * 5 / 4));

    if (slice.$array.constructor === Array) {
      newArray = slice.$array.slice(slice.$offset, slice.$offset + slice.$length);
      newArray.length = newCapacity;
      var zero = slice.constructor.elem.zero;
      for (var i = slice.$length; i < newCapacity; i++) {
        newArray[i] = zero();
      }
    } else {
      newArray = new slice.$array.constructor(newCapacity);
      newArray.set(slice.$array.subarray(slice.$offset, slice.$offset + slice.$length));
    }
  }

  $internalCopy(newArray, array, newOffset + slice.$length, offset, length, slice.constructor.elem);

  var newSlice = new slice.constructor(newArray);
  newSlice.$offset = newOffset;
  newSlice.$length = newLength;
  newSlice.$capacity = newCapacity;
  return newSlice;
};

var $equal = function(a, b, type) {
  switch (type.kind) {
  case $kindFloat32:
    return $float32IsEqual(a, b);
  case $kindComplex64:
    return $float32IsEqual(a.$real, b.$real) && $float32IsEqual(a.$imag, b.$imag);
  case $kindComplex128:
    return a.$real === b.$real && a.$imag === b.$imag;
  case $kindInt64:
  case $kindUint64:
    return a.$high === b.$high && a.$low === b.$low;
  case $kindPtr:
    if (a.constructor.elem) {
      return a === b;
    }
    return $pointerIsEqual(a, b);
  case $kindArray:
    if (a.length != b.length) {
      return false;
    }
    for (var i = 0; i < a.length; i++) {
      if (!$equal(a[i], b[i], type.elem)) {
        return false;
      }
    }
    return true;
  case $kindStruct:
    for (var i = 0; i < type.fields.length; i++) {
      var f = type.fields[i];
      if (!$equal(a[f.prop], b[f.prop], f.type)) {
        return false;
      }
    }
    return true;
  case $kindInterface:
    if (type === $js.Object || type === $js.Any) {
      return a === b;
    }
    return $interfaceIsEqual(a, b);
  default:
    return a === b;
  }
};

var $interfaceIsEqual = function(a, b) {
  if (a === $ifaceNil || b === $ifaceNil) {
    return a === b;
  }
  if (a.constructor !== b.constructor) {
    return false;
  }
  if (!a.constructor.comparable) {
    $throwRuntimeError("comparing uncomparable type " + a.constructor.string);
  }
  return $equal(a.$val, b.$val, a.constructor);
};

var $float32IsEqual = function(a, b) {
  if (a === b) {
    return true;
  }
  if (a === 1/0 || b === 1/0 || a === -1/0 || b === -1/0 || a !== a || b !== b) {
    return false;
  }
  var math = $packages["math"];
  return math !== undefined && math.Float32bits(a) === math.Float32bits(b);
};

var $pointerIsEqual = function(a, b) {
  if (a === b) {
    return true;
  }
  if (a.$get === $throwNilPointerError || b.$get === $throwNilPointerError) {
    return a.$get === $throwNilPointerError && b.$get === $throwNilPointerError;
  }
  var va = a.$get();
  var vb = b.$get();
  if (va !== vb) {
    return false;
  }
  var dummy = va + 1;
  a.$set(dummy);
  var equal = b.$get() === dummy;
  a.$set(va);
  return equal;
};

var $kindBool = 1;
var $kindInt = 2;
var $kindInt8 = 3;
var $kindInt16 = 4;
var $kindInt32 = 5;
var $kindInt64 = 6;
var $kindUint = 7;
var $kindUint8 = 8;
var $kindUint16 = 9;
var $kindUint32 = 10;
var $kindUint64 = 11;
var $kindUintptr = 12;
var $kindFloat32 = 13;
var $kindFloat64 = 14;
var $kindComplex64 = 15;
var $kindComplex128 = 16;
var $kindArray = 17;
var $kindChan = 18;
var $kindFunc = 19;
var $kindInterface = 20;
var $kindMap = 21;
var $kindPtr = 22;
var $kindSlice = 23;
var $kindString = 24;
var $kindStruct = 25;
var $kindUnsafePointer = 26;

var $newType = function(size, kind, string, name, pkgPath, constructor) {
  var typ;
  switch(kind) {
  case $kindBool:
  case $kindInt:
  case $kindInt8:
  case $kindInt16:
  case $kindInt32:
  case $kindUint:
  case $kindUint8:
  case $kindUint16:
  case $kindUint32:
  case $kindUintptr:
  case $kindString:
  case $kindUnsafePointer:
    typ = function(v) { this.$val = v; };
    typ.prototype.$key = function() { return string + "$" + this.$val; };
    break;

  case $kindFloat32:
  case $kindFloat64:
    typ = function(v) { this.$val = v; };
    typ.prototype.$key = function() { return string + "$" + $floatKey(this.$val); };
    break;

  case $kindInt64:
    typ = function(high, low) {
      this.$high = (high + Math.floor(Math.ceil(low) / 4294967296)) >> 0;
      this.$low = low >>> 0;
      this.$val = this;
    };
    typ.prototype.$key = function() { return string + "$" + this.$high + "$" + this.$low; };
    break;

  case $kindUint64:
    typ = function(high, low) {
      this.$high = (high + Math.floor(Math.ceil(low) / 4294967296)) >>> 0;
      this.$low = low >>> 0;
      this.$val = this;
    };
    typ.prototype.$key = function() { return string + "$" + this.$high + "$" + this.$low; };
    break;

  case $kindComplex64:
  case $kindComplex128:
    typ = function(real, imag) {
      this.$real = real;
      this.$imag = imag;
      this.$val = this;
    };
    typ.prototype.$key = function() { return string + "$" + this.$real + "$" + this.$imag; };
    break;

  case $kindArray:
    typ = function(v) { this.$val = v; };
    typ.ptr = $newType(4, $kindPtr, "*" + string, "", "", function(array) {
      this.$get = function() { return array; };
      this.$set = function(v) { $copy(this, v, typ); };
      this.$val = array;
    });
    typ.init = function(elem, len) {
      typ.elem = elem;
      typ.len = len;
      typ.comparable = elem.comparable;
      typ.prototype.$key = function() {
        return string + "$" + Array.prototype.join.call($mapArray(this.$val, function(e) {
          var key = e.$key ? e.$key() : String(e);
          return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
        }), "$");
      };
      typ.ptr.init(typ);
      Object.defineProperty(typ.ptr.nil, "nilCheck", { get: $throwNilPointerError });
    };
    break;

  case $kindChan:
    typ = function(capacity) {
      this.$val = this;
      this.$capacity = capacity;
      this.$buffer = [];
      this.$sendQueue = [];
      this.$recvQueue = [];
      this.$closed = false;
    };
    typ.prototype.$key = function() {
      if (this.$id === undefined) {
        $idCounter++;
        this.$id = $idCounter;
      }
      return String(this.$id);
    };
    typ.init = function(elem, sendOnly, recvOnly) {
      typ.elem = elem;
      typ.sendOnly = sendOnly;
      typ.recvOnly = recvOnly;
      typ.nil = new typ(0);
      typ.nil.$sendQueue = typ.nil.$recvQueue = { length: 0, push: function() {}, shift: function() { return undefined; }, indexOf: function() { return -1; } };
    };
    break;

  case $kindFunc:
    typ = function(v) { this.$val = v; };
    typ.init = function(params, results, variadic) {
      typ.params = params;
      typ.results = results;
      typ.variadic = variadic;
      typ.comparable = false;
    };
    break;

  case $kindInterface:
    typ = { implementedBy: {}, missingMethodFor: {} };
    typ.init = function(methods) {
      typ.methods = methods;
    };
    break;

  case $kindMap:
    typ = function(v) { this.$val = v; };
    typ.init = function(key, elem) {
      typ.key = key;
      typ.elem = elem;
      typ.comparable = false;
    };
    break;

  case $kindPtr:
    typ = constructor || function(getter, setter, target) {
      this.$get = getter;
      this.$set = setter;
      this.$target = target;
      this.$val = this;
    };
    typ.prototype.$key = function() {
      if (this.$id === undefined) {
        $idCounter++;
        this.$id = $idCounter;
      }
      return String(this.$id);
    };
    typ.init = function(elem) {
      typ.elem = elem;
      typ.nil = new typ($throwNilPointerError, $throwNilPointerError);
    };
    break;

  case $kindSlice:
    var nativeArray;
    typ = function(array) {
      if (array.constructor !== nativeArray) {
        array = new nativeArray(array);
      }
      this.$array = array;
      this.$offset = 0;
      this.$length = array.length;
      this.$capacity = array.length;
      this.$val = this;
    };
    typ.make = function(length, capacity) {
      capacity = capacity || length;
      var array = new nativeArray(capacity);
      if (nativeArray === Array) {
        for (var i = 0; i < capacity; i++) {
          array[i] = typ.elem.zero();
        }
      }
      var slice = new typ(array);
      slice.$length = length;
      return slice;
    };
    typ.init = function(elem) {
      typ.elem = elem;
      typ.comparable = false;
      nativeArray = $nativeArray(elem.kind);
      typ.nil = new typ([]);
    };
    break;

  case $kindStruct:
    typ = function(v) { this.$val = v; };
    typ.ptr = $newType(4, $kindPtr, "*" + string, "", "", constructor);
    typ.ptr.elem = typ;
    typ.ptr.prototype.$get = function() { return this; };
    typ.ptr.prototype.$set = function(v) { $copy(this, v, typ); };
    typ.init = function(fields) {
      typ.fields = fields;
      fields.forEach(function(f) {
        if (!f.type.comparable) {
          typ.comparable = false;
        }
      });
      typ.prototype.$key = function() {
        var val = this.$val;
        return string + "$" + $mapArray(fields, function(f) {
          var e = val[f.prop];
          var key = e.$key ? e.$key() : String(e);
          return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
        }).join("$");
      };
      /* nil value */
      var properties = {};
      fields.forEach(function(f) {
        properties[f.prop] = { get: $throwNilPointerError, set: $throwNilPointerError };
      });
      typ.ptr.nil = Object.create(constructor.prototype, properties);
      typ.ptr.nil.$val = typ.ptr.nil;
      /* methods for embedded fields */
      var forwardMethod = function(target, m, f) {
        if (target.prototype[m.prop] !== undefined) { return; }
        target.prototype[m.prop] = function() {
          var v = this.$val[f.prop];
          if (v.$val === undefined) {
            v = new f.type(v);
          }
          return v[m.prop].apply(v, arguments);
        };
      };
      fields.forEach(function(f) {
        if (f.name === "") {
          f.type.methods.forEach(function(m) {
            forwardMethod(typ, m, f);
            forwardMethod(typ.ptr, m, f);
          });
          $ptrType(f.type).methods.forEach(function(m) {
            forwardMethod(typ.ptr, m, f);
          });
        }
      });
    };
    break;

  default:
    $panic(new $String("invalid kind: " + kind));
  }

  switch (kind) {
  case $kindBool:
  case $kindMap:
    typ.zero = function() { return false; };
    break;

  case $kindInt:
  case $kindInt8:
  case $kindInt16:
  case $kindInt32:
  case $kindUint:
  case $kindUint8 :
  case $kindUint16:
  case $kindUint32:
  case $kindUintptr:
  case $kindUnsafePointer:
  case $kindFloat32:
  case $kindFloat64:
    typ.zero = function() { return 0; };
    break;

  case $kindString:
    typ.zero = function() { return ""; };
    break;

  case $kindInt64:
  case $kindUint64:
  case $kindComplex64:
  case $kindComplex128:
    var zero = new typ(0, 0);
    typ.zero = function() { return zero; };
    break;

  case $kindChan:
  case $kindPtr:
  case $kindSlice:
    typ.zero = function() { return typ.nil; };
    break;

  case $kindFunc:
    typ.zero = function() { return $throwNilPointerError; };
    break;

  case $kindInterface:
    typ.zero = function() { return $ifaceNil; };
    break;

  case $kindArray:
    typ.zero = function() {
      var arrayClass = $nativeArray(typ.elem.kind);
      if (arrayClass !== Array) {
        return new arrayClass(typ.len);
      }
      var array = new Array(typ.len);
      for (var i = 0; i < typ.len; i++) {
        array[i] = typ.elem.zero();
      }
      return array;
    };
    break;

  case $kindStruct:
    typ.zero = function() { return new typ.ptr(); };
    break;

  default:
    $panic(new $String("invalid kind: " + kind));
  }

  typ.kind = kind;
  typ.string = string;
  typ.typeName = name;
  typ.pkgPath = pkgPath;
  typ.methods = [];
  typ.comparable = true;
  var rt = null;
  typ.reflectType = function() {
    if (rt === null) {
      rt = new $reflect.rtype.ptr(size, 0, 0, 0, 0, kind, undefined, undefined, $newStringPtr(string), undefined, undefined);
      rt.jsType = typ;

      var methods = [];
      if (typ.methods !== undefined) {
        typ.methods.forEach(function(m) {
          var t = m.type;
          methods.push(new $reflect.method.ptr($newStringPtr(m.name), $newStringPtr(m.pkg), t.reflectType(), $funcType([typ].concat(t.params), t.results, t.variadic).reflectType(), undefined, undefined));
        });
      }
      if (name !== "" || methods.length !== 0) {
        var methodSlice = ($sliceType($ptrType($reflect.method.ptr)));
        rt.uncommonType = new $reflect.uncommonType.ptr($newStringPtr(name), $newStringPtr(pkgPath), new methodSlice(methods));
        rt.uncommonType.jsType = typ;
      }

      switch (typ.kind) {
      case $kindArray:
        rt.arrayType = new $reflect.arrayType.ptr(rt, typ.elem.reflectType(), undefined, typ.len);
        break;
      case $kindChan:
        rt.chanType = new $reflect.chanType.ptr(rt, typ.elem.reflectType(), typ.sendOnly ? $reflect.SendDir : (typ.recvOnly ? $reflect.RecvDir : $reflect.BothDir));
        break;
      case $kindFunc:
        var typeSlice = ($sliceType($ptrType($reflect.rtype.ptr)));
        rt.funcType = new $reflect.funcType.ptr(rt, typ.variadic, new typeSlice($mapArray(typ.params, function(p) { return p.reflectType(); })), new typeSlice($mapArray(typ.results, function(p) { return p.reflectType(); })));
        break;
      case $kindInterface:
        var imethods = $mapArray(typ.methods, function(m) {
          return new $reflect.imethod.ptr($newStringPtr(m.name), $newStringPtr(m.pkg), m.type.reflectType());
        });
        var methodSlice = ($sliceType($ptrType($reflect.imethod.ptr)));
        rt.interfaceType = new $reflect.interfaceType.ptr(rt, new methodSlice(imethods));
        break;
      case $kindMap:
        rt.mapType = new $reflect.mapType.ptr(rt, typ.key.reflectType(), typ.elem.reflectType(), undefined, undefined);
        break;
      case $kindPtr:
        rt.ptrType = new $reflect.ptrType.ptr(rt, typ.elem.reflectType());
        break;
      case $kindSlice:
        rt.sliceType = new $reflect.sliceType.ptr(rt, typ.elem.reflectType());
        break;
      case $kindStruct:
        var reflectFields = new Array(typ.fields.length);
        for (var i = 0; i < typ.fields.length; i++) {
          var f = typ.fields[i];
          reflectFields[i] = new $reflect.structField.ptr($newStringPtr(f.name), $newStringPtr(f.pkg), f.type.reflectType(), $newStringPtr(f.tag), i);
        }
        rt.structType = new $reflect.structType.ptr(rt, new ($sliceType($reflect.structField.ptr))(reflectFields));
        break;
      }
    }
    return rt;
  };
  return typ;
};

var $Bool          = $newType( 1, $kindBool,          "bool",           "bool",       "", null);
var $Int           = $newType( 4, $kindInt,           "int",            "int",        "", null);
var $Int8          = $newType( 1, $kindInt8,          "int8",           "int8",       "", null);
var $Int16         = $newType( 2, $kindInt16,         "int16",          "int16",      "", null);
var $Int32         = $newType( 4, $kindInt32,         "int32",          "int32",      "", null);
var $Int64         = $newType( 8, $kindInt64,         "int64",          "int64",      "", null);
var $Uint          = $newType( 4, $kindUint,          "uint",           "uint",       "", null);
var $Uint8         = $newType( 1, $kindUint8,         "uint8",          "uint8",      "", null);
var $Uint16        = $newType( 2, $kindUint16,        "uint16",         "uint16",     "", null);
var $Uint32        = $newType( 4, $kindUint32,        "uint32",         "uint32",     "", null);
var $Uint64        = $newType( 8, $kindUint64,        "uint64",         "uint64",     "", null);
var $Uintptr       = $newType( 4, $kindUintptr,       "uintptr",        "uintptr",    "", null);
var $Float32       = $newType( 4, $kindFloat32,       "float32",        "float32",    "", null);
var $Float64       = $newType( 8, $kindFloat64,       "float64",        "float64",    "", null);
var $Complex64     = $newType( 8, $kindComplex64,     "complex64",      "complex64",  "", null);
var $Complex128    = $newType(16, $kindComplex128,    "complex128",     "complex128", "", null);
var $String        = $newType( 8, $kindString,        "string",         "string",     "", null);
var $UnsafePointer = $newType( 4, $kindUnsafePointer, "unsafe.Pointer", "Pointer",    "", null);

var $anonTypeInits = [];
var $addAnonTypeInit = function(f) {
  if ($anonTypeInits === null) {
    f();
    return;
  }
  $anonTypeInits.push(f);
};
var $initAnonTypes = function() {
  $anonTypeInits.forEach(function(f) { f(); });
  $anonTypeInits = null;
};

var $nativeArray = function(elemKind) {
  switch (elemKind) {
  case $kindInt:
    return Int32Array;
  case $kindInt8:
    return Int8Array;
  case $kindInt16:
    return Int16Array;
  case $kindInt32:
    return Int32Array;
  case $kindUint:
    return Uint32Array;
  case $kindUint8:
    return Uint8Array;
  case $kindUint16:
    return Uint16Array;
  case $kindUint32:
    return Uint32Array;
  case $kindUintptr:
    return Uint32Array;
  case $kindFloat32:
    return Float32Array;
  case $kindFloat64:
    return Float64Array;
  default:
    return Array;
  }
};
var $toNativeArray = function(elemKind, array) {
  var nativeArray = $nativeArray(elemKind);
  if (nativeArray === Array) {
    return array;
  }
  return new nativeArray(array);
};
var $arrayTypes = {};
var $arrayType = function(elem, len) {
  var string = "[" + len + "]" + elem.string;
  var typ = $arrayTypes[string];
  if (typ === undefined) {
    typ = $newType(12, $kindArray, string, "", "", null);
    $arrayTypes[string] = typ;
    $addAnonTypeInit(function() { typ.init(elem, len); });
  }
  return typ;
};

var $chanType = function(elem, sendOnly, recvOnly) {
  var string = (recvOnly ? "<-" : "") + "chan" + (sendOnly ? "<- " : " ") + elem.string;
  var field = sendOnly ? "SendChan" : (recvOnly ? "RecvChan" : "Chan");
  var typ = elem[field];
  if (typ === undefined) {
    typ = $newType(4, $kindChan, string, "", "", null);
    elem[field] = typ;
    $addAnonTypeInit(function() { typ.init(elem, sendOnly, recvOnly); });
  }
  return typ;
};

var $funcTypes = {};
var $funcType = function(params, results, variadic) {
  var paramTypes = $mapArray(params, function(p) { return p.string; });
  if (variadic) {
    paramTypes[paramTypes.length - 1] = "..." + paramTypes[paramTypes.length - 1].substr(2);
  }
  var string = "func(" + paramTypes.join(", ") + ")";
  if (results.length === 1) {
    string += " " + results[0].string;
  } else if (results.length > 1) {
    string += " (" + $mapArray(results, function(r) { return r.string; }).join(", ") + ")";
  }
  var typ = $funcTypes[string];
  if (typ === undefined) {
    typ = $newType(4, $kindFunc, string, "", "", null);
    $funcTypes[string] = typ;
    $addAnonTypeInit(function() { typ.init(params, results, variadic); });
  }
  return typ;
};

var $interfaceTypes = {};
var $interfaceType = function(methods) {
  var string = "interface {}";
  if (methods.length !== 0) {
    string = "interface { " + $mapArray(methods, function(m) {
      return (m.pkg !== "" ? m.pkg + "." : "") + m.name + m.type.string.substr(4);
    }).join("; ") + " }";
  }
  var typ = $interfaceTypes[string];
  if (typ === undefined) {
    typ = $newType(8, $kindInterface, string, "", "", null);
    $interfaceTypes[string] = typ;
    $addAnonTypeInit(function() { typ.init(methods); });
  }
  return typ;
};
var $emptyInterface = $interfaceType([]);
var $ifaceNil = { $key: function() { return "nil"; } };
var $error = $newType(8, $kindInterface, "error", "error", "", null);
$error.init([{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}]);

var $Map = function() {};
(function() {
  var names = Object.getOwnPropertyNames(Object.prototype);
  for (var i = 0; i < names.length; i++) {
    $Map.prototype[names[i]] = undefined;
  }
})();
var $mapTypes = {};
var $mapType = function(key, elem) {
  var string = "map[" + key.string + "]" + elem.string;
  var typ = $mapTypes[string];
  if (typ === undefined) {
    typ = $newType(4, $kindMap, string, "", "", null);
    $mapTypes[string] = typ;
    $addAnonTypeInit(function() { typ.init(key, elem); });
  }
  return typ;
};


var $throwNilPointerError = function() { $throwRuntimeError("invalid memory address or nil pointer dereference"); };
var $ptrType = function(elem) {
  var typ = elem.ptr;
  if (typ === undefined) {
    typ = $newType(4, $kindPtr, "*" + elem.string, "", "", null);
    elem.ptr = typ;
    $addAnonTypeInit(function() { typ.init(elem); });
  }
  return typ;
};

var $stringPtrMap = new $Map();
var $newStringPtr = function(str) {
  if (str === undefined || str === "") {
    return $ptrType($String).nil;
  }
  var ptr = $stringPtrMap[str];
  if (ptr === undefined) {
    ptr = new ($ptrType($String))(function() { return str; }, function(v) { str = v; });
    $stringPtrMap[str] = ptr;
  }
  return ptr;
};

var $newDataPointer = function(data, constructor) {
  if (constructor.elem.kind === $kindStruct) {
    return data;
  }
  return new constructor(function() { return data; }, function(v) { data = v; });
};

var $sliceType = function(elem) {
  var typ = elem.Slice;
  if (typ === undefined) {
    typ = $newType(12, $kindSlice, "[]" + elem.string, "", "", null);
    elem.Slice = typ;
    $addAnonTypeInit(function() { typ.init(elem); });
  }
  return typ;
};

var $structTypes = {};
var $structType = function(fields) {
  var string = "struct { " + $mapArray(fields, function(f) {
    return f.name + " " + f.type.string + (f.tag !== "" ? (" \"" + f.tag.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"") : "");
  }).join("; ") + " }";
  if (fields.length === 0) {
    string = "struct {}";
  }
  var typ = $structTypes[string];
  if (typ === undefined) {
    typ = $newType(0, $kindStruct, string, "", "", function() {
      this.$val = this;
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        var arg = arguments[i];
        this[f.prop] = arg !== undefined ? arg : f.type.zero();
      }
    });
    $structTypes[string] = typ;
    $anonTypeInits.push(function() {
      /* collect methods for anonymous fields */
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (f.name === "") {
          f.type.methods.forEach(function(m) {
            typ.methods.push(m);
            typ.ptr.methods.push(m);
          });
          $ptrType(f.type).methods.forEach(function(m) {
            typ.ptr.methods.push(m);
          });
        }
      };
      typ.init(fields);
    });
  }
  return typ;
};

var $assertType = function(value, type, returnTuple) {
  var isInterface = (type.kind === $kindInterface), ok, missingMethod = "";
  if (value === $ifaceNil) {
    ok = false;
  } else if (!isInterface) {
    ok = value.constructor === type;
  } else {
    var valueTypeString = value.constructor.string;
    ok = type.implementedBy[valueTypeString];
    if (ok === undefined) {
      ok = true;
      var valueMethods = value.constructor.methods;
      var typeMethods = type.methods;
      for (var i = 0; i < typeMethods.length; i++) {
        var tm = typeMethods[i];
        var found = false;
        for (var j = 0; j < valueMethods.length; j++) {
          var vm = valueMethods[j];
          if (vm.name === tm.name && vm.pkg === tm.pkg && vm.type === tm.type) {
            found = true;
            break;
          }
        }
        if (!found) {
          ok = false;
          type.missingMethodFor[valueTypeString] = tm.name;
          break;
        }
      }
      type.implementedBy[valueTypeString] = ok;
    }
    if (!ok) {
      missingMethod = type.missingMethodFor[valueTypeString];
    }
  }

  if (!ok) {
    if (returnTuple) {
      return [type.zero(), false];
    }
    $panic(new $packages["runtime"].TypeAssertionError.ptr("", (value === $ifaceNil ? "" : value.constructor.string), type.string, missingMethod));
  }

  if (!isInterface) {
    value = value.$val;
  }
  return returnTuple ? [value, true] : value;
};

var $coerceFloat32 = function(f) {
  var math = $packages["math"];
  if (math === undefined) {
    return f;
  }
  return math.Float32frombits(math.Float32bits(f));
};

var $floatKey = function(f) {
  if (f !== f) {
    $idCounter++;
    return "NaN$" + $idCounter;
  }
  return String(f);
};

var $flatten64 = function(x) {
  return x.$high * 4294967296 + x.$low;
};

var $shiftLeft64 = function(x, y) {
  if (y === 0) {
    return x;
  }
  if (y < 32) {
    return new x.constructor(x.$high << y | x.$low >>> (32 - y), (x.$low << y) >>> 0);
  }
  if (y < 64) {
    return new x.constructor(x.$low << (y - 32), 0);
  }
  return new x.constructor(0, 0);
};

var $shiftRightInt64 = function(x, y) {
  if (y === 0) {
    return x;
  }
  if (y < 32) {
    return new x.constructor(x.$high >> y, (x.$low >>> y | x.$high << (32 - y)) >>> 0);
  }
  if (y < 64) {
    return new x.constructor(x.$high >> 31, (x.$high >> (y - 32)) >>> 0);
  }
  if (x.$high < 0) {
    return new x.constructor(-1, 4294967295);
  }
  return new x.constructor(0, 0);
};

var $shiftRightUint64 = function(x, y) {
  if (y === 0) {
    return x;
  }
  if (y < 32) {
    return new x.constructor(x.$high >>> y, (x.$low >>> y | x.$high << (32 - y)) >>> 0);
  }
  if (y < 64) {
    return new x.constructor(0, x.$high >>> (y - 32));
  }
  return new x.constructor(0, 0);
};

var $mul64 = function(x, y) {
  var high = 0, low = 0;
  if ((y.$low & 1) !== 0) {
    high = x.$high;
    low = x.$low;
  }
  for (var i = 1; i < 32; i++) {
    if ((y.$low & 1<<i) !== 0) {
      high += x.$high << i | x.$low >>> (32 - i);
      low += (x.$low << i) >>> 0;
    }
  }
  for (var i = 0; i < 32; i++) {
    if ((y.$high & 1<<i) !== 0) {
      high += x.$low << i;
    }
  }
  return new x.constructor(high, low);
};

var $div64 = function(x, y, returnRemainder) {
  if (y.$high === 0 && y.$low === 0) {
    $throwRuntimeError("integer divide by zero");
  }

  var s = 1;
  var rs = 1;

  var xHigh = x.$high;
  var xLow = x.$low;
  if (xHigh < 0) {
    s = -1;
    rs = -1;
    xHigh = -xHigh;
    if (xLow !== 0) {
      xHigh--;
      xLow = 4294967296 - xLow;
    }
  }

  var yHigh = y.$high;
  var yLow = y.$low;
  if (y.$high < 0) {
    s *= -1;
    yHigh = -yHigh;
    if (yLow !== 0) {
      yHigh--;
      yLow = 4294967296 - yLow;
    }
  }

  var high = 0, low = 0, n = 0;
  while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
    yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
    yLow = (yLow << 1) >>> 0;
    n++;
  }
  for (var i = 0; i <= n; i++) {
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

var $divComplex = function(n, d) {
  var ninf = n.$real === 1/0 || n.$real === -1/0 || n.$imag === 1/0 || n.$imag === -1/0;
  var dinf = d.$real === 1/0 || d.$real === -1/0 || d.$imag === 1/0 || d.$imag === -1/0;
  var nnan = !ninf && (n.$real !== n.$real || n.$imag !== n.$imag);
  var dnan = !dinf && (d.$real !== d.$real || d.$imag !== d.$imag);
  if(nnan || dnan) {
    return new n.constructor(0/0, 0/0);
  }
  if (ninf && !dinf) {
    return new n.constructor(1/0, 1/0);
  }
  if (!ninf && dinf) {
    return new n.constructor(0, 0);
  }
  if (d.$real === 0 && d.$imag === 0) {
    if (n.$real === 0 && n.$imag === 0) {
      return new n.constructor(0/0, 0/0);
    }
    return new n.constructor(1/0, 1/0);
  }
  var a = Math.abs(d.$real);
  var b = Math.abs(d.$imag);
  if (a <= b) {
    var ratio = d.$real / d.$imag;
    var denom = d.$real * ratio + d.$imag;
    return new n.constructor((n.$real * ratio + n.$imag) / denom, (n.$imag * ratio - n.$real) / denom);
  }
  var ratio = d.$imag / d.$real;
  var denom = d.$imag * ratio + d.$real;
  return new n.constructor((n.$imag * ratio + n.$real) / denom, (n.$imag - n.$real * ratio) / denom);
};

var $stackDepthOffset = 0;
var $getStackDepth = function() {
  var err = new Error();
  if (err.stack === undefined) {
    return undefined;
  }
  return $stackDepthOffset + err.stack.split("\n").length;
};

var $deferFrames = [], $skippedDeferFrames = 0, $jumpToDefer = false, $panicStackDepth = null, $panicValue;
var $callDeferred = function(deferred, jsErr) {
  if ($skippedDeferFrames !== 0) {
    $skippedDeferFrames--;
    throw jsErr;
  }
  if ($jumpToDefer) {
    $jumpToDefer = false;
    throw jsErr;
  }
  if (jsErr) {
    var newErr = null;
    try {
      $deferFrames.push(deferred);
      $panic(new $js.Error.ptr(jsErr));
    } catch (err) {
      newErr = err;
    }
    $deferFrames.pop();
    $callDeferred(deferred, newErr);
    return;
  }

  $stackDepthOffset--;
  var outerPanicStackDepth = $panicStackDepth;
  var outerPanicValue = $panicValue;

  var localPanicValue = $curGoroutine.panicStack.pop();
  if (localPanicValue !== undefined) {
    $panicStackDepth = $getStackDepth();
    $panicValue = localPanicValue;
  }

  var call, localSkippedDeferFrames = 0;
  try {
    while (true) {
      if (deferred === null) {
        deferred = $deferFrames[$deferFrames.length - 1 - localSkippedDeferFrames];
        if (deferred === undefined) {
          var msg;
          if (localPanicValue.constructor === $String) {
            msg = localPanicValue.$val;
          } else if (localPanicValue.Error !== undefined) {
            msg = localPanicValue.Error();
          } else if (localPanicValue.String !== undefined) {
            msg = localPanicValue.String();
          } else {
            msg = localPanicValue;
          }
          var e = new Error(msg);
          if (localPanicValue.Stack !== undefined) {
            e.stack = localPanicValue.Stack();
            e.stack = msg + e.stack.substr(e.stack.indexOf("\n"));
          }
          throw e;
        }
      }
      var call = deferred.pop();
      if (call === undefined) {
        if (localPanicValue !== undefined) {
          localSkippedDeferFrames++;
          deferred = null;
          continue;
        }
        return;
      }
      var r = call[0].apply(undefined, call[1]);
      if (r && r.$blocking) {
        deferred.push([r, []]);
      }

      if (localPanicValue !== undefined && $panicStackDepth === null) {
        throw null; /* error was recovered */
      }
    }
  } finally {
    $skippedDeferFrames += localSkippedDeferFrames;
    if ($curGoroutine.asleep) {
      deferred.push(call);
      $jumpToDefer = true;
    }
    if (localPanicValue !== undefined) {
      if ($panicStackDepth !== null) {
        $curGoroutine.panicStack.push(localPanicValue);
      }
      $panicStackDepth = outerPanicStackDepth;
      $panicValue = outerPanicValue;
    }
    $stackDepthOffset++;
  }
};

var $panic = function(value) {
  $curGoroutine.panicStack.push(value);
  $callDeferred(null, null);
};
var $recover = function() {
  if ($panicStackDepth === null || ($panicStackDepth !== undefined && $panicStackDepth !== $getStackDepth() - 2)) {
    return $ifaceNil;
  }
  $panicStackDepth = null;
  return $panicValue;
};
var $throw = function(err) { throw err; };
var $throwRuntimeError; /* set by package "runtime" */

var $BLOCKING = new Object();
var $nonblockingCall = function() {
  $panic(new $packages["runtime"].NotSupportedError.ptr("non-blocking call to blocking function, see https://github.com/gopherjs/gopherjs#goroutines"));
};

var $dummyGoroutine = { asleep: false, exit: false, panicStack: [] };
var $curGoroutine = $dummyGoroutine, $totalGoroutines = 0, $awakeGoroutines = 0, $checkForDeadlock = true;
var $go = function(fun, args, direct) {
  $totalGoroutines++;
  $awakeGoroutines++;
  args.push($BLOCKING);
  var goroutine = function() {
    var rescheduled = false;
    try {
      $curGoroutine = goroutine;
      $skippedDeferFrames = 0;
      $jumpToDefer = false;
      var r = fun.apply(undefined, args);
      if (r && r.$blocking) {
        fun = r;
        args = [];
        $schedule(goroutine, direct);
        rescheduled = true;
        return;
      }
      goroutine.exit = true;
    } catch (err) {
      if (!$curGoroutine.asleep) {
        goroutine.exit = true;
        throw err;
      }
    } finally {
      $curGoroutine = $dummyGoroutine;
      if (goroutine.exit && !rescheduled) { /* also set by runtime.Goexit() */
        $totalGoroutines--;
        goroutine.asleep = true;
      }
      if (goroutine.asleep && !rescheduled) {
        $awakeGoroutines--;
        if ($awakeGoroutines === 0 && $totalGoroutines !== 0 && $checkForDeadlock) {
          console.error("fatal error: all goroutines are asleep - deadlock!");
        }
      }
    }
  };
  goroutine.asleep = false;
  goroutine.exit = false;
  goroutine.panicStack = [];
  $schedule(goroutine, direct);
};

var $scheduled = [], $schedulerLoopActive = false;
var $schedule = function(goroutine, direct) {
  if (goroutine.asleep) {
    goroutine.asleep = false;
    $awakeGoroutines++;
  }

  if (direct) {
    goroutine();
    return;
  }

  $scheduled.push(goroutine);
  if (!$schedulerLoopActive) {
    $schedulerLoopActive = true;
    setTimeout(function() {
      while (true) {
        var r = $scheduled.shift();
        if (r === undefined) {
          $schedulerLoopActive = false;
          break;
        }
        r();
      };
    }, 0);
  }
};

var $send = function(chan, value) {
  if (chan.$closed) {
    $throwRuntimeError("send on closed channel");
  }
  var queuedRecv = chan.$recvQueue.shift();
  if (queuedRecv !== undefined) {
    queuedRecv([value, true]);
    return;
  }
  if (chan.$buffer.length < chan.$capacity) {
    chan.$buffer.push(value);
    return;
  }

  var thisGoroutine = $curGoroutine;
  chan.$sendQueue.push(function() {
    $schedule(thisGoroutine);
    return value;
  });
  var blocked = false;
  var f = function() {
    if (blocked) {
      if (chan.$closed) {
        $throwRuntimeError("send on closed channel");
      }
      return;
    };
    blocked = true;
    $curGoroutine.asleep = true;
    throw null;
  };
  f.$blocking = true;
  return f;
};
var $recv = function(chan) {
  var queuedSend = chan.$sendQueue.shift();
  if (queuedSend !== undefined) {
    chan.$buffer.push(queuedSend());
  }
  var bufferedValue = chan.$buffer.shift();
  if (bufferedValue !== undefined) {
    return [bufferedValue, true];
  }
  if (chan.$closed) {
    return [chan.constructor.elem.zero(), false];
  }

  var thisGoroutine = $curGoroutine, value;
  var queueEntry = function(v) {
    value = v;
    $schedule(thisGoroutine);
  };
  chan.$recvQueue.push(queueEntry);
  var blocked = false;
  var f = function() {
    if (blocked) {
      return value;
    };
    blocked = true;
    $curGoroutine.asleep = true;
    throw null;
  };
  f.$blocking = true;
  return f;
};
var $close = function(chan) {
  if (chan.$closed) {
    $throwRuntimeError("close of closed channel");
  }
  chan.$closed = true;
  while (true) {
    var queuedSend = chan.$sendQueue.shift();
    if (queuedSend === undefined) {
      break;
    }
    queuedSend(); /* will panic because of closed channel */
  }
  while (true) {
    var queuedRecv = chan.$recvQueue.shift();
    if (queuedRecv === undefined) {
      break;
    }
    queuedRecv([chan.constructor.elem.zero(), false]);
  }
};
var $select = function(comms) {
  var ready = [];
  var selection = -1;
  for (var i = 0; i < comms.length; i++) {
    var comm = comms[i];
    var chan = comm[0];
    switch (comm.length) {
    case 0: /* default */
      selection = i;
      break;
    case 1: /* recv */
      if (chan.$sendQueue.length !== 0 || chan.$buffer.length !== 0 || chan.$closed) {
        ready.push(i);
      }
      break;
    case 2: /* send */
      if (chan.$closed) {
        $throwRuntimeError("send on closed channel");
      }
      if (chan.$recvQueue.length !== 0 || chan.$buffer.length < chan.$capacity) {
        ready.push(i);
      }
      break;
    }
  }

  if (ready.length !== 0) {
    selection = ready[Math.floor(Math.random() * ready.length)];
  }
  if (selection !== -1) {
    var comm = comms[selection];
    switch (comm.length) {
    case 0: /* default */
      return [selection];
    case 1: /* recv */
      return [selection, $recv(comm[0])];
    case 2: /* send */
      $send(comm[0], comm[1]);
      return [selection];
    }
  }

  var entries = [];
  var thisGoroutine = $curGoroutine;
  var removeFromQueues = function() {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var queue = entry[0];
      var index = queue.indexOf(entry[1]);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }
  };
  for (var i = 0; i < comms.length; i++) {
    (function(i) {
      var comm = comms[i];
      switch (comm.length) {
      case 1: /* recv */
        var queueEntry = function(value) {
          selection = [i, value];
          removeFromQueues();
          $schedule(thisGoroutine);
        };
        entries.push([comm[0].$recvQueue, queueEntry]);
        comm[0].$recvQueue.push(queueEntry);
        break;
      case 2: /* send */
        var queueEntry = function() {
          if (comm[0].$closed) {
            $throwRuntimeError("send on closed channel");
          }
          selection = [i];
          removeFromQueues();
          $schedule(thisGoroutine);
          return comm[1];
        };
        entries.push([comm[0].$sendQueue, queueEntry]);
        comm[0].$sendQueue.push(queueEntry);
        break;
      }
    })(i);
  }
  var blocked = false;
  var f = function() {
    if (blocked) {
      return selection;
    };
    blocked = true;
    $curGoroutine.asleep = true;
    throw null;
  };
  f.$blocking = true;
  return f;
};

var $js;

var $needsExternalization = function(t) {
  switch (t.kind) {
    case $kindBool:
    case $kindInt:
    case $kindInt8:
    case $kindInt16:
    case $kindInt32:
    case $kindUint:
    case $kindUint8:
    case $kindUint16:
    case $kindUint32:
    case $kindUintptr:
    case $kindFloat32:
    case $kindFloat64:
      return false;
    case $kindInterface:
      return t !== $js.Object;
    default:
      return true;
  }
};

var $externalize = function(v, t) {
  switch (t.kind) {
  case $kindBool:
  case $kindInt:
  case $kindInt8:
  case $kindInt16:
  case $kindInt32:
  case $kindUint:
  case $kindUint8:
  case $kindUint16:
  case $kindUint32:
  case $kindUintptr:
  case $kindFloat32:
  case $kindFloat64:
    return v;
  case $kindInt64:
  case $kindUint64:
    return $flatten64(v);
  case $kindArray:
    if ($needsExternalization(t.elem)) {
      return $mapArray(v, function(e) { return $externalize(e, t.elem); });
    }
    return v;
  case $kindFunc:
    if (v === $throwNilPointerError) {
      return null;
    }
    if (v.$externalizeWrapper === undefined) {
      $checkForDeadlock = false;
      var convert = false;
      for (var i = 0; i < t.params.length; i++) {
        convert = convert || (t.params[i] !== $js.Object);
      }
      for (var i = 0; i < t.results.length; i++) {
        convert = convert || $needsExternalization(t.results[i]);
      }
      v.$externalizeWrapper = v;
      if (convert) {
        v.$externalizeWrapper = function() {
          var args = [];
          for (var i = 0; i < t.params.length; i++) {
            if (t.variadic && i === t.params.length - 1) {
              var vt = t.params[i].elem, varargs = [];
              for (var j = i; j < arguments.length; j++) {
                varargs.push($internalize(arguments[j], vt));
              }
              args.push(new (t.params[i])(varargs));
              break;
            }
            args.push($internalize(arguments[i], t.params[i]));
          }
          var result = v.apply(this, args);
          switch (t.results.length) {
          case 0:
            return;
          case 1:
            return $externalize(result, t.results[0]);
          default:
            for (var i = 0; i < t.results.length; i++) {
              result[i] = $externalize(result[i], t.results[i]);
            }
            return result;
          }
        };
      }
    }
    return v.$externalizeWrapper;
  case $kindInterface:
    if (v === $ifaceNil) {
      return null;
    }
    if (t === $js.Object || (t === $js.Any && v.constructor.kind === undefined)) {
      return v;
    }
    return $externalize(v.$val, v.constructor);
  case $kindMap:
    var m = {};
    var keys = $keys(v);
    for (var i = 0; i < keys.length; i++) {
      var entry = v[keys[i]];
      m[$externalize(entry.k, t.key)] = $externalize(entry.v, t.elem);
    }
    return m;
  case $kindPtr:
    return $externalize(v.$get(), t.elem);
  case $kindSlice:
    if ($needsExternalization(t.elem)) {
      return $mapArray($sliceToArray(v), function(e) { return $externalize(e, t.elem); });
    }
    return $sliceToArray(v);
  case $kindString:
    if (v.search(/^[\x00-\x7F]*$/) !== -1) {
      return v;
    }
    var s = "", r;
    for (var i = 0; i < v.length; i += r[1]) {
      r = $decodeRune(v, i);
      s += String.fromCharCode(r[0]);
    }
    return s;
  case $kindStruct:
    var timePkg = $packages["time"];
    if (timePkg && v.constructor === timePkg.Time.ptr) {
      var milli = $div64(v.UnixNano(), new $Int64(0, 1000000));
      return new Date($flatten64(milli));
    }

    var searchJsObject = function(v, t) {
      if (t === $js.Object) {
        return v;
      }
      if (t.kind === $kindPtr) {
        var o = searchJsObject(v.$get(), t.elem);
        if (o !== undefined) {
          return o;
        }
      }
      if (t.kind === $kindStruct) {
        for (var i = 0; i < t.fields.length; i++) {
          var f = t.fields[i];
          var o = searchJsObject(v[f.prop], f.type);
          if (o !== undefined) {
            return o;
          }
        }
      }
      return undefined;
    };
    var o = searchJsObject(v, t);
    if (o !== undefined) {
      return o;
    }

    o = {};
    for (var i = 0; i < t.fields.length; i++) {
      var f = t.fields[i];
      if (f.pkg !== "") { /* not exported */
        continue;
      }
      o[f.name] = $externalize(v[f.prop], f.type);
    }
    return o;
  }
  $panic(new $String("cannot externalize " + t.string));
};

var $internalize = function(v, t, recv) {
  switch (t.kind) {
  case $kindBool:
    return !!v;
  case $kindInt:
    return parseInt(v);
  case $kindInt8:
    return parseInt(v) << 24 >> 24;
  case $kindInt16:
    return parseInt(v) << 16 >> 16;
  case $kindInt32:
    return parseInt(v) >> 0;
  case $kindUint:
    return parseInt(v);
  case $kindUint8:
    return parseInt(v) << 24 >>> 24;
  case $kindUint16:
    return parseInt(v) << 16 >>> 16;
  case $kindUint32:
  case $kindUintptr:
    return parseInt(v) >>> 0;
  case $kindInt64:
  case $kindUint64:
    return new t(0, v);
  case $kindFloat32:
  case $kindFloat64:
    return parseFloat(v);
  case $kindArray:
    if (v.length !== t.len) {
      $throwRuntimeError("got array with wrong size from JavaScript native");
    }
    return $mapArray(v, function(e) { return $internalize(e, t.elem); });
  case $kindFunc:
    return function() {
      var args = [];
      for (var i = 0; i < t.params.length; i++) {
        if (t.variadic && i === t.params.length - 1) {
          var vt = t.params[i].elem, varargs = arguments[i];
          for (var j = 0; j < varargs.$length; j++) {
            args.push($externalize(varargs.$array[varargs.$offset + j], vt));
          }
          break;
        }
        args.push($externalize(arguments[i], t.params[i]));
      }
      var result = v.apply(recv, args);
      switch (t.results.length) {
      case 0:
        return;
      case 1:
        return $internalize(result, t.results[0]);
      default:
        for (var i = 0; i < t.results.length; i++) {
          result[i] = $internalize(result[i], t.results[i]);
        }
        return result;
      }
    };
  case $kindInterface:
    if (t === $js.Object || t === $js.Any) {
      return v;
    }
    if (t.methods.length !== 0) {
      $panic(new $String("cannot internalize " + t.string));
    }
    if (v === null) {
      return $ifaceNil;
    }
    switch (v.constructor) {
    case Int8Array:
      return new ($sliceType($Int8))(v);
    case Int16Array:
      return new ($sliceType($Int16))(v);
    case Int32Array:
      return new ($sliceType($Int))(v);
    case Uint8Array:
      return new ($sliceType($Uint8))(v);
    case Uint16Array:
      return new ($sliceType($Uint16))(v);
    case Uint32Array:
      return new ($sliceType($Uint))(v);
    case Float32Array:
      return new ($sliceType($Float32))(v);
    case Float64Array:
      return new ($sliceType($Float64))(v);
    case Array:
      return $internalize(v, $sliceType($emptyInterface));
    case Boolean:
      return new $Bool(!!v);
    case Date:
      var timePkg = $packages["time"];
      if (timePkg) {
        return new timePkg.Time(timePkg.Unix(new $Int64(0, 0), new $Int64(0, v.getTime() * 1000000)));
      }
    case Function:
      var funcType = $funcType([$sliceType($js.Any)], [$js.Object], true);
      return new funcType($internalize(v, funcType));
    case Number:
      return new $Float64(parseFloat(v));
    case String:
      return new $String($internalize(v, $String));
    default:
      if ($global.Node && v instanceof $global.Node) {
        return new $js.DOMNode.ptr(v);
      }
      var mapType = $mapType($String, $emptyInterface);
      return new mapType($internalize(v, mapType));
    }
  case $kindMap:
    var m = new $Map();
    var keys = $keys(v);
    for (var i = 0; i < keys.length; i++) {
      var key = $internalize(keys[i], t.key);
      m[key.$key ? key.$key() : key] = { k: key, v: $internalize(v[keys[i]], t.elem) };
    }
    return m;
  case $kindPtr:
    if (t.elem.kind === $kindStruct) {
      return $internalize(v, t.elem);
    }
  case $kindSlice:
    return new t($mapArray(v, function(e) { return $internalize(e, t.elem); }));
  case $kindString:
    v = String(v);
    if (v.search(/^[\x00-\x7F]*$/) !== -1) {
      return v;
    }
    var s = "";
    for (var i = 0; i < v.length; i++) {
      s += $encodeRune(v.charCodeAt(i));
    }
    return s;
  case $kindStruct:
    var searchJsObject = function(v, t) {
      if (t === $js.Object) {
        return v;
      }
      if (t.kind === $kindPtr && t.elem.kind === $kindStruct) {
        var o = searchJsObject(v, t.elem);
        if (o !== undefined) {
          return o;
        }
      }
      if (t.kind === $kindStruct) {
        for (var i = 0; i < t.fields.length; i++) {
          var f = t.fields[i];
          var o = searchJsObject(v, f.type);
          if (o !== undefined) {
            var n = new t.ptr();
            n[f.prop] = o;
            return n;
          }
        }
      }
      return undefined;
    };
    var o = searchJsObject(v, t);
    if (o !== undefined) {
      return o;
    }
  }
  $panic(new $String("cannot internalize " + t.string));
};

$packages["github.com/gopherjs/gopherjs/js"] = (function() {
	var $pkg = {}, Object, Any, DOMNode, Error, sliceType$2, ptrType, ptrType$1, init;
	Object = $pkg.Object = $newType(8, $kindInterface, "js.Object", "Object", "github.com/gopherjs/gopherjs/js", null);
	Any = $pkg.Any = $newType(8, $kindInterface, "js.Any", "Any", "github.com/gopherjs/gopherjs/js", null);
	DOMNode = $pkg.DOMNode = $newType(0, $kindStruct, "js.DOMNode", "DOMNode", "github.com/gopherjs/gopherjs/js", function(Object_) {
		this.$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Error = $pkg.Error = $newType(0, $kindStruct, "js.Error", "Error", "github.com/gopherjs/gopherjs/js", function(Object_) {
		this.$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
		sliceType$2 = $sliceType(Any);
		ptrType = $ptrType(DOMNode);
		ptrType$1 = $ptrType(Error);
	Error.ptr.prototype.Error = function() {
		var err;
		err = this;
		return "JavaScript error: " + $internalize(err.Object.message, $String);
	};
	Error.prototype.Error = function() { return this.$val.Error(); };
	Error.ptr.prototype.Stack = function() {
		var err;
		err = this;
		return $internalize(err.Object.stack, $String);
	};
	Error.prototype.Stack = function() { return this.$val.Stack(); };
	init = function() {
		var _tmp, _tmp$1, e, n;
		e = new Error.ptr(null);
		n = new DOMNode.ptr(null);
		
	};
	DOMNode.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType$2], [Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, Any], [], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	ptrType.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType$2], [Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, Any], [], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	Error.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType$2], [Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, Any], [], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	ptrType$1.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType$2], [Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, Any], [], false)}, {prop: "Stack", name: "Stack", pkg: "", type: $funcType([], [$String], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	Object.init([{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType$2], [Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType$2], [Object], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, Any], [], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}]);
	Any.init([]);
	DOMNode.init([{prop: "Object", name: "", pkg: "", type: Object, tag: ""}]);
	Error.init([{prop: "Object", name: "", pkg: "", type: Object, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_js = function() { while (true) { switch ($s) { case 0:
		init();
		/* */ } return; } }; $init_js.$blocking = true; return $init_js;
	};
	return $pkg;
})();
$packages["runtime"] = (function() {
	var $pkg = {}, js, NotSupportedError, TypeAssertionError, errorString, ptrType$5, ptrType$6, ptrType$7, init;
	js = $packages["github.com/gopherjs/gopherjs/js"];
	NotSupportedError = $pkg.NotSupportedError = $newType(0, $kindStruct, "runtime.NotSupportedError", "NotSupportedError", "runtime", function(Feature_) {
		this.$val = this;
		this.Feature = Feature_ !== undefined ? Feature_ : "";
	});
	TypeAssertionError = $pkg.TypeAssertionError = $newType(0, $kindStruct, "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	errorString = $pkg.errorString = $newType(8, $kindString, "runtime.errorString", "errorString", "runtime", null);
		ptrType$5 = $ptrType(NotSupportedError);
		ptrType$6 = $ptrType(TypeAssertionError);
		ptrType$7 = $ptrType(errorString);
	NotSupportedError.ptr.prototype.Error = function() {
		var err;
		err = this;
		return "not supported by GopherJS: " + err.Feature;
	};
	NotSupportedError.prototype.Error = function() { return this.$val.Error(); };
	init = function() {
		var e;
		$js = $packages[$externalize("github.com/gopherjs/gopherjs/js", $String)];
		$throwRuntimeError = (function(msg) {
			$panic(new errorString(msg));
		});
		e = $ifaceNil;
		e = new TypeAssertionError.ptr("", "", "", "");
		e = new NotSupportedError.ptr("");
	};
	TypeAssertionError.ptr.prototype.RuntimeError = function() {
	};
	TypeAssertionError.prototype.RuntimeError = function() { return this.$val.RuntimeError(); };
	TypeAssertionError.ptr.prototype.Error = function() {
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
	TypeAssertionError.prototype.Error = function() { return this.$val.Error(); };
	errorString.prototype.RuntimeError = function() {
		var e;
		e = this.$val;
	};
	$ptrType(errorString).prototype.RuntimeError = function() { return new errorString(this.$get()).RuntimeError(); };
	errorString.prototype.Error = function() {
		var e;
		e = this.$val;
		return "runtime error: " + e;
	};
	$ptrType(errorString).prototype.Error = function() { return new errorString(this.$get()).Error(); };
	ptrType$5.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}];
	ptrType$6.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}, {prop: "RuntimeError", name: "RuntimeError", pkg: "", type: $funcType([], [], false)}];
	errorString.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}, {prop: "RuntimeError", name: "RuntimeError", pkg: "", type: $funcType([], [], false)}];
	ptrType$7.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}, {prop: "RuntimeError", name: "RuntimeError", pkg: "", type: $funcType([], [], false)}];
	NotSupportedError.init([{prop: "Feature", name: "Feature", pkg: "", type: $String, tag: ""}]);
	TypeAssertionError.init([{prop: "interfaceString", name: "interfaceString", pkg: "runtime", type: $String, tag: ""}, {prop: "concreteString", name: "concreteString", pkg: "runtime", type: $String, tag: ""}, {prop: "assertedString", name: "assertedString", pkg: "runtime", type: $String, tag: ""}, {prop: "missingMethod", name: "missingMethod", pkg: "runtime", type: $String, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_runtime = function() { while (true) { switch ($s) { case 0:
		$r = js.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		init();
		/* */ } return; } }; $init_runtime.$blocking = true; return $init_runtime;
	};
	return $pkg;
})();
$packages["github.com/gopherjs/jquery"] = (function() {
	var $pkg = {}, js, JQuery, Event, JQueryCoordinates, Deferred, sliceType, sliceType$1, funcType, funcType$1, mapType, sliceType$2, funcType$2, funcType$3, funcType$4, sliceType$3, ptrType, ptrType$1, ptrType$2, NewJQuery, Trim, GlobalEval, Type, IsPlainObject, IsEmptyObject, IsFunction, IsNumeric, IsXMLDoc, InArray, ParseHTML, ParseXML, ParseJSON, Grep, Noop, Now, Unique, Ajax, AjaxPrefilter, AjaxSetup, AjaxTransport, Get, Post, GetJSON, GetScript, When, NewDeferred;
	js = $packages["github.com/gopherjs/gopherjs/js"];
	JQuery = $pkg.JQuery = $newType(0, $kindStruct, "jquery.JQuery", "JQuery", "github.com/gopherjs/jquery", function(o_, Jquery_, Selector_, Length_, Context_) {
		this.$val = this;
		this.o = o_ !== undefined ? o_ : null;
		this.Jquery = Jquery_ !== undefined ? Jquery_ : "";
		this.Selector = Selector_ !== undefined ? Selector_ : "";
		this.Length = Length_ !== undefined ? Length_ : 0;
		this.Context = Context_ !== undefined ? Context_ : "";
	});
	Event = $pkg.Event = $newType(0, $kindStruct, "jquery.Event", "Event", "github.com/gopherjs/jquery", function(Object_, KeyCode_, Target_, CurrentTarget_, DelegateTarget_, RelatedTarget_, Data_, Result_, Which_, Namespace_, MetaKey_, PageX_, PageY_, Type_) {
		this.$val = this;
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
	JQueryCoordinates = $pkg.JQueryCoordinates = $newType(0, $kindStruct, "jquery.JQueryCoordinates", "JQueryCoordinates", "github.com/gopherjs/jquery", function(Left_, Top_) {
		this.$val = this;
		this.Left = Left_ !== undefined ? Left_ : 0;
		this.Top = Top_ !== undefined ? Top_ : 0;
	});
	Deferred = $pkg.Deferred = $newType(0, $kindStruct, "jquery.Deferred", "Deferred", "github.com/gopherjs/jquery", function(Object_) {
		this.$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
		sliceType = $sliceType(js.Any);
		sliceType$1 = $sliceType($emptyInterface);
		funcType = $funcType([$emptyInterface, $Int], [$Bool], false);
		funcType$1 = $funcType([$Int, js.Object], [], false);
		mapType = $mapType($String, $emptyInterface);
		sliceType$2 = $sliceType($String);
		funcType$2 = $funcType([$Int, $String], [$String], false);
		funcType$3 = $funcType([], [], false);
		funcType$4 = $funcType([$Int, js.Any], [], false);
		sliceType$3 = $sliceType($Bool);
		ptrType = $ptrType(JQuery);
		ptrType$1 = $ptrType(Event);
		ptrType$2 = $ptrType(Deferred);
	Event.ptr.prototype.PreventDefault = function() {
		var event;
		event = this;
		event.Object.preventDefault();
	};
	Event.prototype.PreventDefault = function() { return this.$val.PreventDefault(); };
	Event.ptr.prototype.IsDefaultPrevented = function() {
		var event;
		event = this;
		return !!(event.Object.isDefaultPrevented());
	};
	Event.prototype.IsDefaultPrevented = function() { return this.$val.IsDefaultPrevented(); };
	Event.ptr.prototype.IsImmediatePropogationStopped = function() {
		var event;
		event = this;
		return !!(event.Object.isImmediatePropogationStopped());
	};
	Event.prototype.IsImmediatePropogationStopped = function() { return this.$val.IsImmediatePropogationStopped(); };
	Event.ptr.prototype.IsPropagationStopped = function() {
		var event;
		event = this;
		return !!(event.Object.isPropagationStopped());
	};
	Event.prototype.IsPropagationStopped = function() { return this.$val.IsPropagationStopped(); };
	Event.ptr.prototype.StopImmediatePropagation = function() {
		var event;
		event = this;
		event.Object.stopImmediatePropagation();
	};
	Event.prototype.StopImmediatePropagation = function() { return this.$val.StopImmediatePropagation(); };
	Event.ptr.prototype.StopPropagation = function() {
		var event;
		event = this;
		event.Object.stopPropagation();
	};
	Event.prototype.StopPropagation = function() { return this.$val.StopPropagation(); };
	NewJQuery = $pkg.NewJQuery = function(args) {
		return new JQuery.ptr(new ($global.Function.prototype.bind.apply($global.jQuery, [undefined].concat($externalize(args, sliceType)))), "", "", 0, "");
	};
	Trim = $pkg.Trim = function(text) {
		return $internalize($global.jQuery.trim($externalize(text, $String)), $String);
	};
	GlobalEval = $pkg.GlobalEval = function(cmd) {
		$global.jQuery.globalEval($externalize(cmd, $String));
	};
	Type = $pkg.Type = function(sth) {
		return $internalize($global.jQuery.type($externalize(sth, $emptyInterface)), $String);
	};
	IsPlainObject = $pkg.IsPlainObject = function(sth) {
		return !!($global.jQuery.isPlainObject($externalize(sth, $emptyInterface)));
	};
	IsEmptyObject = $pkg.IsEmptyObject = function(sth) {
		return !!($global.jQuery.isEmptyObject($externalize(sth, $emptyInterface)));
	};
	IsFunction = $pkg.IsFunction = function(sth) {
		return !!($global.jQuery.isFunction($externalize(sth, $emptyInterface)));
	};
	IsNumeric = $pkg.IsNumeric = function(sth) {
		return !!($global.jQuery.isNumeric($externalize(sth, $emptyInterface)));
	};
	IsXMLDoc = $pkg.IsXMLDoc = function(sth) {
		return !!($global.jQuery.isXMLDoc($externalize(sth, $emptyInterface)));
	};
	InArray = $pkg.InArray = function(val, arr) {
		return $parseInt($global.jQuery.inArray($externalize(val, $emptyInterface), $externalize(arr, sliceType$1))) >> 0;
	};
	ParseHTML = $pkg.ParseHTML = function(text) {
		return $assertType($internalize($global.jQuery.parseHTML($externalize(text, $String)), $emptyInterface), sliceType$1);
	};
	ParseXML = $pkg.ParseXML = function(text) {
		return $internalize($global.jQuery.parseXML($externalize(text, $String)), $emptyInterface);
	};
	ParseJSON = $pkg.ParseJSON = function(text) {
		return $internalize($global.jQuery.parseJSON($externalize(text, $String)), $emptyInterface);
	};
	Grep = $pkg.Grep = function(arr, fn) {
		return $assertType($internalize($global.jQuery.grep($externalize(arr, sliceType$1), $externalize(fn, funcType)), $emptyInterface), sliceType$1);
	};
	Noop = $pkg.Noop = function() {
		return $internalize($global.jQuery.noop, $emptyInterface);
	};
	Now = $pkg.Now = function() {
		return $parseFloat($global.jQuery.now());
	};
	Unique = $pkg.Unique = function(arr) {
		return $global.jQuery.unique(arr);
	};
	JQuery.ptr.prototype.Each = function(fn) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.each($externalize((function(idx, elem) {
			var x;
			fn(idx, (x = NewJQuery(new sliceType([elem])), new x.constructor.elem(x)));
		}), funcType$1));
		return j;
	};
	JQuery.prototype.Each = function(fn) { return this.$val.Each(fn); };
	JQuery.ptr.prototype.Underlying = function() {
		var j;
		j = $clone(this, JQuery);
		return j.o;
	};
	JQuery.prototype.Underlying = function() { return this.$val.Underlying(); };
	JQuery.ptr.prototype.Get = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		return (obj = j.o, obj.get.apply(obj, $externalize(i, sliceType)));
	};
	JQuery.prototype.Get = function(i) { return this.$val.Get(i); };
	JQuery.ptr.prototype.Append = function(args) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.append.apply(obj, $externalize(args, sliceType)));
		return j;
	};
	JQuery.prototype.Append = function(args) { return this.$val.Append(args); };
	JQuery.ptr.prototype.Empty = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.empty();
		return j;
	};
	JQuery.prototype.Empty = function() { return this.$val.Empty(); };
	JQuery.ptr.prototype.Detach = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.detach.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Detach = function(i) { return this.$val.Detach(i); };
	JQuery.ptr.prototype.Eq = function(idx) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.eq(idx);
		return j;
	};
	JQuery.prototype.Eq = function(idx) { return this.$val.Eq(idx); };
	JQuery.ptr.prototype.FadeIn = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.fadeIn.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.FadeIn = function(i) { return this.$val.FadeIn(i); };
	JQuery.ptr.prototype.Delay = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.delay.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Delay = function(i) { return this.$val.Delay(i); };
	JQuery.ptr.prototype.ToArray = function() {
		var j;
		j = $clone(this, JQuery);
		return $assertType($internalize(j.o.toArray(), $emptyInterface), sliceType$1);
	};
	JQuery.prototype.ToArray = function() { return this.$val.ToArray(); };
	JQuery.ptr.prototype.Remove = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.remove.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Remove = function(i) { return this.$val.Remove(i); };
	JQuery.ptr.prototype.Stop = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.stop.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Stop = function(i) { return this.$val.Stop(i); };
	JQuery.ptr.prototype.AddBack = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.addBack.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.AddBack = function(i) { return this.$val.AddBack(i); };
	JQuery.ptr.prototype.Css = function(name) {
		var j;
		j = $clone(this, JQuery);
		return $internalize(j.o.css($externalize(name, $String)), $String);
	};
	JQuery.prototype.Css = function(name) { return this.$val.Css(name); };
	JQuery.ptr.prototype.CssArray = function(arr) {
		var j;
		j = $clone(this, JQuery);
		return $assertType($internalize(j.o.css($externalize(arr, sliceType$2)), $emptyInterface), mapType);
	};
	JQuery.prototype.CssArray = function(arr) { return this.$val.CssArray(arr); };
	JQuery.ptr.prototype.SetCss = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.css.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.SetCss = function(i) { return this.$val.SetCss(i); };
	JQuery.ptr.prototype.Text = function() {
		var j;
		j = $clone(this, JQuery);
		return $internalize(j.o.text(), $String);
	};
	JQuery.prototype.Text = function() { return this.$val.Text(); };
	JQuery.ptr.prototype.SetText = function(i) {
		var _ref, j;
		j = $clone(this, JQuery);
		_ref = i;
		if ($assertType(_ref, funcType$2, true)[1] || $assertType(_ref, $String, true)[1]) {
		} else {
			console.log("SetText Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.text($externalize(i, $emptyInterface));
		return j;
	};
	JQuery.prototype.SetText = function(i) { return this.$val.SetText(i); };
	JQuery.ptr.prototype.Val = function() {
		var j;
		j = $clone(this, JQuery);
		return $internalize(j.o.val(), $String);
	};
	JQuery.prototype.Val = function() { return this.$val.Val(); };
	JQuery.ptr.prototype.SetVal = function(i) {
		var j;
		j = $clone(this, JQuery);
		j.o.val($externalize(i, $emptyInterface));
		return j;
	};
	JQuery.prototype.SetVal = function(i) { return this.$val.SetVal(i); };
	JQuery.ptr.prototype.Prop = function(property) {
		var j;
		j = $clone(this, JQuery);
		return $internalize(j.o.prop($externalize(property, $String)), $emptyInterface);
	};
	JQuery.prototype.Prop = function(property) { return this.$val.Prop(property); };
	JQuery.ptr.prototype.SetProp = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.prop.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.SetProp = function(i) { return this.$val.SetProp(i); };
	JQuery.ptr.prototype.RemoveProp = function(property) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.removeProp($externalize(property, $String));
		return j;
	};
	JQuery.prototype.RemoveProp = function(property) { return this.$val.RemoveProp(property); };
	JQuery.ptr.prototype.Attr = function(property) {
		var attr, j;
		j = $clone(this, JQuery);
		attr = j.o.attr($externalize(property, $String));
		if (attr === undefined) {
			return "";
		}
		return $internalize(attr, $String);
	};
	JQuery.prototype.Attr = function(property) { return this.$val.Attr(property); };
	JQuery.ptr.prototype.SetAttr = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.attr.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.SetAttr = function(i) { return this.$val.SetAttr(i); };
	JQuery.ptr.prototype.RemoveAttr = function(property) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.removeAttr($externalize(property, $String));
		return j;
	};
	JQuery.prototype.RemoveAttr = function(property) { return this.$val.RemoveAttr(property); };
	JQuery.ptr.prototype.HasClass = function(class$1) {
		var j;
		j = $clone(this, JQuery);
		return !!(j.o.hasClass($externalize(class$1, $String)));
	};
	JQuery.prototype.HasClass = function(class$1) { return this.$val.HasClass(class$1); };
	JQuery.ptr.prototype.AddClass = function(i) {
		var _ref, j;
		j = $clone(this, JQuery);
		_ref = i;
		if ($assertType(_ref, funcType$2, true)[1] || $assertType(_ref, $String, true)[1]) {
		} else {
			console.log("addClass Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.addClass($externalize(i, $emptyInterface));
		return j;
	};
	JQuery.prototype.AddClass = function(i) { return this.$val.AddClass(i); };
	JQuery.ptr.prototype.RemoveClass = function(property) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.removeClass($externalize(property, $String));
		return j;
	};
	JQuery.prototype.RemoveClass = function(property) { return this.$val.RemoveClass(property); };
	JQuery.ptr.prototype.ToggleClass = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.toggleClass.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.ToggleClass = function(i) { return this.$val.ToggleClass(i); };
	JQuery.ptr.prototype.Focus = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.focus();
		return j;
	};
	JQuery.prototype.Focus = function() { return this.$val.Focus(); };
	JQuery.ptr.prototype.Blur = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.blur();
		return j;
	};
	JQuery.prototype.Blur = function() { return this.$val.Blur(); };
	JQuery.ptr.prototype.ReplaceAll = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.replaceAll($externalize(arg, $emptyInterface));
		return j;
	};
	JQuery.prototype.ReplaceAll = function(arg) { return this.$val.ReplaceAll(arg); };
	JQuery.ptr.prototype.ReplaceWith = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.replaceWith($externalize(arg, $emptyInterface));
		return j;
	};
	JQuery.prototype.ReplaceWith = function(arg) { return this.$val.ReplaceWith(arg); };
	JQuery.ptr.prototype.After = function(args) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.after.apply(obj, $externalize(args, sliceType)));
		return j;
	};
	JQuery.prototype.After = function(args) { return this.$val.After(args); };
	JQuery.ptr.prototype.Before = function(args) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.before.apply(obj, $externalize(args, sliceType)));
		return j;
	};
	JQuery.prototype.Before = function(args) { return this.$val.Before(args); };
	JQuery.ptr.prototype.Prepend = function(args) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.prepend.apply(obj, $externalize(args, sliceType)));
		return j;
	};
	JQuery.prototype.Prepend = function(args) { return this.$val.Prepend(args); };
	JQuery.ptr.prototype.PrependTo = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.prependTo(arg);
		return j;
	};
	JQuery.prototype.PrependTo = function(arg) { return this.$val.PrependTo(arg); };
	JQuery.ptr.prototype.AppendTo = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.appendTo(arg);
		return j;
	};
	JQuery.prototype.AppendTo = function(arg) { return this.$val.AppendTo(arg); };
	JQuery.ptr.prototype.InsertAfter = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.insertAfter(arg);
		return j;
	};
	JQuery.prototype.InsertAfter = function(arg) { return this.$val.InsertAfter(arg); };
	JQuery.ptr.prototype.InsertBefore = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.insertBefore(arg);
		return j;
	};
	JQuery.prototype.InsertBefore = function(arg) { return this.$val.InsertBefore(arg); };
	JQuery.ptr.prototype.Show = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.show();
		return j;
	};
	JQuery.prototype.Show = function() { return this.$val.Show(); };
	JQuery.ptr.prototype.Hide = function() {
		var j;
		j = $clone(this, JQuery);
		j.o.hide();
		return j;
	};
	JQuery.prototype.Hide = function() { return this.$val.Hide(); };
	JQuery.ptr.prototype.Toggle = function(showOrHide) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.toggle($externalize(showOrHide, $Bool));
		return j;
	};
	JQuery.prototype.Toggle = function(showOrHide) { return this.$val.Toggle(showOrHide); };
	JQuery.ptr.prototype.Contents = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.contents();
		return j;
	};
	JQuery.prototype.Contents = function() { return this.$val.Contents(); };
	JQuery.ptr.prototype.Html = function() {
		var j;
		j = $clone(this, JQuery);
		return $internalize(j.o.html(), $String);
	};
	JQuery.prototype.Html = function() { return this.$val.Html(); };
	JQuery.ptr.prototype.SetHtml = function(i) {
		var _ref, j;
		j = $clone(this, JQuery);
		_ref = i;
		if ($assertType(_ref, funcType$2, true)[1] || $assertType(_ref, $String, true)[1]) {
		} else {
			console.log("SetHtml Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.html($externalize(i, $emptyInterface));
		return j;
	};
	JQuery.prototype.SetHtml = function(i) { return this.$val.SetHtml(i); };
	JQuery.ptr.prototype.Closest = function(args) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.closest.apply(obj, $externalize(args, sliceType)));
		return j;
	};
	JQuery.prototype.Closest = function(args) { return this.$val.Closest(args); };
	JQuery.ptr.prototype.End = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.end();
		return j;
	};
	JQuery.prototype.End = function() { return this.$val.End(); };
	JQuery.ptr.prototype.Add = function(args) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.add.apply(obj, $externalize(args, sliceType)));
		return j;
	};
	JQuery.prototype.Add = function(args) { return this.$val.Add(args); };
	JQuery.ptr.prototype.Clone = function(b) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.clone.apply(obj, $externalize(b, sliceType)));
		return j;
	};
	JQuery.prototype.Clone = function(b) { return this.$val.Clone(b); };
	JQuery.ptr.prototype.Height = function() {
		var j;
		j = $clone(this, JQuery);
		return $parseInt(j.o.height()) >> 0;
	};
	JQuery.prototype.Height = function() { return this.$val.Height(); };
	JQuery.ptr.prototype.SetHeight = function(value) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.height($externalize(value, $String));
		return j;
	};
	JQuery.prototype.SetHeight = function(value) { return this.$val.SetHeight(value); };
	JQuery.ptr.prototype.Width = function() {
		var j;
		j = $clone(this, JQuery);
		return $parseInt(j.o.width()) >> 0;
	};
	JQuery.prototype.Width = function() { return this.$val.Width(); };
	JQuery.ptr.prototype.SetWidth = function(i) {
		var _ref, j;
		j = $clone(this, JQuery);
		_ref = i;
		if ($assertType(_ref, funcType$2, true)[1] || $assertType(_ref, $String, true)[1]) {
		} else {
			console.log("SetWidth Argument should be 'string' or 'func(int, string) string'");
		}
		j.o = j.o.width($externalize(i, $emptyInterface));
		return j;
	};
	JQuery.prototype.SetWidth = function(i) { return this.$val.SetWidth(i); };
	JQuery.ptr.prototype.InnerHeight = function() {
		var j;
		j = $clone(this, JQuery);
		return $parseInt(j.o.innerHeight()) >> 0;
	};
	JQuery.prototype.InnerHeight = function() { return this.$val.InnerHeight(); };
	JQuery.ptr.prototype.InnerWidth = function() {
		var j;
		j = $clone(this, JQuery);
		return $parseInt(j.o.innerWidth()) >> 0;
	};
	JQuery.prototype.InnerWidth = function() { return this.$val.InnerWidth(); };
	JQuery.ptr.prototype.Offset = function() {
		var j, obj;
		j = $clone(this, JQuery);
		obj = j.o.offset();
		return new JQueryCoordinates.ptr($parseInt(obj.left) >> 0, $parseInt(obj.top) >> 0);
	};
	JQuery.prototype.Offset = function() { return this.$val.Offset(); };
	JQuery.ptr.prototype.SetOffset = function(jc) {
		var j;
		j = $clone(this, JQuery);
		jc = $clone(jc, JQueryCoordinates);
		j.o = j.o.offset($externalize(jc, JQueryCoordinates));
		return j;
	};
	JQuery.prototype.SetOffset = function(jc) { return this.$val.SetOffset(jc); };
	JQuery.ptr.prototype.OuterHeight = function(includeMargin) {
		var j;
		j = $clone(this, JQuery);
		if (includeMargin.$length === 0) {
			return $parseInt(j.o.outerHeight()) >> 0;
		}
		return $parseInt(j.o.outerHeight($externalize(((0 < 0 || 0 >= includeMargin.$length) ? $throwRuntimeError("index out of range") : includeMargin.$array[includeMargin.$offset + 0]), $Bool))) >> 0;
	};
	JQuery.prototype.OuterHeight = function(includeMargin) { return this.$val.OuterHeight(includeMargin); };
	JQuery.ptr.prototype.OuterWidth = function(includeMargin) {
		var j;
		j = $clone(this, JQuery);
		if (includeMargin.$length === 0) {
			return $parseInt(j.o.outerWidth()) >> 0;
		}
		return $parseInt(j.o.outerWidth($externalize(((0 < 0 || 0 >= includeMargin.$length) ? $throwRuntimeError("index out of range") : includeMargin.$array[includeMargin.$offset + 0]), $Bool))) >> 0;
	};
	JQuery.prototype.OuterWidth = function(includeMargin) { return this.$val.OuterWidth(includeMargin); };
	JQuery.ptr.prototype.Position = function() {
		var j, obj;
		j = $clone(this, JQuery);
		obj = j.o.position();
		return new JQueryCoordinates.ptr($parseInt(obj.left) >> 0, $parseInt(obj.top) >> 0);
	};
	JQuery.prototype.Position = function() { return this.$val.Position(); };
	JQuery.ptr.prototype.ScrollLeft = function() {
		var j;
		j = $clone(this, JQuery);
		return $parseInt(j.o.scrollLeft()) >> 0;
	};
	JQuery.prototype.ScrollLeft = function() { return this.$val.ScrollLeft(); };
	JQuery.ptr.prototype.SetScrollLeft = function(value) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.scrollLeft(value);
		return j;
	};
	JQuery.prototype.SetScrollLeft = function(value) { return this.$val.SetScrollLeft(value); };
	JQuery.ptr.prototype.ScrollTop = function() {
		var j;
		j = $clone(this, JQuery);
		return $parseInt(j.o.scrollTop()) >> 0;
	};
	JQuery.prototype.ScrollTop = function() { return this.$val.ScrollTop(); };
	JQuery.ptr.prototype.SetScrollTop = function(value) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.scrollTop(value);
		return j;
	};
	JQuery.prototype.SetScrollTop = function(value) { return this.$val.SetScrollTop(value); };
	JQuery.ptr.prototype.ClearQueue = function(queueName) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.clearQueue($externalize(queueName, $String));
		return j;
	};
	JQuery.prototype.ClearQueue = function(queueName) { return this.$val.ClearQueue(queueName); };
	JQuery.ptr.prototype.SetData = function(key, value) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.data($externalize(key, $String), $externalize(value, $emptyInterface));
		return j;
	};
	JQuery.prototype.SetData = function(key, value) { return this.$val.SetData(key, value); };
	JQuery.ptr.prototype.Data = function(key) {
		var j, result;
		j = $clone(this, JQuery);
		result = j.o.data($externalize(key, $String));
		if (result === undefined) {
			return $ifaceNil;
		}
		return $internalize(result, $emptyInterface);
	};
	JQuery.prototype.Data = function(key) { return this.$val.Data(key); };
	JQuery.ptr.prototype.Dequeue = function(queueName) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.dequeue($externalize(queueName, $String));
		return j;
	};
	JQuery.prototype.Dequeue = function(queueName) { return this.$val.Dequeue(queueName); };
	JQuery.ptr.prototype.RemoveData = function(name) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.removeData($externalize(name, $String));
		return j;
	};
	JQuery.prototype.RemoveData = function(name) { return this.$val.RemoveData(name); };
	JQuery.ptr.prototype.OffsetParent = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.offsetParent();
		return j;
	};
	JQuery.prototype.OffsetParent = function() { return this.$val.OffsetParent(); };
	JQuery.ptr.prototype.Parent = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.parent.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Parent = function(i) { return this.$val.Parent(i); };
	JQuery.ptr.prototype.Parents = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.parents.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Parents = function(i) { return this.$val.Parents(i); };
	JQuery.ptr.prototype.ParentsUntil = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.parentsUntil.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.ParentsUntil = function(i) { return this.$val.ParentsUntil(i); };
	JQuery.ptr.prototype.Prev = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.prev.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Prev = function(i) { return this.$val.Prev(i); };
	JQuery.ptr.prototype.PrevAll = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.prevAll.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.PrevAll = function(i) { return this.$val.PrevAll(i); };
	JQuery.ptr.prototype.PrevUntil = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.prevUntil.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.PrevUntil = function(i) { return this.$val.PrevUntil(i); };
	JQuery.ptr.prototype.Siblings = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.siblings.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Siblings = function(i) { return this.$val.Siblings(i); };
	JQuery.ptr.prototype.Slice = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.slice.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Slice = function(i) { return this.$val.Slice(i); };
	JQuery.ptr.prototype.Children = function(selector) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.children($externalize(selector, $emptyInterface));
		return j;
	};
	JQuery.prototype.Children = function(selector) { return this.$val.Children(selector); };
	JQuery.ptr.prototype.Unwrap = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.unwrap();
		return j;
	};
	JQuery.prototype.Unwrap = function() { return this.$val.Unwrap(); };
	JQuery.ptr.prototype.Wrap = function(obj) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.wrap($externalize(obj, $emptyInterface));
		return j;
	};
	JQuery.prototype.Wrap = function(obj) { return this.$val.Wrap(obj); };
	JQuery.ptr.prototype.WrapAll = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.wrapAll(arg);
		return j;
	};
	JQuery.prototype.WrapAll = function(arg) { return this.$val.WrapAll(arg); };
	JQuery.ptr.prototype.WrapInner = function(arg) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.wrapInner(arg);
		return j;
	};
	JQuery.prototype.WrapInner = function(arg) { return this.$val.WrapInner(arg); };
	JQuery.ptr.prototype.Next = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.next.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Next = function(i) { return this.$val.Next(i); };
	JQuery.ptr.prototype.NextAll = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.nextAll.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.NextAll = function(i) { return this.$val.NextAll(i); };
	JQuery.ptr.prototype.NextUntil = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.nextUntil.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.NextUntil = function(i) { return this.$val.NextUntil(i); };
	JQuery.ptr.prototype.Not = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.not.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Not = function(i) { return this.$val.Not(i); };
	JQuery.ptr.prototype.Filter = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.filter.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Filter = function(i) { return this.$val.Filter(i); };
	JQuery.ptr.prototype.Find = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.find.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Find = function(i) { return this.$val.Find(i); };
	JQuery.ptr.prototype.First = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.first();
		return j;
	};
	JQuery.prototype.First = function() { return this.$val.First(); };
	JQuery.ptr.prototype.Has = function(selector) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.has($externalize(selector, $String));
		return j;
	};
	JQuery.prototype.Has = function(selector) { return this.$val.Has(selector); };
	JQuery.ptr.prototype.Is = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		return !!((obj = j.o, obj.is.apply(obj, $externalize(i, sliceType))));
	};
	JQuery.prototype.Is = function(i) { return this.$val.Is(i); };
	JQuery.ptr.prototype.Last = function() {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.last();
		return j;
	};
	JQuery.prototype.Last = function() { return this.$val.Last(); };
	JQuery.ptr.prototype.Ready = function(handler) {
		var j;
		j = $clone(this, JQuery);
		j.o = j.o.ready($externalize(handler, funcType$3));
		return j;
	};
	JQuery.prototype.Ready = function(handler) { return this.$val.Ready(handler); };
	JQuery.ptr.prototype.Resize = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.resize.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Resize = function(i) { return this.$val.Resize(i); };
	JQuery.ptr.prototype.Scroll = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.scroll.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Scroll = function(i) { return this.$val.Scroll(i); };
	JQuery.ptr.prototype.FadeOut = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.fadeOut.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.FadeOut = function(i) { return this.$val.FadeOut(i); };
	JQuery.ptr.prototype.Select = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.select.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Select = function(i) { return this.$val.Select(i); };
	JQuery.ptr.prototype.Submit = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.submit.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Submit = function(i) { return this.$val.Submit(i); };
	JQuery.ptr.prototype.Trigger = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.trigger.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Trigger = function(i) { return this.$val.Trigger(i); };
	JQuery.ptr.prototype.On = function(p) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.on.apply(obj, $externalize(p, sliceType)));
		return j;
	};
	JQuery.prototype.On = function(p) { return this.$val.On(p); };
	JQuery.ptr.prototype.One = function(p) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.one.apply(obj, $externalize(p, sliceType)));
		return j;
	};
	JQuery.prototype.One = function(p) { return this.$val.One(p); };
	JQuery.ptr.prototype.Off = function(p) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.off.apply(obj, $externalize(p, sliceType)));
		return j;
	};
	JQuery.prototype.Off = function(p) { return this.$val.Off(p); };
	JQuery.ptr.prototype.Load = function(i) {
		var j, obj;
		j = $clone(this, JQuery);
		j.o = (obj = j.o, obj.load.apply(obj, $externalize(i, sliceType)));
		return j;
	};
	JQuery.prototype.Load = function(i) { return this.$val.Load(i); };
	JQuery.ptr.prototype.Serialize = function() {
		var j;
		j = $clone(this, JQuery);
		return $internalize(j.o.serialize(), $String);
	};
	JQuery.prototype.Serialize = function() { return this.$val.Serialize(); };
	JQuery.ptr.prototype.SerializeArray = function() {
		var j;
		j = $clone(this, JQuery);
		return j.o.serializeArray();
	};
	JQuery.prototype.SerializeArray = function() { return this.$val.SerializeArray(); };
	Ajax = $pkg.Ajax = function(options) {
		return new Deferred.ptr($global.jQuery.ajax($externalize(options, mapType)));
	};
	AjaxPrefilter = $pkg.AjaxPrefilter = function(i) {
		var obj;
		(obj = $global.jQuery, obj.ajaxPrefilter.apply(obj, $externalize(i, sliceType)));
	};
	AjaxSetup = $pkg.AjaxSetup = function(options) {
		$global.jQuery.ajaxSetup($externalize(options, mapType));
	};
	AjaxTransport = $pkg.AjaxTransport = function(i) {
		var obj;
		(obj = $global.jQuery, obj.ajaxTransport.apply(obj, $externalize(i, sliceType)));
	};
	Get = $pkg.Get = function(i) {
		var obj;
		return new Deferred.ptr((obj = $global.jQuery, obj.get.apply(obj, $externalize(i, sliceType))));
	};
	Post = $pkg.Post = function(i) {
		var obj;
		return new Deferred.ptr((obj = $global.jQuery, obj.post.apply(obj, $externalize(i, sliceType))));
	};
	GetJSON = $pkg.GetJSON = function(i) {
		var obj;
		return new Deferred.ptr((obj = $global.jQuery, obj.getJSON.apply(obj, $externalize(i, sliceType))));
	};
	GetScript = $pkg.GetScript = function(i) {
		var obj;
		return new Deferred.ptr((obj = $global.jQuery, obj.getScript.apply(obj, $externalize(i, sliceType))));
	};
	Deferred.ptr.prototype.Promise = function() {
		var d;
		d = $clone(this, Deferred);
		return d.Object.promise();
	};
	Deferred.prototype.Promise = function() { return this.$val.Promise(); };
	Deferred.ptr.prototype.Then = function(fn) {
		var d, obj;
		d = $clone(this, Deferred);
		return new Deferred.ptr((obj = d.Object, obj.then.apply(obj, $externalize(fn, sliceType))));
	};
	Deferred.prototype.Then = function(fn) { return this.$val.Then(fn); };
	Deferred.ptr.prototype.Always = function(fn) {
		var d, obj;
		d = $clone(this, Deferred);
		return new Deferred.ptr((obj = d.Object, obj.always.apply(obj, $externalize(fn, sliceType))));
	};
	Deferred.prototype.Always = function(fn) { return this.$val.Always(fn); };
	Deferred.ptr.prototype.Done = function(fn) {
		var d, obj;
		d = $clone(this, Deferred);
		return new Deferred.ptr((obj = d.Object, obj.done.apply(obj, $externalize(fn, sliceType))));
	};
	Deferred.prototype.Done = function(fn) { return this.$val.Done(fn); };
	Deferred.ptr.prototype.Fail = function(fn) {
		var d, obj;
		d = $clone(this, Deferred);
		return new Deferred.ptr((obj = d.Object, obj.fail.apply(obj, $externalize(fn, sliceType))));
	};
	Deferred.prototype.Fail = function(fn) { return this.$val.Fail(fn); };
	Deferred.ptr.prototype.Progress = function(fn) {
		var d;
		d = $clone(this, Deferred);
		return new Deferred.ptr(d.Object.progress($externalize(fn, $emptyInterface)));
	};
	Deferred.prototype.Progress = function(fn) { return this.$val.Progress(fn); };
	When = $pkg.When = function(d) {
		var obj;
		return new Deferred.ptr((obj = $global.jQuery, obj.when.apply(obj, $externalize(d, sliceType))));
	};
	Deferred.ptr.prototype.State = function() {
		var d;
		d = $clone(this, Deferred);
		return $internalize(d.Object.state(), $String);
	};
	Deferred.prototype.State = function() { return this.$val.State(); };
	NewDeferred = $pkg.NewDeferred = function() {
		return new Deferred.ptr($global.jQuery.Deferred());
	};
	Deferred.ptr.prototype.Resolve = function(i) {
		var d, obj;
		d = $clone(this, Deferred);
		return new Deferred.ptr((obj = d.Object, obj.resolve.apply(obj, $externalize(i, sliceType))));
	};
	Deferred.prototype.Resolve = function(i) { return this.$val.Resolve(i); };
	Deferred.ptr.prototype.Reject = function(i) {
		var d, obj;
		d = $clone(this, Deferred);
		return new Deferred.ptr((obj = d.Object, obj.reject.apply(obj, $externalize(i, sliceType))));
	};
	Deferred.prototype.Reject = function(i) { return this.$val.Reject(i); };
	Deferred.ptr.prototype.Notify = function(i) {
		var d;
		d = $clone(this, Deferred);
		return new Deferred.ptr(d.Object.notify($externalize(i, $emptyInterface)));
	};
	Deferred.prototype.Notify = function(i) { return this.$val.Notify(i); };
	JQuery.methods = [{prop: "Add", name: "Add", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "AddBack", name: "AddBack", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "AddClass", name: "AddClass", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "After", name: "After", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Append", name: "Append", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "AppendTo", name: "AppendTo", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "Attr", name: "Attr", pkg: "", type: $funcType([$String], [$String], false)}, {prop: "Before", name: "Before", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Blur", name: "Blur", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Children", name: "Children", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "ClearQueue", name: "ClearQueue", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "Clone", name: "Clone", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Closest", name: "Closest", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Contents", name: "Contents", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Css", name: "Css", pkg: "", type: $funcType([$String], [$String], false)}, {prop: "CssArray", name: "CssArray", pkg: "", type: $funcType([sliceType$2], [mapType], true)}, {prop: "Data", name: "Data", pkg: "", type: $funcType([$String], [$emptyInterface], false)}, {prop: "Delay", name: "Delay", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Dequeue", name: "Dequeue", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "Detach", name: "Detach", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Each", name: "Each", pkg: "", type: $funcType([funcType$4], [JQuery], false)}, {prop: "Empty", name: "Empty", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "End", name: "End", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Eq", name: "Eq", pkg: "", type: $funcType([$Int], [JQuery], false)}, {prop: "FadeIn", name: "FadeIn", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "FadeOut", name: "FadeOut", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Filter", name: "Filter", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Find", name: "Find", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "First", name: "First", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Focus", name: "Focus", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Has", name: "Has", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "HasClass", name: "HasClass", pkg: "", type: $funcType([$String], [$Bool], false)}, {prop: "Height", name: "Height", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Hide", name: "Hide", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Html", name: "Html", pkg: "", type: $funcType([], [$String], false)}, {prop: "InnerHeight", name: "InnerHeight", pkg: "", type: $funcType([], [$Int], false)}, {prop: "InnerWidth", name: "InnerWidth", pkg: "", type: $funcType([], [$Int], false)}, {prop: "InsertAfter", name: "InsertAfter", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "InsertBefore", name: "InsertBefore", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "Is", name: "Is", pkg: "", type: $funcType([sliceType], [$Bool], true)}, {prop: "Last", name: "Last", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Load", name: "Load", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Next", name: "Next", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "NextAll", name: "NextAll", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "NextUntil", name: "NextUntil", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Not", name: "Not", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Off", name: "Off", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Offset", name: "Offset", pkg: "", type: $funcType([], [JQueryCoordinates], false)}, {prop: "OffsetParent", name: "OffsetParent", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "On", name: "On", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "One", name: "One", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "OuterHeight", name: "OuterHeight", pkg: "", type: $funcType([sliceType$3], [$Int], true)}, {prop: "OuterWidth", name: "OuterWidth", pkg: "", type: $funcType([sliceType$3], [$Int], true)}, {prop: "Parent", name: "Parent", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Parents", name: "Parents", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "ParentsUntil", name: "ParentsUntil", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Position", name: "Position", pkg: "", type: $funcType([], [JQueryCoordinates], false)}, {prop: "Prepend", name: "Prepend", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "PrependTo", name: "PrependTo", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "Prev", name: "Prev", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "PrevAll", name: "PrevAll", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "PrevUntil", name: "PrevUntil", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Prop", name: "Prop", pkg: "", type: $funcType([$String], [$emptyInterface], false)}, {prop: "Ready", name: "Ready", pkg: "", type: $funcType([funcType$3], [JQuery], false)}, {prop: "Remove", name: "Remove", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "RemoveAttr", name: "RemoveAttr", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "RemoveClass", name: "RemoveClass", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "RemoveData", name: "RemoveData", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "RemoveProp", name: "RemoveProp", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "ReplaceAll", name: "ReplaceAll", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "ReplaceWith", name: "ReplaceWith", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "Resize", name: "Resize", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Scroll", name: "Scroll", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "ScrollLeft", name: "ScrollLeft", pkg: "", type: $funcType([], [$Int], false)}, {prop: "ScrollTop", name: "ScrollTop", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Select", name: "Select", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Serialize", name: "Serialize", pkg: "", type: $funcType([], [$String], false)}, {prop: "SerializeArray", name: "SerializeArray", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "SetAttr", name: "SetAttr", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "SetCss", name: "SetCss", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "SetData", name: "SetData", pkg: "", type: $funcType([$String, $emptyInterface], [JQuery], false)}, {prop: "SetHeight", name: "SetHeight", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "SetHtml", name: "SetHtml", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "SetOffset", name: "SetOffset", pkg: "", type: $funcType([JQueryCoordinates], [JQuery], false)}, {prop: "SetProp", name: "SetProp", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "SetScrollLeft", name: "SetScrollLeft", pkg: "", type: $funcType([$Int], [JQuery], false)}, {prop: "SetScrollTop", name: "SetScrollTop", pkg: "", type: $funcType([$Int], [JQuery], false)}, {prop: "SetText", name: "SetText", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "SetVal", name: "SetVal", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "SetWidth", name: "SetWidth", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "Show", name: "Show", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Siblings", name: "Siblings", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Slice", name: "Slice", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Stop", name: "Stop", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Submit", name: "Submit", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Text", name: "Text", pkg: "", type: $funcType([], [$String], false)}, {prop: "ToArray", name: "ToArray", pkg: "", type: $funcType([], [sliceType$1], false)}, {prop: "Toggle", name: "Toggle", pkg: "", type: $funcType([$Bool], [JQuery], false)}, {prop: "ToggleClass", name: "ToggleClass", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Trigger", name: "Trigger", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Underlying", name: "Underlying", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "Unwrap", name: "Unwrap", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Val", name: "Val", pkg: "", type: $funcType([], [$String], false)}, {prop: "Width", name: "Width", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Wrap", name: "Wrap", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "WrapAll", name: "WrapAll", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "WrapInner", name: "WrapInner", pkg: "", type: $funcType([js.Any], [JQuery], false)}];
	ptrType.methods = [{prop: "Add", name: "Add", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "AddBack", name: "AddBack", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "AddClass", name: "AddClass", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "After", name: "After", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Append", name: "Append", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "AppendTo", name: "AppendTo", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "Attr", name: "Attr", pkg: "", type: $funcType([$String], [$String], false)}, {prop: "Before", name: "Before", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Blur", name: "Blur", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Children", name: "Children", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "ClearQueue", name: "ClearQueue", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "Clone", name: "Clone", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Closest", name: "Closest", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Contents", name: "Contents", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Css", name: "Css", pkg: "", type: $funcType([$String], [$String], false)}, {prop: "CssArray", name: "CssArray", pkg: "", type: $funcType([sliceType$2], [mapType], true)}, {prop: "Data", name: "Data", pkg: "", type: $funcType([$String], [$emptyInterface], false)}, {prop: "Delay", name: "Delay", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Dequeue", name: "Dequeue", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "Detach", name: "Detach", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Each", name: "Each", pkg: "", type: $funcType([funcType$4], [JQuery], false)}, {prop: "Empty", name: "Empty", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "End", name: "End", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Eq", name: "Eq", pkg: "", type: $funcType([$Int], [JQuery], false)}, {prop: "FadeIn", name: "FadeIn", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "FadeOut", name: "FadeOut", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Filter", name: "Filter", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Find", name: "Find", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "First", name: "First", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Focus", name: "Focus", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Has", name: "Has", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "HasClass", name: "HasClass", pkg: "", type: $funcType([$String], [$Bool], false)}, {prop: "Height", name: "Height", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Hide", name: "Hide", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Html", name: "Html", pkg: "", type: $funcType([], [$String], false)}, {prop: "InnerHeight", name: "InnerHeight", pkg: "", type: $funcType([], [$Int], false)}, {prop: "InnerWidth", name: "InnerWidth", pkg: "", type: $funcType([], [$Int], false)}, {prop: "InsertAfter", name: "InsertAfter", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "InsertBefore", name: "InsertBefore", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "Is", name: "Is", pkg: "", type: $funcType([sliceType], [$Bool], true)}, {prop: "Last", name: "Last", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Load", name: "Load", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Next", name: "Next", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "NextAll", name: "NextAll", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "NextUntil", name: "NextUntil", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Not", name: "Not", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Off", name: "Off", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Offset", name: "Offset", pkg: "", type: $funcType([], [JQueryCoordinates], false)}, {prop: "OffsetParent", name: "OffsetParent", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "On", name: "On", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "One", name: "One", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "OuterHeight", name: "OuterHeight", pkg: "", type: $funcType([sliceType$3], [$Int], true)}, {prop: "OuterWidth", name: "OuterWidth", pkg: "", type: $funcType([sliceType$3], [$Int], true)}, {prop: "Parent", name: "Parent", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Parents", name: "Parents", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "ParentsUntil", name: "ParentsUntil", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Position", name: "Position", pkg: "", type: $funcType([], [JQueryCoordinates], false)}, {prop: "Prepend", name: "Prepend", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "PrependTo", name: "PrependTo", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "Prev", name: "Prev", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "PrevAll", name: "PrevAll", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "PrevUntil", name: "PrevUntil", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Prop", name: "Prop", pkg: "", type: $funcType([$String], [$emptyInterface], false)}, {prop: "Ready", name: "Ready", pkg: "", type: $funcType([funcType$3], [JQuery], false)}, {prop: "Remove", name: "Remove", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "RemoveAttr", name: "RemoveAttr", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "RemoveClass", name: "RemoveClass", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "RemoveData", name: "RemoveData", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "RemoveProp", name: "RemoveProp", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "ReplaceAll", name: "ReplaceAll", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "ReplaceWith", name: "ReplaceWith", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "Resize", name: "Resize", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Scroll", name: "Scroll", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "ScrollLeft", name: "ScrollLeft", pkg: "", type: $funcType([], [$Int], false)}, {prop: "ScrollTop", name: "ScrollTop", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Select", name: "Select", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Serialize", name: "Serialize", pkg: "", type: $funcType([], [$String], false)}, {prop: "SerializeArray", name: "SerializeArray", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "SetAttr", name: "SetAttr", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "SetCss", name: "SetCss", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "SetData", name: "SetData", pkg: "", type: $funcType([$String, $emptyInterface], [JQuery], false)}, {prop: "SetHeight", name: "SetHeight", pkg: "", type: $funcType([$String], [JQuery], false)}, {prop: "SetHtml", name: "SetHtml", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "SetOffset", name: "SetOffset", pkg: "", type: $funcType([JQueryCoordinates], [JQuery], false)}, {prop: "SetProp", name: "SetProp", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "SetScrollLeft", name: "SetScrollLeft", pkg: "", type: $funcType([$Int], [JQuery], false)}, {prop: "SetScrollTop", name: "SetScrollTop", pkg: "", type: $funcType([$Int], [JQuery], false)}, {prop: "SetText", name: "SetText", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "SetVal", name: "SetVal", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "SetWidth", name: "SetWidth", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "Show", name: "Show", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Siblings", name: "Siblings", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Slice", name: "Slice", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Stop", name: "Stop", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Submit", name: "Submit", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Text", name: "Text", pkg: "", type: $funcType([], [$String], false)}, {prop: "ToArray", name: "ToArray", pkg: "", type: $funcType([], [sliceType$1], false)}, {prop: "Toggle", name: "Toggle", pkg: "", type: $funcType([$Bool], [JQuery], false)}, {prop: "ToggleClass", name: "ToggleClass", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Trigger", name: "Trigger", pkg: "", type: $funcType([sliceType], [JQuery], true)}, {prop: "Underlying", name: "Underlying", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "Unwrap", name: "Unwrap", pkg: "", type: $funcType([], [JQuery], false)}, {prop: "Val", name: "Val", pkg: "", type: $funcType([], [$String], false)}, {prop: "Width", name: "Width", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Wrap", name: "Wrap", pkg: "", type: $funcType([$emptyInterface], [JQuery], false)}, {prop: "WrapAll", name: "WrapAll", pkg: "", type: $funcType([js.Any], [JQuery], false)}, {prop: "WrapInner", name: "WrapInner", pkg: "", type: $funcType([js.Any], [JQuery], false)}];
	Event.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	ptrType$1.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "IsDefaultPrevented", name: "IsDefaultPrevented", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "IsImmediatePropogationStopped", name: "IsImmediatePropogationStopped", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "IsPropagationStopped", name: "IsPropagationStopped", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "PreventDefault", name: "PreventDefault", pkg: "", type: $funcType([], [], false)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "StopImmediatePropagation", name: "StopImmediatePropagation", pkg: "", type: $funcType([], [], false)}, {prop: "StopPropagation", name: "StopPropagation", pkg: "", type: $funcType([], [], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	Deferred.methods = [{prop: "Always", name: "Always", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Done", name: "Done", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Fail", name: "Fail", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Notify", name: "Notify", pkg: "", type: $funcType([$emptyInterface], [Deferred], false)}, {prop: "Progress", name: "Progress", pkg: "", type: $funcType([$emptyInterface], [Deferred], false)}, {prop: "Promise", name: "Promise", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "Reject", name: "Reject", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Resolve", name: "Resolve", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "State", name: "State", pkg: "", type: $funcType([], [$String], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Then", name: "Then", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	ptrType$2.methods = [{prop: "Always", name: "Always", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Done", name: "Done", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Fail", name: "Fail", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Notify", name: "Notify", pkg: "", type: $funcType([$emptyInterface], [Deferred], false)}, {prop: "Progress", name: "Progress", pkg: "", type: $funcType([$emptyInterface], [Deferred], false)}, {prop: "Promise", name: "Promise", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "Reject", name: "Reject", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Resolve", name: "Resolve", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "State", name: "State", pkg: "", type: $funcType([], [$String], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Then", name: "Then", pkg: "", type: $funcType([sliceType], [Deferred], true)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	JQuery.init([{prop: "o", name: "o", pkg: "github.com/gopherjs/jquery", type: js.Object, tag: ""}, {prop: "Jquery", name: "Jquery", pkg: "", type: $String, tag: "js:\"jquery\""}, {prop: "Selector", name: "Selector", pkg: "", type: $String, tag: "js:\"selector\""}, {prop: "Length", name: "Length", pkg: "", type: $Int, tag: "js:\"length\""}, {prop: "Context", name: "Context", pkg: "", type: $String, tag: "js:\"context\""}]);
	Event.init([{prop: "Object", name: "", pkg: "", type: js.Object, tag: ""}, {prop: "KeyCode", name: "KeyCode", pkg: "", type: $Int, tag: "js:\"keyCode\""}, {prop: "Target", name: "Target", pkg: "", type: js.Object, tag: "js:\"target\""}, {prop: "CurrentTarget", name: "CurrentTarget", pkg: "", type: js.Object, tag: "js:\"currentTarget\""}, {prop: "DelegateTarget", name: "DelegateTarget", pkg: "", type: js.Object, tag: "js:\"delegateTarget\""}, {prop: "RelatedTarget", name: "RelatedTarget", pkg: "", type: js.Object, tag: "js:\"relatedTarget\""}, {prop: "Data", name: "Data", pkg: "", type: js.Object, tag: "js:\"data\""}, {prop: "Result", name: "Result", pkg: "", type: js.Object, tag: "js:\"result\""}, {prop: "Which", name: "Which", pkg: "", type: $Int, tag: "js:\"which\""}, {prop: "Namespace", name: "Namespace", pkg: "", type: $String, tag: "js:\"namespace\""}, {prop: "MetaKey", name: "MetaKey", pkg: "", type: $Bool, tag: "js:\"metaKey\""}, {prop: "PageX", name: "PageX", pkg: "", type: $Int, tag: "js:\"pageX\""}, {prop: "PageY", name: "PageY", pkg: "", type: $Int, tag: "js:\"pageY\""}, {prop: "Type", name: "Type", pkg: "", type: $String, tag: "js:\"type\""}]);
	JQueryCoordinates.init([{prop: "Left", name: "Left", pkg: "", type: $Int, tag: ""}, {prop: "Top", name: "Top", pkg: "", type: $Int, tag: ""}]);
	Deferred.init([{prop: "Object", name: "", pkg: "", type: js.Object, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_jquery = function() { while (true) { switch ($s) { case 0:
		$r = js.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		/* */ } return; } }; $init_jquery.$blocking = true; return $init_jquery;
	};
	return $pkg;
})();
$packages["github.com/rusco/qunit"] = (function() {
	var $pkg = {}, js, QUnitAssert, sliceType, funcType, funcType$1, funcType$2, ptrType, log, Test, Ok, Start, AsyncTest, Expect, Module, ModuleLifecycle;
	js = $packages["github.com/gopherjs/gopherjs/js"];
	QUnitAssert = $pkg.QUnitAssert = $newType(0, $kindStruct, "qunit.QUnitAssert", "QUnitAssert", "github.com/rusco/qunit", function(Object_) {
		this.$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
		sliceType = $sliceType(js.Any);
		funcType = $funcType([], [js.Any], false);
		funcType$1 = $funcType([js.Object], [], false);
		funcType$2 = $funcType([], [], false);
		ptrType = $ptrType(QUnitAssert);
	log = function(i) {
		var obj;
		(obj = $global.console, obj.log.apply(obj, $externalize(i, sliceType)));
	};
	QUnitAssert.ptr.prototype.DeepEqual = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.deepEqual(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.DeepEqual = function(actual, expected, message) { return this.$val.DeepEqual(actual, expected, message); };
	QUnitAssert.ptr.prototype.Equal = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		log(new sliceType([new $String("---> qunit: "), actual, expected, qa.Object.equal(actual, expected, $externalize(message, $String)), new $Bool(!!(qa.Object.equal(actual, expected, $externalize(message, $String))))]));
		return !!(qa.Object.equal(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.Equal = function(actual, expected, message) { return this.$val.Equal(actual, expected, message); };
	QUnitAssert.ptr.prototype.NotDeepEqual = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.notDeepEqual(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.NotDeepEqual = function(actual, expected, message) { return this.$val.NotDeepEqual(actual, expected, message); };
	QUnitAssert.ptr.prototype.NotEqual = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.notEqual(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.NotEqual = function(actual, expected, message) { return this.$val.NotEqual(actual, expected, message); };
	QUnitAssert.ptr.prototype.NotPropEqual = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.notPropEqual(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.NotPropEqual = function(actual, expected, message) { return this.$val.NotPropEqual(actual, expected, message); };
	QUnitAssert.ptr.prototype.PropEqual = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.propEqual(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.PropEqual = function(actual, expected, message) { return this.$val.PropEqual(actual, expected, message); };
	QUnitAssert.ptr.prototype.NotStrictEqual = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.notStrictEqual(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.NotStrictEqual = function(actual, expected, message) { return this.$val.NotStrictEqual(actual, expected, message); };
	QUnitAssert.ptr.prototype.Ok = function(state, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.ok(state, $externalize(message, $String)));
	};
	QUnitAssert.prototype.Ok = function(state, message) { return this.$val.Ok(state, message); };
	QUnitAssert.ptr.prototype.StrictEqual = function(actual, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return !!(qa.Object.strictEqual(actual, expected, $externalize(message, $String)));
	};
	QUnitAssert.prototype.StrictEqual = function(actual, expected, message) { return this.$val.StrictEqual(actual, expected, message); };
	QUnitAssert.ptr.prototype.ThrowsExpected = function(block, expected, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return qa.Object.throwsExpected($externalize(block, funcType), expected, $externalize(message, $String));
	};
	QUnitAssert.prototype.ThrowsExpected = function(block, expected, message) { return this.$val.ThrowsExpected(block, expected, message); };
	QUnitAssert.ptr.prototype.Throws = function(block, message) {
		var qa;
		qa = $clone(this, QUnitAssert);
		return qa.Object.throws($externalize(block, funcType), $externalize(message, $String));
	};
	QUnitAssert.prototype.Throws = function(block, message) { return this.$val.Throws(block, message); };
	Test = $pkg.Test = function(name, testFn) {
		$global.QUnit.test($externalize(name, $String), $externalize((function(e) {
			testFn(new QUnitAssert.ptr(e));
		}), funcType$1));
	};
	Ok = $pkg.Ok = function(state, message) {
		return $global.QUnit.ok(state, $externalize(message, $String));
	};
	Start = $pkg.Start = function() {
		return $global.QUnit.start();
	};
	AsyncTest = $pkg.AsyncTest = function(name, testFn) {
		var t;
		t = $global.QUnit.asyncTest($externalize(name, $String), $externalize((function() {
			testFn();
		}), funcType$2));
		return t;
	};
	Expect = $pkg.Expect = function(amount) {
		return $global.QUnit.expect(amount);
	};
	Module = $pkg.Module = function(name) {
		return $global.QUnit.module($externalize(name, $String));
	};
	ModuleLifecycle = $pkg.ModuleLifecycle = function(name, lc) {
		var o;
		o = new ($global.Object)();
		if (!($methodVal(lc, "Setup") === $throwNilPointerError)) {
			o.setup = $externalize($methodVal(lc, "Setup"), funcType$2);
		}
		if (!($methodVal(lc, "Teardown") === $throwNilPointerError)) {
			o.teardown = $externalize($methodVal(lc, "Teardown"), funcType$2);
		}
		return $global.QUnit.module($externalize(name, $String), o);
	};
	QUnitAssert.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "DeepEqual", name: "DeepEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Equal", name: "Equal", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "NotDeepEqual", name: "NotDeepEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "NotEqual", name: "NotEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "NotPropEqual", name: "NotPropEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "NotStrictEqual", name: "NotStrictEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Ok", name: "Ok", pkg: "", type: $funcType([js.Any, $String], [$Bool], false)}, {prop: "PropEqual", name: "PropEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "StrictEqual", name: "StrictEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Throws", name: "Throws", pkg: "", type: $funcType([funcType, $String], [js.Object], false)}, {prop: "ThrowsExpected", name: "ThrowsExpected", pkg: "", type: $funcType([funcType, js.Any, $String], [js.Object], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	ptrType.methods = [{prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "DeepEqual", name: "DeepEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Equal", name: "Equal", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "NotDeepEqual", name: "NotDeepEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "NotEqual", name: "NotEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "NotPropEqual", name: "NotPropEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "NotStrictEqual", name: "NotStrictEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Ok", name: "Ok", pkg: "", type: $funcType([js.Any, $String], [$Bool], false)}, {prop: "PropEqual", name: "PropEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "StrictEqual", name: "StrictEqual", pkg: "", type: $funcType([js.Any, js.Any, $String], [$Bool], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Throws", name: "Throws", pkg: "", type: $funcType([funcType, $String], [js.Object], false)}, {prop: "ThrowsExpected", name: "ThrowsExpected", pkg: "", type: $funcType([funcType, js.Any, $String], [js.Object], false)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}];
	QUnitAssert.init([{prop: "Object", name: "", pkg: "", type: js.Object, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_qunit = function() { while (true) { switch ($s) { case 0:
		$r = js.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		/* */ } return; } }; $init_qunit.$blocking = true; return $init_qunit;
	};
	return $pkg;
})();
$packages["errors"] = (function() {
	var $pkg = {}, errorString, ptrType, New;
	errorString = $pkg.errorString = $newType(0, $kindStruct, "errors.errorString", "errorString", "errors", function(s_) {
		this.$val = this;
		this.s = s_ !== undefined ? s_ : "";
	});
		ptrType = $ptrType(errorString);
	New = $pkg.New = function(text) {
		return new errorString.ptr(text);
	};
	errorString.ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.s;
	};
	errorString.prototype.Error = function() { return this.$val.Error(); };
	ptrType.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}];
	errorString.init([{prop: "s", name: "s", pkg: "errors", type: $String, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_errors = function() { while (true) { switch ($s) { case 0:
		/* */ } return; } }; $init_errors.$blocking = true; return $init_errors;
	};
	return $pkg;
})();
$packages["math"] = (function() {
	var $pkg = {}, js, arrayType, math, zero, posInf, negInf, nan, pow10tab, init, Ldexp, Float32bits, Float32frombits, init$1;
	js = $packages["github.com/gopherjs/gopherjs/js"];
		arrayType = $arrayType($Float64, 70);
	init = function() {
		Float32bits(0);
		Float32frombits(0);
	};
	Ldexp = $pkg.Ldexp = function(frac, exp$1) {
		if (frac === 0) {
			return frac;
		}
		if (exp$1 >= 1024) {
			return frac * $parseFloat(math.pow(2, 1023)) * $parseFloat(math.pow(2, exp$1 - 1023 >> 0));
		}
		if (exp$1 <= -1024) {
			return frac * $parseFloat(math.pow(2, -1023)) * $parseFloat(math.pow(2, exp$1 + 1023 >> 0));
		}
		return frac * $parseFloat(math.pow(2, exp$1));
	};
	Float32bits = $pkg.Float32bits = function(f) {
		var e, r, s;
		if (f === 0) {
			if (1 / f === negInf) {
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
			e = e + (1) >>> 0;
			if (e === 255) {
				if (f >= 8.388608e+06) {
					f = posInf;
				}
				break;
			}
		}
		while (f < 8.388608e+06) {
			e = e - (1) >>> 0;
			if (e === 0) {
				break;
			}
			f = f * (2);
		}
		r = $parseFloat($mod(f, 2));
		if ((r > 0.5 && r < 1) || r >= 1.5) {
			f = f + (1);
		}
		return (((s | (e << 23 >>> 0)) >>> 0) | (((f >> 0) & ~8388608))) >>> 0;
	};
	Float32frombits = $pkg.Float32frombits = function(b) {
		var e, m, s;
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
			m = m + (8388608) >>> 0;
		}
		if (e === 0) {
			e = 1;
		}
		return Ldexp(m, ((e >> 0) - 127 >> 0) - 23 >> 0) * s;
	};
	init$1 = function() {
		var _q, i, m, x;
		pow10tab[0] = 1;
		pow10tab[1] = 10;
		i = 2;
		while (i < 70) {
			m = (_q = i / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero"));
			(i < 0 || i >= pow10tab.length) ? $throwRuntimeError("index out of range") : pow10tab[i] = ((m < 0 || m >= pow10tab.length) ? $throwRuntimeError("index out of range") : pow10tab[m]) * (x = i - m >> 0, ((x < 0 || x >= pow10tab.length) ? $throwRuntimeError("index out of range") : pow10tab[x]));
			i = i + (1) >> 0;
		}
	};
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_math = function() { while (true) { switch ($s) { case 0:
		$r = js.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		pow10tab = arrayType.zero();
		math = $global.Math;
		zero = 0;
		posInf = 1 / zero;
		negInf = -1 / zero;
		nan = 0 / zero;
		init();
		init$1();
		/* */ } return; } }; $init_math.$blocking = true; return $init_math;
	};
	return $pkg;
})();
$packages["unicode/utf8"] = (function() {
	var $pkg = {};
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_utf8 = function() { while (true) { switch ($s) { case 0:
		/* */ } return; } }; $init_utf8.$blocking = true; return $init_utf8;
	};
	return $pkg;
})();
$packages["strconv"] = (function() {
	var $pkg = {}, errors, math, utf8, sliceType$6, arrayType$4, shifts, FormatInt, Itoa, formatBits;
	errors = $packages["errors"];
	math = $packages["math"];
	utf8 = $packages["unicode/utf8"];
		sliceType$6 = $sliceType($Uint8);
		arrayType$4 = $arrayType($Uint8, 65);
	FormatInt = $pkg.FormatInt = function(i, base) {
		var _tuple, s;
		_tuple = formatBits(sliceType$6.nil, new $Uint64(i.$high, i.$low), base, (i.$high < 0 || (i.$high === 0 && i.$low < 0)), false); s = _tuple[1];
		return s;
	};
	Itoa = $pkg.Itoa = function(i) {
		return FormatInt(new $Int64(0, i), 10);
	};
	formatBits = function(dst, u, base, neg, append_) {
		var a, b, b$1, d = sliceType$6.nil, i, j, m, q, q$1, s = "", s$1, x, x$1, x$2, x$3;
		if (base < 2 || base > 36) {
			$panic(new $String("strconv: illegal AppendInt/FormatInt base"));
		}
		a = $clone(arrayType$4.zero(), arrayType$4);
		i = 65;
		if (neg) {
			u = new $Uint64(-u.$high, -u.$low);
		}
		if (base === 10) {
			while ((u.$high > 0 || (u.$high === 0 && u.$low >= 100))) {
				i = i - (2) >> 0;
				q = $div64(u, new $Uint64(0, 100), false);
				j = ((x = $mul64(q, new $Uint64(0, 100)), new $Uint64(u.$high - x.$high, u.$low - x.$low)).$low >>> 0);
				(x$1 = i + 1 >> 0, (x$1 < 0 || x$1 >= a.length) ? $throwRuntimeError("index out of range") : a[x$1] = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789".charCodeAt(j));
				(x$2 = i + 0 >> 0, (x$2 < 0 || x$2 >= a.length) ? $throwRuntimeError("index out of range") : a[x$2] = "0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999".charCodeAt(j));
				u = q;
			}
			if ((u.$high > 0 || (u.$high === 0 && u.$low >= 10))) {
				i = i - (1) >> 0;
				q$1 = $div64(u, new $Uint64(0, 10), false);
				(i < 0 || i >= a.length) ? $throwRuntimeError("index out of range") : a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt(((x$3 = $mul64(q$1, new $Uint64(0, 10)), new $Uint64(u.$high - x$3.$high, u.$low - x$3.$low)).$low >>> 0));
				u = q$1;
			}
		} else {
			s$1 = ((base < 0 || base >= shifts.length) ? $throwRuntimeError("index out of range") : shifts[base]);
			if (s$1 > 0) {
				b = new $Uint64(0, base);
				m = (b.$low >>> 0) - 1 >>> 0;
				while ((u.$high > b.$high || (u.$high === b.$high && u.$low >= b.$low))) {
					i = i - (1) >> 0;
					(i < 0 || i >= a.length) ? $throwRuntimeError("index out of range") : a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((((u.$low >>> 0) & m) >>> 0));
					u = $shiftRightUint64(u, (s$1));
				}
			} else {
				b$1 = new $Uint64(0, base);
				while ((u.$high > b$1.$high || (u.$high === b$1.$high && u.$low >= b$1.$low))) {
					i = i - (1) >> 0;
					(i < 0 || i >= a.length) ? $throwRuntimeError("index out of range") : a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt(($div64(u, b$1, true).$low >>> 0));
					u = $div64(u, (b$1), false);
				}
			}
		}
		i = i - (1) >> 0;
		(i < 0 || i >= a.length) ? $throwRuntimeError("index out of range") : a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((u.$low >>> 0));
		if (neg) {
			i = i - (1) >> 0;
			(i < 0 || i >= a.length) ? $throwRuntimeError("index out of range") : a[i] = 45;
		}
		if (append_) {
			d = $appendSlice(dst, $subslice(new sliceType$6(a), i));
			return [d, s];
		}
		s = $bytesToString($subslice(new sliceType$6(a), i));
		return [d, s];
	};
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_strconv = function() { while (true) { switch ($s) { case 0:
		$r = errors.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = math.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		$r = utf8.$init($BLOCKING); /* */ $s = 3; case 3: if ($r && $r.$blocking) { $r = $r(); }
		$pkg.ErrRange = errors.New("value out of range");
		$pkg.ErrSyntax = errors.New("invalid syntax");
		shifts = $toNativeArray($kindUint, [0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]);
		/* */ } return; } }; $init_strconv.$blocking = true; return $init_strconv;
	};
	return $pkg;
})();
$packages["sync/atomic"] = (function() {
	var $pkg = {}, js, CompareAndSwapInt32, AddInt32;
	js = $packages["github.com/gopherjs/gopherjs/js"];
	CompareAndSwapInt32 = $pkg.CompareAndSwapInt32 = function(addr, old, new$1) {
		if (addr.$get() === old) {
			addr.$set(new$1);
			return true;
		}
		return false;
	};
	AddInt32 = $pkg.AddInt32 = function(addr, delta) {
		var new$1;
		new$1 = addr.$get() + delta >> 0;
		addr.$set(new$1);
		return new$1;
	};
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_atomic = function() { while (true) { switch ($s) { case 0:
		$r = js.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		/* */ } return; } }; $init_atomic.$blocking = true; return $init_atomic;
	};
	return $pkg;
})();
$packages["sync"] = (function() {
	var $pkg = {}, runtime, atomic, Pool, Mutex, poolLocal, syncSema, ptrType, sliceType, ptrType$2, ptrType$3, ptrType$5, sliceType$2, funcType, ptrType$10, arrayType, allPools, runtime_registerPoolCleanup, runtime_Syncsemcheck, poolCleanup, init, indexLocal, runtime_Semacquire, runtime_Semrelease, init$1;
	runtime = $packages["runtime"];
	atomic = $packages["sync/atomic"];
	Pool = $pkg.Pool = $newType(0, $kindStruct, "sync.Pool", "Pool", "sync", function(local_, localSize_, store_, New_) {
		this.$val = this;
		this.local = local_ !== undefined ? local_ : 0;
		this.localSize = localSize_ !== undefined ? localSize_ : 0;
		this.store = store_ !== undefined ? store_ : sliceType$2.nil;
		this.New = New_ !== undefined ? New_ : $throwNilPointerError;
	});
	Mutex = $pkg.Mutex = $newType(0, $kindStruct, "sync.Mutex", "Mutex", "sync", function(state_, sema_) {
		this.$val = this;
		this.state = state_ !== undefined ? state_ : 0;
		this.sema = sema_ !== undefined ? sema_ : 0;
	});
	poolLocal = $pkg.poolLocal = $newType(0, $kindStruct, "sync.poolLocal", "poolLocal", "sync", function(private$0_, shared_, Mutex_, pad_) {
		this.$val = this;
		this.private$0 = private$0_ !== undefined ? private$0_ : $ifaceNil;
		this.shared = shared_ !== undefined ? shared_ : sliceType$2.nil;
		this.Mutex = Mutex_ !== undefined ? Mutex_ : new Mutex.ptr();
		this.pad = pad_ !== undefined ? pad_ : arrayType.zero();
	});
	syncSema = $pkg.syncSema = $newType(0, $kindStruct, "sync.syncSema", "syncSema", "sync", function(lock_, head_, tail_) {
		this.$val = this;
		this.lock = lock_ !== undefined ? lock_ : 0;
		this.head = head_ !== undefined ? head_ : 0;
		this.tail = tail_ !== undefined ? tail_ : 0;
	});
		ptrType = $ptrType(Pool);
		sliceType = $sliceType(ptrType);
		ptrType$2 = $ptrType($Uint32);
		ptrType$3 = $ptrType($Int32);
		ptrType$5 = $ptrType(poolLocal);
		sliceType$2 = $sliceType($emptyInterface);
		funcType = $funcType([], [$emptyInterface], false);
		ptrType$10 = $ptrType(Mutex);
		arrayType = $arrayType($Uint8, 128);
	Pool.ptr.prototype.Get = function() {
		var p, x, x$1, x$2;
		p = this;
		if (p.store.$length === 0) {
			if (!(p.New === $throwNilPointerError)) {
				return p.New();
			}
			return $ifaceNil;
		}
		x$2 = (x = p.store, x$1 = p.store.$length - 1 >> 0, ((x$1 < 0 || x$1 >= x.$length) ? $throwRuntimeError("index out of range") : x.$array[x.$offset + x$1]));
		p.store = $subslice(p.store, 0, (p.store.$length - 1 >> 0));
		return x$2;
	};
	Pool.prototype.Get = function() { return this.$val.Get(); };
	Pool.ptr.prototype.Put = function(x) {
		var p;
		p = this;
		if ($interfaceIsEqual(x, $ifaceNil)) {
			return;
		}
		p.store = $append(p.store, x);
	};
	Pool.prototype.Put = function(x) { return this.$val.Put(x); };
	runtime_registerPoolCleanup = function(cleanup) {
	};
	runtime_Syncsemcheck = function(size) {
	};
	Mutex.ptr.prototype.Lock = function() {
		var awoke, m, new$1, old;
		m = this;
		if (atomic.CompareAndSwapInt32(new ptrType$3(function() { return this.$target.state; }, function($v) { this.$target.state = $v; }, m), 0, 1)) {
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
				new$1 = new$1 & ~(2);
			}
			if (atomic.CompareAndSwapInt32(new ptrType$3(function() { return this.$target.state; }, function($v) { this.$target.state = $v; }, m), old, new$1)) {
				if ((old & 1) === 0) {
					break;
				}
				runtime_Semacquire(new ptrType$2(function() { return this.$target.sema; }, function($v) { this.$target.sema = $v; }, m));
				awoke = true;
			}
		}
	};
	Mutex.prototype.Lock = function() { return this.$val.Lock(); };
	Mutex.ptr.prototype.Unlock = function() {
		var m, new$1, old;
		m = this;
		new$1 = atomic.AddInt32(new ptrType$3(function() { return this.$target.state; }, function($v) { this.$target.state = $v; }, m), -1);
		if ((((new$1 + 1 >> 0)) & 1) === 0) {
			$panic(new $String("sync: unlock of unlocked mutex"));
		}
		old = new$1;
		while (true) {
			if (((old >> 2 >> 0) === 0) || !(((old & 3) === 0))) {
				return;
			}
			new$1 = ((old - 4 >> 0)) | 2;
			if (atomic.CompareAndSwapInt32(new ptrType$3(function() { return this.$target.state; }, function($v) { this.$target.state = $v; }, m), old, new$1)) {
				runtime_Semrelease(new ptrType$2(function() { return this.$target.sema; }, function($v) { this.$target.sema = $v; }, m));
				return;
			}
			old = m.state;
		}
	};
	Mutex.prototype.Unlock = function() { return this.$val.Unlock(); };
	poolCleanup = function() {
		var _i, _i$1, _ref, _ref$1, i, i$1, j, l, p, x;
		_ref = allPools;
		_i = 0;
		while (_i < _ref.$length) {
			i = _i;
			p = ((_i < 0 || _i >= _ref.$length) ? $throwRuntimeError("index out of range") : _ref.$array[_ref.$offset + _i]);
			(i < 0 || i >= allPools.$length) ? $throwRuntimeError("index out of range") : allPools.$array[allPools.$offset + i] = ptrType.nil;
			i$1 = 0;
			while (i$1 < (p.localSize >> 0)) {
				l = indexLocal(p.local, i$1);
				l.private$0 = $ifaceNil;
				_ref$1 = l.shared;
				_i$1 = 0;
				while (_i$1 < _ref$1.$length) {
					j = _i$1;
					(x = l.shared, (j < 0 || j >= x.$length) ? $throwRuntimeError("index out of range") : x.$array[x.$offset + j] = $ifaceNil);
					_i$1++;
				}
				l.shared = sliceType$2.nil;
				i$1 = i$1 + (1) >> 0;
			}
			p.local = 0;
			p.localSize = 0;
			_i++;
		}
		allPools = new sliceType([]);
	};
	init = function() {
		runtime_registerPoolCleanup(poolCleanup);
	};
	indexLocal = function(l, i) {
		var x;
		return (x = l, (x.nilCheck, ((i < 0 || i >= x.length) ? $throwRuntimeError("index out of range") : x[i])));
	};
	runtime_Semacquire = function() {
		$panic("Native function not implemented: sync.runtime_Semacquire");
	};
	runtime_Semrelease = function() {
		$panic("Native function not implemented: sync.runtime_Semrelease");
	};
	init$1 = function() {
		var s;
		s = $clone(new syncSema.ptr(), syncSema);
		runtime_Syncsemcheck(12);
	};
	ptrType.methods = [{prop: "Get", name: "Get", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Put", name: "Put", pkg: "", type: $funcType([$emptyInterface], [], false)}, {prop: "getSlow", name: "getSlow", pkg: "sync", type: $funcType([], [$emptyInterface], false)}, {prop: "pin", name: "pin", pkg: "sync", type: $funcType([], [ptrType$5], false)}, {prop: "pinSlow", name: "pinSlow", pkg: "sync", type: $funcType([], [ptrType$5], false)}];
	ptrType$10.methods = [{prop: "Lock", name: "Lock", pkg: "", type: $funcType([], [], false)}, {prop: "Unlock", name: "Unlock", pkg: "", type: $funcType([], [], false)}];
	ptrType$5.methods = [{prop: "Lock", name: "Lock", pkg: "", type: $funcType([], [], false)}, {prop: "Unlock", name: "Unlock", pkg: "", type: $funcType([], [], false)}];
	Pool.init([{prop: "local", name: "local", pkg: "sync", type: $UnsafePointer, tag: ""}, {prop: "localSize", name: "localSize", pkg: "sync", type: $Uintptr, tag: ""}, {prop: "store", name: "store", pkg: "sync", type: sliceType$2, tag: ""}, {prop: "New", name: "New", pkg: "", type: funcType, tag: ""}]);
	Mutex.init([{prop: "state", name: "state", pkg: "sync", type: $Int32, tag: ""}, {prop: "sema", name: "sema", pkg: "sync", type: $Uint32, tag: ""}]);
	poolLocal.init([{prop: "private$0", name: "private", pkg: "sync", type: $emptyInterface, tag: ""}, {prop: "shared", name: "shared", pkg: "sync", type: sliceType$2, tag: ""}, {prop: "Mutex", name: "", pkg: "", type: Mutex, tag: ""}, {prop: "pad", name: "pad", pkg: "sync", type: arrayType, tag: ""}]);
	syncSema.init([{prop: "lock", name: "lock", pkg: "sync", type: $Uintptr, tag: ""}, {prop: "head", name: "head", pkg: "sync", type: $UnsafePointer, tag: ""}, {prop: "tail", name: "tail", pkg: "sync", type: $UnsafePointer, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_sync = function() { while (true) { switch ($s) { case 0:
		$r = runtime.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = atomic.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		allPools = sliceType.nil;
		init();
		init$1();
		/* */ } return; } }; $init_sync.$blocking = true; return $init_sync;
	};
	return $pkg;
})();
$packages["io"] = (function() {
	var $pkg = {}, errors, runtime, sync, errWhence, errOffset;
	errors = $packages["errors"];
	runtime = $packages["runtime"];
	sync = $packages["sync"];
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_io = function() { while (true) { switch ($s) { case 0:
		$r = errors.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = runtime.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		$r = sync.$init($BLOCKING); /* */ $s = 3; case 3: if ($r && $r.$blocking) { $r = $r(); }
		$pkg.ErrShortWrite = errors.New("short write");
		$pkg.ErrShortBuffer = errors.New("short buffer");
		$pkg.EOF = errors.New("EOF");
		$pkg.ErrUnexpectedEOF = errors.New("unexpected EOF");
		$pkg.ErrNoProgress = errors.New("multiple Read calls return no data or error");
		errWhence = errors.New("Seek: invalid whence");
		errOffset = errors.New("Seek: invalid offset");
		$pkg.ErrClosedPipe = errors.New("io: read/write on closed pipe");
		/* */ } return; } }; $init_io.$blocking = true; return $init_io;
	};
	return $pkg;
})();
$packages["unicode"] = (function() {
	var $pkg = {};
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_unicode = function() { while (true) { switch ($s) { case 0:
		/* */ } return; } }; $init_unicode.$blocking = true; return $init_unicode;
	};
	return $pkg;
})();
$packages["strings"] = (function() {
	var $pkg = {}, errors, js, io, unicode, utf8, sliceType, IndexByte, Join;
	errors = $packages["errors"];
	js = $packages["github.com/gopherjs/gopherjs/js"];
	io = $packages["io"];
	unicode = $packages["unicode"];
	utf8 = $packages["unicode/utf8"];
		sliceType = $sliceType($Uint8);
	IndexByte = $pkg.IndexByte = function(s, c) {
		return $parseInt(s.indexOf($global.String.fromCharCode(c))) >> 0;
	};
	Join = $pkg.Join = function(a, sep) {
		var _i, _ref, b, bp, i, n, s;
		if (a.$length === 0) {
			return "";
		}
		if (a.$length === 1) {
			return ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]);
		}
		n = sep.length * ((a.$length - 1 >> 0)) >> 0;
		i = 0;
		while (i < a.$length) {
			n = n + (((i < 0 || i >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + i]).length) >> 0;
			i = i + (1) >> 0;
		}
		b = sliceType.make(n);
		bp = $copyString(b, ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]));
		_ref = $subslice(a, 1);
		_i = 0;
		while (_i < _ref.$length) {
			s = ((_i < 0 || _i >= _ref.$length) ? $throwRuntimeError("index out of range") : _ref.$array[_ref.$offset + _i]);
			bp = bp + ($copyString($subslice(b, bp), sep)) >> 0;
			bp = bp + ($copyString($subslice(b, bp), s)) >> 0;
			_i++;
		}
		return $bytesToString(b);
	};
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_strings = function() { while (true) { switch ($s) { case 0:
		$r = errors.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = js.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		$r = io.$init($BLOCKING); /* */ $s = 3; case 3: if ($r && $r.$blocking) { $r = $r(); }
		$r = unicode.$init($BLOCKING); /* */ $s = 4; case 4: if ($r && $r.$blocking) { $r = $r(); }
		$r = utf8.$init($BLOCKING); /* */ $s = 5; case 5: if ($r && $r.$blocking) { $r = $r(); }
		/* */ } return; } }; $init_strings.$blocking = true; return $init_strings;
	};
	return $pkg;
})();
$packages["github.com/gopherjs/gopherjs/nosync"] = (function() {
	var $pkg = {}, Once, funcType, ptrType$3;
	Once = $pkg.Once = $newType(0, $kindStruct, "nosync.Once", "Once", "github.com/gopherjs/gopherjs/nosync", function(doing_, done_) {
		this.$val = this;
		this.doing = doing_ !== undefined ? doing_ : false;
		this.done = done_ !== undefined ? done_ : false;
	});
		funcType = $funcType([], [], false);
		ptrType$3 = $ptrType(Once);
	Once.ptr.prototype.Do = function(f) {
		var $deferred = [], $err = null, o;
		/* */ try { $deferFrames.push($deferred);
		o = this;
		if (o.done) {
			return;
		}
		if (o.doing) {
			$panic(new $String("nosync: Do called within f"));
		}
		o.doing = true;
		$deferred.push([(function() {
			o.doing = false;
			o.done = true;
		}), []]);
		f();
		/* */ } catch(err) { $err = err; } finally { $deferFrames.pop(); $callDeferred($deferred, $err); }
	};
	Once.prototype.Do = function(f) { return this.$val.Do(f); };
	ptrType$3.methods = [{prop: "Do", name: "Do", pkg: "", type: $funcType([funcType], [], false)}];
	Once.init([{prop: "doing", name: "doing", pkg: "github.com/gopherjs/gopherjs/nosync", type: $Bool, tag: ""}, {prop: "done", name: "done", pkg: "github.com/gopherjs/gopherjs/nosync", type: $Bool, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_nosync = function() { while (true) { switch ($s) { case 0:
		/* */ } return; } }; $init_nosync.$blocking = true; return $init_nosync;
	};
	return $pkg;
})();
$packages["bytes"] = (function() {
	var $pkg = {}, errors, io, unicode, utf8;
	errors = $packages["errors"];
	io = $packages["io"];
	unicode = $packages["unicode"];
	utf8 = $packages["unicode/utf8"];
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_bytes = function() { while (true) { switch ($s) { case 0:
		$r = errors.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = io.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		$r = unicode.$init($BLOCKING); /* */ $s = 3; case 3: if ($r && $r.$blocking) { $r = $r(); }
		$r = utf8.$init($BLOCKING); /* */ $s = 4; case 4: if ($r && $r.$blocking) { $r = $r(); }
		$pkg.ErrTooLarge = errors.New("bytes.Buffer: too large");
		/* */ } return; } }; $init_bytes.$blocking = true; return $init_bytes;
	};
	return $pkg;
})();
$packages["unicode/utf16"] = (function() {
	var $pkg = {}, sliceType$1, DecodeRune, Decode;
		sliceType$1 = $sliceType($Int32);
	DecodeRune = $pkg.DecodeRune = function(r1, r2) {
		if (55296 <= r1 && r1 < 56320 && 56320 <= r2 && r2 < 57344) {
			return ((((r1 - 55296 >> 0)) << 10 >> 0) | ((r2 - 56320 >> 0))) + 65536 >> 0;
		}
		return 65533;
	};
	Decode = $pkg.Decode = function(s) {
		var a, i, n, r, x, x$1, x$2;
		a = sliceType$1.make(s.$length);
		n = 0;
		i = 0;
		while (i < s.$length) {
			r = ((i < 0 || i >= s.$length) ? $throwRuntimeError("index out of range") : s.$array[s.$offset + i]);
			if (55296 <= r && r < 56320 && (i + 1 >> 0) < s.$length && 56320 <= (x = i + 1 >> 0, ((x < 0 || x >= s.$length) ? $throwRuntimeError("index out of range") : s.$array[s.$offset + x])) && (x$1 = i + 1 >> 0, ((x$1 < 0 || x$1 >= s.$length) ? $throwRuntimeError("index out of range") : s.$array[s.$offset + x$1])) < 57344) {
				(n < 0 || n >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + n] = DecodeRune((r >> 0), ((x$2 = i + 1 >> 0, ((x$2 < 0 || x$2 >= s.$length) ? $throwRuntimeError("index out of range") : s.$array[s.$offset + x$2])) >> 0));
				i = i + (1) >> 0;
				n = n + (1) >> 0;
			} else if (55296 <= r && r < 57344) {
				(n < 0 || n >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + n] = 65533;
				n = n + (1) >> 0;
			} else {
				(n < 0 || n >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + n] = (r >> 0);
				n = n + (1) >> 0;
			}
			i = i + (1) >> 0;
		}
		return $subslice(a, 0, n);
	};
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_utf16 = function() { while (true) { switch ($s) { case 0:
		/* */ } return; } }; $init_utf16.$blocking = true; return $init_utf16;
	};
	return $pkg;
})();
$packages["syscall"] = (function() {
	var $pkg = {}, bytes, errors, js, sync, atomic, utf16, DLLError, DLL, Proc, LazyDLL, LazyProc, Handle, Errno, sliceType, ptrType, ptrType$3, ptrType$4, ptrType$5, sliceType$2, ptrType$15, arrayType$2, ptrType$28, sliceType$7, ptrType$29, ptrType$30, warningPrinted, lineBuffer, minusOne, errors$1, modkernel32, modadvapi32, modshell32, modmswsock, modcrypt32, modws2_32, moddnsapi, modiphlpapi, modsecur32, modnetapi32, moduserenv, procGetLastError, procLoadLibraryW, procFreeLibrary, procGetProcAddress, procGetVersion, procFormatMessageW, procExitProcess, procCreateFileW, procReadFile, procWriteFile, procSetFilePointer, procCloseHandle, procGetStdHandle, procFindFirstFileW, procFindNextFileW, procFindClose, procGetFileInformationByHandle, procGetCurrentDirectoryW, procSetCurrentDirectoryW, procCreateDirectoryW, procRemoveDirectoryW, procDeleteFileW, procMoveFileW, procGetComputerNameW, procSetEndOfFile, procGetSystemTimeAsFileTime, procGetTimeZoneInformation, procCreateIoCompletionPort, procGetQueuedCompletionStatus, procPostQueuedCompletionStatus, procCancelIo, procCancelIoEx, procCreateProcessW, procOpenProcess, procTerminateProcess, procGetExitCodeProcess, procGetStartupInfoW, procGetCurrentProcess, procGetProcessTimes, procDuplicateHandle, procWaitForSingleObject, procGetTempPathW, procCreatePipe, procGetFileType, procCryptAcquireContextW, procCryptReleaseContext, procCryptGenRandom, procGetEnvironmentStringsW, procFreeEnvironmentStringsW, procGetEnvironmentVariableW, procSetEnvironmentVariableW, procSetFileTime, procGetFileAttributesW, procSetFileAttributesW, procGetFileAttributesExW, procGetCommandLineW, procCommandLineToArgvW, procLocalFree, procSetHandleInformation, procFlushFileBuffers, procGetFullPathNameW, procGetLongPathNameW, procGetShortPathNameW, procCreateFileMappingW, procMapViewOfFile, procUnmapViewOfFile, procFlushViewOfFile, procVirtualLock, procVirtualUnlock, procTransmitFile, procReadDirectoryChangesW, procCertOpenSystemStoreW, procCertOpenStore, procCertEnumCertificatesInStore, procCertAddCertificateContextToStore, procCertCloseStore, procCertGetCertificateChain, procCertFreeCertificateChain, procCertCreateCertificateContext, procCertFreeCertificateContext, procCertVerifyCertificateChainPolicy, procRegOpenKeyExW, procRegCloseKey, procRegQueryInfoKeyW, procRegEnumKeyExW, procRegQueryValueExW, procGetCurrentProcessId, procGetConsoleMode, procWriteConsoleW, procReadConsoleW, procCreateToolhelp32Snapshot, procProcess32FirstW, procProcess32NextW, procDeviceIoControl, procCreateSymbolicLinkW, procCreateHardLinkW, procWSAStartup, procWSACleanup, procWSAIoctl, procsocket, procsetsockopt, procgetsockopt, procbind, procconnect, procgetsockname, procgetpeername, proclisten, procshutdown, procclosesocket, procAcceptEx, procGetAcceptExSockaddrs, procWSARecv, procWSASend, procWSARecvFrom, procWSASendTo, procgethostbyname, procgetservbyname, procntohs, procgetprotobyname, procDnsQuery_W, procDnsRecordListFree, procDnsNameCompare_W, procGetAddrInfoW, procFreeAddrInfoW, procGetIfEntry, procGetAdaptersInfo, procSetFileCompletionNotificationModes, procWSAEnumProtocolsW, procTranslateNameW, procGetUserNameExW, procNetUserGetInfo, procNetGetJoinInformation, procNetApiBufferFree, procLookupAccountSidW, procLookupAccountNameW, procConvertSidToStringSidW, procConvertStringSidToSidW, procGetLengthSid, procCopySid, procOpenProcessToken, procGetTokenInformation, procGetUserProfileDirectoryW, init, printWarning, use, Syscall, Syscall6, Syscall9, Syscall12, Syscall15, getprocaddress, getStdHandle, Getenv, NewLazyDLL, itoa, uitoa, ByteSliceFromString, BytePtrFromString, langid, FreeLibrary, FormatMessage;
	bytes = $packages["bytes"];
	errors = $packages["errors"];
	js = $packages["github.com/gopherjs/gopherjs/js"];
	sync = $packages["sync"];
	atomic = $packages["sync/atomic"];
	utf16 = $packages["unicode/utf16"];
	DLLError = $pkg.DLLError = $newType(0, $kindStruct, "syscall.DLLError", "DLLError", "syscall", function(Err_, ObjName_, Msg_) {
		this.$val = this;
		this.Err = Err_ !== undefined ? Err_ : $ifaceNil;
		this.ObjName = ObjName_ !== undefined ? ObjName_ : "";
		this.Msg = Msg_ !== undefined ? Msg_ : "";
	});
	DLL = $pkg.DLL = $newType(0, $kindStruct, "syscall.DLL", "DLL", "syscall", function(Name_, Handle_) {
		this.$val = this;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.Handle = Handle_ !== undefined ? Handle_ : 0;
	});
	Proc = $pkg.Proc = $newType(0, $kindStruct, "syscall.Proc", "Proc", "syscall", function(Dll_, Name_, addr_) {
		this.$val = this;
		this.Dll = Dll_ !== undefined ? Dll_ : ptrType$3.nil;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.addr = addr_ !== undefined ? addr_ : 0;
	});
	LazyDLL = $pkg.LazyDLL = $newType(0, $kindStruct, "syscall.LazyDLL", "LazyDLL", "syscall", function(mu_, dll_, Name_) {
		this.$val = this;
		this.mu = mu_ !== undefined ? mu_ : new sync.Mutex.ptr();
		this.dll = dll_ !== undefined ? dll_ : ptrType$3.nil;
		this.Name = Name_ !== undefined ? Name_ : "";
	});
	LazyProc = $pkg.LazyProc = $newType(0, $kindStruct, "syscall.LazyProc", "LazyProc", "syscall", function(mu_, Name_, l_, proc_) {
		this.$val = this;
		this.mu = mu_ !== undefined ? mu_ : new sync.Mutex.ptr();
		this.Name = Name_ !== undefined ? Name_ : "";
		this.l = l_ !== undefined ? l_ : ptrType$5.nil;
		this.proc = proc_ !== undefined ? proc_ : ptrType$4.nil;
	});
	Handle = $pkg.Handle = $newType(4, $kindUintptr, "syscall.Handle", "Handle", "syscall", null);
	Errno = $pkg.Errno = $newType(4, $kindUintptr, "syscall.Errno", "Errno", "syscall", null);
		sliceType = $sliceType($Uint8);
		ptrType = $ptrType($Uint16);
		ptrType$3 = $ptrType(DLL);
		ptrType$4 = $ptrType(Proc);
		ptrType$5 = $ptrType(LazyDLL);
		sliceType$2 = $sliceType($Uint16);
		ptrType$15 = $ptrType($Uint8);
		arrayType$2 = $arrayType($Uint8, 32);
		ptrType$28 = $ptrType(DLLError);
		sliceType$7 = $sliceType($Uintptr);
		ptrType$29 = $ptrType(LazyProc);
		ptrType$30 = $ptrType(Errno);
	init = function() {
		$flushConsole = (function() {
			if (!((lineBuffer.$length === 0))) {
				$global.console.log($externalize($bytesToString(lineBuffer), $String));
				lineBuffer = sliceType.nil;
			}
		});
	};
	printWarning = function() {
		if (!warningPrinted) {
			console.log("warning: system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md");
		}
		warningPrinted = true;
	};
	use = function(p) {
	};
	Syscall = $pkg.Syscall = function(trap, nargs, a1, a2, a3) {
		var _tmp, _tmp$1, _tmp$2, err = 0, r1 = 0, r2 = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall6 = $pkg.Syscall6 = function(trap, nargs, a1, a2, a3, a4, a5, a6) {
		var _tmp, _tmp$1, _tmp$2, err = 0, r1 = 0, r2 = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall9 = $pkg.Syscall9 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
		var _tmp, _tmp$1, _tmp$2, err = 0, r1 = 0, r2 = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall12 = $pkg.Syscall12 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12) {
		var _tmp, _tmp$1, _tmp$2, err = 0, r1 = 0, r2 = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	Syscall15 = $pkg.Syscall15 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15) {
		var _tmp, _tmp$1, _tmp$2, err = 0, r1 = 0, r2 = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 0; _tmp$2 = 536870913; r1 = _tmp; r2 = _tmp$1; err = _tmp$2;
		return [r1, r2, err];
	};
	getprocaddress = function(handle, procname) {
		var _tmp, _tmp$1, err = 0, proc = 0;
		printWarning();
		_tmp = (minusOne >>> 0); _tmp$1 = 536870913; proc = _tmp; err = _tmp$1;
		return [proc, err];
	};
	LazyDLL.ptr.prototype.Load = function() {
		var d;
		d = this;
		return new DLLError.ptr($ifaceNil, "", "system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md");
	};
	LazyDLL.prototype.Load = function() { return this.$val.Load(); };
	LazyProc.ptr.prototype.Find = function() {
		var p;
		p = this;
		return new DLLError.ptr($ifaceNil, "", "system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md");
	};
	LazyProc.prototype.Find = function() { return this.$val.Find(); };
	getStdHandle = function(h) {
		var fd = 0;
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
	Getenv = $pkg.Getenv = function(key) {
		var _tmp, _tmp$1, found = false, value = "";
		_tmp = ""; _tmp$1 = false; value = _tmp; found = _tmp$1;
		return [value, found];
	};
	DLLError.ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.Msg;
	};
	DLLError.prototype.Error = function() { return this.$val.Error(); };
	DLL.ptr.prototype.FindProc = function(name) {
		var _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tuple, _tuple$1, a, d, e, err = $ifaceNil, namep, p, proc = ptrType$4.nil;
		d = this;
		_tuple = BytePtrFromString(name); namep = _tuple[0]; err = _tuple[1];
		if (!($interfaceIsEqual(err, $ifaceNil))) {
			_tmp = ptrType$4.nil; _tmp$1 = err; proc = _tmp; err = _tmp$1;
			return [proc, err];
		}
		_tuple$1 = getprocaddress((d.Handle >>> 0), namep); a = _tuple$1[0]; e = _tuple$1[1];
		use(namep);
		if (!((e === 0))) {
			_tmp$2 = ptrType$4.nil; _tmp$3 = new DLLError.ptr(new Errno(e), name, "Failed to find " + name + " procedure in " + d.Name + ": " + new Errno(e).Error()); proc = _tmp$2; err = _tmp$3;
			return [proc, err];
		}
		p = new Proc.ptr(d, name, a);
		_tmp$4 = p; _tmp$5 = $ifaceNil; proc = _tmp$4; err = _tmp$5;
		return [proc, err];
	};
	DLL.prototype.FindProc = function(name) { return this.$val.FindProc(name); };
	DLL.ptr.prototype.MustFindProc = function(name) {
		var _tuple, d, e, p;
		d = this;
		_tuple = d.FindProc(name); p = _tuple[0]; e = _tuple[1];
		if (!($interfaceIsEqual(e, $ifaceNil))) {
			$panic(e);
		}
		return p;
	};
	DLL.prototype.MustFindProc = function(name) { return this.$val.MustFindProc(name); };
	DLL.ptr.prototype.Release = function() {
		var d, err = $ifaceNil;
		d = this;
		err = FreeLibrary(d.Handle);
		return err;
	};
	DLL.prototype.Release = function() { return this.$val.Release(); };
	Proc.ptr.prototype.Addr = function() {
		var p;
		p = this;
		return p.addr;
	};
	Proc.prototype.Addr = function() { return this.$val.Addr(); };
	Proc.ptr.prototype.Call = function(a) {
		var _ref, _tuple, _tuple$1, _tuple$10, _tuple$11, _tuple$12, _tuple$13, _tuple$14, _tuple$15, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8, _tuple$9, lastErr = $ifaceNil, p, r1 = 0, r2 = 0;
		p = this;
		_ref = a.$length;
		if (_ref === 0) {
			_tuple = Syscall(p.Addr(), (a.$length >>> 0), 0, 0, 0); r1 = _tuple[0]; r2 = _tuple[1]; lastErr = new Errno(_tuple[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 1) {
			_tuple$1 = Syscall(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), 0, 0); r1 = _tuple$1[0]; r2 = _tuple$1[1]; lastErr = new Errno(_tuple$1[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 2) {
			_tuple$2 = Syscall(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), 0); r1 = _tuple$2[0]; r2 = _tuple$2[1]; lastErr = new Errno(_tuple$2[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 3) {
			_tuple$3 = Syscall(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2])); r1 = _tuple$3[0]; r2 = _tuple$3[1]; lastErr = new Errno(_tuple$3[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 4) {
			_tuple$4 = Syscall6(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), 0, 0); r1 = _tuple$4[0]; r2 = _tuple$4[1]; lastErr = new Errno(_tuple$4[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 5) {
			_tuple$5 = Syscall6(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), 0); r1 = _tuple$5[0]; r2 = _tuple$5[1]; lastErr = new Errno(_tuple$5[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 6) {
			_tuple$6 = Syscall6(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5])); r1 = _tuple$6[0]; r2 = _tuple$6[1]; lastErr = new Errno(_tuple$6[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 7) {
			_tuple$7 = Syscall9(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), 0, 0); r1 = _tuple$7[0]; r2 = _tuple$7[1]; lastErr = new Errno(_tuple$7[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 8) {
			_tuple$8 = Syscall9(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), 0); r1 = _tuple$8[0]; r2 = _tuple$8[1]; lastErr = new Errno(_tuple$8[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 9) {
			_tuple$9 = Syscall9(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), ((8 < 0 || 8 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 8])); r1 = _tuple$9[0]; r2 = _tuple$9[1]; lastErr = new Errno(_tuple$9[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 10) {
			_tuple$10 = Syscall12(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), ((8 < 0 || 8 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 8]), ((9 < 0 || 9 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 9]), 0, 0); r1 = _tuple$10[0]; r2 = _tuple$10[1]; lastErr = new Errno(_tuple$10[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 11) {
			_tuple$11 = Syscall12(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), ((8 < 0 || 8 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 8]), ((9 < 0 || 9 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 9]), ((10 < 0 || 10 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 10]), 0); r1 = _tuple$11[0]; r2 = _tuple$11[1]; lastErr = new Errno(_tuple$11[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 12) {
			_tuple$12 = Syscall12(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), ((8 < 0 || 8 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 8]), ((9 < 0 || 9 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 9]), ((10 < 0 || 10 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 10]), ((11 < 0 || 11 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 11])); r1 = _tuple$12[0]; r2 = _tuple$12[1]; lastErr = new Errno(_tuple$12[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 13) {
			_tuple$13 = Syscall15(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), ((8 < 0 || 8 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 8]), ((9 < 0 || 9 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 9]), ((10 < 0 || 10 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 10]), ((11 < 0 || 11 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 11]), ((12 < 0 || 12 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 12]), 0, 0); r1 = _tuple$13[0]; r2 = _tuple$13[1]; lastErr = new Errno(_tuple$13[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 14) {
			_tuple$14 = Syscall15(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), ((8 < 0 || 8 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 8]), ((9 < 0 || 9 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 9]), ((10 < 0 || 10 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 10]), ((11 < 0 || 11 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 11]), ((12 < 0 || 12 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 12]), ((13 < 0 || 13 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 13]), 0); r1 = _tuple$14[0]; r2 = _tuple$14[1]; lastErr = new Errno(_tuple$14[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 15) {
			_tuple$15 = Syscall15(p.Addr(), (a.$length >>> 0), ((0 < 0 || 0 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 0]), ((1 < 0 || 1 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 1]), ((2 < 0 || 2 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 2]), ((3 < 0 || 3 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 3]), ((4 < 0 || 4 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 4]), ((5 < 0 || 5 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 5]), ((6 < 0 || 6 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 6]), ((7 < 0 || 7 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 7]), ((8 < 0 || 8 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 8]), ((9 < 0 || 9 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 9]), ((10 < 0 || 10 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 10]), ((11 < 0 || 11 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 11]), ((12 < 0 || 12 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 12]), ((13 < 0 || 13 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 13]), ((14 < 0 || 14 >= a.$length) ? $throwRuntimeError("index out of range") : a.$array[a.$offset + 14])); r1 = _tuple$15[0]; r2 = _tuple$15[1]; lastErr = new Errno(_tuple$15[2]);
			return [r1, r2, lastErr];
		} else {
			$panic(new $String("Call " + p.Name + " with too many arguments " + itoa(a.$length) + "."));
		}
		return [r1, r2, lastErr];
	};
	Proc.prototype.Call = function(a) { return this.$val.Call(a); };
	LazyDLL.ptr.prototype.mustLoad = function() {
		var d, e;
		d = this;
		e = d.Load();
		if (!($interfaceIsEqual(e, $ifaceNil))) {
			$panic(e);
		}
	};
	LazyDLL.prototype.mustLoad = function() { return this.$val.mustLoad(); };
	LazyDLL.ptr.prototype.Handle = function() {
		var d;
		d = this;
		d.mustLoad();
		return (d.dll.Handle >>> 0);
	};
	LazyDLL.prototype.Handle = function() { return this.$val.Handle(); };
	LazyDLL.ptr.prototype.NewProc = function(name) {
		var d;
		d = this;
		return new LazyProc.ptr(new sync.Mutex.ptr(), name, d, ptrType$4.nil);
	};
	LazyDLL.prototype.NewProc = function(name) { return this.$val.NewProc(name); };
	NewLazyDLL = $pkg.NewLazyDLL = function(name) {
		return new LazyDLL.ptr(new sync.Mutex.ptr(), ptrType$3.nil, name);
	};
	LazyProc.ptr.prototype.mustFind = function() {
		var e, p;
		p = this;
		e = p.Find();
		if (!($interfaceIsEqual(e, $ifaceNil))) {
			$panic(e);
		}
	};
	LazyProc.prototype.mustFind = function() { return this.$val.mustFind(); };
	LazyProc.ptr.prototype.Addr = function() {
		var p;
		p = this;
		p.mustFind();
		return p.proc.Addr();
	};
	LazyProc.prototype.Addr = function() { return this.$val.Addr(); };
	LazyProc.ptr.prototype.Call = function(a) {
		var _tuple, lastErr = $ifaceNil, p, r1 = 0, r2 = 0;
		p = this;
		p.mustFind();
		_tuple = p.proc.Call(a); r1 = _tuple[0]; r2 = _tuple[1]; lastErr = _tuple[2];
		return [r1, r2, lastErr];
	};
	LazyProc.prototype.Call = function(a) { return this.$val.Call(a); };
	itoa = function(val) {
		if (val < 0) {
			return "-" + uitoa((-val >>> 0));
		}
		return uitoa((val >>> 0));
	};
	uitoa = function(val) {
		var _q, _r, buf, i;
		buf = $clone(arrayType$2.zero(), arrayType$2);
		i = 31;
		while (val >= 10) {
			(i < 0 || i >= buf.length) ? $throwRuntimeError("index out of range") : buf[i] = (((_r = val % 10, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) + 48 >>> 0) << 24 >>> 24);
			i = i - (1) >> 0;
			val = (_q = val / (10), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : $throwRuntimeError("integer divide by zero"));
		}
		(i < 0 || i >= buf.length) ? $throwRuntimeError("index out of range") : buf[i] = ((val + 48 >>> 0) << 24 >>> 24);
		return $bytesToString($subslice(new sliceType(buf), i));
	};
	ByteSliceFromString = $pkg.ByteSliceFromString = function(s) {
		var a, i;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === 0) {
				return [sliceType.nil, new Errno(536870951)];
			}
			i = i + (1) >> 0;
		}
		a = sliceType.make((s.length + 1 >> 0));
		$copyString(a, s);
		return [a, $ifaceNil];
	};
	BytePtrFromString = $pkg.BytePtrFromString = function(s) {
		var _tuple, a, err;
		_tuple = ByteSliceFromString(s); a = _tuple[0]; err = _tuple[1];
		if (!($interfaceIsEqual(err, $ifaceNil))) {
			return [ptrType$15.nil, err];
		}
		return [new ptrType$15(function() { return ((0 < 0 || 0 >= this.$target.$length) ? $throwRuntimeError("index out of range") : this.$target.$array[this.$target.$offset + 0]); }, function($v) { (0 < 0 || 0 >= this.$target.$length) ? $throwRuntimeError("index out of range") : this.$target.$array[this.$target.$offset + 0] = $v; }, a), $ifaceNil];
	};
	langid = function(pri, sub) {
		return (((sub >>> 0) << 10 >>> 0) | (pri >>> 0)) >>> 0;
	};
	Errno.prototype.Error = function() {
		var _tuple, _tuple$1, b, e, err, flags, idx, n, x, x$1;
		e = this.$val;
		idx = ((e - 536870912 >>> 0) >> 0);
		if (0 <= idx && idx < 131) {
			return ((idx < 0 || idx >= errors$1.length) ? $throwRuntimeError("index out of range") : errors$1[idx]);
		}
		flags = 12800;
		b = sliceType$2.make(300);
		_tuple = FormatMessage(flags, 0, (e >>> 0), langid(9, 1), b, ptrType$15.nil); n = _tuple[0]; err = _tuple[1];
		if (!($interfaceIsEqual(err, $ifaceNil))) {
			_tuple$1 = FormatMessage(flags, 0, (e >>> 0), 0, b, ptrType$15.nil); n = _tuple$1[0]; err = _tuple$1[1];
			if (!($interfaceIsEqual(err, $ifaceNil))) {
				return "winapi error #" + itoa((e >> 0));
			}
		}
		while (n > 0 && (((x = n - 1 >>> 0, ((x < 0 || x >= b.$length) ? $throwRuntimeError("index out of range") : b.$array[b.$offset + x])) === 10) || ((x$1 = n - 1 >>> 0, ((x$1 < 0 || x$1 >= b.$length) ? $throwRuntimeError("index out of range") : b.$array[b.$offset + x$1])) === 13))) {
			n = n - (1) >>> 0;
		}
		return $runesToString(utf16.Decode($subslice(b, 0, n)));
	};
	$ptrType(Errno).prototype.Error = function() { return new Errno(this.$get()).Error(); };
	Errno.prototype.Temporary = function() {
		var e;
		e = this.$val;
		return (e === 536870950) || (e === 536870971) || new Errno(e).Timeout();
	};
	$ptrType(Errno).prototype.Temporary = function() { return new Errno(this.$get()).Temporary(); };
	Errno.prototype.Timeout = function() {
		var e;
		e = this.$val;
		return (e === 536870918) || (e === 536871039) || (e === 536871033);
	};
	$ptrType(Errno).prototype.Timeout = function() { return new Errno(this.$get()).Timeout(); };
	FreeLibrary = $pkg.FreeLibrary = function(handle) {
		var _tuple, e1, err = $ifaceNil, r1;
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
	FormatMessage = $pkg.FormatMessage = function(flags, msgsrc, msgid, langid$1, buf, args) {
		var _p0, _tuple, e1, err = $ifaceNil, n = 0, r0;
		_p0 = ptrType.nil;
		if (buf.$length > 0) {
			_p0 = new ptrType(function() { return ((0 < 0 || 0 >= this.$target.$length) ? $throwRuntimeError("index out of range") : this.$target.$array[this.$target.$offset + 0]); }, function($v) { (0 < 0 || 0 >= this.$target.$length) ? $throwRuntimeError("index out of range") : this.$target.$array[this.$target.$offset + 0] = $v; }, buf);
		}
		_tuple = Syscall9(procFormatMessageW.Addr(), 7, (flags >>> 0), (msgsrc >>> 0), (msgid >>> 0), (langid$1 >>> 0), _p0, (buf.$length >>> 0), args, 0, 0); r0 = _tuple[0]; e1 = _tuple[2];
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
	ptrType$28.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}];
	ptrType$3.methods = [{prop: "FindProc", name: "FindProc", pkg: "", type: $funcType([$String], [ptrType$4, $error], false)}, {prop: "MustFindProc", name: "MustFindProc", pkg: "", type: $funcType([$String], [ptrType$4], false)}, {prop: "Release", name: "Release", pkg: "", type: $funcType([], [$error], false)}];
	ptrType$4.methods = [{prop: "Addr", name: "Addr", pkg: "", type: $funcType([], [$Uintptr], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([sliceType$7], [$Uintptr, $Uintptr, $error], true)}];
	ptrType$5.methods = [{prop: "Handle", name: "Handle", pkg: "", type: $funcType([], [$Uintptr], false)}, {prop: "Load", name: "Load", pkg: "", type: $funcType([], [$error], false)}, {prop: "NewProc", name: "NewProc", pkg: "", type: $funcType([$String], [ptrType$29], false)}, {prop: "mustLoad", name: "mustLoad", pkg: "syscall", type: $funcType([], [], false)}];
	ptrType$29.methods = [{prop: "Addr", name: "Addr", pkg: "", type: $funcType([], [$Uintptr], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([sliceType$7], [$Uintptr, $Uintptr, $error], true)}, {prop: "Find", name: "Find", pkg: "", type: $funcType([], [$error], false)}, {prop: "mustFind", name: "mustFind", pkg: "syscall", type: $funcType([], [], false)}];
	Errno.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}, {prop: "Temporary", name: "Temporary", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Timeout", name: "Timeout", pkg: "", type: $funcType([], [$Bool], false)}];
	ptrType$30.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}, {prop: "Temporary", name: "Temporary", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Timeout", name: "Timeout", pkg: "", type: $funcType([], [$Bool], false)}];
	DLLError.init([{prop: "Err", name: "Err", pkg: "", type: $error, tag: ""}, {prop: "ObjName", name: "ObjName", pkg: "", type: $String, tag: ""}, {prop: "Msg", name: "Msg", pkg: "", type: $String, tag: ""}]);
	DLL.init([{prop: "Name", name: "Name", pkg: "", type: $String, tag: ""}, {prop: "Handle", name: "Handle", pkg: "", type: Handle, tag: ""}]);
	Proc.init([{prop: "Dll", name: "Dll", pkg: "", type: ptrType$3, tag: ""}, {prop: "Name", name: "Name", pkg: "", type: $String, tag: ""}, {prop: "addr", name: "addr", pkg: "syscall", type: $Uintptr, tag: ""}]);
	LazyDLL.init([{prop: "mu", name: "mu", pkg: "syscall", type: sync.Mutex, tag: ""}, {prop: "dll", name: "dll", pkg: "syscall", type: ptrType$3, tag: ""}, {prop: "Name", name: "Name", pkg: "", type: $String, tag: ""}]);
	LazyProc.init([{prop: "mu", name: "mu", pkg: "syscall", type: sync.Mutex, tag: ""}, {prop: "Name", name: "Name", pkg: "", type: $String, tag: ""}, {prop: "l", name: "l", pkg: "syscall", type: ptrType$5, tag: ""}, {prop: "proc", name: "proc", pkg: "syscall", type: ptrType$4, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_syscall = function() { while (true) { switch ($s) { case 0:
		$r = bytes.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = errors.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		$r = js.$init($BLOCKING); /* */ $s = 3; case 3: if ($r && $r.$blocking) { $r = $r(); }
		$r = sync.$init($BLOCKING); /* */ $s = 4; case 4: if ($r && $r.$blocking) { $r = $r(); }
		$r = atomic.$init($BLOCKING); /* */ $s = 5; case 5: if ($r && $r.$blocking) { $r = $r(); }
		$r = utf16.$init($BLOCKING); /* */ $s = 6; case 6: if ($r && $r.$blocking) { $r = $r(); }
		lineBuffer = sliceType.nil;
		warningPrinted = false;
		minusOne = -1;
		errors$1 = $toNativeArray($kindString, ["argument list too long", "permission denied", "address already in use", "cannot assign requested address", "advertise error", "address family not supported by protocol", "resource temporarily unavailable", "operation already in progress", "invalid exchange", "bad file descriptor", "file descriptor in bad state", "bad message", "invalid request descriptor", "invalid request code", "invalid slot", "bad font file format", "device or resource busy", "operation canceled", "no child processes", "channel number out of range", "communication error on send", "software caused connection abort", "connection refused", "connection reset by peer", "resource deadlock avoided", "resource deadlock avoided", "destination address required", "numerical argument out of domain", "RFS specific error", "disk quota exceeded", "file exists", "bad address", "file too large", "host is down", "no route to host", "identifier removed", "invalid or incomplete multibyte or wide character", "operation now in progress", "interrupted system call", "invalid argument", "input/output error", "transport endpoint is already connected", "is a directory", "is a named type file", "key has expired", "key was rejected by service", "key has been revoked", "level 2 halted", "level 2 not synchronized", "level 3 halted", "level 3 reset", "can not access a needed shared library", "accessing a corrupted shared library", "cannot exec a shared library directly", "attempting to link in too many shared libraries", ".lib section in a.out corrupted", "link number out of range", "too many levels of symbolic links", "wrong medium type", "too many open files", "too many links", "message too long", "multihop attempted", "file name too long", "no XENIX semaphores available", "network is down", "network dropped connection on reset", "network is unreachable", "too many open files in system", "no anode", "no buffer space available", "no CSI structure available", "no data available", "no such device", "exec format error", "required key not available", "no locks available", "link has been severed", "no medium found", "cannot allocate memory", "no message of desired type", "machine is not on the network", "package not installed", "protocol not available", "no space left on device", "out of streams resources", "device not a stream", "function not implemented", "block device required", "transport endpoint is not connected", "directory not empty", "not a XENIX named type file", "state not recoverable", "socket operation on non-socket", "operation not supported", "inappropriate ioctl for device", "name not unique on network", "no such device or address", "operation not supported", "value too large for defined data type", "owner died", "operation not permitted", "protocol family not supported", "broken pipe", "protocol error", "protocol not supported", "protocol wrong type for socket", "numerical result out of range", "remote address changed", "object is remote", "remote I/O error", "interrupted system call should be restarted", "read-only file system", "cannot send after transport endpoint shutdown", "socket type not supported", "illegal seek", "no such process", "srmount error", "stale NFS file handle", "streams pipe error", "timer expired", "connection timed out", "too many references: cannot splice", "text file busy", "structure needs cleaning", "protocol driver not attached", "too many users", "resource temporarily unavailable", "invalid cross-device link", "exchange full", "not supported by windows"]);
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
		procCreateToolhelp32Snapshot = modkernel32.NewProc("CreateToolhelp32Snapshot");
		procProcess32FirstW = modkernel32.NewProc("Process32FirstW");
		procProcess32NextW = modkernel32.NewProc("Process32NextW");
		procDeviceIoControl = modkernel32.NewProc("DeviceIoControl");
		procCreateSymbolicLinkW = modkernel32.NewProc("CreateSymbolicLinkW");
		procCreateHardLinkW = modkernel32.NewProc("CreateHardLinkW");
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
		procDnsNameCompare_W = moddnsapi.NewProc("DnsNameCompare_W");
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
		$pkg.Stdin = getStdHandle(-10);
		$pkg.Stdout = getStdHandle(-11);
		$pkg.Stderr = getStdHandle(-12);
		init();
		/* */ } return; } }; $init_syscall.$blocking = true; return $init_syscall;
	};
	return $pkg;
})();
$packages["time"] = (function() {
	var $pkg = {}, errors, js, nosync, runtime, strings, syscall, ParseError, Time, Month, Weekday, Duration, Location, zone, zoneTrans, sliceType, sliceType$1, sliceType$2, ptrType, arrayType$1, sliceType$3, arrayType$2, arrayType$3, ptrType$1, ptrType$6, ptrType$9, ptrType$10, ptrType$11, ptrType$12, std0x, longDayNames, shortDayNames, shortMonthNames, longMonthNames, atoiError, errBad, errLeadingInt, months, days, daysBefore, utcLoc, localLoc, localOnce, zoneinfo, badData, _tuple, initLocal, runtimeNano, now, startsWithLowerCase, nextStdChunk, match, lookup, appendUint, atoi, formatNano, quote, isDigit, getnum, cutspace, skip, Parse, parse, parseTimeZone, parseGMT, parseNanoseconds, leadingInt, absWeekday, absClock, fmtFrac, fmtInt, absDate, Now, isLeap, norm, Date, div, FixedZone;
	errors = $packages["errors"];
	js = $packages["github.com/gopherjs/gopherjs/js"];
	nosync = $packages["github.com/gopherjs/gopherjs/nosync"];
	runtime = $packages["runtime"];
	strings = $packages["strings"];
	syscall = $packages["syscall"];
	ParseError = $pkg.ParseError = $newType(0, $kindStruct, "time.ParseError", "ParseError", "time", function(Layout_, Value_, LayoutElem_, ValueElem_, Message_) {
		this.$val = this;
		this.Layout = Layout_ !== undefined ? Layout_ : "";
		this.Value = Value_ !== undefined ? Value_ : "";
		this.LayoutElem = LayoutElem_ !== undefined ? LayoutElem_ : "";
		this.ValueElem = ValueElem_ !== undefined ? ValueElem_ : "";
		this.Message = Message_ !== undefined ? Message_ : "";
	});
	Time = $pkg.Time = $newType(0, $kindStruct, "time.Time", "Time", "time", function(sec_, nsec_, loc_) {
		this.$val = this;
		this.sec = sec_ !== undefined ? sec_ : new $Int64(0, 0);
		this.nsec = nsec_ !== undefined ? nsec_ : 0;
		this.loc = loc_ !== undefined ? loc_ : ptrType$1.nil;
	});
	Month = $pkg.Month = $newType(4, $kindInt, "time.Month", "Month", "time", null);
	Weekday = $pkg.Weekday = $newType(4, $kindInt, "time.Weekday", "Weekday", "time", null);
	Duration = $pkg.Duration = $newType(8, $kindInt64, "time.Duration", "Duration", "time", null);
	Location = $pkg.Location = $newType(0, $kindStruct, "time.Location", "Location", "time", function(name_, zone_, tx_, cacheStart_, cacheEnd_, cacheZone_) {
		this.$val = this;
		this.name = name_ !== undefined ? name_ : "";
		this.zone = zone_ !== undefined ? zone_ : sliceType$1.nil;
		this.tx = tx_ !== undefined ? tx_ : sliceType$2.nil;
		this.cacheStart = cacheStart_ !== undefined ? cacheStart_ : new $Int64(0, 0);
		this.cacheEnd = cacheEnd_ !== undefined ? cacheEnd_ : new $Int64(0, 0);
		this.cacheZone = cacheZone_ !== undefined ? cacheZone_ : ptrType.nil;
	});
	zone = $pkg.zone = $newType(0, $kindStruct, "time.zone", "zone", "time", function(name_, offset_, isDST_) {
		this.$val = this;
		this.name = name_ !== undefined ? name_ : "";
		this.offset = offset_ !== undefined ? offset_ : 0;
		this.isDST = isDST_ !== undefined ? isDST_ : false;
	});
	zoneTrans = $pkg.zoneTrans = $newType(0, $kindStruct, "time.zoneTrans", "zoneTrans", "time", function(when_, index_, isstd_, isutc_) {
		this.$val = this;
		this.when = when_ !== undefined ? when_ : new $Int64(0, 0);
		this.index = index_ !== undefined ? index_ : 0;
		this.isstd = isstd_ !== undefined ? isstd_ : false;
		this.isutc = isutc_ !== undefined ? isutc_ : false;
	});
		sliceType = $sliceType($String);
		sliceType$1 = $sliceType(zone);
		sliceType$2 = $sliceType(zoneTrans);
		ptrType = $ptrType(zone);
		arrayType$1 = $arrayType($Uint8, 32);
		sliceType$3 = $sliceType($Uint8);
		arrayType$2 = $arrayType($Uint8, 9);
		arrayType$3 = $arrayType($Uint8, 64);
		ptrType$1 = $ptrType(Location);
		ptrType$6 = $ptrType(ParseError);
		ptrType$9 = $ptrType(Time);
		ptrType$10 = $ptrType(Month);
		ptrType$11 = $ptrType(Weekday);
		ptrType$12 = $ptrType(Duration);
	initLocal = function() {
		var d, i, j, s;
		d = new ($global.Date)();
		s = $internalize(d, $String);
		i = strings.IndexByte(s, 40);
		j = strings.IndexByte(s, 41);
		if ((i === -1) || (j === -1)) {
			localLoc.name = "UTC";
			return;
		}
		localLoc.name = s.substring((i + 1 >> 0), j);
		localLoc.zone = new sliceType$1([new zone.ptr(localLoc.name, ($parseInt(d.getTimezoneOffset()) >> 0) * -60 >> 0, false)]);
	};
	runtimeNano = function() {
		return $mul64($internalize(new ($global.Date)().getTime(), $Int64), new $Int64(0, 1000000));
	};
	now = function() {
		var _tmp, _tmp$1, n, nsec = 0, sec = new $Int64(0, 0), x;
		n = runtimeNano();
		_tmp = $div64(n, new $Int64(0, 1000000000), false); _tmp$1 = ((x = $div64(n, new $Int64(0, 1000000000), true), x.$low + ((x.$high >> 31) * 4294967296)) >> 0); sec = _tmp; nsec = _tmp$1;
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
		var _ref, _tmp, _tmp$1, _tmp$10, _tmp$11, _tmp$12, _tmp$13, _tmp$14, _tmp$15, _tmp$16, _tmp$17, _tmp$18, _tmp$19, _tmp$2, _tmp$20, _tmp$21, _tmp$22, _tmp$23, _tmp$24, _tmp$25, _tmp$26, _tmp$27, _tmp$28, _tmp$29, _tmp$3, _tmp$30, _tmp$31, _tmp$32, _tmp$33, _tmp$34, _tmp$35, _tmp$36, _tmp$37, _tmp$38, _tmp$39, _tmp$4, _tmp$40, _tmp$41, _tmp$42, _tmp$43, _tmp$44, _tmp$45, _tmp$46, _tmp$47, _tmp$48, _tmp$49, _tmp$5, _tmp$50, _tmp$51, _tmp$52, _tmp$53, _tmp$54, _tmp$55, _tmp$56, _tmp$57, _tmp$58, _tmp$59, _tmp$6, _tmp$60, _tmp$61, _tmp$62, _tmp$63, _tmp$64, _tmp$65, _tmp$66, _tmp$67, _tmp$68, _tmp$69, _tmp$7, _tmp$70, _tmp$71, _tmp$72, _tmp$73, _tmp$74, _tmp$75, _tmp$76, _tmp$77, _tmp$78, _tmp$79, _tmp$8, _tmp$80, _tmp$9, c, ch, i, j, prefix = "", std = 0, std$1, suffix = "", x;
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
					_tmp$15 = layout.substring(0, i); _tmp$16 = (x = layout.charCodeAt((i + 1 >> 0)) - 49 << 24 >>> 24, ((x < 0 || x >= std0x.length) ? $throwRuntimeError("index out of range") : std0x[x])); _tmp$17 = layout.substring((i + 2 >> 0)); prefix = _tmp$15; std = _tmp$16; suffix = _tmp$17;
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
						j = j + (1) >> 0;
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
			i = i + (1) >> 0;
		}
		_tmp$78 = layout; _tmp$79 = 0; _tmp$80 = ""; prefix = _tmp$78; std = _tmp$79; suffix = _tmp$80;
		return [prefix, std, suffix];
	};
	match = function(s1, s2) {
		var c1, c2, i;
		i = 0;
		while (i < s1.length) {
			c1 = s1.charCodeAt(i);
			c2 = s2.charCodeAt(i);
			if (!((c1 === c2))) {
				c1 = (c1 | (32)) >>> 0;
				c2 = (c2 | (32)) >>> 0;
				if (!((c1 === c2)) || c1 < 97 || c1 > 122) {
					return false;
				}
			}
			i = i + (1) >> 0;
		}
		return true;
	};
	lookup = function(tab, val) {
		var _i, _ref, i, v;
		_ref = tab;
		_i = 0;
		while (_i < _ref.$length) {
			i = _i;
			v = ((_i < 0 || _i >= _ref.$length) ? $throwRuntimeError("index out of range") : _ref.$array[_ref.$offset + _i]);
			if (val.length >= v.length && match(val.substring(0, v.length), v)) {
				return [i, val.substring(v.length), $ifaceNil];
			}
			_i++;
		}
		return [-1, val, errBad];
	};
	appendUint = function(b, x, pad) {
		var _q, _q$1, _r, _r$1, buf, n;
		if (x < 10) {
			if (!((pad === 0))) {
				b = $append(b, pad);
			}
			return $append(b, ((48 + x >>> 0) << 24 >>> 24));
		}
		if (x < 100) {
			b = $append(b, ((48 + (_q = x / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : $throwRuntimeError("integer divide by zero")) >>> 0) << 24 >>> 24));
			b = $append(b, ((48 + (_r = x % 10, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) >>> 0) << 24 >>> 24));
			return b;
		}
		buf = $clone(arrayType$1.zero(), arrayType$1);
		n = 32;
		if (x === 0) {
			return $append(b, 48);
		}
		while (x >= 10) {
			n = n - (1) >> 0;
			(n < 0 || n >= buf.length) ? $throwRuntimeError("index out of range") : buf[n] = (((_r$1 = x % 10, _r$1 === _r$1 ? _r$1 : $throwRuntimeError("integer divide by zero")) + 48 >>> 0) << 24 >>> 24);
			x = (_q$1 = x / (10), (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >>> 0 : $throwRuntimeError("integer divide by zero"));
		}
		n = n - (1) >> 0;
		(n < 0 || n >= buf.length) ? $throwRuntimeError("index out of range") : buf[n] = ((x + 48 >>> 0) << 24 >>> 24);
		return $appendSlice(b, $subslice(new sliceType$3(buf), n));
	};
	atoi = function(s) {
		var _tmp, _tmp$1, _tmp$2, _tmp$3, _tuple$1, err = $ifaceNil, neg, q, rem, x = 0;
		neg = false;
		if (!(s === "") && ((s.charCodeAt(0) === 45) || (s.charCodeAt(0) === 43))) {
			neg = s.charCodeAt(0) === 45;
			s = s.substring(1);
		}
		_tuple$1 = leadingInt(s); q = _tuple$1[0]; rem = _tuple$1[1]; err = _tuple$1[2];
		x = ((q.$low + ((q.$high >> 31) * 4294967296)) >> 0);
		if (!($interfaceIsEqual(err, $ifaceNil)) || !(rem === "")) {
			_tmp = 0; _tmp$1 = atoiError; x = _tmp; err = _tmp$1;
			return [x, err];
		}
		if (neg) {
			x = -x;
		}
		_tmp$2 = x; _tmp$3 = $ifaceNil; x = _tmp$2; err = _tmp$3;
		return [x, err];
	};
	formatNano = function(b, nanosec, n, trim) {
		var _q, _r, buf, start, u, x;
		u = nanosec;
		buf = $clone(arrayType$2.zero(), arrayType$2);
		start = 9;
		while (start > 0) {
			start = start - (1) >> 0;
			(start < 0 || start >= buf.length) ? $throwRuntimeError("index out of range") : buf[start] = (((_r = u % 10, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) + 48 >>> 0) << 24 >>> 24);
			u = (_q = u / (10), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : $throwRuntimeError("integer divide by zero"));
		}
		if (n > 9) {
			n = 9;
		}
		if (trim) {
			while (n > 0 && ((x = n - 1 >> 0, ((x < 0 || x >= buf.length) ? $throwRuntimeError("index out of range") : buf[x])) === 48)) {
				n = n - (1) >> 0;
			}
			if (n === 0) {
				return b;
			}
		}
		b = $append(b, 46);
		return $appendSlice(b, $subslice(new sliceType$3(buf), 0, n));
	};
	Time.ptr.prototype.String = function() {
		var t;
		t = $clone(this, Time);
		return t.Format("2006-01-02 15:04:05.999999999 -0700 MST");
	};
	Time.prototype.String = function() { return this.$val.String(); };
	Time.ptr.prototype.Format = function(layout) {
		var _q, _q$1, _q$2, _q$3, _r, _r$1, _r$2, _r$3, _r$4, _r$5, _ref, _tuple$1, _tuple$2, _tuple$3, _tuple$4, abs, absoffset, b, buf, day, hour, hr, hr$1, m, max, min, month, name, offset, prefix, s, sec, std, suffix, t, y, y$1, year, zone$1, zone$2;
		t = $clone(this, Time);
		_tuple$1 = t.locabs(); name = _tuple$1[0]; offset = _tuple$1[1]; abs = _tuple$1[2];
		year = -1;
		month = 0;
		day = 0;
		hour = -1;
		min = 0;
		sec = 0;
		b = sliceType$3.nil;
		buf = $clone(arrayType$3.zero(), arrayType$3);
		max = layout.length + 10 >> 0;
		if (max <= 64) {
			b = $subslice(new sliceType$3(buf), 0, 0);
		} else {
			b = sliceType$3.make(0, max);
		}
		while (!(layout === "")) {
			_tuple$2 = nextStdChunk(layout); prefix = _tuple$2[0]; std = _tuple$2[1]; suffix = _tuple$2[2];
			if (!(prefix === "")) {
				b = $appendSlice(b, new sliceType$3($stringToBytes(prefix)));
			}
			if (std === 0) {
				break;
			}
			layout = suffix;
			if (year < 0 && !(((std & 256) === 0))) {
				_tuple$3 = absDate(abs, true); year = _tuple$3[0]; month = _tuple$3[1]; day = _tuple$3[2];
			}
			if (hour < 0 && !(((std & 512) === 0))) {
				_tuple$4 = absClock(abs); hour = _tuple$4[0]; min = _tuple$4[1]; sec = _tuple$4[2];
			}
			_ref = std & 65535;
			switch (0) { default: if (_ref === 274) {
				y = year;
				if (y < 0) {
					y = -y;
				}
				b = appendUint(b, ((_r = y % 100, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) >>> 0), 48);
			} else if (_ref === 273) {
				y$1 = year;
				if (year <= -1000) {
					b = $append(b, 45);
					y$1 = -y$1;
				} else if (year <= -100) {
					b = $appendSlice(b, new sliceType$3($stringToBytes("-0")));
					y$1 = -y$1;
				} else if (year <= -10) {
					b = $appendSlice(b, new sliceType$3($stringToBytes("-00")));
					y$1 = -y$1;
				} else if (year < 0) {
					b = $appendSlice(b, new sliceType$3($stringToBytes("-000")));
					y$1 = -y$1;
				} else if (year < 10) {
					b = $appendSlice(b, new sliceType$3($stringToBytes("000")));
				} else if (year < 100) {
					b = $appendSlice(b, new sliceType$3($stringToBytes("00")));
				} else if (year < 1000) {
					b = $append(b, 48);
				}
				b = appendUint(b, (y$1 >>> 0), 0);
			} else if (_ref === 258) {
				b = $appendSlice(b, new sliceType$3($stringToBytes(new Month(month).String().substring(0, 3))));
			} else if (_ref === 257) {
				m = new Month(month).String();
				b = $appendSlice(b, new sliceType$3($stringToBytes(m)));
			} else if (_ref === 259) {
				b = appendUint(b, (month >>> 0), 0);
			} else if (_ref === 260) {
				b = appendUint(b, (month >>> 0), 48);
			} else if (_ref === 262) {
				b = $appendSlice(b, new sliceType$3($stringToBytes(new Weekday(absWeekday(abs)).String().substring(0, 3))));
			} else if (_ref === 261) {
				s = new Weekday(absWeekday(abs)).String();
				b = $appendSlice(b, new sliceType$3($stringToBytes(s)));
			} else if (_ref === 263) {
				b = appendUint(b, (day >>> 0), 0);
			} else if (_ref === 264) {
				b = appendUint(b, (day >>> 0), 32);
			} else if (_ref === 265) {
				b = appendUint(b, (day >>> 0), 48);
			} else if (_ref === 522) {
				b = appendUint(b, (hour >>> 0), 48);
			} else if (_ref === 523) {
				hr = (_r$1 = hour % 12, _r$1 === _r$1 ? _r$1 : $throwRuntimeError("integer divide by zero"));
				if (hr === 0) {
					hr = 12;
				}
				b = appendUint(b, (hr >>> 0), 0);
			} else if (_ref === 524) {
				hr$1 = (_r$2 = hour % 12, _r$2 === _r$2 ? _r$2 : $throwRuntimeError("integer divide by zero"));
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
					b = $appendSlice(b, new sliceType$3($stringToBytes("PM")));
				} else {
					b = $appendSlice(b, new sliceType$3($stringToBytes("AM")));
				}
			} else if (_ref === 532) {
				if (hour >= 12) {
					b = $appendSlice(b, new sliceType$3($stringToBytes("pm")));
				} else {
					b = $appendSlice(b, new sliceType$3($stringToBytes("am")));
				}
			} else if (_ref === 22 || _ref === 24 || _ref === 23 || _ref === 25 || _ref === 26 || _ref === 29 || _ref === 27 || _ref === 30) {
				if ((offset === 0) && ((std === 22) || (std === 24) || (std === 23) || (std === 25))) {
					b = $append(b, 90);
					break;
				}
				zone$1 = (_q = offset / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero"));
				absoffset = offset;
				if (zone$1 < 0) {
					b = $append(b, 45);
					zone$1 = -zone$1;
					absoffset = -absoffset;
				} else {
					b = $append(b, 43);
				}
				b = appendUint(b, ((_q$1 = zone$1 / 60, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : $throwRuntimeError("integer divide by zero")) >>> 0), 48);
				if ((std === 24) || (std === 29) || (std === 25) || (std === 30)) {
					b = $append(b, 58);
				}
				b = appendUint(b, ((_r$3 = zone$1 % 60, _r$3 === _r$3 ? _r$3 : $throwRuntimeError("integer divide by zero")) >>> 0), 48);
				if ((std === 23) || (std === 27) || (std === 30) || (std === 25)) {
					if ((std === 30) || (std === 25)) {
						b = $append(b, 58);
					}
					b = appendUint(b, ((_r$4 = absoffset % 60, _r$4 === _r$4 ? _r$4 : $throwRuntimeError("integer divide by zero")) >>> 0), 48);
				}
			} else if (_ref === 21) {
				if (!(name === "")) {
					b = $appendSlice(b, new sliceType$3($stringToBytes(name)));
					break;
				}
				zone$2 = (_q$2 = offset / 60, (_q$2 === _q$2 && _q$2 !== 1/0 && _q$2 !== -1/0) ? _q$2 >> 0 : $throwRuntimeError("integer divide by zero"));
				if (zone$2 < 0) {
					b = $append(b, 45);
					zone$2 = -zone$2;
				} else {
					b = $append(b, 43);
				}
				b = appendUint(b, ((_q$3 = zone$2 / 60, (_q$3 === _q$3 && _q$3 !== 1/0 && _q$3 !== -1/0) ? _q$3 >> 0 : $throwRuntimeError("integer divide by zero")) >>> 0), 48);
				b = appendUint(b, ((_r$5 = zone$2 % 60, _r$5 === _r$5 ? _r$5 : $throwRuntimeError("integer divide by zero")) >>> 0), 48);
			} else if (_ref === 31 || _ref === 32) {
				b = formatNano(b, (t.Nanosecond() >>> 0), std >> 16 >> 0, (std & 65535) === 32);
			} }
		}
		return $bytesToString(b);
	};
	Time.prototype.Format = function(layout) { return this.$val.Format(layout); };
	quote = function(s) {
		return "\"" + s + "\"";
	};
	ParseError.ptr.prototype.Error = function() {
		var e;
		e = this;
		if (e.Message === "") {
			return "parsing time " + quote(e.Value) + " as " + quote(e.Layout) + ": cannot parse " + quote(e.ValueElem) + " as " + quote(e.LayoutElem);
		}
		return "parsing time " + quote(e.Value) + e.Message;
	};
	ParseError.prototype.Error = function() { return this.$val.Error(); };
	isDigit = function(s, i) {
		var c;
		if (s.length <= i) {
			return false;
		}
		c = s.charCodeAt(i);
		return 48 <= c && c <= 57;
	};
	getnum = function(s, fixed) {
		if (!isDigit(s, 0)) {
			return [0, s, errBad];
		}
		if (!isDigit(s, 1)) {
			if (fixed) {
				return [0, s, errBad];
			}
			return [((s.charCodeAt(0) - 48 << 24 >>> 24) >> 0), s.substring(1), $ifaceNil];
		}
		return [(((s.charCodeAt(0) - 48 << 24 >>> 24) >> 0) * 10 >> 0) + ((s.charCodeAt(1) - 48 << 24 >>> 24) >> 0) >> 0, s.substring(2), $ifaceNil];
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
		return [value, $ifaceNil];
	};
	Parse = $pkg.Parse = function(layout, value) {
		return parse(layout, value, $pkg.UTC, $pkg.Local);
	};
	parse = function(layout, value, defaultLocation, local) {
		var _ref, _ref$1, _ref$2, _ref$3, _tmp, _tmp$1, _tmp$10, _tmp$11, _tmp$12, _tmp$13, _tmp$14, _tmp$15, _tmp$16, _tmp$17, _tmp$18, _tmp$19, _tmp$2, _tmp$20, _tmp$21, _tmp$22, _tmp$23, _tmp$24, _tmp$25, _tmp$26, _tmp$27, _tmp$28, _tmp$29, _tmp$3, _tmp$30, _tmp$31, _tmp$32, _tmp$33, _tmp$34, _tmp$35, _tmp$36, _tmp$37, _tmp$38, _tmp$39, _tmp$4, _tmp$40, _tmp$41, _tmp$42, _tmp$43, _tmp$5, _tmp$6, _tmp$7, _tmp$8, _tmp$9, _tuple$1, _tuple$10, _tuple$11, _tuple$12, _tuple$13, _tuple$14, _tuple$15, _tuple$16, _tuple$17, _tuple$18, _tuple$19, _tuple$2, _tuple$20, _tuple$21, _tuple$22, _tuple$23, _tuple$24, _tuple$25, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8, _tuple$9, alayout, amSet, avalue, day, err, hour, hour$1, hr, i, min, min$1, mm, month, n, n$1, name, ndigit, nsec, offset, offset$1, ok, ok$1, p, pmSet, prefix, rangeErrString, sec, seconds, sign, ss, std, stdstr, suffix, t, t$1, x, x$1, x$2, x$3, x$4, x$5, year, z, zoneName, zoneOffset;
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
		z = ptrType$1.nil;
		zoneOffset = -1;
		zoneName = "";
		while (true) {
			err = $ifaceNil;
			_tuple$1 = nextStdChunk(layout); prefix = _tuple$1[0]; std = _tuple$1[1]; suffix = _tuple$1[2];
			stdstr = layout.substring(prefix.length, (layout.length - suffix.length >> 0));
			_tuple$2 = skip(value, prefix); value = _tuple$2[0]; err = _tuple$2[1];
			if (!($interfaceIsEqual(err, $ifaceNil))) {
				return [new Time.ptr(new $Int64(0, 0), 0, ptrType$1.nil), new ParseError.ptr(alayout, avalue, prefix, value, "")];
			}
			if (std === 0) {
				if (!((value.length === 0))) {
					return [new Time.ptr(new $Int64(0, 0), 0, ptrType$1.nil), new ParseError.ptr(alayout, avalue, "", value, ": extra text: " + value)];
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
				_tuple$3 = atoi(p); year = _tuple$3[0]; err = _tuple$3[1];
				if (year >= 69) {
					year = year + (1900) >> 0;
				} else {
					year = year + (2000) >> 0;
				}
			} else if (_ref === 273) {
				if (value.length < 4 || !isDigit(value, 0)) {
					err = errBad;
					break;
				}
				_tmp$4 = value.substring(0, 4); _tmp$5 = value.substring(4); p = _tmp$4; value = _tmp$5;
				_tuple$4 = atoi(p); year = _tuple$4[0]; err = _tuple$4[1];
			} else if (_ref === 258) {
				_tuple$5 = lookup(shortMonthNames, value); month = _tuple$5[0]; value = _tuple$5[1]; err = _tuple$5[2];
			} else if (_ref === 257) {
				_tuple$6 = lookup(longMonthNames, value); month = _tuple$6[0]; value = _tuple$6[1]; err = _tuple$6[2];
			} else if (_ref === 259 || _ref === 260) {
				_tuple$7 = getnum(value, std === 260); month = _tuple$7[0]; value = _tuple$7[1]; err = _tuple$7[2];
				if (month <= 0 || 12 < month) {
					rangeErrString = "month";
				}
			} else if (_ref === 262) {
				_tuple$8 = lookup(shortDayNames, value); value = _tuple$8[1]; err = _tuple$8[2];
			} else if (_ref === 261) {
				_tuple$9 = lookup(longDayNames, value); value = _tuple$9[1]; err = _tuple$9[2];
			} else if (_ref === 263 || _ref === 264 || _ref === 265) {
				if ((std === 264) && value.length > 0 && (value.charCodeAt(0) === 32)) {
					value = value.substring(1);
				}
				_tuple$10 = getnum(value, std === 265); day = _tuple$10[0]; value = _tuple$10[1]; err = _tuple$10[2];
				if (day < 0 || 31 < day) {
					rangeErrString = "day";
				}
			} else if (_ref === 522) {
				_tuple$11 = getnum(value, false); hour = _tuple$11[0]; value = _tuple$11[1]; err = _tuple$11[2];
				if (hour < 0 || 24 <= hour) {
					rangeErrString = "hour";
				}
			} else if (_ref === 523 || _ref === 524) {
				_tuple$12 = getnum(value, std === 524); hour = _tuple$12[0]; value = _tuple$12[1]; err = _tuple$12[2];
				if (hour < 0 || 12 < hour) {
					rangeErrString = "hour";
				}
			} else if (_ref === 525 || _ref === 526) {
				_tuple$13 = getnum(value, std === 526); min = _tuple$13[0]; value = _tuple$13[1]; err = _tuple$13[2];
				if (min < 0 || 60 <= min) {
					rangeErrString = "minute";
				}
			} else if (_ref === 527 || _ref === 528) {
				_tuple$14 = getnum(value, std === 528); sec = _tuple$14[0]; value = _tuple$14[1]; err = _tuple$14[2];
				if (sec < 0 || 60 <= sec) {
					rangeErrString = "second";
				}
				if (value.length >= 2 && (value.charCodeAt(0) === 46) && isDigit(value, 1)) {
					_tuple$15 = nextStdChunk(layout); std = _tuple$15[1];
					std = std & (65535);
					if ((std === 31) || (std === 32)) {
						break;
					}
					n = 2;
					while (n < value.length && isDigit(value, n)) {
						n = n + (1) >> 0;
					}
					_tuple$16 = parseNanoseconds(value, n); nsec = _tuple$16[0]; rangeErrString = _tuple$16[1]; err = _tuple$16[2];
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
					z = $pkg.UTC;
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
				_tuple$17 = atoi(hour$1); hr = _tuple$17[0]; err = _tuple$17[1];
				if ($interfaceIsEqual(err, $ifaceNil)) {
					_tuple$18 = atoi(min$1); mm = _tuple$18[0]; err = _tuple$18[1];
				}
				if ($interfaceIsEqual(err, $ifaceNil)) {
					_tuple$19 = atoi(seconds); ss = _tuple$19[0]; err = _tuple$19[1];
				}
				zoneOffset = ((((hr * 60 >> 0) + mm >> 0)) * 60 >> 0) + ss >> 0;
				_ref$3 = sign.charCodeAt(0);
				if (_ref$3 === 43) {
				} else if (_ref$3 === 45) {
					zoneOffset = -zoneOffset;
				} else {
					err = errBad;
				}
			} else if (_ref === 21) {
				if (value.length >= 3 && value.substring(0, 3) === "UTC") {
					z = $pkg.UTC;
					value = value.substring(3);
					break;
				}
				_tuple$20 = parseTimeZone(value); n$1 = _tuple$20[0]; ok = _tuple$20[1];
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
				_tuple$21 = parseNanoseconds(value, ndigit); nsec = _tuple$21[0]; rangeErrString = _tuple$21[1]; err = _tuple$21[2];
				value = value.substring(ndigit);
			} else if (_ref === 32) {
				if (value.length < 2 || !((value.charCodeAt(0) === 46)) || value.charCodeAt(1) < 48 || 57 < value.charCodeAt(1)) {
					break;
				}
				i = 0;
				while (i < 9 && (i + 1 >> 0) < value.length && 48 <= value.charCodeAt((i + 1 >> 0)) && value.charCodeAt((i + 1 >> 0)) <= 57) {
					i = i + (1) >> 0;
				}
				_tuple$22 = parseNanoseconds(value, 1 + i >> 0); nsec = _tuple$22[0]; rangeErrString = _tuple$22[1]; err = _tuple$22[2];
				value = value.substring((1 + i >> 0));
			} }
			if (!(rangeErrString === "")) {
				return [new Time.ptr(new $Int64(0, 0), 0, ptrType$1.nil), new ParseError.ptr(alayout, avalue, stdstr, value, ": " + rangeErrString + " out of range")];
			}
			if (!($interfaceIsEqual(err, $ifaceNil))) {
				return [new Time.ptr(new $Int64(0, 0), 0, ptrType$1.nil), new ParseError.ptr(alayout, avalue, stdstr, value, "")];
			}
		}
		if (pmSet && hour < 12) {
			hour = hour + (12) >> 0;
		} else if (amSet && (hour === 12)) {
			hour = 0;
		}
		if (!(z === ptrType$1.nil)) {
			return [Date(year, (month >> 0), day, hour, min, sec, nsec, z), $ifaceNil];
		}
		if (!((zoneOffset === -1))) {
			t = $clone(Date(year, (month >> 0), day, hour, min, sec, nsec, $pkg.UTC), Time);
			t.sec = (x = t.sec, x$1 = new $Int64(0, zoneOffset), new $Int64(x.$high - x$1.$high, x.$low - x$1.$low));
			_tuple$23 = local.lookup((x$2 = t.sec, new $Int64(x$2.$high + -15, x$2.$low + 2288912640))); name = _tuple$23[0]; offset = _tuple$23[1];
			if ((offset === zoneOffset) && (zoneName === "" || name === zoneName)) {
				t.loc = local;
				return [t, $ifaceNil];
			}
			t.loc = FixedZone(zoneName, zoneOffset);
			return [t, $ifaceNil];
		}
		if (!(zoneName === "")) {
			t$1 = $clone(Date(year, (month >> 0), day, hour, min, sec, nsec, $pkg.UTC), Time);
			_tuple$24 = local.lookupName(zoneName, (x$3 = t$1.sec, new $Int64(x$3.$high + -15, x$3.$low + 2288912640))); offset$1 = _tuple$24[0]; ok$1 = _tuple$24[2];
			if (ok$1) {
				t$1.sec = (x$4 = t$1.sec, x$5 = new $Int64(0, offset$1), new $Int64(x$4.$high - x$5.$high, x$4.$low - x$5.$low));
				t$1.loc = local;
				return [t$1, $ifaceNil];
			}
			if (zoneName.length > 3 && zoneName.substring(0, 3) === "GMT") {
				_tuple$25 = atoi(zoneName.substring(3)); offset$1 = _tuple$25[0];
				offset$1 = offset$1 * (3600) >> 0;
			}
			t$1.loc = FixedZone(zoneName, offset$1);
			return [t$1, $ifaceNil];
		}
		return [Date(year, (month >> 0), day, hour, min, sec, nsec, defaultLocation), $ifaceNil];
	};
	parseTimeZone = function(value) {
		var _ref, _tmp, _tmp$1, _tmp$10, _tmp$11, _tmp$12, _tmp$13, _tmp$14, _tmp$15, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tmp$6, _tmp$7, _tmp$8, _tmp$9, c, length = 0, nUpper, ok = false;
		if (value.length < 3) {
			_tmp = 0; _tmp$1 = false; length = _tmp; ok = _tmp$1;
			return [length, ok];
		}
		if (value.length >= 4 && (value.substring(0, 4) === "ChST" || value.substring(0, 4) === "MeST")) {
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
			nUpper = nUpper + (1) >> 0;
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
		var _tuple$1, err, rem, sign, x;
		value = value.substring(3);
		if (value.length === 0) {
			return 3;
		}
		sign = value.charCodeAt(0);
		if (!((sign === 45)) && !((sign === 43))) {
			return 3;
		}
		_tuple$1 = leadingInt(value.substring(1)); x = _tuple$1[0]; rem = _tuple$1[1]; err = _tuple$1[2];
		if (!($interfaceIsEqual(err, $ifaceNil))) {
			return 3;
		}
		if (sign === 45) {
			x = new $Int64(-x.$high, -x.$low);
		}
		if ((x.$high === 0 && x.$low === 0) || (x.$high < -1 || (x.$high === -1 && x.$low < 4294967282)) || (0 < x.$high || (0 === x.$high && 12 < x.$low))) {
			return 3;
		}
		return (3 + value.length >> 0) - rem.length >> 0;
	};
	parseNanoseconds = function(value, nbytes) {
		var _tuple$1, err = $ifaceNil, i, ns = 0, rangeErrString = "", scaleDigits;
		if (!((value.charCodeAt(0) === 46))) {
			err = errBad;
			return [ns, rangeErrString, err];
		}
		_tuple$1 = atoi(value.substring(1, nbytes)); ns = _tuple$1[0]; err = _tuple$1[1];
		if (!($interfaceIsEqual(err, $ifaceNil))) {
			return [ns, rangeErrString, err];
		}
		if (ns < 0 || 1000000000 <= ns) {
			rangeErrString = "fractional second";
			return [ns, rangeErrString, err];
		}
		scaleDigits = 10 - nbytes >> 0;
		i = 0;
		while (i < scaleDigits) {
			ns = ns * (10) >> 0;
			i = i + (1) >> 0;
		}
		return [ns, rangeErrString, err];
	};
	leadingInt = function(s) {
		var _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, c, err = $ifaceNil, i, rem = "", x = new $Int64(0, 0), x$1, x$2, x$3;
		i = 0;
		while (i < s.length) {
			c = s.charCodeAt(i);
			if (c < 48 || c > 57) {
				break;
			}
			if ((x.$high > 214748364 || (x.$high === 214748364 && x.$low >= 3435973835))) {
				_tmp = new $Int64(0, 0); _tmp$1 = ""; _tmp$2 = errLeadingInt; x = _tmp; rem = _tmp$1; err = _tmp$2;
				return [x, rem, err];
			}
			x = (x$1 = (x$2 = $mul64(x, new $Int64(0, 10)), x$3 = new $Int64(0, c), new $Int64(x$2.$high + x$3.$high, x$2.$low + x$3.$low)), new $Int64(x$1.$high - 0, x$1.$low - 48));
			i = i + (1) >> 0;
		}
		_tmp$3 = x; _tmp$4 = s.substring(i); _tmp$5 = $ifaceNil; x = _tmp$3; rem = _tmp$4; err = _tmp$5;
		return [x, rem, err];
	};
	Time.ptr.prototype.After = function(u) {
		var t, x, x$1, x$2, x$3;
		t = $clone(this, Time);
		u = $clone(u, Time);
		return (x = t.sec, x$1 = u.sec, (x.$high > x$1.$high || (x.$high === x$1.$high && x.$low > x$1.$low))) || (x$2 = t.sec, x$3 = u.sec, (x$2.$high === x$3.$high && x$2.$low === x$3.$low)) && t.nsec > u.nsec;
	};
	Time.prototype.After = function(u) { return this.$val.After(u); };
	Time.ptr.prototype.Before = function(u) {
		var t, x, x$1, x$2, x$3;
		t = $clone(this, Time);
		u = $clone(u, Time);
		return (x = t.sec, x$1 = u.sec, (x.$high < x$1.$high || (x.$high === x$1.$high && x.$low < x$1.$low))) || (x$2 = t.sec, x$3 = u.sec, (x$2.$high === x$3.$high && x$2.$low === x$3.$low)) && t.nsec < u.nsec;
	};
	Time.prototype.Before = function(u) { return this.$val.Before(u); };
	Time.ptr.prototype.Equal = function(u) {
		var t, x, x$1;
		t = $clone(this, Time);
		u = $clone(u, Time);
		return (x = t.sec, x$1 = u.sec, (x.$high === x$1.$high && x.$low === x$1.$low)) && (t.nsec === u.nsec);
	};
	Time.prototype.Equal = function(u) { return this.$val.Equal(u); };
	Month.prototype.String = function() {
		var m, x;
		m = this.$val;
		return (x = m - 1 >> 0, ((x < 0 || x >= months.length) ? $throwRuntimeError("index out of range") : months[x]));
	};
	$ptrType(Month).prototype.String = function() { return new Month(this.$get()).String(); };
	Weekday.prototype.String = function() {
		var d;
		d = this.$val;
		return ((d < 0 || d >= days.length) ? $throwRuntimeError("index out of range") : days[d]);
	};
	$ptrType(Weekday).prototype.String = function() { return new Weekday(this.$get()).String(); };
	Time.ptr.prototype.IsZero = function() {
		var t, x;
		t = $clone(this, Time);
		return (x = t.sec, (x.$high === 0 && x.$low === 0)) && (t.nsec === 0);
	};
	Time.prototype.IsZero = function() { return this.$val.IsZero(); };
	Time.ptr.prototype.abs = function() {
		var _tuple$1, l, offset, sec, t, x, x$1, x$2, x$3, x$4, x$5;
		t = $clone(this, Time);
		l = t.loc;
		if (l === ptrType$1.nil || l === localLoc) {
			l = l.get();
		}
		sec = (x = t.sec, new $Int64(x.$high + -15, x.$low + 2288912640));
		if (!(l === utcLoc)) {
			if (!(l.cacheZone === ptrType.nil) && (x$1 = l.cacheStart, (x$1.$high < sec.$high || (x$1.$high === sec.$high && x$1.$low <= sec.$low))) && (x$2 = l.cacheEnd, (sec.$high < x$2.$high || (sec.$high === x$2.$high && sec.$low < x$2.$low)))) {
				sec = (x$3 = new $Int64(0, l.cacheZone.offset), new $Int64(sec.$high + x$3.$high, sec.$low + x$3.$low));
			} else {
				_tuple$1 = l.lookup(sec); offset = _tuple$1[1];
				sec = (x$4 = new $Int64(0, offset), new $Int64(sec.$high + x$4.$high, sec.$low + x$4.$low));
			}
		}
		return (x$5 = new $Int64(sec.$high + 2147483646, sec.$low + 450480384), new $Uint64(x$5.$high, x$5.$low));
	};
	Time.prototype.abs = function() { return this.$val.abs(); };
	Time.ptr.prototype.locabs = function() {
		var _tuple$1, abs = new $Uint64(0, 0), l, name = "", offset = 0, sec, t, x, x$1, x$2, x$3, x$4;
		t = $clone(this, Time);
		l = t.loc;
		if (l === ptrType$1.nil || l === localLoc) {
			l = l.get();
		}
		sec = (x = t.sec, new $Int64(x.$high + -15, x.$low + 2288912640));
		if (!(l === utcLoc)) {
			if (!(l.cacheZone === ptrType.nil) && (x$1 = l.cacheStart, (x$1.$high < sec.$high || (x$1.$high === sec.$high && x$1.$low <= sec.$low))) && (x$2 = l.cacheEnd, (sec.$high < x$2.$high || (sec.$high === x$2.$high && sec.$low < x$2.$low)))) {
				name = l.cacheZone.name;
				offset = l.cacheZone.offset;
			} else {
				_tuple$1 = l.lookup(sec); name = _tuple$1[0]; offset = _tuple$1[1];
			}
			sec = (x$3 = new $Int64(0, offset), new $Int64(sec.$high + x$3.$high, sec.$low + x$3.$low));
		} else {
			name = "UTC";
		}
		abs = (x$4 = new $Int64(sec.$high + 2147483646, sec.$low + 450480384), new $Uint64(x$4.$high, x$4.$low));
		return [name, offset, abs];
	};
	Time.prototype.locabs = function() { return this.$val.locabs(); };
	Time.ptr.prototype.Date = function() {
		var _tuple$1, day = 0, month = 0, t, year = 0;
		t = $clone(this, Time);
		_tuple$1 = t.date(true); year = _tuple$1[0]; month = _tuple$1[1]; day = _tuple$1[2];
		return [year, month, day];
	};
	Time.prototype.Date = function() { return this.$val.Date(); };
	Time.ptr.prototype.Year = function() {
		var _tuple$1, t, year;
		t = $clone(this, Time);
		_tuple$1 = t.date(false); year = _tuple$1[0];
		return year;
	};
	Time.prototype.Year = function() { return this.$val.Year(); };
	Time.ptr.prototype.Month = function() {
		var _tuple$1, month, t;
		t = $clone(this, Time);
		_tuple$1 = t.date(true); month = _tuple$1[1];
		return month;
	};
	Time.prototype.Month = function() { return this.$val.Month(); };
	Time.ptr.prototype.Day = function() {
		var _tuple$1, day, t;
		t = $clone(this, Time);
		_tuple$1 = t.date(true); day = _tuple$1[2];
		return day;
	};
	Time.prototype.Day = function() { return this.$val.Day(); };
	Time.ptr.prototype.Weekday = function() {
		var t;
		t = $clone(this, Time);
		return absWeekday(t.abs());
	};
	Time.prototype.Weekday = function() { return this.$val.Weekday(); };
	absWeekday = function(abs) {
		var _q, sec;
		sec = $div64((new $Uint64(abs.$high + 0, abs.$low + 86400)), new $Uint64(0, 604800), true);
		return ((_q = (sec.$low >> 0) / 86400, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero")) >> 0);
	};
	Time.ptr.prototype.ISOWeek = function() {
		var _q, _r, _r$1, _r$2, _tuple$1, day, dec31wday, jan1wday, month, t, wday, week = 0, yday, year = 0;
		t = $clone(this, Time);
		_tuple$1 = t.date(true); year = _tuple$1[0]; month = _tuple$1[1]; day = _tuple$1[2]; yday = _tuple$1[3];
		wday = (_r = ((t.Weekday() + 6 >> 0) >> 0) % 7, _r === _r ? _r : $throwRuntimeError("integer divide by zero"));
		week = (_q = (((yday - wday >> 0) + 7 >> 0)) / 7, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero"));
		jan1wday = (_r$1 = (((wday - yday >> 0) + 371 >> 0)) % 7, _r$1 === _r$1 ? _r$1 : $throwRuntimeError("integer divide by zero"));
		if (1 <= jan1wday && jan1wday <= 3) {
			week = week + (1) >> 0;
		}
		if (week === 0) {
			year = year - (1) >> 0;
			week = 52;
			if ((jan1wday === 4) || ((jan1wday === 5) && isLeap(year))) {
				week = week + (1) >> 0;
			}
		}
		if ((month === 12) && day >= 29 && wday < 3) {
			dec31wday = (_r$2 = (((wday + 31 >> 0) - day >> 0)) % 7, _r$2 === _r$2 ? _r$2 : $throwRuntimeError("integer divide by zero"));
			if (0 <= dec31wday && dec31wday <= 2) {
				year = year + (1) >> 0;
				week = 1;
			}
		}
		return [year, week];
	};
	Time.prototype.ISOWeek = function() { return this.$val.ISOWeek(); };
	Time.ptr.prototype.Clock = function() {
		var _tuple$1, hour = 0, min = 0, sec = 0, t;
		t = $clone(this, Time);
		_tuple$1 = absClock(t.abs()); hour = _tuple$1[0]; min = _tuple$1[1]; sec = _tuple$1[2];
		return [hour, min, sec];
	};
	Time.prototype.Clock = function() { return this.$val.Clock(); };
	absClock = function(abs) {
		var _q, _q$1, hour = 0, min = 0, sec = 0;
		sec = ($div64(abs, new $Uint64(0, 86400), true).$low >> 0);
		hour = (_q = sec / 3600, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero"));
		sec = sec - ((hour * 3600 >> 0)) >> 0;
		min = (_q$1 = sec / 60, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : $throwRuntimeError("integer divide by zero"));
		sec = sec - ((min * 60 >> 0)) >> 0;
		return [hour, min, sec];
	};
	Time.ptr.prototype.Hour = function() {
		var _q, t;
		t = $clone(this, Time);
		return (_q = ($div64(t.abs(), new $Uint64(0, 86400), true).$low >> 0) / 3600, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero"));
	};
	Time.prototype.Hour = function() { return this.$val.Hour(); };
	Time.ptr.prototype.Minute = function() {
		var _q, t;
		t = $clone(this, Time);
		return (_q = ($div64(t.abs(), new $Uint64(0, 3600), true).$low >> 0) / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero"));
	};
	Time.prototype.Minute = function() { return this.$val.Minute(); };
	Time.ptr.prototype.Second = function() {
		var t;
		t = $clone(this, Time);
		return ($div64(t.abs(), new $Uint64(0, 60), true).$low >> 0);
	};
	Time.prototype.Second = function() { return this.$val.Second(); };
	Time.ptr.prototype.Nanosecond = function() {
		var t;
		t = $clone(this, Time);
		return (t.nsec >> 0);
	};
	Time.prototype.Nanosecond = function() { return this.$val.Nanosecond(); };
	Time.ptr.prototype.YearDay = function() {
		var _tuple$1, t, yday;
		t = $clone(this, Time);
		_tuple$1 = t.date(false); yday = _tuple$1[3];
		return yday + 1 >> 0;
	};
	Time.prototype.YearDay = function() { return this.$val.YearDay(); };
	Duration.prototype.String = function() {
		var _tuple$1, _tuple$2, buf, d, neg, prec, u, w;
		d = this;
		buf = $clone(arrayType$1.zero(), arrayType$1);
		w = 32;
		u = new $Uint64(d.$high, d.$low);
		neg = (d.$high < 0 || (d.$high === 0 && d.$low < 0));
		if (neg) {
			u = new $Uint64(-u.$high, -u.$low);
		}
		if ((u.$high < 0 || (u.$high === 0 && u.$low < 1000000000))) {
			prec = 0;
			w = w - (1) >> 0;
			(w < 0 || w >= buf.length) ? $throwRuntimeError("index out of range") : buf[w] = 115;
			w = w - (1) >> 0;
			if ((u.$high === 0 && u.$low === 0)) {
				return "0";
			} else if ((u.$high < 0 || (u.$high === 0 && u.$low < 1000))) {
				prec = 0;
				(w < 0 || w >= buf.length) ? $throwRuntimeError("index out of range") : buf[w] = 110;
			} else if ((u.$high < 0 || (u.$high === 0 && u.$low < 1000000))) {
				prec = 3;
				w = w - (1) >> 0;
				$copyString($subslice(new sliceType$3(buf), w), "\xC2\xB5");
			} else {
				prec = 6;
				(w < 0 || w >= buf.length) ? $throwRuntimeError("index out of range") : buf[w] = 109;
			}
			_tuple$1 = fmtFrac($subslice(new sliceType$3(buf), 0, w), u, prec); w = _tuple$1[0]; u = _tuple$1[1];
			w = fmtInt($subslice(new sliceType$3(buf), 0, w), u);
		} else {
			w = w - (1) >> 0;
			(w < 0 || w >= buf.length) ? $throwRuntimeError("index out of range") : buf[w] = 115;
			_tuple$2 = fmtFrac($subslice(new sliceType$3(buf), 0, w), u, 9); w = _tuple$2[0]; u = _tuple$2[1];
			w = fmtInt($subslice(new sliceType$3(buf), 0, w), $div64(u, new $Uint64(0, 60), true));
			u = $div64(u, (new $Uint64(0, 60)), false);
			if ((u.$high > 0 || (u.$high === 0 && u.$low > 0))) {
				w = w - (1) >> 0;
				(w < 0 || w >= buf.length) ? $throwRuntimeError("index out of range") : buf[w] = 109;
				w = fmtInt($subslice(new sliceType$3(buf), 0, w), $div64(u, new $Uint64(0, 60), true));
				u = $div64(u, (new $Uint64(0, 60)), false);
				if ((u.$high > 0 || (u.$high === 0 && u.$low > 0))) {
					w = w - (1) >> 0;
					(w < 0 || w >= buf.length) ? $throwRuntimeError("index out of range") : buf[w] = 104;
					w = fmtInt($subslice(new sliceType$3(buf), 0, w), u);
				}
			}
		}
		if (neg) {
			w = w - (1) >> 0;
			(w < 0 || w >= buf.length) ? $throwRuntimeError("index out of range") : buf[w] = 45;
		}
		return $bytesToString($subslice(new sliceType$3(buf), w));
	};
	$ptrType(Duration).prototype.String = function() { return this.$get().String(); };
	fmtFrac = function(buf, v, prec) {
		var _tmp, _tmp$1, digit, i, nv = new $Uint64(0, 0), nw = 0, print, w;
		w = buf.$length;
		print = false;
		i = 0;
		while (i < prec) {
			digit = $div64(v, new $Uint64(0, 10), true);
			print = print || !((digit.$high === 0 && digit.$low === 0));
			if (print) {
				w = w - (1) >> 0;
				(w < 0 || w >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + w] = (digit.$low << 24 >>> 24) + 48 << 24 >>> 24;
			}
			v = $div64(v, (new $Uint64(0, 10)), false);
			i = i + (1) >> 0;
		}
		if (print) {
			w = w - (1) >> 0;
			(w < 0 || w >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + w] = 46;
		}
		_tmp = w; _tmp$1 = v; nw = _tmp; nv = _tmp$1;
		return [nw, nv];
	};
	fmtInt = function(buf, v) {
		var w;
		w = buf.$length;
		if ((v.$high === 0 && v.$low === 0)) {
			w = w - (1) >> 0;
			(w < 0 || w >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + w] = 48;
		} else {
			while ((v.$high > 0 || (v.$high === 0 && v.$low > 0))) {
				w = w - (1) >> 0;
				(w < 0 || w >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + w] = ($div64(v, new $Uint64(0, 10), true).$low << 24 >>> 24) + 48 << 24 >>> 24;
				v = $div64(v, (new $Uint64(0, 10)), false);
			}
		}
		return w;
	};
	Duration.prototype.Nanoseconds = function() {
		var d;
		d = this;
		return new $Int64(d.$high, d.$low);
	};
	$ptrType(Duration).prototype.Nanoseconds = function() { return this.$get().Nanoseconds(); };
	Duration.prototype.Seconds = function() {
		var d, nsec, sec;
		d = this;
		sec = $div64(d, new Duration(0, 1000000000), false);
		nsec = $div64(d, new Duration(0, 1000000000), true);
		return $flatten64(sec) + $flatten64(nsec) * 1e-09;
	};
	$ptrType(Duration).prototype.Seconds = function() { return this.$get().Seconds(); };
	Duration.prototype.Minutes = function() {
		var d, min, nsec;
		d = this;
		min = $div64(d, new Duration(13, 4165425152), false);
		nsec = $div64(d, new Duration(13, 4165425152), true);
		return $flatten64(min) + $flatten64(nsec) * 1.6666666666666667e-11;
	};
	$ptrType(Duration).prototype.Minutes = function() { return this.$get().Minutes(); };
	Duration.prototype.Hours = function() {
		var d, hour, nsec;
		d = this;
		hour = $div64(d, new Duration(838, 817405952), false);
		nsec = $div64(d, new Duration(838, 817405952), true);
		return $flatten64(hour) + $flatten64(nsec) * 2.777777777777778e-13;
	};
	$ptrType(Duration).prototype.Hours = function() { return this.$get().Hours(); };
	Time.ptr.prototype.Add = function(d) {
		var nsec, t, x, x$1, x$2, x$3, x$4, x$5, x$6, x$7;
		t = $clone(this, Time);
		t.sec = (x = t.sec, x$1 = (x$2 = $div64(d, new Duration(0, 1000000000), false), new $Int64(x$2.$high, x$2.$low)), new $Int64(x.$high + x$1.$high, x.$low + x$1.$low));
		nsec = t.nsec + ((x$3 = $div64(d, new Duration(0, 1000000000), true), x$3.$low + ((x$3.$high >> 31) * 4294967296)) >> 0) >> 0;
		if (nsec >= 1000000000) {
			t.sec = (x$4 = t.sec, x$5 = new $Int64(0, 1), new $Int64(x$4.$high + x$5.$high, x$4.$low + x$5.$low));
			nsec = nsec - (1000000000) >> 0;
		} else if (nsec < 0) {
			t.sec = (x$6 = t.sec, x$7 = new $Int64(0, 1), new $Int64(x$6.$high - x$7.$high, x$6.$low - x$7.$low));
			nsec = nsec + (1000000000) >> 0;
		}
		t.nsec = nsec;
		return t;
	};
	Time.prototype.Add = function(d) { return this.$val.Add(d); };
	Time.ptr.prototype.Sub = function(u) {
		var d, t, x, x$1, x$2, x$3, x$4;
		t = $clone(this, Time);
		u = $clone(u, Time);
		d = (x = $mul64((x$1 = (x$2 = t.sec, x$3 = u.sec, new $Int64(x$2.$high - x$3.$high, x$2.$low - x$3.$low)), new Duration(x$1.$high, x$1.$low)), new Duration(0, 1000000000)), x$4 = new Duration(0, (t.nsec - u.nsec >> 0)), new Duration(x.$high + x$4.$high, x.$low + x$4.$low));
		if (u.Add(d).Equal(t)) {
			return d;
		} else if (t.Before(u)) {
			return new Duration(-2147483648, 0);
		} else {
			return new Duration(2147483647, 4294967295);
		}
	};
	Time.prototype.Sub = function(u) { return this.$val.Sub(u); };
	Time.ptr.prototype.AddDate = function(years, months$1, days$1) {
		var _tuple$1, _tuple$2, day, hour, min, month, sec, t, year;
		t = $clone(this, Time);
		_tuple$1 = t.Date(); year = _tuple$1[0]; month = _tuple$1[1]; day = _tuple$1[2];
		_tuple$2 = t.Clock(); hour = _tuple$2[0]; min = _tuple$2[1]; sec = _tuple$2[2];
		return Date(year + years >> 0, month + (months$1 >> 0) >> 0, day + days$1 >> 0, hour, min, sec, (t.nsec >> 0), t.loc);
	};
	Time.prototype.AddDate = function(years, months$1, days$1) { return this.$val.AddDate(years, months$1, days$1); };
	Time.ptr.prototype.date = function(full) {
		var _tuple$1, day = 0, month = 0, t, yday = 0, year = 0;
		t = $clone(this, Time);
		_tuple$1 = absDate(t.abs(), full); year = _tuple$1[0]; month = _tuple$1[1]; day = _tuple$1[2]; yday = _tuple$1[3];
		return [year, month, day, yday];
	};
	Time.prototype.date = function(full) { return this.$val.date(full); };
	absDate = function(abs, full) {
		var _q, begin, d, day = 0, end, month = 0, n, x, x$1, x$10, x$11, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9, y, yday = 0, year = 0;
		d = $div64(abs, new $Uint64(0, 86400), false);
		n = $div64(d, new $Uint64(0, 146097), false);
		y = $mul64(new $Uint64(0, 400), n);
		d = (x = $mul64(new $Uint64(0, 146097), n), new $Uint64(d.$high - x.$high, d.$low - x.$low));
		n = $div64(d, new $Uint64(0, 36524), false);
		n = (x$1 = $shiftRightUint64(n, 2), new $Uint64(n.$high - x$1.$high, n.$low - x$1.$low));
		y = (x$2 = $mul64(new $Uint64(0, 100), n), new $Uint64(y.$high + x$2.$high, y.$low + x$2.$low));
		d = (x$3 = $mul64(new $Uint64(0, 36524), n), new $Uint64(d.$high - x$3.$high, d.$low - x$3.$low));
		n = $div64(d, new $Uint64(0, 1461), false);
		y = (x$4 = $mul64(new $Uint64(0, 4), n), new $Uint64(y.$high + x$4.$high, y.$low + x$4.$low));
		d = (x$5 = $mul64(new $Uint64(0, 1461), n), new $Uint64(d.$high - x$5.$high, d.$low - x$5.$low));
		n = $div64(d, new $Uint64(0, 365), false);
		n = (x$6 = $shiftRightUint64(n, 2), new $Uint64(n.$high - x$6.$high, n.$low - x$6.$low));
		y = (x$7 = n, new $Uint64(y.$high + x$7.$high, y.$low + x$7.$low));
		d = (x$8 = $mul64(new $Uint64(0, 365), n), new $Uint64(d.$high - x$8.$high, d.$low - x$8.$low));
		year = ((x$9 = (x$10 = new $Int64(y.$high, y.$low), new $Int64(x$10.$high + -69, x$10.$low + 4075721025)), x$9.$low + ((x$9.$high >> 31) * 4294967296)) >> 0);
		yday = (d.$low >> 0);
		if (!full) {
			return [year, month, day, yday];
		}
		day = yday;
		if (isLeap(year)) {
			if (day > 59) {
				day = day - (1) >> 0;
			} else if (day === 59) {
				month = 2;
				day = 29;
				return [year, month, day, yday];
			}
		}
		month = ((_q = day / 31, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero")) >> 0);
		end = ((x$11 = month + 1 >> 0, ((x$11 < 0 || x$11 >= daysBefore.length) ? $throwRuntimeError("index out of range") : daysBefore[x$11])) >> 0);
		begin = 0;
		if (day >= end) {
			month = month + (1) >> 0;
			begin = end;
		} else {
			begin = (((month < 0 || month >= daysBefore.length) ? $throwRuntimeError("index out of range") : daysBefore[month]) >> 0);
		}
		month = month + (1) >> 0;
		day = (day - begin >> 0) + 1 >> 0;
		return [year, month, day, yday];
	};
	Now = $pkg.Now = function() {
		var _tuple$1, nsec, sec;
		_tuple$1 = now(); sec = _tuple$1[0]; nsec = _tuple$1[1];
		return new Time.ptr(new $Int64(sec.$high + 14, sec.$low + 2006054656), nsec, $pkg.Local);
	};
	Time.ptr.prototype.UTC = function() {
		var t;
		t = $clone(this, Time);
		t.loc = $pkg.UTC;
		return t;
	};
	Time.prototype.UTC = function() { return this.$val.UTC(); };
	Time.ptr.prototype.Local = function() {
		var t;
		t = $clone(this, Time);
		t.loc = $pkg.Local;
		return t;
	};
	Time.prototype.Local = function() { return this.$val.Local(); };
	Time.ptr.prototype.In = function(loc) {
		var t;
		t = $clone(this, Time);
		if (loc === ptrType$1.nil) {
			$panic(new $String("time: missing Location in call to Time.In"));
		}
		t.loc = loc;
		return t;
	};
	Time.prototype.In = function(loc) { return this.$val.In(loc); };
	Time.ptr.prototype.Location = function() {
		var l, t;
		t = $clone(this, Time);
		l = t.loc;
		if (l === ptrType$1.nil) {
			l = $pkg.UTC;
		}
		return l;
	};
	Time.prototype.Location = function() { return this.$val.Location(); };
	Time.ptr.prototype.Zone = function() {
		var _tuple$1, name = "", offset = 0, t, x;
		t = $clone(this, Time);
		_tuple$1 = t.loc.lookup((x = t.sec, new $Int64(x.$high + -15, x.$low + 2288912640))); name = _tuple$1[0]; offset = _tuple$1[1];
		return [name, offset];
	};
	Time.prototype.Zone = function() { return this.$val.Zone(); };
	Time.ptr.prototype.Unix = function() {
		var t, x;
		t = $clone(this, Time);
		return (x = t.sec, new $Int64(x.$high + -15, x.$low + 2288912640));
	};
	Time.prototype.Unix = function() { return this.$val.Unix(); };
	Time.ptr.prototype.UnixNano = function() {
		var t, x, x$1, x$2;
		t = $clone(this, Time);
		return (x = $mul64(((x$1 = t.sec, new $Int64(x$1.$high + -15, x$1.$low + 2288912640))), new $Int64(0, 1000000000)), x$2 = new $Int64(0, t.nsec), new $Int64(x.$high + x$2.$high, x.$low + x$2.$low));
	};
	Time.prototype.UnixNano = function() { return this.$val.UnixNano(); };
	Time.ptr.prototype.MarshalBinary = function() {
		var _q, _r, _tuple$1, enc, offset, offsetMin, t;
		t = $clone(this, Time);
		offsetMin = 0;
		if (t.Location() === utcLoc) {
			offsetMin = -1;
		} else {
			_tuple$1 = t.Zone(); offset = _tuple$1[1];
			if (!(((_r = offset % 60, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) === 0))) {
				return [sliceType$3.nil, errors.New("Time.MarshalBinary: zone offset has fractional minute")];
			}
			offset = (_q = offset / (60), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero"));
			if (offset < -32768 || (offset === -1) || offset > 32767) {
				return [sliceType$3.nil, errors.New("Time.MarshalBinary: unexpected zone offset")];
			}
			offsetMin = (offset << 16 >> 16);
		}
		enc = new sliceType$3([1, ($shiftRightInt64(t.sec, 56).$low << 24 >>> 24), ($shiftRightInt64(t.sec, 48).$low << 24 >>> 24), ($shiftRightInt64(t.sec, 40).$low << 24 >>> 24), ($shiftRightInt64(t.sec, 32).$low << 24 >>> 24), ($shiftRightInt64(t.sec, 24).$low << 24 >>> 24), ($shiftRightInt64(t.sec, 16).$low << 24 >>> 24), ($shiftRightInt64(t.sec, 8).$low << 24 >>> 24), (t.sec.$low << 24 >>> 24), ((t.nsec >> 24 >> 0) << 24 >>> 24), ((t.nsec >> 16 >> 0) << 24 >>> 24), ((t.nsec >> 8 >> 0) << 24 >>> 24), (t.nsec << 24 >>> 24), ((offsetMin >> 8 << 16 >> 16) << 24 >>> 24), (offsetMin << 24 >>> 24)]);
		return [enc, $ifaceNil];
	};
	Time.prototype.MarshalBinary = function() { return this.$val.MarshalBinary(); };
	Time.ptr.prototype.UnmarshalBinary = function(data$1) {
		var _tuple$1, buf, localoff, offset, t, x, x$1, x$10, x$11, x$12, x$13, x$14, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9;
		t = this;
		buf = data$1;
		if (buf.$length === 0) {
			return errors.New("Time.UnmarshalBinary: no data");
		}
		if (!((((0 < 0 || 0 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 0]) === 1))) {
			return errors.New("Time.UnmarshalBinary: unsupported version");
		}
		if (!((buf.$length === 15))) {
			return errors.New("Time.UnmarshalBinary: invalid length");
		}
		buf = $subslice(buf, 1);
		t.sec = (x = (x$1 = (x$2 = (x$3 = (x$4 = (x$5 = (x$6 = new $Int64(0, ((7 < 0 || 7 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 7])), x$7 = $shiftLeft64(new $Int64(0, ((6 < 0 || 6 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 6])), 8), new $Int64(x$6.$high | x$7.$high, (x$6.$low | x$7.$low) >>> 0)), x$8 = $shiftLeft64(new $Int64(0, ((5 < 0 || 5 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 5])), 16), new $Int64(x$5.$high | x$8.$high, (x$5.$low | x$8.$low) >>> 0)), x$9 = $shiftLeft64(new $Int64(0, ((4 < 0 || 4 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 4])), 24), new $Int64(x$4.$high | x$9.$high, (x$4.$low | x$9.$low) >>> 0)), x$10 = $shiftLeft64(new $Int64(0, ((3 < 0 || 3 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 3])), 32), new $Int64(x$3.$high | x$10.$high, (x$3.$low | x$10.$low) >>> 0)), x$11 = $shiftLeft64(new $Int64(0, ((2 < 0 || 2 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 2])), 40), new $Int64(x$2.$high | x$11.$high, (x$2.$low | x$11.$low) >>> 0)), x$12 = $shiftLeft64(new $Int64(0, ((1 < 0 || 1 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 1])), 48), new $Int64(x$1.$high | x$12.$high, (x$1.$low | x$12.$low) >>> 0)), x$13 = $shiftLeft64(new $Int64(0, ((0 < 0 || 0 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 0])), 56), new $Int64(x.$high | x$13.$high, (x.$low | x$13.$low) >>> 0));
		buf = $subslice(buf, 8);
		t.nsec = (((((3 < 0 || 3 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 3]) >> 0) | ((((2 < 0 || 2 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 2]) >> 0) << 8 >> 0)) | ((((1 < 0 || 1 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 1]) >> 0) << 16 >> 0)) | ((((0 < 0 || 0 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 0]) >> 0) << 24 >> 0);
		buf = $subslice(buf, 4);
		offset = (((((1 < 0 || 1 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 1]) << 16 >> 16) | ((((0 < 0 || 0 >= buf.$length) ? $throwRuntimeError("index out of range") : buf.$array[buf.$offset + 0]) << 16 >> 16) << 8 << 16 >> 16)) >> 0) * 60 >> 0;
		if (offset === -60) {
			t.loc = utcLoc;
		} else {
			_tuple$1 = $pkg.Local.lookup((x$14 = t.sec, new $Int64(x$14.$high + -15, x$14.$low + 2288912640))); localoff = _tuple$1[1];
			if (offset === localoff) {
				t.loc = $pkg.Local;
			} else {
				t.loc = FixedZone("", offset);
			}
		}
		return $ifaceNil;
	};
	Time.prototype.UnmarshalBinary = function(data$1) { return this.$val.UnmarshalBinary(data$1); };
	Time.ptr.prototype.GobEncode = function() {
		var t;
		t = $clone(this, Time);
		return t.MarshalBinary();
	};
	Time.prototype.GobEncode = function() { return this.$val.GobEncode(); };
	Time.ptr.prototype.GobDecode = function(data$1) {
		var t;
		t = this;
		return t.UnmarshalBinary(data$1);
	};
	Time.prototype.GobDecode = function(data$1) { return this.$val.GobDecode(data$1); };
	Time.ptr.prototype.MarshalJSON = function() {
		var t, y;
		t = $clone(this, Time);
		y = t.Year();
		if (y < 0 || y >= 10000) {
			return [sliceType$3.nil, errors.New("Time.MarshalJSON: year outside of range [0,9999]")];
		}
		return [new sliceType$3($stringToBytes(t.Format("\"2006-01-02T15:04:05.999999999Z07:00\""))), $ifaceNil];
	};
	Time.prototype.MarshalJSON = function() { return this.$val.MarshalJSON(); };
	Time.ptr.prototype.UnmarshalJSON = function(data$1) {
		var _tuple$1, err = $ifaceNil, t;
		t = this;
		_tuple$1 = Parse("\"2006-01-02T15:04:05Z07:00\"", $bytesToString(data$1)); $copy(t, _tuple$1[0], Time); err = _tuple$1[1];
		return err;
	};
	Time.prototype.UnmarshalJSON = function(data$1) { return this.$val.UnmarshalJSON(data$1); };
	Time.ptr.prototype.MarshalText = function() {
		var t, y;
		t = $clone(this, Time);
		y = t.Year();
		if (y < 0 || y >= 10000) {
			return [sliceType$3.nil, errors.New("Time.MarshalText: year outside of range [0,9999]")];
		}
		return [new sliceType$3($stringToBytes(t.Format("2006-01-02T15:04:05.999999999Z07:00"))), $ifaceNil];
	};
	Time.prototype.MarshalText = function() { return this.$val.MarshalText(); };
	Time.ptr.prototype.UnmarshalText = function(data$1) {
		var _tuple$1, err = $ifaceNil, t;
		t = this;
		_tuple$1 = Parse("2006-01-02T15:04:05Z07:00", $bytesToString(data$1)); $copy(t, _tuple$1[0], Time); err = _tuple$1[1];
		return err;
	};
	Time.prototype.UnmarshalText = function(data$1) { return this.$val.UnmarshalText(data$1); };
	isLeap = function(year) {
		var _r, _r$1, _r$2;
		return ((_r = year % 4, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) === 0) && (!(((_r$1 = year % 100, _r$1 === _r$1 ? _r$1 : $throwRuntimeError("integer divide by zero")) === 0)) || ((_r$2 = year % 400, _r$2 === _r$2 ? _r$2 : $throwRuntimeError("integer divide by zero")) === 0));
	};
	norm = function(hi, lo, base) {
		var _q, _q$1, _tmp, _tmp$1, n, n$1, nhi = 0, nlo = 0;
		if (lo < 0) {
			n = (_q = ((-lo - 1 >> 0)) / base, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero")) + 1 >> 0;
			hi = hi - (n) >> 0;
			lo = lo + ((n * base >> 0)) >> 0;
		}
		if (lo >= base) {
			n$1 = (_q$1 = lo / base, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : $throwRuntimeError("integer divide by zero"));
			hi = hi + (n$1) >> 0;
			lo = lo - ((n$1 * base >> 0)) >> 0;
		}
		_tmp = hi; _tmp$1 = lo; nhi = _tmp; nlo = _tmp$1;
		return [nhi, nlo];
	};
	Date = $pkg.Date = function(year, month, day, hour, min, sec, nsec, loc) {
		var _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8, abs, d, end, m, n, offset, start, unix, utc, x, x$1, x$10, x$11, x$12, x$13, x$14, x$15, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9, y;
		if (loc === ptrType$1.nil) {
			$panic(new $String("time: missing Location in call to Date"));
		}
		m = (month >> 0) - 1 >> 0;
		_tuple$1 = norm(year, m, 12); year = _tuple$1[0]; m = _tuple$1[1];
		month = (m >> 0) + 1 >> 0;
		_tuple$2 = norm(sec, nsec, 1000000000); sec = _tuple$2[0]; nsec = _tuple$2[1];
		_tuple$3 = norm(min, sec, 60); min = _tuple$3[0]; sec = _tuple$3[1];
		_tuple$4 = norm(hour, min, 60); hour = _tuple$4[0]; min = _tuple$4[1];
		_tuple$5 = norm(day, hour, 24); day = _tuple$5[0]; hour = _tuple$5[1];
		y = (x = (x$1 = new $Int64(0, year), new $Int64(x$1.$high - -69, x$1.$low - 4075721025)), new $Uint64(x.$high, x.$low));
		n = $div64(y, new $Uint64(0, 400), false);
		y = (x$2 = $mul64(new $Uint64(0, 400), n), new $Uint64(y.$high - x$2.$high, y.$low - x$2.$low));
		d = $mul64(new $Uint64(0, 146097), n);
		n = $div64(y, new $Uint64(0, 100), false);
		y = (x$3 = $mul64(new $Uint64(0, 100), n), new $Uint64(y.$high - x$3.$high, y.$low - x$3.$low));
		d = (x$4 = $mul64(new $Uint64(0, 36524), n), new $Uint64(d.$high + x$4.$high, d.$low + x$4.$low));
		n = $div64(y, new $Uint64(0, 4), false);
		y = (x$5 = $mul64(new $Uint64(0, 4), n), new $Uint64(y.$high - x$5.$high, y.$low - x$5.$low));
		d = (x$6 = $mul64(new $Uint64(0, 1461), n), new $Uint64(d.$high + x$6.$high, d.$low + x$6.$low));
		n = y;
		d = (x$7 = $mul64(new $Uint64(0, 365), n), new $Uint64(d.$high + x$7.$high, d.$low + x$7.$low));
		d = (x$8 = new $Uint64(0, (x$9 = month - 1 >> 0, ((x$9 < 0 || x$9 >= daysBefore.length) ? $throwRuntimeError("index out of range") : daysBefore[x$9]))), new $Uint64(d.$high + x$8.$high, d.$low + x$8.$low));
		if (isLeap(year) && month >= 3) {
			d = (x$10 = new $Uint64(0, 1), new $Uint64(d.$high + x$10.$high, d.$low + x$10.$low));
		}
		d = (x$11 = new $Uint64(0, (day - 1 >> 0)), new $Uint64(d.$high + x$11.$high, d.$low + x$11.$low));
		abs = $mul64(d, new $Uint64(0, 86400));
		abs = (x$12 = new $Uint64(0, (((hour * 3600 >> 0) + (min * 60 >> 0) >> 0) + sec >> 0)), new $Uint64(abs.$high + x$12.$high, abs.$low + x$12.$low));
		unix = (x$13 = new $Int64(abs.$high, abs.$low), new $Int64(x$13.$high + -2147483647, x$13.$low + 3844486912));
		_tuple$6 = loc.lookup(unix); offset = _tuple$6[1]; start = _tuple$6[3]; end = _tuple$6[4];
		if (!((offset === 0))) {
			utc = (x$14 = new $Int64(0, offset), new $Int64(unix.$high - x$14.$high, unix.$low - x$14.$low));
			if ((utc.$high < start.$high || (utc.$high === start.$high && utc.$low < start.$low))) {
				_tuple$7 = loc.lookup(new $Int64(start.$high - 0, start.$low - 1)); offset = _tuple$7[1];
			} else if ((utc.$high > end.$high || (utc.$high === end.$high && utc.$low >= end.$low))) {
				_tuple$8 = loc.lookup(end); offset = _tuple$8[1];
			}
			unix = (x$15 = new $Int64(0, offset), new $Int64(unix.$high - x$15.$high, unix.$low - x$15.$low));
		}
		return new Time.ptr(new $Int64(unix.$high + 14, unix.$low + 2006054656), (nsec >> 0), loc);
	};
	Time.ptr.prototype.Truncate = function(d) {
		var _tuple$1, r, t;
		t = $clone(this, Time);
		if ((d.$high < 0 || (d.$high === 0 && d.$low <= 0))) {
			return t;
		}
		_tuple$1 = div(t, d); r = _tuple$1[1];
		return t.Add(new Duration(-r.$high, -r.$low));
	};
	Time.prototype.Truncate = function(d) { return this.$val.Truncate(d); };
	Time.ptr.prototype.Round = function(d) {
		var _tuple$1, r, t, x;
		t = $clone(this, Time);
		if ((d.$high < 0 || (d.$high === 0 && d.$low <= 0))) {
			return t;
		}
		_tuple$1 = div(t, d); r = _tuple$1[1];
		if ((x = new Duration(r.$high + r.$high, r.$low + r.$low), (x.$high < d.$high || (x.$high === d.$high && x.$low < d.$low)))) {
			return t.Add(new Duration(-r.$high, -r.$low));
		}
		return t.Add(new Duration(d.$high - r.$high, d.$low - r.$low));
	};
	Time.prototype.Round = function(d) { return this.$val.Round(d); };
	div = function(t, d) {
		var _q, _r, _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, d0, d1, d1$1, neg, nsec, qmod2 = 0, r = new Duration(0, 0), sec, tmp, u0, u0x, u1, x, x$1, x$10, x$11, x$12, x$13, x$14, x$15, x$16, x$17, x$18, x$19, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9;
		t = $clone(t, Time);
		neg = false;
		nsec = t.nsec;
		if ((x = t.sec, (x.$high < 0 || (x.$high === 0 && x.$low < 0)))) {
			neg = true;
			t.sec = (x$1 = t.sec, new $Int64(-x$1.$high, -x$1.$low));
			nsec = -nsec;
			if (nsec < 0) {
				nsec = nsec + (1000000000) >> 0;
				t.sec = (x$2 = t.sec, x$3 = new $Int64(0, 1), new $Int64(x$2.$high - x$3.$high, x$2.$low - x$3.$low));
			}
		}
		if ((d.$high < 0 || (d.$high === 0 && d.$low < 1000000000)) && (x$4 = $div64(new Duration(0, 1000000000), (new Duration(d.$high + d.$high, d.$low + d.$low)), true), (x$4.$high === 0 && x$4.$low === 0))) {
			qmod2 = ((_q = nsec / ((d.$low + ((d.$high >> 31) * 4294967296)) >> 0), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero")) >> 0) & 1;
			r = new Duration(0, (_r = nsec % ((d.$low + ((d.$high >> 31) * 4294967296)) >> 0), _r === _r ? _r : $throwRuntimeError("integer divide by zero")));
		} else if ((x$5 = $div64(d, new Duration(0, 1000000000), true), (x$5.$high === 0 && x$5.$low === 0))) {
			d1 = (x$6 = $div64(d, new Duration(0, 1000000000), false), new $Int64(x$6.$high, x$6.$low));
			qmod2 = ((x$7 = $div64(t.sec, d1, false), x$7.$low + ((x$7.$high >> 31) * 4294967296)) >> 0) & 1;
			r = (x$8 = $mul64((x$9 = $div64(t.sec, d1, true), new Duration(x$9.$high, x$9.$low)), new Duration(0, 1000000000)), x$10 = new Duration(0, nsec), new Duration(x$8.$high + x$10.$high, x$8.$low + x$10.$low));
		} else {
			sec = (x$11 = t.sec, new $Uint64(x$11.$high, x$11.$low));
			tmp = $mul64(($shiftRightUint64(sec, 32)), new $Uint64(0, 1000000000));
			u1 = $shiftRightUint64(tmp, 32);
			u0 = $shiftLeft64(tmp, 32);
			tmp = $mul64(new $Uint64(sec.$high & 0, (sec.$low & 4294967295) >>> 0), new $Uint64(0, 1000000000));
			_tmp = u0; _tmp$1 = new $Uint64(u0.$high + tmp.$high, u0.$low + tmp.$low); u0x = _tmp; u0 = _tmp$1;
			if ((u0.$high < u0x.$high || (u0.$high === u0x.$high && u0.$low < u0x.$low))) {
				u1 = (x$12 = new $Uint64(0, 1), new $Uint64(u1.$high + x$12.$high, u1.$low + x$12.$low));
			}
			_tmp$2 = u0; _tmp$3 = (x$13 = new $Uint64(0, nsec), new $Uint64(u0.$high + x$13.$high, u0.$low + x$13.$low)); u0x = _tmp$2; u0 = _tmp$3;
			if ((u0.$high < u0x.$high || (u0.$high === u0x.$high && u0.$low < u0x.$low))) {
				u1 = (x$14 = new $Uint64(0, 1), new $Uint64(u1.$high + x$14.$high, u1.$low + x$14.$low));
			}
			d1$1 = new $Uint64(d.$high, d.$low);
			while (!((x$15 = $shiftRightUint64(d1$1, 63), (x$15.$high === 0 && x$15.$low === 1)))) {
				d1$1 = $shiftLeft64(d1$1, (1));
			}
			d0 = new $Uint64(0, 0);
			while (true) {
				qmod2 = 0;
				if ((u1.$high > d1$1.$high || (u1.$high === d1$1.$high && u1.$low > d1$1.$low)) || (u1.$high === d1$1.$high && u1.$low === d1$1.$low) && (u0.$high > d0.$high || (u0.$high === d0.$high && u0.$low >= d0.$low))) {
					qmod2 = 1;
					_tmp$4 = u0; _tmp$5 = new $Uint64(u0.$high - d0.$high, u0.$low - d0.$low); u0x = _tmp$4; u0 = _tmp$5;
					if ((u0.$high > u0x.$high || (u0.$high === u0x.$high && u0.$low > u0x.$low))) {
						u1 = (x$16 = new $Uint64(0, 1), new $Uint64(u1.$high - x$16.$high, u1.$low - x$16.$low));
					}
					u1 = (x$17 = d1$1, new $Uint64(u1.$high - x$17.$high, u1.$low - x$17.$low));
				}
				if ((d1$1.$high === 0 && d1$1.$low === 0) && (x$18 = new $Uint64(d.$high, d.$low), (d0.$high === x$18.$high && d0.$low === x$18.$low))) {
					break;
				}
				d0 = $shiftRightUint64(d0, (1));
				d0 = (x$19 = $shiftLeft64((new $Uint64(d1$1.$high & 0, (d1$1.$low & 1) >>> 0)), 63), new $Uint64(d0.$high | x$19.$high, (d0.$low | x$19.$low) >>> 0));
				d1$1 = $shiftRightUint64(d1$1, (1));
			}
			r = new Duration(u0.$high, u0.$low);
		}
		if (neg && !((r.$high === 0 && r.$low === 0))) {
			qmod2 = (qmod2 ^ (1)) >> 0;
			r = new Duration(d.$high - r.$high, d.$low - r.$low);
		}
		return [qmod2, r];
	};
	Location.ptr.prototype.get = function() {
		var l;
		l = this;
		if (l === ptrType$1.nil) {
			return utcLoc;
		}
		if (l === localLoc) {
			localOnce.Do(initLocal);
		}
		return l;
	};
	Location.prototype.get = function() { return this.$val.get(); };
	Location.ptr.prototype.String = function() {
		var l;
		l = this;
		return l.get().name;
	};
	Location.prototype.String = function() { return this.$val.String(); };
	FixedZone = $pkg.FixedZone = function(name, offset) {
		var l, x;
		l = new Location.ptr(name, new sliceType$1([new zone.ptr(name, offset, false)]), new sliceType$2([new zoneTrans.ptr(new $Int64(-2147483648, 0), 0, false, false)]), new $Int64(-2147483648, 0), new $Int64(2147483647, 4294967295), ptrType.nil);
		l.cacheZone = (x = l.zone, ((0 < 0 || 0 >= x.$length) ? $throwRuntimeError("index out of range") : x.$array[x.$offset + 0]));
		return l;
	};
	Location.ptr.prototype.lookup = function(sec) {
		var _q, end = new $Int64(0, 0), hi, isDST = false, l, lim, lo, m, name = "", offset = 0, start = new $Int64(0, 0), tx, x, x$1, x$2, x$3, x$4, x$5, x$6, x$7, x$8, zone$1, zone$2, zone$3;
		l = this;
		l = l.get();
		if (l.zone.$length === 0) {
			name = "UTC";
			offset = 0;
			isDST = false;
			start = new $Int64(-2147483648, 0);
			end = new $Int64(2147483647, 4294967295);
			return [name, offset, isDST, start, end];
		}
		zone$1 = l.cacheZone;
		if (!(zone$1 === ptrType.nil) && (x = l.cacheStart, (x.$high < sec.$high || (x.$high === sec.$high && x.$low <= sec.$low))) && (x$1 = l.cacheEnd, (sec.$high < x$1.$high || (sec.$high === x$1.$high && sec.$low < x$1.$low)))) {
			name = zone$1.name;
			offset = zone$1.offset;
			isDST = zone$1.isDST;
			start = l.cacheStart;
			end = l.cacheEnd;
			return [name, offset, isDST, start, end];
		}
		if ((l.tx.$length === 0) || (x$2 = (x$3 = l.tx, ((0 < 0 || 0 >= x$3.$length) ? $throwRuntimeError("index out of range") : x$3.$array[x$3.$offset + 0])).when, (sec.$high < x$2.$high || (sec.$high === x$2.$high && sec.$low < x$2.$low)))) {
			zone$2 = (x$4 = l.zone, x$5 = l.lookupFirstZone(), ((x$5 < 0 || x$5 >= x$4.$length) ? $throwRuntimeError("index out of range") : x$4.$array[x$4.$offset + x$5]));
			name = zone$2.name;
			offset = zone$2.offset;
			isDST = zone$2.isDST;
			start = new $Int64(-2147483648, 0);
			if (l.tx.$length > 0) {
				end = (x$6 = l.tx, ((0 < 0 || 0 >= x$6.$length) ? $throwRuntimeError("index out of range") : x$6.$array[x$6.$offset + 0])).when;
			} else {
				end = new $Int64(2147483647, 4294967295);
			}
			return [name, offset, isDST, start, end];
		}
		tx = l.tx;
		end = new $Int64(2147483647, 4294967295);
		lo = 0;
		hi = tx.$length;
		while ((hi - lo >> 0) > 1) {
			m = lo + (_q = ((hi - lo >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : $throwRuntimeError("integer divide by zero")) >> 0;
			lim = ((m < 0 || m >= tx.$length) ? $throwRuntimeError("index out of range") : tx.$array[tx.$offset + m]).when;
			if ((sec.$high < lim.$high || (sec.$high === lim.$high && sec.$low < lim.$low))) {
				end = lim;
				hi = m;
			} else {
				lo = m;
			}
		}
		zone$3 = (x$7 = l.zone, x$8 = ((lo < 0 || lo >= tx.$length) ? $throwRuntimeError("index out of range") : tx.$array[tx.$offset + lo]).index, ((x$8 < 0 || x$8 >= x$7.$length) ? $throwRuntimeError("index out of range") : x$7.$array[x$7.$offset + x$8]));
		name = zone$3.name;
		offset = zone$3.offset;
		isDST = zone$3.isDST;
		start = ((lo < 0 || lo >= tx.$length) ? $throwRuntimeError("index out of range") : tx.$array[tx.$offset + lo]).when;
		return [name, offset, isDST, start, end];
	};
	Location.prototype.lookup = function(sec) { return this.$val.lookup(sec); };
	Location.ptr.prototype.lookupFirstZone = function() {
		var _i, _ref, l, x, x$1, x$2, x$3, x$4, x$5, zi, zi$1;
		l = this;
		if (!l.firstZoneUsed()) {
			return 0;
		}
		if (l.tx.$length > 0 && (x = l.zone, x$1 = (x$2 = l.tx, ((0 < 0 || 0 >= x$2.$length) ? $throwRuntimeError("index out of range") : x$2.$array[x$2.$offset + 0])).index, ((x$1 < 0 || x$1 >= x.$length) ? $throwRuntimeError("index out of range") : x.$array[x.$offset + x$1])).isDST) {
			zi = ((x$3 = l.tx, ((0 < 0 || 0 >= x$3.$length) ? $throwRuntimeError("index out of range") : x$3.$array[x$3.$offset + 0])).index >> 0) - 1 >> 0;
			while (zi >= 0) {
				if (!(x$4 = l.zone, ((zi < 0 || zi >= x$4.$length) ? $throwRuntimeError("index out of range") : x$4.$array[x$4.$offset + zi])).isDST) {
					return zi;
				}
				zi = zi - (1) >> 0;
			}
		}
		_ref = l.zone;
		_i = 0;
		while (_i < _ref.$length) {
			zi$1 = _i;
			if (!(x$5 = l.zone, ((zi$1 < 0 || zi$1 >= x$5.$length) ? $throwRuntimeError("index out of range") : x$5.$array[x$5.$offset + zi$1])).isDST) {
				return zi$1;
			}
			_i++;
		}
		return 0;
	};
	Location.prototype.lookupFirstZone = function() { return this.$val.lookupFirstZone(); };
	Location.ptr.prototype.firstZoneUsed = function() {
		var _i, _ref, l, tx;
		l = this;
		_ref = l.tx;
		_i = 0;
		while (_i < _ref.$length) {
			tx = $clone(((_i < 0 || _i >= _ref.$length) ? $throwRuntimeError("index out of range") : _ref.$array[_ref.$offset + _i]), zoneTrans);
			if (tx.index === 0) {
				return true;
			}
			_i++;
		}
		return false;
	};
	Location.prototype.firstZoneUsed = function() { return this.$val.firstZoneUsed(); };
	Location.ptr.prototype.lookupName = function(name, unix) {
		var _i, _i$1, _ref, _ref$1, _tmp, _tmp$1, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tuple$1, i, i$1, isDST = false, isDST$1, l, nam, offset = 0, offset$1, ok = false, x, x$1, x$2, zone$1, zone$2;
		l = this;
		l = l.get();
		_ref = l.zone;
		_i = 0;
		while (_i < _ref.$length) {
			i = _i;
			zone$1 = (x = l.zone, ((i < 0 || i >= x.$length) ? $throwRuntimeError("index out of range") : x.$array[x.$offset + i]));
			if (zone$1.name === name) {
				_tuple$1 = l.lookup((x$1 = new $Int64(0, zone$1.offset), new $Int64(unix.$high - x$1.$high, unix.$low - x$1.$low))); nam = _tuple$1[0]; offset$1 = _tuple$1[1]; isDST$1 = _tuple$1[2];
				if (nam === zone$1.name) {
					_tmp = offset$1; _tmp$1 = isDST$1; _tmp$2 = true; offset = _tmp; isDST = _tmp$1; ok = _tmp$2;
					return [offset, isDST, ok];
				}
			}
			_i++;
		}
		_ref$1 = l.zone;
		_i$1 = 0;
		while (_i$1 < _ref$1.$length) {
			i$1 = _i$1;
			zone$2 = (x$2 = l.zone, ((i$1 < 0 || i$1 >= x$2.$length) ? $throwRuntimeError("index out of range") : x$2.$array[x$2.$offset + i$1]));
			if (zone$2.name === name) {
				_tmp$3 = zone$2.offset; _tmp$4 = zone$2.isDST; _tmp$5 = true; offset = _tmp$3; isDST = _tmp$4; ok = _tmp$5;
				return [offset, isDST, ok];
			}
			_i$1++;
		}
		return [offset, isDST, ok];
	};
	Location.prototype.lookupName = function(name, unix) { return this.$val.lookupName(name, unix); };
	ptrType$6.methods = [{prop: "Error", name: "Error", pkg: "", type: $funcType([], [$String], false)}];
	Time.methods = [{prop: "Add", name: "Add", pkg: "", type: $funcType([Duration], [Time], false)}, {prop: "AddDate", name: "AddDate", pkg: "", type: $funcType([$Int, $Int, $Int], [Time], false)}, {prop: "After", name: "After", pkg: "", type: $funcType([Time], [$Bool], false)}, {prop: "Before", name: "Before", pkg: "", type: $funcType([Time], [$Bool], false)}, {prop: "Clock", name: "Clock", pkg: "", type: $funcType([], [$Int, $Int, $Int], false)}, {prop: "Date", name: "Date", pkg: "", type: $funcType([], [$Int, Month, $Int], false)}, {prop: "Day", name: "Day", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Equal", name: "Equal", pkg: "", type: $funcType([Time], [$Bool], false)}, {prop: "Format", name: "Format", pkg: "", type: $funcType([$String], [$String], false)}, {prop: "GobEncode", name: "GobEncode", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "Hour", name: "Hour", pkg: "", type: $funcType([], [$Int], false)}, {prop: "ISOWeek", name: "ISOWeek", pkg: "", type: $funcType([], [$Int, $Int], false)}, {prop: "In", name: "In", pkg: "", type: $funcType([ptrType$1], [Time], false)}, {prop: "IsZero", name: "IsZero", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Local", name: "Local", pkg: "", type: $funcType([], [Time], false)}, {prop: "Location", name: "Location", pkg: "", type: $funcType([], [ptrType$1], false)}, {prop: "MarshalBinary", name: "MarshalBinary", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "MarshalJSON", name: "MarshalJSON", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "MarshalText", name: "MarshalText", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "Minute", name: "Minute", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Month", name: "Month", pkg: "", type: $funcType([], [Month], false)}, {prop: "Nanosecond", name: "Nanosecond", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Round", name: "Round", pkg: "", type: $funcType([Duration], [Time], false)}, {prop: "Second", name: "Second", pkg: "", type: $funcType([], [$Int], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Sub", name: "Sub", pkg: "", type: $funcType([Time], [Duration], false)}, {prop: "Truncate", name: "Truncate", pkg: "", type: $funcType([Duration], [Time], false)}, {prop: "UTC", name: "UTC", pkg: "", type: $funcType([], [Time], false)}, {prop: "Unix", name: "Unix", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "UnixNano", name: "UnixNano", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Weekday", name: "Weekday", pkg: "", type: $funcType([], [Weekday], false)}, {prop: "Year", name: "Year", pkg: "", type: $funcType([], [$Int], false)}, {prop: "YearDay", name: "YearDay", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Zone", name: "Zone", pkg: "", type: $funcType([], [$String, $Int], false)}, {prop: "abs", name: "abs", pkg: "time", type: $funcType([], [$Uint64], false)}, {prop: "date", name: "date", pkg: "time", type: $funcType([$Bool], [$Int, Month, $Int, $Int], false)}, {prop: "locabs", name: "locabs", pkg: "time", type: $funcType([], [$String, $Int, $Uint64], false)}];
	ptrType$9.methods = [{prop: "Add", name: "Add", pkg: "", type: $funcType([Duration], [Time], false)}, {prop: "AddDate", name: "AddDate", pkg: "", type: $funcType([$Int, $Int, $Int], [Time], false)}, {prop: "After", name: "After", pkg: "", type: $funcType([Time], [$Bool], false)}, {prop: "Before", name: "Before", pkg: "", type: $funcType([Time], [$Bool], false)}, {prop: "Clock", name: "Clock", pkg: "", type: $funcType([], [$Int, $Int, $Int], false)}, {prop: "Date", name: "Date", pkg: "", type: $funcType([], [$Int, Month, $Int], false)}, {prop: "Day", name: "Day", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Equal", name: "Equal", pkg: "", type: $funcType([Time], [$Bool], false)}, {prop: "Format", name: "Format", pkg: "", type: $funcType([$String], [$String], false)}, {prop: "GobDecode", name: "GobDecode", pkg: "", type: $funcType([sliceType$3], [$error], false)}, {prop: "GobEncode", name: "GobEncode", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "Hour", name: "Hour", pkg: "", type: $funcType([], [$Int], false)}, {prop: "ISOWeek", name: "ISOWeek", pkg: "", type: $funcType([], [$Int, $Int], false)}, {prop: "In", name: "In", pkg: "", type: $funcType([ptrType$1], [Time], false)}, {prop: "IsZero", name: "IsZero", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Local", name: "Local", pkg: "", type: $funcType([], [Time], false)}, {prop: "Location", name: "Location", pkg: "", type: $funcType([], [ptrType$1], false)}, {prop: "MarshalBinary", name: "MarshalBinary", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "MarshalJSON", name: "MarshalJSON", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "MarshalText", name: "MarshalText", pkg: "", type: $funcType([], [sliceType$3, $error], false)}, {prop: "Minute", name: "Minute", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Month", name: "Month", pkg: "", type: $funcType([], [Month], false)}, {prop: "Nanosecond", name: "Nanosecond", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Round", name: "Round", pkg: "", type: $funcType([Duration], [Time], false)}, {prop: "Second", name: "Second", pkg: "", type: $funcType([], [$Int], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Sub", name: "Sub", pkg: "", type: $funcType([Time], [Duration], false)}, {prop: "Truncate", name: "Truncate", pkg: "", type: $funcType([Duration], [Time], false)}, {prop: "UTC", name: "UTC", pkg: "", type: $funcType([], [Time], false)}, {prop: "Unix", name: "Unix", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "UnixNano", name: "UnixNano", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "UnmarshalBinary", name: "UnmarshalBinary", pkg: "", type: $funcType([sliceType$3], [$error], false)}, {prop: "UnmarshalJSON", name: "UnmarshalJSON", pkg: "", type: $funcType([sliceType$3], [$error], false)}, {prop: "UnmarshalText", name: "UnmarshalText", pkg: "", type: $funcType([sliceType$3], [$error], false)}, {prop: "Weekday", name: "Weekday", pkg: "", type: $funcType([], [Weekday], false)}, {prop: "Year", name: "Year", pkg: "", type: $funcType([], [$Int], false)}, {prop: "YearDay", name: "YearDay", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Zone", name: "Zone", pkg: "", type: $funcType([], [$String, $Int], false)}, {prop: "abs", name: "abs", pkg: "time", type: $funcType([], [$Uint64], false)}, {prop: "date", name: "date", pkg: "time", type: $funcType([$Bool], [$Int, Month, $Int, $Int], false)}, {prop: "locabs", name: "locabs", pkg: "time", type: $funcType([], [$String, $Int, $Uint64], false)}];
	Month.methods = [{prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}];
	ptrType$10.methods = [{prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}];
	Weekday.methods = [{prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}];
	ptrType$11.methods = [{prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}];
	Duration.methods = [{prop: "Hours", name: "Hours", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Minutes", name: "Minutes", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Nanoseconds", name: "Nanoseconds", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Seconds", name: "Seconds", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}];
	ptrType$12.methods = [{prop: "Hours", name: "Hours", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Minutes", name: "Minutes", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Nanoseconds", name: "Nanoseconds", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Seconds", name: "Seconds", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}];
	ptrType$1.methods = [{prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "firstZoneUsed", name: "firstZoneUsed", pkg: "time", type: $funcType([], [$Bool], false)}, {prop: "get", name: "get", pkg: "time", type: $funcType([], [ptrType$1], false)}, {prop: "lookup", name: "lookup", pkg: "time", type: $funcType([$Int64], [$String, $Int, $Bool, $Int64, $Int64], false)}, {prop: "lookupFirstZone", name: "lookupFirstZone", pkg: "time", type: $funcType([], [$Int], false)}, {prop: "lookupName", name: "lookupName", pkg: "time", type: $funcType([$String, $Int64], [$Int, $Bool, $Bool], false)}];
	ParseError.init([{prop: "Layout", name: "Layout", pkg: "", type: $String, tag: ""}, {prop: "Value", name: "Value", pkg: "", type: $String, tag: ""}, {prop: "LayoutElem", name: "LayoutElem", pkg: "", type: $String, tag: ""}, {prop: "ValueElem", name: "ValueElem", pkg: "", type: $String, tag: ""}, {prop: "Message", name: "Message", pkg: "", type: $String, tag: ""}]);
	Time.init([{prop: "sec", name: "sec", pkg: "time", type: $Int64, tag: ""}, {prop: "nsec", name: "nsec", pkg: "time", type: $Int32, tag: ""}, {prop: "loc", name: "loc", pkg: "time", type: ptrType$1, tag: ""}]);
	Location.init([{prop: "name", name: "name", pkg: "time", type: $String, tag: ""}, {prop: "zone", name: "zone", pkg: "time", type: sliceType$1, tag: ""}, {prop: "tx", name: "tx", pkg: "time", type: sliceType$2, tag: ""}, {prop: "cacheStart", name: "cacheStart", pkg: "time", type: $Int64, tag: ""}, {prop: "cacheEnd", name: "cacheEnd", pkg: "time", type: $Int64, tag: ""}, {prop: "cacheZone", name: "cacheZone", pkg: "time", type: ptrType, tag: ""}]);
	zone.init([{prop: "name", name: "name", pkg: "time", type: $String, tag: ""}, {prop: "offset", name: "offset", pkg: "time", type: $Int, tag: ""}, {prop: "isDST", name: "isDST", pkg: "time", type: $Bool, tag: ""}]);
	zoneTrans.init([{prop: "when", name: "when", pkg: "time", type: $Int64, tag: ""}, {prop: "index", name: "index", pkg: "time", type: $Uint8, tag: ""}, {prop: "isstd", name: "isstd", pkg: "time", type: $Bool, tag: ""}, {prop: "isutc", name: "isutc", pkg: "time", type: $Bool, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_time = function() { while (true) { switch ($s) { case 0:
		$r = errors.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = js.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		$r = nosync.$init($BLOCKING); /* */ $s = 3; case 3: if ($r && $r.$blocking) { $r = $r(); }
		$r = runtime.$init($BLOCKING); /* */ $s = 4; case 4: if ($r && $r.$blocking) { $r = $r(); }
		$r = strings.$init($BLOCKING); /* */ $s = 5; case 5: if ($r && $r.$blocking) { $r = $r(); }
		$r = syscall.$init($BLOCKING); /* */ $s = 6; case 6: if ($r && $r.$blocking) { $r = $r(); }
		localLoc = new Location.ptr();
		localOnce = new nosync.Once.ptr();
		std0x = $toNativeArray($kindInt, [260, 265, 524, 526, 528, 274]);
		longDayNames = new sliceType(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
		shortDayNames = new sliceType(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
		shortMonthNames = new sliceType(["---", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
		longMonthNames = new sliceType(["---", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
		atoiError = errors.New("time: invalid number");
		errBad = errors.New("bad value for field");
		errLeadingInt = errors.New("time: bad [0-9]*");
		months = $toNativeArray($kindString, ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
		days = $toNativeArray($kindString, ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
		daysBefore = $toNativeArray($kindInt32, [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365]);
		utcLoc = new Location.ptr("UTC", sliceType$1.nil, sliceType$2.nil, new $Int64(0, 0), new $Int64(0, 0), ptrType.nil);
		$pkg.UTC = utcLoc;
		$pkg.Local = localLoc;
		_tuple = syscall.Getenv("ZONEINFO"); zoneinfo = _tuple[0];
		badData = errors.New("malformed time zone information");
		/* */ } return; } }; $init_time.$blocking = true; return $init_time;
	};
	return $pkg;
})();
$packages["main"] = (function() {
	var $pkg = {}, js, jquery, qunit, strconv, strings, time, Object, EvtScenario, working, sliceType, funcType, arrayType, sliceType$1, mapType, funcType$1, sliceType$2, funcType$2, funcType$3, funcType$4, funcType$5, funcType$6, funcType$7, funcType$8, funcType$9, funcType$10, funcType$11, funcType$12, funcType$13, funcType$14, funcType$15, funcType$16, ptrType, ptrType$1, jQuery, countJohn, countKarl, getDocumentBody, stringify, NewWorking, asyncEvent, main;
	js = $packages["github.com/gopherjs/gopherjs/js"];
	jquery = $packages["github.com/gopherjs/jquery"];
	qunit = $packages["github.com/rusco/qunit"];
	strconv = $packages["strconv"];
	strings = $packages["strings"];
	time = $packages["time"];
	Object = $pkg.Object = $newType(4, $kindMap, "main.Object", "Object", "main", null);
	EvtScenario = $pkg.EvtScenario = $newType(0, $kindStruct, "main.EvtScenario", "EvtScenario", "main", function() {
		this.$val = this;
	});
	working = $pkg.working = $newType(0, $kindStruct, "main.working", "working", "main", function(Deferred_) {
		this.$val = this;
		this.Deferred = Deferred_ !== undefined ? Deferred_ : new jquery.Deferred.ptr();
	});
		sliceType = $sliceType(js.Any);
		funcType = $funcType([], [], false);
		arrayType = $arrayType($String, 2);
		sliceType$1 = $sliceType($String);
		mapType = $mapType($String, $emptyInterface);
		funcType$1 = $funcType([], [js.Object], false);
		sliceType$2 = $sliceType($emptyInterface);
		funcType$2 = $funcType([], [$emptyInterface], false);
		funcType$3 = $funcType([$Int, $String], [$String], false);
		funcType$4 = $funcType([jquery.Event], [], false);
		funcType$5 = $funcType([jquery.Event], [], false);
		funcType$6 = $funcType([jquery.Event], [], false);
		funcType$7 = $funcType([$Int], [$Bool], false);
		funcType$8 = $funcType([jquery.Event], [], false);
		funcType$9 = $funcType([Object], [], false);
		funcType$10 = $funcType([$emptyInterface], [], false);
		funcType$11 = $funcType([$emptyInterface, $String, $emptyInterface], [], false);
		funcType$12 = $funcType([$emptyInterface], [], false);
		funcType$13 = $funcType([$emptyInterface, $String, $emptyInterface], [], false);
		funcType$14 = $funcType([$String], [], false);
		funcType$15 = $funcType([$Int], [$Int], false);
		funcType$16 = $funcType([$Int], [], false);
		ptrType = $ptrType(EvtScenario);
		ptrType$1 = $ptrType(working);
	EvtScenario.ptr.prototype.Setup = function() {
		var s;
		s = $clone(this, EvtScenario);
		jQuery(new sliceType([new $String("<p id=\"firstp\">See \n\t\t\t<a id=\"someid\" href=\"somehref\" rel=\"bookmark\">this blog entry</a>\n\t\t\tfor more information.</p>")])).AppendTo(new $String("#qunit-fixture"));
	};
	EvtScenario.prototype.Setup = function() { return this.$val.Setup(); };
	EvtScenario.ptr.prototype.Teardown = function() {
		var s;
		s = $clone(this, EvtScenario);
		jQuery(new sliceType([new $String("#qunit-fixture")])).Empty();
	};
	EvtScenario.prototype.Teardown = function() { return this.$val.Teardown(); };
	getDocumentBody = function() {
		return $global.document.body;
	};
	stringify = function(i) {
		return $internalize($global.JSON.stringify($externalize(i, $emptyInterface)), $String);
	};
	NewWorking = $pkg.NewWorking = function(d) {
		d = $clone(d, jquery.Deferred);
		return new working.ptr($clone(d, jquery.Deferred));
	};
	working.ptr.prototype.notify = function() {
		var w;
		w = $clone(this, working);
		if (w.Deferred.State() === "pending") {
			w.Deferred.Notify(new $String("working... "));
			$global.setTimeout($externalize($methodVal(w, "notify"), funcType), 500);
		}
	};
	working.prototype.notify = function() { return this.$val.notify(); };
	working.ptr.prototype.hi = function(name) {
		var w;
		w = $clone(this, working);
		if (name === "John") {
			countJohn = countJohn + (1) >> 0;
		} else if (name === "Karl") {
			countKarl = countKarl + (1) >> 0;
		}
	};
	working.prototype.hi = function(name) { return this.$val.hi(name); };
	asyncEvent = function(accept, i) {
		var dfd, wx;
		dfd = $clone(jquery.NewDeferred(), jquery.Deferred);
		if (accept) {
			$global.setTimeout($externalize((function() {
				dfd.Resolve(new sliceType([new $String("hurray")]));
			}), funcType), 200 * i >> 0);
		} else {
			$global.setTimeout($externalize((function() {
				dfd.Reject(new sliceType([new $String("sorry")]));
			}), funcType), 210 * i >> 0);
		}
		wx = $clone(NewWorking(dfd), working);
		$global.setTimeout($externalize($methodVal(wx, "notify"), funcType), 1);
		return dfd.Promise();
	};
	main = function() {
		var x;
		qunit.Module("Core");
		qunit.Test("jQuery Properties", (function(assert) {
			var jQ2;
			assert.Equal(new $String($internalize(jQuery(new sliceType([])).o.jquery, $String)), new $String("2.1.3"), "JQuery Version");
			assert.Equal(new $Int(($parseInt(jQuery(new sliceType([])).o.length) >> 0)), new $Int(0), "jQuery().Length");
			jQ2 = $clone(jQuery(new sliceType([new $String("body")])), jquery.JQuery);
			assert.Equal(new $String($internalize(jQ2.o.selector, $String)), new $String("body"), "jQ2 := jQuery(\"body\"); jQ2.Selector.Selector");
			assert.Equal(new $String($internalize(jQuery(new sliceType([new $String("body")])).o.selector, $String)), new $String("body"), "jQuery(\"body\").Selector");
		}));
		qunit.Test("Test Setup", (function(assert) {
			var test;
			test = $clone(jQuery(new sliceType([getDocumentBody()])).Find(new sliceType([new $String("#qunit-fixture")])), jquery.JQuery);
			assert.Equal(new $String($internalize(test.o.selector, $String)), new $String("#qunit-fixture"), "#qunit-fixture find Selector");
			assert.Equal(new $String($internalize(test.o.context, $String)), getDocumentBody(), "#qunit-fixture find Context");
		}));
		qunit.Test("Static Functions", (function(assert) {
			var _key, _key$1, _map, _map$1, o, x;
			jquery.GlobalEval("var globalEvalTest = 2;");
			assert.Equal(new $Int(($parseInt($global.globalEvalTest) >> 0)), new $Int(2), "GlobalEval: Test variable declarations are global");
			assert.Equal(new $String(jquery.Trim("  GopherJS  ")), new $String("GopherJS"), "Trim: leading and trailing space");
			assert.Equal(new $String(jquery.Type(new $Bool(true))), new $String("boolean"), "Type: Boolean");
			assert.Equal(new $String(jquery.Type((x = time.Now(), new x.constructor.elem(x)))), new $String("date"), "Type: Date");
			assert.Equal(new $String(jquery.Type(new $String("GopherJS"))), new $String("string"), "Type: String");
			assert.Equal(new $String(jquery.Type(new $Float64(12.21))), new $String("number"), "Type: Number");
			assert.Equal(new $String(jquery.Type($ifaceNil)), new $String("null"), "Type: Null");
			assert.Equal(new $String(jquery.Type(new arrayType($toNativeArray($kindString, ["go", "lang"])))), new $String("array"), "Type: Array");
			assert.Equal(new $String(jquery.Type(new sliceType$1(["go", "lang"]))), new $String("array"), "Type: Array");
			o = (_map = new $Map(), _key = "a", _map[_key] = { k: _key, v: new $Bool(true) }, _key = "b", _map[_key] = { k: _key, v: new $Float64(1.1) }, _key = "c", _map[_key] = { k: _key, v: new $String("more") }, _map);
			assert.Equal(new $String(jquery.Type(new mapType(o))), new $String("object"), "Type: Object");
			assert.Equal(new $String(jquery.Type(new funcType$1(getDocumentBody))), new $String("function"), "Type: Function");
			assert.Ok(new $Bool(!jquery.IsPlainObject(new $String(""))), "IsPlainObject: string");
			assert.Ok(new $Bool(jquery.IsPlainObject(new mapType(o))), "IsPlainObject: Object");
			assert.Ok(new $Bool(!jquery.IsEmptyObject(new mapType(o))), "IsEmptyObject: Object");
			assert.Ok(new $Bool(jquery.IsEmptyObject(new mapType((_map$1 = new $Map(), _map$1)))), "IsEmptyObject: Object");
			assert.Ok(new $Bool(!jquery.IsFunction(new $String(""))), "IsFunction: string");
			assert.Ok(new $Bool(jquery.IsFunction(new funcType$1(getDocumentBody))), "IsFunction: getDocumentBody");
			assert.Ok(new $Bool(!jquery.IsNumeric(new $String("a3a"))), "IsNumeric: string");
			assert.Ok(new $Bool(jquery.IsNumeric(new $String("0xFFF"))), "IsNumeric: hex");
			assert.Ok(new $Bool(jquery.IsNumeric(new $String("8e-2"))), "IsNumeric: exponential");
			assert.Ok(new $Bool(!jquery.IsXMLDoc(new funcType$1(getDocumentBody))), "HTML Body element");
		}));
		qunit.Test("ToArray,InArray", (function(assert) {
			var _i, _ref, arr, divs, str, v;
			jQuery(new sliceType([new $String("<div>a</div>\n\t\t\t\t<div>b</div>\n\t\t\t\t<div>c</div>")])).AppendTo(new $String("#qunit-fixture"));
			divs = $clone(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])), jquery.JQuery);
			assert.Equal(new $Int(($parseInt(divs.o.length) >> 0)), new $Int(3), "3 divs in Fixture inserted");
			str = "";
			_ref = divs.ToArray();
			_i = 0;
			while (_i < _ref.$length) {
				v = ((_i < 0 || _i >= _ref.$length) ? $throwRuntimeError("index out of range") : _ref.$array[_ref.$offset + _i]);
				str = str + (jQuery(new sliceType([v])).Text());
				_i++;
			}
			assert.Equal(new $String(str), new $String("abc"), "ToArray() allows range over selection");
			arr = new sliceType$2([new $String("a"), new $Int(3), new $Bool(true), new $Float64(2.2), new $String("GopherJS")]);
			assert.Equal(new $Int(jquery.InArray(new $Int(4), arr)), new $Int(-1), "InArray");
			assert.Equal(new $Int(jquery.InArray(new $Int(3), arr)), new $Int(1), "InArray");
			assert.Equal(new $Int(jquery.InArray(new $String("a"), arr)), new $Int(0), "InArray");
			assert.Equal(new $Int(jquery.InArray(new $String("b"), arr)), new $Int(-1), "InArray");
			assert.Equal(new $Int(jquery.InArray(new $String("GopherJS"), arr)), new $Int(4), "InArray");
		}));
		qunit.Test("ParseHTML, ParseXML, ParseJSON", (function(assert) {
			var _entry, arr, language, obj, str, xml, xmlDoc;
			str = "<ul>\n  \t\t\t\t<li class=\"firstclass\">list item 1</li>\n  \t\t\t\t<li>list item 2</li>\n  \t\t\t\t<li>list item 3</li>\n  \t\t\t\t<li>list item 4</li>\n  \t\t\t\t<li class=\"lastclass\">list item 5</li>\n\t\t\t\t</ul>";
			arr = jquery.ParseHTML(str);
			jQuery(new sliceType([arr])).AppendTo(new $String("#qunit-fixture"));
			assert.Equal(new $Int(($parseInt(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("ul li")])).o.length) >> 0)), new $Int(5), "ParseHTML");
			xml = "<rss version='2.0'><channel><title>RSS Title</title></channel></rss>";
			xmlDoc = jquery.ParseXML(xml);
			assert.Equal(new $String(jQuery(new sliceType([xmlDoc])).Find(new sliceType([new $String("title")])).Text()), new $String("RSS Title"), "ParseXML");
			obj = jquery.ParseJSON("{ \"language\": \"go\" }");
			language = $assertType((_entry = $assertType(obj, mapType)["language"], _entry !== undefined ? _entry.v : $ifaceNil), $String);
			assert.Equal(new $String(language), new $String("go"), "ParseJSON");
		}));
		qunit.Test("Grep", (function(assert) {
			var arr, arr2;
			arr = new sliceType$2([new $Int(1), new $Int(9), new $Int(3), new $Int(8), new $Int(6), new $Int(1), new $Int(5), new $Int(9), new $Int(4), new $Int(7), new $Int(3), new $Int(8), new $Int(6), new $Int(9), new $Int(1)]);
			arr2 = jquery.Grep(arr, (function(n, idx) {
				return !(($assertType(n, $Float64) === 5)) && idx > 4;
			}));
			assert.Equal(new $Int(arr2.$length), new $Int(9), "Grep");
		}));
		qunit.Test("Noop,Now", (function(assert) {
			var callSth, date, time$1;
			callSth = (function(fn) {
				return fn();
			});
			callSth(jquery.Noop);
			jquery.Noop();
			assert.Ok(new $Bool(jquery.IsFunction(new funcType$2(jquery.Noop))), "jquery.Noop");
			date = new ($global.Date)();
			time$1 = $parseFloat(date.getTime());
			assert.Ok(new $Bool(time$1 <= jquery.Now()), "jquery.Now()");
		}));
		qunit.Module("Dom");
		qunit.Test("AddClass,Clone,Add,AppendTo,Find", (function(assert) {
			var html, txt;
			jQuery(new sliceType([new $String("p")])).AddClass(new $String("wow")).Clone(new sliceType([])).Add(new sliceType([new $String("<span id='dom02'>WhatADay</span>")])).AppendTo(new $String("#qunit-fixture"));
			txt = jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("span#dom02")])).Text();
			assert.Equal(new $String(txt), new $String("WhatADay"), "Test of Clone, Add, AppendTo, Find, Text Functions");
			jQuery(new sliceType([new $String("#qunit-fixture")])).Empty();
			html = "\n\t\t\t<div>This div should be white</div>\n\t\t\t<div class=\"red\">This div will be green because it now has the \"green\" and \"red\" classes.\n\t\t\t   It would be red if the addClass function failed.</div>\n\t\t\t<div>This div should be white</div>\n\t\t\t<p>There are zero green divs</p>\n\n\t\t\t<button>some btn</button>";
			jQuery(new sliceType([new $String(html)])).AppendTo(new $String("#qunit-fixture"));
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).AddClass(new funcType$3((function(index, currentClass) {
				var addedClass;
				addedClass = "";
				if (currentClass === "red") {
					addedClass = "green";
					jQuery(new sliceType([new $String("p")])).SetText(new $String("There is one green div"));
				}
				return addedClass;
			})));
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("button")])).AddClass(new $String("red"));
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("button")])).HasClass("red")), "button hasClass red");
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("p")])).Text() === "There is one green div"), "There is one green div");
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div:eq(1)")])).HasClass("green")), "one div hasClass green");
			jQuery(new sliceType([new $String("#qunit-fixture")])).Empty();
		}));
		qunit.Test("Children,Append", (function(assert) {
			var j, x, x$1;
			j = $clone(jQuery(new sliceType([new $String("<div class=\"pipe animated\"><div class=\"pipe_upper\" style=\"height: 79px;\"></div><div class=\"guess top\" style=\"top: 114px;\"></div><div class=\"pipe_middle\" style=\"height: 100px; top: 179px;\"></div><div class=\"guess bottom\" style=\"bottom: 76px;\"></div><div class=\"pipe_lower\" style=\"height: 41px;\"></div><div class=\"question\"></div></div>")])), jquery.JQuery);
			assert.Ok(new $Bool((j.Html().length === 301)), "jQuery html len");
			j.Children(new $String(".question")).Append(new sliceType([(x = jQuery(new sliceType([new $String("<div class = \"question_digit first\" style = \"background-image: url('assets/font_big_3.png');\"></div>")])), new x.constructor.elem(x))]));
			assert.Ok(new $Bool((j.Html().length === 397)), "jquery html len after 1st jquery object append");
			j.Children(new $String(".question")).Append(new sliceType([(x$1 = jQuery(new sliceType([new $String("<div class = \"question_digit symbol\" style=\"background-image: url('assets/font_shitty_x.png');\"></div>")])), new x$1.constructor.elem(x$1))]));
			assert.Ok(new $Bool((j.Html().length === 497)), "jquery htm len after 2nd jquery object append");
			j.Children(new $String(".question")).Append(new sliceType([new $String("<div class = \"question_digit second\" style = \"background-image: url('assets/font_big_1.png');\"></div>")]));
			assert.Ok(new $Bool((j.Html().length === 594)), "jquery html len after html append");
		}));
		qunit.Test("ApiOnly:ScollFn,SetCss,CssArray,FadeOut", (function(assert) {
			var htmlsnippet, i;
			i = 0;
			while (i < 3) {
				jQuery(new sliceType([new $String("p")])).Clone(new sliceType([])).AppendTo(new $String("#qunit-fixture"));
				i = i + (1) >> 0;
			}
			jQuery(new sliceType([new $String("#qunit-fixture")])).Scroll(new sliceType([new funcType$4((function(e) {
				jQuery(new sliceType([new $String("span")])).SetCss(new sliceType([new $String("display"), new $String("inline")])).FadeOut(new sliceType([new $String("slow")]));
			}))]));
			htmlsnippet = "<style>\n\t\t\t  div {\n\t\t\t    height: 50px;\n\t\t\t    margin: 5px;\n\t\t\t    padding: 5px;\n\t\t\t    float: left;\n\t\t\t  }\n\t\t\t  #box1 {\n\t\t\t    width: 50px;\n\t\t\t    color: yellow;\n\t\t\t    background-color: blue;\n\t\t\t  }\n\t\t\t  #box2 {\n\t\t\t    width: 80px;\n\t\t\t    color: rgb(255, 255, 255);\n\t\t\t    background-color: rgb(15, 99, 30);\n\t\t\t  }\n\t\t\t  #box3 {\n\t\t\t    width: 40px;\n\t\t\t    color: #fcc;\n\t\t\t    background-color: #123456;\n\t\t\t  }\n\t\t\t  #box4 {\n\t\t\t    width: 70px;\n\t\t\t    background-color: #f11;\n\t\t\t  }\n\t\t\t  </style>\n\t\t\t \n\t\t\t<p id=\"result\">&nbsp;</p>\n\t\t\t<div id=\"box1\">1</div>\n\t\t\t<div id=\"box2\">2</div>\n\t\t\t<div id=\"box3\">3</div>\n\t\t\t<div id=\"box4\">4</div>";
			jQuery(new sliceType([new $String(htmlsnippet)])).AppendTo(new $String("#qunit-fixture"));
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).On(new sliceType([new $String("click"), new funcType((function() {
				var _entry, _i, _keys, _ref, html, prop, styleProps, value;
				html = new sliceType$1(["The clicked div has the following styles:"]);
				styleProps = jQuery(new sliceType([this])).CssArray(new sliceType$1(["width", "height"]));
				_ref = styleProps;
				_i = 0;
				_keys = $keys(_ref);
				while (_i < _keys.length) {
					_entry = _ref[_keys[_i]];
					if (_entry === undefined) {
						_i++;
						continue;
					}
					prop = _entry.k;
					value = _entry.v;
					html = $append(html, prop + ": " + $assertType(value, $String));
					_i++;
				}
				jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("#result")])).SetHtml(new $String(strings.Join(html, "<br>")));
			}))]));
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div:eq(0)")])).Trigger(new sliceType([new $String("click")]));
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("#result")])).Html() === "The clicked div has the following styles:<br>width: 50px<br>height: 50px"), "CssArray read properties");
		}));
		qunit.Test("ApiOnly:SelectFn,SetText,Show,FadeOut", (function(assert) {
			qunit.Expect(0);
			jQuery(new sliceType([new $String("<p>Click and drag the mouse to select text in the inputs.</p>\n  \t\t\t\t<input type=\"text\" value=\"Some text\">\n  \t\t\t\t<input type=\"text\" value=\"to test on\">\n  \t\t\t\t<div></div>")])).AppendTo(new $String("#qunit-fixture"));
			jQuery(new sliceType([new $String(":input")])).Select(new sliceType([new funcType$4((function(e) {
				jQuery(new sliceType([new $String("div")])).SetText(new $String("Something was selected")).Show().FadeOut(new sliceType([new $String("1000")]));
			}))]));
		}));
		qunit.Test("Eq,Find", (function(assert) {
			jQuery(new sliceType([new $String("<div></div>\n\t\t\t\t<div></div>\n\t\t\t\t<div class=\"test\"></div>\n\t\t\t\t<div></div>\n\t\t\t\t<div></div>\n\t\t\t\t<div></div>")])).AppendTo(new $String("#qunit-fixture"));
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).Eq(2).HasClass("test")), "Eq(2) has class test");
			assert.Ok(new $Bool(!jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).Eq(0).HasClass("test")), "Eq(0) has no class test");
		}));
		qunit.Test("Find,End", (function(assert) {
			jQuery(new sliceType([new $String("<p class='ok'><span class='notok'>Hello</span>, how are you?</p>")])).AppendTo(new $String("#qunit-fixture"));
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("p")])).Find(new sliceType([new $String("span")])).HasClass("notok")), "before call to end");
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("p")])).Find(new sliceType([new $String("span")])).End().HasClass("ok")), "after call to end");
		}));
		qunit.Test("Slice,Attr,First,Last", (function(assert) {
			jQuery(new sliceType([new $String("<ul>\n  \t\t\t\t<li class=\"firstclass\">list item 1</li>\n  \t\t\t\t<li>list item 2</li>\n  \t\t\t\t<li>list item 3</li>\n  \t\t\t\t<li>list item 4</li>\n  \t\t\t\t<li class=\"lastclass\">list item 5</li>\n\t\t\t\t</ul>")])).AppendTo(new $String("#qunit-fixture"));
			assert.Equal(new $Int(($parseInt(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("li")])).Slice(new sliceType([new $Int(2)])).o.length) >> 0)), new $Int(3), "Slice");
			assert.Equal(new $Int(($parseInt(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("li")])).Slice(new sliceType([new $Int(2), new $Int(4)])).o.length) >> 0)), new $Int(2), "SliceByEnd");
			assert.Equal(new $String(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("li")])).First().Attr("class")), new $String("firstclass"), "First");
			assert.Equal(new $String(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("li")])).Last().Attr("class")), new $String("lastclass"), "Last");
		}));
		qunit.Test("Css", (function(assert) {
			var _key, _map, div, span;
			jQuery(new sliceType([new $String("#qunit-fixture")])).SetCss(new sliceType([new mapType((_map = new $Map(), _key = "color", _map[_key] = { k: _key, v: new $String("red") }, _key = "background", _map[_key] = { k: _key, v: new $String("blue") }, _key = "width", _map[_key] = { k: _key, v: new $String("20px") }, _key = "height", _map[_key] = { k: _key, v: new $String("10px") }, _map))]));
			assert.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Css("width") === "20px" && jQuery(new sliceType([new $String("#qunit-fixture")])).Css("height") === "10px"), "SetCssMap");
			div = $clone(jQuery(new sliceType([new $String("<div style='display: inline'/>")])).Show().AppendTo(new $String("#qunit-fixture")), jquery.JQuery);
			assert.Equal(new $String(div.Css("display")), new $String("inline"), "Make sure that element has same display when it was created.");
			div.Remove(new sliceType([]));
			span = $clone(jQuery(new sliceType([new $String("<span/>")])).Hide().Show(), jquery.JQuery);
			assert.Equal(span.Get(new sliceType([new $Int(0)])).style.display, new $String("inline"), "For detached span elements, display should always be inline");
			span.Remove(new sliceType([]));
		}));
		qunit.Test("Attributes", (function(assert) {
			var _key, _map, extras, input;
			jQuery(new sliceType([new $String("<form id='testForm'></form>")])).AppendTo(new $String("#qunit-fixture"));
			extras = $clone(jQuery(new sliceType([new $String("<input id='id' name='id' /><input id='name' name='name' /><input id='target' name='target' />")])).AppendTo(new $String("#testForm")), jquery.JQuery);
			assert.Equal(new $String(jQuery(new sliceType([new $String("#testForm")])).Attr("target")), new $String(""), "Attr");
			assert.Equal(new $String(jQuery(new sliceType([new $String("#testForm")])).SetAttr(new sliceType([new $String("target"), new $String("newTarget")])).Attr("target")), new $String("newTarget"), "SetAttr2");
			assert.Equal(new $String(jQuery(new sliceType([new $String("#testForm")])).RemoveAttr("id").Attr("id")), new $String(""), "RemoveAttr ");
			assert.Equal(new $String(jQuery(new sliceType([new $String("#testForm")])).Attr("name")), new $String(""), "Attr undefined");
			extras.Remove(new sliceType([]));
			jQuery(new sliceType([new $String("<a/>")])).SetAttr(new sliceType([new mapType((_map = new $Map(), _key = "id", _map[_key] = { k: _key, v: new $String("tAnchor5") }, _key = "href", _map[_key] = { k: _key, v: new $String("#5") }, _map))])).AppendTo(new $String("#qunit-fixture"));
			assert.Equal(new $String(jQuery(new sliceType([new $String("#tAnchor5")])).Attr("href")), new $String("#5"), "Attr");
			jQuery(new sliceType([new $String("<a id='tAnchor6' href='#5' />")])).AppendTo(new $String("#qunit-fixture"));
			assert.Equal(jQuery(new sliceType([new $String("#tAnchor5")])).Prop("href"), jQuery(new sliceType([new $String("#tAnchor6")])).Prop("href"), "Prop");
			input = $clone(jQuery(new sliceType([new $String("<input name='tester' />")])), jquery.JQuery);
			assert.StrictEqual(input.Clone(new sliceType([new $Bool(true)])).SetAttr(new sliceType([new $String("name"), new $String("test")])).Underlying()[0].name, new $String("test"), "Clone");
			jQuery(new sliceType([new $String("#qunit-fixture")])).Empty();
			jQuery(new sliceType([new $String("<input type=\"checkbox\" checked=\"checked\">\n  \t\t\t<input type=\"checkbox\">\n  \t\t\t<input type=\"checkbox\">\n  \t\t\t<input type=\"checkbox\" checked=\"checked\">")])).AppendTo(new $String("#qunit-fixture"));
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("input[type='checkbox']")])).SetProp(new sliceType([new $String("disabled"), new $Bool(true)]));
			assert.Ok(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("input[type='checkbox']")])).Prop("disabled"), "SetProp");
		}));
		qunit.Test("Unique", (function(assert) {
			var divs, divs2, divs3;
			jQuery(new sliceType([new $String("<div>There are 6 divs in this document.</div>\n\t\t\t\t<div></div>\n\t\t\t\t<div class=\"dup\"></div>\n\t\t\t\t<div class=\"dup\"></div>\n\t\t\t\t<div class=\"dup\"></div>\n\t\t\t\t<div></div>")])).AppendTo(new $String("#qunit-fixture"));
			divs = jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).Get(new sliceType([]));
			assert.Equal(divs.length, new $Int(6), "6 divs inserted");
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String(".dup")])).Clone(new sliceType([new $Bool(true)])).AppendTo(new $String("#qunit-fixture"));
			divs2 = jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).Get(new sliceType([]));
			assert.Equal(divs2.length, new $Int(9), "9 divs inserted");
			divs3 = jquery.Unique(divs);
			assert.Equal(divs3.length, new $Int(6), "post-qunique should be 6 elements");
		}));
		qunit.Test("Serialize,SerializeArray,Trigger,Submit", (function(assert) {
			var collectResults, serializedString;
			qunit.Expect(2);
			jQuery(new sliceType([new $String("<form>\n\t\t\t\t  <div><input type=\"text\" name=\"a\" value=\"1\" id=\"a\"></div>\n\t\t\t\t  <div><input type=\"text\" name=\"b\" value=\"2\" id=\"b\"></div>\n\t\t\t\t  <div><input type=\"hidden\" name=\"c\" value=\"3\" id=\"c\"></div>\n\t\t\t\t  <div>\n\t\t\t\t    <textarea name=\"d\" rows=\"8\" cols=\"40\">4</textarea>\n\t\t\t\t  </div>\n\t\t\t\t  <div><select name=\"e\">\n\t\t\t\t    <option value=\"5\" selected=\"selected\">5</option>\n\t\t\t\t    <option value=\"6\">6</option>\n\t\t\t\t    <option value=\"7\">7</option>\n\t\t\t\t  </select></div>\n\t\t\t\t  <div>\n\t\t\t\t    <input type=\"checkbox\" name=\"f\" value=\"8\" id=\"f\">\n\t\t\t\t  </div>\n\t\t\t\t  <div>\n\t\t\t\t    <input type=\"submit\" name=\"g\" value=\"Submit\" id=\"g\">\n\t\t\t\t  </div>\n\t\t\t\t</form>")])).AppendTo(new $String("#qunit-fixture"));
			collectResults = "";
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("form")])).Submit(new sliceType([new funcType$5((function(evt) {
				var i, sa;
				sa = jQuery(new sliceType([evt.Object.target])).SerializeArray();
				i = 0;
				while (i < $parseInt(sa.length)) {
					collectResults = collectResults + ($internalize(sa[i].name, $String));
					i = i + (1) >> 0;
				}
				assert.Equal(new $String(collectResults), new $String("abcde"), "SerializeArray");
				evt.PreventDefault();
			}))]));
			serializedString = "a=1&b=2&c=3&d=4&e=5";
			assert.Equal(new $String(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("form")])).Serialize()), new $String(serializedString), "Serialize");
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("form")])).Trigger(new sliceType([new $String("submit")]));
		}));
		qunit.ModuleLifecycle("Events", (x = new EvtScenario.ptr(), new x.constructor.elem(x)));
		qunit.Test("On,One,Off,Trigger", (function(assert) {
			var _key, _key$1, _map, _map$1, _tmp, _tmp$1, clickCounter, data, data2, elem, fn, handler, handlerWithData, mouseoverCounter;
			fn = (function(ev) {
				assert.Ok(new $Bool(!(ev.Object.data === undefined)), "on() with data, check passed data exists");
				assert.Equal(ev.Object.data.foo, new $String("bar"), "on() with data, Check value of passed data");
			});
			data = (_map = new $Map(), _key = "foo", _map[_key] = { k: _key, v: new $String("bar") }, _map);
			jQuery(new sliceType([new $String("#firstp")])).On(new sliceType([new $String("click"), new mapType(data), new funcType$6(fn)])).Trigger(new sliceType([new $String("click")])).Off(new sliceType([new $String("click"), new funcType$6(fn)]));
			_tmp = 0; _tmp$1 = 0; clickCounter = _tmp; mouseoverCounter = _tmp$1;
			handler = (function(ev) {
				if ($internalize(ev.Object.type, $String) === "click") {
					clickCounter = clickCounter + (1) >> 0;
				} else if ($internalize(ev.Object.type, $String) === "mouseover") {
					mouseoverCounter = mouseoverCounter + (1) >> 0;
				}
			});
			handlerWithData = (function(ev) {
				if ($internalize(ev.Object.type, $String) === "click") {
					clickCounter = clickCounter + (($parseInt(ev.Object.data.data) >> 0)) >> 0;
				} else if ($internalize(ev.Object.type, $String) === "mouseover") {
					mouseoverCounter = mouseoverCounter + (($parseInt(ev.Object.data.data) >> 0)) >> 0;
				}
			});
			data2 = (_map$1 = new $Map(), _key$1 = "data", _map$1[_key$1] = { k: _key$1, v: new $Int(2) }, _map$1);
			elem = $clone(jQuery(new sliceType([new $String("#firstp")])).On(new sliceType([new $String("click"), new funcType$6(handler)])).On(new sliceType([new $String("mouseover"), new funcType$6(handler)])).One(new sliceType([new $String("click"), new mapType(data2), new funcType$6(handlerWithData)])).One(new sliceType([new $String("mouseover"), new mapType(data2), new funcType$6(handlerWithData)])), jquery.JQuery);
			assert.Equal(new $Int(clickCounter), new $Int(0), "clickCounter initialization ok");
			assert.Equal(new $Int(mouseoverCounter), new $Int(0), "mouseoverCounter initialization ok");
			elem.Trigger(new sliceType([new $String("click")])).Trigger(new sliceType([new $String("mouseover")]));
			assert.Equal(new $Int(clickCounter), new $Int(3), "clickCounter Increased after Trigger/On/One");
			assert.Equal(new $Int(mouseoverCounter), new $Int(3), "mouseoverCounter Increased after Trigger/On/One");
			elem.Trigger(new sliceType([new $String("click")])).Trigger(new sliceType([new $String("mouseover")]));
			assert.Equal(new $Int(clickCounter), new $Int(4), "clickCounter Increased after Trigger/On");
			assert.Equal(new $Int(mouseoverCounter), new $Int(4), "a) mouseoverCounter Increased after TriggerOn");
			elem.Trigger(new sliceType([new $String("click")])).Trigger(new sliceType([new $String("mouseover")]));
			assert.Equal(new $Int(clickCounter), new $Int(5), "b) clickCounter not Increased after Off");
			assert.Equal(new $Int(mouseoverCounter), new $Int(5), "c) mouseoverCounter not Increased after Off");
			elem.Off(new sliceType([new $String("click")])).Off(new sliceType([new $String("mouseover")]));
			elem.Trigger(new sliceType([new $String("click")])).Trigger(new sliceType([new $String("mouseover")]));
			assert.Equal(new $Int(clickCounter), new $Int(5), "clickCounter not Increased after Off");
			assert.Equal(new $Int(mouseoverCounter), new $Int(5), "mouseoverCounter not Increased after Off");
		}));
		qunit.Test("Each", (function(assert) {
			var blueCount, html, i;
			jQuery(new sliceType([new $String("#qunit-fixture")])).Empty();
			html = "<style>\n\t\t\t  \t\tdiv {\n\t\t\t    \t\tcolor: red;\n\t\t\t    \t\ttext-align: center;\n\t\t\t    \t\tcursor: pointer;\n\t\t\t    \t\tfont-weight: bolder;\n\t\t\t\t    width: 300px;\n\t\t\t\t  }\n\t\t\t\t </style>\n\t\t\t\t <div>Click here</div>\n\t\t\t\t <div>to iterate through</div>\n\t\t\t\t <div>these divs.</div>";
			jQuery(new sliceType([new $String(html)])).AppendTo(new $String("#qunit-fixture"));
			blueCount = 0;
			jQuery(new sliceType([new $String("#qunit-fixture")])).On(new sliceType([new $String("click"), new funcType$4((function(e) {
				jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).Each((function(i, elem) {
					var style;
					style = jQuery(new sliceType([elem])).Get(new sliceType([new $Int(0)])).style;
					if (!($internalize(style.color, $String) === "blue")) {
						style.color = $externalize("blue", $String);
					} else {
						blueCount = blueCount + (1) >> 0;
						style.color = $externalize("", $String);
					}
				}));
			}))]));
			i = 0;
			while (i < 6) {
				jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div:eq(0)")])).Trigger(new sliceType([new $String("click")]));
				i = i + (1) >> 0;
			}
			assert.Equal(new $Int(($parseInt(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).o.length) >> 0)), new $Int(3), "Test setup problem: 3 divs expected");
			assert.Equal(new $Int(blueCount), new $Int(9), "blueCount Counter should be 9");
		}));
		qunit.Test("Filter, Resize", (function(assert) {
			var countFontweight, html;
			jQuery(new sliceType([new $String("#qunit-fixture")])).Empty();
			html = "<style>\n\t\t\t\t  \tdiv {\n\t\t\t\t    \twidth: 60px;\n\t\t\t\t    \theight: 60px;\n\t\t\t\t    \tmargin: 5px;\n\t\t\t\t    \tfloat: left;\n\t\t\t\t    \tborder: 2px white solid;\n\t\t\t\t  \t}\n\t\t\t\t </style>\n\t\t\t\t  \n\t\t\t\t <div></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div class=\"middle\"></div>\n\t\t\t\t <div></div>";
			jQuery(new sliceType([new $String(html)])).AppendTo(new $String("#qunit-fixture"));
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).SetCss(new sliceType([new $String("background"), new $String("silver")])).Filter(new sliceType([new funcType$7((function(index) {
				var _r;
				return (_r = index % 3, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) === 2;
			}))])).SetCss(new sliceType([new $String("font-weight"), new $String("bold")]));
			countFontweight = 0;
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).Each((function(i, elem) {
				var fw;
				fw = jQuery(new sliceType([elem])).Css("font-weight");
				if (fw === "bold" || fw === "700") {
					countFontweight = countFontweight + (1) >> 0;
				}
			}));
			assert.Equal(new $Int(countFontweight), new $Int(2), "2 divs should have font-weight = 'bold'");
			jQuery(new sliceType([$global])).Resize(new sliceType([new funcType((function() {
				jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div:eq(0)")])).SetText(new $String(strconv.Itoa(jQuery(new sliceType([new $String("div:eq(0)")])).Width())));
			}))])).Resize(new sliceType([]));
			assert.Equal(new $String(jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div:eq(0)")])).Text()), new $String("60"), "text of first div should be 60");
		}));
		qunit.Test("Not,Offset", (function(assert) {
			var html;
			qunit.Expect(0);
			jQuery(new sliceType([new $String("#qunit-fixture")])).Empty();
			html = "<div></div>\n\t\t\t\t <div id=\"blueone\"></div>\n\t\t\t\t <div></div>\n\t\t\t\t <div class=\"green\"></div>\n\t\t\t\t <div class=\"green\"></div>\n\t\t\t\t <div class=\"gray\"></div>\n\t\t\t\t <div></div>";
			jQuery(new sliceType([new $String(html)])).AppendTo(new $String("#qunit-fixture"));
			jQuery(new sliceType([new $String("#qunit-fixture")])).Find(new sliceType([new $String("div")])).Not(new sliceType([new $String(".green,#blueone")])).SetCss(new sliceType([new $String("border-color"), new $String("red")]));
			jQuery(new sliceType([new $String("*"), new $String("body")])).On(new sliceType([new $String("click"), new funcType$8((function(event) {
				var offset, tag;
				offset = $clone(jQuery(new sliceType([event.Object.target])).Offset(), jquery.JQueryCoordinates);
				event.StopPropagation();
				tag = $assertType(jQuery(new sliceType([event.Object.target])).Prop("tagName"), $String);
				jQuery(new sliceType([new $String("#result")])).SetText(new $String(tag + " coords ( " + strconv.Itoa(offset.Left) + ", " + strconv.Itoa(offset.Top) + " )"));
			}))]));
		}));
		qunit.Module("Ajax");
		qunit.AsyncTest("Async Dummy Test", (function() {
			qunit.Expect(1);
			return $global.setTimeout($externalize((function() {
				qunit.Ok(new $Bool(true), " async ok");
				qunit.Start();
			}), funcType), 1000);
		}));
		qunit.AsyncTest("Ajax Call", (function() {
			var _key, _map, ajaxopt;
			qunit.Expect(1);
			ajaxopt = (_map = new $Map(), _key = "async", _map[_key] = { k: _key, v: new $Bool(true) }, _key = "type", _map[_key] = { k: _key, v: new $String("POST") }, _key = "url", _map[_key] = { k: _key, v: new $String("http://localhost:3000/nestedjson/") }, _key = "contentType", _map[_key] = { k: _key, v: new $String("application/json charset=utf-8") }, _key = "dataType", _map[_key] = { k: _key, v: new $String("json") }, _key = "data", _map[_key] = { k: _key, v: $ifaceNil }, _key = "beforeSend", _map[_key] = { k: _key, v: new funcType$9((function(data) {
			})) }, _key = "success", _map[_key] = { k: _key, v: new funcType$9((function(data) {
				var dataStr, expected;
				dataStr = stringify(new Object(data));
				expected = "{\"message\":\"Welcome!\",\"nested\":{\"level\":1,\"moresuccess\":true},\"success\":true}";
				qunit.Ok(new $Bool(dataStr === expected), "Ajax call did not returns expected result");
				qunit.Start();
			})) }, _key = "error", _map[_key] = { k: _key, v: new funcType$10((function(status) {
			})) }, _map);
			jquery.Ajax(ajaxopt);
			return null;
		}));
		qunit.AsyncTest("Load", (function() {
			qunit.Expect(1);
			jQuery(new sliceType([new $String("#qunit-fixture")])).Load(new sliceType([new $String("/resources/load.html"), new funcType((function() {
				qunit.Ok(new $Bool(jQuery(new sliceType([new $String("#qunit-fixture")])).Html() === "<div>load successful!</div>"), "Load call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("Get", (function() {
			qunit.Expect(1);
			jquery.Get(new sliceType([new $String("/resources/get.html"), new funcType$11((function(data, status, xhr) {
				qunit.Ok(new $Bool($interfaceIsEqual(data, new $String("<div>get successful!</div>"))), "Get call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("Post", (function() {
			qunit.Expect(1);
			jquery.Post(new sliceType([new $String("/gopher"), new funcType$11((function(data, status, xhr) {
				qunit.Ok(new $Bool($interfaceIsEqual(data, new $String("<div>Welcome gopher</div>"))), "Post call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("GetJSON", (function() {
			qunit.Expect(1);
			jquery.GetJSON(new sliceType([new $String("/json/1"), new funcType$12((function(data) {
				var _entry, _tuple, ok, val;
				_tuple = (_entry = $assertType(data, mapType)["json"], _entry !== undefined ? [_entry.v, true] : [$ifaceNil, false]); val = _tuple[0]; ok = _tuple[1];
				if (ok) {
					qunit.Ok(new $Bool($interfaceIsEqual(val, new $String("1"))), "Json call did not returns expected result");
					qunit.Start();
				}
			}))]));
			return null;
		}));
		qunit.AsyncTest("GetScript", (function() {
			qunit.Expect(1);
			jquery.GetScript(new sliceType([new $String("/script"), new funcType$12((function(data) {
				qunit.Ok(new $Bool(($assertType(data, $String).length === 29)), "GetScript call did not returns expected result");
				qunit.Start();
			}))]));
			return null;
		}));
		qunit.AsyncTest("AjaxSetup", (function() {
			var _key, _key$1, _map, _map$1, ajaxSetupOptions, ajaxopt;
			qunit.Expect(1);
			ajaxSetupOptions = (_map = new $Map(), _key = "async", _map[_key] = { k: _key, v: new $Bool(true) }, _key = "type", _map[_key] = { k: _key, v: new $String("POST") }, _key = "url", _map[_key] = { k: _key, v: new $String("/nestedjson/") }, _key = "contentType", _map[_key] = { k: _key, v: new $String("application/json charset=utf-8") }, _map);
			jquery.AjaxSetup(ajaxSetupOptions);
			ajaxopt = (_map$1 = new $Map(), _key$1 = "dataType", _map$1[_key$1] = { k: _key$1, v: new $String("json") }, _key$1 = "data", _map$1[_key$1] = { k: _key$1, v: $ifaceNil }, _key$1 = "beforeSend", _map$1[_key$1] = { k: _key$1, v: new funcType$9((function(data) {
			})) }, _key$1 = "success", _map$1[_key$1] = { k: _key$1, v: new funcType$9((function(data) {
				var dataStr, expected;
				dataStr = stringify(new Object(data));
				expected = "{\"message\":\"Welcome!\",\"nested\":{\"level\":1,\"moresuccess\":true},\"success\":true}";
				qunit.Ok(new $Bool(dataStr === expected), "AjaxSetup call did not returns expected result");
				qunit.Start();
			})) }, _key$1 = "error", _map$1[_key$1] = { k: _key$1, v: new funcType$10((function(status) {
			})) }, _map$1);
			jquery.Ajax(ajaxopt);
			return null;
		}));
		qunit.AsyncTest("AjaxPrefilter", (function() {
			qunit.Expect(1);
			jquery.AjaxPrefilter(new sliceType([new $String("+json"), new funcType$13((function(options, originalOptions, jqXHR) {
			}))]));
			jquery.GetJSON(new sliceType([new $String("/json/3"), new funcType$12((function(data) {
				var _entry, _tuple, ok, val;
				_tuple = (_entry = $assertType(data, mapType)["json"], _entry !== undefined ? [_entry.v, true] : [$ifaceNil, false]); val = _tuple[0]; ok = _tuple[1];
				if (ok) {
					qunit.Ok(new $Bool($assertType(val, $String) === "3"), "AjaxPrefilter call did not returns expected result");
					qunit.Start();
				}
			}))]));
			return null;
		}));
		qunit.AsyncTest("AjaxTransport", (function() {
			qunit.Expect(1);
			jquery.AjaxTransport(new sliceType([new $String("+json"), new funcType$13((function(options, originalOptions, jqXHR) {
			}))]));
			jquery.GetJSON(new sliceType([new $String("/json/4"), new funcType$12((function(data) {
				var _entry, _tuple, ok, val;
				_tuple = (_entry = $assertType(data, mapType)["json"], _entry !== undefined ? [_entry.v, true] : [$ifaceNil, false]); val = _tuple[0]; ok = _tuple[1];
				if (ok) {
					qunit.Ok(new $Bool($assertType(val, $String) === "4"), "AjaxTransport call did not returns expected result");
					qunit.Start();
				}
			}))]));
			return null;
		}));
		qunit.Module("Deferreds");
		qunit.AsyncTest("Deferreds Test 01", (function() {
			var _r, _tmp, _tmp$1, _tmp$2, fail, i, pass, progress;
			qunit.Expect(1);
			_tmp = 0; _tmp$1 = 0; _tmp$2 = 0; pass = _tmp; fail = _tmp$1; progress = _tmp$2;
			i = 0;
			while (i < 10) {
				jquery.When(new sliceType([asyncEvent((_r = i % 2, _r === _r ? _r : $throwRuntimeError("integer divide by zero")) === 0, i)])).Then(new sliceType([new funcType$10((function(status) {
					pass = pass + (1) >> 0;
				})), new funcType$10((function(status) {
					fail = fail + (1) >> 0;
				})), new funcType$10((function(status) {
					progress = progress + (1) >> 0;
				}))])).Done(new sliceType([new funcType((function() {
					if (pass >= 5) {
						qunit.Start();
						qunit.Ok(new $Bool(pass >= 5 && fail >= 4 && progress >= 20), "Deferred Test 01 fail");
					}
				}))]));
				i = i + (1) >> 0;
			}
			return null;
		}));
		qunit.Test("Deferreds Test 02", (function(assert) {
			var o;
			qunit.Expect(1);
			o = $clone(NewWorking(jquery.NewDeferred()), working);
			o.Deferred.Resolve(new sliceType([new $String("John")]));
			o.Deferred.Done(new sliceType([new funcType$14((function(name) {
				o.hi(name);
			}))])).Done(new sliceType([new funcType$14((function(name) {
				o.hi("John");
			}))]));
			o.hi("Karl");
			assert.Ok(new $Bool((countJohn === 2) && (countKarl === 1)), "Deferred Test 02 fail");
		}));
		qunit.AsyncTest("Deferreds Test 03", (function() {
			qunit.Expect(1);
			jquery.Get(new sliceType([new $String("/get.html")])).Always(new sliceType([new funcType((function() {
				qunit.Start();
				qunit.Ok(new $Bool(true), "Deferred Test 03 fail");
			}))]));
			return null;
		}));
		qunit.AsyncTest("Deferreds Test 04", (function() {
			qunit.Expect(2);
			jquery.Get(new sliceType([new $String("/get.html")])).Done(new sliceType([new funcType((function() {
				qunit.Ok(new $Bool(true), "Deferred Test 04 fail");
			}))])).Fail(new sliceType([new funcType((function() {
			}))]));
			jquery.Get(new sliceType([new $String("/shouldnotexist.html")])).Done(new sliceType([new funcType((function() {
			}))])).Fail(new sliceType([new funcType((function() {
				qunit.Start();
				qunit.Ok(new $Bool(true), "Deferred Test 04 fail");
			}))]));
			return null;
		}));
		qunit.AsyncTest("Deferreds Test 05", (function() {
			qunit.Expect(2);
			jquery.Get(new sliceType([new $String("/get.html")])).Then(new sliceType([new funcType((function() {
				qunit.Ok(new $Bool(true), "Deferred Test 05 fail");
			})), new funcType((function() {
			}))]));
			jquery.Get(new sliceType([new $String("/shouldnotexist.html")])).Then(new sliceType([new funcType((function() {
			})), new funcType((function() {
				qunit.Start();
				qunit.Ok(new $Bool(true), "Deferred Test 05, 2nd part, fail");
			}))]));
			return null;
		}));
		qunit.Test("Deferreds Test 06", (function(assert) {
			var filtered, o;
			qunit.Expect(1);
			o = $clone(jquery.NewDeferred(), jquery.Deferred);
			filtered = $clone(o.Then(new sliceType([new funcType$15((function(value) {
				return value * 2 >> 0;
			}))])), jquery.Deferred);
			o.Resolve(new sliceType([new $Int(5)]));
			filtered.Done(new sliceType([new funcType$16((function(value) {
				assert.Ok(new $Bool((value === 10)), "Deferred Test 06 fail");
			}))]));
		}));
		qunit.Test("Deferreds Test 07", (function(assert) {
			var filtered, o;
			o = $clone(jquery.NewDeferred(), jquery.Deferred);
			filtered = $clone(o.Then(new sliceType([null, new funcType$15((function(value) {
				return value * 3 >> 0;
			}))])), jquery.Deferred);
			o.Reject(new sliceType([new $Int(6)]));
			filtered.Fail(new sliceType([new funcType$16((function(value) {
				assert.Ok(new $Bool((value === 18)), "Deferred Test 07 fail");
			}))]));
		}));
	};
	EvtScenario.methods = [{prop: "Setup", name: "Setup", pkg: "", type: $funcType([], [], false)}, {prop: "Teardown", name: "Teardown", pkg: "", type: $funcType([], [], false)}];
	ptrType.methods = [{prop: "Setup", name: "Setup", pkg: "", type: $funcType([], [], false)}, {prop: "Teardown", name: "Teardown", pkg: "", type: $funcType([], [], false)}];
	working.methods = [{prop: "Always", name: "Always", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Done", name: "Done", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Fail", name: "Fail", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Notify", name: "Notify", pkg: "", type: $funcType([$emptyInterface], [jquery.Deferred], false)}, {prop: "Progress", name: "Progress", pkg: "", type: $funcType([$emptyInterface], [jquery.Deferred], false)}, {prop: "Promise", name: "Promise", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "Reject", name: "Reject", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Resolve", name: "Resolve", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "State", name: "State", pkg: "", type: $funcType([], [$String], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Then", name: "Then", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}, {prop: "hi", name: "hi", pkg: "main", type: $funcType([$String], [], false)}, {prop: "notify", name: "notify", pkg: "main", type: $funcType([], [], false)}];
	ptrType$1.methods = [{prop: "Always", name: "Always", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Bool", name: "Bool", pkg: "", type: $funcType([], [$Bool], false)}, {prop: "Call", name: "Call", pkg: "", type: $funcType([$String, sliceType], [js.Object], true)}, {prop: "Delete", name: "Delete", pkg: "", type: $funcType([$String], [], false)}, {prop: "Done", name: "Done", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Fail", name: "Fail", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Float", name: "Float", pkg: "", type: $funcType([], [$Float64], false)}, {prop: "Get", name: "Get", pkg: "", type: $funcType([$String], [js.Object], false)}, {prop: "Index", name: "Index", pkg: "", type: $funcType([$Int], [js.Object], false)}, {prop: "Int", name: "Int", pkg: "", type: $funcType([], [$Int], false)}, {prop: "Int64", name: "Int64", pkg: "", type: $funcType([], [$Int64], false)}, {prop: "Interface", name: "Interface", pkg: "", type: $funcType([], [$emptyInterface], false)}, {prop: "Invoke", name: "Invoke", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Length", name: "Length", pkg: "", type: $funcType([], [$Int], false)}, {prop: "New", name: "New", pkg: "", type: $funcType([sliceType], [js.Object], true)}, {prop: "Notify", name: "Notify", pkg: "", type: $funcType([$emptyInterface], [jquery.Deferred], false)}, {prop: "Progress", name: "Progress", pkg: "", type: $funcType([$emptyInterface], [jquery.Deferred], false)}, {prop: "Promise", name: "Promise", pkg: "", type: $funcType([], [js.Object], false)}, {prop: "Reject", name: "Reject", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Resolve", name: "Resolve", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Set", name: "Set", pkg: "", type: $funcType([$String, js.Any], [], false)}, {prop: "SetIndex", name: "SetIndex", pkg: "", type: $funcType([$Int, js.Any], [], false)}, {prop: "State", name: "State", pkg: "", type: $funcType([], [$String], false)}, {prop: "String", name: "String", pkg: "", type: $funcType([], [$String], false)}, {prop: "Then", name: "Then", pkg: "", type: $funcType([sliceType], [jquery.Deferred], true)}, {prop: "Uint64", name: "Uint64", pkg: "", type: $funcType([], [$Uint64], false)}, {prop: "Unsafe", name: "Unsafe", pkg: "", type: $funcType([], [$Uintptr], false)}, {prop: "hi", name: "hi", pkg: "main", type: $funcType([$String], [], false)}, {prop: "notify", name: "notify", pkg: "main", type: $funcType([], [], false)}];
	Object.init($String, $emptyInterface);
	EvtScenario.init([]);
	working.init([{prop: "Deferred", name: "", pkg: "", type: jquery.Deferred, tag: ""}]);
	$pkg.$init = function() {
		$pkg.$init = function() {};
		/* */ var $r, $s = 0; var $init_main = function() { while (true) { switch ($s) { case 0:
		$r = js.$init($BLOCKING); /* */ $s = 1; case 1: if ($r && $r.$blocking) { $r = $r(); }
		$r = jquery.$init($BLOCKING); /* */ $s = 2; case 2: if ($r && $r.$blocking) { $r = $r(); }
		$r = qunit.$init($BLOCKING); /* */ $s = 3; case 3: if ($r && $r.$blocking) { $r = $r(); }
		$r = strconv.$init($BLOCKING); /* */ $s = 4; case 4: if ($r && $r.$blocking) { $r = $r(); }
		$r = strings.$init($BLOCKING); /* */ $s = 5; case 5: if ($r && $r.$blocking) { $r = $r(); }
		$r = time.$init($BLOCKING); /* */ $s = 6; case 6: if ($r && $r.$blocking) { $r = $r(); }
		jQuery = jquery.NewJQuery;
		countJohn = 0;
		countKarl = 0;
		main();
		/* */ } return; } }; $init_main.$blocking = true; return $init_main;
	};
	return $pkg;
})();
$initAnonTypes();
$packages["runtime"].$init()();
$go($packages["main"].$init, [], true);
$flushConsole();

})(this);
//# sourceMappingURL=index.js.map
