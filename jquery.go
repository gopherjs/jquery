package jquery

import "github.com/gopherjs/gopherjs/js"

type JQuery struct {
	o        js.Object
	Jquery   string `js:"jquery"`
	Selector string `js:"selector"`
	Length   string `js:"length"`
	Context  string `js:"context"`
}

type Event struct {
	js.Object
	KeyCode        int       `js:"keyCode"`
	Target         js.Object `js:"target"`
	CurrentTarget  js.Object `js:"currentTarget"`
	DelegateTarget js.Object `js:"delegateTarget"`
	RelatedTarget  js.Object `js:"relatedTarget"`
	Data           js.Object `js:"data"`
	Result         js.Object `js:"result"`
	Which          int       `js:"which"`
	Namespace      string    `js:"namespace"`
	MetaKey        bool      `js:"metaKey"`
	PageX          int       `js:"pageX"`
	PageY          int       `js:"pageY"`
	Type           string    `js:"type"`
}

func (event *Event) PreventDefault() {
	event.Call("preventDefault")
}

func (event *Event) IsDefaultPrevented() bool {
	return event.Call("isDefaultPrevented").Bool()
}

func (event *Event) IsImmediatePropogationStopped() bool {
	return event.Call("isImmediatePropogationStopped").Bool()
}

func (event *Event) IsPropagationStopped() bool {
	return event.Call("isPropagationStopped").Bool()
}

func (event *Event) StopImmediatePropagation() {
	event.Call("stopImmediatePropagation")
}

func (event *Event) StopPropagation() {
	event.Call("stopPropagation")
}

type JQueryCoordinates struct {
	Left int `js:"left"`
	Top  int `js:"top"`
}

//JQuery constructor
func NewJQuery(args ...interface{}) JQuery {
	return JQuery{o: js.Global("jQuery").New(args...)}
}

//static function
func Trim(text string) string {
	return js.Global("jQuery").Call("trim", text).String()
}

//static function
func GlobalEval(cmd string) {
	js.Global("jQuery").Call("globalEval", cmd)
}

//static function
//native js Types: is this useful/a good idea ?
func Type(sth interface{}) string {
	return js.Global("jQuery").Call("type", sth).String()
}

//static function
func IsPlainObject(sth interface{}) bool {
	return js.Global("jQuery").Call("isPlainObject", sth).Bool()
}

//static function
func IsEmptyObject(sth interface{}) bool {
	return js.Global("jQuery").Call("isEmptyObject", sth).Bool()
}

//static function
func IsFunction(sth interface{}) bool {
	return js.Global("jQuery").Call("isFunction", sth).Bool()
}

//static function
func IsNumeric(sth interface{}) bool {
	return js.Global("jQuery").Call("isNumeric", sth).Bool()
}

//static function
func IsXMLDoc(sth interface{}) bool {
	return js.Global("jQuery").Call("isXMLDoc", sth).Bool()
}

//static function
func IsWindow(sth interface{}) bool {
	return js.Global("jQuery").Call("isWindow", sth).Bool()
}

//static function
func InArray(val interface{}, arr []interface{}) int {
	return js.Global("jQuery").Call("inArray", val, arr).Int()
}

//static function
func ParseHTML(text string) []interface{} {
	return js.Global("jQuery").Call("parseHTML", text).Interface().([]interface{})
}

//static function
func ParseXML(text string) interface{} {
	return js.Global("jQuery").Call("parseXML", text).Interface()
}

//static function
func ParseJSON(text string) interface{} {
	return js.Global("jQuery").Call("parseJSON", text).Interface()
}

//static function
func Grep(arr []interface{}, fn func(interface{}, int) bool) []interface{} {
	return js.Global("jQuery").Call("grep", arr, fn).Interface().([]interface{})
}

//static function
func EachOverArray(arr []interface{}, fn func(int, interface{}) bool) []interface{} {
	return js.Global("jQuery").Call("each", arr, fn).Interface().([]interface{})
}

//static function
func EachOverMap(arr map[string]interface{}, fn func(string, interface{}) bool) map[string]interface{} {
	return js.Global("jQuery").Call("each", arr, fn).Interface().(map[string]interface{})
}

//static function
func MapOverArray(arr []interface{}, fn func(interface{}, int) interface{}) []interface{} {
	return js.Global("jQuery").Call("map", arr, fn).Interface().([]interface{})
}

