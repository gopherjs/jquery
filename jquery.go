package jquery

import "github.com/neelance/gopherjs/js"

type JQuery struct {
	o        js.Object
	Jquery   string `js:"jquery"`
	Selector string `js:"selector"`
	Length   string `js:"length"`
}

type Event struct {
	js.Object
	KeyCode int         `js:"keyCode"`
	Target  int         `js:"target"`
	Data    interface{} `js:"data"`
}

//JQuery constructor via optional selector and context
func NewJQuery(args ...string) JQuery {
	if len(args) == 1 {
		jQ := js.Global("jQuery").New(args[0])
		return JQuery{o: jQ}
	} else if len(args) == 2 {
		jQ := js.Global("jQuery").New(args[0], args[1])
		return JQuery{o: jQ}
	}
	return JQuery{o: js.Global("jQuery").New()}
}

//JQuery constructor via js.Object
func NewJQueryByObject(o js.Object) JQuery {
	return JQuery{o: js.Global("jQuery").New(o)}
}

//static method
func Trim(text string) string {
	return js.Global("jQuery").Call("trim", text).String()
}

func (j JQuery) serialize() string {
	return j.o.Call("serialize").String()
}

func (j JQuery) addBack() JQuery {
	j.o = j.o.Call("addBack")
	return j
}

func (j JQuery) addBackBySelector(selector string) JQuery {
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

func (j JQuery) Prop(property string) bool {
	return j.o.Call("prop", property).Bool()
}

func (j JQuery) SetProp(name string, value bool) JQuery {
	j.o = j.o.Call("prop", name, value)
	return j
}

func (j JQuery) Attr(property string) string {
	return j.o.Call("attr", property).String()
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

func (j JQuery) On(event string, handler func(js.Object, *Event)) JQuery {

	j.o.Call("on", event, func(e js.Object) {
		handler(js.This(), &Event{Object: e})
	})
	return j
}

func (j JQuery) OnSelector(event string, selector string, handler func(js.Object, *Event)) JQuery {
	j.o.Call("on", event, selector, func(e js.Object) {
		handler(js.This(), &Event{Object: e})

	})
	return j
}

func (j JQuery) One(event string, handler func(js.Object, *Event)) JQuery {
	j.o.Call("one", event, func(e js.Object) {
		handler(js.This(), &Event{Object: e})
	})
	return j
}

func (j JQuery) Off(event string, handler func()) JQuery {
	j.o.Call("off", event, func() {
		handler()
	})
	return j
}

func (j JQuery) AppendTo(destination string) JQuery {
	j.o = j.o.Call("appendTo", destination)
	return j
}

func (j JQuery) AppendToJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("appendTo", obj.o)
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

func (j JQuery) Closest(selector string) JQuery {
	j.o = j.o.Call("closest", selector)
	return j
}
func (j JQuery) End() JQuery {
	j.o = j.o.Call("end")
	return j
}

func (j JQuery) Add(selector string) JQuery {
	j.o = j.o.Call("add", selector)
	return j
}
func (j JQuery) AddByContext(selector string, context interface{}) JQuery {
	j.o = j.o.Call("add", selector, context)
	return j
}

func (j JQuery) AddHtml(html string) JQuery {
	j.o = j.o.Call("add", html)
	return j
}
func (j JQuery) AddJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("add", obj.o)
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

func (j JQuery) ClearQueue(queueName string) JQuery {
	j.o = j.o.Call("clearQueue", queueName)
	return j
}

func (j JQuery) SetData(key string, value interface{}) JQuery {
	j.o = j.o.Call("data", key, value)
	return j
}
func (j JQuery) DataByKey(key string) interface{} {
	return j.o.Call("data", key).Interface()
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

func (j JQuery) ParentsUntil(selector string) JQuery {
	j.o = j.o.Call("parentsUntil", selector)
	return j
}

func (j JQuery) ParentsUntilByFilter(selector string, filter string) JQuery {
	j.o = j.o.Call("parentsUntil", selector, filter)
	return j
}

func (j JQuery) ParentsUntilByJQuery(obj JQuery) JQuery {
	j.o = j.o.Call("parentsUntil", obj.o)
	return j
}

func (j JQuery) ParentsUntilByJQueryAndFilter(obj JQuery, filter string) JQuery {
	j.o = j.o.Call("parentsUntil", obj.o, filter)
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

func (j JQuery) Is(selector string) bool {
	return j.o.Call("Is", selector).Bool()
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
	j.o = j.o.Call("Last")
	return j
}

const (
	EvtBLUR     = "blur"
	EvtCHANGE   = "change"
	EvtCLICK    = "click"
	EvtDBLCLICK = "dblclick"
	EvtFOCUS    = "focus"
	EvtFOCUSIN  = "focusin"
	EvtFOCUSOUT = "focusout"
	EvtHOVER    = "hover"
	EvtKEYDOWN  = "keydown"
	EvtKEYPRESS = "keypress"
	EvtKEYUP    = "keyup"

	EvtLOAD       = "load"
	EvtMOUSEDOWN  = "mousedown"
	EvtMOUSEENTER = "mouseenter"
	EvtMOUSELEAVE = "mouseleave"
	EvtMOUSEMOVE  = "mousemove"
	EvtMOUSEOUT   = "mouseout"
	EvtMOUSEOVER  = "mouseover"
	EvtMOUSEUP    = "mouseup"
)
