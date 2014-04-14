package main

//2do: integrate in QUnit Testsuite

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/gopherjs/jquery"
)

var jQuery = jquery.NewJQuery

func log(i ...interface{}) {
	js.Global.Get("console").Call("log", i...)
}

type working struct {
	d jquery.Deferred
}

func NewWorking(d jquery.Deferred) working {
	return working{d: d}
}

func (w working) notify() {
	if w.d.State() == "pending" {
		w.d.Notify("working... ")
		js.Global.Call("setTimeout", w.notify, 500)
	}
}

func dp(accept bool, i int) js.Object {

	dfd := jquery.NewDeferred()

	if accept {
		js.Global.Call("setTimeout", func() {
			dfd.Resolve("hurray")
		}, 200*i)
	} else {
		js.Global.Call("setTimeout", func() {
			dfd.Reject("sorry")
		}, 210*i)
	}

	wx := NewWorking(dfd)
	js.Global.Call("setTimeout", wx.notify, 1)

	return dfd.Promise()
}

func main() {
	println("gopherjs version here")

	for i := 0; i < 10; i++ {

		jquery.When(dp(i%2 == 0, i)).Then(

			func(status interface{}) {
				log(status, "things are going well")
			},
			func(status interface{}) {
				log(status, ", you fail this time")
			},
			func(status interface{}) {
				jQuery("body").Append(status.(string))
			},
		)
	}

}