//static function
func MapOverMap(arr map[string]interface{}, fn func(interface{}, string) interface{}) []interface{} {
	return js.Global("jQuery").Call("map", arr, fn).Interface().([]interface{})
}

//static function
func Noop() interface{} {
	return js.Global("jQuery").Get("noop").Interface()
}

//static function
func Now() float64 {
	return js.Global("jQuery").Call("now").Float()
}

func Unique(arr js.Object) js.Object {
	return js.Global("jQuery").Call("unique", arr)
}

func (j JQuery) Underlying() js.Object {
	return j.o
}

func (j JQuery) Get(i ...interface{}) js.Object {
	return j.o.Call("get", i...)
}

func (j JQuery) Append(obj interface{}) JQuery {
	j.o = j.o.Call("append", obj)
	return j
}

func (j JQuery) Empty() JQuery {
	j.o = j.o.Call("empty")
	return j
}

func (j JQuery) Detach(i ...interface{}) JQuery {
	j.o = j.o.Call("detach", i...)
	return j
}

//methods
func (j JQuery) Serialize() string {
	return j.o.Call("serialize").String()
}

func (j JQuery) SerializeArray() js.Object {
	return j.o.Call("serializeArray")
}

func (j JQuery) Eq(idx int) JQuery {
	j.o = j.o.Call("eq", idx)
	return j
}

//to "range" over selection:
func (j JQuery) ToArray() []interface{} {
	return j.o.Call("toArray").Interface().([]interface{})
}

func (j JQuery) Remove(i ...interface{}) JQuery {
	j.o = j.o.Call("remove", i...)
	return j
}

func (j JQuery) Stop(i ...interface{}) JQuery {
	j.o = j.o.Call("stop", i...)
	return j
}

func (j JQuery) AddBack(i ...interface{}) JQuery {
	j.o = j.o.Call("addBack", i...)
	return j
}

func (j JQuery) Css(name string) string {
	return j.o.Call("css", name).String()
}

func (j JQuery) SetCss(name, value interface{}) JQuery {
	j.o = j.o.Call("css", name, value)
	return j
}

func (j JQuery) SetCssMap(propertiesMap map[string]interface{}) JQuery {
	j.o = j.o.Call("css", propertiesMap)
	return j
}

func (j JQuery) Text() string {
	return j.o.Call("text").String()
}

func (j JQuery) SetText(i interface{}) JQuery {

	switch i.(type) {
	case func(int, string) string, string:
	default:
		print("SetText Argument should be 'string' or 'func(int, string) string'")
	}

	j.o = j.o.Call("text", i)
	return j
}

func (j JQuery) Val() string {
	return j.o.Call("val").String()
}

func (j JQuery) SetVal(name string) JQuery {
	j.o.Call("val", name)
	return j
}

//2do: can return string
func (j JQuery) Prop(property string) bool {
	return j.o.Call("prop", property).Bool()
}

//2do: value can be string
func (j JQuery) SetProp(name string, value interface{}) JQuery {
	j.o = j.o.Call("prop", name, value)
	return j
}

func (j JQuery) SetPropMap(propertiesMap map[string]interface{}) JQuery {
	j.o = j.o.Call("prop", propertiesMap)
	return j
}

func (j JQuery) RemoveProp(property string) JQuery {
	j.o = j.o.Call("removeProp", property)
	return j
}

func (j JQuery) Attr(property string) string {
	attr := j.o.Call("attr", property)
	if attr.IsUndefined() {
		return ""
	}
	return attr.String()
}

func (j JQuery) SetAttr(property string, value string) JQuery {
	j.o = j.o.Call("attr", property, value)
	return j
}

func (j JQuery) SetAttrMap(propertiesMap map[string]interface{}) JQuery {
	j.o = j.o.Call("attr", propertiesMap)
	return j
}

func (j JQuery) RemoveAttr(property string) JQuery {
	j.o = j.o.Call("removeAttr", property)
	return j
}

func (j JQuery) HasClass(class string) bool {
	return j.o.Call("hasClass", class).Bool()
}

//2do: use interfaces
func (j JQuery) AddClass(property string) JQuery {
	j.o = j.o.Call("addClass", property)
	return j
}

//2do: use interfaces
func (j JQuery) AddClassFn(fn func(idx int) string) JQuery {
	j.o.Call("addClass", func(idx int) string {
		return fn(idx)
	})
	return j
}

