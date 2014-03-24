//GopherJS Version:
package main

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/gopherjs/jquery"
)

type Object map[string]interface{}

var jQuery = jquery.NewJQuery

func main() {

	jQuery("#btnAjaxGopherJs").On(jquery.CLICK, func() {

		showConsole := jQuery("input[name='console']").Is(":checked")
		if showConsole {
			print("GoperJS here")
		}

		ajaxopt := Object{
			"async":       true,
			"type":        "POST",
			"url":         "http://localhost:3000/json/",
			"contentType": "application/json; charset=utf-8",
			"dataType":    "json",
			"data":        nil,
			"beforeSend": func(data Object) {
				if showConsole {
					print(" before:", data)
				}
			},
			"success": func(data Object) {

				dataStr := js.Global.Get("JSON").Call("stringify", data).String()
				jQuery("#inTextArea").SetVal(dataStr)

				if showConsole {
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
				if showConsole {
					print(" error:", status)
				}
			},
		}
		//Ajax Call:
		jquery.Ajax(ajaxopt)
	})

	jQuery("#btnLoadGopherJS").On("click", func() {
		var showConsole = jQuery("input[name='console']").Is(":checked")

		jQuery("#result").Load("/snippet.html", func() {
			if showConsole {
				print("load was performed")
			}
		})

	})

}
