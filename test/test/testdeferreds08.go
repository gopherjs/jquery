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

func filterResolve() {

	o := jquery.NewDeferred()

	filtered := o.Then(nil, func(value int) int {
		return value * 3
	})
	o.Reject(6)
	filtered.Fail(func(value int) {
		log("Value is ( 3*6 = ) : ", value)
	})
}

func main() {
	println("gopherjs version here")
	filterResolve()
}