//2do: use interfaces
func (j JQuery) AddClassFnClass(fn func(idx int, class string) string) JQuery {
	j.o.Call("addClass", func(idx int, class string) string {
		return fn(idx, class)
	})
	return j
}

func (j JQuery) RemoveClass(property string) JQuery {
	j.o = j.o.Call("removeClass", property)
	return j
}

func (j JQuery) ToggleClass(i ...interface{}) JQuery {
	j.o = j.o.Call("toggleClass", i...)
	return j
}

func (j JQuery) Focus() JQuery {
	j.o = j.o.Call("focus")
	return j
}

func (j JQuery) Blur() JQuery {
	j.o = j.o.Call("blur")
	return j
}

func (j JQuery) ReplaceAll(sel interface{}) JQuery {
	j.o = j.o.Call("replaceAll", sel)
	return j
}
func (j JQuery) ReplaceWith(sel interface{}) JQuery {
	j.o = j.o.Call("replaceWith", sel)
	return j
}

func (j JQuery) After(i ...interface{}) JQuery {
	j.o = j.o.Call("after", i...)
	return j
}

func (j JQuery) Before(i ...interface{}) JQuery {
	j.o = j.o.Call("before", i...)
	return j
}

func (j JQuery) Prepend(i ...interface{}) JQuery {
	j.o = j.o.Call("prepend", i...)
	return j
}

func (j JQuery) PrependTo(sel interface{}) JQuery {
	j.o = j.o.Call("prependTo", sel)
	return j
}

func (j JQuery) AppendTo(sel interface{}) JQuery {
	j.o = j.o.Call("appendTo", sel)
	return j
}

func (j JQuery) Toggle(showOrHide bool) JQuery {
	j.o = j.o.Call("toggle", showOrHide)
	return j
}

func (j JQuery) Show() JQuery {
	j.o = j.o.Call("show")
	return j
}

func (j JQuery) Hide() JQuery {
	j.o.Call("hide")
	return j
}

func (j JQuery) Contents() JQuery {
	j.o = j.o.Call("contents")
	return j
}

func (j JQuery) Html() string {
	return j.o.Call("html").String()
}

func (j JQuery) SetHtml(i interface{}) JQuery {

	switch i.(type) {
	case func(int, string) string, string:
	default:
		print("SetHtml Argument should be 'string' or 'func(int, string) string'")
	}

	j.o = j.o.Call("html", i)
	return j
}

func (j JQuery) Closest(i ...interface{}) JQuery {
	j.o = j.o.Call("closest", i...)
	return j
}

func (j JQuery) End() JQuery {
	j.o = j.o.Call("end")
	return j
}

func (j JQuery) Add(i ...interface{}) JQuery {
	j.o = j.o.Call("add", i...)
	return j
}

func (j JQuery) Clone(b ...interface{}) JQuery {
	j.o = j.o.Call("clone", b...)
	return j
}

func (j JQuery) Height() int {
	return j.o.Call("height").Int()
}

func (j JQuery) SetHeight(value string) JQuery {
	j.o = j.o.Call("height", value)
	return j
}

func (j JQuery) Width() int {
	return j.o.Call("width").Int()
}

func (j JQuery) SetWidth(i interface{}) JQuery {

	switch i.(type) {
	case func(int, string) string, string:
	default:
		print("SetWidth Argument should be 'string' or 'func(int, string) string'")
	}

	j.o = j.o.Call("width", i)
	return j
}

func (j JQuery) InnerHeight() int {
	return j.o.Call("innerHeight").Int()
}

func (j JQuery) InnerWidth() int {
	return j.o.Call("innerWidth").Int()
}

func (j JQuery) Offset() JQueryCoordinates {
	obj := j.o.Call("offset")
	return JQueryCoordinates{Left: obj.Get("left").Int(), Top: obj.Get("top").Int()}
}

func (j JQuery) SetOffset(jc JQueryCoordinates) JQuery {
	j.o = j.o.Call("offset", jc)
	return j
}

func (j JQuery) OuterHeight(includeMargin ...bool) int {
	if len(includeMargin) == 0 {
		return j.o.Call("outerHeight").Int()
	}
	return j.o.Call("outerHeight", includeMargin[0]).Int()
}
func (j JQuery) OuterWidth(includeMargin ...bool) int {

	if len(includeMargin) == 0 {
		return j.o.Call("outerWidth").Int()
	}
	return j.o.Call("outerWidth", includeMargin[0]).Int()
}

