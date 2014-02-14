package test

//test package for jquery bindings
//developed in itertative TDD style
import (
	"github.com/gopherjs/gopherjs/js"
	jQueryStatic "github.com/rusco/jquery"
	QUnit "github.com/rusco/qunit"
	"strconv"
	"strings"
	"time"
)

const (
	FIX = "#qunit-fixture"
)

var (
	jQuery = jQueryStatic.NewJQuery
)

func getDocumentBody() js.Object {
	return js.Global("document").Get("body")
}

func getWindow() js.Object {
	return js.Global("window")
}

func getGlobalVariable(variable string) js.Object {
	return js.Global("window").Get(variable)
}

func main() {

	QUnit.Module("core")
	QUnit.Test("jQuery Properties", func(assert QUnit.QUnitAssert) {

		assert.Equal(jQuery().Jquery, "2.1.0", "JQuery Version")
		assert.Equal(jQuery().Length, 0, "jQuery().Length")

		jQ2 := jQuery("body")
		assert.Equal(jQ2.Selector, "body", `jQ2 := jQuery("body"); jQ2.Selector.Selector`)
		assert.Equal(jQuery("body").Selector, "body", `jQuery("body").Selector`)
	})

	QUnit.Test("Test Setup", func(assert QUnit.QUnitAssert) {

		test := jQuery(getDocumentBody()).Find(FIX)
		assert.Equal(test.Selector, FIX, "#qunit-fixture find Selector")
		assert.Equal(test.Context, getDocumentBody(), "#qunit-fixture find Context")
	})

	QUnit.Test("Static Functions", func(assert QUnit.QUnitAssert) {

		jQueryStatic.GlobalEval("var globalEvalTest = 2;")
		assert.Equal(getGlobalVariable("globalEvalTest").Int(), 2, "GlobalEval: Test variable declarations are global")

		assert.Equal(jQueryStatic.Trim("  GopherJS  "), "GopherJS", "Trim: leading and trailing space")

		assert.Equal(jQueryStatic.Type(true), "boolean", "Type: Boolean")
		assert.Equal(jQueryStatic.Type(time.Now()), "date", "Type: Date")
		assert.Equal(jQueryStatic.Type("GopherJS"), "string", "Type: String")
		assert.Equal(jQueryStatic.Type(12.21), "number", "Type: Number")
		assert.Equal(jQueryStatic.Type(nil), "null", "Type: Null")
		assert.Equal(jQueryStatic.Type([2]string{"go", "lang"}), "array", "Type: Array")
		assert.Equal(jQueryStatic.Type([]string{"go", "lang"}), "array", "Type: Array")
		o := map[string]interface{}{"a": true, "b": 1.1, "c": "more"}
		assert.Equal(jQueryStatic.Type(o), "object", "Type: Object")
		assert.Equal(jQueryStatic.Type(getDocumentBody), "function", "Type: Function")

		assert.Ok(!jQueryStatic.IsPlainObject(""), "IsPlainObject: string")
		assert.Ok(jQueryStatic.IsPlainObject(o), "IsPlainObject: Object")
		assert.Ok(!jQueryStatic.IsEmptyObject(o), "IsEmptyObject: Object")
		assert.Ok(jQueryStatic.IsEmptyObject(map[string]interface{}{}), "IsEmptyObject: Object")

		assert.Ok(!jQueryStatic.IsFunction(""), "IsFunction: string")
		assert.Ok(jQueryStatic.IsFunction(getDocumentBody), "IsFunction: getDocumentBody")

		assert.Ok(!jQueryStatic.IsNumeric("a3a"), "IsNumeric: string")
		assert.Ok(jQueryStatic.IsNumeric("0xFFF"), "IsNumeric: hex")
		assert.Ok(jQueryStatic.IsNumeric("8e-2"), "IsNumeric: exponential")

		assert.Ok(!jQueryStatic.IsXMLDoc(getDocumentBody), "HTML Body element")
		assert.Ok(jQueryStatic.IsWindow(getWindow()), "window")

	})

	QUnit.Module("dom")

	QUnit.Test("AddClass,Clone,Add,AppenTo,Find", func(assert QUnit.QUnitAssert) {

		jQuery("p").AddClass("wow").Clone().Add("<span id='dom02'>WhatADay</span>").AppendTo(FIX)
		txt := jQuery(FIX).Find("span#dom02").Text()
		assert.Equal(txt, "WhatADay", "Test of Clone, Add, AppendTo, Find, Text Functions")
	})

	QUnit.Test("ApiOnly:ScollFn,SetCss,FadeOut", func(assert QUnit.QUnitAssert) {

		QUnit.Expect(0)
		for i := 0; i < 3; i++ {
			jQuery("p").Clone().AppendTo(FIX)
		}
		jQuery(FIX).ScrollFn(func() {
			jQuery("span").SetCss("display", "inline").FadeOut("slow")
		})
	})

	QUnit.Test("ApiOnly:SelectFn,SetText,Show,FadeOut", func(assert QUnit.QUnitAssert) {

		QUnit.Expect(0)
		jQuery(`<p>Click and drag the mouse to select text in the inputs.</p>
  				<input type="text" value="Some text">
  				<input type="text" value="to test on">
  				<div></div>`).AppendTo(FIX)

		jQuery(":input").SelectFn(func() {
			jQuery("div").SetText("Something was selected").Show().FadeOut("1000")
		})

	})

	QUnit.Test("Eq,Find", func(assert QUnit.QUnitAssert) {

		jQuery(`<div></div>
				<div></div>
				<div class="test"></div>
				<div></div>
				<div></div>
				<div></div>`).AppendTo(FIX)

		assert.Ok(jQuery(FIX).Find("div").Eq(2).HasClass("test"), "Eq(2) has class test")
		assert.Ok(!jQuery(FIX).Find("div").Eq(0).HasClass("test"), "Eq(0) has no class test")
	})

	QUnit.Test("Find,End", func(assert QUnit.QUnitAssert) {

		jQuery(`<p class='ok'><span class='notok'>Hello</span>, how are you?</p>`).AppendTo(FIX)

		assert.Ok(jQuery(FIX).Find("p").Find("span").HasClass("notok"), "before call to end")
		assert.Ok(jQuery(FIX).Find("p").Find("span").End().HasClass("ok"), "after call to end")
	})

	QUnit.Test("ToArray,InArray", func(assert QUnit.QUnitAssert) {

		jQuery(`<div>a</div>
				<div>b</div>
				<div>c</div>`).AppendTo(FIX)

		divs := jQuery(FIX).Find("div")
		assert.Equal(divs.Length, 3, "3 divs in Fixture inserted")

		str := ""
		for _, v := range divs.ToArray() {
			str += jQuery(v).Text()
		}
		assert.Equal(str, "abc", "ToArray() allows range over selection")

		arr := []interface{}{"a", 3, true, 2.2, "GopherJS"}
		assert.Equal(jQueryStatic.InArray(4, arr), -1, "InArray")
		assert.Equal(jQueryStatic.InArray(3, arr), 1, "InArray")
		assert.Equal(jQueryStatic.InArray("a", arr), 0, "InArray")
		assert.Equal(jQueryStatic.InArray("b", arr), -1, "InArray")
		assert.Equal(jQueryStatic.InArray("GopherJS", arr), 4, "InArray")

	})

	QUnit.Test("Slice,Attr,First,Last", func(assert QUnit.QUnitAssert) {

		jQuery(`<ul>
  				<li class="firstclass">list item 1</li>
  				<li>list item 2</li>
  				<li>list item 3</li>
  				<li>list item 4</li>
  				<li class="lastclass">list item 5</li>
				</ul>`).AppendTo(FIX)

		assert.Equal(jQuery(FIX).Find("li").Slice(2).Length, 3, "Slice")
		assert.Equal(jQuery(FIX).Find("li").SliceByEnd(2, 4).Length, 2, "SliceByEnd")

		assert.Equal(jQuery(FIX).Find("li").First().Attr("class"), "firstclass", "First")
		assert.Equal(jQuery(FIX).Find("li").Last().Attr("class"), "lastclass", "Last")

	})

	QUnit.Test("ParseHTML, ParseXML, ParseJSON", func(assert QUnit.QUnitAssert) {

		str := `<ul>
  				<li class="firstclass">list item 1</li>
  				<li>list item 2</li>
  				<li>list item 3</li>
  				<li>list item 4</li>
  				<li class="lastclass">list item 5</li>
				</ul>`

		arr := jQueryStatic.ParseHTML(str)
		jQuery(arr).AppendTo(FIX)
		assert.Equal(jQuery(FIX).Find("ul li").Length, 5, "ParseHTML")

		xml := "<rss version='2.0'><channel><title>RSS Title</title></channel></rss>"
		xmlDoc := jQueryStatic.ParseXML(xml)
		assert.Equal(jQuery(xmlDoc).Find("title").Text(), "RSS Title", "ParseXML")

		obj := jQueryStatic.ParseJSON(`{ "language": "go" }`)
		language := obj.(map[string]interface{})["language"].(string)
		assert.Equal(language, "go", "ParseJSON")

	})

	QUnit.Test("Grep,Each,Map", func(assert QUnit.QUnitAssert) {

		arr := []interface{}{1, 9, 3, 8, 6, 1, 5, 9, 4, 7, 3, 8, 6, 9, 1}
		arr2 := jQueryStatic.Grep(arr, func(n interface{}, idx int) bool {
			return n.(float64) != float64(5) && idx > 4
		})
		assert.Equal(len(arr2), 9, "Grep")

		sum := float64(0.0)
		jQueryStatic.EachOverArray(arr, func(idx int, n interface{}) bool {
			sum += n.(float64)
			return idx < 5 //add first 5 numbers
		})
		assert.Equal(sum, 28, "EachOverArray")

		allLanguages := ""
		o := map[string]interface{}{"lang1": "Golang", "lang2": "Javascript", "lang3": "Typescript"}
		jQueryStatic.EachOverMap(o, func(key string, val interface{}) bool {
			allLanguages += val.(string)
			return true //add all
		})
		assert.Equal(allLanguages, "GolangJavascriptTypescript", "EachOverMap")

		letterArr := []interface{}{"a", "b", "c", "d", "e"}
		resultArr := jQueryStatic.MapOverArray(letterArr, func(n interface{}, idx int) interface{} {
			return strings.ToUpper(n.(string)) + strconv.Itoa(idx)
		})
		allLetters := ""
		for _, val := range resultArr {
			allLetters += val.(string)
		}
		assert.Equal(allLetters, "A0B1C2D3E4", "MapOverArray")

		upperLanguages := jQueryStatic.MapOverMap(o, func(val interface{}, key string) interface{} {
			return strings.ToUpper(val.(string))
		})
		allUpperLanguages := ""
		for _, val := range upperLanguages {
			allUpperLanguages += val.(string)
		}
		assert.Equal(allUpperLanguages, "GOLANGJAVASCRIPTTYPESCRIPT", "MapOverMap")

	})
}
