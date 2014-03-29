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

	QUnit.Module("jQuery core")
	QUnit.Test("jQuery Properties", func(assert QUnit.QUnitAssert) {

		assert.Equal(jQuery().Jquery, "2.1.0", "JQuery Version")
		assert.Equal(jQuery().Length, 0, "jQuery().Length")

		jQ2 := jQuery("body")
		assert.Equal(jQ2.Selector, "body", `jQ2 := jQuery("body"); jQ2.Selector.Selector`)
		assert.Equal(jQuery("body").Selector, "body", `jQuery("body").Selector`)
	})

	//2do: put other tests here

	QUnit.Module("Ajax")
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

				QUnit.Ok(dataStr == expected, "Ajax call did not returns expected result")
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

	QUnit.AsyncTest("Load", func() interface{} {

		QUnit.Expect(1)
		jQuery(FIX).Load("/load.html", func() {
			if SHOWCONSOLE {
				print(" load got: ", jQuery(FIX).Html() == `<div>load successful!</div>`)
			}
			QUnit.Ok(jQuery(FIX).Html() == `<div>load successful!</div>`, "Load call did not returns expected result")
			QUnit.Start()
		})
		return nil
	})

	QUnit.AsyncTest("Get", func() interface{} {
		QUnit.Expect(1)

		jquery.Get("/get.html", func(data interface{}, status string, xhr interface{}) {
			if SHOWCONSOLE {
				print(" data:   ", data)
				print(" status: ", status)
				print(" xhr:    ", xhr)
			}
			QUnit.Ok(data == `<div>get successful!</div>`, "Get call did not returns expected result")
			QUnit.Start()
		})
		return nil
	})

	QUnit.AsyncTest("Post", func() interface{} {
		QUnit.Expect(1)
		jquery.Post("/gopher", func(data interface{}, status string, xhr interface{}) {
			if SHOWCONSOLE {
				print(" data:   ", data)
				print(" status: ", status)
				print(" xhr:    ", xhr)
			}
			QUnit.Ok(data == `<div>Welcome gopher</div>`, "Post call did not returns expected result")
			QUnit.Start()
		})
		return nil
	})

	QUnit.AsyncTest("GetJSON", func() interface{} {
		QUnit.Expect(1)
		jquery.GetJSON("/json/1", func(data interface{}) {
			if val, ok := data.(map[string]interface{})["json"]; ok {
				if SHOWCONSOLE {
					print("GetJSON call returns: ", val)
				}
				QUnit.Ok(val == `1`, "Json call did not returns expected result")
				QUnit.Start()
			}
		})
		return nil
	})

	QUnit.AsyncTest("GetScript", func() interface{} {
		QUnit.Expect(1)

		jquery.GetScript("/script", func(data interface{}) {
			if SHOWCONSOLE {
				print("GetScript call returns script of length: ", len(data.(string)))
			}

			QUnit.Ok(len(data.(string)) == 3373, "GetScript call did not returns expected result")
			QUnit.Start()

		})
		return nil
	})

	QUnit.AsyncTest("AjaxSetup", func() interface{} {
		QUnit.Expect(1)

		ajaxSetupOptions := Object{
			"async":       true,
			"type":        "POST",
			"url":         ROOT + "/nestedjson/",
			"contentType": "application/json charset=utf-8",
		}

		jquery.AjaxSetup(ajaxSetupOptions)

		ajaxopt := Object{
			"dataType": "json",
			"data":     nil,
			"beforeSend": func(data Object) {
				if SHOWCONSOLE {
					print(" ajaxSetup call, before:", data)
				}
			},
			"success": func(data Object) {

				dataStr := stringify(data)
				expected := `{"message":"Welcome!","nested":{"level":1,"moresuccess":true},"success":true}`

				QUnit.Ok(dataStr == expected, "AjaxSetup call did not returns expected result")
				QUnit.Start()

				if SHOWCONSOLE {
					print(" ajaxSetup call success:", data)
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
					print(" ajaxSetup Call error:", status)
				}
			},
		}
		//ajax
		jquery.Ajax(ajaxopt)

		return nil
	})

	QUnit.AsyncTest("AjaxPrefilter", func() interface{} {
		QUnit.Expect(1)
		jquery.AjaxPrefilter("+json", func(options interface{}, originalOptions string, jqXHR interface{}) {
			if SHOWCONSOLE {
				print(" ajax prefilter options:", options.(map[string]interface{})["url"].(string))
			}
			//API Test only
		})

		jquery.GetJSON("/json/3", func(data interface{}) {
			if val, ok := data.(map[string]interface{})["json"]; ok {
				if SHOWCONSOLE {
					print("ajaxPrefilter result: ", val.(string))
				}
				QUnit.Ok(val.(string) == "3", "AjaxPrefilter call did not returns expected result")
				QUnit.Start()
			}
		})
		return nil
	})

	QUnit.AsyncTest("AjaxTransport", func() interface{} {
		QUnit.Expect(1)

		jquery.AjaxTransport("+json", func(options interface{}, originalOptions string, jqXHR interface{}) {
			if SHOWCONSOLE {
				print(" ajax transport options:", options)
			}
			//API Test only
		})

		jquery.GetJSON("/json/4", func(data interface{}) {
			if val, ok := data.(map[string]interface{})["json"]; ok {
				QUnit.Ok(val.(string) == "4", "AjaxTransport call did not returns expected result")
				QUnit.Start()
			}
		})
		return nil
	})
}