func (j JQuery) Position() JQueryCoordinates {
	obj := j.o.Call("position")
	return JQueryCoordinates{obj.Get("left").Int(), obj.Get("top").Int()}
}

func (j JQuery) ScrollLeft() int {
	return j.o.Call("scrollLeft").Int()
}
func (j JQuery) SetScrollLeft(value int) JQuery {
	j.o = j.o.Call("scrollLeft", value)
	return j
}

func (j JQuery) ScrollTop() int {
	return j.o.Call("scrollTop").Int()
}
func (j JQuery) SetScrollTop(value int) JQuery {
	j.o = j.o.Call("scrollTop", value)
	return j
}

func (j JQuery) ClearQueue(queueName string) JQuery {
	j.o = j.o.Call("clearQueue", queueName)
	return j
}

func (j JQuery) SetData(key string, value string) JQuery {
	j.o = j.o.Call("data", key, value)
	return j
}

func (j JQuery) Data(key string) interface{} {
	return j.o.Call("data", key).Interface()
}

func (j JQuery) Dequeue(queueName string) JQuery {
	j.o = j.o.Call("dequeue", queueName)
	return j
}

func (j JQuery) RemoveData(name string) JQuery {
	j.o = j.o.Call("removeData", name)
	return j
}

func (j JQuery) OffsetParent() JQuery {
	j.o = j.o.Call("offsetParent")
	return j
}

func (j JQuery) Parent(i ...interface{}) JQuery {
	j.o = j.o.Call("parent", i...)
	return j
}

func (j JQuery) Parents(i ...interface{}) JQuery {
	j.o = j.o.Call("parents", i...)
	return j
}

func (j JQuery) ParentsUntil(i ...interface{}) JQuery {
	j.o = j.o.Call("parentsUntil", i...)
	return j
}

func (j JQuery) Prev(i ...interface{}) JQuery {
	j.o = j.o.Call("prev", i...)
	return j
}

func (j JQuery) PrevAll(i ...interface{}) JQuery {
	j.o = j.o.Call("prevAll", i...)
	return j
}

func (j JQuery) PrevUntil(i ...interface{}) JQuery {
	j.o = j.o.Call("prevUntil", i...)
	return j
}

func (j JQuery) Siblings(i ...interface{}) JQuery {
	j.o = j.o.Call("siblings", i...)
	return j
}

func (j JQuery) Slice(i ...interface{}) JQuery {
	j.o = j.o.Call("slice", i...)
	return j
}

func (j JQuery) Children(selector interface{}) JQuery {
	j.o = j.o.Call("children", selector)
	return j
}

func (j JQuery) Unwrap() JQuery {
	j.o = j.o.Call("unwrap")
	return j
}

func (j JQuery) Wrap(obj interface{}) JQuery {
	j.o = j.o.Call("wrap", obj)
	return j
}

func (j JQuery) WrapAll(obj interface{}) JQuery {
	j.o = j.o.Call("wrapAll", obj)
	return j
}

func (j JQuery) WrapInner(obj interface{}) JQuery {
	j.o = j.o.Call("wrapInner", obj)
	return j
}

func (j JQuery) Next(i ...interface{}) JQuery {
	j.o = j.o.Call("next", i...)
	return j
}

func (j JQuery) NextAll(i ...interface{}) JQuery {
	j.o = j.o.Call("nextAll", i...)
	return j
}

func (j JQuery) NextUntil(i ...interface{}) JQuery {
	j.o = j.o.Call("nextUntil", i...)
	return j
}

func (j JQuery) Not(i ...interface{}) JQuery {
	j.o = j.o.Call("not", i...)
	return j
}

func (j JQuery) Filter(i ...interface{}) JQuery {
	j.o = j.o.Call("filter", i...)
	return j
}

func (j JQuery) Find(i ...interface{}) JQuery {
	j.o = j.o.Call("find", i...)
	return j
}

func (j JQuery) First() JQuery {
	j.o = j.o.Call("first")
	return j
}

func (j JQuery) Has(selector string) JQuery {
	j.o = j.o.Call("has", selector)
	return j
}

func (j JQuery) Is(i ...interface{}) bool {
	return j.o.Call("is", i...).Bool()
}

func (j JQuery) Last() JQuery {
	j.o = j.o.Call("last")
	return j
}

func (j JQuery) Ready(handler func()) JQuery {
	j.o = j.o.Call("ready", handler)
	return j
}

func (j JQuery) Resize(i ...interface{}) JQuery {
	j.o = j.o.Call("resize", i...)
	return j
}

