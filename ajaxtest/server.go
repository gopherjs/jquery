package main

import (
	"github.com/codegangsta/martini"
	"github.com/martini-contrib/render"

	"go/build"
)

func main() {
	m := martini.Classic()

	//serve test folder
	m.Use(martini.Static("test"))

	//serve sourcemaps from GOROOT and GOPATH
	m.Use(martini.Static(build.Default.GOROOT, martini.StaticOptions{Prefix: "goroot"}))
	m.Use(martini.Static(build.Default.GOPATH, martini.StaticOptions{Prefix: "gopath"}))
	m.Use(render.Renderer())

	m.Post("/json", func(r render.Render) {
		r.JSON(200, map[string]interface{}{"success": true, "message": "Welcome!", "nested": map[string]interface{}{"moresuccess": true, "level": 1}})
	})

	m.Run()
}
