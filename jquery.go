package jquery

import "github.com/neelance/gopherjs/js"

type JQuery struct {
	o js.Object
}

type EventContext struct {
	js.Object
	This    js.Object
	KeyCode int         `js:"keyCode"`
	Target  int         `js:"target"`
	Data    interface{} `js:"data"`
}

//constructors
func NewJQuery(args ...string) *JQuery {
	if len(args) == 2 {
		jQ := js.Global("jQuery").New(args[0], args[1])
		return &JQuery{jQ}
	}
	jQ := js.Global("jQuery").New(args[0])
	return &JQuery{jQ}
}

func NewJQueryFromObject(o js.Object) *JQuery {
	jQ := js.Global("jQuery").New(o)
	return &JQuery{jQ}
}

//statics
func Trim(text string) string {
	return js.Global("jQuery").Call("trim", text).String()
}

func (j *JQuery) Jquery() string {
	return j.o.Get("jquery").String()
}

func (j *JQuery) Selector() string {
	return j.o.Get("selector").String()
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

func (j *JQuery) Focus() *JQuery {
	j.o.Call("focus")
	return j
}

func (j *JQuery) Blur() *JQuery {
	j.o.Call("blur")
	return j
}

func (j *JQuery) On(event string, handler func(*EventContext)) *JQuery {
	j.o.Call("on", event, func(e js.Object) {
		handler(&EventContext{Object: e, This: js.This()})
	})
	return j
}

func (j *JQuery) OnSelector(event string, selector string, handler func(*EventContext)) *JQuery {
	j.o.Call("on", event, selector, func(e js.Object) {
		handler(&EventContext{Object: e, This: js.This()})
	})
	return j
}

func (j *JQuery) One(event string, handler func(*EventContext)) *JQuery {
	j.o.Call("one", event, func(e js.Object) {
		handler(&EventContext{Object: e, This: js.This()})
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

const (
	EvtCLICK    = "click"
	EvtKEYUP    = "keyup"
	EvtCHANGE   = "change"
	EvtDBLCLICK = "dblclick"
	EvtKEYPRESS = "keypress"
	EvtBLUR     = "blur"
)
