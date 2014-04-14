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

func main() {
	println("gopherjs version here")
	jquery.Get("/get.html").Always(func() {
		log("$.get completed with success or error callback arguments")
	})
}
