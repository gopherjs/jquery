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
	KeyCode        int         `js:"keyCode"`
	Target         js.Object   `js:"target"`
	CurrentTarget  js.Object   `js:"currentTarget"`
	DelegateTarget js.Object   `js:"delegateTarget"`
	RelatedTarget  js.Object   `js:"relatedTarget"`
	Data           interface{} `js:"data"`
	Which          int         `js:"which"`
}

type JQueryCoordinates struct {
	Left int `js:"left"`
	Top  int `js:"top"`
}

func (event *Event) PreventDefault() {
	event.Call("preventDefault")
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
	//2do: check difference to empty gopherjs function
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

func (j JQuery) Get() js.Object {
	return j.o.Call("get")
}
func (j JQuery) GetByIndex(index int) js.Object {
	return j.o.Call("get", index)
}

func (j JQuery) Append(obj interface{}) JQuery {
	j.o = j.o.Call("append", obj)
	return j
}

func (j JQuery) Empty() JQuery {
	j.o = j.o.Call("empty")
	return j
}

func (j JQuery) Detach() JQuery {
	j.o = j.o.Call("detach")
	return j
}

func (j JQuery) DetachBySelector(sel string) JQuery {
	j.o = j.o.Call("detach", sel)
	return j
}

//methods
func (j JQuery) Serialize() string {
	return j.o.Call("serialize").String()
}

func (j JQuery) AddBack() JQuery {
	j.o = j.o.Call("addBack")
	return j
}

func (j JQuery) Eq(idx int) JQuery {
	j.o = j.o.Call("eq", idx)
	return j
}

//to "range" over selection:
func (j JQuery) ToArray() []interface{} {
	return j.o.Call("toArray").Interface().([]interface{})
}

func (j JQuery) Remove() JQuery {
	j.o = j.o.Call("remove")
	return j
}
func (j JQuery) RemoveBySelector(selector string) JQuery {
	j.o = j.o.Call("remove", selector)
	return j
}

func (j JQuery) AddBackBySelector(selector string) JQuery {
	j.o = j.o.Call("addBack", selector)
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

func (j JQuery) SetText(name string) JQuery {
	j.o = j.o.Call("text", name)
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

func (j JQuery) AddClass(property string) JQuery {
	j.o = j.o.Call("addClass", property)
	return j
}

func (j JQuery) AddClassFn(fn func(idx int) string) JQuery {
	j.o.Call("html", func(idx int) string {
		return fn(idx)
	})
	return j
}
func (j JQuery) AddClassFnClass(fn func(idx int, class string) string) JQuery {
	j.o.Call("html", func(idx int, class string) string {
		return fn(idx, class)
	})
	return j
}

func (j JQuery) RemoveClass(property string) JQuery {
	j.o = j.o.Call("removeClass", property)
	return j
}

func (j JQuery) ToggleClassByName(className string, swtch bool) JQuery {
	j.o = j.o.Call("toggleClass", className, swtch)
	return j
}

func (j JQuery) ToggleClass(swtch bool) JQuery {
	j.o.Call("toggleClass", swtch)
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

func (j JQuery) On(event string, handler func(Event)) JQuery {
	j.o.Call("on", event, func(e js.Object) {
		handler(Event{Object: e})
	})
	return j
}

func (j JQuery) OnParam(event string, param interface{}) JQuery {
	j.o.Call("on", event, param)
	return j
}

func (j JQuery) OnSelector(event string, selector string, handler func(Event)) JQuery {
	j.o.Call("on", event, selector, func(e js.Object) {
		handler(Event{Object: e})

	})
	return j
}

func (j JQuery) One(event string, handler func(Event)) JQuery {
	j.o.Call("one", event, func(e js.Object) {
		handler(Event{Object: e})
	})
	return j
}

func (j JQuery) Off(event string, handler func(Event)) JQuery {
	j.o.Call("off", event, func(e js.Object) {
		handler(Event{Object: e})
	})
	return j
}

func (j JQuery) After(sel interface{}) JQuery {
	j.o = j.o.Call("after", sel)
	return j
}

func (j JQuery) AfterContext(sel interface{}, ctx interface{}) JQuery {
	j.o = j.o.Call("after", sel, ctx)
	return j
}

func (j JQuery) Before(sel interface{}) JQuery {
	j.o = j.o.Call("before", sel)
	return j
}

func (j JQuery) BeforeContext(sel interface{}, ctx interface{}) JQuery {
	j.o = j.o.Call("before", sel, ctx)
	return j
}

func (j JQuery) Prepend(sel interface{}) JQuery {
	j.o = j.o.Call("prepend", sel)
	return j
}

func (j JQuery) PrependContext(sel interface{}, ctx interface{}) JQuery {
	j.o = j.o.Call("prepend", sel, ctx)
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
	j.o = j.o.Call("html")
	return j
}

func (j JQuery) Html() string {
	return j.o.Call("html").String()
}

func (j JQuery) SetHtml(html string) JQuery {
	j.o = j.o.Call("html", html)
	return j
}

func (j JQuery) HtmlByFunc(fn func(idx int, txt string) string) JQuery {
	j.o.Call("html", func(idx int, txt string) string {
		return fn(idx, txt)
	})
	return j
}

func (j JQuery) TextByFunc(fn func(idx int, txt string) string) JQuery {
	j.o.Call("text", func(idx int, txt string) string {
		return fn(idx, txt)
	})
	return j
}

func (j JQuery) Closest(selector interface{}) JQuery {
	j.o = j.o.Call("closest", selector)
	return j
}
func (j JQuery) End() JQuery {
	j.o = j.o.Call("end")
	return j
}

func (j JQuery) Add(sel interface{}) JQuery {
	j.o = j.o.Call("add", sel)
	return j
}
func (j JQuery) AddByContext(selector string, context interface{}) JQuery {
	j.o = j.o.Call("add", selector, context)
	return j
}

func (j JQuery) Clone() JQuery {
	j.o = j.o.Call("clone")
	return j
}

func (j JQuery) CloneWithDataAndEvents(withDataAndEvents bool) JQuery {
	j.o = j.o.Call("clone", withDataAndEvents)
	return j
}

func (j JQuery) CloneDeep(withDataAndEvents bool, deepWithDataAndEvents bool) JQuery {
	j.o = j.o.Call("clone", withDataAndEvents, deepWithDataAndEvents)
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
	return j.o.Call("scrollTop").Int()
}

func (j JQuery) SetWidth(value string) JQuery {
	j.o = j.o.Call("scrollTop", value)
	return j
}

func (j JQuery) WidthByFunc(fn func(index int, width string) string) JQuery {
	j.o.Call("width", func(index int, width string) string {
		return fn(index, width)
	})
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
	//2do: test
	j.o = j.o.Call("offset", jc)
	return j
}

func (j JQuery) OuterHeight() int {
	return j.o.Call("outerHeight").Int()

}
func (j JQuery) OuterHeightWithMargin(includeMargin bool) int {
	return j.o.Call("outerHeight", includeMargin).Int()

}
func (j JQuery) OuterWidth() int {
	return j.o.Call("outerWidth").Int()

}
func (j JQuery) OuterWidthWithMargin(includeMargin bool) int {
	return j.o.Call("outerWidth", includeMargin).Int()
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

func (j JQuery) Data(key string) string {
	return j.o.Call("data", key).String()
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

func (j JQuery) Parent() JQuery {
	j.o = j.o.Call("parent")
	return j
}

func (j JQuery) ParentBySelector(selector string) JQuery {
	j.o = j.o.Call("parent", selector)
	return j
}
func (j JQuery) Parents() JQuery {
	j.o = j.o.Call("parents")
	return j
}

func (j JQuery) ParentsBySelector(selector string) JQuery {
	j.o = j.o.Call("parents", selector)
	return j
}

func (j JQuery) ParentsUntil() JQuery {
	j.o = j.o.Call("parentsUntil")
	return j
}

func (j JQuery) ParentsUntilBySelector(sel interface{}) JQuery {
	j.o = j.o.Call("parentsUntil", sel)
	return j
}

func (j JQuery) ParentsUntilBySelectorAndFilter(selector interface{}, filter interface{}) JQuery {
	j.o = j.o.Call("parentsUntil", selector, filter)
	return j
}

func (j JQuery) Prev() JQuery {
	j.o = j.o.Call("prev")
	return j
}

func (j JQuery) PrevBySelector(selector string) JQuery {
	j.o = j.o.Call("prev", selector)
	return j
}

func (j JQuery) PrevAll() JQuery {
	j.o = j.o.Call("prevAll")
	return j
}

func (j JQuery) PrevAllBySelector(selector string) JQuery {
	j.o = j.o.Call("prevAll", selector)
	return j
}

func (j JQuery) PrevUntil(selector string) JQuery {
	j.o = j.o.Call("prevUntil", selector)
	return j
}

func (j JQuery) PrevUntilByFilter(selector string, filter string) JQuery {
	j.o = j.o.Call("prevUntil", selector, filter)
	return j
}

func (j JQuery) PrevUntilByJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("prevUntil", obj.o)
	return j
}

func (j JQuery) PrevUntilByJQueryAndFilter(obj JQuery, filter string) JQuery {
	j.o = j.o.Call("prevUntil", obj.o, filter)
	return j
}

func (j JQuery) Siblings() JQuery {
	j.o = j.o.Call("siblings")
	return j
}

func (j JQuery) SiblingsBySelector(selector string) JQuery {
	j.o = j.o.Call("siblings", selector)
	return j
}

func (j JQuery) Slice(start int) JQuery {
	j.o = j.o.Call("slice", start)
	return j
}

func (j JQuery) SliceByEnd(start int, end int) JQuery {
	j.o = j.o.Call("slice", start, end)
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

func (j JQuery) Next() JQuery {
	j.o = j.o.Call("next")
	return j
}

func (j JQuery) NextBySelector(selector string) JQuery {
	j.o = j.o.Call("next", selector)
	return j
}

func (j JQuery) NextAll() JQuery {
	j.o = j.o.Call("nextAll")
	return j
}

func (j JQuery) NextAllBySelector(selector string) JQuery {
	j.o = j.o.Call("nextAll", selector)
	return j
}

func (j JQuery) NextUntil(selector string) JQuery {
	j.o = j.o.Call("nextUntil", selector)
	return j
}

func (j JQuery) NextUntilByFilter(selector string, filter string) JQuery {
	j.o = j.o.Call("nextUntil", selector, filter)
	return j
}

func (j JQuery) NextUntilByJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("nextUntil", obj.o)
	return j
}

func (j JQuery) NextUntilByJQueryAndFilter(obj JQuery, filter string) JQuery {
	j.o = j.o.Call("nextUntil", obj.o, filter)
	return j
}

func (j JQuery) Not(selector string) JQuery {
	j.o = j.o.Call("not", selector)
	return j
}

func (j JQuery) NotByJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("not", obj.o)
	return j
}

func (j JQuery) Filter(selector string) JQuery {
	j.o = j.o.Call("filter", selector)
	return j
}

func (j JQuery) FilterByFunc(fn func(index int) int) JQuery {
	j.o.Call("filter", func(index int) int {
		return fn(index)
	})
	return j
}

func (j JQuery) FilterByJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("filter", obj.o)
	return j
}

func (j JQuery) Find(selector string) JQuery {
	j.o = j.o.Call("find", selector)
	return j
}

func (j JQuery) FindByJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("find", obj.o)
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

func (j JQuery) Is(selector interface{}) bool {
	return j.o.Call("is", selector).Bool()
}

func (j JQuery) IsByFunc(fn func(index int) bool) JQuery {
	j.o.Call("width", func(index int) bool {
		return fn(index)
	})
	return j
}

func (j JQuery) IsByJQuery(obj JQuery) bool {
	return j.o.Call("is", obj.o).Bool()
}

func (j JQuery) Last() JQuery {
	j.o = j.o.Call("last")
	return j
}

func (j JQuery) Ready(handler func()) JQuery {
	j.o = j.o.Call("ready", handler)
	return j
}

func (j JQuery) Resize() JQuery {
	j.o = j.o.Call("resize")
	return j
}

func (j JQuery) ResizeFn(handler func(js.Object) js.Object) JQuery {

	j.o.Call("resize", func(ev js.Object) js.Object {
		return handler(ev)
	})
	return j
}

func (j JQuery) ResizeDataFn(eventData js.Object, handler func(js.Object) js.Object) JQuery {

	j.o.Call("resize", eventData, func(ev js.Object) js.Object {
		return handler(ev)
	})
	return j
}

func (j JQuery) Scroll() JQuery {
	j.o = j.o.Call("scroll")
	return j
}

func (j JQuery) ScrollFn(handler func()) JQuery {

	j.o.Call("scroll", func() {
		handler()
	})
	return j
}

func (j JQuery) ScrollDataFn(eventData js.Object, handler func(js.Object) js.Object) JQuery {

	j.o.Call("scroll", eventData, func(ev js.Object) js.Object {
		return handler(ev)
	})
	return j
}

func (j JQuery) FadeOut(duration string) JQuery {
	j.o = j.o.Call("fadeOut", duration)
	return j
}

func (j JQuery) Select() JQuery {
	j.o = j.o.Call("select")
	return j
}

func (j JQuery) SelectFn(handler func()) JQuery {

	j.o.Call("select", func() {
		handler()
	})
	return j
}

func (j JQuery) SelectDataFn(eventData js.Object, handler func(js.Object) js.Object) JQuery {

	j.o.Call("select", eventData, func(ev js.Object) js.Object {
		return handler(ev)
	})
	return j
}

func (j JQuery) Submit() JQuery {
	j.o = j.o.Call("submit")
	return j
}

func (j JQuery) SubmitFn(handler func()) JQuery {

	j.o.Call("submit", func() {
		handler()
	})
	return j
}

func (j JQuery) SubmitDataFn(eventData js.Object, handler func(Event)) JQuery {

	j.o.Call("submit", eventData, func(e js.Object) {
		handler(Event{Object: e})
	})
	return j
}

func (j JQuery) Trigger(event string) JQuery {
	j.o = j.o.Call("trigger", event)
	return j
}
func (j JQuery) TriggerParam(eventType string, extraParam interface{}) JQuery {
	j.o = j.o.Call("trigger", eventType, extraParam)
	return j
}

func (j JQuery) TriggerHandler(eventType string, extraParam interface{}) JQuery {
	j.o = j.o.Call("triggerHandler", eventType, extraParam)
	return j
}

func (j JQuery) Unbind() JQuery {
	j.o.Call("unbind")
	return j
}

func (j JQuery) UnbindEvent(eventType js.Object) JQuery {
	j.o.Call("unbind", eventType)
	return j
}

func (j JQuery) UnbindFn(eventType js.Object, handler func(js.Object) js.Object) JQuery {

	j.o.Call("unbind", eventType, func(ev js.Object) js.Object {
		return handler(ev)
	})
	return j
}

func (j JQuery) Undelegate() JQuery {
	j.o.Call("undelegate")
	return j
}

func (j JQuery) UndelegateEvent(eventType js.Object) JQuery {
	j.o.Call("undelegate", eventType)
	return j
}

func (j JQuery) UndelegateNamespace(ns string) JQuery {
	j.o.Call("undelegate", ns)
	return j
}

func (j JQuery) UndelegateFn(eventType js.Object, handler func(js.Object) js.Object) JQuery {

	j.o.Call("undelegate", eventType, func(ev js.Object) js.Object {
		return handler(ev)
	})
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

	LOAD       = "load"
	MOUSEDOWN  = "mousedown"
	MOUSEENTER = "mouseenter"
	MOUSELEAVE = "mouseleave"
	MOUSEMOVE  = "mousemove"
	MOUSEOUT   = "mouseout"
	MOUSEOVER  = "mouseover"
	MOUSEUP    = "mouseup"
)
