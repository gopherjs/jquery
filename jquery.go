package jquery

import "github.com/neelance/gopherjs/js"

type JQuery struct {
	o js.Object
}

type Event struct {
	js.Object
	This    js.Object
	KeyCode int         `js "keyCode"`
	Target  int         `js "target"`
	Data    interface{} `js "data"`
}

//JQuery constructor via optional selector and context
func NewJQuery(args ...string) *JQuery {
	if len(args) == 1 {
		jQ := js.Global("jQuery").New(args[0])
		return &JQuery{jQ}
	} else if len(args) == 2 {
		jQ := js.Global("jQuery").New(args[0], args[1])
		return &JQuery{jQ}
	} else {
		return &JQuery{js.Global("jQuery").New()}
	}
}

//JQuery constructor via js.Object
func NewJQueryFromObject(o js.Object) *JQuery {
	jQ := js.Global("jQuery").New(o)
	return &JQuery{jQ}
}

//static method
func Trim(text string) string {
	return js.Global("jQuery").Call("trim", text).String()
}

func (j *JQuery) Jquery() string {
	return j.o.Get("jquery").String()
}

func (j *JQuery) Length() int {
	return j.o.Get("length").Int()
}

func (j *JQuery) Size() int {
	return j.o.Get("size").Int()
}

func (j *JQuery) Selector() string {
	return j.o.Get("selector").String()
}

func (j *JQuery) serialize() string {
	return j.o.Call("serialize").String()
}

func (j *JQuery) addBack() *JQuery {
	j.o = j.o.Call("addBack")
	return j
}

func (j *JQuery) addBackSelector(selector string) *JQuery {
	j.o = j.o.Call("addBack", selector)
	return j
}

func (j *JQuery) Css(name string) string {
	return j.o.Call("css", name).String()
}

func (j *JQuery) SetCss(name, value interface{}) *JQuery {
	j.o.Call("css", name, value)
	return j
}

func (j *JQuery) Text() string {
	return j.o.Call("text").String()
}

func (j *JQuery) SetText(name string) *JQuery {
	j.o.Call("text", name)
	return j
}

func (j *JQuery) Val() string {
	return j.o.Call("val").String()
}

func (j *JQuery) SetVal(name string) *JQuery {
	j.o.Call("val", name)
	return j
}

func (j *JQuery) Prop(property string) bool {
	return j.o.Call("prop", property).Bool()
}

func (j *JQuery) SetProp(name string, value bool) *JQuery {
	j.o.Call("prop", name, value)
	return j
}

func (j *JQuery) Attr(property string) string {
	return j.o.Call("attr", property).String()
}

func (j *JQuery) AddClass(property string) *JQuery {
	j.o.Call("addClass", property)
	return j
}

func (j *JQuery) RemoveClass(property string) *JQuery {
	j.o.Call("removeClass", property)
	return j
}

func (j *JQuery) ToggleClassName(className string, swtch bool) *JQuery {
	j.o.Call("toggleClass", className, swtch)
	return j
}

func (j *JQuery) ToggleClass(swtch bool) *JQuery {
	j.o.Call("toggleClass", swtch)
	return j
}

func (j *JQuery) Focus() *JQuery {
	j.o.Call("focus")
	return j
}

func (j *JQuery) Blur() *JQuery {
	j.o.Call("blur")
	return j
}

func (j *JQuery) On(event string, handler func(*Event)) *JQuery {
	j.o.Call("on", event, func(e js.Object) {
		handler(&Event{Object: e, This: js.This()})

	})
	return j
}

func (j *JQuery) OnSelector(event string, selector string, handler func(*Event)) *JQuery {
	j.o.Call("on", event, selector, func(e js.Object) {
		handler(&Event{Object: e, This: js.This()})

	})
	return j
}

func (j *JQuery) One(event string, handler func(*Event)) *JQuery {
	j.o.Call("one", event, func(e js.Object) {
		handler(&Event{Object: e, This: js.This()})

	})
	return j
}

func (j *JQuery) Off(event string, handler func()) *JQuery {
	j.o.Call("off", event, func() {
		handler()
	})
	return j
}

func (j *JQuery) AppendTo(destination string) *JQuery {
	j.o.Call("appendTo", destination)
	return j
}

func (j *JQuery) Toggle(showOrHide bool) *JQuery {
	j.o.Call("toggle", showOrHide)
	return j
}

func (j *JQuery) Show() *JQuery {
	j.o.Call("show")
	return j
}

func (j *JQuery) Hide() *JQuery {
	j.o.Call("hide")
	return j
}

func (j *JQuery) Html() string {
	return j.o.Call("html").String()
}

func (j *JQuery) SetHtml(html string) *JQuery {
	j.o.Call("html", html)
	return j
}

func (j *JQuery) HtmlFn(fn func(idx int, txt string) string) *JQuery {
	j.o.Call("html", func(idx int, txt string) string {
		return fn(idx, txt)
	})
	return j
}

func (j *JQuery) TextFn(fn func(idx int, txt string) string) *JQuery {
	j.o.Call("text", func(idx int, txt string) string {
		return fn(idx, txt)
	})
	return j
}

func (j *JQuery) Find(selector string) *JQuery {
	found := j.o.Call("find", selector)
	return &JQuery{found}
}

func (j *JQuery) Closest(selector string) *JQuery {
	closest := j.o.Call("closest", selector)
	return &JQuery{closest}
}
func (j *JQuery) End() *JQuery {
	j.o = j.o.Call("end")
	return j
}

func (j *JQuery) Data(key string) string {
	return j.o.Call("data", key).String()
}

func (j *JQuery) Add(selector string) *JQuery {
	j.o = j.o.Call("add", selector)
	return j
}
func (j *JQuery) AddContext(selector string, context interface{}) *JQuery {
	j.o = j.o.Call("add", selector, context)
	return j
}

func (j *JQuery) AddElems(elements ...interface{}) *JQuery {
	j.o = j.o.Call("add", elements...)
	return j
}
func (j *JQuery) AddHtml(html string) *JQuery {
	j.o = j.o.Call("add", html)
	return j
}
func (j *JQuery) AddJquery(obj JQuery) *JQuery {
	j.o = j.o.Call("add", obj)
	return j
}

func (j *JQuery) Clone() *JQuery {
	j.o = j.o.Call("clone")
	return j
}

func (j *JQuery) CloneWithDataAndEvents(withDataAndEvents bool) *JQuery {
	j.o = j.o.Call("clone", withDataAndEvents)
	return j
}

func (j *JQuery) CloneDeep(withDataAndEvents bool, deepWithDataAndEvents bool) *JQuery {
	j.o = j.o.Call("clone", withDataAndEvents, deepWithDataAndEvents)
	return j
}

func (j *JQuery) Next() *JQuery {
	j.o = j.o.Call("next")
	return j
}

func (j *JQuery) NextSelector(selector string) *JQuery {
	j.o = j.o.Call("next", selector)
	return j
}

const (
	EvtCLICK    = "click"
	EvtKEYUP    = "keyup"
	EvtCHANGE   = "change"
	EvtDBLCLICK = "dblclick"
	EvtKEYPRESS = "keypress"
	EvtBLUR     = "blur"
)
