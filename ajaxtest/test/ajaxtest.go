package test

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/gopherjs/jquery"
	QUnit "github.com/rusco/qunit"
)

const (
	FIX         = "#qunit-fixture"
	SHOWCONSOLE = false
	ROOT        = "http://localhost:3000"
)

type Object map[string]interface{}

var jQuery = jquery.NewJQuery //convenience

func stringify(i interface{}) string {
	return js.Global.Get("JSON").Call("stringify", i).String()
}

func main() {

	QUnit.Module("jquery core")
	QUnit.Test("jQuery Properties", func(assert QUnit.QUnitAssert) {

		assert.Equal(jQuery().Jquery, "2.1.0", "JQuery Version")
		assert.Equal(jQuery().Length, 0, "jQuery().Length")

		jQ2 := jQuery("body")
		assert.Equal(jQ2.Selector, "body", `jQ2 := jQuery("body"); jQ2.Selector.Selector`)
		assert.Equal(jQuery("body").Selector, "body", `jQuery("body").Selector`)
	})

	/*
		---> put other tests here
	*/

	QUnit.AsyncTest("Async Dummy Test", func() interface{} {
		QUnit.Expect(1)

		return js.Global.Call("setTimeout", func() {
			QUnit.Ok(true, " async ok")
			QUnit.Start()
		}, 1000)

	})

	QUnit.AsyncTest("Ajax Call", func() interface{} {

		QUnit.Expect(1)

		ajaxopt := Object{
			"async":       true,
			"type":        "POST",
			"url":         ROOT + "/nestedjson/",
			"contentType": "application/json charset=utf-8",
			"dataType":    "json",
			"data":        nil,
			"beforeSend": func(data Object) {
				if SHOWCONSOLE {
					print(" before:", data)
				}
			},
			"success": func(data Object) {

				dataStr := stringify(data)
				expected := `{"message":"Welcome!","nested":{"level":1,"moresuccess":true},"success":true}`

				QUnit.Ok(dataStr == expected, " ajax call did not returns expected result")
				QUnit.Start()

				if SHOWCONSOLE {
					print(" ajax call success:", data)
					for k, v := range data {
						switch v.(type) {
						case bool:
							print(k, v.(bool))
						case string:
							print(k, v.(string))
						case float64:
							print(k, v.(float64))
						default:
							print("sth. else:", k, v)
						}
					}
				}
			},
			"error": func(status interface{}) {
				if SHOWCONSOLE {
					print(" ajax call error:", status)
				}
			},
		}
		//ajax call:
		jquery.Ajax(ajaxopt)
		return nil
	})

}
