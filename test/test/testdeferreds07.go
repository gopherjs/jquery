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

	filtered := o.Then(func(value int) int {
		return value * 2
	})
	o.Resolve(5)
	filtered.Done(func(value int) {
		log("Value is ( 2*5 = ) : ", value)
	})
}

func main() {
	println("gopherjs version here")

	filterResolve()
}
