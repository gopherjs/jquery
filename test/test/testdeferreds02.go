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

type obj struct {
	jquery.Deferred
}

func NewObj(d jquery.Deferred) obj {
	return obj{d}
}

func (o obj) hi(name string) {
	log("welcome ", name)
}

func main() {
	println("gopherjs version here")

	o := NewObj(jquery.NewDeferred())

	o.Resolve("John")

	// Use the object as a Promise
	o.Done(func(name string) {
		o.hi(name) // Will alert "Hello John"
	}).Done(func(name string) {
		log("done no. 2: ", name)
	})
	o.hi("Karl") // Will alert "Hello Karl"

}