func (j JQuery) Scroll(i ...interface{}) JQuery {
	return j.handleEvent("scroll", i...)
}

func (j JQuery) FadeOut(i ...interface{}) JQuery {
	j.o = j.o.Call("fadeOut", i...)
	return j
}

func (j JQuery) Select(i ...interface{}) JQuery {
	return j.handleEvent("select", i...)
}

func (j JQuery) Submit(i ...interface{}) JQuery {
	return j.handleEvent("submit", i...)
}

func (j JQuery) handleEvent(evt string, i ...interface{}) JQuery {

	switch len(i) {
	case 0:
		j.o = j.o.Call(evt)
	case 1:
		j.o = j.o.Call(evt, func(e js.Object) {
			i[0].(func(Event))(Event{Object: e})
		})
	case 2:
		j.o = j.o.Call(evt, i[0].(map[string]interface{}), func(e js.Object) {
			i[1].(func(Event))(Event{Object: e})
		})
	default:
		print(evt + " event expects 0 to 2 arguments")
	}
	return j
}

func (j JQuery) Trigger(i ...interface{}) JQuery {
	j.o = j.o.Call("trigger", i...)
	return j
}

func (j JQuery) Unload(handler func(Event) js.Object) JQuery {

	j.o.Call("unload", func(ev js.Object) js.Object {
		return handler(Event{Object: ev})
	})
	return j
}
func (j JQuery) UnloadEventdata(eventData js.Object, handler func(Event) js.Object) JQuery {

	j.o.Call("unload", eventData, func(ev js.Object) js.Object {
		return handler(Event{Object: ev})
	})
	return j
}

func (j JQuery) On(p ...interface{}) JQuery {
	return j.events("on", p...)
}

func (j JQuery) One(p ...interface{}) JQuery {
	return j.events("one", p...)
}

func (j JQuery) Off(p ...interface{}) JQuery {
	return j.events("off", p...)
}

func (j JQuery) events(evt string, p ...interface{}) JQuery {

	count := len(p)

	var isEventFunc bool
	switch p[len(p)-1].(type) {
	case func(Event):
		isEventFunc = true
	default:
		isEventFunc = false
	}

	switch count {
	case 0:
		j.o = j.o.Call(evt)
		return j
	case 1:
		j.o = j.o.Call(evt, p[0])
		return j
	case 2:
		if isEventFunc {
			j.o = j.o.Call(evt, p[0], func(e js.Object) {
				p[1].(func(Event))(Event{Object: e})
			})
			return j
		} else {
			j.o = j.o.Call(evt, p[0], p[1])
			return j
		}
	case 3:
		if isEventFunc {

			j.o = j.o.Call(evt, p[0], p[1], func(e js.Object) {
				p[2].(func(Event))(Event{Object: e})
			})
			return j

		} else {
			j.o = j.o.Call(evt, p[0], p[1], p[2])
			return j
		}
	case 4:
		if isEventFunc {

			j.o = j.o.Call(evt, p[0], p[1], p[2], func(e js.Object) {
				p[3].(func(Event))(Event{Object: e})
			})
			return j

		} else {
			j.o = j.o.Call(evt, p[0], p[1], p[2], p[3])
			return j
		}
	default:
		print(evt + " event should no have more than 4 arguments")
		j.o = j.o.Call(evt, p...)
		return j
	}
}

const (
	BLUR     = "blur"
	CHANGE   = "change"
	CLICK    = "click"
	DBLCLICK = "dblclick"
	FOCUS    = "focus"
	FOCUSIN  = "focusin"
	FOCUSOUT = "focusout"
	HOVER    = "hover"
	KEYDOWN  = "keydown"
	KEYPRESS = "keypress"
	KEYUP    = "keyup"
	SUBMIT   = "submit"

	LOAD       = "load"
	MOUSEDOWN  = "mousedown"
	MOUSEENTER = "mouseenter"
	MOUSELEAVE = "mouseleave"
	MOUSEMOVE  = "mousemove"
	MOUSEOUT   = "mouseout"
	MOUSEOVER  = "mouseover"
	MOUSEUP    = "mouseup"

	TOUCHSTART  = "touchstart"
	TOUCHMOVE   = "touchmove"
	TOUCHEND    = "touchend"
	TOUCHENTER  = "touchenter"
	TOUCHLEAVE  = "touchleave"
	TOUCHCANCEL = "touchcancel"
)
