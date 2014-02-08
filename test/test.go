package test

//test package for jquery
import (
	. "github.com/rusco/jquery"
	QUnit "github.com/rusco/qunit"
	"strconv"
)

func main() {

	QUnit.Module("core")
	QUnit.Test("jQuery Properties", func(assert QUnit.QUnitAssert) {
		jQ := NewJQuery()
		assert.Equal(jQ.Jquery(), "2.1.0", "JQuery Version")
		assert.Equal(jQ.Length(), 0, "jQuery().Length()")
		assert.Equal(jQ.Size(), 0, "jQuery().Size()")

		jQ2 := NewJQuery("body")
		assert.Equal(jQ2.Selector(), "body", `jQuery("body").Selector()`)
	})

	QUnit.Module("dom")
	QUnit.Test("basic dom manipulations", func(assert QUnit.QUnitAssert) {

		NewJQuery("p").AddClass("wow").Clone().Add("<span id='dom02'>WhatADay</span>").AppendTo("#div02")
		txt := NewJQuery("#div02").Find("span#dom02").Text()
		assert.Equal(txt, "WhatADay", "Test of Clone, Add, AppendTo, Find, Text Functions")

		NewJQuery("#div01 ul.first").Find(".foo").SetCss("width", "200px").End().Find(".bar").SetCss("width", "300px")
		assert.Equal(NewJQuery("#div01 #div01a").Css("width"), "200px", "Width should be 200px")
		assert.NotEqual(NewJQuery("#div01 #div01b").Css("width"), "200px", "Strange: Width is 200px ?")
		assert.Equal(NewJQuery("#div01 #div01c").Css("width"), "300px", "Width should be 300px")
		assert.NotEqual(NewJQuery("#div01 #div01d").Css("width"), "200px", "Strange: Width is 200px ?")
		assert.NotEqual(NewJQuery("#div01 #div01d").Css("width"), "300px", "Strange: Width is 300px ?")
		assert.NotEqual(NewJQuery("#div01 #div01e").Css("width"), "200px", "Strange: Width is 200px ?")
		assert.NotEqual(NewJQuery("#div01 #div01e").Css("width"), "300px", "Strange: Width is 300px ?")
		assert.NotEqual(NewJQuery("#div01 #div01f").Css("width"), "200px", "Strange: Width is 200px ?")
		assert.NotEqual(NewJQuery("#div01 #div01f").Css("width"), "300px", "Strange: Width is 300px ?")

		NewJQuery("li.third-item").Next().SetText("ok")
		assert.Equal(NewJQuery("#div02a").Text(), "ok", "Text should be 'ok' ")

	})

	QUnit.Module("api only")
	QUnit.Test("add function", func(assert QUnit.QUnitAssert) {
		QUnit.Expect(0)

		p := NewJQuery("p").Add("div").AddClass("dummy")
		_ = p
		pdiv := NewJQuery("p").Add("div")
		_ = pdiv

		elem := NewJQuery("#div01").Add("p")
		color := elem.Css("background-color")
		elem.SetCss("background-color", color)

		NewJQuery("li#doesnotexist").Clone().AddJQuery(NewJQuery("dt")).SetCss("background-color", "red").AppendTo("#div01")
		NewJQuery("li#doesalsonotexist").SetCss("background-color", "red").AppendTo("#div01")
		NewJQuery("li#andthis").Add("<p id='new'>new paragraph</p>").SetCss("background-color", "red").AppendTo("#div01")
		NewJQuery("div#new01").SetCss("border", "2px solid red").Add("h3").SetCss("background", "silver").AppendTo("#div01")
		NewJQuery("p#xnew02").Add("dl").SetCss("background", "blue")
		NewJQuery("p#new03").Clone().AddHtml("<span>Again</span>").AppendToJQuery(NewJQuery("body #div01"))
		NewJQuery("p#new04").AddJQuery(NewJQuery("a#sth")).SetCss("background", "red")

		collection := NewJQuery("p#elsewhere")
		collection = collection.AddJQuery(NewJQuery("a#notehere"))
		collection.SetCss("background", "green")

	})

	QUnit.Test("addClass function", func(assert QUnit.QUnitAssert) {
		QUnit.Expect(0)

		NewJQuery("p#someidx01").AddClass("myClass yourClass")
		NewJQuery("p#someidx02").RemoveClass("myClass noClass").AddClass("yourClass")
		NewJQuery("ul#someidx03 li").AddClassFn(func(index int) string {
			return "item-" + strconv.Itoa(index)
		})

		NewJQuery("p#someide04").AddClass("selected")
		NewJQuery("p#someidx05").AddClass("selected highlight")
		NewJQuery("div#someidx06").AddClassFnClass(func(index int, currentClass string) string {
			var addedClass string
			if currentClass == "red" {
				addedClass = "green"
				NewJQuery("p").SetText("There is one green div")
			}
			return addedClass
		})

	})

}
