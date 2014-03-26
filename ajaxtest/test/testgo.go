//GopherJS Version:
package main

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/gopherjs/jquery"
)

type Object map[string]interface{}

var jQuery = jquery.NewJQuery

func isChecked() bool {
	return jQuery("input[name='console']").Is(":checked")
}

func stringify(i interface{}) string {
	return js.Global.Get("JSON").Call("stringify", i).String()
}

func main() {

	jQuery("#btnAjaxGopherJs").On(jquery.CLICK, func() {

		if isChecked() {
			print("GoperJS here")
		}

		ajaxopt := Object{
			"async":       true,
			"type":        "POST",
			"url":         "http://localhost:3000/nestedjson/",
			"contentType": "application/json; charset=utf-8",
			"dataType":    "json",
			"data":        nil,
			"beforeSend": func(data Object) {
				if isChecked() {
					print(" before:", data)
				}
			},
			"success": func(data Object) {

				dataStr := stringify(data)
				jQuery("#inTextArea").SetVal(dataStr)

				if isChecked() {
					print(" success:", data)
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
				if isChecked() {
					print(" error:", status)
				}
			},
		}
		//ajax
		jquery.Ajax(ajaxopt)
	})

	//load
	jQuery("#btnLoadGopherJS").On(jquery.CLICK, func() {

		jQuery("#result").Load("/load.html", func() {
			if isChecked() {
				print("load was performed")
			}
		})

	})
	//get
	jQuery("#btnGetGopherJS").On(jquery.CLICK, func() {

		jquery.Get("/get.html", func(data interface{}, status string, xhr interface{}) {
			if isChecked() {
				print(" data:   ", data)
				print(" status: ", status)
				print(" xhr:    ", xhr)
			}
			jQuery("#result").SetHtml(data)
		})
	})
	//post
	jQuery("#btnPostGopherJS").On(jquery.CLICK, func() {
		jquery.Post("/gopher", func(data interface{}, status string, xhr interface{}) {
			if isChecked() {
				print(" data:   ", data)
				print(" status: ", status)
				print(" xhr:    ", xhr)
			}
			jQuery("#result").SetHtml(data)
		})
	})

	//getjson
	jQuery("#btnJsonGopherJs").On("click", func() {

		jquery.GetJSON("/json/1", func(data interface{}) {
			if val, ok := data.(map[string]interface{})["json"]; ok {
				jQuery("#inTextArea").SetVal(val)
			}
		})
	})

	//getscript
	jQuery("#btnGetScriptGopherJs").On("click", func() {

		jquery.GetScript("/script", func(data interface{}) {
			jQuery("#inTextArea").SetVal(data)

		})
	})

	//2do: ajaxSetup
	//2do: reorg indexhtml: use qunit
	//2do: use struct for getParam

}
