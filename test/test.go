package test

//test package for jquery bindings
//developed in itertative TDD style
import (
	"github.com/gopherjs/gopherjs/js"
	jQueryStatic "github.com/rusco/jquery"
	QUnit "github.com/rusco/qunit"
	_ "strconv"
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

		jQuery(`
			<p>Click and drag the mouse to select text in the inputs.</p>
  			<input type="text" value="Some text">
  			<input type="text" value="to test on">
  			<div></div>`).AppendTo(FIX)

		jQuery(":input").SelectFn(func() {
			jQuery("div").SetText("Something was selected").Show().FadeOut("1000")
		})

	})

}
